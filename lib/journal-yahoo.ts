import type { JournalDailyBar } from '@/lib/journal-polygon-enrichment';
import { futuresRoot } from '@/lib/journal-paste-import';

const YAHOO_FUTURES: Record<string, string> = {
  MNQ: 'MNQ=F',
  NQ: 'NQ=F',
  MES: 'MES=F',
  ES: 'ES=F',
  MYM: 'MYM=F',
  YM: 'YM=F',
  M2K: 'M2K=F',
  RTY: 'RTY=F',
};

export function yahooFuturesSymbol(ticker: string): string | null {
  const root = futuresRoot(ticker);
  return YAHOO_FUTURES[root] || null;
}

/** Delayed continuous daily bars. Same source the futures chart uses. */
export async function fetchYahooDailyBars(ticker: string): Promise<JournalDailyBar[]> {
  const symbol = yahooFuturesSymbol(ticker);
  if (!symbol) return [];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) return [];
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const ts: number[] = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0];
  if (!ts.length || !quote) return [];
  return ts.map((t, i) => ({
    timestamp: t * 1000,
    open: quote.open?.[i],
    high: quote.high?.[i],
    low: quote.low?.[i],
    close: quote.close?.[i],
    volume: quote.volume?.[i] ?? 0,
  })).filter((bar) => [bar.open, bar.high, bar.low, bar.close].every((n) => Number.isFinite(n)));
}
