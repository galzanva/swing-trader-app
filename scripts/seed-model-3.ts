/** Upsert Model 3: Box-Edge Absorption for every user who already has Model 1 or Model 2. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAME = 'Model 3: Box-Edge Absorption';
const DESCRIPTION = `Inside a balance box, a large aggressive order hits the edge, a passive order absorbs it, and price fails to make a new extreme. Fade back toward the other side of the box. This is Carmine's demand-base trade, and it was the best entry in your Oct 16 screenshot (10:00:30). It differs from Model 2 because there is no breakout yet: you trade the edge holding, not the retest after a break.`;

const ENTRY = [
  'Window. NY 9:45-11:00.',
  'Box. Price has spent at least 5 one-minute bars in a box no taller than 8 ES points, and this edge has been tested at least once before.',
  'Absorption. A large sell bubble (for a long) hits the box low and price prints no more than 1 tick below the earlier low. The bid stays or refills.',
  'Room. The other side of the box is at least 1.5R away.',
  'Not a breakout. Skip if price arrives at the edge in a fresh fast leg from outside the box: that is a breakout in progress, not a test.',
];

const criteria = {
  entry_rules: ENTRY,
  exit_rules: [
    'Half off at 1.5R, stop to breakeven at 1R, the rest at the opposite side of the box. If the box then breaks in your direction, manage the rest by Model 2\'s exit. Close after 30 minutes.',
  ],
  indicators: ['Bookmap heatmap and bubbles', 'CVD'],
  timeframes: ['1m', 'Bookmap'],
  checklist: [
    { title: 'Entry (all must be true)', items: ENTRY },
    { title: 'Trigger', items: ['Stop-market order 1 tick above the high of the absorption candle (long) or below its low (short).'] },
    { title: 'Stop', items: ['1 ES point beyond the box edge, or beyond the absorption candle\'s extreme if that is further.'] },
    { title: 'Size', items: ['1 MES until 40 trades are logged.'] },
    { title: 'Exit', items: ['Half off at 1.5R, stop to breakeven at 1R, the rest at the opposite side of the box. If the box then breaks in your direction, manage the rest by Model 2\'s exit. Close after 30 minutes.'] },
  ],
};

async function main() {
  const owners = await prisma.strategy.findMany({
    where: { OR: [{ name: { contains: 'Model 1' } }, { name: { contains: 'Model 2' } }] },
    select: { userId: true },
    distinct: ['userId'],
  });
  if (!owners.length) throw new Error('No Model 1/2 owner found');

  for (const { userId } of owners) {
    const existing = await prisma.strategy.findFirst({ where: { userId, name: NAME } });
    if (existing) {
      await prisma.strategy.update({
        where: { id: existing.id },
        data: { description: DESCRIPTION, criteria: criteria as never, tradeType: 'intraday', isActive: true },
      });
      console.log('Updated', NAME, 'for', userId);
    } else {
      await prisma.strategy.create({
        data: {
          userId,
          name: NAME,
          description: DESCRIPTION,
          tradeType: 'intraday',
          isActive: true,
          criteria: criteria as never,
        },
      });
      console.log('Created', NAME, 'for', userId);
    }
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
