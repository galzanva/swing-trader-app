'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface IntradayData {
  symbol: string;
  companyName: string;
  industry: string;
  timestamp: string;
  barsAvailable: { '1m': number; '5m': number; '15m': number; daily: number };

  price: {
    current: number;
    open: number;
    high: number;
    low: number | null;
    prevClose: number;
    change: number;
    changePercent: number;
    dayRange: number;
    dayRangePercent: number;
  };

  volume: {
    total: number;
    relativeVolume: number;
    premarket: number;
    avgRecent5m: number;
    avgDayBar5m: number;
    acceleration: number;
    accelerationLabel: string;
  };

  premarket: {
    high: number | null;
    low: number | null;
    volume: number;
    range: number | null;
  };

  openingRange: {
    high: number;
    low: number;
    open: number;
    close: number;
    volume: number;
    range: number;
    rangePercent: number;
    isBullish: boolean;
  } | null;

  vwap: {
    value: number;
    upperBand: number;
    lowerBand: number;
    distance: number;
    position: string;
  };

  emas: {
    ema8: number;
    ema13: number;
    ema21: number;
    alignment: string;
    priceVsEMA8: string;
    priceVsEMA21: string;
  };

  macd: {
    '1m': MACDData | null;
    '5m': MACDData | null;
  };

  rsi: number | null;

  fairValueGaps: {
    type: string;
    timeframe: string;
    high: number;
    low: number;
    midpoint: number;
    distancePercent: number;
  }[];

  keyLevels: {
    price: number;
    label: string;
    type: string;
    distancePercent: number;
  }[];

  intradaySR: { support: number[]; resistance: number[] };

  shortData: {
    shortFloat: number | null;
    shortInterest: number | null;
    daysToCover: number | null;
    shortVolRatio: number | null;
    squeezePotential: string;
  };

  bias: {
    direction: string;
    bullishSignals: number;
    bearishSignals: number;
    totalSignals: number;
  };

  news: { title: string; url: string; source: string; published: string }[];
  sharesOutstanding: number | null;
  marketCap: number | null;
  aiSummary: string | null;
}

interface MACDData {
  value: number;
  signal: number;
  histogram: number;
  trend: string;
  crossover: string;
}

