/**
 * POST /api/journal/rehydrate-ohlc
 * Re-runs Polygon daily (unadjusted) OHLC + journal indicators for the signed-in user's trades
 * without opening each row. Groups by ticker to limit API calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PolygonClient } from '@/lib/data-vendors/polygon';
import {
  computeJournalPolygonPatchFromBars,
  fetchUnadjustedDailyBars,
} from '@/lib/journal-polygon-enrichment';

const MAX_TRADES = 2000;
const TICKER_DELAY_MS = 280;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const polygonApiKey = process.env.POLYGON_API_KEY;
    if (!polygonApiKey) {
      return NextResponse.json(
        { error: 'POLYGON_API_KEY is not configured' },
        { status: 503 },
      );
    }

    let tradeIds: string[] = [];
    try {
      const body = await request.json();
      if (Array.isArray(body?.tradeIds)) {
        tradeIds = body.tradeIds.filter((id: unknown) => typeof id === 'string' && id.length > 0);
      }
    } catch {
      /* empty body */
    }

    tradeIds = tradeIds.slice(0, MAX_TRADES);

    if (tradeIds.length === 0) {
      return NextResponse.json(
        {
          error:
            'Send a non-empty tradeIds array: only trades you see with your current journal filters are refreshed (not your whole account by default).',
        },
        { status: 400 },
      );
    }

    const trades = await prisma.tradeJournal.findMany({
      where: {
        userId,
        id: { in: tradeIds },
      },
      orderBy: { entryDate: 'desc' },
    });

    if (trades.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matching trades for those ids (check filters or ownership)',
        updated: 0,
        skipped: 0,
        tradeCount: 0,
        idsRequested: tradeIds.length,
        errors: [] as string[],
      });
    }

    const byTicker = new Map<string, typeof trades>();
    for (const t of trades) {
      const tick = t.ticker.toUpperCase();
      if (!byTicker.has(tick)) byTicker.set(tick, []);
      byTicker.get(tick)!.push(t);
    }

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const polygonClient = new PolygonClient(polygonApiKey);
    let tickerIndex = 0;

    for (const [ticker, list] of byTicker) {
      tickerIndex++;
      try {
        const bars = await fetchUnadjustedDailyBars(polygonClient, ticker);
        if (!bars.length) {
          skipped += list.length;
          errors.push(`${ticker}: no Polygon daily bars`);
          continue;
        }

        for (const trade of list) {
          try {
            const entryYmd = trade.entryDate.toISOString().slice(0, 10);
            const exitYmd = trade.exitDate ? trade.exitDate.toISOString().slice(0, 10) : null;
            const direction = trade.direction === 'short' ? 'short' : 'long';

            const patch = computeJournalPolygonPatchFromBars(bars, {
              direction,
              entryDateYmd: entryYmd,
              exitDateYmd: exitYmd,
              entryPrice: trade.entryPrice,
              exitPrice: trade.exitPrice,
              returnPct: trade.returnPct,
            });

            if (!patch) {
              skipped++;
              continue;
            }

            await prisma.tradeJournal.update({
              where: { id: trade.id, userId },
              data: {
                entryOHLC:
                  patch.entryOHLC === null
                    ? Prisma.JsonNull
                    : (patch.entryOHLC as Prisma.InputJsonValue),
                exitOHLC:
                  patch.exitOHLC === null
                    ? Prisma.JsonNull
                    : (patch.exitOHLC as Prisma.InputJsonValue),
                entryEMA9: patch.entryEMA9,
                entryEMA20: patch.entryEMA20,
                entryEMA50: patch.entryEMA50,
                entryRSI: patch.entryRSI,
                entryATR: patch.entryATR,
                exitEMA9: patch.exitEMA9,
                exitEMA20: patch.exitEMA20,
                exitEMA50: patch.exitEMA50,
                exitRSI: patch.exitRSI,
                exitATR: patch.exitATR,
                maxPotentialR: patch.maxPotentialR,
                rMultiple: patch.rMultiple,
              },
            });
            updated++;
          } catch (e: any) {
            skipped++;
            errors.push(`${trade.ticker} #${trade.id.slice(0, 8)}: ${e?.message || 'update failed'}`);
          }
        }
      } catch (e: any) {
        skipped += list.length;
        errors.push(`${ticker}: ${e?.message || 'fetch failed'}`);
      }

      if (tickerIndex < byTicker.size) {
        await new Promise(r => setTimeout(r, TICKER_DELAY_MS));
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      skipped,
      tradeCount: trades.length,
      idsRequested: tradeIds.length,
      uniqueTickers: byTicker.size,
      errors: errors.slice(0, 30),
    });
  } catch (error: any) {
    console.error('[Journal rehydrate-ohlc]', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 },
    );
  }
}
