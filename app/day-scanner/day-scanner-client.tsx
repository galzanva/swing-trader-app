'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface NewsItem {
  title: string;
  url: string;
  source: string;
  published: string;
  sentiment: string | null;
}

interface ScanResult {
  ticker: string;
  name: string;
  industry: string;
  price: number;
  open: number;
  high: number;
  low: number;
  vwap: number;
  change: number;
  changePercent: number;
  volume: number;
  relativeVolume: number;
  floatShares: number | null;
  sharesOutstanding: number | null;
  marketCap: number | null;
  heatScore: number;
  shortFloat: number | null;
  shortInterest: number | null;
  daysToCover: number | null;
  shortVolRatio: number | null;
  squeezePotential: 'extreme' | 'high' | 'moderate' | 'low' | 'none';
  news: NewsItem[];
  freshNewsCount: number;
  hasBreakingNews: boolean;
  earningsToday: boolean;
  earningsTime: string | null;
  catalystTypes: string[];
  hasCatalyst: boolean;
}

const DEFAULT_CRITERIA = {
  minChangePercent: 8,
  maxChangePercent: 999,
  minRelativeVolume: 3,
  minFloat: 0,
  maxFloat: 50,
  minPrice: 1,
  maxPrice: 100,
  minVolume: 300000,
  requireNews: false,
};

const PRESETS = [
  {
    id: 'catalyst-gainer',
    name: 'Catalyst Gainer',
    icon: '🔥',
    desc: '20%+ move, 5x+ vol, <30M float, news/earnings required',
    criteria: { ...DEFAULT_CRITERIA, minChangePercent: 20, maxChangePercent: 999, minRelativeVolume: 5, minFloat: 0, maxFloat: 30, minPrice: 2, maxPrice: 200, minVolume: 1000000, requireNews: true },
  },
  {
    id: 'lowfloat-runner',
    name: 'Low Float Runner',
    icon: '🚀',
    desc: 'Float <15M, 10%+ move, 5x+ vol',
    criteria: { ...DEFAULT_CRITERIA, minChangePercent: 10, minRelativeVolume: 5, maxFloat: 15, minPrice: 2, maxPrice: 30 },
  },
  {
    id: 'momentum-gapper',
    name: 'Momentum Gapper',
    icon: '⚡',
    desc: '8%+ gap up, 3x+ vol, any float',
    criteria: { ...DEFAULT_CRITERIA, minChangePercent: 8, minRelativeVolume: 3, maxFloat: 999, minPrice: 3, maxPrice: 100 },
  },
  {
    id: 'penny-exploder',
    name: 'Penny Exploder',
    icon: '💥',
    desc: '$1-$10, 15%+ move, huge vol',
    criteria: { ...DEFAULT_CRITERIA, minChangePercent: 15, minRelativeVolume: 5, maxFloat: 30, minPrice: 1, maxPrice: 10 },
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    desc: 'Set your own filters',
    criteria: DEFAULT_CRITERIA,
  },
];

type SortField = 'heatScore' | 'changePercent' | 'relativeVolume' | 'volume' | 'price' | 'floatShares' | 'shortFloat';

