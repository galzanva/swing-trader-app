/**
 * GET /api/journal/calendar?month=2026-06&broker=all
 * Returns daily aggregated trade stats for a given month,
 * plus overflow days from adjacent months that complete the calendar weeks.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { journalStoredYmd } from '@/lib/trade-dates';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const brokerParam = searchParams.get('broker');

    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 });
    }

    const [year, month] = monthParam.split('-').map(Number);

    // Calculate the full calendar range including overflow days
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const startDow = firstOfMonth.getUTCDay(); // 0=Sun
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastOfMonth = new Date(Date.UTC(year, month - 1, daysInMonth));
    const endDow = lastOfMonth.getUTCDay();

    // Extend range: go back to Sunday of first week, forward to Saturday of last week
    const rangeStart = new Date(Date.UTC(year, month - 1, 1 - startDow));
    const rangeEnd = new Date(Date.UTC(year, month - 1, daysInMonth + (6 - endDow), 23, 59, 59, 999));

    const where: any = {
      userId: session.user.id,
      isOpen: false,
      returnPct: { not: null },
      entryDate: { gte: rangeStart, lte: rangeEnd },
    };

    if (brokerParam && brokerParam !== 'all') {
      where.broker = brokerParam;
    }

    const trades = await prisma.tradeJournal.findMany({
      where,
      select: {
        entryDate: true,
        profitLoss: true,
        returnPct: true,
      },
      orderBy: { entryDate: 'asc' },
    });

    // Aggregate by day
    const dayMap = new Map<string, { pnl: number; trades: number; wins: number; losses: number }>();

    for (const t of trades) {
      const day = journalStoredYmd(t.entryDate);
      if (!dayMap.has(day)) {
        dayMap.set(day, { pnl: 0, trades: 0, wins: 0, losses: 0 });
      }
      const d = dayMap.get(day)!;
      d.pnl += t.profitLoss ?? 0;
      d.trades++;
      if ((t.profitLoss ?? 0) > 0) d.wins++;
      else if ((t.profitLoss ?? 0) < 0) d.losses++;
    }

    const days = [...dayMap.entries()].map(([date, stats]) => ({
      date,
      pnl: Math.round(stats.pnl * 100) / 100,
      trades: stats.trades,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.trades > 0 ? Math.round((stats.wins / stats.trades) * 100) : 0,
    }));

    // Summary only for days within the actual month
    const monthDays = days.filter(d => d.date.startsWith(monthParam));
    const totalPL = monthDays.reduce((s, d) => s + d.pnl, 0);
    const totalTrades = monthDays.reduce((s, d) => s + d.trades, 0);
    const tradingDays = monthDays.length;

    return NextResponse.json({
      success: true,
      month: monthParam,
      days,
      summary: {
        totalPL: Math.round(totalPL * 100) / 100,
        totalTrades,
        tradingDays,
        greenDays: monthDays.filter(d => d.pnl > 0).length,
        redDays: monthDays.filter(d => d.pnl < 0).length,
      },
    });
  } catch (error: any) {
    console.error('[Calendar] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