export default function IntradayAnalysisClient() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get('symbol') || '';

  const [symbol, setSymbol] = useState(initialSymbol);
  const [inputSymbol, setInputSymbol] = useState(initialSymbol);
  const [data, setData] = useState<IntradayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async (sym: string) => {
    if (!sym) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/intraday-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Error ${res.status}`);
      }
      const result = await res.json();
      setData(result);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSymbol) fetchAnalysis(initialSymbol);
  }, [initialSymbol, fetchAnalysis]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputSymbol.trim().toUpperCase();
    if (trimmed) {
      setSymbol(trimmed);
      fetchAnalysis(trimmed);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      {/* Header + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-3xl">⚡</span> Intraday Analysis
          </h1>
          <p className="text-blue-300 text-sm mt-1">
            Multi-timeframe day trading analysis — 1m / 5m / 15m
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputSymbol}
            onChange={e => setInputSymbol(e.target.value.toUpperCase())}
            placeholder="TICKER"
            className="w-32 px-3 py-2 bg-slate-800/60 border border-blue-500/30 rounded-lg text-white text-sm uppercase placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            type="submit"
            disabled={loading || !inputSymbol.trim()}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
          {data && (
            <button
              type="button"
              onClick={() => fetchAnalysis(symbol)}
              disabled={loading}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-blue-300 rounded-lg text-sm transition-colors"
              title="Refresh"
            >
              🔄
            </button>
          )}
        </form>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-4" />
          <p className="text-blue-200 text-lg font-medium">Analyzing {symbol || inputSymbol}...</p>
          <p className="text-blue-400 text-sm mt-1">Fetching 1m, 5m, 15m & daily data + computing indicators</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-300 font-medium">{error}</p>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="space-y-4">
          {/* ── Price Header ── */}
          <PriceHeader data={data} lastUpdated={lastUpdated} />

          {/* ── Row 1: Key Levels + Opening Range + VWAP ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <KeyLevelsPanel data={data} />
            <OpeningRangePanel data={data} />
            <VWAPPanel data={data} />
          </div>

          {/* ── Row 2: EMAs + MACD + RSI/Volume ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <EMAPanel data={data} />
            <MACDPanel data={data} />
            <VolumePanel data={data} />
          </div>

          {/* ── Row 3: FVG + Short Squeeze + Bias ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <FVGPanel data={data} />
            <ShortSqueezePanel data={data} />
            <BiasPanel data={data} />
          </div>

          {/* ── AI Trading Plan ── */}
          {data.aiSummary && <AIPlanPanel summary={data.aiSummary} symbol={data.symbol} />}

          {/* ── News ── */}
          {data.news.length > 0 && <NewsPanel news={data.news} />}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">⚡</div>
          <h3 className="text-2xl font-bold text-white mb-2">Intraday Analysis</h3>
          <p className="text-blue-200 max-w-lg mx-auto">
            Enter a ticker to get a full intraday breakdown — VWAP, EMAs, MACD, opening range, fair value gaps, key levels, short squeeze data, and an AI trading plan. Best during market hours.
          </p>
        </div>
      )}
    </main>
  );
}

/* ═══════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════ */

function PriceHeader({ data, lastUpdated }: { data: IntradayData; lastUpdated: string | null }) {
  const { price } = data;
  const isUp = price.changePercent >= 0;

  return (
    <div className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">{data.symbol}</span>
              <span className={`text-xl font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                ${price.current.toFixed(2)}
              </span>
              <span className={`text-sm font-semibold px-2 py-0.5 rounded ${isUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {isUp ? '+' : ''}{price.changePercent.toFixed(2)}%
              </span>
            </div>
            <p className="text-blue-300 text-xs">{data.companyName}{data.industry ? ` · ${data.industry}` : ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <MiniStat label="Open" value={`$${price.open.toFixed(2)}`} />
          <MiniStat label="High" value={`$${price.high.toFixed(2)}`} color="text-green-400" />
          <MiniStat label="Low" value={price.low !== null ? `$${price.low.toFixed(2)}` : '—'} color="text-red-400" />
          <MiniStat label="Prev Close" value={`$${price.prevClose.toFixed(2)}`} />
          <MiniStat label="Day Range" value={`${price.dayRangePercent.toFixed(1)}%`} />
          {lastUpdated && <MiniStat label="Updated" value={lastUpdated} color="text-orange-300" />}
        </div>
      </div>
    </div>
  );
}

function KeyLevelsPanel({ data }: { data: IntradayData }) {
  const supportLevels = data.keyLevels.filter(l => l.type === 'support' || (l.type === 'neutral' && l.distancePercent <= 0));
  const resistanceLevels = data.keyLevels.filter(l => l.type === 'resistance' || (l.type === 'neutral' && l.distancePercent > 0));
  const neutralLevels = data.keyLevels.filter(l => l.type === 'neutral');

  return (
    <Card title="🎯 Key Levels" subtitle="Support & Resistance">
      <div className="space-y-3">
        {/* Resistance (sorted closest to price first) */}
        <div>
          <div className="text-xs font-bold text-red-400 mb-1.5 uppercase tracking-wider">Resistance</div>
          {resistanceLevels.sort((a, b) => a.distancePercent - b.distancePercent).slice(0, 5).map((l, i) => (
            <LevelRow key={i} label={l.label} price={l.price} distance={l.distancePercent} type="resistance" />
          ))}
          {resistanceLevels.length === 0 && <p className="text-xs text-slate-500">None detected</p>}
        </div>

        {/* Current Price marker */}
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 border-t border-dashed border-orange-500/50" />
          <span className="text-xs font-bold text-orange-400">${data.price.current.toFixed(2)}</span>
          <div className="flex-1 border-t border-dashed border-orange-500/50" />
        </div>

        {/* Support (sorted closest first) */}
        <div>
          <div className="text-xs font-bold text-green-400 mb-1.5 uppercase tracking-wider">Support</div>
          {supportLevels.filter(l => l.type !== 'neutral').sort((a, b) => b.distancePercent - a.distancePercent).slice(0, 5).map((l, i) => (
            <LevelRow key={i} label={l.label} price={l.price} distance={l.distancePercent} type="support" />
          ))}
          {supportLevels.length === 0 && <p className="text-xs text-slate-500">None detected</p>}
        </div>

        {/* VWAP level */}
        {neutralLevels.length > 0 && (
          <div className="pt-1 border-t border-white/5">
            {neutralLevels.map((l, i) => (
              <LevelRow key={i} label={l.label} price={l.price} distance={l.distancePercent} type="neutral" />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function OpeningRangePanel({ data }: { data: IntradayData }) {
  const or = data.openingRange;
  const pm = data.premarket;

  return (
    <Card title="🕘 Opening Range & Pre-Market" subtitle="First 5m candle + PM levels">
      {or ? (
        <div className="space-y-3">
          <div className={`text-center py-2 rounded-lg border ${or.isBullish ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <span className={`text-sm font-bold ${or.isBullish ? 'text-green-400' : 'text-red-400'}`}>
              {or.isBullish ? '▲ Bullish' : '▼ Bearish'} Opening Candle
            </span>
            <div className="text-xs text-blue-300 mt-0.5">Range: {or.rangePercent.toFixed(2)}%</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <StatBox label="OR High" value={`$${or.high.toFixed(2)}`} color={or.high > data.price.current ? 'text-red-400' : 'text-green-400'} />
            <StatBox label="OR Low" value={`$${or.low.toFixed(2)}`} color={or.low < data.price.current ? 'text-green-400' : 'text-red-400'} />
            <StatBox label="OR Open" value={`$${or.open.toFixed(2)}`} />
            <StatBox label="OR Close" value={`$${or.close.toFixed(2)}`} />
          </div>
          <div className="text-xs text-blue-200 bg-slate-700/30 rounded p-2">
            {data.price.current > or.high
              ? `Price is ABOVE opening range high — bullish breakout territory.`
              : data.price.current < or.low
              ? `Price is BELOW opening range low — bearish breakdown territory.`
              : `Price is INSIDE opening range — watching for breakout direction.`}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">No opening range data — market may not be open yet.</p>
      )}

      {(pm.high !== null || pm.low !== null) && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="text-xs font-bold text-blue-300 mb-1.5">Pre-Market</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <StatBox label="PM High" value={pm.high !== null ? `$${pm.high.toFixed(2)}` : '—'} />
            <StatBox label="PM Low" value={pm.low !== null ? `$${pm.low.toFixed(2)}` : '—'} />
            <StatBox label="PM Vol" value={fmtVol(pm.volume)} />
          </div>
        </div>
      )}
    </Card>
  );
}

