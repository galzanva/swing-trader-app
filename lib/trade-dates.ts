/**
 * Journal / Polygon date alignment.
 * Trades store entryDate as `YYYY-MM-DD` + `T00:00:00.000Z` (UTC midnight on that calendar date).
 * Polygon daily bar `t` is UTC; US session labels follow **America/New_York** calendar days.
 */

const NY = 'America/New_York';

/** UTC calendar date YYYY-MM-DD (debugging / secondary checks). */
export function utcCalendarDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** US/Eastern calendar date YYYY-MM-DD for an instant — use to match journal dates to Polygon daily bars. */
export function nyseCalendarDateString(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NY,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

export interface JournalBarPick {
  timestamp: number;
  low: number;
  high: number;
}

/**
 * Pick the daily bar for a journal session date: exact NY calendar match, else first on/after,
 * else last on/before. If `fillPrice` is set and the chosen bar's range does not contain it,
 * search nearby trading days (off-by-one bar keys; adjusted vs unadjusted OHLC).
 */
export function findJournalDailyBarIndex(
  bars: JournalBarPick[],
  sessionYmd: string,
  fillPrice?: number | null,
): number {
  if (!bars.length) return -1;
  const ny = nyseCalendarDateString;

  const exactIdx = bars.findIndex(b => ny(b.timestamp) === sessionYmd);
  let idx =
    exactIdx >= 0
      ? exactIdx
      : bars.findIndex(b => ny(b.timestamp) >= sessionYmd);

  if (idx < 0) {
    for (let i = bars.length - 1; i >= 0; i--) {
      if (ny(bars[i].timestamp) <= sessionYmd) return i;
    }
    return bars.length - 1;
  }

  if (fillPrice == null || !Number.isFinite(fillPrice) || fillPrice <= 0) return idx;

  const priceInBar = (i: number) => {
    if (i < 0 || i >= bars.length) return false;
    const b = bars[i];
    const lo = b.low * 0.995;
    const hi = b.high * 1.005;
    return fillPrice >= lo && fillPrice <= hi;
  };

  if (priceInBar(idx)) return idx;

  for (const step of [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) {
    const j = idx + step;
    if (priceInBar(j)) return j;
  }

  return idx;
}

/**
 * Format a stored journal ISO timestamp for display as the **intended calendar day**
 * (same as list view): interpret using UTC date parts, not the viewer's local zone.
 */
export function formatJournalStoredDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
