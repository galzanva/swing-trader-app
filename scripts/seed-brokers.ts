/**
 * Seed default broker accounts for all users.
 * Also splits "tradethepool" trades into "tradethepool-eval" (default for existing).
 *
 * Run: npx tsx scripts/seed-brokers.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_BROKERS = [
  { slug: 'webull', name: 'Webull', accountType: 'margin' },
  { slug: 'robinhood', name: 'Robinhood', accountType: 'cash' },
  { slug: 'tradethepool-eval', name: 'TradeThePool (Eval)', accountType: 'prop-eval' },
  { slug: 'tradethepool-funded', name: 'TradeThePool (Funded)', accountType: 'prop-funded' },
];

async function main() {
  const users = await prisma.user.findMany({ select: { id: true } });

  for (const user of users) {
    console.log(`Setting up brokers for user ${user.id}...`);

    for (const broker of DEFAULT_BROKERS) {
      await prisma.brokerAccount.upsert({
        where: { userId_slug: { userId: user.id, slug: broker.slug } },
        update: { name: broker.name, accountType: broker.accountType },
        create: { userId: user.id, ...broker },
      });
    }

    // Migrate any existing "tradethepool" trades to "tradethepool-eval"
    const updated = await prisma.tradeJournal.updateMany({
      where: { userId: user.id, broker: 'tradethepool' },
      data: { broker: 'tradethepool-eval' },
    });
    if (updated.count > 0) {
      console.log(`  Migrated ${updated.count} tradethepool → tradethepool-eval`);
    }
  }

  console.log('Done! Broker accounts seeded for all users.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
