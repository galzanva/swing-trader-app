import { prisma } from '@/lib/db/prisma';
import { journalStoredYmd } from '@/lib/trade-dates';

export async function replacePlaybookRules(playbookId: string, lines: string[]) {
  const existing = await prisma.playbookRule.findMany({
    where: { playbookId },
    orderBy: { sortOrder: 'asc' },
  });
  const used = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const match = existing.find((r) => r.text === text && !used.has(r.id));
    if (match) {
      used.add(match.id);
      if (match.sortOrder !== i) {
        await prisma.playbookRule.update({ where: { id: match.id }, data: { sortOrder: i } });
      }
    } else {
      const created = await prisma.playbookRule.create({
        data: { playbookId, text, sortOrder: i },
      });
      used.add(created.id);
    }
  }
  const drop = existing.filter((r) => !used.has(r.id)).map((r) => r.id);
  if (drop.length) await prisma.playbookRule.deleteMany({ where: { id: { in: drop } } });
}

export async function replacePlaybookStrategies(playbookId: string, userId: string, strategyIds: string[]) {
  const owned = strategyIds.length
    ? await prisma.strategy.findMany({
        where: { userId, id: { in: strategyIds } },
        select: { id: true },
      })
    : [];
  await prisma.playbookStrategy.deleteMany({ where: { playbookId } });
  if (owned.length) {
    await prisma.playbookStrategy.createMany({
      data: owned.map((s) => ({ playbookId, strategyId: s.id })),
    });
  }
}

export async function setActivePlaybook(userId: string, playbookId: string) {
  const row = await prisma.playbook.findFirst({ where: { id: playbookId, userId }, select: { id: true } });
  if (!row) return;
  await prisma.playbook.updateMany({ where: { userId }, data: { isActive: false } });
  await prisma.playbook.update({ where: { id: playbookId }, data: { isActive: true } });
}

const emptyBucket = () => ({ days: 0, totalPL: 0, avgPL: 0 });

export async function playbookDiscipline(userId: string, playbookId?: string | null) {
  const playbook = await prisma.playbook.findFirst({
    where: playbookId ? { id: playbookId, userId } : { userId, isActive: true },
    include: {
      strategies: { include: { strategy: { select: { id: true, name: true } } } },
    },
  });
  if (!playbook) {
    return { playbook: null, followed: emptyBucket(), missed: emptyBucket(), recent: [] as const };
  }

  const days = await prisma.playbookDay.findMany({
    where: { playbookId: playbook.id },
    orderBy: { date: 'desc' },
  });

  const tickers = (playbook.tickers || '')
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  const stratIds = new Set(playbook.strategies.map((s) => s.strategyId));
  const stratNames = new Set(playbook.strategies.map((s) => s.strategy.name.toLowerCase()));

  const ymds = days.map((d) => journalStoredYmd(d.date));
  let trades: {
    entryDate: Date;
    profitLoss: number | null;
    ticker: string;
    strategy: string | null;
    strategyId: string | null;
    strategyLinks: { strategyId: string }[];
  }[] = [];
  if (ymds.length) {
    const min = ymds.reduce((a, b) => (a < b ? a : b));
    const max = ymds.reduce((a, b) => (a > b ? a : b));
    trades = await prisma.tradeJournal.findMany({
      where: {
        userId,
        entryDate: {
          gte: new Date(`${min}T00:00:00.000Z`),
          lte: new Date(`${max}T23:59:59.999Z`),
        },
      },
      select: {
        entryDate: true,
        profitLoss: true,
        ticker: true,
        strategy: true,
        strategyId: true,
        strategyLinks: { select: { strategyId: true } },
      },
    });
  }

  const pnlByDay = new Map<string, number>();
  for (const t of trades) {
    if (tickers.length && !tickers.includes(t.ticker.toUpperCase())) continue;
    if (stratIds.size) {
      const linked = t.strategyLinks.some((l) => stratIds.has(l.strategyId)) || (t.strategyId && stratIds.has(t.strategyId));
      const names = (t.strategy || '').split('·').map((s) => s.trim().toLowerCase());
      if (!linked && !names.some((n) => stratNames.has(n))) continue;
    }
    const day = journalStoredYmd(t.entryDate);
    pnlByDay.set(day, (pnlByDay.get(day) || 0) + (t.profitLoss ?? 0));
  }

  const followed = emptyBucket();
  const missed = emptyBucket();
  const recent = days.slice(0, 21).map((d) => {
    const date = journalStoredYmd(d.date);
    const pnl = Math.round((pnlByDay.get(date) || 0) * 100) / 100;
    const bucket = d.followedAll ? followed : missed;
    bucket.days += 1;
    bucket.totalPL += pnl;
    return { date, followed: d.followedAll, pnl, note: d.note };
  });
  for (const bucket of [followed, missed]) {
    bucket.totalPL = Math.round(bucket.totalPL * 100) / 100;
    bucket.avgPL = bucket.days ? Math.round((bucket.totalPL / bucket.days) * 100) / 100 : 0;
  }

  return {
    playbook: {
      id: playbook.id,
      name: playbook.name,
      strategyCount: playbook.strategies.length,
      tickers: playbook.tickers,
    },
    followed,
    missed,
    recent,
  };
}
