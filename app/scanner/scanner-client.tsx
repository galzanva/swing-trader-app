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
  matchedStrategy?: string; // Name of the strategy that matched
  matchedStrategyId?: string; // ID of user strategy (if user strategy matched)
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
    // New indicators from screener
    adx?: number;
    plusDI?: number;
    minusDI?: number;
    ema20Distance?: number;
    cmf?: number;
    relativeVolume?: number;
    macdLine?: number;
    macdHistogram?: number;
  };
  squeeze?: {
    combinedScore: number;
    combinedPotential: 'extreme' | 'high' | 'moderate' | 'low' | 'none';
    alignment: boolean;
    shortFloat: number | null;
    daysToCover: number | null;
    ttmState: 'ON' | 'FIRE' | 'OFF';
    ttmDuration: number;
  };
  // New: Filter results from screener
  filterResults?: Array<{
    name: string;
    passed: boolean;
    value: number | string | boolean;
    threshold?: string;
    reason?: string;
  }>;
}

// Screener presets
const SCREENER_PRESETS = [
  { id: 'earlyBullishTrend', name: '🚀 Early Bullish Trend (5-15 day swings)', description: 'ADX 20-30, RSI 55-65, above EMAs' },
  { id: 'oversoldBounce', name: '📉 Oversold Bounce', description: 'RSI < 40, above EMA50, bounce candidates' },
  { id: 'breakoutSetup', name: '💥 Breakout Setup', description: 'Near 52W high, in squeeze, consolidating' },
  { id: 'highVolumeMovers', name: '📊 High Volume Movers', description: '3×+ relative volume, big movers' },
  { id: 'strongTrend', name: '📈 Strong Trend', description: 'ADX > 30, bullish MA alignment' },
];

