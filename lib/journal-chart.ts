import { addSequence, exitSequence } from '@/lib/journal-fills';
import { journalDateTimeMs, journalStoredYmd } from '@/lib/trade-dates';

export const CHART_TIMEFRAMES = ['1min', '5min', '15min', '1hour', '1day'] as const;
export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];

const FUTURES_PROXY: Record<string, { polygon: string; label: string }> = {
  MNQ: { polygon: 'I:NDX', label: 'Nasdaq-100 index' },
  NQ: { polygon: 'I:NDX', label: 'Nasdaq-100 index' },
  MES: { polygon: 'I:SPX', label: 'S&P 500 index' },
  ES: { polygon: 'I:SPX', label: 'S&P 500 index' },
  MYM: { polygon: 'I:DJI', label: 'Dow Jones index' },
  YM: { polygon: 'I:DJI', label: 'Dow Jones index' },
  M2K: { polygon: 'I:RUT', label: 'Russell 2000 index' },
  RTY: { polygon: 'I:RUT', label: 'Russell 2000 index' },
};

const FUTURES_ROOT_RE = /^(MNQ|MES|MYM|M2K|NQ|ES|YM|RTY)/i;

export function futuresRoot(ticker: string): string | null {
  const t = ticker.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = t.match(FUTURES_ROOT_RE);
  return m ? m[1].toUpperCase() : null;
}

export function polygonCandidates(ticker: string): { symbol: string; note: string | null }[] {
  const raw = ticker.trim().toUpperCase();
  const out: { symbol: string; note: string | null }[] = [{ symbol: raw, note: null }];
  const root = futuresRoot(raw);
  if (root && root !== raw) out.push({ symbol: root, note: null });
  if (root && FUTURES_PROXY[root]) {
    const proxy = FUTURES_PROXY[root];
    out.push({
      symbol: proxy.polygon,
      note: `${raw} is a futures contract. Showing delayed ${proxy.label} (${proxy.polygon}) — structure matches; basis vs the futures print can differ by a few points.`,
    });
  }
  const seen = new Set<string>();
  return out.filter((c) => (seen.has(c.symbol) ? false : (seen.add(c.symbol), true)));
}

export function chartRange(
  entryDate: string | Date,
  exitDate: string | Date | null,
  tf: ChartTimeframe,
): { from: string; to: string } {
  const start = journalStoredYmd(entryDate);
  const end = exitDate ? journalStoredYmd(exitDate) : start;
  const pad: Record<ChartTimeframe, number> = {
    '1min': 2,
    '5min': 5,
    '15min': 8,
    '1hour': 21,
    '1day': 90,
  };
  const days = pad[tf];
  const from = shiftYmd(start < end ? start : end, -days);
  const to = shiftYmd(start > end ? start : end, days);
  return { from, to };
}

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function polygonTf(tf: ChartTimeframe): { multiplier: number; timespan: 'minute' | 'hour' | 'day' } {
  switch (tf) {
    case '1min': return { multiplier: 1, timespan: 'minute' };
    case '5min': return { multiplier: 5, timespan: 'minute' };
    case '15min': return { multiplier: 15, timespan: 'minute' };
    case '1hour': return { multiplier: 1, timespan: 'hour' };
    default: return { multiplier: 1, timespan: 'day' };
  }
}

export function defaultChartTf(tradeType: string): ChartTimeframe {
  return tradeType === 'intraday' ? '5min' : '1day';
}

export type ChartFill = { ms: number; price: number };

export function tradeMarks(trade: {
  entryDate: string | Date;
  exitDate: string | Date | null;
  entryTime?: string | null;
  exitTime?: string | null;
  exit2Time?: string | null;
  entryPrice: number;
  exitPrice: number | null;
  exit2Price?: number | null;
  fills?: unknown;
  direction: string;
}) {
  const entryDay = journalStoredYmd(trade.entryDate);
  const exitDay = trade.exitDate ? journalStoredYmd(trade.exitDate) : null;
  const entryMs = journalDateTimeMs(entryDay, trade.entryTime);
  const entries: ChartFill[] = [{ ms: entryMs, price: trade.entryPrice }];
  for (const add of addSequence(trade)) {
    entries.push({ ms: journalDateTimeMs(entryDay, add.time), price: add.price });
  }
  const exits: ChartFill[] = [];
  if (exitDay) {
    for (const exit of exitSequence(trade)) {
      if (!exit.time) continue;
      exits.push({ ms: journalDateTimeMs(exitDay, exit.time), price: exit.price });
    }
  }
  return {
    entries,
    exits,
    entryMs,
    exitMs: exits[0]?.ms ?? null,
    exit2Ms: exits[1]?.ms ?? null,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    exit2Price: trade.exit2Price ?? null,
    direction: trade.direction,
  };
}
