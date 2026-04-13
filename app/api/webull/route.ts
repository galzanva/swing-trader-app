/**
 * Webull Integration API
 *
 * GET  /api/webull            - Connection status + account info
 * POST /api/webull            - Test connection / create token / sync trades
 *   body.action = "test"      - Verify credentials by fetching account list
 *   body.action = "token"     - Create access token (starts 2FA flow)
 *   body.action = "check"     - Check token status
 *   body.action = "sync"      - Import filled orders into trading journal
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { createWebullClient, WebullOrderDetail } from '@/lib/data-vendors/webull';
import { enrichTicker } from '@/lib/enrichment';

// ── GET: Connection status ──

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conn = await prisma.webullConnection.findUnique({
      where: { userId: session.user.id },
    });

    const hasEnvKeys = !!(process.env.WEBULL_API_KEY && process.env.WEBULL_API_SECRET);

    return NextResponse.json({
      connected: !!conn?.accountId,
      hasEnvKeys,
      accountId: conn?.accountId || null,
      tokenStatus: conn?.tokenStatus || null,
      host: conn?.host || 'api.webull.com',
      lastSyncAt: conn?.lastSyncAt?.toISOString() || null,
      lastSyncCount: conn?.lastSyncCount || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST: Actions ──

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const action: string = body.action;
    const host: string = body.host || 'api.webull.com';

    const appKey = process.env.WEBULL_API_KEY;
    const appSecret = process.env.WEBULL_API_SECRET;
    if (!appKey || !appSecret) {
      return NextResponse.json({ error: 'WEBULL_API_KEY and WEBULL_API_SECRET must be set in .env' }, { status: 500 });
    }

    // Load existing connection for access token
    const existingConn = await prisma.webullConnection.findUnique({ where: { userId } });
    const client = createWebullClient({
      appKey,
      appSecret,
      host,
      accessToken: existingConn?.accessToken || undefined,
    });

    // ── TEST: Verify credentials ──
    if (action === 'test') {
      const res = await client.getAccountList();
      if (res.error) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 });
      }

      const accounts = res.data || [];
      const firstAccountId = accounts.length > 0 ? accounts[0].account_id : null;

      // Save/update connection
      await prisma.webullConnection.upsert({
        where: { userId },
        create: { userId, accountId: firstAccountId, host },
        update: { accountId: firstAccountId || existingConn?.accountId, host },
      });

      return NextResponse.json({
        success: true,
        accounts,
        selectedAccountId: firstAccountId,
      });
    }

    // ── TOKEN: Create 2FA token ──
    if (action === 'token') {
      const res = await client.createToken();
      if (res.error) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 });
      }

      const { token, expires, status } = res.data;
      await prisma.webullConnection.upsert({
        where: { userId },
        create: {
          userId,
          host,
          accessToken: token,
          tokenStatus: status,
          tokenExpiresAt: new Date(expires),
        },
        update: {
          accessToken: token,
          tokenStatus: status,
          tokenExpiresAt: new Date(expires),
        },
      });

      return NextResponse.json({
        success: true,
        tokenStatus: status,
        expires: new Date(expires).toISOString(),
        message: status === 'PENDING'
          ? 'Token created. Please verify in your Webull App within 5 minutes.'
          : `Token status: ${status}`,
      });
    }

    // ── CHECK: Check token status ──
    if (action === 'check') {
      const res = await client.checkToken();
      if (res.error) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 });
      }

      const { status, expires } = res.data;
      if (existingConn) {
        await prisma.webullConnection.update({
          where: { userId },
          data: { tokenStatus: status, tokenExpiresAt: new Date(expires) },
        });
      }

      return NextResponse.json({ success: true, tokenStatus: status });
    }

    // ── SYNC: Import filled orders ──
    if (action === 'sync') {
      const accountId = body.accountId || existingConn?.accountId;
      if (!accountId) {
        return NextResponse.json({ error: 'No account ID. Run "test" first to fetch your accounts.' }, { status: 400 });
      }

      const startDate: string | undefined = body.startDate; // YYYY-MM-DD
      let endDate: string | undefined = body.endDate;

      // Webull rejects same start/end date — bump end_date by 1 day
      if (startDate && endDate && startDate === endDate) {
        const d = new Date(endDate + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + 1);
        endDate = d.toISOString().split('T')[0];
      }

      const { orders, error } = await client.getAllFilledOrders(accountId, startDate, endDate);
      if (error && orders.length === 0) {
        return NextResponse.json({ success: false, error }, { status: 400 });
      }

      // Log first order to help debug timestamp fields
      if (orders.length > 0) {
        console.log('[Webull Sync] Sample order fields:', JSON.stringify(orders[0], null, 2));
      }

      // Pair BUY/SELL orders by symbol chronologically to create journal entries
      const { trades, skipped } = pairOrdersIntoTrades(orders);

      if (trades.length > 0) {
        console.log('[Webull Sync] First paired trade:', {
          ticker: trades[0].ticker,
          entryTime: trades[0].entryTime,
          exitTime: trades[0].exitTime,
          tradeType: trades[0].tradeType,
          entryDate: trades[0].entryDate,
          exitDate: trades[0].exitDate,
        });
      }

      // Dedup: find existing externalOrderIds for this user
      const existingExtIds = new Set(
        (
          await prisma.tradeJournal.findMany({
            where: { userId, source: 'webull', externalOrderId: { not: null } },
            select: { externalOrderId: true },
          })
        ).map(t => t.externalOrderId),
      );

      const forceUpdate = body.forceUpdate === true;
      const mergeManual = body.mergeManual === true;
      let imported = 0;
      let duplicates = 0;
      let updated = 0;
      let merged = 0;

      // Pre-fetch manual trades for merge matching (only when mergeManual enabled)
      let manualTrades: {
        id: string; ticker: string; entryPrice: number; exitPrice: number | null;
        entryDate: Date; strategy: string | null; notes: string | null;
        exitReason: string | null; rMultiple: number | null;
      }[] = [];
      if (mergeManual) {
        manualTrades = await prisma.tradeJournal.findMany({
          where: { userId, source: 'manual' },
          select: {
            id: true, ticker: true, entryPrice: true, exitPrice: true,
            entryDate: true, strategy: true, notes: true,
            exitReason: true, rMultiple: true,
          },
        });
      }

      const priceClose = (a: number, b: number) =>
        Math.abs(a - b) < 0.015; // tolerance for float rounding

      const findManualMatch = (trade: PairedTrade) => {
        return manualTrades.find(m =>
          m.ticker === trade.ticker &&
          m.entryDate.toISOString().split('T')[0] === trade.entryDate.toISOString().split('T')[0] &&
          priceClose(m.entryPrice, trade.entryPrice) &&
          m.exitPrice !== null && priceClose(m.exitPrice, trade.exitPrice)
        );
      };

      for (const trade of trades) {
        if (existingExtIds.has(trade.externalOrderId)) {
          if (forceUpdate) {
            await prisma.tradeJournal.updateMany({
              where: { userId, externalOrderId: trade.externalOrderId },
              data: {
                tradeType: trade.tradeType,
                entryTime: trade.entryTime,
                exitTime: trade.exitTime,
                entryDate: trade.entryDate,
                exitDate: trade.exitDate,
                entryPrice: trade.entryPrice,
                exitPrice: trade.exitPrice,
                profitLoss: trade.profitLoss,
                returnPct: trade.returnPct,
                holdingDays: trade.holdingDays,
                filledQty: trade.filledQty,
                avgFillPrice: trade.avgFillPrice,
              },
            });
            updated++;
          } else {
            duplicates++;
          }
          continue;
        }

        // Merge with existing manual trade if enabled
        if (mergeManual) {
          const match = findManualMatch(trade);
          if (match) {
            // Update the manual entry in-place: add Webull data + keep manual annotations
            await prisma.tradeJournal.update({
              where: { id: match.id },
              data: {
                source: 'webull',
                externalOrderId: trade.externalOrderId,
                entryTime: trade.entryTime,
                exitTime: trade.exitTime,
                tradeType: trade.tradeType,
                filledQty: trade.filledQty,
                avgFillPrice: trade.avgFillPrice,
                orderType: trade.orderType,
                instrumentType: trade.instrumentType,
                // Preserve: strategy, notes, exitReason, rMultiple from manual entry
              },
            });
            // Remove from candidates so it can't match again
            manualTrades = manualTrades.filter(m => m.id !== match.id);
            merged++;
            console.log(`[Webull Sync] Merged ${trade.ticker} ${trade.entryDate.toISOString().split('T')[0]} $${trade.entryPrice}→$${trade.exitPrice} with manual entry ${match.id} (kept strategy="${match.strategy}", notes="${match.notes?.slice(0, 30)}", exitReason="${match.exitReason}", R=${match.rMultiple})`);
            continue;
          }
        }

        await prisma.tradeJournal.create({
          data: {
            userId,
            ticker: trade.ticker,
            direction: trade.direction,
            tradeType: trade.tradeType,
            entryPrice: trade.entryPrice,
            entryDate: trade.entryDate,
            exitPrice: trade.exitPrice,
            exitDate: trade.exitDate,
            entryTime: trade.entryTime,
            exitTime: trade.exitTime,
            amount: trade.amount,
            profitLoss: trade.profitLoss,
            returnPct: trade.returnPct,
            holdingDays: trade.holdingDays,
            isOpen: false,
            source: 'webull',
            externalOrderId: trade.externalOrderId,
            filledQty: trade.filledQty,
            avgFillPrice: trade.avgFillPrice,
            orderType: trade.orderType,
            instrumentType: trade.instrumentType,
          },
        });
        imported++;
      }

      // Update sync metadata
      await prisma.webullConnection.upsert({
        where: { userId },
        create: { userId, accountId, host, lastSyncAt: new Date(), lastSyncCount: imported },
        update: { lastSyncAt: new Date(), lastSyncCount: imported },
      });

      // Enrich new/updated tickers in background (fire-and-forget)
      const tickersToEnrich = [...new Set(trades.map(t => t.ticker))];
      (async () => {
        for (const ticker of tickersToEnrich) {
          try {
            const data = await enrichTicker(ticker);
            if (data.sector || data.marketCap || data.floatShares) {
              await prisma.tradeJournal.updateMany({
                where: {
                  userId,
                  ticker,
                  OR: [{ sector: null }, { floatShares: null }],
                },
                data: {
                  sector: data.sector,
                  industry: data.industry,
                  marketCap: data.marketCap,
                  floatShares: data.floatShares,
                  sharesOutstanding: data.sharesOutstanding,
                  avgVolume: data.avgVolume,
                  beta: data.beta,
                },
              });
            }
          } catch (e) {
            console.error(`[Webull Sync] Enrichment failed for ${ticker}:`, e);
          }
        }
        console.log(`[Webull Sync] Enrichment complete for ${tickersToEnrich.length} tickers`);
      })();

      return NextResponse.json({
        success: true,
        summary: {
          totalOrders: orders.length,
          pairedTrades: trades.length,
          imported,
          updated,
          merged,
          duplicates,
          skipped,
          startDate: startDate || 'default (7 days)',
          endDate: endDate || 'today',
        },
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[Webull API] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Trade pairing logic ──

interface PairedTrade {
  ticker: string;
  direction: 'long' | 'short';
  tradeType: 'swing' | 'intraday';
  entryPrice: number;
  exitPrice: number;
  entryDate: Date;
  exitDate: Date;
  entryTime: string | null;
  exitTime: string | null;
  amount: number;
  profitLoss: number;
  returnPct: number;
  holdingDays: number;
  filledQty: number;
  avgFillPrice: number;
  orderType: string;
  instrumentType: string;
  externalOrderId: string;
}

/**
 * Resolve the best available timestamp from a Webull order.
 *
 * Webull's naming is non-standard:
 *   filled_time  = numeric ms timestamp AS A STRING (e.g. "1775834526247")
 *   place_time   = numeric ms timestamp AS A STRING
 *   place_time_at = ISO date string (e.g. "2026-04-10T15:22:06.166Z")
 *   filled_time_at = ISO date string (may not be present)
 */