export default function ScannerClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('overview'); // Default to overview
  const [selectedPreset, setSelectedPreset] = useState<string>(''); // Screener preset
  const [scanMode, setScanMode] = useState<'strategy' | 'screener' | 'overview'>('overview');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<string>('');
  const [scanPercent, setScanPercent] = useState(0);
  const [cacheStats, setCacheStats] = useState<{ hits: number; calls: number } | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string>('');
  const [scanCompleted, setScanCompleted] = useState(false);
  
  // Basic Filter states
  const [minDollarVolume, setMinDollarVolume] = useState(20);
  const [minAtrPct, setMinAtrPct] = useState(0);
  const [maxAtrPct, setMaxAtrPct] = useState(100);
  const [trendDirection, setTrendDirection] = useState('any');
  const [minPrice, setMinPrice] = useState(5);
  const [maxPrice, setMaxPrice] = useState(500);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // NEW SCREENER FILTERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  // ADX Filter (Trend Strength)
  const [adxFilterEnabled, setAdxFilterEnabled] = useState(false);
  const [minAdx, setMinAdx] = useState(20);
  const [maxAdx, setMaxAdx] = useState(30);
  const [requirePlusDIAboveMinusDI, setRequirePlusDIAboveMinusDI] = useState(true);
  
  // RSI Filter
  const [rsiFilterEnabled, setRsiFilterEnabled] = useState(false);
  const [minRsi, setMinRsi] = useState(55);
  const [maxRsi, setMaxRsi] = useState(65);
  
  // EMA Distance Filter
  const [emaDistanceEnabled, setEmaDistanceEnabled] = useState(false);
  const [emaDistanceType, setEmaDistanceType] = useState<'ema20' | 'ema50'>('ema20');
  const [priceAboveEma, setPriceAboveEma] = useState(true);
  const [maxEmaDistance, setMaxEmaDistance] = useState(10); // Max % above/below
  
  // MACD Filter
  const [macdFilterEnabled, setMacdFilterEnabled] = useState(false);
  const [requireMacdAboveZero, setRequireMacdAboveZero] = useState(true);
  
  // Volume Filter
  const [volumeFilterEnabled, setVolumeFilterEnabled] = useState(false);
  const [minRelativeVolume, setMinRelativeVolume] = useState(1.5);
  
  // CMF Filter (Money Flow)
  const [cmfFilterEnabled, setCmfFilterEnabled] = useState(false);
  const [minCmf, setMinCmf] = useState(-0.1); // Exclude distribution
  
  // Squeeze filter states
  const [minDaysToCover, setMinDaysToCover] = useState(0);
  const [minShortFloat, setMinShortFloat] = useState(0);
  const [ttmSqueezeState, setTtmSqueezeState] = useState('any');
  
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Result filtering and sorting states
  const [sortBy, setSortBy] = useState<'matchScore' | 'rsi' | 'atr' | 'price' | 'volume' | 'changePercent'>('matchScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterRsiMin, setFilterRsiMin] = useState<number>(0);
  const [filterRsiMax, setFilterRsiMax] = useState<number>(100);
  const [filterAtrMin, setFilterAtrMin] = useState<number>(0);
  const [filterAtrMax, setFilterAtrMax] = useState<number>(100);
  const [filterPriceMin, setFilterPriceMin] = useState<number>(0);
  const [filterPriceMax, setFilterPriceMax] = useState<number>(999999);
  
  const resultsPerPage = 10;
  
  // Check if we're in overview mode
  const isOverviewMode = scanMode === 'overview';
  const isScreenerMode = scanMode === 'screener';

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
    } catch (err: any) {
      console.error('Error loading strategies:', err);
      setError('Failed to load strategies');
    }
  };

  // Apply a preset configuration
  const applyPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    setScanMode('screener');
    
    // Reset all filters first
    setAdxFilterEnabled(false);
    setRsiFilterEnabled(false);
    setEmaDistanceEnabled(false);
    setMacdFilterEnabled(false);
    setVolumeFilterEnabled(false);
    setCmfFilterEnabled(false);
    
    // Apply preset-specific settings
    switch (presetId) {
      case 'earlyBullishTrend':
        setAdxFilterEnabled(true);
        setMinAdx(20);
        setMaxAdx(30);
        setRequirePlusDIAboveMinusDI(true);
        setRsiFilterEnabled(true);
        setMinRsi(55);
        setMaxRsi(65);
        setEmaDistanceEnabled(true);
        setEmaDistanceType('ema20');
        setPriceAboveEma(true);
        setMaxEmaDistance(10);
        setCmfFilterEnabled(true);
        setMinCmf(-0.1);
        setMinAtrPct(2);
        setMaxAtrPct(8);
        break;
      case 'oversoldBounce':
        setRsiFilterEnabled(true);
        setMinRsi(25);
        setMaxRsi(40);
        setEmaDistanceEnabled(true);
        setEmaDistanceType('ema50');
        setPriceAboveEma(true);
        setMaxEmaDistance(20);
        break;
      case 'breakoutSetup':
        setAdxFilterEnabled(true);
        setMinAdx(15);
        setMaxAdx(25);
        setVolumeFilterEnabled(true);
        setMinRelativeVolume(1.2);
        setTtmSqueezeState('ON');
        break;
      case 'highVolumeMovers':
        setVolumeFilterEnabled(true);
        setMinRelativeVolume(3.0);
        break;
      case 'strongTrend':
        setAdxFilterEnabled(true);
        setMinAdx(30);
        setMaxAdx(60);
        setRequirePlusDIAboveMinusDI(true);
        setEmaDistanceEnabled(true);
        setEmaDistanceType('ema20');
        setPriceAboveEma(true);
        setMaxEmaDistance(15);
        break;
    }
    
    setShowAdvancedFilters(true);
  };

  const startScan = async () => {
    if (scanMode === 'strategy' && !selectedStrategyId) {
      setError('Please select a strategy');
      return;
    }

    setIsScanning(true);
    setError('');
    setResults([]);
    setCurrentPage(1);
    setScanCompleted(false);
    setScanProgress(isScreenerMode ? 'Running screener filters...' : isOverviewMode ? 'Scanning market (overview mode)...' : 'Initializing scan...');
    setScanPercent(0);
    setCacheStats(null);

    try {
      // ═══════════════════════════════════════════════════════════════════════════
      // SCREENER MODE - Use new filter-based screener API
      // ═══════════════════════════════════════════════════════════════════════════
      if (isScreenerMode) {
        await runScreenerScan();
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // STRATEGY/OVERVIEW MODE - Use existing scanner API
      // ═══════════════════════════════════════════════════════════════════════════
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: isOverviewMode ? undefined : selectedStrategyId,
          stream: true,
          config: {
            overviewMode: isOverviewMode,
            minPrice,
            maxPrice,
            minVolume: 500000,
            minDollarVolume: minDollarVolume * 1_000_000,
            minAtrPct,
            maxAtrPct,
            trendDirection,
            minDaysToCover: minDaysToCover > 0 ? minDaysToCover : undefined,
            minShortFloat: minShortFloat > 0 ? minShortFloat : undefined,
            ttmSqueezeState: ttmSqueezeState !== 'any' ? ttmSqueezeState : undefined,
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
        throw new Error('Scan failed');
      }

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process all complete messages in the buffer
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete message in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6); // Remove 'data: ' prefix
              const message = JSON.parse(jsonStr);
              
              if (message.type === 'progress') {
                const progress = message.data;
                
                // Update progress
                setScanPercent(progress.percent);
                
                // Build detailed progress message
                let progressMsg = progress.message;
                if (progress.phase === 'detailed' && progress.total > 0) {
                  progressMsg = `Analyzing stocks: ${progress.processed}/${progress.total} (${progress.qualified} qualified)`;
                }
                setScanProgress(progressMsg);
                
                // Update cache stats
                if (progress.cacheHits !== undefined && progress.apiCalls !== undefined) {
                  setCacheStats({
                    hits: progress.cacheHits,
                    calls: progress.apiCalls,
                  });
                }
              } else if (message.type === 'complete') {
                const data = message.data;
                setResults(data.results || []);
                setScanProgress(`Scan complete! Found ${data.results?.length || 0} matches.`);
                setScanPercent(100);
                
                if (data.metadata) {
                  setCacheStats({
                    hits: data.metadata.cacheHits || 0,
                    calls: data.metadata.apiCalls || 0,
                  });
                }
              } else if (message.type === 'error') {
                throw new Error(message.data.details || message.data.error);
              }
            } catch (parseErr) {
              console.error('Error parsing SSE message:', parseErr);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setError(err.message || 'Scan failed');
      setScanPercent(0);
    } finally {
      setIsScanning(false);
      setScanCompleted(true);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW SCREENER SCAN - Uses filter-based screener API
  // ═══════════════════════════════════════════════════════════════════════════
  const runScreenerScan = async () => {
    // Build filters from UI state
    const filters: any = {};
    
    // Price filter
    filters.price = { type: 'price', enabled: true, minPrice, maxPrice };
    
    // ADX filter
    if (adxFilterEnabled) {
      filters.adx = { type: 'adx', enabled: true, minADX: minAdx, maxADX: maxAdx };
      if (requirePlusDIAboveMinusDI) {
        filters.directional = { type: 'directional', enabled: true, plusDIAboveMinusDI: true };
      }
    }
    
    // RSI filter
    if (rsiFilterEnabled) {
      filters.rsi = { type: 'rsi', enabled: true, minRSI: minRsi, maxRSI: maxRsi };
    }
    
    // EMA Distance filter
    if (emaDistanceEnabled) {
      filters.priceToMA = [{
        type: 'priceToMA',
        enabled: true,
        maType: 'ema',
        maPeriod: emaDistanceType === 'ema20' ? 20 : 50,
        position: priceAboveEma ? 'above' : 'below',
        minDistancePercent: 0,
        maxDistancePercent: maxEmaDistance,
      }];
    }
    
    // MACD filter
    if (macdFilterEnabled) {
      filters.macd = { type: 'macd', enabled: true, macdAboveZero: requireMacdAboveZero };
    }
    
    // Volume filter
    if (volumeFilterEnabled) {
      filters.volume = { type: 'volume', enabled: true, minRelativeVolume };
    }
    
    // CMF filter
    if (cmfFilterEnabled) {
      filters.cmf = { type: 'cmf', enabled: true, minCMF: minCmf };
    }
    
    // ATR filter
    if (minAtrPct > 0 || maxAtrPct < 100) {
      filters.atr = { type: 'atr', enabled: true, minATRPercent: minAtrPct, maxATRPercent: maxAtrPct };
    }
    
    // Dollar volume filter
    if (minDollarVolume > 0) {
      filters.dollarVolume = { type: 'dollarVolume', enabled: true, minDollarVolume: minDollarVolume * 1_000_000 };
    }
    
    // Exchange filter (exclude ETFs, ADRs, warrants)
    filters.exchange = {
      type: 'exchange',
      enabled: true,
      includeExchanges: ['NYSE', 'NASDAQ', 'AMEX'],
      excludeETFs: true,
      excludeADRs: true,
      excludeWarrants: true,
    };
    
    // TTM Squeeze filter
    if (ttmSqueezeState !== 'any') {
      filters.ttmSqueeze = { 
        type: 'ttmSqueeze', 
        enabled: true, 
        state: ttmSqueezeState === 'ON' ? 'on' : ttmSqueezeState === 'FIRE' ? 'firing' : 'off'
      };
    }

    try {
      // If preset is selected, use it; otherwise use custom filters
      const requestBody: any = {
        maxResults: 50,
        maxCandidates: 2000, // Scan up to 2000 stocks (sorted by dollar volume)
        stream: true,
      };
      
      if (selectedPreset && selectedPreset !== 'custom') {
        requestBody.preset = selectedPreset;
      } else {
        requestBody.filters = filters;
      }
      
      const response = await fetch('/api/screener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Screener failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let buffer = '';
      const foundResults: ScanResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const message = JSON.parse(line.substring(6));
              
              if (message.type === 'progress') {
                setScanPercent(message.data.percent);
                setScanProgress(message.data.message);
              } else if (message.type === 'found') {
                // Convert screener result to ScanResult format
                const sr = message.data;
                const converted: ScanResult = {
                  ticker: sr.ticker,
                  name: sr.name,
                  price: sr.price,
                  change: sr.change || 0,
                  changePercent: sr.changePercent || 0,
                  volume: sr.volume || 0,
                  matchScore: sr.matchScore,
                  matchDetails: {
                    eligible: sr.passed,
                    passedCriteria: sr.filterResults?.filter((f: any) => f.passed).map((f: any) => f.name) || [],
                    failureReason: sr.filterResults?.filter((f: any) => !f.passed).map((f: any) => f.reason || f.name).join(', '),
                  },
                  indicators: {
                    ema9: sr.indicators?.ema9 || 0,
                    ema20: sr.indicators?.ema20 || 0,
                    ema50: sr.indicators?.ema50 || 0,
                    rsi14: sr.indicators?.rsi || 0,
                    atrPct: sr.indicators?.atrPercent || 0,
                    volZ: sr.indicators?.volumeZScore || 0,
                    adx: sr.indicators?.adx,
                    plusDI: sr.indicators?.plusDI,
                    minusDI: sr.indicators?.minusDI,
                    ema20Distance: sr.indicators?.ema20Distance,
                    cmf: sr.indicators?.cmf,
                    relativeVolume: sr.indicators?.relativeVolume,
                  },
                  filterResults: sr.filterResults,
                };
                foundResults.push(converted);
                setResults([...foundResults]);
              } else if (message.type === 'complete') {
                setScanProgress(`Scan complete! Found ${foundResults.length} matches.`);
                setScanPercent(100);
              } else if (message.type === 'error') {
                throw new Error(message.data.error);
              }
            } catch (parseErr) {
              console.error('Error parsing SSE:', parseErr);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Screener error:', err);
      setError(err.message || 'Screener failed');
      setScanPercent(0);
    } finally {
      setIsScanning(false);
      setScanCompleted(true);
    }
  };

  // Apply filtering and sorting to results
  const filteredResults = results.filter(r => {
    // RSI filter
    if (r.indicators) {
      if (r.indicators.rsi14 < filterRsiMin || r.indicators.rsi14 > filterRsiMax) return false;
      if (r.indicators.atrPct < filterAtrMin || r.indicators.atrPct > filterAtrMax) return false;
    }
    // Price filter
    if (r.price < filterPriceMin || r.price > filterPriceMax) return false;
    return true;
  });
  
  const sortedResults = [...filteredResults].sort((a, b) => {
    let aVal: number = 0;
    let bVal: number = 0;
    
    switch (sortBy) {
      case 'matchScore':
        aVal = a.matchScore;
        bVal = b.matchScore;
        break;
      case 'rsi':
        aVal = a.indicators?.rsi14 ?? 50;
        bVal = b.indicators?.rsi14 ?? 50;
        break;
      case 'atr':
        aVal = a.indicators?.atrPct ?? 0;
        bVal = b.indicators?.atrPct ?? 0;
        break;
      case 'price':
        aVal = a.price;
        bVal = b.price;
        break;
      case 'volume':
        aVal = a.volume;
        bVal = b.volume;
        break;
      case 'changePercent':
        aVal = a.changePercent;
        bVal = b.changePercent;
        break;
    }
    
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  // Pagination
  const totalPages = Math.ceil(sortedResults.length / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const currentResults = sortedResults.slice(startIndex, endIndex);

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
        {/* Scan Mode Tabs */}
        <div className="flex gap-2 mb-6 border-b border-blue-500/30 pb-4">
          <button
            onClick={() => { setScanMode('overview'); setSelectedPreset(''); }}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              scanMode === 'overview' 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-700/50 text-blue-300 hover:bg-slate-700'
            }`}
          >
            📊 Overview
          </button>
          <button
            onClick={() => { setScanMode('screener'); setSelectedPreset(''); }}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              scanMode === 'screener'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700/50 text-blue-300 hover:bg-slate-700'
            }`}
          >
            🔬 Screener
          </button>
          <button
            onClick={() => { setScanMode('strategy'); setSelectedPreset(''); }}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              scanMode === 'strategy'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-700/50 text-blue-300 hover:bg-slate-700'
            }`}
          >
            🎯 Strategy
          </button>
        </div>

        {/* Mode-specific configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Left Panel - Mode Selection */}
          <div className="lg:col-span-2">
            {/* OVERVIEW MODE */}
            {scanMode === 'overview' && (
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">
                  📊 Market Overview Mode
                </label>
                <p className="text-sm text-blue-300 bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                  Scan the market with basic filters. Fastest mode - returns stocks sorted by dollar volume.
                  Use the filters below to narrow results.
                </p>
              </div>
            )}

            {/* SCREENER MODE */}
            {scanMode === 'screener' && (
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  🔬 Filter-Based Screener
                </label>
                <div className="space-y-3">
                  {/* Preset Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {SCREENER_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset.id)}
                        disabled={isScanning}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          selectedPreset === preset.id
                            ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                            : 'bg-slate-700/50 text-purple-300 hover:bg-slate-700 border border-purple-500/30'
                        }`}
                        title={preset.description}
                      >
                        {preset.name}
                      </button>
                    ))}
                    <button
                      onClick={() => { setSelectedPreset('custom'); setShowAdvancedFilters(true); }}
                      disabled={isScanning}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedPreset === 'custom'
                          ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                          : 'bg-slate-700/50 text-purple-300 hover:bg-slate-700 border border-purple-500/30'
                      }`}
                    >
                      ⚙️ Custom Filters
                    </button>
                  </div>
                  {selectedPreset && selectedPreset !== 'custom' && (
                    <div className="space-y-2">
                      <p className="text-xs text-purple-300 bg-purple-500/10 rounded p-2 border border-purple-500/20">
                        {SCREENER_PRESETS.find(p => p.id === selectedPreset)?.description}
                      </p>
                      <p className="text-xs text-purple-200 italic">
                        💡 Preset filters are active. Click "Custom Filters" below to override.
                      </p>
                    </div>
                  )}
                  {selectedPreset === 'custom' && (
                    <p className="text-xs text-purple-300 bg-purple-500/10 rounded p-2 border border-purple-500/20">
                      ⚙️ Using custom filter configuration. Enable filters below.
                    </p>
                  )}
                  {!selectedPreset && (
                    <p className="text-xs text-purple-300 bg-purple-500/10 rounded p-2 border border-purple-500/20">
                      Select a preset above or click "Custom Filters" to configure your own filters.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* STRATEGY MODE */}
            {scanMode === 'strategy' && (
              <div>
                <label className="block text-sm font-medium text-teal-200 mb-2">
                  🎯 Strategy-Based Scan
                </label>
                <select
                  value={selectedStrategyId}
                  onChange={(e) => setSelectedStrategyId(e.target.value)}
                  disabled={isScanning}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-teal-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
                >
                  <option value="">Select a strategy...</option>
                  {strategies.length === 0 && (
                    <option value="" disabled>No strategies found - create one first</option>
                  )}
                  {strategies.map(strategy => (
                    <option key={strategy.id} value={strategy.id}>
                      {strategy.name} ({strategy.direction.toUpperCase()}, {strategy.timeframe})
                    </option>
                  ))}
                </select>
                {strategies.length === 0 && (
                  <p className="mt-2 text-xs text-teal-300">
                    💡 Create a strategy in the Strategy Builder to use this mode.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Scan Button */}
          <div className="flex items-end">
            <button
              onClick={startScan}
              disabled={
                isScanning || 
                (scanMode === 'strategy' && !selectedStrategyId) || 
                (scanMode === 'screener' && !selectedPreset && !adxFilterEnabled && !rsiFilterEnabled && !emaDistanceEnabled && !macdFilterEnabled && !volumeFilterEnabled && !cmfFilterEnabled)
              }
              className={`w-full px-8 py-3 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                scanMode === 'screener'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                  : scanMode === 'strategy'
                    ? 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
              } text-white`}
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
                `🔍 Run ${scanMode === 'screener' ? 'Screener' : scanMode === 'strategy' ? 'Strategy Scan' : 'Overview'}`
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
          <div className="mt-4 pt-4 border-t border-blue-500/30">
            {/* Basic Filters */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-blue-200 mb-3">Basic Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            </div>

            {/* Squeeze Filters */}
            <div className="pt-4 border-t border-blue-500/20">
              <h3 className="text-sm font-semibold text-blue-200 mb-3 flex items-center gap-2">
                🔥 Squeeze Filters
                <span className="text-xs font-normal text-blue-300">(Short Float + TTM Squeeze)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Min Days to Cover */}
                <div>
                  <label className="block text-xs font-medium text-blue-300 mb-1">
                    Min Days to Cover
                    <span className="ml-1 text-blue-400 cursor-help" title="Higher DTC = harder for shorts to exit = more squeeze potential">ⓘ</span>
                  </label>
                  <input
                    type="number"
                    value={minDaysToCover}
                    onChange={(e) => setMinDaysToCover(Number(e.target.value))}
                    disabled={isScanning}
                    min="0"
                    max="50"
                    step="0.5"
                    placeholder="e.g., 5"
                    className="w-full px-3 py-2 bg-slate-700/50 border border-blue-500/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <div className="text-xs text-blue-400 mt-1">0 = any (typical: 5-10+ is high)</div>
                </div>

                {/* Min Short Float % */}
                <div>
                  <label className="block text-xs font-medium text-blue-300 mb-1">
                    Min Short Float %
                    <span className="ml-1 text-blue-400 cursor-help" title="% of float shares sold short - higher = more squeeze potential">ⓘ</span>
                  </label>
                  <input
                    type="number"
                    value={minShortFloat}
                    onChange={(e) => setMinShortFloat(Number(e.target.value))}
                    disabled={isScanning}
                    min="0"
                    max="100"
                    step="1"
                    placeholder="e.g., 15"
                    className="w-full px-3 py-2 bg-slate-700/50 border border-blue-500/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <div className="text-xs text-blue-400 mt-1">0 = any (typical: 15-20%+ is high)</div>
                </div>

                {/* TTM Squeeze State */}
                <div>
                  <label className="block text-xs font-medium text-blue-300 mb-1">
                    TTM Squeeze State
                    <span className="ml-1 text-blue-400 cursor-help" title="Volatility compression indicator - FIRE = breakout happening">ⓘ</span>
                  </label>
                  <select
                    value={ttmSqueezeState}
                    onChange={(e) => setTtmSqueezeState(e.target.value)}
                    disabled={isScanning}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-blue-500/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="any">Any</option>
                    <option value="FIRE">🔥 FIRE (Breakout!)</option>
                    <option value="ON">⚡ ON (Building Pressure)</option>
                    <option value="OFF">OFF (No Squeeze)</option>
                  </select>
                  <div className="text-xs text-blue-400 mt-1">FIRE = just broke out of squeeze</div>
                </div>
              </div>
              
              {/* Squeeze Filter Info */}
              {(minDaysToCover > 0 || minShortFloat > 0 || ttmSqueezeState !== 'any') && (
                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="text-xs text-blue-200">
                    <span className="font-semibold">Active Squeeze Filters:</span>
                    {minDaysToCover > 0 && <span className="ml-2">DTC ≥ {minDaysToCover}</span>}
                    {minShortFloat > 0 && <span className="ml-2">Short Float ≥ {minShortFloat}%</span>}
                    {ttmSqueezeState !== 'any' && <span className="ml-2">TTM: {ttmSqueezeState}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* ADVANCED SCREENER FILTERS (Only for Screener Mode) */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {scanMode === 'screener' && showAdvancedFilters && (
          <div className="mt-4 pt-4 border-t border-purple-500/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-purple-200 flex items-center gap-2">
                🔬 Technical Filters
                <span className="text-xs font-normal text-purple-300">(Customize your screener)</span>
              </h3>
              <button
                onClick={() => {
                  // Reset all filters
                  setAdxFilterEnabled(false);
                  setRsiFilterEnabled(false);
                  setEmaDistanceEnabled(false);
                  setMacdFilterEnabled(false);
                  setVolumeFilterEnabled(false);
                  setCmfFilterEnabled(false);
                  setSelectedPreset('custom');
                }}
                className="text-xs text-purple-300 hover:text-white transition-colors"
              >
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* ADX Filter */}
              <div className={`p-3 rounded-lg border ${adxFilterEnabled ? 'bg-purple-500/10 border-purple-500/40' : 'bg-slate-700/30 border-slate-600/30'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={adxFilterEnabled}
                    onChange={(e) => setAdxFilterEnabled(e.target.checked)}
                    disabled={isScanning}
                    className="w-4 h-4 accent-purple-500"
                  />
                  <span className="text-sm font-medium text-white">ADX (Trend Strength)</span>
                </label>
                {adxFilterEnabled && (
                  <div className="space-y-2 mt-2">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={minAdx}
                        onChange={(e) => setMinAdx(Number(e.target.value))}
                        disabled={isScanning}
                        min="0" max="100" step="1"
                        placeholder="Min"
                        className="w-1/2 px-2 py-1 bg-slate-700/50 border border-purple-500/20 rounded text-white text-xs"
                      />
                      <input
                        type="number"
                        value={maxAdx}
                        onChange={(e) => setMaxAdx(Number(e.target.value))}
                        disabled={isScanning}
                        min="0" max="100" step="1"
                        placeholder="Max"
                        className="w-1/2 px-2 py-1 bg-slate-700/50 border border-purple-500/20 rounded text-white text-xs"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-purple-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requirePlusDIAboveMinusDI}
                        onChange={(e) => setRequirePlusDIAboveMinusDI(e.target.checked)}
                        disabled={isScanning}
                        className="w-3 h-3 accent-purple-500"
                      />
                      +DI &gt; -DI (Bullish)
                    </label>
                  </div>
                )}
              </div>

              {/* RSI Filter */}
              <div className={`p-3 rounded-lg border ${rsiFilterEnabled ? 'bg-purple-500/10 border-purple-500/40' : 'bg-slate-700/30 border-slate-600/30'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={rsiFilterEnabled}
                    onChange={(e) => setRsiFilterEnabled(e.target.checked)}
                    disabled={isScanning}
                    className="w-4 h-4 accent-purple-500"
                  />
                  <span className="text-sm font-medium text-white">RSI</span>
                </label>
                {rsiFilterEnabled && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="number"
                      value={minRsi}
                      onChange={(e) => setMinRsi(Number(e.target.value))}
                      disabled={isScanning}
                      min="0" max="100" step="1"
                      placeholder="Min"
                      className="w-1/2 px-2 py-1 bg-slate-700/50 border border-purple-500/20 rounded text-white text-xs"
                    />
                    <input
                      type="number"
                      value={maxRsi}
                      onChange={(e) => setMaxRsi(Number(e.target.value))}
                      disabled={isScanning}
                      min="0" max="100" step="1"
                      placeholder="Max"
                      className="w-1/2 px-2 py-1 bg-slate-700/50 border border-purple-500/20 rounded text-white text-xs"
                    />
                  </div>
                )}
              </div>

              {/* EMA Distance Filter */}
              <div className={`p-3 rounded-lg border ${emaDistanceEnabled ? 'bg-purple-500/10 border-purple-500/40' : 'bg-slate-700/30 border-slate-600/30'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={emaDistanceEnabled}
                    onChange={(e) => setEmaDistanceEnabled(e.target.checked)}
                    disabled={isScanning}
                    className="w-4 h-4 accent-purple-500"
                  />
                  <span className="text-sm font-medium text-white">Price vs EMA</span>
                </label>
                {emaDistanceEnabled && (
                  <div className="space-y-2 mt-2">
                    <select
                      value={emaDistanceType}
                      onChange={(e) => setEmaDistanceType(e.target.value as 'ema20' | 'ema50')}
                      disabled={isScanning}
                      className="w-full px-2 py-1 bg-slate-700/50 border border-purple-500/20 rounded text-white text-xs"
                    >
                      <option value="ema20">EMA 20</option>
                      <option value="ema50">EMA 50</option>
                    </select>
                    <div className="flex gap-2 items-center">
                      <select
                        value={priceAboveEma ? 'above' : 'below'}
                        onChange={(e) => setPriceAboveEma(e.target.value === 'above')}
                        disabled={isScanning}
                        className="w-1/2 px-2 py-1 bg-slate-700/50 border border-purple-500/20 rounded text-white text-xs"
                      >
                        <option value="above">Above</option>
                        <option value="below">Below</option>
                      </select>
                      <input
                        type="number"
                        value={maxEmaDistance}
                        onChange={(e) => setMaxEmaDistance(Number(e.target.value))}
                        disabled={isScanning}
                        min="0" max="50" step="1"
                        placeholder="Max %"
                        className="w-1/2 px-2 py-1 bg-slate-700/50 border border-purple-500/20 rounded text-white text-xs"
                      />
                    </div>
                    <p className="text-xs text-purple-300">Max {maxEmaDistance}% {priceAboveEma ? 'above' : 'below'}</p>
                  </div>
                )}
              </div>

              {/* Volume Filter */}
              <div className={`p-3 rounded-lg border ${volumeFilterEnabled ? 'bg-purple-500/10 border-purple-500/40' : 'bg-slate-700/30 border-slate-600/30'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={volumeFilterEnabled}
                    onChange={(e) => setVolumeFilterEnabled(e.target.checked)}
                    disabled={isScanning}
                    className="w-4 h-4 accent-purple-500"
                  />
                  <span className="text-sm font-medium text-white">Relative Volume</span>
                </label>
                {volumeFilterEnabled && (
                  <div className="mt-2">
                    <input
                      type="number"
                      value={minRelativeVolume}
                      onChange={(e) => setMinRelativeVolume(Number(e.target.value))}
                      disabled={isScanning}
                      min="0.5" max="10" step="0.1"
                      className="w-full px-2 py-1 bg-slate-700/50 border border-purple-500/20 rounded text-white text-xs"
                    />
                    <p className="text-xs text-purple-300 mt-1">Min {minRelativeVolume}× avg volume</p>
                  </div>
                )}
              </div>

              {/* MACD Filter */}
              <div className={`p-3 rounded-lg border ${macdFilterEnabled ? 'bg-purple-500/10 border-purple-500/40' : 'bg-slate-700/30 border-slate-600/30'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={macdFilterEnabled}
                    onChange={(e) => setMacdFilterEnabled(e.target.checked)}
                    disabled={isScanning}
                    className="w-4 h-4 accent-purple-500"
                  />
                  <span className="text-sm font-medium text-white">MACD</span>
                </label>
                {macdFilterEnabled && (
                  <label className="flex items-center gap-2 text-xs text-purple-200 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={requireMacdAboveZero}
                      onChange={(e) => setRequireMacdAboveZero(e.target.checked)}
                      disabled={isScanning}
                      className="w-3 h-3 accent-purple-500"
                    />
                    MACD Line &gt; 0
                  </label>
                )}
              </div>

              {/* CMF Filter */}
              <div className={`p-3 rounded-lg border ${cmfFilterEnabled ? 'bg-purple-500/10 border-purple-500/40' : 'bg-slate-700/30 border-slate-600/30'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={cmfFilterEnabled}
                    onChange={(e) => setCmfFilterEnabled(e.target.checked)}
                    disabled={isScanning}
                    className="w-4 h-4 accent-purple-500"
                  />
                  <span className="text-sm font-medium text-white">CMF (Money Flow)</span>
                </label>
                {cmfFilterEnabled && (
                  <div className="mt-2">
                    <input
                      type="number"
                      value={minCmf}
                      onChange={(e) => setMinCmf(Number(e.target.value))}
                      disabled={isScanning}
                      min="-1" max="1" step="0.05"
                      className="w-full px-2 py-1 bg-slate-700/50 border border-purple-500/20 rounded text-white text-xs"
                    />
                    <p className="text-xs text-purple-300 mt-1">Min CMF: {minCmf} {minCmf >= 0 ? '(accumulation)' : '(exclude heavy distribution)'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Active Filters Summary */}
            {(adxFilterEnabled || rsiFilterEnabled || emaDistanceEnabled || volumeFilterEnabled || macdFilterEnabled || cmfFilterEnabled) && (
              <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="text-xs text-purple-200 flex flex-wrap gap-2">
                  <span className="font-semibold">Active Filters:</span>
                  {adxFilterEnabled && <span className="px-2 py-0.5 bg-purple-600/30 rounded">ADX {minAdx}-{maxAdx}</span>}
                  {rsiFilterEnabled && <span className="px-2 py-0.5 bg-purple-600/30 rounded">RSI {minRsi}-{maxRsi}</span>}
                  {emaDistanceEnabled && <span className="px-2 py-0.5 bg-purple-600/30 rounded">{priceAboveEma ? 'Above' : 'Below'} {emaDistanceType.toUpperCase()} ≤{maxEmaDistance}%</span>}
                  {volumeFilterEnabled && <span className="px-2 py-0.5 bg-purple-600/30 rounded">Vol ≥{minRelativeVolume}×</span>}
                  {macdFilterEnabled && <span className="px-2 py-0.5 bg-purple-600/30 rounded">MACD {requireMacdAboveZero ? '> 0' : 'any'}</span>}
                  {cmfFilterEnabled && <span className="px-2 py-0.5 bg-purple-600/30 rounded">CMF ≥{minCmf}</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Bar */}
        {isScanning && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-blue-200 text-sm font-medium">{scanProgress}</span>
              <span className="text-blue-300 text-sm font-bold">{scanPercent}%</span>
            </div>
            <div className="w-full bg-slate-700/50 rounded-full h-3 mb-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                style={{ width: `${scanPercent}%` }}
              >
                {scanPercent > 10 && (
                  <span className="text-white text-xs font-bold drop-shadow-lg">
                    {scanPercent}%
                  </span>
                )}
              </div>
            </div>
            {cacheStats && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-blue-300">
                  💾 Cache: {cacheStats.hits} hits
                </span>
                <span className="text-blue-300">
                  🌐 API Calls: {cacheStats.calls}
                </span>
              </div>
            )}
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
                <span className="mx-3 text-blue-500">|</span>
                <span className="text-lg font-semibold text-blue-400">{sortedResults.length}</span>
                <span className="text-blue-200 ml-2">shown</span>
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
            
            {/* Filtering and Sorting Controls */}
            <div className="mb-6 bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Sort By */}
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="matchScore">Match Score</option>
                    <option value="rsi">RSI</option>
                    <option value="atr">ATR %</option>
                    <option value="price">Price</option>
                    <option value="volume">Volume</option>
                    <option value="changePercent">Change %</option>
                  </select>
                </div>
                
                {/* Sort Order */}
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Order</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="desc">High to Low</option>
                    <option value="asc">Low to High</option>
                  </select>
                </div>
                
                {/* RSI Range */}
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">RSI Range</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={filterRsiMin}
                      onChange={(e) => setFilterRsiMin(Number(e.target.value))}
                      placeholder="Min"
                      min="0"
                      max="100"
                      className="w-full px-2 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <span className="text-blue-300">-</span>
                    <input
                      type="number"
                      value={filterRsiMax}
                      onChange={(e) => setFilterRsiMax(Number(e.target.value))}
                      placeholder="Max"
                      min="0"
                      max="100"
                      className="w-full px-2 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
                
                {/* ATR % Range */}
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">ATR % Range</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={filterAtrMin}
                      onChange={(e) => setFilterAtrMin(Number(e.target.value))}
                      placeholder="Min"
                      min="0"
                      step="0.1"
                      className="w-full px-2 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <span className="text-blue-300">-</span>
                    <input
                      type="number"
                      value={filterAtrMax}
                      onChange={(e) => setFilterAtrMax(Number(e.target.value))}
                      placeholder="Max"
                      min="0"
                      step="0.1"
                      className="w-full px-2 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
                
                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Price Range</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={filterPriceMin}
                      onChange={(e) => setFilterPriceMin(Number(e.target.value))}
                      placeholder="Min"
                      min="0"
                      step="1"
                      className="w-full px-2 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <span className="text-blue-300">-</span>
                    <input
                      type="number"
                      value={filterPriceMax}
                      onChange={(e) => setFilterPriceMax(Number(e.target.value))}
                      placeholder="Max"
                      min="0"
                      step="1"
                      className="w-full px-2 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>
              
              {/* Reset Filters Button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setFilterRsiMin(0);
                    setFilterRsiMax(100);
                    setFilterAtrMin(0);
                    setFilterAtrMax(100);
                    setFilterPriceMin(0);
                    setFilterPriceMax(999999);
                    setSortBy('matchScore');
                    setSortOrder('desc');
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
                >
                  Reset Filters
                </button>
              </div>
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
            {scanCompleted ? (
              <>
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  No Matches Found
                </h3>
                <p className="text-blue-200 mb-4">
                  The scan completed but didn't find any stocks matching your strategy criteria
                </p>
                <div className="max-w-2xl mx-auto bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 text-left">
                  <h4 className="text-lg font-semibold text-white mb-3">💡 Tips to Find Matches:</h4>
                  <ul className="space-y-2 text-sm text-blue-200">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      <span><strong>Try a different strategy</strong> - Some strategies work better in different market conditions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      <span><strong>Adjust filters</strong> - Lower minimum ATR, volume, or dollar volume requirements</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      <span><strong>Broaden eligibility</strong> - Edit your strategy to be less restrictive (fewer EMAs, wider RSI range)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      <span><strong>Check market regime</strong> - Bullish strategies work best in uptrends; bearish strategies in downtrends</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      <span><strong>Use Overview Mode</strong> - Select "Overview Mode" to see all qualified stocks without strategy matching</span>
                    </li>
                  </ul>
                </div>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Ready to Scan
                </h3>
                <p className="text-blue-200">
                  Select a strategy and click "Start Scan" to find matching stocks
                </p>
              </>
            )}
          </div>
        )}
      </main>
  );
}

// Result Card Component
function ResultCard({ result }: { result: ScanResult }) {
  const handleStrategyAnalyze = () => {
    // Open strategy analysis in new tab to keep scanner results visible
    window.open(`/strategy-analyze?symbol=${result.ticker}`, '_blank');
  };

  const handleTechnicalAnalyze = () => {
    // Open technical analysis in new tab to keep scanner results visible
    window.open(`/technical-analysis?symbol=${result.ticker}`, '_blank');
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
            <div className="text-white font-semibold">{result.indicators.volZ?.toFixed(2) || result.indicators.relativeVolume?.toFixed(2) || 'N/A'}</div>
          </div>
          <div className="bg-slate-700/50 rounded p-2">
            <div className="text-blue-300">ATR%</div>
            <div className="text-white font-semibold">{result.indicators.atrPct.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* Additional Screener Indicators */}
      {result.indicators && (result.indicators.adx || result.indicators.ema20Distance !== undefined) && (
        <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
          {result.indicators.adx !== undefined && (
            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-blue-300">ADX</div>
              <div className="text-white font-semibold">{result.indicators.adx.toFixed(1)}</div>
            </div>
          )}
          {result.indicators.ema20Distance !== undefined && (
            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-blue-300">EMA20 Dist</div>
              <div className={`font-semibold ${result.indicators.ema20Distance > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {result.indicators.ema20Distance > 0 ? '+' : ''}{result.indicators.ema20Distance.toFixed(1)}%
              </div>
            </div>
          )}
          {result.indicators.cmf !== undefined && (
            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-blue-300">CMF</div>
              <div className={`font-semibold ${result.indicators.cmf > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {result.indicators.cmf.toFixed(3)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter Results (Screener Mode) */}
      {result.filterResults && result.filterResults.length > 0 && (
        <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="text-xs font-semibold text-purple-200 mb-2">Filter Results:</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {result.filterResults.slice(0, 5).map((filter, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className={filter.passed ? 'text-green-400' : 'text-red-400'}>
                  {filter.passed ? '✓' : '✗'}
                </span>
                <span className="text-blue-200">{filter.name}:</span>
                <span className="text-white font-medium">{String(filter.value)}</span>
                {filter.threshold && (
                  <span className="text-blue-300 text-xs">({filter.threshold})</span>
                )}
              </div>
            ))}
            {result.filterResults.length > 5 && (
              <div className="text-xs text-blue-300 italic">
                +{result.filterResults.length - 5} more filters...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Squeeze Analysis (if available) */}
      {result.squeeze && result.squeeze.combinedScore > 0 && (
        <div className="mb-4 p-3 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-purple-200">
                🔥 Squeeze: {result.squeeze.combinedScore}/100
              </span>
              {result.squeeze.alignment && (
                <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded-full border border-yellow-500/30">
                  ⚡ Aligned
                </span>
              )}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              result.squeeze.combinedPotential === 'extreme' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
              result.squeeze.combinedPotential === 'high' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
              result.squeeze.combinedPotential === 'moderate' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
              'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}>
              {result.squeeze.combinedPotential.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-blue-300">Short Float: </span>
              <span className="text-white font-semibold">
                {result.squeeze.shortFloat !== null ? `${result.squeeze.shortFloat.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-blue-300">TTM: </span>
              <span className={`font-semibold ${
                result.squeeze.ttmState === 'FIRE' ? 'text-red-400' :
                result.squeeze.ttmState === 'ON' ? 'text-yellow-400' :
                'text-gray-400'
              }`}>
                {result.squeeze.ttmState === 'FIRE' ? '🔥 FIRE' :
                 result.squeeze.ttmState === 'ON' ? `⚡ ON (${result.squeeze.ttmDuration}bars)` :
                 '⚪ OFF'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Match Details */}
      {result.matchDetails.eligible ? (
        <div className="mb-4">
          <div className="text-sm font-semibold text-green-300 mb-2">
            ✓ Qualifies for Strategy
          </div>
          {result.matchedStrategy && (
            <div className="text-xs text-blue-300 mb-2 flex items-center gap-1">
              <span className="opacity-75">Matched:</span>
              <span className="font-semibold">{result.matchedStrategy}</span>
              {result.matchedStrategyId && (
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">
                  Custom
                </span>
              )}
            </div>
          )}
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

      {/* Analysis Buttons */}
      <div className="space-y-2">
        {result.matchedStrategy && (
          <div className="text-xs text-blue-300/70 mb-2 italic">
            ℹ️ Re-evaluates with fresh data - results may differ
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleStrategyAnalyze}
            className="py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>Strategy</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          <button
            onClick={handleTechnicalAnalyze}
            className="py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>Technical</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

