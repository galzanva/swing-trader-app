/**
 * GET /api/journal/analytics — Compute Tradervue-style analytics from trade data.
 * Returns breakdown reports: by strategy, time-of-day, price range, sector, ticker,
 * day-of-week, R-multiple distribution, holding period, and overall stats.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

interface BucketStats {
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPL: number;
  avgPL: number;
  avgReturn: number;
  avgR: number | null;
  totalR: number | null;
}

function computeBucket(label: string, trades: any[]): BucketStats {
  const closed = trades.filter(t => !t.isOpen && t.returnPct !== null);
  const wins = closed.filter(t => (t.profitLoss ?? 0) > 0).length;
  const losses = closed.filter(t => (t.profitLoss ?? 0) < 0).length;
  const totalPL = closed.reduce((s, t) => s + (t.profitLoss ?? 0), 0);
  const avgPL = closed.length > 0 ? totalPL / closed.length : 0;
  const avgReturn = closed.length > 0
    ? closed.reduce((s, t) => s + (t.returnPct ?? 0), 0) / closed.length
    : 0;
  const rTrades = closed.filter(t => t.rMultiple !== null);
  const avgR = rTrades.length > 0
    ? rTrades.reduce((s, t) => s + (t.rMultiple ?? 0), 0) / rTrades.length
    : null;
  const totalR = rTrades.length > 0
    ? rTrades.reduce((s, t) => s + (t.rMultiple ?? 0), 0)
    : null;

  return {
    label,
    trades: closed.length,
    wins,
    losses,
    winRate: closed.length > 0 ? Math.round((wins / closed.length) * 10000) / 100 : 0,
    totalPL: Math.round(totalPL * 100) / 100,
    avgPL: Math.round(avgPL * 100) / 100,
    avgReturn: Math.round(avgReturn * 100) / 100,
    avgR: avgR !== null ? Math.round(avgR * 100) / 100 : null,
    totalR: totalR !== null ? Math.round(totalR * 100) / 100 : null,
  };
}

function getHourBucket(timeStr: string | null): string {
  if (!timeStr) return 'Unknown';
  const h = parseInt(timeStr.split(':')[0], 10);
  if (isNaN(h)) return 'Unknown';
  if (h < 10) return '9:30-10:00';
  if (h < 11) return '10:00-11:00';
  if (h < 12) return '11:00-12:00';
  if (h < 13) return '12:00-13:00';
  if (h < 14) return '13:00-14:00';
  if (h < 15) return '14:00-15:00';
  return '15:00-16:00';
}

function getPriceRange(price: number): string {
  if (price < 2) return 'Under $2';
  if (price < 5) return '$2-$5';
  if (price < 10) return '$5-$10';
  if (price < 20) return '$10-$20';
  if (price < 50) return '$20-$50';
  return '$50+';
}

/** floatShares is stored in millions of shares (Finnhub shareOutstanding). */
const FLOAT_BUCKET_ORDER = [
  'Under 1M',
  '1M–5M',
  '6M–9M',
  '10M–15M',
  '16M–20M',
  '20M–30M',
  '31M–40M',
  '41M–50M',
  '51M–100M',
  '101M–200M',
  '200M+',
  'Unknown',
];