function resolveTimestampMs(order: WebullOrderDetail): number {
  // Try numeric-string fields first (most precise)
  if (order.filled_time) {
    const n = Number(order.filled_time);
    if (!isNaN(n) && n > 1_000_000_000_000) return n; // valid ms epoch
  }
  if (order.place_time) {
    const n = Number(order.place_time);
    if (!isNaN(n) && n > 1_000_000_000_000) return n;
  }
  // Try ISO string fields
  if (order.place_time_at) {
    const ms = typeof order.place_time_at === 'string'
      ? new Date(order.place_time_at).getTime()
      : order.place_time_at;
    if (!isNaN(ms) && ms > 0) return ms;
  }
  if (order.filled_time_at) {
    const ms = typeof order.filled_time_at === 'string'
      ? new Date(order.filled_time_at as string).getTime()
      : order.filled_time_at;
    if (!isNaN(ms) && ms > 0) return ms;
  }
  return Date.now();
}

function pairOrdersIntoTrades(
  orders: WebullOrderDetail[],
): { trades: PairedTrade[]; skipped: number } {
  const bySymbol = new Map<string, WebullOrderDetail[]>();
  for (const o of orders) {
    if (!o.symbol || o.status !== 'FILLED') continue;
    const sym = o.symbol.toUpperCase();
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym)!.push(o);
  }

  const trades: PairedTrade[] = [];
  let skipped = 0;

  for (const [symbol, symbolOrders] of bySymbol) {
    const sorted = symbolOrders.sort((a, b) => {
      const ta = resolveTimestampMs(a);
      const tb = resolveTimestampMs(b);
      return ta - tb;
    });

    const buys: WebullOrderDetail[] = [];
    const sells: WebullOrderDetail[] = [];

    for (const o of sorted) {
      if (o.side === 'BUY') buys.push(o);
      else if (o.side === 'SELL' || o.side === 'SHORT') sells.push(o);
    }

    const pairCount = Math.min(buys.length, sells.length);
    for (let i = 0; i < pairCount; i++) {
      const buy = buys[i];
      const sell = sells[i];

      const entryPrice = parseFloat(buy.filled_price || buy.limit_price || '0');
      const exitPrice = parseFloat(sell.filled_price || sell.limit_price || '0');
      const qty = parseFloat(buy.filled_quantity || buy.total_quantity || '0');

      if (entryPrice <= 0 || exitPrice <= 0 || qty <= 0) {
        skipped++;
        continue;
      }

      const entryMs = resolveTimestampMs(buy);
      const exitMs = resolveTimestampMs(sell);

      // Compare dates in Eastern Time to correctly detect intraday
      const entryET = toEasternDateStr(entryMs);
      const exitET = toEasternDateStr(exitMs);
      const sameDay = entryET === exitET;

      // Default to intraday — most Webull trades for day trading
      const isIntraday = sameDay;
      const diffDays = sameDay ? 0 : Math.max(1, Math.round((exitMs - entryMs) / (1000 * 60 * 60 * 24)));

      const entryTime = extractTimeET(entryMs);
      const exitTime = extractTimeET(exitMs);

      const pnl = (exitPrice - entryPrice) * qty;
      const returnPct = ((exitPrice - entryPrice) / entryPrice) * 100;

      // Use ET date string for the journal date (avoids UTC date shift)
      const entryDateObj = new Date(`${entryET}T00:00:00.000Z`);
      const exitDateObj = new Date(`${exitET}T00:00:00.000Z`);

      trades.push({
        ticker: symbol,
        direction: 'long',
        tradeType: isIntraday ? 'intraday' : 'swing',
        entryPrice,
        exitPrice,
        entryDate: entryDateObj,
        exitDate: exitDateObj,
        entryTime: entryTime || (isIntraday ? null : '09:30:00'),
        exitTime: exitTime || (isIntraday ? null : '16:00:00'),
        amount: entryPrice * qty,
        profitLoss: Math.round(pnl * 100) / 100,
        returnPct: Math.round(returnPct * 100) / 100,
        holdingDays: diffDays,
        filledQty: qty,
        avgFillPrice: entryPrice,
        orderType: buy.order_type || 'UNKNOWN',
        instrumentType: buy.instrument_type || 'EQUITY',
        externalOrderId: `${buy.order_id || buy.client_order_id}_${sell.order_id || sell.client_order_id}`,
      });
    }

    skipped += Math.abs(buys.length - sells.length);
  }

  return { trades, skipped };
}

/**
 * Convert a UTC millisecond timestamp to an Eastern Time date string (YYYY-MM-DD).
 * Handles EST/EDT automatically via Intl.
 */
function toEasternDateStr(ms: number): string {
  const d = new Date(ms);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d); // en-CA gives YYYY-MM-DD format
  return parts;
}

/**
 * Extract HH:MM:SS in Eastern Time from a UTC ms timestamp.
 */
function extractTimeET(ms: number): string | null {
  if (!ms) return null;
  const d = new Date(ms);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(d);
  return parts; // "HH:MM:SS"
}
