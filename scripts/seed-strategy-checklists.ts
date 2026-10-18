/**
 * Attach Model 1 / Model 2 checklists and link existing trades to official strategies.
 * Run: npx ts-node --project tsconfig.node.json scripts/seed-strategy-checklists.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MODEL1_ENTRY = [
  'Level. The high or low printed at a level marked before the session: RTH or session high/low, PDH/PDL, ONH/ONL, London high/low, or a heatmap wall.',
  'It failed. At least 2 one-minute bars without a new extreme, and a lower high (short) or higher low (long) has formed. Entries 2-9 bars after the extreme did as well as or better than instant ones.',
  'Distance. Price is 0.5-3 ATR (14-period, 1m) from the extreme. On ES in NY that is about 1.5-8 points (a typical NY 1m ATR is about 2.8). Closer = anticipating, further = late.',
  'Momentum. Shorts: 1m RSI 35-55. Longs: 45-65 (the mirror rule, not yet tested on your longs).',
  'Order flow. Tag what you saw: absorption at the extreme, CVD divergence, a sweep and reclaim, or none. Not required yet; the tag is how we find out if it adds anything.',
  'Window. NY 9:35-10:30. Shorts only during the eval (NY longs lost on MNQ, and Asia is off during the eval).',
];

const MODEL2_DESCRIPTION = `The market moves in a cycle: a fast one-sided move (imbalance), a pause (balance, the consolidation box), then another fast move out of the box. Trade the first return to the edge of that box, in the direction of the breakout, and only when Bookmap shows a buyer (or seller) defending it. This is Carmine Rosato's demand/supply zone trade.`;

const MODEL2_NAME = 'Model 2: Demand/Supply Zone Retest';

const MODEL2_ENTRY = [
  'Window. NY 9:45-11:00.',
  'VWAP side. Longs only above the 9:30 VWAP, shorts only below it.',
  'Zone. A consolidation of 5-12 one-minute bars, no taller than 8 ES points. Top and bottom marked.',
  'Breakout. Price left the box and ran at least one box height away before coming back. A breakout that crawls out and stalls is not a zone.',
  'First retest. This is the first return to the box edge (the top for a long). Once per zone: if the first retest fails, the zone is done.',
  'Room. At least 1.5R of open space to the first heavy order wall or level. Less than that, skip.',
  'Confirmation. At least 2 items from the Bookmap checklist below are visible at the edge. Price touching the zone is not an entry.',
];

const MODEL2_BOOKMAP = [
  'Absorption at the edge',
  'CVD divergence',
  'Sweep and reclaim',
  'Buyer or seller defending on the heatmap',
];

function asCriteria(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
}

async function main() {
  const strategies = await prisma.strategy.findMany();
  const model1 = strategies.find((s) => /model\s*1|failed extreme/i.test(s.name));
  const model2 = strategies.find((s) => /morning drive/i.test(s.name))
    || strategies.find((s) => /model\s*2/i.test(s.name));

  if (model1) {
    const criteria = asCriteria(model1.criteria);
    criteria.entry_rules = MODEL1_ENTRY;
    criteria.checklist = [{ title: 'Entry (all must be true)', items: MODEL1_ENTRY }];
    await prisma.strategy.update({
      where: { id: model1.id },
        data: { criteria: criteria as never },
    });
    console.log('Updated checklist:', model1.name);
  } else {
    console.log('No Model 1 strategy found');
  }

  let model2Id = model2?.id;
  const oldModel2Name = model2?.name;
  if (model2) {
    const criteria = asCriteria(model2.criteria);
    criteria.entry_rules = MODEL2_ENTRY;
    criteria.exit_rules = [
      'Half off at 1.5R or the breakout high (low for a short), whichever comes first. Stop to breakeven at 1R. The rest to 3R or the next level. Close after 30 minutes if neither has hit.',
    ];
    criteria.indicators = ['9:30 VWAP', 'Bookmap heatmap and bubbles', 'CVD', 'Volume Bubbles (ES preset)'];
    criteria.timeframes = ['1m', 'Bookmap'];
    criteria.checklist = [
      { title: 'Entry (all must be true)', items: MODEL2_ENTRY },
      { title: 'Bookmap confirmation (need 2)', items: MODEL2_BOOKMAP },
      { title: 'Trigger', items: ['Once confirmation shows, a stop-market order 1 tick above the high (long) or below the low (short) of the 1-minute candle that tested the edge.'] },
      { title: 'Stop', items: ['1 tick beyond the far side of the box (below the bottom for a long). Usually 5-7 ES points. Over 8, skip.'] },
      { title: 'Size', items: ['Contracts = $150 ÷ (stop points × $5), rounded down, max 10 MES.'] },
      { title: 'Exit', items: ['Half off at 1.5R or the breakout high (low for a short), whichever comes first. Stop to breakeven at 1R. The rest to 3R or the next level. Close after 30 minutes if neither has hit.'] },
    ];
    await prisma.strategy.update({
      where: { id: model2.id },
      data: {
        name: MODEL2_NAME,
        description: MODEL2_DESCRIPTION,
        criteria: criteria as never,
      },
    });
    console.log('Updated Model 2:', oldModel2Name, '→', MODEL2_NAME);
    model2Id = model2.id;
  } else {
    console.log('No Model 2 strategy found');
  }

  const fresh = await prisma.strategy.findMany({ select: { id: true, userId: true, name: true } });
  const byUser = new Map<string, { id: string; name: string }[]>();
  for (const s of fresh) {
    const list = byUser.get(s.userId) || [];
    list.push(s);
    byUser.set(s.userId, list);
  }

  const trades = await prisma.tradeJournal.findMany({
    select: { id: true, userId: true, strategy: true, strategyId: true },
  });

  let linked = 0;
  for (const trade of trades) {
    const catalog = byUser.get(trade.userId) || [];
    const picks: { id: string; name: string }[] = [];
    const add = (s?: { id: string; name: string }) => {
      if (s && !picks.some((p) => p.id === s.id)) picks.push(s);
    };
    add(catalog.find((s) => s.id === trade.strategyId));
    const raw = trade.strategy || '';
    const names = raw.split('·').map((n) => n.trim()).filter(Boolean);
    if (oldModel2Name && names.some((n) => n.toLowerCase() === oldModel2Name.toLowerCase()) && model2Id) {
      add(catalog.find((s) => s.id === model2Id));
    }
    for (const name of names) {
      add(catalog.find((s) => s.name.toLowerCase() === name.toLowerCase()));
    }
    if (!picks.length) continue;
    await prisma.tradeStrategy.deleteMany({ where: { tradeId: trade.id } });
    await prisma.tradeStrategy.createMany({
      data: picks.map((p) => ({ tradeId: trade.id, strategyId: p.id })),
      skipDuplicates: true,
    });
    const label = picks.map((p) => p.name).join(' · ').slice(0, 400);
    if (trade.strategy !== label || trade.strategyId !== picks[0].id) {
      await prisma.tradeJournal.update({
        where: { id: trade.id },
        data: { strategy: label, strategyId: picks[0].id },
      });
    }
    linked++;
  }
  console.log(`Linked ${linked} trades to official strategies`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
