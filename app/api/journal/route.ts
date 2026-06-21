/**
 * API Route: Trading Journal
 * POST /api/journal - Add/update trade with auto-calculations and enrichment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { PolygonClient } from '@/lib/data-vendors/polygon';
import {
  computeJournalPolygonPatchFromBars,
  fetchUnadjustedDailyBars,
} from '@/lib/journal-polygon-enrichment';

interface TradeInput {
  id?: string;
  ticker: string;
  direction: 'long' | 'short';
  tradeType?: 'swing' | 'intraday';
  entryPrice: number;
  entryDate: string;
  exitPrice?: number;
  exitDate?: string;
  entryTime?: string;
  exitTime?: string;
  amount: number;
  strategy?: string;
  analysisReportId?: string;
  notes?: string;
  isOpen?: boolean;
  exitReason?: 'hit_target' | 'stopped_out' | 'manual_exit' | 'time_exit';
  broker?: string;
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
    
    // Parse dates without timezone conversion (keep as date-only, no time component)
    // This prevents dates from shifting due to timezone offsets
    const entryDate = new Date(body.entryDate + 'T00:00:00.000Z');
    const exitDate = body.exitDate ? new Date(body.exitDate + 'T00:00:00.000Z') : null;
    const isOpen = body.isOpen ?? (exitDate === null);

    console.log(`[Journal] Processing trade: ${ticker} ${body.direction} Entry: ${body.entryPrice} @ ${entryDate.toISOString()}`);

    // 1. Link to analysis report (manual selection takes priority, otherwise auto-link)
    let analysisReportId: string | null = body.analysisReportId || null;
    
    // If no manual link provided, try to auto-link to recent analysis report (within ±3 days of entry)
    if (!analysisReportId) {
      try {
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        const entryTime = entryDate.getTime();
        const windowStart = new Date(entryTime - threeDaysMs);
        const windowEnd = new Date(entryTime + threeDaysMs);
        
        const recentReport = await prisma.savedReport.findFirst({
          where: {
            userId,
            createdAt: {
              gte: windowStart,
              lte: windowEnd,
            },
            // Check if ticker matches in parameters
            parameters: {
              path: ['symbol'],
              equals: ticker,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        
        if (recentReport) {
          analysisReportId = recentReport.id;
          console.log(`[Journal] Auto-linked to analysis report: ${analysisReportId}`);
        }
      } catch (error) {
        console.error('[Journal] Error linking to analysis report:', error);
        // Continue without linking
      }
    } else {
      console.log(`[Journal] Manually linked to analysis report: ${analysisReportId}`);
    }

    // 2. Calculate metrics
    let returnPct: number | null = null;
    let profitLoss: number | null = null;
    let holdingDays: number | null = null;
    let rMultiple: number | null = null;
    let maxPotentialR: number | null = null;

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

    // 3. Enrich with market data and calculate maxPotentialR for early exit detection
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

        const bars = await fetchUnadjustedDailyBars(polygonClient, ticker);
        const exitDateStr =
          exitDate &&
          (body.exitDate && body.exitDate.length >= 10
            ? body.exitDate.slice(0, 10)
            : exitDate.toISOString().slice(0, 10));

        const patch = computeJournalPolygonPatchFromBars(bars, {
          direction: body.direction,
          entryDateYmd: body.entryDate,
          exitDateYmd: exitDateStr ?? null,
          entryPrice: body.entryPrice,
          exitPrice: body.exitPrice ?? null,
          returnPct,
        });

        if (patch) {
          entryOHLC = patch.entryOHLC;
          exitOHLC = patch.exitOHLC;
          entryEMA9 = patch.entryEMA9;
          entryEMA20 = patch.entryEMA20;
          entryEMA50 = patch.entryEMA50;
          entryRSI = patch.entryRSI;
          entryATR = patch.entryATR;
          exitEMA9 = patch.exitEMA9;
          exitEMA20 = patch.exitEMA20;
          exitEMA50 = patch.exitEMA50;
          exitRSI = patch.exitRSI;
          exitATR = patch.exitATR;
          maxPotentialR = patch.maxPotentialR;
          rMultiple = patch.rMultiple;
          console.log(
            `[Journal] Entry indicators - EMA9: ${entryEMA9?.toFixed(2)}, RSI: ${entryRSI?.toFixed(2)}, ATR: ${entryATR?.toFixed(2)}`,
          );
          if (rMultiple != null) {
            console.log(`[Journal] R multiple: ${rMultiple.toFixed(2)}R`);
          }
        }
      } catch (error) {
        console.error('[Journal] Error fetching market data:', error);
        // Continue without enrichment
      }
    }

    // 4. Save to database
    const tradeData = {
      userId,
      ticker,
      direction: body.direction,
      tradeType: body.tradeType ?? 'swing',
      entryPrice: body.entryPrice,
      entryDate,
      exitPrice: body.exitPrice ?? null,
      exitDate: exitDate,
      entryTime: body.entryTime ?? null,
      exitTime: body.exitTime ?? null,
      amount: body.amount,
      strategy: body.strategy ?? null,
      notes: body.notes ?? null,
      isOpen,
      exitReason: body.exitReason ?? null,
      broker: body.broker ?? 'webull',
      returnPct,
      rMultiple,
      holdingDays,
      profitLoss,
      maxPotentialR,
      analysisReportId,
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

