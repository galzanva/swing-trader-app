import { prisma } from '@/lib/db/prisma';

export type StrategyPick = { id: string; name: string };

/** Official strategies for a trade, in the order the user selected them. */
export async function resolveStrategySelection(
  userId: string,
  input: { strategyIds?: string[] | null; strategy?: string | null },
): Promise<StrategyPick[]> {
  const requested = Array.isArray(input.strategyIds)
    ? input.strategyIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];

  if (requested.length) {
    const owned = await prisma.strategy.findMany({
      where: { userId, id: { in: requested } },
      select: { id: true, name: true },
    });
    return requested
      .map((id) => owned.find((s) => s.id === id))
      .filter((s): s is StrategyPick => Boolean(s));
  }

  const names = (input.strategy || '')
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!names.length) return [];

  const owned = await prisma.strategy.findMany({
    where: { userId, name: { in: names } },
    select: { id: true, name: true },
  });
  return names
    .map((name) => owned.find((s) => s.name === name))
    .filter((s): s is StrategyPick => Boolean(s));
}

export function strategyLabel(picks: StrategyPick[]): string | null {
  if (!picks.length) return null;
  return picks.map((s) => s.name).join(' · ').slice(0, 400);
}

export async function syncTradeStrategies(tradeId: string, picks: StrategyPick[]) {
  await prisma.tradeStrategy.deleteMany({ where: { tradeId } });
  if (!picks.length) return;
  await prisma.tradeStrategy.createMany({
    data: picks.map((s) => ({ tradeId, strategyId: s.id })),
    skipDuplicates: true,
  });
}