function getFloatRange(floatM: number | null): string {
  if (floatM === null || floatM === undefined || Number.isNaN(floatM)) return 'Unknown';
  if (floatM < 1) return 'Under 1M';
  if (floatM < 6) return '1M–5M';
  if (floatM < 10) return '6M–9M';
  if (floatM < 16) return '10M–15M';
  if (floatM < 20) return '16M–20M';
  if (floatM < 31) return '20M–30M';
  if (floatM < 41) return '31M–40M';
  if (floatM < 51) return '41M–50M';
  if (floatM < 101) return '51M–100M';
  if (floatM < 201) return '101M–200M';
  return '200M+';
}

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trades = await prisma.tradeJournal.findMany({
      where: { userId: session.user.id, isOpen: false, returnPct: { not: null } },
      orderBy: { entryDate: 'desc' },
    });

    if (trades.length === 0) {
      return NextResponse.json({ success: true, reports: null, message: 'No closed trades to analyze' });
    }

    // Overall stats
    const overall = computeBucket('Overall', trades);
    const intradayTrades = trades.filter(t => t.tradeType === 'intraday');
    const swingTrades = trades.filter(t => t.tradeType === 'swing');

    // By strategy
    const stratMap = new Map<string, any[]>();
    for (const t of trades) {
      const key = t.strategy?.trim() || 'No Strategy';
      if (!stratMap.has(key)) stratMap.set(key, []);
      stratMap.get(key)!.push(t);
    }
    const byStrategy = [...stratMap.entries()]
      .map(([k, v]) => computeBucket(k, v))
      .sort((a, b) => b.totalPL - a.totalPL);

    // By time of day (entry time)
    const timeMap = new Map<string, any[]>();
    for (const t of intradayTrades) {
      const key = getHourBucket(t.entryTime);
      if (!timeMap.has(key)) timeMap.set(key, []);
      timeMap.get(key)!.push(t);
    }
    const byTimeOfDay = [...timeMap.entries()]
      .map(([k, v]) => computeBucket(k, v))
      .sort((a, b) => {
        const order = ['9:30-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00', 'Unknown'];
        return order.indexOf(a.label) - order.indexOf(b.label);
      });

    // By price range
    const priceMap = new Map<string, any[]>();
    for (const t of trades) {
      const key = getPriceRange(t.entryPrice);
      if (!priceMap.has(key)) priceMap.set(key, []);
      priceMap.get(key)!.push(t);
    }
    const byPriceRange = [...priceMap.entries()]
      .map(([k, v]) => computeBucket(k, v))
      .sort((a, b) => {
        const order = ['Under $2', '$2-$5', '$5-$10', '$10-$20', '$20-$50', '$50+'];
        return order.indexOf(a.label) - order.indexOf(b.label);
      });

    // By sector
    const sectorMap = new Map<string, any[]>();
    for (const t of trades) {
      const key = (t as any).sector || 'Unknown';
      if (!sectorMap.has(key)) sectorMap.set(key, []);
      sectorMap.get(key)!.push(t);
    }
    const bySector = [...sectorMap.entries()]
      .map(([k, v]) => computeBucket(k, v))
      .sort((a, b) => b.totalPL - a.totalPL);

    // By float range
    const floatMap = new Map<string, any[]>();
    for (const t of trades) {
      const key = getFloatRange((t as any).floatShares);
      if (!floatMap.has(key)) floatMap.set(key, []);
      floatMap.get(key)!.push(t);
    }
    const byFloat = [...floatMap.entries()]
      .map(([k, v]) => computeBucket(k, v))
      .sort((a, b) => {
        const ia = FLOAT_BUCKET_ORDER.indexOf(a.label);
        const ib = FLOAT_BUCKET_ORDER.indexOf(b.label);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });

    // By day of week
    const dowMap = new Map<string, any[]>();
    for (const t of trades) {
      const key = getDayOfWeek(t.entryDate.toISOString());
      if (!dowMap.has(key)) dowMap.set(key, []);
      dowMap.get(key)!.push(t);
    }
    const byDayOfWeek = [...dowMap.entries()]
      .map(([k, v]) => computeBucket(k, v))
      .sort((a, b) => {
        const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        return order.indexOf(a.label) - order.indexOf(b.label);
      });

    // By ticker (top 15)
    const tickerMap = new Map<string, any[]>();
    for (const t of trades) {
      if (!tickerMap.has(t.ticker)) tickerMap.set(t.ticker, []);
      tickerMap.get(t.ticker)!.push(t);
    }
    const byTicker = [...tickerMap.entries()]
      .map(([k, v]) => computeBucket(k, v))
      .sort((a, b) => b.trades - a.trades)
      .slice(0, 15);

    // Cumulative P/L over time (daily)
    const sortedByDate = [...trades].sort(
      (a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );
    let cumPL = 0;
    const cumulativePL = sortedByDate.map(t => {
      cumPL += t.profitLoss ?? 0;
      return {
        date: t.entryDate.toISOString().split('T')[0],
        ticker: t.ticker,
        pnl: Math.round((t.profitLoss ?? 0) * 100) / 100,
        cumulative: Math.round(cumPL * 100) / 100,
      };
    });

    // Enrichment coverage (sector vs float — float was missing in early API saves)
    const withSector = trades.filter(t => (t as any).sector).length;
    const withFloat = trades.filter(t => (t as any).floatShares != null).length;

    return NextResponse.json({
      success: true,
      reports: {
        overall,
        intraday: computeBucket('Intraday', intradayTrades),
        swing: computeBucket('Swing', swingTrades),
        byStrategy,
        byTimeOfDay,
        byPriceRange,
        bySector,
        byFloat,
        byDayOfWeek,
        byTicker,
        cumulativePL,
        enrichmentCoverage: {
          total: trades.length,
          withSector,
          withFloat,
          sectorPercent: trades.length > 0 ? Math.round((withSector / trades.length) * 100) : 0,
          floatPercent: trades.length > 0 ? Math.round((withFloat / trades.length) * 100) : 0,
        },
      },
    });
  } catch (error: any) {
    console.error('[Analytics] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
