/**
 * API endpoint to fetch open trades with current P&L
 * Fetches real-time market prices and calculates unrealized gains/losses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { PolygonClient } from '@/lib/data-vendors/polygon';

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

interface OpenTradeWithPL {
  id: string;
  ticker: string;
  direction: 'long' | 'short';
  entryPrice: number;
  entryDate: string;
  amount: number;
  strategy: string | null;
  notes: string | null;
  currentPrice: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  daysHeld: number;
  isStale: boolean; // true if price data is old
  priceSource: string; // 'last_trade', 'today_close', 'prev_close', etc.
  todaysChange?: number;
  todaysChangePercent?: number;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!POLYGON_API_KEY) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Fetch open trades for the user
    const openTrades = await prisma.tradeJournal.findMany({
      where: {
        userId: session.user.id,
        isOpen: true
      },
      orderBy: {
        entryDate: 'desc'
      }
    });

    if (openTrades.length === 0) {
      return NextResponse.json({
        success: true,
        trades: [],
        summary: {
          totalOpenTrades: 0,
          totalInvested: 0,
          totalUnrealizedPL: 0,
          totalUnrealizedPLPercent: 0
        }
      });
    }

    // Get unique tickers from open trades
    const uniqueTickers = [...new Set(openTrades.map((t: any) => t.ticker))];
    console.log(`[Dashboard] Fetching real-time prices for ${uniqueTickers.length} tickers: ${uniqueTickers.join(', ')}`);

    // Use batch API call for better performance and freshest data
    const polygon = new PolygonClient(POLYGON_API_KEY);
    const priceSnapshots = await polygon.getMultipleTickerSnapshots(uniqueTickers);
    
    console.log(`[Dashboard] Received ${priceSnapshots.size} price snapshots`);

    // Map trades with current prices
    const tradesWithPL: OpenTradeWithPL[] = openTrades.map((trade: any) => {
      const snapshot = priceSnapshots.get(trade.ticker);
      const currentPrice = snapshot?.price || 0;
      const isStale = snapshot?.isStale ?? true; // Use ?? to preserve false values
      const priceSource = snapshot?.source || 'error';
      
      // Calculate unrealized P&L
      let unrealizedPL = 0;
      let unrealizedPLPercent = 0;
      
      if (currentPrice > 0) {
        if (trade.direction === 'long') {
          unrealizedPLPercent = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
          unrealizedPL = (currentPrice - trade.entryPrice) / trade.entryPrice * trade.amount;
        } else {
          // Short position
          unrealizedPLPercent = ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;
          unrealizedPL = (trade.entryPrice - currentPrice) / trade.entryPrice * trade.amount;
        }
      }

      const entryDate = new Date(trade.entryDate);
      const nowUtc = new Date();
      const todayUtc = Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate());
      const entryUtc = Date.UTC(entryDate.getUTCFullYear(), entryDate.getUTCMonth(), entryDate.getUTCDate());
      const daysHeld = Math.floor((todayUtc - entryUtc) / (1000 * 60 * 60 * 24));

      return {
        id: trade.id,
        ticker: trade.ticker,
        direction: trade.direction as 'long' | 'short',
        entryPrice: trade.entryPrice,
        entryDate: trade.entryDate.toISOString(),
        amount: trade.amount,
        strategy: trade.strategy,
        notes: trade.notes,
        currentPrice,
        unrealizedPL,
        unrealizedPLPercent,
        daysHeld,
        isStale,
        priceSource,
        todaysChange: snapshot?.change,
        todaysChangePercent: snapshot?.changePercent,
      };
    });

    // Calculate summary
    const totalInvested = openTrades.reduce((sum: number, trade: any) => sum + trade.amount, 0);
    const totalUnrealizedPL = tradesWithPL.reduce((sum: number, trade: OpenTradeWithPL) => sum + trade.unrealizedPL, 0);
    const totalUnrealizedPLPercent = totalInvested > 0 
      ? (totalUnrealizedPL / totalInvested) * 100 
      : 0;

    console.log(`[Dashboard] Fetched ${tradesWithPL.length} open trades with real-time prices`);

    // Return with cache-control headers to ensure fresh data
    return NextResponse.json({
      success: true,
      trades: tradesWithPL,
      summary: {
        totalOpenTrades: tradesWithPL.length,
        totalInvested,
        totalUnrealizedPL,
        totalUnrealizedPLPercent
      },
      timestamp: new Date().toISOString(), // Include timestamp to verify freshness
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error: any) {
    console.error('[Dashboard] Error fetching open trades:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

