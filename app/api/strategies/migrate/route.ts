/**
 * One-time migration: seed starter strategies and link/clean existing trades.
 * POST /api/strategies/migrate
 *
 * Safe to run multiple times — uses upsert for strategies.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

const STARTER_STRATEGIES = [
  {
    name: 'Breakout',
    description:
      'Enter when price breaks above a key resistance level (consolidation range, prior high, or descending trendline) on strong volume. Works best when the stock has a catalyst and relative volume is high.',
    tradeType: 'intraday',
    criteria: {
      entry_rules: [
        'Price breaks above defined resistance / consolidation range',
        'Volume surge — at least 2x relative volume on the breakout candle',
        'Confirm with a higher low or tightening range before the break',
        'Catalyst present (news, earnings, sector momentum)',
      ],
      exit_rules: [
        'Take partial at 1:2 risk-reward, trail the rest',
        'Stop loss just below the breakout level / last pivot low',
        'Exit if price re-enters the range on heavy selling volume',
      ],
      indicators: ['VWAP', 'EMA 9', 'Volume', 'Level 2'],
      timeframes: ['1m', '5m', '15m'],
    },
  },
  {
    name: 'VWAP Bounce',
    description:
      'Buy the dip to VWAP (Volume Weighted Average Price) on a stock that is trending up intraday. VWAP acts as dynamic support — institutions use it as a reference price, making bounces off it reliable.',
    tradeType: 'intraday',
    criteria: {
      entry_rules: [
        'Stock is in an intraday uptrend (higher highs, higher lows)',
        'Price pulls back to VWAP and holds — look for a bounce candle',
        'Volume dries up on the pullback, then picks up on the bounce',
        'Avoid if stock has broken below VWAP for an extended period',
      ],
      exit_rules: [
        'Target previous high of day or next resistance level',
        'Stop loss below VWAP by a small buffer (e.g. 1–2 ATR)',
        'If price closes below VWAP on the 5-min, cut it',
      ],
      indicators: ['VWAP', 'EMA 9', 'RSI', 'Volume'],
      timeframes: ['1m', '5m'],
    },
  },
  {
    name: 'Reversal',
    description:
      'Catch a trend reversal after a stock has been in a sharp decline (or rally). Look for capitulation volume, a failed breakdown, and bullish divergence. Higher risk but high reward when timed correctly.',
    tradeType: 'intraday',
    criteria: {
      entry_rules: [
        'Stock has dropped significantly (20%+ intraday or multi-day)',
        'Capitulation volume spike — sellers exhausting',
        'Failed breakdown: price dips to new low then reclaims quickly',
        'RSI divergence or hammer / doji candle pattern at support',
      ],
      exit_rules: [
        'Target VWAP or first major moving average above (EMA 9/20)',
        'Stop loss below the reversal candle low',
        'Scale out in thirds: 1R, 2R, hold runner with trailing stop',
      ],
      indicators: ['VWAP', 'EMA 9', 'EMA 20', 'RSI', 'Volume'],
      timeframes: ['1m', '5m', '15m'],
    },
  },
  {
    name: 'Micro Pullback',
    description:
      'Trend-continuation intraday: price stays above VWAP in a strong push, then forms a tight bullish flag (small red / inside candles) off the impulse. Enter on the first green candle that breaks the micro pullback — not the deep dip, the shallow pause in the move.',
    tradeType: 'intraday',
    criteria: {
      entry_rules: [
        'Price is above VWAP and has already made a clear impulse / leg higher (the “big move”)',
        'Pullback is shallow — bullish flag / tight consolidation, not a full trend break',
        'Micro pullback: one or more small red (or doji) candles within the flag, lower volume than the impulse',
        'Enter on the first green candle that closes above the highs of those small red candles (confirmation)',
        'Avoid if price loses VWAP or the flag breaks down on volume',
      ],
      exit_rules: [
        'Target retest of prior swing high or next intraday resistance / HOD extension',
        'Stop below the flag low or below the entry candle low — keep risk tight for micro structure',
        'If the first green candle fails (immediate red reversal), scratch or reduce',
      ],
      indicators: ['VWAP', 'EMA 9', 'Volume', 'Candle structure'],
      timeframes: ['1m', '5m'],
    },
  },
];

const KEEP_NAMES = new Set(
  STARTER_STRATEGIES.map(s => s.name.toLowerCase()),
);

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // 1. Upsert starter strategies
    const strategyMap = new Map<string, string>(); // lowercase name → id
    for (const s of STARTER_STRATEGIES) {
      const record = await prisma.strategy.upsert({
        where: { userId_name: { userId, name: s.name } },
        create: {
          userId,
          name: s.name,
          description: s.description,
          tradeType: s.tradeType,
          criteria: s.criteria,
        },
        update: {
          description: s.description,
          tradeType: s.tradeType,
          criteria: s.criteria,
        },
      });
      strategyMap.set(s.name.toLowerCase(), record.id);
    }

    // 2. Fetch all trades for this user that have a strategy set
    const tradesWithStrategy = await prisma.tradeJournal.findMany({
      where: { userId, strategy: { not: null } },
      select: { id: true, strategy: true },
    });

    let linked = 0;
    let cleared = 0;

    for (const trade of tradesWithStrategy) {
      const name = (trade.strategy ?? '').trim().toLowerCase();
      if (!name) continue;

      if (KEEP_NAMES.has(name)) {
        // Link to the DB strategy
        const stratId = strategyMap.get(name)!;
        await prisma.tradeJournal.update({
          where: { id: trade.id },
          data: { strategyId: stratId },
        });
        linked++;
      } else {
        // Clear legacy strategy name
        await prisma.tradeJournal.update({
          where: { id: trade.id },
          data: { strategy: null, strategyId: null },
        });
        cleared++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        strategiesCreated: STARTER_STRATEGIES.length,
        tradesLinked: linked,
        tradesCleared: cleared,
        totalProcessed: tradesWithStrategy.length,
      },
    });
  } catch (error: any) {
    console.error('[Strategy Migrate] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