export default function DayScannerClient() {
  const { status } = useSession();
  const router = useRouter();

  const [selectedPreset, setSelectedPreset] = useState('catalyst-gainer');
  const [criteria, setCriteria] = useState(PRESETS[0].criteria);
  const [showFilters, setShowFilters] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [error, setError] = useState('');
  const [scanComplete, setScanComplete] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortField>('heatScore');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const runScan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    setError('');
    setResults([]);
    setScanComplete(false);
    setProgress('Starting scan...');
    setProgressPercent(0);
    setExpandedTicker(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/day-scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error('Scanner request failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      const found: ScanResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === 'progress') {
              setProgress(msg.data.step);
              setProgressPercent(msg.data.percent);
            } else if (msg.type === 'found') {
              found.push(msg.data);
              setResults([...found]);
            } else if (msg.type === 'complete') {
              setProgress(`Found ${found.length} stocks matching criteria`);
              setProgressPercent(100);
              setScanComplete(true);
              setLastScanTime(new Date().toLocaleTimeString());
            } else if (msg.type === 'error') {
              throw new Error(msg.data.error);
            }
          } catch (e: any) {
            if (e.message?.includes('Scanner')) throw e;
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Scan failed');
      }
    } finally {
      setIsScanning(false);
      abortRef.current = null;
    }
  }, [criteria, isScanning]);

  // Auto-refresh logic
  useEffect(() => {
    autoRefreshRef.current = autoRefresh;
  }, [autoRefresh]);

  useEffect(() => {
    if (autoRefresh && !isScanning) {
      intervalRef.current = setInterval(() => {
        if (autoRefreshRef.current) {
          runScan();
        }
      }, 60_000); // every 60 seconds
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, isScanning, runScan]);

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setSelectedPreset(presetId);
    setCriteria({ ...preset.criteria });
    if (presetId === 'custom') setShowFilters(true);
  };

  const stopScan = () => {
    abortRef.current?.abort();
    setIsScanning(false);
  };

  // Sorted results
  const sortedResults = [...results].sort((a, b) => {
    let aVal = 0, bVal = 0;
    switch (sortBy) {
      case 'heatScore': aVal = a.heatScore; bVal = b.heatScore; break;
      case 'changePercent': aVal = a.changePercent; bVal = b.changePercent; break;
      case 'relativeVolume': aVal = a.relativeVolume; bVal = b.relativeVolume; break;
      case 'volume': aVal = a.volume; bVal = b.volume; break;
      case 'price': aVal = a.price; bVal = b.price; break;
      case 'floatShares': aVal = a.floatShares ?? 9999; bVal = b.floatShares ?? 9999; break;
      case 'shortFloat': aVal = a.shortFloat ?? 0; bVal = b.shortFloat ?? 0; break;
    }
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  if (status === 'loading') {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-white text-xl">Loading...</div>
      </main>
    );
  }
  if (status === 'unauthenticated') { router.push('/login'); return null; }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
              <span className="text-4xl">🔴</span>
              Day Trading Scanner
            </h1>
            <p className="text-blue-200 mt-1">
              Live scan for high-momentum, low-float stocks with unusual volume & catalysts
            </p>
          </div>
          {lastScanTime && (
            <div className="text-sm text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
              Last scan: {lastScanTime}
            </div>
          )}
        </div>
      </div>

      {/* Presets */}
      <div className="bg-slate-800/50 backdrop-blur border border-orange-500/30 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-orange-200">Scan Preset</label>
          <label className="flex items-center gap-2 text-sm text-blue-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 accent-orange-500 rounded"
            />
            Auto-refresh (60s)
          </label>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              disabled={isScanning}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedPreset === p.id
                  ? 'bg-orange-600 text-white ring-2 ring-orange-400 shadow-lg shadow-orange-500/20'
                  : 'bg-slate-700/50 text-orange-200 hover:bg-slate-700 border border-orange-500/20'
              }`}
              title={p.desc}
            >
              {p.icon} {p.name}
            </button>
          ))}
        </div>
        {selectedPreset !== 'custom' && (
          <p className="text-xs text-orange-300 mb-3">
            {PRESETS.find(p => p.id === selectedPreset)?.desc}
          </p>
        )}

        {/* Custom Filters Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-orange-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-2 mb-3"
        >
          <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>

        {/* Filter Controls */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-3 border-t border-orange-500/20">
            <FilterInput label="Min % Change" value={criteria.minChangePercent} onChange={v => setCriteria(c => ({ ...c, minChangePercent: v }))} step={1} min={0} />
            <FilterInput label="Max % Change" value={criteria.maxChangePercent} onChange={v => setCriteria(c => ({ ...c, maxChangePercent: v }))} step={10} min={0} />
            <FilterInput label="Min Rel Volume (x)" value={criteria.minRelativeVolume} onChange={v => setCriteria(c => ({ ...c, minRelativeVolume: v }))} step={0.5} min={1} />
            <FilterInput label="Min Float (M)" value={criteria.minFloat} onChange={v => setCriteria(c => ({ ...c, minFloat: v }))} step={1} min={0} />
            <FilterInput label="Max Float (M)" value={criteria.maxFloat} onChange={v => setCriteria(c => ({ ...c, maxFloat: v }))} step={5} min={1} />
            <FilterInput label="Min Price ($)" value={criteria.minPrice} onChange={v => setCriteria(c => ({ ...c, minPrice: v }))} step={0.5} min={0} />
            <FilterInput label="Max Price ($)" value={criteria.maxPrice} onChange={v => setCriteria(c => ({ ...c, maxPrice: v }))} step={5} min={1} />
            <FilterInput label="Min Volume" value={criteria.minVolume} onChange={v => setCriteria(c => ({ ...c, minVolume: v }))} step={100000} min={0} />
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-orange-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={criteria.requireNews}
                  onChange={e => setCriteria(c => ({ ...c, requireNews: e.target.checked }))}
                  className="w-4 h-4 accent-orange-500"
                />
                News required
              </label>
            </div>
          </div>
        )}

        {/* Scan Button */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={runScan}
            disabled={isScanning}
            className="flex-1 sm:flex-none px-8 py-3 font-bold rounded-lg disabled:opacity-50 transition-all bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/25"
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
              '🔴 Scan Now'
            )}
          </button>
          {isScanning && (
            <button
              onClick={stopScan}
              className="px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
            >
              Stop
            </button>
          )}
        </div>

        {/* Progress */}
        {(isScanning || (scanComplete && progressPercent === 100)) && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-orange-200">{progress}</span>
              <span className="text-orange-300 font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-700/50 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-orange-500 to-red-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <>
          {/* Summary Bar */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-4 text-white">
              <span>
                <span className="text-2xl font-bold text-orange-400">{results.length}</span>
                <span className="text-blue-200 ml-1">stocks found</span>
              </span>
              {results.filter(r => r.hasCatalyst).length > 0 && (
                <span className="text-sm text-green-300 bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                  ⚡ {results.filter(r => r.hasCatalyst).length} with catalysts
                </span>
              )}
              {results.filter(r => r.earningsToday).length > 0 && (
                <span className="text-sm text-yellow-300 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20">
                  📅 {results.filter(r => r.earningsToday).length} earnings today
                </span>
              )}
              {results.filter(r => r.squeezePotential === 'extreme' || r.squeezePotential === 'high').length > 0 && (
                <span className="text-sm text-red-300 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                  🩳 {results.filter(r => r.squeezePotential === 'extreme' || r.squeezePotential === 'high').length} squeeze potential
                </span>
              )}
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-blue-300">Sort:</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortField)}
                className="px-2 py-1.5 bg-slate-700 text-white rounded border border-slate-600 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="heatScore">Heat Score</option>
                <option value="changePercent">% Change</option>
                <option value="relativeVolume">Rel Volume</option>
                <option value="volume">Volume</option>
                <option value="floatShares">Float</option>
                <option value="shortFloat">Short Float %</option>
                <option value="price">Price</option>
              </select>
              <button
                onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                className="p-1.5 bg-slate-700 text-white rounded border border-slate-600 text-sm hover:bg-slate-600"
                title={sortOrder === 'desc' ? 'High to Low' : 'Low to High'}
              >
                {sortOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-slate-800/50 backdrop-blur border border-blue-500/20 rounded-xl overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-900/50">
                    <th className="text-left px-4 py-3 text-blue-300 font-semibold">Ticker</th>
                    <th className="text-right px-3 py-3 text-blue-300 font-semibold">Price</th>
                    <th className="text-right px-3 py-3 text-blue-300 font-semibold">Change</th>
                    <th className="text-right px-3 py-3 text-blue-300 font-semibold">Rel Vol</th>
                    <th className="text-right px-3 py-3 text-blue-300 font-semibold">Volume</th>
                    <th className="text-right px-3 py-3 text-blue-300 font-semibold">Float</th>
                    <th className="text-center px-3 py-3 text-blue-300 font-semibold">Short / Squeeze</th>
                    <th className="text-center px-3 py-3 text-blue-300 font-semibold">Heat</th>
                    <th className="text-center px-3 py-3 text-blue-300 font-semibold">Catalyst</th>
                    <th className="text-center px-3 py-3 text-blue-300 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((r, idx) => (
                    <ResultRow
                      key={r.ticker}
                      result={r}
                      rank={idx + 1}
                      expanded={expandedTicker === r.ticker}
                      onToggle={() => setExpandedTicker(expandedTicker === r.ticker ? null : r.ticker)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3 p-4">
              {sortedResults.map((r, idx) => (
                <MobileCard key={r.ticker} result={r} rank={idx + 1} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!isScanning && results.length === 0 && !error && (
        <div className="text-center py-20">
          {scanComplete ? (
            <>
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold text-white mb-2">No Matches Found</h3>
              <p className="text-blue-200 max-w-md mx-auto">
                No stocks matched your criteria. Try loosening filters (lower min % change, lower min rel volume) or scan during market hours.
              </p>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">🔴</div>
              <h3 className="text-2xl font-bold text-white mb-2">Ready to Scan</h3>
              <p className="text-blue-200 max-w-md mx-auto">
                Select a preset and click "Scan Now" to find high-momentum stocks for day trading. Best results during market hours (9:30 AM - 4:00 PM ET).
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
}

/* ─── Sub Components ─── */

function FilterInput({ label, value, onChange, step, min }: {
  label: string; value: number; onChange: (v: number) => void; step: number; min: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-orange-300 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        step={step}
        min={min}
        className="w-full px-3 py-2 bg-slate-700/50 border border-orange-500/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
    </div>
  );
}

function HeatBadge({ score }: { score: number }) {
  const bg = score >= 70 ? 'bg-red-500/20 text-red-300 border-red-500/40'
    : score >= 50 ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
    : score >= 30 ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
    : 'bg-slate-600/30 text-slate-300 border-slate-500/30';

  const label = score >= 70 ? '🔥' : score >= 50 ? '⚡' : score >= 30 ? '📈' : '📊';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${bg}`}>
      {label} {score}
    </span>
  );
}

