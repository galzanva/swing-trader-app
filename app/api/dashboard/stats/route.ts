/**
 * API endpoint to fetch dashboard statistics
 * - Recent activity (saved reports, trades)
 * - Performance metrics
 * - Strategy usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch various stats in parallel
    const [
      recentReports,
      totalReports,
      totalTrades,
      recentTrades,
      totalStrategies,
      tradeStats
    ] = await Promise.all([
      // Recent saved reports
      prisma.savedReport.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          type: true,
          createdAt: true,
          parameters: true
        }
      }),
      
      // Total reports count
      prisma.savedReport.count({
        where: { userId }
      }),
      
      // Total trades count
      prisma.tradeJournal.count({
        where: { userId }
      }),
      
      // Recent trades
      prisma.tradeJournal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          ticker: true,
          direction: true,
          entryDate: true,
          isOpen: true,
          returnPct: true,
          profitLoss: true
        }
      }),
      
      // Total strategies count
      prisma.userStrategy.count({
        where: { userId, isActive: true }
      }),
      
      // Trade performance stats
      prisma.tradeJournal.aggregate({
        where: {
          userId,
          isOpen: false,
          returnPct: { not: null }
        },
        _avg: {
          returnPct: true,
          profitLoss: true
        },
        _sum: {
          profitLoss: true
        }
      })
    ]);

    // Calculate win rate
    const closedTrades = await prisma.tradeJournal.findMany({
      where: {
        userId,
        isOpen: false,
        returnPct: { not: null }
      },
      select: {
        returnPct: true
      }
    });

    const winningTrades = closedTrades.filter((t: any) => (t.returnPct || 0) > 0).length;
    const winRate = closedTrades.length > 0 
      ? (winningTrades / closedTrades.length) * 100 
      : 0;

    // Get today's date for activity tracking
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayActivity = await prisma.savedReport.count({
      where: {
        userId,
        createdAt: { gte: today }
      }
    });

    console.log(`[Dashboard] Fetched stats for user ${userId}`);

    return NextResponse.json({
      success: true,
      stats: {
        totalReports,
        totalTrades,
        totalStrategies,
        winRate: Math.round(winRate),
        avgReturn: tradeStats._avg.returnPct?.toFixed(2) || '0.00',
        avgPL: tradeStats._avg.profitLoss?.toFixed(2) || '0.00',
        totalPL: tradeStats._sum.profitLoss?.toFixed(2) || '0.00',
        todayActivity
      },
      recentReports: recentReports.map((r: any) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        createdAt: r.createdAt.toISOString(),
        symbol: (r.parameters as any)?.symbol || 'N/A'
      })),
      recentTrades: recentTrades.map((t: any) => ({
        id: t.id,
        ticker: t.ticker,
        direction: t.direction,
        entryDate: t.entryDate.toISOString(),
        isOpen: t.isOpen,
        returnPct: t.returnPct,
        profitLoss: t.profitLoss
      }))
    });

  } catch (error: any) {
    console.error('[Dashboard] Error fetching stats:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

