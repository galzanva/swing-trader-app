'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Strategy {
  id: string;
  name: string;
  direction: string;
  timeframe: string;
  isActive: boolean;
}

interface ScanResult {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  matchScore: number;
  matchDetails: {
    eligible: boolean;
    viability?: number;
    quality?: number;
    failureReason?: string;
    passedCriteria: string[];
    rrFirst?: number;
  };
  indicators?: {
    ema9: number;
    ema20: number;
    ema50: number;
    rsi14: number;
    atrPct: number;
    volZ: number;
  };
}

export default function ScannerClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<string>('');
  const [scanPercent, setScanPercent] = useState(0);
  const [cacheStats, setCacheStats] = useState<{ hits: number; calls: number } | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string>('');
  
  // Filter states
  const [marketCapPreset, setMarketCapPreset] = useState('mid_plus');
  const [minDollarVolume, setMinDollarVolume] = useState(20);
  const [minAtrPct, setMinAtrPct] = useState(0);
  const [maxAtrPct, setMaxAtrPct] = useState(100);
  const [trendDirection, setTrendDirection] = useState('any');
  const [showFilters, setShowFilters] = useState(false);
  
  const resultsPerPage = 10;

  // Load strategies on mount
  useEffect(() => {
    if (status === 'authenticated') {
      loadStrategies();
    }
  }, [status]);

  const loadStrategies = async () => {
    try {
      const response = await fetch('/api/strategy-builder/list?activeOnly=true');
      if (!response.ok) throw new Error('Failed to load strategies');
      
      const data = await response.json();
      setStrategies(data.strategies || []);
      
      // Auto-select first strategy
      if (data.strategies && data.strategies.length > 0) {
        setSelectedStrategyId(data.strategies[0].id);
      }
    } catch (err: any) {
      console.error('Error loading strategies:', err);
      setError('Failed to load strategies');
    }
  };

  const startScan = async () => {
    if (!selectedStrategyId) {
      setError('Please select a strategy');
      return;
    }

    setIsScanning(true);
    setError('');
    setResults([]);
    setCurrentPage(1);
    setScanProgress('Initializing scan...');
    setScanPercent(0);
    setCacheStats(null);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: selectedStrategyId,
          config: {
            minPrice: 5,
            maxPrice: 1000,
            minVolume: 500000,
            marketCapPreset,
            minDollarVolume: minDollarVolume * 1_000_000,
            minAtrPct,
            maxAtrPct,
            trendDirection,
            excludeOTC: true,
            excludeETFs: true,
            excludeWarrants: true,
            excludeADRs: true,
            sortByDollarVolume: true,
            earlyExitEnabled: true,
          },
          maxResults: 50,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Scan failed');
      }

      const data = await response.json();
      
      setResults(data.results || []);
      setScanProgress(`Scan complete! Found ${data.results?.length || 0} matches.`);
      setScanPercent(100);
      
      // Set cache stats if available
      if (data.metadata) {
        setCacheStats({
          hits: data.metadata.cacheHits || 0,
          calls: data.metadata.apiCalls || 0,
        });
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setError(err.message || 'Scan failed');
      setScanPercent(0);
    } finally {
      setIsScanning(false);
    }
  };

  // Pagination
  const totalPages = Math.ceil(results.length / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const currentResults = results.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (status === 'loading') {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-white text-xl">Loading...</div>
      </main>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          📡 Market Scanner
        </h1>
        <p className="text-blue-200">
          Scan thousands of stocks to find the best matches for your strategies
        </p>
      </div>

      {/* Scanner Controls */}
      <div className="bg-slate-800/50 backdrop-blur border border-blue-500/30 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Strategy Selector */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-blue-200 mb-2">
              Select Strategy
            </label>
            <select
              value={selectedStrategyId}
              onChange={(e) => setSelectedStrategyId(e.target.value)}
              disabled={isScanning}
              className="w-full px-4 py-3 bg-slate-700/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">Choose a strategy...</option>
              {strategies.map(strategy => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name} ({strategy.direction.toUpperCase()}, {strategy.timeframe})
                </option>
              ))}
            </select>
          </div>

          {/* Scan Button */}
          <div className="flex items-end">
            <button
              onClick={startScan}
              disabled={isScanning || !selectedStrategyId}
              className="w-full px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isScanning ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Scanning...
                </span>
              ) : (
                '🔍 Start Scan'
              )}
            </button>
          </div>
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-blue-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Advanced Filters
        </button>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-blue-500/30 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Market Cap */}
            <div>
              <label className="block text-xs font-medium text-blue-300 mb-1">Market Cap</label>
              <select
                value={marketCapPreset}
                onChange={(e) => setMarketCapPreset(e.target.value)}
                disabled={isScanning}
                className="w-full px-3 py-2 bg-slate-700/50 border border-blue-500/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="any">Any</option>
                <option value="nano">Nano (&lt; $50M)</option>
                <option value="micro">Micro ($50M–$300M)</option>
                <option value="small">Small ($300M–$2B)</option>
                <option value="mid">Mid ($2B–$10B)</option>
                <option value="large">Large ($10B–$200B)</option>
                <option value="mega">Mega (&gt; $200B)</option>
                <option value="mid_plus">Mid+ (≥ $2B) ⭐</option>
                <option value="large_plus">Large+ (≥ $10B)</option>
              </select>
            </div>

            {/* Dollar Volume */}
            <div>
              <label className="block text-xs font-medium text-blue-300 mb-1">Min Dollar Volume ($M)</label>
              <input
                type="number"
                value={minDollarVolume}
                onChange={(e) => setMinDollarVolume(Number(e.target.value))}
                disabled={isScanning}
                min="0"
                step="5"
                className="w-full px-3 py-2 bg-slate-700/50 border border-blue-500/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>

            {/* Trend Direction */}
            <div>
              <label className="block text-xs font-medium text-blue-300 mb-1">Trend Direction</label>
              <select
                value={trendDirection}
                onChange={(e) => setTrendDirection(e.target.value)}
                disabled={isScanning}
                className="w-full px-3 py-2 bg-slate-700/50 border border-blue-500/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="any">Any</option>
                <option value="uptrend">Uptrend (SMA50 &gt; SMA200)</option>
                <option value="downtrend">Downtrend (SMA50 &lt; SMA200)</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>

            {/* ATR% Range */}
            <div>
              <label className="block text-xs font-medium text-blue-300 mb-1">ATR% Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={minAtrPct}
                  onChange={(e) => setMinAtrPct(Number(e.target.value))}
                  disabled={isScanning}
                  min="0"
                  step="0.5"
                  placeholder="Min"
                  className="w-1/2 px-2 py-2 bg-slate-700/50 border border-blue-500/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
                <input
                  type="number"
                  value={maxAtrPct}
                  onChange={(e) => setMaxAtrPct(Number(e.target.value))}
                  disabled={isScanning}
                  min="0"
                  step="0.5"
                  placeholder="Max"
                  className="w-1/2 px-2 py-2 bg-slate-700/50 border border-blue-500/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {isScanning && (
          <div className="mt-4">
            <div className="w-full bg-slate-700/50 rounded-full h-2 mb-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${scanPercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-blue-200">{scanProgress}</span>
              {cacheStats && (
                <span className="text-blue-300">
                  Cache: {cacheStats.hits} hits • API: {cacheStats.calls} calls
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && !isScanning && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}
      </div>

        {/* Results */}
        {results.length > 0 && (
          <>
            {/* Results Summary */}
            <div className="mb-6 flex items-center justify-between">
              <div className="text-white">
                <span className="text-2xl font-bold">{results.length}</span>
                <span className="text-blue-200 ml-2">analyzed</span>
                <span className="mx-3 text-blue-500">|</span>
                <span className={`text-xl font-semibold ${
                  results.filter(r => r.matchDetails.eligible).length > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {results.filter(r => r.matchDetails.eligible).length}
                </span>
                <span className="text-blue-200 ml-2">qualified</span>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-slate-700 text-white rounded disabled:opacity-30"
                  >
                    ←
                  </button>
                  <span className="text-white">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-slate-700 text-white rounded disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              )}
            </div>

            {/* No Qualified Matches Warning */}
            {results.filter(r => r.matchDetails.eligible).length === 0 && (
              <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚠️</div>
                  <div>
                    <h3 className="text-yellow-300 font-semibold mb-1">
                      No stocks qualified for this strategy
                    </h3>
                    <p className="text-yellow-200/80 text-sm mb-2">
                      The stocks below were analyzed but didn't meet all criteria. Review their failure reasons to understand why.
                    </p>
                    <p className="text-yellow-200/60 text-xs">
                      💡 Tip: Try a different strategy, adjust your strategy criteria, or run the scan at a different time.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentResults.map((result) => (
                <ResultCard key={result.ticker} result={result} />
              ))}
            </div>

            {/* Bottom Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`w-10 h-10 rounded ${
                        page === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-blue-200 hover:bg-slate-600'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!isScanning && results.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Ready to Scan
            </h3>
            <p className="text-blue-200">
              Select a strategy and click "Start Scan" to find matching stocks
            </p>
          </div>
        )}
      </main>
  );
}

// Result Card Component
function ResultCard({ result }: { result: ScanResult }) {
  const router = useRouter();
  
  const handleAnalyze = () => {
    router.push(`/?ticker=${result.ticker}`);
  };

  return (
    <div className={`bg-slate-800/50 backdrop-blur border rounded-xl p-5 transition-all hover:border-blue-500/50 ${
      result.matchDetails.eligible
        ? 'border-green-500/30'
        : 'border-blue-500/30 opacity-75'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {result.ticker}
          </h3>
          <p className="text-blue-200 text-sm">{result.name}</p>
        </div>
        
        {/* Match Score Badge */}
        <div className={`px-4 py-2 rounded-full font-bold text-lg ${
          result.matchScore >= 70 ? 'bg-green-500/20 text-green-300' :
          result.matchScore >= 50 ? 'bg-yellow-500/20 text-yellow-300' :
          'bg-gray-500/20 text-gray-300'
        }`}>
          {result.matchScore}%
        </div>
      </div>

      {/* Price Info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-sm text-blue-300">Price</div>
          <div className="text-2xl font-bold text-white">
            ${result.price.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-sm text-blue-300">Change</div>
          <div className={`text-2xl font-bold ${
            result.change >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {result.change >= 0 ? '+' : ''}{result.changePercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Indicators (if available) */}
      {result.indicators && (
        <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
          <div className="bg-slate-700/50 rounded p-2">
            <div className="text-blue-300">RSI</div>
            <div className="text-white font-semibold">{result.indicators.rsi14.toFixed(1)}</div>
          </div>
          <div className="bg-slate-700/50 rounded p-2">
            <div className="text-blue-300">Vol Z</div>
            <div className="text-white font-semibold">{result.indicators.volZ.toFixed(2)}</div>
          </div>
          <div className="bg-slate-700/50 rounded p-2">
            <div className="text-blue-300">ATR%</div>
            <div className="text-white font-semibold">{result.indicators.atrPct.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* Match Details */}
      {result.matchDetails.eligible ? (
        <div className="mb-4">
          <div className="text-sm font-semibold text-green-300 mb-2">
            ✓ Qualifies for Strategy
          </div>
          {result.matchDetails.rrFirst && (
            <div className="text-sm text-blue-200">
              R:R = {result.matchDetails.rrFirst.toFixed(2)}:1
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4">
          <div className="text-sm font-semibold text-gray-400 mb-1">
            ✗ Not Qualified
          </div>
          {result.matchDetails.failureReason && (
            <div className="text-xs text-gray-400">
              {result.matchDetails.failureReason}
            </div>
          )}
        </div>
      )}

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
      >
        View Full Analysis →
      </button>
    </div>
  );
}