function ShortSqueezeBadge({ shortFloat, daysToCover, squeezePotential }: {
  shortFloat: number | null;
  daysToCover: number | null;
  squeezePotential: string;
}) {
  if (shortFloat === null || shortFloat === 0) {
    return <span className="text-slate-500 text-xs">—</span>;
  }

  const sfColor = shortFloat >= 25 ? 'text-red-400' : shortFloat >= 15 ? 'text-orange-400' : shortFloat >= 8 ? 'text-yellow-400' : 'text-blue-300';

  const squeezeBg =
    squeezePotential === 'extreme' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
    squeezePotential === 'high' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
    squeezePotential === 'moderate' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
    '';

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-xs font-bold ${sfColor}`}>
        {shortFloat.toFixed(1)}% SI
      </span>
      {daysToCover !== null && daysToCover > 0 && (
        <span className="text-xs text-blue-300">{daysToCover.toFixed(1)}d cover</span>
      )}
      {(squeezePotential === 'extreme' || squeezePotential === 'high' || squeezePotential === 'moderate') && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full border font-bold ${squeezeBg}`}>
          {squeezePotential === 'extreme' ? '🔥 Squeeze' : squeezePotential === 'high' ? '⚠️ Squeeze' : '🩳 Short'}
        </span>
      )}
    </div>
  );
}

