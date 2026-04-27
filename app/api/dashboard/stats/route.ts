/**
 * GET /api/dashboard/stats — Dashboard data with date range filtering.
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
 *
 * Journal entryDate / exitDate are stored as UTC midnight on the intended calendar date.
 * All bucketing and date keys use `journalStoredYmd` (UTC YYYY-MM-DD) so they match
 * the client-side week calendar and date filters.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { journalStoredYmd } from '@/lib/trade-dates';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const dateFilter: any = {};
    if (fromParam) dateFilter.gte = new Date(fromParam + 'T00:00:00.000Z');
    if (toParam) dateFilter.lte = new Date(toParam + 'T23:59:59.999Z');

    const hasDateFilter = fromParam || toParam;

    const closedWhere: any = {
      userId,
      isOpen: false,
      returnPct: { not: null },
      ...(hasDateFilter ? { entryDate: dateFilter } : {}),
    };

    const allWhere: any = {
      userId,
      ...(hasDateFilter ? { entryDate: dateFilter } : {}),
    };

    const [closedTrades, recentTrades] = await Promise.all([
      prisma.tradeJournal.findMany({
        where: closedWhere,
        orderBy: { entryDate: 'desc' },
        select: {
          id: true, ticker: true, direction: true, tradeType: true,
          entryDate: true, exitDate: true, entryTime: true, exitTime: true,
          entryPrice: true, exitPrice: true,
          isOpen: true, returnPct: true, profitLoss: true, strategy: true,
        },
      }),
      prisma.tradeJournal.findMany({
        where: allWhere,
        orderBy: [{ exitDate: { sort: 'desc', nulls: 'last' } }, { entryDate: 'desc' }],
        take: 5,
        select: {
          id: true, ticker: true, direction: true, tradeType: true,
          entryDate: true, exitDate: true, exitTime: true,
          isOpen: true, returnPct: true, profitLoss: true,
        },
      }),
    ]);

    const totalTrades = closedTrades.length;
    const wins = closedTrades.filter(t => (t.profitLoss ?? 0) > 0);
    const losses = closedTrades.filter(t => (t.profitLoss ?? 0) < 0);
    const winRate = totalTrades > 0 ? Math.round((wins.length / totalTrades) * 100) : 0;
    const totalPL = closedTrades.reduce((s, t) => s + (t.profitLoss ?? 0), 0);
    const avgReturn = totalTrades > 0
      ? closedTrades.reduce((s, t) => s + (t.returnPct ?? 0), 0) / totalTrades
      : 0;
    const avgPL = totalTrades > 0 ? totalPL / totalTrades : 0;

    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.profitLoss ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.profitLoss ?? 0), 0) / losses.length : 0;

    const sortedByPL = [...closedTrades].sort((a, b) => (b.profitLoss ?? 0) - (a.profitLoss ?? 0));
    const largestWin = sortedByPL.length > 0 ? sortedByPL[0] : null;
    const largestLoss = sortedByPL.length > 0 ? sortedByPL[sortedByPL.length - 1] : null;

    // Daily breakdown for calendar view — use journalStoredYmd (UTC YYYY-MM-DD)
    const dailyMap = new Map<string, { pnl: number; trades: number }>();
    for (const t of closedTrades) {
      const day = journalStoredYmd(t.entryDate);
      const existing = dailyMap.get(day) || { pnl: 0, trades: 0 };
      existing.pnl += t.profitLoss ?? 0;
      existing.trades += 1;
      dailyMap.set(day, existing);
    }
    const dailyBreakdown = [...dailyMap.entries()]
      .map(([date, d]) => ({ date, pnl: Math.round(d.pnl * 100) / 100, trades: d.trades }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      stats: {
        totalTrades,
        winRate,
        totalPL: Math.round(totalPL * 100) / 100,
        avgReturn: Math.round(avgReturn * 100) / 100,
        avgPL: Math.round(avgPL * 100) / 100,
        wins: wins.length,
        losses: losses.length,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        largestWin: largestWin ? {
          ticker: largestWin.ticker,
          pnl: Math.round((largestWin.profitLoss ?? 0) * 100) / 100,
          returnPct: Math.round((largestWin.returnPct ?? 0) * 100) / 100,
          date: journalStoredYmd(largestWin.entryDate),
        } : null,
        largestLoss: largestLoss && (largestLoss.profitLoss ?? 0) < 0 ? {
          ticker: largestLoss.ticker,
          pnl: Math.round((largestLoss.profitLoss ?? 0) * 100) / 100,
          returnPct: Math.round((largestLoss.returnPct ?? 0) * 100) / 100,
          date: journalStoredYmd(largestLoss.entryDate),
        } : null,
      },
      dailyBreakdown,
      recentTrades: recentTrades.map(t => ({
        id: t.id,
        ticker: t.ticker,
        direction: t.direction,
        tradeType: t.tradeType,
        entryDate: t.entryDate.toISOString(),
        exitDate: t.exitDate?.toISOString() || null,
        exitTime: t.exitTime || null,
        isOpen: t.isOpen,
        returnPct: t.returnPct,
        profitLoss: t.profitLoss,
      })),
    });
  } catch (error: any) {
    console.error('[Dashboard] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
