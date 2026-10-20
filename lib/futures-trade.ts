import { isFuturesTicker, pointValue } from '@/lib/journal-paste-import';

/** Futures are a separate instrument. Detection uses the contract root, so older rows with a blank instrument type still qualify. */
export function isFuturesTrade(trade: { ticker: string; instrumentType?: string | null }): boolean {
  return trade.instrumentType === 'FUTURES' || isFuturesTicker(trade.ticker);
}

/**
 * Result of the trade in index points.
 * Uses the stored dollar P/L and the contract multiplier when size is known,
 * so a trim is the blended point result rather than the first fill only.
 */
export function futuresPointMove(trade: {
  ticker: string;
  instrumentType?: string | null;
  direction: string;
  entryPrice: number;
  exitPrice?: number | null;
  filledQty?: number | null;
  profitLoss?: number | null;
}): number | null {
  if (!isFuturesTrade(trade)) return null;
  const qty = trade.filledQty;
  const multiplier = pointValue(trade.ticker);
  if (qty != null && qty > 0 && multiplier > 0 && trade.profitLoss != null && Number.isFinite(trade.profitLoss)) {
    return trade.profitLoss / (qty * multiplier);
  }
  if (trade.exitPrice == null || !Number.isFinite(trade.exitPrice)) return null;
  return trade.direction === 'short'
    ? trade.entryPrice - trade.exitPrice
    : trade.exitPrice - trade.entryPrice;
}

export function formatPointMove(points: number): string {
  return `${points > 0 ? '+' : ''}${points.toFixed(2)} pts`;
}
