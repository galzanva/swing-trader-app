/**
 * One-time data migration: set broker field on existing trades.
 *
 * Rules:
 * - Trades with source = 'webull' → broker = 'webull'
 * - Trades with entryDate before March 1, 2026 (and source != 'webull') → broker = 'robinhood'
 * - Everything else keeps default 'webull'
 *
 * Run: npx tsx scripts/migrate-broker.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting broker migration...');

  // 1. Set all trades before March 1, 2026 to robinhood
  const robinhoodResult = await prisma.tradeJournal.updateMany({
    where: {
      entryDate: { lt: new Date('2026-03-01T00:00:00.000Z') },
      source: { not: 'webull' },
    },
    data: { broker: 'robinhood' },
  });
  console.log(`Set ${robinhoodResult.count} trades to broker=robinhood (pre-March 2026, non-webull)`);

  // 2. Ensure all webull-synced trades have broker = 'webull'
  const webullResult = await prisma.tradeJournal.updateMany({
    where: { source: 'webull' },
    data: { broker: 'webull' },
  });
  console.log(`Set ${webullResult.count} trades to broker=webull (source=webull)`);

  console.log('Broker migration complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
