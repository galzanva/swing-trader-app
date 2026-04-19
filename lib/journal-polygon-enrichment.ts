import { PolygonClient } from '@/lib/data-vendors/polygon';
import { calculateTechnicalIndicators } from '@/lib/indicators/technical';
import { findJournalDailyBarIndex } from '@/lib/trade-dates';

export type JournalDailyBar = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** Fields written to TradeJournal from Polygon daily bars + derived metrics */
export interface JournalPolygonDbPatch {
  entryOHLC: Record<string, unknown> | null;
  exitOHLC: Record<string, unknown> | null;
  entryEMA9: number | null;
  entryEMA20: number | null;
  entryEMA50: number | null;
  entryRSI: number | null;
  entryATR: number | null;
  exitEMA9: number | null;
  exitEMA20: number | null;
  exitEMA50: number | null;
  exitRSI: number | null;
  exitATR: number | null;
  maxPotentialR: number | null;
  rMultiple: number | null;
}

export interface JournalPolygonEnrichmentInput {
  direction: 'long' | 'short';
  entryDateYmd: string;
  exitDateYmd: string | null;
  entryPrice: number;
  exitPrice: number | null;
  /** Closed-trade return % from journal (used to recompute R-multiple when ATR exists) */
  returnPct: number | null;
}

/** Prisma / Postgres reject NaN floats — normalize before persist */
function fin(v: number | null | undefined): number | null {
  if (v == null) return null;
  return Number.isFinite(v) ? v : null;
}

/**
 * Build DB patch from already-fetched unadjusted daily bars (one Polygon call per ticker).
 * Returns `null` if bars are empty (caller should not overwrite existing row).
 */
export function computeJournalPolygonPatchFromBars(
  bars: JournalDailyBar[],
  input: JournalPolygonEnrichmentInput,
): JournalPolygonDbPatch | null {
  if (!bars.length) return null;

  const {
    direction,
    entryDateYmd,
    exitDateYmd,
    entryPrice,
    exitPrice,
    returnPct,
  } = input;

  let entryOHLC: Record<string, unknown> | null = null;
  let exitOHLC: Record<string, unknown> | null = null;
  let entryEMA9: number | null = null;
  let entryEMA20: number | null = null;
  let entryEMA50: number | null = null;
  let entryRSI: number | null = null;
  let entryATR: number | null = null;
  let exitEMA9: number | null = null;
  let exitEMA20: number | null = null;
  let exitEMA50: number | null = null;
  let exitRSI: number | null = null;
  let exitATR: number | null = null;
  let maxPotentialR: number | null = null;
  let rMultiple: number | null = null;

  const entryBarIndex = findJournalDailyBarIndex(bars, entryDateYmd, entryPrice);

  if (entryBarIndex >= 0 && entryBarIndex < bars.length) {
    const entryBar = bars[entryBarIndex];
    entryOHLC = {
      open: entryBar.open,
      high: entryBar.high,
      low: entryBar.low,
      close: entryBar.close,
      volume: entryBar.volume,
      timestamp: entryBar.timestamp,
    };

    const barsUpToEntry = bars.slice(0, entryBarIndex + 1);
    try {
      const entryIndicators = calculateTechnicalIndicators(barsUpToEntry);
      entryEMA9 = fin(entryIndicators.ema9);
      entryEMA20 = fin(entryIndicators.ema20);
      entryEMA50 = fin(entryIndicators.ema50);
      entryRSI = fin(entryIndicators.rsi);
      entryATR = fin(entryIndicators.atr);
    } catch (e) {
      console.error('[JournalPolygon] entry technicals failed', e);
    }
  }

  if (exitDateYmd) {
    const exitBarIndex = findJournalDailyBarIndex(bars, exitDateYmd, exitPrice ?? null);

    if (exitBarIndex >= 0 && exitBarIndex < bars.length) {
      const exitBar = bars[exitBarIndex];
      exitOHLC = {
        open: exitBar.open,
        high: exitBar.high,
        low: exitBar.low,
        close: exitBar.close,
        volume: exitBar.volume,
        timestamp: exitBar.timestamp,
      };

      const barsUpToExit = bars.slice(0, exitBarIndex + 1);
      try {
        const exitIndicators = calculateTechnicalIndicators(barsUpToExit);
        exitEMA9 = fin(exitIndicators.ema9);
        exitEMA20 = fin(exitIndicators.ema20);
        exitEMA50 = fin(exitIndicators.ema50);
        exitRSI = fin(exitIndicators.rsi);
        exitATR = fin(exitIndicators.atr);
      } catch (e) {
        console.error('[JournalPolygon] exit technicals failed', e);
      }
    }
  }

  if (exitPrice != null && exitDateYmd && entryATR != null && entryBarIndex >= 0) {
    try {
      const exitBarIndexForPotential = findJournalDailyBarIndex(
        bars,
        exitDateYmd,
        exitPrice,
      );

      if (exitBarIndexForPotential >= 0) {
        const lookAheadBars = bars.slice(
          entryBarIndex,
          Math.min(exitBarIndexForPotential + 20, bars.length),
        );
        const stopDistance = 1.5 * entryATR;
        const riskPerShare = stopDistance;

        let maxGain = 0;

        for (const bar of lookAheadBars) {
          let gain = 0;

          if (direction === 'long') {
            gain = bar.high - entryPrice;
            if (bar.low < entryPrice - stopDistance) break;
          } else {
            gain = entryPrice - bar.low;
            if (bar.high > entryPrice + stopDistance) break;
          }

          maxGain = Math.max(maxGain, gain);
        }

        maxPotentialR = fin(riskPerShare > 0 ? maxGain / riskPerShare : null);
      }
    } catch {
      maxPotentialR = null;
    }
  }

  if (entryATR != null && exitPrice != null && returnPct !== null) {
    const stopDistance = 1.5 * entryATR;
    const riskPerShare = stopDistance;
    const riskPercent = (riskPerShare / entryPrice) * 100;
    if (riskPercent !== 0) {
      rMultiple = fin(returnPct / riskPercent);
    }
  }

  return {
    entryOHLC,
    exitOHLC,
    entryEMA9,
    entryEMA20,
    entryEMA50,
    entryRSI,
    entryATR,
    exitEMA9,
    exitEMA20,
    exitEMA50,
    exitRSI,
    exitATR,
    maxPotentialR,
    rMultiple,
  };
}

export async function fetchUnadjustedDailyBars(
  polygonClient: PolygonClient,
  ticker: string,
): Promise<JournalDailyBar[]> {
  const marketData = await polygonClient.getAggregates(ticker, '1day', 500, { adjusted: false });
  return (marketData.bars || []) as JournalDailyBar[];
}
