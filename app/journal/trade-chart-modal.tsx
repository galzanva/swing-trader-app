'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CHART_TIMEFRAMES, defaultChartTf, type ChartTimeframe } from '@/lib/journal-chart';

type Bar = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ChartPayload = {
  symbol: string;
  ticker: string;
  note: string | null;
  delayed: boolean;
  timeframe: ChartTimeframe;
  bars: Bar[];
  marks: {
    entries: { ms: number; price: number }[];
    exits: { ms: number; price: number }[];
    direction: string;
  };
  trade: {
    ticker: string;
    direction: string;
    tradeType: string;
    profitLoss: number | null;
    isOpen: boolean;
    strategy: string | null;
    exitReason: string | null;
    holdingDays: number | null;
  };
};

const EXIT_REASON_LABELS: Record<string, string> = {
  hit_target: 'Hit target',
  stopped_out: 'Stopped out',
  manual_exit: 'Manual exit',
  time_exit: 'Time-based exit',
};

function formatHold(entryMs: number, exitMs: number | null, holdingDays: number | null, isOpen: boolean): string {
  if (isOpen || exitMs == null) return 'Open';
  const ms = Math.max(0, exitMs - entryMs);
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${Math.max(1, totalMin)}m hold`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) return mins ? `${hours}h ${mins}m hold` : `${hours}h hold`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  if (holdingDays != null && holdingDays > 0 && totalMin < 60) return `${holdingDays}d hold`;
  return remH ? `${days}d ${remH}h hold` : `${days}d hold`;
}

const TF_LABEL: Record<ChartTimeframe, string> = {
  '1min': '1m',
  '5min': '5m',
  '15min': '15m',
  '1hour': '1H',
  '1day': '1D',
};

const NY = 'America/New_York';
const ENTRY_COLOR = '#38bdf8';
const ADD_COLOR = '#c4b5fd';
const EXIT_COLORS = ['#fbbf24', '#fb923c', '#f97316', '#fdba74', '#fcd34d'];
const LAST_COLOR = '#a3a3a3';

function unixSec(time: unknown): number | null {
  if (typeof time === 'number' && Number.isFinite(time)) return time;
  if (time && typeof time === 'object' && 'year' in time) {
    const t = time as { year: number; month: number; day: number };
    return Math.floor(Date.UTC(t.year, t.month - 1, t.day) / 1000);
  }
  return null;
}

function formatNy(sec: number, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: NY, ...opts }).format(new Date(sec * 1000));
}

function nyClock(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: NY,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(ms));
}

function nearestBarTime(bars: Bar[], ms: number): number {
  if (!bars.length) return Math.floor(ms / 1000);
  let best = bars[0].timestamp;
  let bestAbs = Math.abs(bars[0].timestamp - ms);
  for (const b of bars) {
    const d = Math.abs(b.timestamp - ms);
    if (d < bestAbs) {
      best = b.timestamp;
      bestAbs = d;
    }
  }
  return Math.floor(best / 1000);
}

export default function TradeChartModal({
  tradeId,
  tradeType,
  onClose,
}: {
  tradeId: string | null;
  tradeType?: string | null;
  onClose: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [tf, setTf] = useState<ChartTimeframe>(defaultChartTf(tradeType || 'intraday'));
  const [data, setData] = useState<ChartPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTf(defaultChartTf(tradeType || 'intraday'));
  }, [tradeId, tradeType]);

  const load = useCallback(async (id: string, timeframe: ChartTimeframe) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/journal/${id}/chart?tf=${timeframe}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setData(null);
        setError(json.error || 'Could not load chart');
        return;
      }
      setData(json as ChartPayload);
    } catch {
      setData(null);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!tradeId) {
      setData(null);
      setError(null);
      return;
    }
    void load(tradeId, tf);
  }, [tradeId, tf, load]);

  useEffect(() => {
    if (!tradeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [tradeId, onClose]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || !data?.bars.length) return;
    let disposed = false;
    let chart: { remove: () => void } | null = null;

    void import('lightweight-charts').then((lc) => {
      if (disposed || !hostRef.current) return;
      const container = hostRef.current;
      container.innerHTML = '';
      const asTime = (sec: number) => sec as unknown as import('lightweight-charts').UTCTimestamp;
      const created = lc.createChart(container, {
        autoSize: true,
        layout: {
          background: { color: '#111111' },
          textColor: '#d4d4d4',
        },
        grid: {
          vertLines: { color: '#222222' },
          horzLines: { color: '#222222' },
        },
        crosshair: { mode: lc.CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#2a2a2a' },
        localization: {
          timeFormatter: (time: unknown) => {
            const sec = unixSec(time);
            if (sec == null) return '';
            return tf === '1day'
              ? formatNy(sec, { weekday: 'short', month: 'short', day: 'numeric' })
              : formatNy(sec, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
          },
        },
        timeScale: {
          borderColor: '#2a2a2a',
          timeVisible: tf !== '1day',
          secondsVisible: false,
          tickMarkFormatter: (time: unknown, tickMarkType: number) => {
            const sec = unixSec(time);
            if (sec == null) return '';
            if (tf === '1day' || tickMarkType <= 2) {
              return formatNy(sec, { month: 'short', day: 'numeric' });
            }
            return formatNy(sec, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
          },
        },
      });
      chart = created;

      const candle = created.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineColor: LAST_COLOR,
        priceLineWidth: 1,
      });
      candle.setData(
        data.bars.map((b) => ({
          time: asTime(Math.floor(b.timestamp / 1000)),
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })),
      );

      const volume = created.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
      });
      created.priceScale('vol').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volume.setData(
        data.bars.map((b) => ({
          time: asTime(Math.floor(b.timestamp / 1000)),
          value: b.volume,
          color: b.close >= b.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
        })),
      );

      const long = data.marks.direction === 'long';
      const entryMarks = data.marks.entries.map((fill) => ({ ...fill, bar: nearestBarTime(data.bars, fill.ms) }));
      const exitMarks = data.marks.exits.map((fill) => ({ ...fill, bar: nearestBarTime(data.bars, fill.ms) }));

      entryMarks.forEach((fill, index) => {
        const color = index === 0 ? ENTRY_COLOR : ADD_COLOR;
        const title = index === 0 ? 'Entry' : `Add ${index}`;
        candle.createPriceLine({
          price: fill.price,
          color,
          lineWidth: 2,
          lineStyle: lc.LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${title} ${nyClock(fill.ms)}`,
        });
      });
      exitMarks.forEach((fill, index) => {
        candle.createPriceLine({
          price: fill.price,
          color: EXIT_COLORS[index % EXIT_COLORS.length],
          lineWidth: 2,
          lineStyle: lc.LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${index === 0 ? 'Exit' : `Exit ${index + 1}`} ${nyClock(fill.ms)}`,
        });
      });

      // Dots + labels sit on the fill price. Markers on the candle series
      // use above/below the bar, which parked the exit label on the entry line.
      const markSeries = (color: string, time: number, price: number, text: string, shape: 'arrowUp' | 'arrowDown', position: 'aboveBar' | 'belowBar') => {
        const series = created.addLineSeries({
          color,
          lineVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          pointMarkersVisible: true,
          pointMarkersRadius: 5,
        });
        series.setData([{ time: asTime(time), value: price }]);
        series.setMarkers([{ time: asTime(time), position, color, shape, text }] as any);
      };

      entryMarks.forEach((fill, index) => {
        const color = index === 0 ? ENTRY_COLOR : ADD_COLOR;
        const title = index === 0 ? 'Entry' : `Add ${index}`;
        markSeries(
          color,
          fill.bar,
          fill.price,
          `${title} ${fill.price.toFixed(2)}  ${nyClock(fill.ms)} ET`,
          long ? 'arrowUp' : 'arrowDown',
          long ? 'belowBar' : 'aboveBar',
        );
      });
      exitMarks.forEach((fill, index) => {
        const title = index === 0 ? 'Exit' : `Exit ${index + 1}`;
        markSeries(
          EXIT_COLORS[index % EXIT_COLORS.length],
          fill.bar,
          fill.price,
          `${title} ${fill.price.toFixed(2)}  ${nyClock(fill.ms)} ET`,
          long ? 'arrowDown' : 'arrowUp',
          long ? 'aboveBar' : 'belowBar',
        );
      });

      const rangeTimes = [...entryMarks.map((fill) => fill.bar), ...exitMarks.map((fill) => fill.bar)];
      if (!rangeTimes.length) return;
      const rangeExit = Math.max(...rangeTimes);
      const rangeEntry = Math.min(...rangeTimes);
      const pad = Math.max(8, Math.round(data.bars.length * 0.04));
      const times = data.bars.map((b) => Math.floor(b.timestamp / 1000));
      const fromIdx = Math.max(0, times.findIndex((t) => t >= Math.min(rangeEntry, rangeExit)) - pad);
      let toIdx = times.findIndex((t) => t >= rangeExit);
      if (toIdx < 0) toIdx = times.length - 1;
      toIdx = Math.min(times.length - 1, toIdx + pad);
      created.timeScale().setVisibleRange({
        from: asTime(times[fromIdx]),
        to: asTime(times[toIdx]),
      });
    });

    return () => {
      disposed = true;
      chart?.remove();
    };
  }, [data, tf]);

  if (!tradeId) return null;

  const pl = data?.trade.profitLoss;
  const jumpToTrade = () => {
    if (!data?.bars.length) return;
    void load(tradeId, tf);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-6xl h-[min(92vh,860px)] bg-surface-1 border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-chart-title"
      >
        <div className="shrink-0 px-5 py-4 border-b border-border flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="trade-chart-title" className="text-lg font-semibold text-text-primary font-mono">
              {data?.ticker || 'Chart'}
              {data && data.symbol !== data.ticker ? (
                <span className="text-text-muted font-sans font-normal text-sm ml-2">via {data.symbol}</span>
              ) : null}
            </h2>
            <p className="text-xs text-text-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Delayed candles · times in US Eastern · scroll to zoom · drag to pan</span>
              {pl != null && (
                <span className={`font-medium ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
                </span>
              )}
              {data && (
                <>
                  <span className="text-text-muted">·</span>
                  <span className="text-text-secondary">{data.trade.strategy?.trim() || 'No strategy'}</span>
                  {data.trade.exitReason && (
                    <>
                      <span className="text-text-muted">·</span>
                      <span className="text-text-secondary">
                        {EXIT_REASON_LABELS[data.trade.exitReason] || data.trade.exitReason}
                      </span>
                    </>
                  )}
                  <span className="text-text-muted">·</span>
                  <span className="text-text-secondary">
                    {formatHold(
                      data.marks.entries[0]?.ms ?? 0,
                      data.marks.exits.length ? Math.max(...data.marks.exits.map((fill) => fill.ms)) : null,
                      data.trade.holdingDays,
                      data.trade.isOpen,
                    )}
                  </span>
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] font-medium">
              <span className="inline-flex items-center gap-1.5 text-[#38bdf8]">
                <span className="w-3 h-0.5 bg-[#38bdf8] inline-block" /> Entry
              </span>
              {(data?.marks.entries.length ?? 0) > 1 && (
                <span className="inline-flex items-center gap-1.5 text-[#c4b5fd]">
                  <span className="w-3 h-0.5 bg-[#c4b5fd] inline-block" /> Add
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-[#fbbf24]">
                <span className="w-3 h-0.5 bg-[#fbbf24] inline-block" /> Exit
              </span>
              {(data?.marks.exits.length ?? 0) > 1 && (
                <span className="inline-flex items-center gap-1.5 text-[#fb923c]">
                  <span className="w-3 h-0.5 bg-[#fb923c] inline-block" /> Later exits
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-[#a3a3a3]">
                <span className="w-3 h-0.5 bg-[#a3a3a3] inline-block" /> Last
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-surface-2 rounded-xl p-1 border border-border">
            {CHART_TIMEFRAMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTf(t)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  tf === t ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {TF_LABEL[t]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={jumpToTrade}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-secondary hover:bg-surface-3"
          >
            Fit trade
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {data?.note && (
          <div className="shrink-0 px-5 py-2 text-xs text-text-secondary bg-surface-2 border-b border-border">
            {data.note}
          </div>
        )}

        <div className="flex-1 relative min-h-0 bg-[#111111]">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-text-secondary text-sm bg-[#111111]/70">
              Loading candles…
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="max-w-md text-center text-sm text-loss">{error}</div>
            </div>
          )}
          <div ref={hostRef} className="absolute inset-0" />
        </div>
      </div>
    </div>
  );
}
