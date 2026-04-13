/**
 * One-time script: seed starter strategies and link/clean existing trades.
 * Run: npx tsx scripts/migrate-strategies.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
];

const KEEP_NAMES = new Set(STARTER_STRATEGIES.map(s => s.name.toLowerCase()));

async function main() {
  // Find the first user (single-user app)
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No users found. Exiting.');
    return;
  }
  const userId = user.id;
  console.log(`Running migration for user: ${user.email || user.name || userId}`);

  // 1. Upsert starter strategies
  const strategyMap = new Map<string, string>();
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
    console.log(`  ✓ Strategy "${s.name}" → ${record.id}`);
  }

  // 2. Process trades
  const tradesWithStrategy = await prisma.tradeJournal.findMany({
    where: { userId, strategy: { not: null } },
    select: { id: true, strategy: true, ticker: true },
  });

  let linked = 0;
  let cleared = 0;

  for (const trade of tradesWithStrategy) {
    const name = (trade.strategy ?? '').trim().toLowerCase();
    if (!name) continue;

    if (KEEP_NAMES.has(name)) {
      const stratId = strategyMap.get(name)!;
      await prisma.tradeJournal.update({
        where: { id: trade.id },
        data: { strategyId: stratId },
      });
      linked++;
      console.log(`  → Linked ${trade.ticker} (${trade.strategy}) → strategyId ${stratId}`);
    } else {
      await prisma.tradeJournal.update({
        where: { id: trade.id },
        data: { strategy: null, strategyId: null },
      });
      cleared++;
      console.log(`  ✗ Cleared ${trade.ticker} (was "${trade.strategy}")`);
    }
  }

  console.log('\n=== Migration Complete ===');
  console.log(`  Strategies created/updated: ${STARTER_STRATEGIES.length}`);
  console.log(`  Trades linked to strategy:  ${linked}`);
  console.log(`  Trades cleared (legacy):    ${cleared}`);
  console.log(`  Total processed:            ${tradesWithStrategy.length}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
