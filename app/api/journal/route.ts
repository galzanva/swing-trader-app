/**
 * API Route: Trading Journal
 * POST /api/journal - Add/update trade with auto-calculations and enrichment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { PolygonClient } from '@/lib/data-vendors/polygon';
import { calculateTechnicalIndicators } from '@/lib/indicators/technical';

interface TradeInput {
  id?: string; // If updating existing trade
  ticker: string;
  direction: 'long' | 'short';
  entryPrice: number;
  entryDate: string; // ISO string
  exitPrice?: number;
  exitDate?: string;
  amount: number;
  strategy?: string;
  notes?: string;
  isOpen?: boolean;
}

export async function POST(request: NextRequest) {
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
    const body: TradeInput = await request.json();

    // Validate required fields
    if (!body.ticker || !body.direction || !body.entryPrice || !body.entryDate || !body.amount) {
      return NextResponse.json(
        { error: 'Missing required fields: ticker, direction, entryPrice, entryDate, amount' },
        { status: 400 }
      );
    }

    // Validate direction
    if (body.direction !== 'long' && body.direction !== 'short') {
      return NextResponse.json(
        { error: 'Direction must be "long" or "short"' },
        { status: 400 }
      );
    }

    const ticker = body.ticker.toUpperCase();
    const entryDate = new Date(body.entryDate);
    const exitDate = body.exitDate ? new Date(body.exitDate) : null;
    const isOpen = body.isOpen ?? (exitDate === null);

    console.log(`[Journal] Processing trade: ${ticker} ${body.direction} Entry: ${body.entryPrice} @ ${entryDate.toISOString()}`);

    // 1. Calculate metrics
    let returnPct: number | null = null;
    let profitLoss: number | null = null;
    let holdingDays: number | null = null;
    let rMultiple: number | null = null;

    if (body.exitPrice && exitDate) {
      // Calculate return %
      if (body.direction === 'long') {
        returnPct = ((body.exitPrice - body.entryPrice) / body.entryPrice) * 100;
      } else {
        // Short
        returnPct = ((body.entryPrice - body.exitPrice) / body.entryPrice) * 100;
      }

      // Calculate P/L in dollars
      profitLoss = (returnPct / 100) * body.amount;

      // Calculate holding period
      holdingDays = Math.floor((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`[Journal] Calculated metrics - Return: ${returnPct.toFixed(2)}%, P/L: $${profitLoss.toFixed(2)}, Days: ${holdingDays}`);
    }

    // 2. Enrich with market data
    const polygonApiKey = process.env.POLYGON_API_KEY;
    let entryOHLC: any = null;
    let exitOHLC: any = null;
    let entryEMA9: number | null = null;
    let entryEMA20: number | null = null;
    let entryEMA50: number | null = null;
    let entryRSI: number | null = null;
    let entryATR: number | null = null;
    let exitEMA9: number | null = null;
    let exitEMA20: number | null = null;
    let exitEMA50: number | null = null;
    let exitRSI: number | null = null;
    let exitATR: number | null = null;

    if (polygonApiKey) {
      try {
        const polygonClient = new PolygonClient(polygonApiKey);
        console.log(`[Journal] Fetching market data for ${ticker}...`);

        // Fetch historical data around entry date (need 50+ bars for indicators)
        const marketData = await polygonClient.getAggregates(ticker, '1day', 100);
        
        if (marketData.bars && marketData.bars.length > 0) {
          // Find entry date bar (or closest previous bar)
          const entryTimestamp = entryDate.getTime();
          const entryBarIndex = marketData.bars.findIndex(bar => {
            const barDate = new Date(bar.timestamp).setHours(0, 0, 0, 0);
            const entryDateOnly = new Date(entryTimestamp).setHours(0, 0, 0, 0);
            return barDate >= entryDateOnly;
          });

          if (entryBarIndex >= 0 && entryBarIndex < marketData.bars.length) {
            const entryBar = marketData.bars[entryBarIndex];
            entryOHLC = {
              open: entryBar.open,
              high: entryBar.high,
              low: entryBar.low,
              close: entryBar.close,
              volume: entryBar.volume,
              timestamp: entryBar.timestamp,
            };

            // Calculate indicators up to entry bar
            const barsUpToEntry = marketData.bars.slice(0, entryBarIndex + 1);
            const entryIndicators = calculateTechnicalIndicators(barsUpToEntry);
            
            entryEMA9 = entryIndicators.ema9;
            entryEMA20 = entryIndicators.ema20;
            entryEMA50 = entryIndicators.ema50;
            entryRSI = entryIndicators.rsi;
            entryATR = entryIndicators.atr;

            console.log(`[Journal] Entry indicators - EMA9: ${entryEMA9?.toFixed(2)}, RSI: ${entryRSI?.toFixed(2)}, ATR: ${entryATR?.toFixed(2)}`);
          }

          // Find exit date bar (if closed trade)
          if (exitDate) {
            const exitTimestamp = exitDate.getTime();
            const exitBarIndex = marketData.bars.findIndex(bar => {
              const barDate = new Date(bar.timestamp).setHours(0, 0, 0, 0);
              const exitDateOnly = new Date(exitTimestamp).setHours(0, 0, 0, 0);
              return barDate >= exitDateOnly;
            });

            if (exitBarIndex >= 0 && exitBarIndex < marketData.bars.length) {
              const exitBar = marketData.bars[exitBarIndex];
              exitOHLC = {
                open: exitBar.open,
                high: exitBar.high,
                low: exitBar.low,
                close: exitBar.close,
                volume: exitBar.volume,
                timestamp: exitBar.timestamp,
              };

              // Calculate indicators up to exit bar
              const barsUpToExit = marketData.bars.slice(0, exitBarIndex + 1);
              const exitIndicators = calculateTechnicalIndicators(barsUpToExit);
              
              exitEMA9 = exitIndicators.ema9;
              exitEMA20 = exitIndicators.ema20;
              exitEMA50 = exitIndicators.ema50;
              exitRSI = exitIndicators.rsi;
              exitATR = exitIndicators.atr;

              console.log(`[Journal] Exit indicators - EMA9: ${exitEMA9?.toFixed(2)}, RSI: ${exitRSI?.toFixed(2)}, ATR: ${exitATR?.toFixed(2)}`);
            }
          }
        }
      } catch (error) {
        console.error('[Journal] Error fetching market data:', error);
        // Continue without enrichment
      }
    }

    // 3. Calculate R multiple (if ATR available and not open trade)
    if (entryATR && body.exitPrice && returnPct !== null) {
      // Assume 1.5 ATR as default stop distance
      const stopDistance = 1.5 * entryATR;
      const riskPerShare = stopDistance;
      const riskPercent = (riskPerShare / body.entryPrice) * 100;
      
      if (riskPercent !== 0) {
        rMultiple = returnPct / riskPercent;
        console.log(`[Journal] Calculated R multiple: ${rMultiple.toFixed(2)}R (Return: ${returnPct.toFixed(2)}% / Risk: ${riskPercent.toFixed(2)}%)`);
      }
    }

    // 4. Save to database
    const tradeData = {
      userId,
      ticker,
      direction: body.direction,
      entryPrice: body.entryPrice,
      entryDate,
      exitPrice: body.exitPrice ?? null,
      exitDate: exitDate,
      amount: body.amount,
      strategy: body.strategy ?? null,
      notes: body.notes ?? null,
      isOpen,
      returnPct,
      rMultiple,
      holdingDays,
      profitLoss,
      entryOHLC: entryOHLC ?? null,
      exitOHLC: exitOHLC ?? null,
      entryEMA9,
      entryEMA20,
      entryEMA50,
      entryRSI,
      entryATR,
      exitEMA9,
      exitEMA20,
      exitEMA50,
      exitRSI,
      exitATR,
    };

    let trade;
    if (body.id) {
      // Update existing trade
      trade = await prisma.tradeJournal.update({
        where: { id: body.id, userId }, // Ensure user owns the trade
        data: tradeData,
      });
      console.log(`[Journal] Updated trade: ${trade.id}`);
    } else {
      // Create new trade
      trade = await prisma.tradeJournal.create({
        data: tradeData,
      });
      console.log(`[Journal] Created new trade: ${trade.id}`);
    }

    return NextResponse.json({
      success: true,
      trade,
    });

  } catch (error: any) {
    console.error('[Journal] Error saving trade:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

