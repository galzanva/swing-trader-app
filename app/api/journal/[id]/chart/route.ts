import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { PolygonClient } from '@/lib/data-vendors/polygon';
import {
  CHART_TIMEFRAMES,
  chartRange,
  futuresRoot,
  polygonCandidates,
  polygonTf,
  tradeMarks,
  type ChartTimeframe,
} from '@/lib/journal-chart';

const YAHOO_INTERVAL: Record<ChartTimeframe, string> = {
  '1min': '1m',
  '5min': '5m',
  '15min': '15m',
  '1hour': '60m',
  '1day': '1d',
};

const YAHOO_FUTURES: Record<string, string> = {
  MNQ: 'MNQ=F',
  NQ: 'NQ=F',
  MES: 'MES=F',
  ES: 'ES=F',
  MYM: 'MYM=F',
  YM: 'YM=F',
  M2K: 'M2K=F',
  RTY: 'RTY=F',
};

async function yahooFallback(
  ticker: string,
  tf: ChartTimeframe,
  fromYmd: string,
  toYmd: string,
): Promise<{
  bars: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[];
  symbol: string;
  note: string;
} | null> {
  const root = futuresRoot(ticker);
  const symbol = (root && YAHOO_FUTURES[root]) || ticker.toUpperCase();
  const period1 = Math.floor(new Date(`${fromYmd}T00:00:00Z`).getTime() / 1000);
  const period2 = Math.floor(new Date(`${toYmd}T23:59:59Z`).getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${YAHOO_INTERVAL[tf]}&period1=${period1}&period2=${period2}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const ts: number[] = result?.timestamp || [];
    const q = result?.indicators?.quote?.[0];
    if (!ts.length || !q) return null;
    const bars = ts.map((t, i) => ({
      timestamp: t * 1000,
      open: q.open?.[i],
      high: q.high?.[i],
      low: q.low?.[i],
      close: q.close?.[i],
      volume: q.volume?.[i] ?? 0,
    })).filter((b: any) => [b.open, b.high, b.low, b.close].every((n: number) => Number.isFinite(n)));
    if (!bars.length) return null;
    return {
      bars,
      symbol,
      note: `Delayed ${symbol} candles (Yahoo) — used because Polygon had no bars for ${ticker}.`,
    };
  } catch {
    return null;
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const tfRaw = request.nextUrl.searchParams.get('tf') || '';
    const tf = (CHART_TIMEFRAMES as readonly string[]).includes(tfRaw)
      ? (tfRaw as ChartTimeframe)
      : null;
    if (!tf) {
      return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 });
    }

    const trade = await prisma.tradeJournal.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'POLYGON_API_KEY is not configured' }, { status: 503 });
    }

    const { from, to } = chartRange(trade.entryDate, trade.exitDate, tf);
    const { multiplier, timespan } = polygonTf(tf);
    const client = new PolygonClient(apiKey);

    let bars: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[] = [];
    let usedSymbol = trade.ticker;
    let note: string | null = null;
    let lastError = 'No market data';

    const root = futuresRoot(trade.ticker);
    if (root && YAHOO_FUTURES[root]) {
      const yahooFirst = await yahooFallback(trade.ticker, tf, from, to);
      if (yahooFirst) {
        bars = yahooFirst.bars;
        usedSymbol = yahooFirst.symbol;
        note = `Delayed ${yahooFirst.symbol} continuous futures — same price scale as your ${trade.ticker} fills.`;
      }
    }

    if (!bars.length) {
      for (const candidate of polygonCandidates(trade.ticker)) {
        try {
          bars = await client.getAggregatesRange(candidate.symbol, multiplier, timespan, from, to);
          usedSymbol = candidate.symbol;
          note = candidate.note;
          break;
        } catch (err: any) {
          lastError = err?.message || lastError;
        }
      }
    }

    if (!bars.length) {
      const yahoo = await yahooFallback(trade.ticker, tf, from, to);
      if (yahoo) {
        bars = yahoo.bars;
        usedSymbol = yahoo.symbol;
        note = yahoo.note;
      }
    }

    if (!bars.length) {
      return NextResponse.json({ error: lastError }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      delayed: true,
      timeframe: tf,
      symbol: usedSymbol,
      ticker: trade.ticker,
      note,
      from,
      to,
      bars,
      marks: tradeMarks(trade),
      trade: {
        id: trade.id,
        ticker: trade.ticker,
        direction: trade.direction,
        tradeType: trade.tradeType,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        entryDate: trade.entryDate,
        exitDate: trade.exitDate,
        entryTime: trade.entryTime,
        exitTime: trade.exitTime,
        profitLoss: trade.profitLoss,
        isOpen: trade.isOpen,
        strategy: trade.strategy,
        exitReason: trade.exitReason,
        holdingDays: trade.holdingDays,
      },
    });
  } catch (error: any) {
    console.error('[Journal chart]', error);
    return NextResponse.json({ error: error.message || 'Chart failed' }, { status: 500 });
  }
}
