/**
 * Journal / Polygon date alignment.
 * Trades store entryDate as `YYYY-MM-DD` + `T00:00:00.000Z` (UTC midnight on that calendar date).
 * Polygon daily bar `t` is UTC; US session labels follow **America/New_York** calendar days.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * GOLDEN RULE:  Never use local getDay/getDate/getMonth/getFullYear or
 *               toLocaleDateString() without { timeZone: 'UTC' } on a
 *               journal entryDate / exitDate.  Those instants are UTC
 *               midnight; in western-hemisphere zones local interpretation
 *               shifts them to "yesterday evening" and the wrong calendar day.
 * ────────────────────────────────────────────────────────────────────────────
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

/**
 * Calendar YYYY-MM-DD for a journal `entryDate` / exitDate stored as UTC midnight on that date.
 * Use this for grouping (daily P/L, filters) — do **not** pass the instant through another timezone
 * or UTC midnight becomes "yesterday evening" in US zones and shifts the wrong calendar day.
 */
export function journalStoredYmd(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return typeof iso === 'string' ? iso.slice(0, 10) : '';
  return d.toISOString().slice(0, 10);
}

/**
 * Short weekday label (Mon…Sun) for the **stored** calendar date — matches list/table semantics
 * and {@link formatJournalStoredDate} (UTC calendar parts).
 */
export function journalStoredWeekdayShort(iso: string | Date): string {
  const ymd = journalStoredYmd(iso);
  const parts = ymd.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const day = parts[2];
  if (!y || !m || !day) return '—';
  const utcNoon = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
  return utcNoon.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

/**
 * Short display for a stored journal date: "Apr 18" (UTC calendar day).
 * Use for compact tables / dashboard where full weekday + year is too long.
 */
export function formatJournalDateShort(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return typeof iso === 'string' ? iso.slice(0, 10) : '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * UTC "today" as YYYY-MM-DD.
 * Use only for server-side comparisons with Prisma-returned Date objects.
 * For user-facing "today" (week strips, date presets), use {@link todayInTimezone}.
 */
export function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "Today" in the user's wall-clock timezone as YYYY-MM-DD.
 *
 * Journal dates are stored as `YYYY-MM-DDT00:00:00Z` where the YYYY-MM-DD
 * matches the user's wall-clock calendar date at the time of entry. Therefore,
 * user-facing "today" / "this week" / "this month" boundaries must use the user's
 * timezone, not UTC.  At 10 PM ET on Sunday, UTC is already Monday; pure-UTC
 * "today" would shift the week calendar forward by a day.
 */
export function todayInTimezone(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
