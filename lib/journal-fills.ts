/** Extra scale-ins and trims beyond the first entry and the first two exits. */

export type JournalFill = {
  side: 'entry' | 'exit';
  time: string;
  price: number;
};

export function parseJournalFills(raw: unknown): JournalFill[] {
  if (!Array.isArray(raw)) return [];
  const out: JournalFill[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const side = rec.side === 'entry' || rec.side === 'exit' ? rec.side : null;
    const time = typeof rec.time === 'string' ? rec.time.trim() : '';
    const price = typeof rec.price === 'number' ? rec.price : Number(rec.price);
    if (!side || !time || !Number.isFinite(price)) continue;
    out.push({ side, time, price });
  }
  return out;
}

type ExitSource = {
  exitTime?: string | null;
  exitPrice?: number | null;
  exit2Time?: string | null;
  exit2Price?: number | null;
  fills?: unknown;
};

export function exitSequence(trade: ExitSource): { time: string; price: number }[] {
  const out: { time: string; price: number }[] = [];
  if (trade.exitPrice != null && Number.isFinite(trade.exitPrice)) {
    out.push({ time: trade.exitTime || '', price: trade.exitPrice });
  }
  if (trade.exit2Price != null && Number.isFinite(trade.exit2Price)) {
    out.push({ time: trade.exit2Time || '', price: trade.exit2Price });
  }
  for (const fill of parseJournalFills(trade.fills)) {
    if (fill.side === 'exit') out.push({ time: fill.time, price: fill.price });
  }
  return out;
}

export function addSequence(trade: { fills?: unknown }): JournalFill[] {
  return parseJournalFills(trade.fills).filter((fill) => fill.side === 'entry');
}

export function latestExitClock(trade: ExitSource): string | null {
  const times = exitSequence(trade).map((exit) => exit.time.trim()).filter(Boolean);
  if (!times.length) return trade.exitTime?.trim() || null;
  return times.reduce((latest, time) => (time >= latest ? time : latest));
}

function hhmm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '';
}

export function entryClockLine(trade: ExitSource & { entryTime?: string | null; fills?: unknown }): string {
  const left = [hhmm(trade.entryTime), ...addSequence(trade).map((add) => hhmm(add.time))].filter(Boolean);
  const exits = exitSequence(trade).map((exit) => hhmm(exit.time)).filter(Boolean);
  if (!left.length) return exits.join(' / ');
  if (!exits.length) return left.join(' / ');
  return `${left.join(' / ')} → ${exits.join(' / ')}`;
}

export function entryPriceLine(entryPrice: number, trade: { fills?: unknown }): string {
  const parts = [entryPrice, ...addSequence(trade).map((add) => add.price)];
  return parts.map((price) => `$${price.toFixed(2)}`).join(' / ');
}

export function exitPriceLine(trade: ExitSource): string {
  return exitSequence(trade).map((exit) => `$${exit.price.toFixed(2)}`).join(' / ');
}

export function fillsExportText(raw: unknown): string {
  return parseJournalFills(raw)
    .map((fill) => `${fill.side} ${fill.time} @ ${fill.price}`)
    .join('; ');
}
