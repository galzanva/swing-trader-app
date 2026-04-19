'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';

// ── Types ──

interface ScanResult {
  ticker: string;
  name: string;
  industry: string;
  price: number;
  open: number;
  high: number;
  low: number;
  vwap: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number;
  relativeVolume: number;
  floatShares: number | null;
  sharesOutstanding: number | null;
  source: 'alpaca';
  lastUpdate: string;
  minuteBar: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap: number;
    timestamp: string;
  } | null;
}

interface LiveBar {
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  timestamp: string;
  tradeCount: number;
}

interface LiveTrade {
  ticker: string;
  price: number;
  size: number;
  timestamp: string;
  exchange: string;
}

interface ProgressState {
  step: string;
  percent: number;
}

interface Criteria {
  minChangePercent: number;
  maxChangePercent: number;
  minRelativeVolume: number;
  minFloat: number;
  maxFloat: number;
  minPrice: number;
  maxPrice: number;
  minVolume: number;
}

const PRESETS: { label: string; criteria: Criteria }[] = [
  {
    label: 'Catalyst Gainer',
    criteria: {
      minChangePercent: 20,
      maxChangePercent: 999,
      minRelativeVolume: 5,
      minFloat: 0,
      maxFloat: 30,
      minPrice: 2,
      maxPrice: 200,
      minVolume: 1000000,
    },
  },
  {
    label: 'Momentum Gapper',
    criteria: {
      minChangePercent: 10,
      maxChangePercent: 999,
      minRelativeVolume: 3,
      minFloat: 0,
      maxFloat: 50,
      minPrice: 1,
      maxPrice: 200,
      minVolume: 300000,
    },
  },
  {
    label: 'Low Float Runner',
    criteria: {
      minChangePercent: 8,
      maxChangePercent: 999,
      minRelativeVolume: 4,
      minFloat: 0,
      maxFloat: 15,
      minPrice: 1,
      maxPrice: 50,
      minVolume: 200000,
    },
  },
];

const SCANNER_STORAGE_KEY = 'alpaca-scanner-settings-v1';

function cloneDefaultPresets(): Criteria[] {
  return PRESETS.map(p => ({ ...p.criteria }));
}

type SortKey = 'changePercent' | 'volume' | 'relativeVolume' | 'floatShares' | 'price';

function parseStoredScannerSettings(): {
  presetsCriteria: Criteria[];
  selectedPreset: number;
  sortBy: SortKey;
  autoReconnect: boolean;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SCANNER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      presetsCriteria?: Partial<Criteria>[];
      selectedPreset?: number;
      sortBy?: string;
      autoReconnect?: boolean;
    };
    const defaults = cloneDefaultPresets();
    if (!Array.isArray(parsed.presetsCriteria)) return null;
    const merged = defaults.map((def, i) => ({
      ...def,
      ...(parsed.presetsCriteria![i] && typeof parsed.presetsCriteria![i] === 'object'
        ? parsed.presetsCriteria![i]
        : {}),
    }));
    const sortKeys: SortKey[] = ['changePercent', 'volume', 'relativeVolume', 'floatShares', 'price'];
    const sortBy = sortKeys.includes(parsed.sortBy as SortKey) ? (parsed.sortBy as SortKey) : 'changePercent';
    return {
      presetsCriteria: merged,
      selectedPreset: Math.min(
        Math.max(0, Number(parsed.selectedPreset) || 0),
        defaults.length - 1,
      ),
      sortBy,
      autoReconnect: typeof parsed.autoReconnect === 'boolean' ? parsed.autoReconnect : true,
    };
  } catch {
    return null;
  }
}

// ── Helpers ──

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K';
  return v.toString();
}

