/**
 * Intraday Analysis API
 * POST /api/intraday-analysis
 *
 * Multi-timeframe intraday analysis for day traders.
 * Fetches 1m, 5m, 15m, and daily bars then computes:
 * - Pre-market levels (high/low)
 * - Opening 5m candle range
 * - VWAP + distance from current price
 * - EMAs (8/13/21) on 5m as dynamic S/R
 * - MACD on 1m and 5m
 * - RSI on 5m
 * - Fair Value Gaps on 5m and 15m
 * - Key daily S/R levels
 * - Short interest / squeeze data
 * - AI-powered intraday trading plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { callLLM } from '@/lib/llm/client';
import { isLLMConfigured } from '@/lib/llm/config';

export const maxDuration = 60;

const POLYGON_BASE = 'https://api.polygon.io';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

interface Bar {
  t: number; o: number; h: number; l: number; c: number; v: number; vw?: number;
}

async function polyFetch(path: string, key: string): Promise<any> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${POLYGON_BASE}${path}${sep}apiKey=${key}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Polygon ${path} => ${res.status}`);
  return res.json();
}

async function polyFetchSafe(path: string, key: string): Promise<any> {
  try { return await polyFetch(path, key); } catch { return null; }
}

async function finnhubFetch(path: string, key: string): Promise<any> {
  if (!key) return null;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${FINNHUB_BASE}${path}${sep}token=${key}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

// ── Technical Indicator Calculations ──

function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function calculateMACD(closes: number[]): {
  macd: number[]; signal: number[]; histogram: number[];
  currentMACD: number; currentSignal: number; currentHistogram: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  crossover: 'bullish_cross' | 'bearish_cross' | 'none';
} {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12.map((v, i) => v - ema26[i]);
  const signal = calculateEMA(macd, 9);
  const histogram = macd.map((v, i) => v - signal[i]);

  const len = closes.length;
  const curMACD = macd[len - 1];
  const curSignal = signal[len - 1];
  const curHist = histogram[len - 1];
  const prevHist = len > 1 ? histogram[len - 2] : 0;

  let crossover: 'bullish_cross' | 'bearish_cross' | 'none' = 'none';
  if (curHist > 0 && prevHist <= 0) crossover = 'bullish_cross';
  else if (curHist < 0 && prevHist >= 0) crossover = 'bearish_cross';

  const trend = curMACD > curSignal ? 'bullish' : curMACD < curSignal ? 'bearish' : 'neutral';

  return { macd, signal, histogram, currentMACD: curMACD, currentSignal: curSignal, currentHistogram: curHist, trend, crossover };
}

function calculateRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(0);
  let avgGain = 0, avgLoss = 0;

  for (let i = 1; i <= period && i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function calculateVWAP(bars: Bar[]): { vwap: number; upperBand: number; lowerBand: number; values: number[] } {
  let cumVolPrice = 0;
  let cumVol = 0;
  let cumVarVolPrice = 0;
  const values: number[] = [];

  for (const b of bars) {
    const tp = (b.h + b.l + b.c) / 3;
    cumVolPrice += tp * b.v;
    cumVol += b.v;
    const vwap = cumVol > 0 ? cumVolPrice / cumVol : tp;
    cumVarVolPrice += (tp - vwap) ** 2 * b.v;
    values.push(vwap);
  }

  const vwap = values[values.length - 1] || 0;
  const variance = cumVol > 0 ? cumVarVolPrice / cumVol : 0;
  const stdDev = Math.sqrt(variance);

  return { vwap, upperBand: vwap + 2 * stdDev, lowerBand: vwap - 2 * stdDev, values };
}

interface FairValueGap {
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  midpoint: number;
  timestamp: number;
  filled: boolean;
  barIndex: number;
}

function detectFairValueGaps(bars: Bar[]): FairValueGap[] {
  const gaps: FairValueGap[] = [];
  for (let i = 2; i < bars.length; i++) {
    // Bullish FVG: gap up — bar[i]'s low > bar[i-2]'s high
    if (bars[i].l > bars[i - 2].h) {
      const gap: FairValueGap = {
        type: 'bullish',
        high: bars[i].l,
        low: bars[i - 2].h,
        midpoint: (bars[i].l + bars[i - 2].h) / 2,
        timestamp: bars[i].t,
        barIndex: i,
        filled: false,
      };
      // Check if filled by subsequent price action
      for (let j = i + 1; j < bars.length; j++) {
        if (bars[j].l <= gap.midpoint) { gap.filled = true; break; }
      }
      gaps.push(gap);
    }
    // Bearish FVG: gap down — bar[i]'s high < bar[i-2]'s low
    if (bars[i].h < bars[i - 2].l) {
      const gap: FairValueGap = {
        type: 'bearish',
        high: bars[i - 2].l,
        low: bars[i].h,
        midpoint: (bars[i - 2].l + bars[i].h) / 2,
        timestamp: bars[i].t,
        barIndex: i,
        filled: false,
      };
      for (let j = i + 1; j < bars.length; j++) {
        if (bars[j].h >= gap.midpoint) { gap.filled = true; break; }
      }
      gaps.push(gap);
    }
  }
  return gaps;
}

function findSupportResistance(bars: Bar[], numLevels = 5): { support: number[]; resistance: number[] } {
  if (bars.length < 3) return { support: [], resistance: [] };

  const pivots: { price: number; type: 'high' | 'low' }[] = [];
  for (let i = 1; i < bars.length - 1; i++) {
    if (bars[i].h > bars[i - 1].h && bars[i].h > bars[i + 1].h) {
      pivots.push({ price: bars[i].h, type: 'high' });
    }
    if (bars[i].l < bars[i - 1].l && bars[i].l < bars[i + 1].l) {
      pivots.push({ price: bars[i].l, type: 'low' });
    }
  }

  const currentPrice = bars[bars.length - 1].c;

  // Cluster nearby levels (within 0.5% of each other)
  const cluster = (prices: number[]): number[] => {
    if (prices.length === 0) return [];
    prices.sort((a, b) => a - b);
    const clusters: number[][] = [[prices[0]]];
    for (let i = 1; i < prices.length; i++) {
      const last = clusters[clusters.length - 1];
      const avg = last.reduce((s, v) => s + v, 0) / last.length;
      if (Math.abs(prices[i] - avg) / avg < 0.005) {
        last.push(prices[i]);
      } else {
        clusters.push([prices[i]]);
      }
    }
    return clusters
      .sort((a, b) => b.length - a.length)
      .map(c => Math.round((c.reduce((s, v) => s + v, 0) / c.length) * 100) / 100);
  };

  const supportPrices = pivots.filter(p => p.price < currentPrice).map(p => p.price);
  const resistancePrices = pivots.filter(p => p.price > currentPrice).map(p => p.price);

  return {
    support: cluster(supportPrices).slice(0, numLevels),
    resistance: cluster(resistancePrices).slice(0, numLevels),
  };
}

// ── Short Interest ──

interface ShortData {
  shortFloat: number | null;
  shortInterest: number | null;
  daysToCover: number | null;
  shortVolRatio: number | null;
  squeezePotential: 'extreme' | 'high' | 'moderate' | 'low' | 'none';
}

async function fetchShortData(sym: string, polygonKey: string, sharesOut: number | null): Promise<ShortData> {
  const empty: ShortData = { shortFloat: null, shortInterest: null, daysToCover: null, shortVolRatio: null, squeezePotential: 'none' };
  try {
    const [siData, svData] = await Promise.all([
      polyFetchSafe(`/stocks/v1/short-interest?ticker=${sym}&limit=1&sort=settlement_date.desc`, polygonKey),
      polyFetchSafe(`/stocks/v1/short-volume?ticker=${sym}&limit=1&sort=date.desc`, polygonKey),
    ]);

    let shortInterest: number | null = null;
    let daysToCover: number | null = null;
    let shortFloat: number | null = null;

    if (siData?.results?.length > 0) {
      const si = siData.results[0];
      shortInterest = si.short_interest ?? null;
      daysToCover = si.days_to_cover ?? null;
      if (shortInterest && sharesOut && sharesOut > 0) {
        shortFloat = (shortInterest / (sharesOut * 1_000_000)) * 100;
      }
    }

    let shortVolRatio: number | null = null;
    if (svData?.results?.length > 0) {
      shortVolRatio = svData.results[0].short_volume_ratio != null
        ? svData.results[0].short_volume_ratio / 100 : null;
    }

    const sf = shortFloat ?? 0;
    const dtc = daysToCover ?? 0;
    let squeezePotential: ShortData['squeezePotential'] = 'none';
    if (sf >= 30 && dtc >= 5) squeezePotential = 'extreme';
    else if (sf >= 20 && dtc >= 3) squeezePotential = 'high';
    else if (sf >= 15 || (sf >= 10 && dtc >= 3)) squeezePotential = 'moderate';
    else if (sf >= 8 || dtc >= 2) squeezePotential = 'low';

    return { shortFloat, shortInterest, daysToCover, shortVolRatio, squeezePotential };
  } catch { return empty; }
}

// ── Main route ──

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const polygonKey = process.env.POLYGON_API_KEY;
    if (!polygonKey) return NextResponse.json({ error: 'POLYGON_API_KEY not configured' }, { status: 500 });
    const finnhubKey = process.env.FINNHUB_API_KEY || '';

    const { symbol } = await request.json();
    if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 });

    const sym = symbol.toUpperCase();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Date range: today for intraday, plus a few extra days for context
    const from5d = new Date(now);
    from5d.setDate(from5d.getDate() - 7);
    const from5dStr = from5d.toISOString().split('T')[0];

    const from30d = new Date(now);
    from30d.setDate(from30d.getDate() - 45);
    const from30dStr = from30d.toISOString().split('T')[0];

    const fromDaily = new Date(now);
    fromDaily.setDate(fromDaily.getDate() - 120);
    const fromDailyStr = fromDaily.toISOString().split('T')[0];

    // Fetch all data in parallel
    const [bars1m, bars5m, bars15m, barsDaily, snapshotData, profile] = await Promise.all([
      polyFetch(`/v2/aggs/ticker/${sym}/range/1/minute/${from5dStr}/${todayStr}?adjusted=true&sort=asc&limit=5000`, polygonKey),
      polyFetch(`/v2/aggs/ticker/${sym}/range/5/minute/${from5dStr}/${todayStr}?adjusted=true&sort=asc&limit=2000`, polygonKey),
      polyFetch(`/v2/aggs/ticker/${sym}/range/15/minute/${from30dStr}/${todayStr}?adjusted=true&sort=asc&limit=2000`, polygonKey),
      polyFetch(`/v2/aggs/ticker/${sym}/range/1/day/${fromDailyStr}/${todayStr}?adjusted=true&sort=asc&limit=120`, polygonKey),
      polyFetchSafe(`/v2/snapshot/locale/us/markets/stocks/tickers/${sym}`, polygonKey),
      finnhubFetch(`/stock/profile2?symbol=${sym}`, finnhubKey),
    ]);

    const all1m: Bar[] = (bars1m.results || []);
    const all5m: Bar[] = (bars5m.results || []);
    const all15m: Bar[] = (bars15m.results || []);
    const allDaily: Bar[] = (barsDaily.results || []);

    if (all1m.length === 0 && all5m.length === 0) {
      return NextResponse.json({ error: `No intraday data for ${sym}. Market may be closed.` }, { status: 404 });
    }

    // Extract the most recent trading day from bars
    const lastBar = all1m[all1m.length - 1] || all5m[all5m.length - 1];
    const lastBarDate = new Date(lastBar.t);
    const tradingDayStart = new Date(lastBarDate);
    tradingDayStart.setUTCHours(0, 0, 0, 0);
    const tradingDayMs = tradingDayStart.getTime();

    // Split today's bars from historical
    const today1m = all1m.filter(b => b.t >= tradingDayMs);
    const today5m = all5m.filter(b => b.t >= tradingDayMs);
    const today15m = all15m.filter(b => b.t >= tradingDayMs);

    // Pre-market: bars before 9:30 ET (14:30 UTC) on the trading day
    const marketOpenUTC = tradingDayMs + 14 * 3600 * 1000 + 30 * 60 * 1000;
    const premarket1m = today1m.filter(b => b.t < marketOpenUTC);
    const rth1m = today1m.filter(b => b.t >= marketOpenUTC); // Regular trading hours

    // Snapshot data
    const snapshot = snapshotData?.ticker || {};
    const currentPrice = snapshot?.day?.c || snapshot?.lastTrade?.p || (all1m.length > 0 ? all1m[all1m.length - 1].c : 0);
    const prevClose = snapshot?.prevDay?.c || (allDaily.length >= 2 ? allDaily[allDaily.length - 2].c : 0);
    const todayOpen = snapshot?.day?.o || (rth1m.length > 0 ? rth1m[0].o : 0);
    const todayHigh = snapshot?.day?.h || Math.max(...today1m.map(b => b.h), 0);
    const todayLow = snapshot?.day?.l || Math.min(...today1m.filter(b => b.l > 0).map(b => b.l), Infinity);
    const todayVolume = snapshot?.day?.v || today1m.reduce((s, b) => s + b.v, 0);
    const prevVolume = snapshot?.prevDay?.v || (allDaily.length >= 2 ? allDaily[allDaily.length - 2].v : 1);
    const changePercent = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;
    const relativeVolume = prevVolume > 0 ? todayVolume / prevVolume : 1;

    // Company info
    const companyName = profile?.name || sym;
    const industry = profile?.finnhubIndustry || '';
    const sharesOutstanding = profile?.shareOutstanding ?? null;
    const marketCap = profile?.marketCapitalization ?? null;

    // ── Pre-market levels ──
    const premarketHigh = premarket1m.length > 0 ? Math.max(...premarket1m.map(b => b.h)) : null;
    const premarketLow = premarket1m.length > 0 ? Math.min(...premarket1m.map(b => b.l)) : null;
    const premarketVolume = premarket1m.reduce((s, b) => s + b.v, 0);

    // ── Opening 5-minute candle ──
    const opening5m = today5m.find(b => b.t >= marketOpenUTC);
    const openingRange = opening5m ? {
      high: opening5m.h,
      low: opening5m.l,
      open: opening5m.o,
      close: opening5m.c,
      volume: opening5m.v,
      range: opening5m.h - opening5m.l,
      rangePercent: opening5m.l > 0 ? ((opening5m.h - opening5m.l) / opening5m.l) * 100 : 0,
      isBullish: opening5m.c > opening5m.o,
    } : null;

    // ── VWAP (regular trading hours only) ──
    const rth1mBars = rth1m.length > 0 ? rth1m : today1m;
    const vwapData = calculateVWAP(rth1mBars);
    const vwapDistance = currentPrice > 0 && vwapData.vwap > 0
      ? ((currentPrice - vwapData.vwap) / vwapData.vwap) * 100 : 0;
    const vwapPosition = vwapDistance > 0.3 ? 'above' : vwapDistance < -0.3 ? 'below' : 'at';

    // ── EMAs on 5m (8, 13, 21) ──
    const closes5m = all5m.map(b => b.c);
    const ema8_5m = calculateEMA(closes5m, 8);
    const ema13_5m = calculateEMA(closes5m, 13);
    const ema21_5m = calculateEMA(closes5m, 21);
    const len5m = closes5m.length;

    const currentEMA8 = len5m > 0 ? Math.round(ema8_5m[len5m - 1] * 100) / 100 : 0;
    const currentEMA13 = len5m > 0 ? Math.round(ema13_5m[len5m - 1] * 100) / 100 : 0;
    const currentEMA21 = len5m > 0 ? Math.round(ema21_5m[len5m - 1] * 100) / 100 : 0;

    const emaAlignment = currentEMA8 > currentEMA13 && currentEMA13 > currentEMA21 ? 'bullish'
      : currentEMA8 < currentEMA13 && currentEMA13 < currentEMA21 ? 'bearish' : 'mixed';

    // Price relation to EMAs
    const priceVsEMA8 = currentPrice > currentEMA8 ? 'above' : 'below';
    const priceVsEMA21 = currentPrice > currentEMA21 ? 'above' : 'below';

    // ── MACD on 1m and 5m ──
    const closes1m = all1m.map(b => b.c);
    const macd1m = closes1m.length >= 26 ? calculateMACD(closes1m) : null;
    const macd5m = closes5m.length >= 26 ? calculateMACD(closes5m) : null;

    // ── RSI on 5m ──
    const rsi5m = closes5m.length >= 15 ? calculateRSI(closes5m, 14) : [];
    const currentRSI = rsi5m.length > 0 ? Math.round(rsi5m[rsi5m.length - 1] * 10) / 10 : null;

    // ── Fair Value Gaps (5m and 15m) ──
    const fvg5m = detectFairValueGaps(today5m);
    const fvg15m = detectFairValueGaps(today15m);

    // Only keep unfilled (active) FVGs near current price
    const activeFVGs = [...fvg5m.map(f => ({ ...f, timeframe: '5m' })), ...fvg15m.map(f => ({ ...f, timeframe: '15m' }))]
      .filter(f => !f.filled)
      .filter(f => Math.abs(f.midpoint - currentPrice) / currentPrice < 0.05)
      .sort((a, b) => Math.abs(a.midpoint - currentPrice) - Math.abs(b.midpoint - currentPrice))
      .slice(0, 8);

    // ── Daily S/R levels ──
    const dailySR = findSupportResistance(allDaily, 4);

    // ── Intraday S/R from 5m pivots ──
    const intradaySR = findSupportResistance(today5m, 4);

    // ── Key Levels compilation ──
    const keyLevels: { price: number; label: string; type: 'support' | 'resistance' | 'neutral' }[] = [];

    if (premarketHigh !== null) keyLevels.push({ price: premarketHigh, label: 'PM High', type: premarketHigh > currentPrice ? 'resistance' : 'support' });
    if (premarketLow !== null) keyLevels.push({ price: premarketLow, label: 'PM Low', type: premarketLow < currentPrice ? 'support' : 'resistance' });
    if (openingRange) {
      keyLevels.push({ price: openingRange.high, label: 'OR High', type: openingRange.high > currentPrice ? 'resistance' : 'support' });
      keyLevels.push({ price: openingRange.low, label: 'OR Low', type: openingRange.low < currentPrice ? 'support' : 'resistance' });
    }
    keyLevels.push({ price: Math.round(vwapData.vwap * 100) / 100, label: 'VWAP', type: 'neutral' });
    if (prevClose > 0) keyLevels.push({ price: prevClose, label: 'Prev Close', type: prevClose < currentPrice ? 'support' : 'resistance' });
    if (todayHigh > 0 && todayHigh !== currentPrice) keyLevels.push({ price: todayHigh, label: 'Day High', type: 'resistance' });
    if (todayLow > 0 && todayLow < Infinity && todayLow !== currentPrice) keyLevels.push({ price: todayLow, label: 'Day Low', type: 'support' });

    for (const s of dailySR.support.slice(0, 3)) keyLevels.push({ price: s, label: 'Daily S', type: 'support' });
    for (const r of dailySR.resistance.slice(0, 3)) keyLevels.push({ price: r, label: 'Daily R', type: 'resistance' });

    // Deduplicate levels within 0.3%
    const deduped: typeof keyLevels = [];
    for (const lvl of keyLevels.sort((a, b) => a.price - b.price)) {
      const exists = deduped.find(d => Math.abs(d.price - lvl.price) / lvl.price < 0.003);
      if (!exists) deduped.push(lvl);
    }

    // Short interest data
    const shortData = await fetchShortData(sym, polygonKey, sharesOutstanding);

    // Fresh news (last 18h)
    let freshNews: any[] = [];
    try {
      const newsData = await polyFetchSafe(`/v2/reference/news?ticker=${sym}&limit=8&sort=published_utc&order=desc`, polygonKey);
      const nowMs = Date.now();
      const freshMs = 18 * 3600 * 1000;
      freshNews = (newsData?.results || [])
        .filter((n: any) => n.published_utc && (nowMs - new Date(n.published_utc).getTime()) <= freshMs)
        .map((n: any) => ({ title: n.title, url: n.article_url, source: n.publisher?.name || 'Unknown', published: n.published_utc }));
    } catch { /* non-critical */ }

    // ── Intraday trading range ──
    const dayRange = todayHigh > 0 && todayLow < Infinity ? todayHigh - todayLow : 0;
    const dayRangePercent = todayLow > 0 && todayLow < Infinity ? (dayRange / todayLow) * 100 : 0;

    // ── Recent volume distribution (last 5 bars of 5m) ──
    const recent5mBars = today5m.slice(-5);
    const avgRecentVol = recent5mBars.length > 0 ? recent5mBars.reduce((s, b) => s + b.v, 0) / recent5mBars.length : 0;
    const totalTodayBars5m = today5m.length;
    const avgFullDayVol = totalTodayBars5m > 0 ? today5m.reduce((s, b) => s + b.v, 0) / totalTodayBars5m : 0;
    const volumeAcceleration = avgFullDayVol > 0 ? avgRecentVol / avgFullDayVol : 1;

    // ── Overall intraday bias ──
    let bullishSignals = 0;
    let bearishSignals = 0;

    if (vwapPosition === 'above') bullishSignals++; else if (vwapPosition === 'below') bearishSignals++;
    if (emaAlignment === 'bullish') bullishSignals++; else if (emaAlignment === 'bearish') bearishSignals++;
    if (priceVsEMA8 === 'above') bullishSignals++; else bearishSignals++;
    if (macd5m?.trend === 'bullish') bullishSignals++; else if (macd5m?.trend === 'bearish') bearishSignals++;
    if (macd1m?.trend === 'bullish') bullishSignals++; else if (macd1m?.trend === 'bearish') bearishSignals++;
    if (macd5m?.crossover === 'bullish_cross') bullishSignals++; else if (macd5m?.crossover === 'bearish_cross') bearishSignals++;
    if (openingRange?.isBullish) bullishSignals++; else bearishSignals++;
    if (currentRSI !== null && currentRSI > 55) bullishSignals++; else if (currentRSI !== null && currentRSI < 45) bearishSignals++;

    const intradayBias = bullishSignals - bearishSignals >= 3 ? 'strong_bullish'
      : bullishSignals - bearishSignals >= 1 ? 'bullish'
      : bearishSignals - bullishSignals >= 3 ? 'strong_bearish'
      : bearishSignals - bullishSignals >= 1 ? 'bearish'
      : 'neutral';

    // ── AI Summary ──
    let aiSummary: string | null = null;

    if (isLLMConfigured()) {
      try {
        const levelsStr = deduped.map(l => `${l.label}: $${l.price.toFixed(2)} (${l.type})`).join(', ');
        const fvgStr = activeFVGs.map(f => `${f.type} FVG ${f.timeframe}: $${f.low.toFixed(2)}-$${f.high.toFixed(2)} (mid $${f.midpoint.toFixed(2)})`).join('; ');

        const systemPrompt = `You are an elite intraday day trader analyst. Given the following real-time intraday data for ${sym}, provide a concise, actionable trading plan for today. Focus on:
1. Current setup quality (A/B/C/F grade) and direction bias
2. Key entries: where to buy/short, based on VWAP, opening range, FVGs, EMA bounce
3. Targets: realistic intraday profit targets using key levels
4. Stop loss: tight risk management levels
5. What to watch: specific price levels or MACD crossovers that would change the thesis

Be direct. No fluff. Use the specific numbers provided. Think like a professional scalper/day trader.`;

        const userPrompt = `${sym} (${companyName}) — Intraday Analysis

Price: $${currentPrice.toFixed(2)} | Change: ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}% | Prev Close: $${prevClose.toFixed(2)}
Open: $${todayOpen.toFixed(2)} | High: $${todayHigh.toFixed(2)} | Low: ${todayLow < Infinity ? '$' + todayLow.toFixed(2) : 'N/A'}
Volume: ${formatNum(todayVolume)} | Rel Volume: ${relativeVolume.toFixed(1)}x | Day Range: ${dayRangePercent.toFixed(1)}%

Pre-Market: High $${premarketHigh?.toFixed(2) ?? 'N/A'} | Low $${premarketLow?.toFixed(2) ?? 'N/A'} | Vol ${formatNum(premarketVolume)}
Opening 5m Candle: ${openingRange ? `${openingRange.isBullish ? 'BULLISH' : 'BEARISH'} | High $${openingRange.high.toFixed(2)} Low $${openingRange.low.toFixed(2)} | Range ${openingRange.rangePercent.toFixed(1)}%` : 'N/A'}

VWAP: $${vwapData.vwap.toFixed(2)} | Price ${vwapPosition} VWAP (${vwapDistance >= 0 ? '+' : ''}${vwapDistance.toFixed(2)}%)
Upper Band: $${vwapData.upperBand.toFixed(2)} | Lower Band: $${vwapData.lowerBand.toFixed(2)}

EMAs (5m): 8 EMA $${currentEMA8} | 13 EMA $${currentEMA13} | 21 EMA $${currentEMA21} | Alignment: ${emaAlignment.toUpperCase()}
Price vs EMAs: ${priceVsEMA8} 8EMA, ${priceVsEMA21} 21EMA

MACD 1m: ${macd1m ? `Trend ${macd1m.trend}, Hist ${macd1m.currentHistogram.toFixed(4)}, ${macd1m.crossover !== 'none' ? macd1m.crossover.replace('_', ' ').toUpperCase() : 'no crossover'}` : 'N/A'}
MACD 5m: ${macd5m ? `Trend ${macd5m.trend}, Hist ${macd5m.currentHistogram.toFixed(4)}, ${macd5m.crossover !== 'none' ? macd5m.crossover.replace('_', ' ').toUpperCase() : 'no crossover'}` : 'N/A'}
RSI 5m: ${currentRSI ?? 'N/A'}

Key Levels: ${levelsStr}
Active FVGs: ${fvgStr || 'None detected'}

Short Interest: ${shortData.shortFloat !== null ? `${shortData.shortFloat.toFixed(1)}% SI, ${shortData.daysToCover?.toFixed(1) ?? '?'} DTC, squeeze potential: ${shortData.squeezePotential}` : 'N/A'}

Overall Bias: ${intradayBias.replace('_', ' ').toUpperCase()} (${bullishSignals} bullish / ${bearishSignals} bearish signals)
Volume trend: Recent 5m avg ${formatNum(avgRecentVol)} vs day avg ${formatNum(avgFullDayVol)} (${volumeAcceleration.toFixed(1)}x ${volumeAcceleration > 1.2 ? 'ACCELERATING' : volumeAcceleration < 0.8 ? 'FADING' : 'STEADY'})
${freshNews.length > 0 ? `\nRecent News:\n${freshNews.map(n => `- ${n.title}`).join('\n')}` : ''}`;

        const llmResult = await callLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.5,
          maxTokens: 1200,
        });
        aiSummary = llmResult.content;
      } catch (e: any) {
        console.error('[IntradayAnalysis] AI error:', e.message);
      }
    }

    // Build response
    const analysis = {
      symbol: sym,
      companyName,
      industry,
      timestamp: now.toISOString(),
      barsAvailable: { '1m': all1m.length, '5m': all5m.length, '15m': all15m.length, daily: allDaily.length },

      price: {
        current: currentPrice,
        open: todayOpen,
        high: todayHigh,
        low: todayLow < Infinity ? todayLow : null,
        prevClose,
        change: currentPrice - prevClose,
        changePercent: Math.round(changePercent * 100) / 100,
        dayRange: Math.round(dayRange * 100) / 100,
        dayRangePercent: Math.round(dayRangePercent * 100) / 100,
      },

      volume: {
        total: todayVolume,
        relativeVolume: Math.round(relativeVolume * 100) / 100,
        premarket: premarketVolume,
        avgRecent5m: Math.round(avgRecentVol),
        avgDayBar5m: Math.round(avgFullDayVol),
        acceleration: Math.round(volumeAcceleration * 100) / 100,
        accelerationLabel: volumeAcceleration > 1.5 ? 'surging' : volumeAcceleration > 1.2 ? 'accelerating' : volumeAcceleration > 0.8 ? 'steady' : 'fading',
      },

      premarket: {
        high: premarketHigh ? Math.round(premarketHigh * 100) / 100 : null,
        low: premarketLow ? Math.round(premarketLow * 100) / 100 : null,
        volume: premarketVolume,
        range: premarketHigh && premarketLow ? Math.round((premarketHigh - premarketLow) * 100) / 100 : null,
      },

      openingRange,

      vwap: {
        value: Math.round(vwapData.vwap * 100) / 100,
        upperBand: Math.round(vwapData.upperBand * 100) / 100,
        lowerBand: Math.round(vwapData.lowerBand * 100) / 100,
        distance: Math.round(vwapDistance * 100) / 100,
        position: vwapPosition,
      },

      emas: {
        ema8: currentEMA8,
        ema13: currentEMA13,
        ema21: currentEMA21,
        alignment: emaAlignment,
        priceVsEMA8,
        priceVsEMA21,
      },

      macd: {
        '1m': macd1m ? {
          value: Math.round(macd1m.currentMACD * 10000) / 10000,
          signal: Math.round(macd1m.currentSignal * 10000) / 10000,
          histogram: Math.round(macd1m.currentHistogram * 10000) / 10000,
          trend: macd1m.trend,
          crossover: macd1m.crossover,
        } : null,
        '5m': macd5m ? {
          value: Math.round(macd5m.currentMACD * 10000) / 10000,
          signal: Math.round(macd5m.currentSignal * 10000) / 10000,
          histogram: Math.round(macd5m.currentHistogram * 10000) / 10000,
          trend: macd5m.trend,
          crossover: macd5m.crossover,
        } : null,
      },

      rsi: currentRSI,

      fairValueGaps: activeFVGs.map(f => ({
        type: f.type,
        timeframe: f.timeframe,
        high: Math.round(f.high * 100) / 100,
        low: Math.round(f.low * 100) / 100,
        midpoint: Math.round(f.midpoint * 100) / 100,
        distancePercent: Math.round(((f.midpoint - currentPrice) / currentPrice) * 10000) / 100,
      })),

      keyLevels: deduped.map(l => ({
        price: l.price,
        label: l.label,
        type: l.type,
        distancePercent: Math.round(((l.price - currentPrice) / currentPrice) * 10000) / 100,
      })),

      intradaySR: {
        support: intradaySR.support.slice(0, 3),
        resistance: intradaySR.resistance.slice(0, 3),
      },

      shortData: {
        shortFloat: shortData.shortFloat !== null ? Math.round(shortData.shortFloat * 100) / 100 : null,
        shortInterest: shortData.shortInterest,
        daysToCover: shortData.daysToCover !== null ? Math.round(shortData.daysToCover * 100) / 100 : null,
        shortVolRatio: shortData.shortVolRatio !== null ? Math.round(shortData.shortVolRatio * 10000) / 100 : null,
        squeezePotential: shortData.squeezePotential,
      },

      bias: {
        direction: intradayBias,
        bullishSignals,
        bearishSignals,
        totalSignals: bullishSignals + bearishSignals,
      },

      news: freshNews,
      sharesOutstanding,
      marketCap,
      aiSummary,
    };

    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error('[IntradayAnalysis] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
