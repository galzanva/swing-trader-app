/**
 * API endpoint to fetch open trades with current P&L
 * Fetches current market prices and calculates unrealized gains/losses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const BASE_URL = 'https://api.polygon.io';

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
}

async function getCurrentPrice(ticker: string): Promise<{ price: number; isStale: boolean; source: string }> {
  try {
    // Use snapshot endpoint to get most recent trade (includes pre/post market with 15-min delay)
    // This gives us the last trade price which is the most current price available
    const url = `${BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`[Dashboard] Could not fetch price for ${ticker}: ${response.status}`);
      return { price: 0, isStale: true, source: 'error' };
    }

    const data = await response.json();
    
    if (!data.ticker) {
      console.warn(`[Dashboard] No snapshot data for ${ticker}`);
      return { price: 0, isStale: true, source: 'error' };
    }

    const snapshot = data.ticker;
    
    // Priority: lastTrade (most recent) > day.c (today's close) > prevDay.c (yesterday's close)
    let price = 0;
    let timestamp = 0;
    let source = 'unknown';
    
    // Try to get the most recent trade price (includes pre/post market)
    if (snapshot.lastTrade && snapshot.lastTrade.p) {
      price = snapshot.lastTrade.p;
      timestamp = snapshot.lastTrade.t || snapshot.updated || Date.now();
      source = 'last_trade'; // Most recent trade (could be pre/post market)
      console.log(`[Dashboard] ${ticker}: Using last trade price $${price.toFixed(2)} from ${new Date(timestamp).toLocaleString()}`);
    } 
    // Fall back to today's close if available
    else if (snapshot.day && snapshot.day.c) {
      price = snapshot.day.c;
      timestamp = snapshot.day.t || snapshot.updated || Date.now();
      source = 'today_close';
      console.log(`[Dashboard] ${ticker}: Using today's close $${price.toFixed(2)}`);
    } 
    // Last resort: previous day's close
    else if (snapshot.prevDay && snapshot.prevDay.c) {
      price = snapshot.prevDay.c;
      timestamp = snapshot.prevDay.t || snapshot.updated || Date.now();
      source = 'prev_close';
      console.log(`[Dashboard] ${ticker}: Using previous close $${price.toFixed(2)}`);
    }
    
    if (price === 0) {
      console.warn(`[Dashboard] No valid price data for ${ticker}`);
      return { price: 0, isStale: true, source: 'none' };
    }
    
    // Check if data is stale (more than 2 days old)
    const dataAge = Date.now() - timestamp;
    const isStale = dataAge > 2 * 24 * 60 * 60 * 1000; // 2 days
    
    if (isStale) {
      console.warn(`[Dashboard] ${ticker}: Price is ${Math.floor(dataAge / (1000 * 60 * 60))} hours old`);
    }
    
    return { price, isStale, source };
  } catch (error) {
    console.error(`[Dashboard] Error fetching price for ${ticker}:`, error);
    return { price: 0, isStale: true, source: 'error' };
  }
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

    // Fetch current prices for all open positions
    const tradesWithPL: OpenTradeWithPL[] = await Promise.all(
      openTrades.map(async (trade: any) => {
        const { price: currentPrice, isStale, source: priceSource } = await getCurrentPrice(trade.ticker);
        
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

        // Calculate days held
        const entryDate = new Date(trade.entryDate);
        const today = new Date();
        const daysHeld = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

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
          priceSource
        };
      })
    );

    // Calculate summary
    const totalInvested = openTrades.reduce((sum: number, trade: any) => sum + trade.amount, 0);
    const totalUnrealizedPL = tradesWithPL.reduce((sum: number, trade: OpenTradeWithPL) => sum + trade.unrealizedPL, 0);
    const totalUnrealizedPLPercent = totalInvested > 0 
      ? (totalUnrealizedPL / totalInvested) * 100 
      : 0;

    console.log(`[Dashboard] Fetched ${tradesWithPL.length} open trades with current prices`);

    return NextResponse.json({
      success: true,
      trades: tradesWithPL,
      summary: {
        totalOpenTrades: tradesWithPL.length,
        totalInvested,
        totalUnrealizedPL,
        totalUnrealizedPLPercent
      }
    });

  } catch (error: any) {
    console.error('[Dashboard] Error fetching open trades:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

