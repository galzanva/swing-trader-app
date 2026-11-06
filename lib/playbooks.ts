import { prisma } from '@/lib/db/prisma';
import { futuresRoot, isFuturesTicker } from '@/lib/journal-paste-import';
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

const emptyBucket = () => ({ days: 0, totalPL: 0, avgPL: 0, ifFollowedPL: 0 });

export type RuleLimits = {
  dayStop: number | null;
  lossStreak: number | null;
  maxContracts: number | null;
  riskPerTrade: number | null;
  bannedRoots: string[];
};

function amount(raw: string) {
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Pulls the numbers the replay can enforce out of free-text rules. */
export function ruleLimits(texts: string[]): RuleLimits {
  const limits: RuleLimits = { dayStop: null, lossStreak: null, maxContracts: null, riskPerTrade: null, bannedRoots: [] };
  for (const text of texts) {
    const dayStop = text.match(/day\s*stop[^\d$]*-?\s*\$\s*(\d[\d,]*(?:\.\d+)?)/i)
      || text.match(/(?:max(?:imum)?\s+)?daily\s+loss[^\d$]*-?\s*\$\s*(\d[\d,]*(?:\.\d+)?)/i);
    if (dayStop) limits.dayStop ??= amount(dayStop[1]);
    const streak = text.match(/(\d+)\s+loss(?:es)?\s+in\s+a\s+row/i);
    if (streak) limits.lossStreak ??= amount(streak[1]);
    const cap = text.match(/(?:hard\s+)?cap(?:\s+of)?\s+(\d+)\s*(?:contracts?|[A-Z]{2,4}\b)/i)
      || text.match(/max(?:imum)?\s+(\d+)\s+(?:contracts?|[A-Z]{2,4}\b)/i);
    if (cap) limits.maxContracts ??= amount(cap[1]);
    const risk = text.match(/risk\s+\$\s*(\d[\d,]*(?:\.\d+)?)\s+(?:per|a|each)\s+trade/i);
    if (risk) limits.riskPerTrade ??= amount(risk[1]);
    for (const m of text.matchAll(/never\s+trade\s+([A-Z]{2,4})\b/gi)) {
      const root = m[1].toUpperCase();
      if (isFuturesTicker(root) && !limits.bannedRoots.includes(root)) limits.bannedRoots.push(root);
    }
  }
  return limits;
}

type ReplayTrade = { entryTime: string | null; profitLoss: number | null; ticker: string; filledQty: number | null };

/** What the day would have paid if the stops, size cap, and per-trade risk had been respected. */
export function replayWithRules(trades: ReplayTrade[], limits: RuleLimits): number {
  const ordered = [...trades].sort((a, b) => (a.entryTime || '99').localeCompare(b.entryTime || '99'));
  let total = 0;
  let streak = 0;
  for (const t of ordered) {
    if (limits.bannedRoots.includes(futuresRoot(t.ticker.toUpperCase()))) continue;
    let pnl = t.profitLoss ?? 0;
    const qty = t.filledQty ?? 0;
    if (limits.maxContracts && qty > limits.maxContracts) pnl *= limits.maxContracts / qty;
    if (limits.riskPerTrade && pnl < -limits.riskPerTrade) pnl = -limits.riskPerTrade;
    if (limits.dayStop && total + pnl < -limits.dayStop) pnl = -limits.dayStop - total;
    total += pnl;
    streak = pnl < 0 ? streak + 1 : 0;
    if (limits.dayStop && total <= -limits.dayStop) break;
    if (limits.lossStreak && streak >= limits.lossStreak) break;
  }
  return Math.round(total * 100) / 100;
}

export async function playbookDiscipline(userId: string, playbookId?: string | null) {
  const playbook = await prisma.playbook.findFirst({
    where: playbookId ? { id: playbookId, userId } : { userId, isActive: true },
    include: {
      strategies: { include: { strategy: { select: { id: true, name: true } } } },
      rules: { orderBy: { sortOrder: 'asc' }, select: { text: true } },
    },
  });
  if (!playbook) {
    return { playbook: null, followed: emptyBucket(), missed: emptyBucket(), recent: [] as const, limits: null };
  }
  const limits = ruleLimits(playbook.rules.map((r) => r.text));
  const canReplay = Boolean(
    limits.dayStop || limits.lossStreak || limits.maxContracts || limits.riskPerTrade || limits.bannedRoots.length,
  );

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

  const matchesTicker = (ticker: string) => {
    const upper = ticker.toUpperCase();
    if (tickers.includes(upper)) return true;
    if (!isFuturesTicker(upper)) return false;
    const root = futuresRoot(upper);
    return tickers.some((item) => futuresRoot(item) === root);
  };
  const matchesStrategy = (trade: { strategy: string | null; strategyId: string | null; strategyLinks: { strategyId: string }[] }) => {
    if (!stratIds.size) return true;
    const linked = trade.strategyLinks.some((l) => stratIds.has(l.strategyId)) || (trade.strategyId != null && stratIds.has(trade.strategyId));
    const names = (trade.strategy || '').split('·').map((s) => s.trim().toLowerCase());
    return linked || names.some((n) => stratNames.has(n));
  };

  const ymds = days.map((d) => journalStoredYmd(d.date));
  let trades: {
    entryDate: Date;
    entryTime: string | null;
    filledQty: number | null;
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
        entryTime: true,
        filledQty: true,
        profitLoss: true,
        ticker: true,
        strategy: true,
        strategyId: true,
        strategyLinks: { select: { strategyId: true } },
      },
    });
  }

  const pnlByDay = new Map<string, number>();
  const tradesByDay = new Map<string, typeof trades>();
  for (const t of trades) {
    // Listed contracts are the session. Every fill on those tickers counts,
    // including setups that are not attached to the playbook.
    if (tickers.length) {
      if (!matchesTicker(t.ticker)) continue;
    } else if (!matchesStrategy(t)) {
      continue;
    }
    const day = journalStoredYmd(t.entryDate);
    pnlByDay.set(day, (pnlByDay.get(day) || 0) + (t.profitLoss ?? 0));
    tradesByDay.set(day, [...(tradesByDay.get(day) || []), t]);
  }

  const followed = emptyBucket();
  const missed = emptyBucket();
  const rows = days.map((d) => {
    const date = journalStoredYmd(d.date);
    const pnl = Math.round((pnlByDay.get(date) || 0) * 100) / 100;
    const ifFollowed = !d.followedAll && canReplay ? replayWithRules(tradesByDay.get(date) || [], limits) : null;
    const bucket = d.followedAll ? followed : missed;
    bucket.days += 1;
    bucket.totalPL += pnl;
    bucket.ifFollowedPL += ifFollowed ?? pnl;
    return { date, followed: d.followedAll, pnl, ifFollowed, note: d.note };
  });
  for (const bucket of [followed, missed]) {
    bucket.totalPL = Math.round(bucket.totalPL * 100) / 100;
    bucket.avgPL = bucket.days ? Math.round((bucket.totalPL / bucket.days) * 100) / 100 : 0;
    bucket.ifFollowedPL = Math.round(bucket.ifFollowedPL * 100) / 100;
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
    recent: rows.slice(0, 21),
    limits: canReplay ? limits : null,
  };
}