function formatVolume(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

function formatFloat(f: number | null): string {
  if (f === null) return '—';
  if (f >= 1000) return `${(f / 1000).toFixed(1)}B`;
  return `${f.toFixed(1)}M`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ResultRow({ result: r, rank, expanded, onToggle }: {
  result: ScanResult; rank: number; expanded: boolean; onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 ${
          expanded ? 'bg-orange-500/5' : ''
        }`}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-4">{rank}</span>
            <div>
              <span className="font-bold text-white text-base">{r.ticker}</span>
              {r.earningsToday && <span className="ml-1.5 text-xs" title={`Earnings today ${r.earningsTime === 'bmo' ? '(before open)' : r.earningsTime === 'amc' ? '(after close)' : ''}`}>📅</span>}
              {r.hasBreakingNews && <span className="ml-1 text-xs" title="Breaking news catalyst">📰</span>}
              {(r.squeezePotential === 'extreme' || r.squeezePotential === 'high') && <span className="ml-1 text-xs" title={`Short squeeze ${r.squeezePotential} — ${r.shortFloat?.toFixed(0)}% SI`}>🩳</span>}
              <div className="text-xs text-blue-300 truncate max-w-[180px]">{r.name}</div>
            </div>
          </div>
        </td>
        <td className="text-right px-3 py-3 text-white font-mono font-semibold">${r.price.toFixed(2)}</td>
        <td className={`text-right px-3 py-3 font-bold ${r.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {r.changePercent >= 0 ? '+' : ''}{r.changePercent.toFixed(1)}%
        </td>
        <td className="text-right px-3 py-3">
          <span className={`font-semibold ${
            r.relativeVolume >= 10 ? 'text-red-400' :
            r.relativeVolume >= 5 ? 'text-orange-400' :
            r.relativeVolume >= 3 ? 'text-yellow-400' : 'text-blue-300'
          }`}>
            {r.relativeVolume.toFixed(1)}x
          </span>
        </td>
        <td className="text-right px-3 py-3 text-blue-200 font-mono">{formatVolume(r.volume)}</td>
        <td className="text-right px-3 py-3 text-blue-200">{formatFloat(r.floatShares)}</td>
        <td className="text-center px-3 py-3">
          <ShortSqueezeBadge
            shortFloat={r.shortFloat}
            daysToCover={r.daysToCover}
            squeezePotential={r.squeezePotential}
          />
        </td>
        <td className="text-center px-3 py-3"><HeatBadge score={r.heatScore} /></td>
        <td className="text-center px-3 py-3">
          {r.catalystTypes.length > 0 ? (
            <div className="flex flex-col items-center gap-0.5">
              {r.earningsToday && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 whitespace-nowrap">
                  📅 {r.earningsTime === 'bmo' ? 'ER BMO' : r.earningsTime === 'amc' ? 'ER AMC' : 'Earnings'}
                </span>
              )}
              {r.hasBreakingNews && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30 whitespace-nowrap">
                  📰 News ({r.freshNewsCount})
                </span>
              )}
              {(r.squeezePotential === 'extreme' || r.squeezePotential === 'high') && (
                <span className={`text-xs px-1.5 py-0.5 rounded border whitespace-nowrap ${
                  r.squeezePotential === 'extreme'
                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                    : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                }`}>
                  🩳 Squeeze
                </span>
              )}
            </div>
          ) : r.freshNewsCount > 0 ? (
            <span className="text-xs text-blue-300">{r.freshNewsCount} news</span>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </td>
        <td className="text-center px-3 py-3">
          <button
            onClick={e => { e.stopPropagation(); window.open(`/technical-analysis?symbol=${r.ticker}`, '_blank'); }}
            className="px-2 py-1 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded transition-colors"
          >
            Analyze
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} className="px-4 py-4 bg-slate-900/50">
            <ExpandedDetails result={r} />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedDetails({ result: r }: { result: ScanResult }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Price & Volume Detail */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <span>📊</span> Price & Volume
        </h4>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Stat label="Open" value={`$${r.open.toFixed(2)}`} />
          <Stat label="High" value={`$${r.high.toFixed(2)}`} color="text-green-400" />
          <Stat label="Low" value={`$${r.low.toFixed(2)}`} color="text-red-400" />
          <Stat label="VWAP" value={r.vwap > 0 ? `$${r.vwap.toFixed(2)}` : '—'} />
          <Stat label="Mkt Cap" value={r.marketCap ? `$${formatVolume(r.marketCap * 1_000_000)}` : '—'} />
          <Stat label="Industry" value={r.industry || '—'} />
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => window.open(`/technical-analysis?symbol=${r.ticker}`, '_blank')}
            className="flex-1 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors"
          >
            Technical Analysis
          </button>
          <button
            onClick={() => window.open(`/intraday-analysis?symbol=${r.ticker}`, '_blank')}
            className="flex-1 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
          >
            Intraday Analysis
          </button>
        </div>
      </div>

      {/* Short Interest / Squeeze */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <span>🩳</span> Short Interest
          {(r.squeezePotential === 'extreme' || r.squeezePotential === 'high') && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
              r.squeezePotential === 'extreme'
                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                : 'bg-orange-500/20 text-orange-300 border-orange-500/40'
            }`}>
              {r.squeezePotential === 'extreme' ? '🔥 SQUEEZE ALERT' : '⚠️ Squeeze Risk'}
            </span>
          )}
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat
            label="Short Float %"
            value={r.shortFloat !== null ? `${r.shortFloat.toFixed(1)}%` : '—'}
            color={r.shortFloat !== null && r.shortFloat >= 20 ? 'text-red-400' : r.shortFloat !== null && r.shortFloat >= 10 ? 'text-orange-400' : undefined}
          />
          <Stat
            label="Days to Cover"
            value={r.daysToCover !== null ? r.daysToCover.toFixed(1) : '—'}
            color={r.daysToCover !== null && r.daysToCover >= 5 ? 'text-red-400' : r.daysToCover !== null && r.daysToCover >= 3 ? 'text-orange-400' : undefined}
          />
          <Stat
            label="Short Vol Ratio"
            value={r.shortVolRatio !== null ? `${r.shortVolRatio.toFixed(1)}%` : '—'}
            color={r.shortVolRatio !== null && r.shortVolRatio >= 50 ? 'text-red-400' : undefined}
          />
          <Stat
            label="Short Interest"
            value={r.shortInterest !== null ? formatVolume(r.shortInterest) : '—'}
          />
        </div>
        {r.shortFloat !== null && r.shortFloat > 0 && (
          <div className={`text-xs p-2 rounded-lg border ${
            r.squeezePotential === 'extreme' ? 'bg-red-500/10 border-red-500/30 text-red-200' :
            r.squeezePotential === 'high' ? 'bg-orange-500/10 border-orange-500/30 text-orange-200' :
            r.squeezePotential === 'moderate' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-200' :
            'bg-slate-700/30 border-slate-600/30 text-blue-200'
          }`}>
            {r.squeezePotential === 'extreme' && `${r.shortFloat.toFixed(0)}% shorted with ${r.daysToCover?.toFixed(1) ?? '?'} days to cover — shorts are trapped while this runs. Extreme squeeze fuel.`}
            {r.squeezePotential === 'high' && `High short interest (${r.shortFloat.toFixed(0)}%) — forced covering adds buying pressure on a move like this.`}
            {r.squeezePotential === 'moderate' && `Moderate short interest (${r.shortFloat.toFixed(0)}%) — some shorts may need to cover.`}
            {r.squeezePotential === 'low' && `Low short interest (${r.shortFloat.toFixed(0)}%) — limited squeeze potential.`}
            {r.squeezePotential === 'none' && 'Minimal short positioning.'}
          </div>
        )}
      </div>

      {/* Catalysts & News */}
      <div>
        <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
          <span>⚡</span> Catalysts & News
        </h4>

        {/* Catalyst Badges */}
        {(r.earningsToday || r.hasBreakingNews || r.squeezePotential === 'extreme' || r.squeezePotential === 'high') && (
          <div className="flex flex-wrap gap-2 mb-3">
            {r.earningsToday && (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 font-semibold">
                📅 {r.earningsTime === 'bmo' ? 'Earnings Before Open' : r.earningsTime === 'amc' ? 'Earnings After Close' : 'Earnings Today'}
              </span>
            )}
            {r.hasBreakingNews && (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-green-500/15 text-green-300 border border-green-500/30 font-semibold">
                📰 Breaking News
              </span>
            )}
            {(r.squeezePotential === 'extreme' || r.squeezePotential === 'high') && (
              <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold border ${
                r.squeezePotential === 'extreme'
                  ? 'bg-red-500/15 text-red-300 border-red-500/30'
                  : 'bg-orange-500/15 text-orange-300 border-orange-500/30'
              }`}>
                🩳 {r.squeezePotential === 'extreme' ? 'Short Squeeze Alert' : 'Short Squeeze Potential'} ({r.shortFloat?.toFixed(0)}% SI)
              </span>
            )}
          </div>
        )}

        {/* Fresh news articles (all <18h old) */}
        {r.news.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {r.news.map((n, i) => (
              <a
                key={i}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-2 bg-slate-800/80 rounded-lg hover:bg-slate-700/80 transition-colors border border-white/5"
              >
                <div className="flex items-start gap-2">
                  {n.sentiment === 'positive' && <span className="text-green-400 text-xs mt-0.5">▲</span>}
                  {n.sentiment === 'negative' && <span className="text-red-400 text-xs mt-0.5">▼</span>}
                  {!n.sentiment && <span className="text-blue-400 text-xs mt-0.5">•</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white line-clamp-2 leading-relaxed">{n.title}</p>
                    <p className="text-xs text-blue-400 mt-0.5">{n.source} · {timeAgo(n.published)}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : !r.earningsToday ? (
          <p className="text-xs text-slate-400 italic">No fresh news (last 18h)</p>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-slate-800/50 rounded p-2">
      <div className="text-blue-400 text-xs">{label}</div>
      <div className={`font-semibold text-sm truncate ${color || 'text-white'}`}>{value}</div>
    </div>
  );
}

function MobileCard({ result: r, rank }: { result: ScanResult; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`bg-slate-800/80 rounded-xl border p-4 transition-all ${
        r.heatScore >= 70 ? 'border-red-500/30' :
        r.heatScore >= 50 ? 'border-orange-500/30' : 'border-blue-500/20'
      }`}
    >
      <div className="flex items-start justify-between mb-2" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">#{rank}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-lg">{r.ticker}</span>
              <HeatBadge score={r.heatScore} />
              {r.earningsToday && <span title="Earnings today">📅</span>}
              {r.hasBreakingNews && <span title="Breaking news">📰</span>}
            </div>
            <p className="text-xs text-blue-300 truncate max-w-[200px]">{r.name}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-white font-bold">${r.price.toFixed(2)}</div>
          <div className={`text-sm font-bold ${r.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {r.changePercent >= 0 ? '+' : ''}{r.changePercent.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs mb-2">
        <div className="bg-slate-700/50 rounded p-1.5 text-center">
          <div className="text-blue-400">Rel Vol</div>
          <div className={`font-bold ${r.relativeVolume >= 5 ? 'text-orange-400' : 'text-white'}`}>
            {r.relativeVolume.toFixed(1)}x
          </div>
        </div>
        <div className="bg-slate-700/50 rounded p-1.5 text-center">
          <div className="text-blue-400">Volume</div>
          <div className="text-white font-bold">{formatVolume(r.volume)}</div>
        </div>
        <div className="bg-slate-700/50 rounded p-1.5 text-center">
          <div className="text-blue-400">Float</div>
          <div className="text-white font-bold">{formatFloat(r.floatShares)}</div>
        </div>
        <div className="bg-slate-700/50 rounded p-1.5 text-center">
          <div className="text-blue-400">SI%</div>
          <div className={`font-bold ${
            r.shortFloat !== null && r.shortFloat >= 20 ? 'text-red-400' :
            r.shortFloat !== null && r.shortFloat >= 10 ? 'text-orange-400' : 'text-white'
          }`}>
            {r.shortFloat !== null ? `${r.shortFloat.toFixed(0)}%` : '—'}
          </div>
        </div>
      </div>
      {(r.squeezePotential === 'extreme' || r.squeezePotential === 'high') && (
        <div className={`text-xs px-2 py-1 rounded-lg border mb-2 text-center font-bold ${
          r.squeezePotential === 'extreme'
            ? 'bg-red-500/15 border-red-500/30 text-red-300'
            : 'bg-orange-500/15 border-orange-500/30 text-orange-300'
        }`}>
          {r.squeezePotential === 'extreme' ? '🔥 Short Squeeze Alert' : '⚠️ Short Squeeze Potential'} — {r.shortFloat?.toFixed(0)}% SI, {r.daysToCover?.toFixed(1) ?? '?'}d to cover
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <ExpandedDetails result={r} />
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <button
          onClick={() => window.open(`/technical-analysis?symbol=${r.ticker}`, '_blank')}
          className="flex-1 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors"
        >
          Technical Analysis
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      </div>
    </div>
  );
}