function formatFloat(f: number | null): string {
  if (f === null) return '—';
  if (f >= 1000) return (f / 1000).toFixed(1) + 'B';
  return f.toFixed(1) + 'M';
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

// ── Component ──

export default function AlpacaScannerClient() {
  const [results, setResults] = useState<Map<string, ScanResult>>(new Map());
  const [liveBars, setLiveBars] = useState<Map<string, LiveBar>>(new Map());
  const [recentTrades, setRecentTrades] = useState<LiveTrade[]>([]);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [liveSymbols, setLiveSymbols] = useState<string[]>([]);
  const [presetsCriteria, setPresetsCriteria] = useState<Criteria[]>(cloneDefaultPresets);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('changePercent');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [connectionCount, setConnectionCount] = useState(0);
  const [tradeFlash, setTradeFlash] = useState<Map<string, 'up' | 'down'>>(new Map());

  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const criteria = presetsCriteria[selectedPreset];

  const updateCriteria = useCallback((patch: Partial<Criteria>) => {
    setPresetsCriteria(prev => {
      const next = [...prev];
      next[selectedPreset] = { ...next[selectedPreset], ...patch };
      return next;
    });
  }, [selectedPreset]);

  useEffect(() => {
    const loaded = parseStoredScannerSettings();
    if (loaded) {
      setPresetsCriteria(loaded.presetsCriteria);
      setSelectedPreset(loaded.selectedPreset);
      setSortBy(loaded.sortBy);
      setAutoReconnect(loaded.autoReconnect);
    }
    setSettingsHydrated(true);
  }, []);

  useEffect(() => {
    if (!settingsHydrated || typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        SCANNER_STORAGE_KEY,
        JSON.stringify({
          presetsCriteria,
          selectedPreset,
          sortBy,
          autoReconnect,
        }),
      );
    } catch {
      /* quota / private mode */
    }
  }, [settingsHydrated, presetsCriteria, selectedPreset, sortBy, autoReconnect]);

  const sortedResults = useMemo(() => {
    const arr = Array.from(results.values()).map(r => {
      const bar = liveBars.get(r.ticker);
      if (bar) {
        return {
          ...r,
          price: bar.close,
          high: Math.max(r.high, bar.high),
          low: Math.min(r.low, bar.low),
          lastUpdate: bar.timestamp,
        };
      }
      return r;
    });

    arr.sort((a, b) => {
      switch (sortBy) {
        case 'changePercent': return b.changePercent - a.changePercent;
        case 'volume': return b.volume - a.volume;
        case 'relativeVolume': return b.relativeVolume - a.relativeVolume;
        case 'floatShares': return (a.floatShares ?? 9999) - (b.floatShares ?? 9999);
        case 'price': return b.price - a.price;
        default: return 0;
      }
    });

    return arr;
  }, [results, liveBars, sortBy]);

  const startScan = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setResults(new Map());
    setLiveBars(new Map());
    setRecentTrades([]);
    setIsScanning(true);
    setIsLive(false);
    setProgress({ step: 'Connecting to Alpaca...', percent: 0 });
    setConnectionCount(c => c + 1);

    fetch('/api/alpaca-scanner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(criteria),
      signal: ac.signal,
    }).then(async (res) => {
      if (!res.ok || !res.body) {
        setIsScanning(false);
        setProgress({ step: `Error: ${res.status} ${res.statusText}`, percent: 0 });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const { type, data } = JSON.parse(line.slice(6));

            switch (type) {
              case 'progress':
                setProgress({ step: data.step, percent: data.percent });
                break;

              case 'found':
                setResults(prev => {
                  const next = new Map(prev);
                  next.set(data.ticker, data);
                  return next;
                });
                break;

              case 'live':
                setIsLive(true);
                setLiveSymbols(data.symbols);
                break;

              case 'bar':
                setLiveBars(prev => {
                  const next = new Map(prev);
                  next.set(data.ticker, data);
                  return next;
                });
                // Volume accumulation on results
                setResults(prev => {
                  const existing = prev.get(data.ticker);
                  if (!existing) return prev;
                  const next = new Map(prev);
                  next.set(data.ticker, {
                    ...existing,
                    price: data.close,
                    high: Math.max(existing.high, data.high),
                    low: Math.min(existing.low, data.low),
                    lastUpdate: data.timestamp,
                  });
                  return next;
                });
                break;

              case 'trade': {
                setRecentTrades(prev => [data, ...prev].slice(0, 100));
                // Flash the price direction
                setResults(prev => {
                  const existing = prev.get(data.ticker);
                  if (!existing) return prev;
                  const dir = data.price > existing.price ? 'up' : data.price < existing.price ? 'down' : null;
                  if (dir) {
                    setTradeFlash(f => {
                      const next = new Map(f);
                      next.set(data.ticker, dir);
                      return next;
                    });
                    setTimeout(() => {
                      setTradeFlash(f => {
                        const next = new Map(f);
                        next.delete(data.ticker);
                        return next;
                      });
                    }, 600);
                  }
                  const next = new Map(prev);
                  next.set(data.ticker, {
                    ...existing,
                    price: data.price,
                    lastUpdate: data.timestamp,
                  });
                  return next;
                });
                break;
              }

              case 'timeout':
                setIsLive(false);
                setIsScanning(false);
                if (autoReconnect) {
                  setProgress({ step: 'Reconnecting for continued streaming...', percent: 0 });
                  reconnectTimeoutRef.current = setTimeout(() => startScan(), 2000);
                } else {
                  setProgress({ step: 'Stream timed out. Click Start to reconnect.', percent: 0 });
                }
                break;

              case 'ws_disconnected':
                setIsLive(false);
                break;

              case 'ws_error':
                setProgress(prev => ({
                  step: `WS: ${data.message || data.msg || 'error'}`,
                  percent: prev?.percent ?? 0,
                }));
                break;

              case 'complete':
                setIsScanning(false);
                setProgress({ step: `Scan complete — ${data.totalResults} stocks found (${data.mode || 'live'})`, percent: 100 });
                break;

              case 'error':
                setIsScanning(false);
                setProgress({ step: `Error: ${data.error}`, percent: 0 });
                break;
            }
          } catch { /* malformed JSON line */ }
        }
      }
    }).catch((err: Error) => {
      if (err.name !== 'AbortError') {
        setIsScanning(false);
        setProgress({ step: `Connection error: ${err.message}`, percent: 0 });
      }
    });
  }, [criteria, autoReconnect]);

  const stopScan = useCallback(() => {
    setAutoReconnect(false);
    if (abortRef.current) abortRef.current.abort();
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    setIsScanning(false);
    setIsLive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            Alpaca Real-Time Scanner
            {isLive && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-profit">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-profit opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-profit" />
                </span>
                LIVE
              </span>
            )}
          </h1>
          <p className="text-text-muted text-sm mt-1">
            WebSocket-powered real-time market data from Alpaca (IEX feed)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isScanning || isLive ? (
            <button
              onClick={stopScan}
              className="px-5 py-2.5 bg-loss/80 hover:bg-loss text-white font-semibold rounded-lg transition-all"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => { setAutoReconnect(true); startScan(); }}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg transition-all"
            >
              Start Scanner
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
              showSettings ? 'bg-accent text-white' : 'bg-surface-2 text-text-secondary border border-border hover:bg-surface-3'
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Presets + Settings */}
      <div className="mb-6 space-y-4">
        {/* Presets */}
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => setSelectedPreset(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedPreset === i
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-text-secondary border border-border hover:bg-surface-3'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="bg-surface-1 border border-border rounded-xl p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Min Change %', key: 'minChangePercent' },
                { label: 'Max Change %', key: 'maxChangePercent' },
                { label: 'Min Rel Volume', key: 'minRelativeVolume' },
                { label: 'Min Volume', key: 'minVolume' },
                { label: 'Min Float (M)', key: 'minFloat' },
                { label: 'Max Float (M)', key: 'maxFloat' },
                { label: 'Min Price ($)', key: 'minPrice' },
                { label: 'Max Price ($)', key: 'maxPrice' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-xs text-text-muted mb-1 block">{label}</label>
                  <input
                    type="number"
                    value={criteria[key as keyof Criteria]}
                    onChange={e => updateCriteria({ [key]: Number(e.target.value) } as Partial<Criteria>)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoReconnect}
                  onChange={e => setAutoReconnect(e.target.checked)}
                  className="rounded border-border bg-surface-2"
                />
                Auto-reconnect (keeps streaming after timeout)
              </label>
              <p className="text-xs text-text-muted">
                Per-preset thresholds, sort order, and this option are saved in this browser.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Progress */}
      {progress && (isScanning || progress.percent < 100) && (
        <div className="mb-6 bg-surface-1 border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            {isScanning && (
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            )}
            <span className="text-sm text-text-secondary">{progress.step}</span>
          </div>
          <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary bar */}
      {sortedResults.length > 0 && (
        <div className="mb-4 flex items-center gap-6 flex-wrap text-sm">
          <span className="text-text-primary font-semibold">{sortedResults.length} stocks found</span>
          {isLive && <span className="text-profit">Streaming {liveSymbols.length} tickers</span>}
          {connectionCount > 1 && <span className="text-text-muted">Reconnected {connectionCount - 1}x</span>}
          <div className="ml-auto flex items-center gap-2 text-text-muted text-xs">
            <span>Sort:</span>
            {(['changePercent', 'volume', 'relativeVolume', 'floatShares', 'price'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2 py-1 rounded transition-all ${
                  sortBy === s ? 'bg-accent text-white' : 'hover:bg-surface-3'
                }`}
              >
                {s === 'changePercent' ? '% Change' : s === 'relativeVolume' ? 'RVol' : s === 'floatShares' ? 'Float' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results table */}
      {sortedResults.length > 0 && (
        <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border bg-surface-2">
            <div className="col-span-2">Ticker</div>
            <div className="col-span-1 text-right">Price</div>
            <div className="col-span-1 text-right">Change</div>
            <div className="col-span-1 text-right">% Change</div>
            <div className="col-span-1 text-right">Volume</div>
            <div className="col-span-1 text-right">Rel Vol</div>
            <div className="col-span-1 text-right">Float</div>
            <div className="col-span-1 text-right">VWAP</div>
            <div className="col-span-1 text-right">Range</div>
            <div className="col-span-2 text-right">Updated</div>
          </div>

          {sortedResults.map(r => {
            const flash = tradeFlash.get(r.ticker);
            const isExpanded = expandedTicker === r.ticker;

            return (
              <div key={r.ticker}>
                {/* Row */}
                <div
                  onClick={() => setExpandedTicker(isExpanded ? null : r.ticker)}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 cursor-pointer transition-all border-b border-border hover:bg-card-hover ${
                    flash === 'up' ? 'bg-profit/10' : flash === 'down' ? 'bg-loss/10' : ''
                  } ${isExpanded ? 'bg-surface-2' : ''}`}
                >
                  {/* Ticker */}
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="font-bold text-text-primary text-sm">{r.ticker}</span>
                    {isLive && liveSymbols.includes(r.ticker) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
                    )}
                  </div>

                  {/* Price */}
                  <div className={`col-span-1 text-right font-mono text-sm ${
                    flash === 'up' ? 'text-profit' : flash === 'down' ? 'text-loss' : 'text-text-primary'
                  }`}>
                    ${r.price.toFixed(2)}
                  </div>

                  {/* Change */}
                  <div className={`col-span-1 text-right text-sm ${r.change >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {r.change >= 0 ? '+' : ''}{r.change.toFixed(2)}
                  </div>

                  {/* % Change */}
                  <div className="col-span-1 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                      r.changePercent >= 30 ? 'bg-profit/30 text-profit' :
                      r.changePercent >= 15 ? 'bg-profit/20 text-profit' :
                      'bg-profit/10 text-profit'
                    }`}>
                      +{r.changePercent.toFixed(1)}%
                    </span>
                  </div>

                  {/* Volume */}
                  <div className="col-span-1 text-right text-sm text-text-secondary">{formatVolume(r.volume)}</div>

                  {/* RVol */}
                  <div className="col-span-1 text-right">
                    <span className={`text-sm font-medium ${
                      r.relativeVolume >= 10 ? 'text-orange-400' :
                      r.relativeVolume >= 5 ? 'text-yellow-400' :
                      'text-text-secondary'
                    }`}>
                      {r.relativeVolume.toFixed(1)}x
                    </span>
                  </div>

                  {/* Float */}
                  <div className="col-span-1 text-right text-sm text-text-secondary">{formatFloat(r.floatShares)}</div>

                  {/* VWAP */}
                  <div className="col-span-1 text-right text-sm text-text-muted">
                    {r.vwap > 0 ? `$${r.vwap.toFixed(2)}` : '—'}
                  </div>

                  {/* Day Range */}
                  <div className="col-span-1 text-right text-xs text-text-muted">
                    {r.low.toFixed(2)} – {r.high.toFixed(2)}
                  </div>

                  {/* Updated */}
                  <div className="col-span-2 text-right text-xs text-text-muted">
                    {timeSince(r.lastUpdate)}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-b border-border bg-surface-2 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Info */}
                      <div className="bg-surface-3 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">Company Info</h4>
                        <p className="text-sm text-text-primary">{r.name}</p>
                        {r.industry && <p className="text-xs text-text-muted mt-1">{r.industry}</p>}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-text-muted">Open:</span>{' '}
                            <span className="text-text-primary">${r.open.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-text-muted">Prev Close:</span>{' '}
                            <span className="text-text-primary">${r.prevClose.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-text-muted">Day High:</span>{' '}
                            <span className="text-profit">${r.high.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-text-muted">Day Low:</span>{' '}
                            <span className="text-loss">${r.low.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Volume */}
                      <div className="bg-surface-3 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">Volume & Float</h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-text-muted">Volume</span>
                            <span className="text-text-primary font-medium">{formatVolume(r.volume)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-muted">Relative Vol</span>
                            <span className={`font-medium ${r.relativeVolume >= 5 ? 'text-orange-400' : 'text-text-primary'}`}>
                              {r.relativeVolume.toFixed(1)}x avg
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-muted">VWAP</span>
                            <span className="text-text-primary">${r.vwap > 0 ? r.vwap.toFixed(2) : '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-muted">Float</span>
                            <span className="text-text-primary">{formatFloat(r.floatShares)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-muted">Shares Out</span>
                            <span className="text-text-primary">{r.sharesOutstanding ? formatFloat(r.sharesOutstanding) : '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Latest Bar */}
                      <div className="bg-surface-3 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">
                          Latest Minute Bar
                          {isLive && liveSymbols.includes(r.ticker) && (
                            <span className="ml-2 text-profit normal-case">● live</span>
                          )}
                        </h4>
                        {(() => {
                          const bar = liveBars.get(r.ticker) || r.minuteBar;
                          if (!bar) return <p className="text-xs text-text-muted">No bar data yet</p>;
                          return (
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-text-muted">O / H / L / C</span>
                                <span className="text-text-primary font-mono">
                                  {bar.open.toFixed(2)} / {bar.high.toFixed(2)} / {bar.low.toFixed(2)} / {bar.close.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-muted">Bar Volume</span>
                                <span className="text-text-primary">{formatVolume(bar.volume)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-muted">Bar VWAP</span>
                                <span className="text-text-primary">${bar.vwap?.toFixed(2) ?? '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-muted">Time</span>
                                <span className="text-text-primary">{new Date(bar.timestamp).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          );
                        })()}
                        <div className="mt-3 flex gap-2">
                          <Link
                            href={`/technical-analysis?symbol=${r.ticker}`}
                            className="text-xs px-3 py-1.5 bg-accent/20 text-accent hover:bg-accent/30 rounded-lg transition-all"
                          >
                            Technical Analysis
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Live Trade Feed */}
      {isLive && recentTrades.length > 0 && (
        <div className="mt-6 bg-surface-1 border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-profit animate-pulse" />
              Live Trade Feed
            </h3>
            <span className="text-xs text-text-muted">{recentTrades.length} recent trades</span>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-border">
            {recentTrades.slice(0, 20).map((t, i) => (
              <div key={i} className="px-4 py-1.5 flex items-center gap-4 text-xs">
                <span className="font-bold text-text-primary w-16">{t.ticker}</span>
                <span className="text-text-secondary font-mono w-20 text-right">${t.price.toFixed(2)}</span>
                <span className="text-text-muted w-16 text-right">{t.size} shs</span>
                <span className="text-text-muted ml-auto">{new Date(t.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isScanning && sortedResults.length === 0 && !progress && (
        <div className="text-center py-20 bg-surface-1 border border-border rounded-xl">
          <h3 className="text-xl font-semibold text-text-primary mb-2">Alpaca Real-Time Scanner</h3>
          <p className="text-text-muted text-sm max-w-md mx-auto mb-6">
            Connect to Alpaca&apos;s WebSocket feed for real-time market data.
            Discover momentum gappers, low-float runners, and catalyst gainers as they happen.
          </p>
          <button
            onClick={() => { setAutoReconnect(true); startScan(); }}
            className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg transition-all"
          >
            Start Scanner
          </button>
        </div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden space-y-3 mt-4">
        {sortedResults.map(r => {
          const flash = tradeFlash.get(r.ticker);
          return (
            <div
              key={r.ticker}
              className={`bg-surface-1 border border-border rounded-xl p-4 transition-all ${
                flash === 'up' ? 'border-profit/30' : flash === 'down' ? 'border-loss/30' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary">{r.ticker}</span>
                    {isLive && liveSymbols.includes(r.ticker) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
                    )}
                  </div>
                  <span className="text-xs text-text-muted">{r.name}</span>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-bold ${flash === 'up' ? 'text-profit' : flash === 'down' ? 'text-loss' : 'text-text-primary'}`}>
                    ${r.price.toFixed(2)}
                  </div>
                  <span className="text-xs font-bold text-profit">+{r.changePercent.toFixed(1)}%</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-text-muted">Vol</span>
                  <span className="ml-1 text-text-primary">{formatVolume(r.volume)}</span>
                </div>
                <div>
                  <span className="text-text-muted">RVol</span>
                  <span className={`ml-1 ${r.relativeVolume >= 5 ? 'text-orange-400' : 'text-text-primary'}`}>
                    {r.relativeVolume.toFixed(1)}x
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Float</span>
                  <span className="ml-1 text-text-primary">{formatFloat(r.floatShares)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