function VWAPPanel({ data }: { data: IntradayData }) {
  const { vwap } = data;
  const isAbove = vwap.position === 'above';
  const isBelow = vwap.position === 'below';

  return (
    <Card title="📏 VWAP Analysis" subtitle="Volume-weighted avg price">
      <div className="space-y-3">
        <div className={`text-center py-3 rounded-lg border ${isAbove ? 'bg-green-500/10 border-green-500/30' : isBelow ? 'bg-red-500/10 border-red-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
          <div className="text-2xl font-bold text-white">${vwap.value.toFixed(2)}</div>
          <div className={`text-sm font-semibold mt-1 ${isAbove ? 'text-green-400' : isBelow ? 'text-red-400' : 'text-blue-300'}`}>
            Price is {vwap.distance >= 0 ? '+' : ''}{vwap.distance.toFixed(2)}% {vwap.position} VWAP
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <StatBox label="Upper Band (+2σ)" value={`$${vwap.upperBand.toFixed(2)}`} color="text-red-300" />
          <StatBox label="Lower Band (-2σ)" value={`$${vwap.lowerBand.toFixed(2)}`} color="text-green-300" />
        </div>

        <div className="text-xs text-blue-200 bg-slate-700/30 rounded p-2">
          {Math.abs(vwap.distance) > 3
            ? `Extended ${isAbove ? 'above' : 'below'} VWAP — potential mean reversion ${isAbove ? 'pullback' : 'bounce'}.`
            : Math.abs(vwap.distance) > 1
            ? `Trending ${isAbove ? 'above' : 'below'} VWAP — ${isAbove ? 'bulls' : 'bears'} in control.`
            : `Near VWAP — watching for directional break.`}
        </div>
      </div>
    </Card>
  );
}

function EMAPanel({ data }: { data: IntradayData }) {
  const { emas, price } = data;

  const emaRows = [
    { label: '8 EMA (fast)', value: emas.ema8, vs: emas.priceVsEMA8 },
    { label: '13 EMA', value: emas.ema13, vs: price.current > emas.ema13 ? 'above' : 'below' },
    { label: '21 EMA (slow)', value: emas.ema21, vs: emas.priceVsEMA21 },
  ];

  return (
    <Card title="📈 EMAs (5m)" subtitle="8 / 13 / 21 dynamic S/R">
      <div className="space-y-3">
        <div className={`text-center py-2 rounded-lg border ${
          emas.alignment === 'bullish' ? 'bg-green-500/10 border-green-500/30' :
          emas.alignment === 'bearish' ? 'bg-red-500/10 border-red-500/30' :
          'bg-yellow-500/10 border-yellow-500/30'
        }`}>
          <span className={`text-sm font-bold ${
            emas.alignment === 'bullish' ? 'text-green-400' :
            emas.alignment === 'bearish' ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {emas.alignment === 'bullish' ? '▲ Bullish Stack' : emas.alignment === 'bearish' ? '▼ Bearish Stack' : '↔ Mixed Alignment'}
          </span>
          <div className="text-xs text-blue-300 mt-0.5">
            {emas.alignment === 'bullish' ? '8 > 13 > 21 — uptrend' : emas.alignment === 'bearish' ? '8 < 13 < 21 — downtrend' : 'EMAs tangled — choppy'}
          </div>
        </div>

        {emaRows.map((row, i) => (
          <div key={i} className="flex items-center justify-between text-xs bg-slate-800/40 rounded px-2.5 py-2">
            <span className="text-blue-300">{row.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-white font-mono font-semibold">${row.value.toFixed(2)}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${row.vs === 'above' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {row.vs === 'above' ? '▲' : '▼'}
              </span>
            </div>
          </div>
        ))}

        <div className="text-xs text-blue-200 bg-slate-700/30 rounded p-2">
          {emas.priceVsEMA8 === 'above' && emas.priceVsEMA21 === 'above'
            ? 'Price holding above all EMAs — bullish continuation likely.'
            : emas.priceVsEMA8 === 'below' && emas.priceVsEMA21 === 'below'
            ? 'Price below all EMAs — bearish momentum.'
            : 'Price between EMAs — watch for bounce or break.'}
        </div>
      </div>
    </Card>
  );
}

function MACDPanel({ data }: { data: IntradayData }) {
  return (
    <Card title="📊 MACD" subtitle="1-minute & 5-minute momentum">
      <div className="space-y-3">
        {(['1m', '5m'] as const).map(tf => {
          const m = data.macd[tf];
          if (!m) return (
            <div key={tf} className="text-xs text-slate-500 bg-slate-800/40 rounded p-2">
              {tf} MACD: Insufficient data
            </div>
          );

          const isBullish = m.trend === 'bullish';
          const hasCross = m.crossover !== 'none';
          const isBullishCross = m.crossover === 'bullish_cross';

          return (
            <div key={tf} className="bg-slate-800/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-300 uppercase">{tf} MACD</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${isBullish ? 'text-green-400' : 'text-red-400'}`}>
                    {isBullish ? '▲ Bullish' : '▼ Bearish'}
                  </span>
                  {hasCross && (
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-bold animate-pulse ${
                      isBullishCross ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'
                    }`}>
                      {isBullishCross ? '✦ Bull Cross' : '✦ Bear Cross'}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <StatBox label="MACD" value={m.value.toFixed(4)} color={m.value >= 0 ? 'text-green-400' : 'text-red-400'} />
                <StatBox label="Signal" value={m.signal.toFixed(4)} />
                <StatBox label="Histogram" value={m.histogram.toFixed(4)} color={m.histogram >= 0 ? 'text-green-400' : 'text-red-400'} />
              </div>
            </div>
          );
        })}

        <div className="text-xs text-blue-200 bg-slate-700/30 rounded p-2">
          {data.macd['1m']?.trend === 'bullish' && data.macd['5m']?.trend === 'bullish'
            ? 'Both timeframes bullish — strong momentum alignment.'
            : data.macd['1m']?.trend === 'bearish' && data.macd['5m']?.trend === 'bearish'
            ? 'Both timeframes bearish — downside momentum confirmed.'
            : 'MACD divergence between 1m/5m — potential reversal or consolidation.'}
        </div>
      </div>
    </Card>
  );
}

function VolumePanel({ data }: { data: IntradayData }) {
  const { volume, rsi, price } = data;

  return (
    <Card title="📦 Volume & RSI" subtitle="Liquidity + momentum strength">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <StatBox label="Today Volume" value={fmtVol(volume.total)} />
          <StatBox
            label="Relative Volume"
            value={`${volume.relativeVolume.toFixed(1)}x`}
            color={volume.relativeVolume >= 5 ? 'text-red-400' : volume.relativeVolume >= 3 ? 'text-orange-400' : 'text-blue-300'}
          />
          <StatBox label="PM Volume" value={fmtVol(volume.premarket)} />
          <StatBox
            label="Vol Trend"
            value={volume.accelerationLabel}
            color={volume.acceleration > 1.2 ? 'text-green-400' : volume.acceleration < 0.8 ? 'text-red-400' : 'text-blue-300'}
          />
        </div>

        {/* RSI */}
        {rsi !== null && (
          <div className="bg-slate-800/40 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-300">RSI (5m, 14)</span>
              <span className={`text-sm font-bold ${
                rsi >= 70 ? 'text-red-400' : rsi <= 30 ? 'text-green-400' : 'text-white'
              }`}>{rsi.toFixed(1)}</span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  rsi >= 70 ? 'bg-red-500' : rsi >= 60 ? 'bg-orange-500' : rsi <= 30 ? 'bg-green-500' : rsi <= 40 ? 'bg-teal-500' : 'bg-blue-500'
                }`}
                style={{ width: `${rsi}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Oversold (30)</span>
              <span>Overbought (70)</span>
            </div>
          </div>
        )}

        <div className="text-xs text-blue-200 bg-slate-700/30 rounded p-2">
          {volume.relativeVolume >= 5
            ? 'Extreme relative volume — high institutional/momentum activity.'
            : volume.relativeVolume >= 3
            ? 'Elevated volume — above-average interest.'
            : 'Normal volume — typical trading activity.'}
          {rsi !== null && rsi >= 70 ? ' RSI overbought — caution on longs.' : ''}
          {rsi !== null && rsi <= 30 ? ' RSI oversold — potential bounce.' : ''}
        </div>
      </div>
    </Card>
  );
}

function FVGPanel({ data }: { data: IntradayData }) {
  const { fairValueGaps, price } = data;

  const bullishGaps = fairValueGaps.filter(f => f.type === 'bullish');
  const bearishGaps = fairValueGaps.filter(f => f.type === 'bearish');

  return (
    <Card title="🔲 Fair Value Gaps" subtitle="5m & 15m unfilled gaps">
      {fairValueGaps.length === 0 ? (
        <p className="text-sm text-slate-400">No active fair value gaps near current price.</p>
      ) : (
        <div className="space-y-3">
          {bullishGaps.length > 0 && (
            <div>
              <div className="text-xs font-bold text-green-400 mb-1.5 uppercase tracking-wider">Bullish FVGs (support)</div>
              {bullishGaps.map((g, i) => (
                <FVGRow key={i} gap={g} currentPrice={price.current} />
              ))}
            </div>
          )}
          {bearishGaps.length > 0 && (
            <div>
              <div className="text-xs font-bold text-red-400 mb-1.5 uppercase tracking-wider">Bearish FVGs (resistance)</div>
              {bearishGaps.map((g, i) => (
                <FVGRow key={i} gap={g} currentPrice={price.current} />
              ))}
            </div>
          )}
          <div className="text-xs text-blue-200 bg-slate-700/30 rounded p-2">
            {bullishGaps.length > 0 && bearishGaps.length > 0
              ? 'Both bullish & bearish FVGs present — price in a contested zone.'
              : bullishGaps.length > 0
              ? 'Unfilled bullish gaps below — likely support if price pulls back.'
              : 'Unfilled bearish gaps above — likely resistance if price pushes up.'}
          </div>
        </div>
      )}
    </Card>
  );
}

function ShortSqueezePanel({ data }: { data: IntradayData }) {
  const sd = data.shortData;
  const sp = sd.squeezePotential;

  return (
    <Card title="🩳 Short Squeeze" subtitle="Short interest & squeeze potential">
      <div className="space-y-3">
        {sp !== 'none' && (sp === 'extreme' || sp === 'high') && (
          <div className={`text-center py-2 rounded-lg border font-bold ${
            sp === 'extreme' ? 'bg-red-500/15 border-red-500/30 text-red-300' : 'bg-orange-500/15 border-orange-500/30 text-orange-300'
          }`}>
            {sp === 'extreme' ? '🔥 EXTREME SQUEEZE POTENTIAL' : '⚠️ HIGH SQUEEZE POTENTIAL'}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <StatBox
            label="Short Float %"
            value={sd.shortFloat !== null ? `${sd.shortFloat.toFixed(1)}%` : '—'}
            color={sd.shortFloat !== null && sd.shortFloat >= 20 ? 'text-red-400' : sd.shortFloat !== null && sd.shortFloat >= 10 ? 'text-orange-400' : undefined}
          />
          <StatBox
            label="Days to Cover"
            value={sd.daysToCover !== null ? sd.daysToCover.toFixed(1) : '—'}
            color={sd.daysToCover !== null && sd.daysToCover >= 5 ? 'text-red-400' : sd.daysToCover !== null && sd.daysToCover >= 3 ? 'text-orange-400' : undefined}
          />
          <StatBox
            label="Short Vol Ratio"
            value={sd.shortVolRatio !== null ? `${sd.shortVolRatio.toFixed(1)}%` : '—'}
            color={sd.shortVolRatio !== null && sd.shortVolRatio >= 50 ? 'text-red-400' : undefined}
          />
          <StatBox
            label="Short Interest"
            value={sd.shortInterest !== null ? fmtVol(sd.shortInterest) : '—'}
          />
        </div>

        <div className={`text-xs p-2 rounded-lg border ${
          sp === 'extreme' ? 'bg-red-500/10 border-red-500/30 text-red-200' :
          sp === 'high' ? 'bg-orange-500/10 border-orange-500/30 text-orange-200' :
          sp === 'moderate' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-200' :
          'bg-slate-700/30 border-slate-600/30 text-blue-200'
        }`}>
          {sp === 'extreme' && `${sd.shortFloat?.toFixed(0)}% shorted with ${sd.daysToCover?.toFixed(1) ?? '?'} days to cover. With today's catalyst, shorts are trapped.`}
          {sp === 'high' && `High short interest (${sd.shortFloat?.toFixed(0)}%) — forced covering adds fuel to any upward move.`}
          {sp === 'moderate' && `Moderate short positioning (${sd.shortFloat?.toFixed(0)}%) — some covering could accelerate moves.`}
          {sp === 'low' && `Light short interest — limited squeeze mechanics today.`}
          {sp === 'none' && (sd.shortFloat === null ? 'Short interest data not available for this ticker.' : 'Minimal short positioning — squeeze unlikely.')}
        </div>
      </div>
    </Card>
  );
}

function BiasPanel({ data }: { data: IntradayData }) {
  const { bias } = data;
  const dir = bias.direction;
  const bullPct = bias.totalSignals > 0 ? (bias.bullishSignals / bias.totalSignals) * 100 : 50;

  const biasColor = dir.includes('bullish') ? 'text-green-400' : dir.includes('bearish') ? 'text-red-400' : 'text-yellow-400';
  const biasBg = dir.includes('bullish') ? 'bg-green-500/10 border-green-500/30' : dir.includes('bearish') ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30';
  const biasLabel = dir === 'strong_bullish' ? '▲▲ Strong Bullish' : dir === 'bullish' ? '▲ Bullish' : dir === 'strong_bearish' ? '▼▼ Strong Bearish' : dir === 'bearish' ? '▼ Bearish' : '↔ Neutral';

  return (
    <Card title="🧭 Intraday Bias" subtitle="Composite signal alignment">
      <div className="space-y-3">
        <div className={`text-center py-3 rounded-lg border ${biasBg}`}>
          <div className={`text-xl font-bold ${biasColor}`}>{biasLabel}</div>
          <div className="text-xs text-blue-300 mt-1">
            {bias.bullishSignals} bullish / {bias.bearishSignals} bearish signals
          </div>
        </div>

        {/* Signal meter */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Bearish</span>
            <span>Neutral</span>
            <span>Bullish</span>
          </div>
          <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden relative">
            <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-30 w-full absolute" />
            <div
              className="h-full w-1 bg-white rounded-full absolute top-0 transition-all shadow-lg shadow-white/50"
              style={{ left: `${Math.min(100, Math.max(0, bullPct))}%` }}
            />
          </div>
        </div>

        {/* Signal breakdown */}
        <div className="space-y-1">
          <SignalRow label="VWAP position" value={data.vwap.position} bullish={data.vwap.position === 'above'} />
          <SignalRow label="EMA alignment" value={data.emas.alignment} bullish={data.emas.alignment === 'bullish'} />
          <SignalRow label="Price vs 8EMA" value={data.emas.priceVsEMA8} bullish={data.emas.priceVsEMA8 === 'above'} />
          <SignalRow label="MACD 1m" value={data.macd['1m']?.trend ?? 'n/a'} bullish={data.macd['1m']?.trend === 'bullish'} />
          <SignalRow label="MACD 5m" value={data.macd['5m']?.trend ?? 'n/a'} bullish={data.macd['5m']?.trend === 'bullish'} />
          {data.macd['5m']?.crossover !== 'none' && data.macd['5m']?.crossover && (
            <SignalRow label="5m MACD cross" value={data.macd['5m']!.crossover.replace('_', ' ')} bullish={data.macd['5m']!.crossover === 'bullish_cross'} />
          )}
          <SignalRow label="Opening candle" value={data.openingRange?.isBullish ? 'bullish' : 'bearish'} bullish={data.openingRange?.isBullish ?? false} />
          {data.rsi !== null && (
            <SignalRow label="RSI 5m" value={`${data.rsi.toFixed(0)}`} bullish={data.rsi > 55} />
          )}
        </div>
      </div>
    </Card>
  );
}

function AIPlanPanel({ summary, symbol }: { summary: string; symbol: string }) {
  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-orange-900/20 border border-orange-500/20 rounded-xl p-5">
      <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
        <span>🤖</span> AI Intraday Trading Plan — {symbol}
      </h3>
      <div className="text-sm text-blue-100 whitespace-pre-wrap leading-relaxed prose-invert max-w-none">
        {summary}
      </div>
    </div>
  );
}

function NewsPanel({ news }: { news: { title: string; url: string; source: string; published: string }[] }) {
  return (
    <div className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-4">
      <h3 className="text-sm font-bold text-white mb-2">📰 Recent News</h3>
      <div className="space-y-2">
        {news.map((n, i) => (
          <a
            key={i}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs p-2 bg-slate-800/80 rounded hover:bg-slate-700/80 transition-colors border border-white/5"
          >
            <span className="text-blue-200">{n.title}</span>
            <span className="text-slate-500 ml-2">{n.source} · {timeAgo(n.published)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ─── Shared small components ─── */

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-4">
      <h3 className="text-sm font-bold text-white mb-0.5">{title}</h3>
      <p className="text-xs text-blue-400 mb-3">{subtitle}</p>
      {children}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-blue-400 text-xs">{label}</div>
      <div className={`font-semibold ${color || 'text-white'}`}>{value}</div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-slate-800/50 rounded p-2">
      <div className="text-blue-400 text-xs truncate">{label}</div>
      <div className={`font-semibold text-sm ${color || 'text-white'}`}>{value}</div>
    </div>
  );
}

function LevelRow({ label, price, distance, type }: { label: string; price: number; distance: number; type: string }) {
  const color = type === 'resistance' ? 'text-red-400' : type === 'support' ? 'text-green-400' : 'text-blue-300';
  return (
    <div className="flex items-center justify-between text-xs py-1 px-1 hover:bg-white/5 rounded">
      <span className={`font-medium ${color}`}>{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-white font-mono">${price.toFixed(2)}</span>
        <span className={`text-xs w-16 text-right ${distance > 0 ? 'text-red-300' : 'text-green-300'}`}>
          {distance >= 0 ? '+' : ''}{distance.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function FVGRow({ gap, currentPrice }: { gap: IntradayData['fairValueGaps'][0]; currentPrice: number }) {
  const isBullish = gap.type === 'bullish';
  return (
    <div className={`flex items-center justify-between text-xs py-1.5 px-2 rounded mb-1 border ${
      isBullish ? 'bg-green-500/5 border-green-500/15' : 'bg-red-500/5 border-red-500/15'
    }`}>
      <div>
        <span className={`font-bold ${isBullish ? 'text-green-400' : 'text-red-400'}`}>{gap.timeframe}</span>
        <span className="text-blue-300 ml-2">${gap.low.toFixed(2)} – ${gap.high.toFixed(2)}</span>
      </div>
      <div className="text-right">
        <span className="text-slate-400 mr-2">mid ${gap.midpoint.toFixed(2)}</span>
        <span className={gap.distancePercent > 0 ? 'text-red-300' : 'text-green-300'}>
          {gap.distancePercent >= 0 ? '+' : ''}{gap.distancePercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function SignalRow({ label, value, bullish }: { label: string; value: string; bullish: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-blue-300">{label}</span>
      <span className={`font-semibold ${bullish ? 'text-green-400' : 'text-red-400'}`}>{value}</span>
    </div>
  );
}

function fmtVol(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
