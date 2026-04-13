/**
 * POST /api/journal/enrich — Backfill ticker enrichment data for trades missing it.
 * Processes unique tickers to avoid duplicate API calls, then batch-updates all trades.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { enrichTicker } from '@/lib/enrichment';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // Trades missing sector OR float (older runs saved sector but omitted floatShares)
    const trades = await prisma.tradeJournal.findMany({
      where: {
        userId,
        OR: [{ sector: null }, { floatShares: null }],
      },
      select: { id: true, ticker: true },
    });

    if (trades.length === 0) {
      return NextResponse.json({ success: true, message: 'All trades already enriched', enriched: 0 });
    }

    // Group by unique ticker to minimize API calls
    const tickerMap = new Map<string, string[]>();
    for (const t of trades) {
      if (!tickerMap.has(t.ticker)) tickerMap.set(t.ticker, []);
      tickerMap.get(t.ticker)!.push(t.id);
    }

    let enriched = 0;
    let failed = 0;
    const tickers = [...tickerMap.keys()];

    // Fast pass: Finnhub only (60 calls/min = 30 tickers/min in parallel batches of 5)
    for (let i = 0; i < tickers.length; i += 5) {
      const batch = tickers.slice(i, i + 5);
      const results = await Promise.all(batch.map(async (ticker) => {
        try {
          const data = await enrichTicker(ticker);
          const tradeIds = tickerMap.get(ticker)!;

          if (data.sector || data.marketCap || data.floatShares) {
            await prisma.tradeJournal.updateMany({
              where: { id: { in: tradeIds } },
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
            return tradeIds.length;
          }
          return 0;
        } catch (e) {
          console.error(`[Enrich] Failed for ${ticker}:`, e);
          return -1;
        }
      }));

      for (const r of results) {
        if (r > 0) enriched += r;
        else if (r < 0) failed++;
      }

      // Pause 2.5s between batches (5 tickers × 2 Finnhub calls = 10 calls per batch)
      if (i + 5 < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalTrades: trades.length,
        uniqueTickers: tickers.length,
        enriched,
        failed,
      },
    });
  } catch (error: any) {
    console.error('[Enrich] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
