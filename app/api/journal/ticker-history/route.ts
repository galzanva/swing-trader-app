/**
 * API Route: Ticker History & Wash Sale Tracker
 * GET /api/journal/ticker-history - Get per-ticker performance stats and wash sale info
 *
 * Query params:
 *   ?ticker=AAPL  — optional filter to a single ticker
 *   ?page=1&limit=15 — optional server-side pagination (summary still reflects all tickers)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

const WASH_SALE_DAYS = 30;

interface TickerStats {
  ticker: string;
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPL: number;
  avgReturn: number;
  avgRMultiple: number | null;
  firstTradeDate: string;
  lastTradeDate: string;
  lastExitDate: string | null;
  daysSinceLastTrade: number;
  washSaleWarning: boolean;
  washSaleDetails: {
    inWashSalePeriod: boolean;
    daysRemaining: number;
    lastLossDate: string | null;
    lastLossAmount: number | null;
    totalLossesInWindow: number;
  };
  trades: {
    id: string;
    direction: string;
    tradeType: string;
    entryPrice: number;
    entryDate: string;
    exitPrice: number | null;
    exitDate: string | null;
    returnPct: number | null;
    profitLoss: number | null;
    strategy: string | null;
    isOpen: boolean;
  }[];
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const tickerFilter = searchParams.get('ticker')?.toUpperCase();

    const where: any = { userId };
    if (tickerFilter) where.ticker = tickerFilter;

    const trades = await prisma.tradeJournal.findMany({
      where,
      select: {
        id: true,
        ticker: true,
        direction: true,
        tradeType: true,
        entryPrice: true,
        entryDate: true,
        exitPrice: true,
        exitDate: true,
        returnPct: true,
        profitLoss: true,
        rMultiple: true,
        holdingDays: true,
        strategy: true,
        isOpen: true,
        notes: true,
      },
      orderBy: { entryDate: 'desc' },
    });

    // Group by ticker
    const tickerMap = new Map<string, typeof trades>();
    for (const trade of trades) {
      const arr = tickerMap.get(trade.ticker) || [];
      arr.push(trade);
      tickerMap.set(trade.ticker, arr);
    }

    const now = new Date();
    const tickerStats: TickerStats[] = [];

    for (const [ticker, tickerTrades] of tickerMap.entries()) {
      const closed = tickerTrades.filter(t => !t.isOpen && t.returnPct !== null);
      const open = tickerTrades.filter(t => t.isOpen);
      const wins = closed.filter(t => (t.returnPct ?? 0) > 0).length;
      const losses = closed.filter(t => (t.returnPct ?? 0) < 0).length;
      const totalPL = closed.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0);
      const avgReturn = closed.length > 0
        ? closed.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / closed.length : 0;
      const rTrades = closed.filter(t => t.rMultiple !== null);
      const avgRMultiple = rTrades.length > 0
        ? rTrades.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / rTrades.length : null;

      const sortedByEntry = [...tickerTrades].sort((a, b) =>
        new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
      );

      const firstTradeDate = sortedByEntry[0].entryDate;
      const lastTradeDate = sortedByEntry[sortedByEntry.length - 1].entryDate;

      // Find last exit date
      const exitDates = closed
        .filter(t => t.exitDate)
        .map(t => new Date(t.exitDate!))
        .sort((a, b) => b.getTime() - a.getTime());
      const lastExitDate = exitDates.length > 0 ? exitDates[0] : null;

      const daysSinceLastTrade = lastExitDate
        ? Math.floor((now.getTime() - lastExitDate.getTime()) / (1000 * 60 * 60 * 24))
        : Math.floor((now.getTime() - new Date(lastTradeDate).getTime()) / (1000 * 60 * 60 * 24));

      // Wash sale analysis
      const losingTrades = closed.filter(t => (t.profitLoss ?? 0) < 0 && t.exitDate);
      const recentLosses = losingTrades.filter(t => {
        const exitD = new Date(t.exitDate!);
        const daysSince = Math.floor((now.getTime() - exitD.getTime()) / (1000 * 60 * 60 * 24));
        return daysSince <= WASH_SALE_DAYS;
      });

      let lastLossDate: string | null = null;
      let lastLossAmount: number | null = null;
      let daysRemaining = 0;

      if (recentLosses.length > 0) {
        const sorted = [...recentLosses].sort((a, b) =>
          new Date(b.exitDate!).getTime() - new Date(a.exitDate!).getTime()
        );
        const lastExit = sorted[0].exitDate as Date;
        lastLossDate = lastExit.toISOString();
        lastLossAmount = sorted[0].profitLoss;
        const daysSinceLoss = Math.floor((now.getTime() - lastExit.getTime()) / (1000 * 60 * 60 * 24));
        daysRemaining = Math.max(0, WASH_SALE_DAYS - daysSinceLoss);
      }

      const totalLossesInWindow = recentLosses.reduce((sum, t) => sum + Math.abs(t.profitLoss ?? 0), 0);
      const inWashSalePeriod = recentLosses.length > 0 && daysRemaining > 0;

      tickerStats.push({
        ticker,
        totalTrades: tickerTrades.length,
        closedTrades: closed.length,
        openTrades: open.length,
        wins,
        losses,
        winRate: closed.length > 0 ? parseFloat(((wins / closed.length) * 100).toFixed(1)) : 0,
        totalPL: parseFloat(totalPL.toFixed(2)),
        avgReturn: parseFloat(avgReturn.toFixed(2)),
        avgRMultiple: avgRMultiple !== null ? parseFloat(avgRMultiple.toFixed(2)) : null,
        firstTradeDate: new Date(firstTradeDate).toISOString(),
        lastTradeDate: new Date(lastTradeDate).toISOString(),
        lastExitDate: lastExitDate ? lastExitDate.toISOString() : null,
        daysSinceLastTrade,
        washSaleWarning: inWashSalePeriod,
        washSaleDetails: {
          inWashSalePeriod,
          daysRemaining,
          lastLossDate,
          lastLossAmount: lastLossAmount !== null ? parseFloat(lastLossAmount.toFixed(2)) : null,
          totalLossesInWindow: parseFloat(totalLossesInWindow.toFixed(2)),
        },
        trades: tickerTrades.map(t => ({
          id: t.id,
          direction: t.direction,
          tradeType: t.tradeType ?? 'swing',
          entryPrice: t.entryPrice,
          entryDate: new Date(t.entryDate).toISOString(),
          exitPrice: t.exitPrice,
          exitDate: t.exitDate ? new Date(t.exitDate).toISOString() : null,
          returnPct: t.returnPct,
          profitLoss: t.profitLoss,
          strategy: t.strategy,
          isOpen: t.isOpen,
        })),
      });
    }

    // Sort by most recent trade first
    tickerStats.sort((a, b) => new Date(b.lastTradeDate).getTime() - new Date(a.lastTradeDate).getTime());

    const summary = {
      totalTickers: tickerStats.length,
      tickersWithWashSaleWarning: tickerStats.filter(t => t.washSaleWarning).length,
      totalPL: parseFloat(tickerStats.reduce((sum, t) => sum + t.totalPL, 0).toFixed(2)),
    };

    // Optional server-side pagination (same shape as /api/reports)
    const limitRaw = searchParams.get('limit');
    const pageRaw = searchParams.get('page');
    const limit =
      limitRaw != null && limitRaw !== ''
        ? Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 20))
        : null;
    const requestedPage = Math.max(1, parseInt(pageRaw || '1', 10) || 1);

    let tickersOut = tickerStats;
    let pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    } | undefined;

    if (limit != null) {
      const total = tickerStats.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const page = Math.min(requestedPage, totalPages);
      tickersOut = tickerStats.slice((page - 1) * limit, page * limit);
      pagination = {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      };
    }

    return NextResponse.json({
      success: true,
      tickers: tickersOut,
      summary,
      ...(pagination ? { pagination } : {}),
    });
  } catch (error: any) {
    console.error('[Ticker History] Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
