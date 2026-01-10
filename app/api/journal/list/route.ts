/**
 * API Route: List Trading Journal Entries
 * GET /api/journal/list - Get all trades for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    
    // Optional filters
    const ticker = searchParams.get('ticker');
    const strategy = searchParams.get('strategy');
    const direction = searchParams.get('direction');
    const isOpen = searchParams.get('isOpen');

    // Build where clause
    const where: any = { userId };
    
    if (ticker) {
      where.ticker = ticker.toUpperCase();
    }
    if (strategy) {
      where.strategy = strategy;
    }
    if (direction === 'long' || direction === 'short') {
      where.direction = direction;
    }
    if (isOpen === 'true') {
      where.isOpen = true;
    } else if (isOpen === 'false') {
      where.isOpen = false;
    }

    console.log(`[Journal List] Fetching trades for user ${userId} with filters:`, where);

    // Fetch trades (user-friendly fields only, no enriched data for list view)
    const trades = await prisma.tradeJournal.findMany({
      where,
      select: {
        id: true,
        ticker: true,
        direction: true,
        entryPrice: true,
        entryDate: true,
        exitPrice: true,
        exitDate: true,
        amount: true,
        strategy: true,
        notes: true,
        isOpen: true,
        exitReason: true,
        returnPct: true,
        rMultiple: true,
        holdingDays: true,
        profitLoss: true,
        analysisReportId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        entryDate: 'desc', // Most recent trades first
      },
    });

    console.log(`[Journal List] Found ${trades.length} trades`);

    // Calculate summary statistics
    const closedTrades = trades.filter(t => !t.isOpen && t.returnPct !== null);
    const openTrades = trades.filter(t => t.isOpen);
    
    const totalTrades = trades.length;
    const totalClosed = closedTrades.length;
    const totalOpen = openTrades.length;
    
    const winningTrades = closedTrades.filter(t => (t.returnPct ?? 0) > 0).length;
    const losingTrades = closedTrades.filter(t => (t.returnPct ?? 0) < 0).length;
    const breakEvenTrades = closedTrades.filter(t => (t.returnPct ?? 0) === 0).length;
    
    const winRate = totalClosed > 0 ? (winningTrades / totalClosed) * 100 : 0;
    
    const totalPL = closedTrades.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0);
    const avgPL = totalClosed > 0 ? totalPL / totalClosed : 0;
    
    const avgReturn = totalClosed > 0 
      ? closedTrades.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / totalClosed 
      : 0;
    
    const avgRMultiple = closedTrades.filter(t => t.rMultiple !== null).length > 0
      ? closedTrades.filter(t => t.rMultiple !== null).reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / closedTrades.filter(t => t.rMultiple !== null).length
      : null;
    
    const avgHoldingDays = closedTrades.filter(t => t.holdingDays !== null).length > 0
      ? closedTrades.filter(t => t.holdingDays !== null).reduce((sum, t) => sum + (t.holdingDays ?? 0), 0) / closedTrades.filter(t => t.holdingDays !== null).length
      : null;

    const summary = {
      totalTrades,
      totalClosed,
      totalOpen,
      winningTrades,
      losingTrades,
      breakEvenTrades,
      winRate: parseFloat(winRate.toFixed(2)),
      totalPL: parseFloat(totalPL.toFixed(2)),
      avgPL: parseFloat(avgPL.toFixed(2)),
      avgReturn: parseFloat(avgReturn.toFixed(2)),
      avgRMultiple: avgRMultiple !== null ? parseFloat(avgRMultiple.toFixed(2)) : null,
      avgHoldingDays: avgHoldingDays !== null ? parseFloat(avgHoldingDays.toFixed(1)) : null,
    };

    return NextResponse.json({
      success: true,
      trades,
      summary,
    });

  } catch (error: any) {
    console.error('[Journal List] Error fetching trades:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

