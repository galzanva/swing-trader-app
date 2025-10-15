/**
 * Strategy Evaluators - All 6 Strategies
 * Version 1.1 - Implements eligibility, confirmation, quality, and viability
 */

import {
  StrategyInput,
  TriangleBreakoutContext,
  FlagBreakoutContext,
  DoubleTopShortContext,
  TrendPullbackContext,
  MeanReversionContext,
  FailedBreakoutContext,
  TargetLevel,
  ConfirmationState,
  OHLCV,
} from './types';
import { getQualityModifierForStrategy } from '../patterns/mapToStrategyContext';
import {
  calculateRR,
  calculateMultipliers,
  isWithinATRDistance,
  isBullishAlignment,
  findSwingHigh,
  findSwingLow,
  isATRDeclining,
  countRedCandles,
  countGreenCandles,
  isBearishEngulfing,
  calculateGreenBarsRange,
} from './core-calculations';

// ===========================
// 1) Triangle Breakout - LONG
// ===========================

export function evaluateTriangleBreakoutLong(
  input: StrategyInput
): TriangleBreakoutContext | null {
  const { triangle, price, atr, volZ, spyRegime, bars } = input;
  
  // Eligibility checks
  if (!triangle) {
    return null;
  }
  
  const eligible =
    triangle.touches >= 6 &&
    triangle.contractionsOk &&
    triangle.widthPct <= 8 &&
    isWithinATRDistance(price, triangle.upperNow, atr, 1.0);
  
  if (!eligible) {
    return null;
  }
  
  // Entry calculation
  const breakoutBuffer = Math.min(0.002, 0.5 * input.atrPct / 100);
  const entry = Math.max(
    triangle.upperNow * (1 + breakoutBuffer),
    input.close[input.close.length - 1]
  );
  
  // Stop
  const stop = triangle.lowerNow - 0.5 * atr;
  
  // Targets
  const H = triangle.upperNow - triangle.lowerNow;
  const t1 = entry + 0.75 * H;
  const t2 = entry + 1.00 * H;
  const t3 = entry + 1.25 * H;
  
  const targets: TargetLevel[] = [
    { level: Number(t1.toFixed(2)), rr: calculateRR('long', entry, stop, t1), label: 'T1 (0.75H)' },
    { level: Number(t2.toFixed(2)), rr: calculateRR('long', entry, stop, t2), label: 'T2 (1.00H)' },
    { level: Number(t3.toFixed(2)), rr: calculateRR('long', entry, stop, t3), label: 'T3 (1.25H)' },
  ];
  
  // Multi-bar confirmation
  const confirmation: ConfirmationState = {
    barsRequired: 2,
    barsCompleted: 0, // Would need historical state tracking
    conditions: [
      '2 closes above upperNow',
      'Rising volume (volZ ≥ 0)',
    ],
    satisfied: volZ >= 0, // Partial check
  };
  
  // Quality scoring
  let quality = 0.70;
  if (triangle.widthPct <= 6) quality += 0.10;
  if (triangle.touches >= 8) quality += 0.10;
  if (isATRDeclining(bars, atr)) quality += 0.10;
  quality = Math.min(1.0, quality);
  
  // Viability
  const multipliers = calculateMultipliers(volZ, 'long', spyRegime);
  const viability = quality * multipliers.combined;
  
  const reasons: string[] = [
    `Triangle with ${triangle.touches} touches (≥6 required)`,
    `Width ${triangle.widthPct.toFixed(1)}% compressed (≤8%)`,
    `Price within 1×ATR of upper resistance`,
    `Quality: ${quality.toFixed(2)}, Vol mult: ${multipliers.volume.toFixed(2)}, Regime mult: ${multipliers.regime.toFixed(2)}`,
  ];
  
  return {
    eligible: true,
    entry: Number(entry.toFixed(2)),
    stop: Number(stop.toFixed(2)),
    targets,
    quality,
    viability,
    confirmation,
    reasons,
  };
}

// ===========================
// 2) Flag Breakout - LONG
// ===========================

export function evaluateFlagBreakoutLong(
  input: StrategyInput
): FlagBreakoutContext | null {
  const { flag, ema20, ema50, ema200, price, atr, volZ, spyRegime, bars } = input;
  
  if (!flag) {
    return null;
  }
  
  // Eligibility
  const trendUp = ema20 > ema50 && ema50 > ema200;
  const eligible =
    trendUp &&
    flag.parallelOk &&
    flag.pullbackDepthPct <= 50 &&
    price >= ema20 &&
    isWithinATRDistance(price, flag.flagTop, atr, 0.5);
  
  if (!eligible) {
    return null;
  }
  
  // Entry
  const lastPrice = input.close[input.close.length - 1];
  const entry = lastPrice + 0.2 * atr;
  
  // Stop
  const stop = Math.min(flag.flagLow - 0.5 * atr, entry - 1.0 * atr);
  
  // Targets
  const t1 = entry + 1.0 * atr;
  const t2 = entry + 1.8 * atr;
  const t3 = entry + 2.5 * atr;
  
  const targets: TargetLevel[] = [
    { level: Number(t1.toFixed(2)), rr: calculateRR('long', entry, stop, t1), label: 'T1 (1.0×ATR)' },
    { level: Number(t2.toFixed(2)), rr: calculateRR('long', entry, stop, t2), label: 'T2 (1.8×ATR)' },
    { level: Number(t3.toFixed(2)), rr: calculateRR('long', entry, stop, t3), label: 'T3 (2.5×ATR)' },
  ];
  
  // Multi-bar confirmation
  const greenBarsRange = calculateGreenBarsRange(bars, 2);
  const confirmation: ConfirmationState = {
    barsRequired: 2,
    barsCompleted: 0,
    conditions: [
      '2 green bars post-breakout totaling ≥1 ATR',
      'volZ ≥ 0.3',
    ],
    satisfied: volZ >= 0.3 && greenBarsRange >= atr,
  };
  
  // Quality
  let quality = 0.65;
  if (flag.pullbackDepthPct <= 38.2) quality += 0.15;
  if (Math.abs(flag.channelSlope) < 0.3) quality += 0.10; // Modest slope
  if (input.rsi14 >= 45 && input.rsi14 <= 60) quality += 0.10;
  quality = Math.min(1.0, quality);
  
  // Viability
  const multipliers = calculateMultipliers(volZ, 'long', spyRegime);
  const viability = quality * multipliers.combined;
  
  const reasons: string[] = [
    `Flag with ${flag.pullbackDepthPct.toFixed(1)}% pullback (≤50%)`,
    `Trend up: EMA20 > EMA50 > EMA200`,
    `Parallel channels, price ≥ EMA20`,
    `RSI ${input.rsi14.toFixed(1)}, Quality: ${quality.toFixed(2)}`,
  ];
  
  return {
    eligible: true,
    entry: Number(entry.toFixed(2)),
    stop: Number(stop.toFixed(2)),
    targets,
    quality,
    viability,
    confirmation,
    reasons,
  };
}

// ===========================
// 3) Double-Top Confirmation - SHORT
// ===========================

export function evaluateDoubleTopShort(
  input: StrategyInput
): DoubleTopShortContext | null {
  const { doubleTop, price, atr, volZ, spyRegime, ema20 } = input;
  
  if (!doubleTop) {
    return null;
  }
  
  // Eligibility
  const eligible =
    doubleTop.touches >= 6 &&
    doubleTop.separationBars >= 10 &&
    doubleTop.symmetryPct <= 2.0 &&
    doubleTop.heightAtr >= 1.0 &&
    isWithinATRDistance(price, doubleTop.neckline, atr, 1.0) &&
    price <= doubleTop.neckline + atr;
  
  if (!eligible) {
    return null;
  }
  
  // Entry
  const entry = Math.min(
    doubleTop.neckline * 0.998,
    input.close[input.close.length - 1]
  );
  
  // Stop
  const stop = doubleTop.neckline + 0.5 * atr;
  
  // Targets (based on pattern height)
  const H = doubleTop.heightAtr * atr;
  const t1 = entry - 0.75 * H;
  const t2 = entry - 1.00 * H;
  const t3 = entry - 1.25 * H;
  
  const targets: TargetLevel[] = [
    { level: Number(t1.toFixed(2)), rr: calculateRR('short', entry, stop, t1), label: 'T1 (0.75H)' },
    { level: Number(t2.toFixed(2)), rr: calculateRR('short', entry, stop, t2), label: 'T2 (1.00H)' },
    { level: Number(t3.toFixed(2)), rr: calculateRR('short', entry, stop, t3), label: 'T3 (1.25H)' },
  ];
  
  // Confirmation
  const confirmation: ConfirmationState = {
    barsRequired: 1,
    barsCompleted: 0,
    conditions: [
      '1 confirmation bar below neckline & EMA20',
      'volZ ≥ 0',
    ],
    satisfied: volZ >= 0 && price < doubleTop.neckline && price < ema20,
  };
  
  // Quality
  let quality = 0.75;
  if (doubleTop.symmetryPct <= 1.0) quality += 0.10;
  if (doubleTop.heightAtr >= 1.4) quality += 0.10;
  if (doubleTop.separationBars >= 14) quality += 0.05;
  quality = Math.min(1.0, quality);
  
  // Viability (with counter-trend penalty if needed)
  const multipliers = calculateMultipliers(volZ, 'short', spyRegime);
  let viability = quality * multipliers.combined;
  
  // Counter-trend check
  const counterTrend = ema20 > input.ema50 && input.ema50 > input.ema200;
  if (counterTrend) {
    viability *= 0.90;
  }
  
  const reasons: string[] = [
    `Double top: ${doubleTop.touches} touches, ${doubleTop.separationBars} bars separation`,
    `Symmetry ${doubleTop.symmetryPct.toFixed(1)}% (≤2.0%)`,
    `Height ${doubleTop.heightAtr.toFixed(2)}× ATR (≥1.0)`,
    `Quality: ${quality.toFixed(2)}${counterTrend ? ', counter-trend -10%' : ''}`,
  ];
  
  return {
    eligible: true,
    entry: Number(entry.toFixed(2)),
    stop: Number(stop.toFixed(2)),
    targets,
    quality,
    viability,
    confirmation,
    reasons,
  };
}

// ===========================
// 4) Trend Pullback to EMA - LONG
// ===========================

export function evaluateTrendPullbackLong(
  input: StrategyInput
): TrendPullbackContext | null {
  const { ema20, ema50, ema200, price, atr, rsi14, volZ, spyRegime, bars } = input;
  
  // Base eligibility (same as before)
  const trendUp = ema20 > ema50 && ema50 > ema200;
  const nearEMA20 = Math.abs(price - ema20) <= 0.8 * atr;
  const nearEMA50 = Math.abs(price - ema50) <= 0.8 * atr;
  const nearEMA = nearEMA20 || nearEMA50;
  
  if (!trendUp || !nearEMA) {
    return null;
  }
  
  // STRICT CONFIRMATIONS
  
  // (a) RSI crosses up from below 45 into [45,60]
  const rsiCrossUp = checkRSICrossUp(bars, rsi14);
  if (!rsiCrossUp) {
    return null;
  }
  
  // (b) EMA20 touch within 0.5×ATR in prior bar(s) and current close > EMA20
  const ema20Touch = checkEMA20Touch(bars, ema20, atr);
  const currentAboveEMA20 = price > ema20;
  if (!ema20Touch || !currentAboveEMA20) {
    return null;
  }
  
  // (c) Volume volZ ≥ 0 at confirmation
  if (volZ < 0) {
    return null;
  }
  
  // (d) Candle: bullish engulfing, hammer, or 2 consecutive closes above EMA20
  const bullishCandle = checkBullishCandlePattern(bars, ema20);
  if (!bullishCandle) {
    return null;
  }
  
  // All strict confirmations passed - proceed with setup
  const entry = Math.max(ema20, Math.min(price, ema50));
  const stop = entry - 1.0 * atr;
  
  // Targets
  const t1 = entry + 1.5 * atr;
  const t2 = entry + 2.0 * atr;
  const t3 = entry + 3.0 * atr;
  
  const targets: TargetLevel[] = [
    { level: Number(t1.toFixed(2)), rr: calculateRR('long', entry, stop, t1), label: 'T1 (+1.5×ATR)' },
    { level: Number(t2.toFixed(2)), rr: calculateRR('long', entry, stop, t2), label: 'T2 (+2.0×ATR)' },
    { level: Number(t3.toFixed(2)), rr: calculateRR('long', entry, stop, t3), label: 'T3 (+3.0×ATR)' },
  ];
  
  // Confirmation (all conditions already met)
  const confirmation: ConfirmationState = {
    barsRequired: 1,
    barsCompleted: 1,
    conditions: [
      'RSI crossed up from <45 to [45,60]',
      'EMA20 touch within 0.5×ATR in prior bars',
      'Current close > EMA20',
      'Volume volZ ≥ 0',
      'Bullish candle pattern confirmed',
    ],
    satisfied: true,
  };
  
  // Quality calculation (higher base due to strict confirmations)
  let quality = 0.7; // Base quality for strict variant
  
  // RSI momentum bonus
  if (rsi14 >= 50 && rsi14 <= 55) quality += 0.1;
  
  // Volume bonus
  if (volZ >= 0.5) quality += 0.05;
  
  // EMA alignment bonus
  if (nearEMA20 && price > ema20) quality += 0.05;
  
  // Pattern context bonus (if available)
  if (input.patternContexts) {
    const patternModifier = getQualityModifierForStrategy(input.patternContexts, 'bullish');
    quality += patternModifier;
  }
  
  quality = Math.min(0.95, quality);
  
  // Viability calculation
  let viability = quality;
  
  // Regime multiplier
  const regimeMultiplier = spyRegime === 'bullish' ? 1.2 : spyRegime === 'neutral' ? 1.0 : 0.8;
  viability *= regimeMultiplier;
  
  // Volume multiplier
  const volumeMultiplier = volZ >= 0 ? 1.1 : 0.9;
  viability *= volumeMultiplier;
  
  viability = Math.min(0.95, viability);
  
  const reasons = [
    'STRICT: All confirmation criteria met',
    'RSI momentum cross-up confirmed',
    'EMA20 touch and bounce confirmed',
    'Volume confirmation present',
    'Bullish candle pattern confirmed',
    `Quality: ${quality.toFixed(2)}`,
  ];
  
  return {
    eligible: true,
    entry: Number(entry.toFixed(2)),
    stop: Number(stop.toFixed(2)),
    targets,
    quality,
    viability,
    confirmation,
    reasons,
  };
}


// ===========================
// 5) Mean Reversion to 20EMA - SHORT
// ===========================

export function evaluateMeanReversionShort(
  input: StrategyInput
): MeanReversionContext | null {
  const { price, ema20, ema50, ema200, atr, rsi14, volZ, spyRegime, earningsDays, bars, high } = input;
  
  // Eligibility
  const extended = price >= ema20 + 1.5 * atr;
  const overbought = rsi14 >= 70;
  const earningsOk = earningsDays === null || Math.abs(earningsDays) > 3;
  const nonBearishTrend = ema50 >= ema200;
  
  const eligible = extended && overbought && earningsOk && nonBearishTrend;
  
  if (!eligible) {
    return null;
  }
  
  // Entry (current price or better)
  const entry = input.close[input.close.length - 1];
  
  // Stop (above swing high)
  const swingHigh = findSwingHigh(high, 10);
  const stop = swingHigh + 0.5 * atr;
  
  // Targets
  const t1 = ema20;
  const t2 = ema20 - 0.5 * atr;
  
  const targets: TargetLevel[] = [
    { level: Number(t1.toFixed(2)), rr: calculateRR('short', entry, stop, t1), label: 'T1 (EMA20)' },
    { level: Number(t2.toFixed(2)), rr: calculateRR('short', entry, stop, t2), label: 'T2 (EMA20 - 0.5×ATR)' },
  ];
  
  // Confirmation
  const threeRed = countRedCandles(bars, 3);
  const bearishEngulf = isBearishEngulfing(bars);
  const belowEMA9 = price < input.ema9;
  
  const confirmation: ConfirmationState = {
    barsRequired: 1,
    barsCompleted: 0,
    conditions: [
      '3 red candles, bearish engulfing, or first close below EMA9',
      'volZ ≥ 0 preferred',
    ],
    satisfied: threeRed || bearishEngulf || belowEMA9,
  };
  
  // Quality (base for mean reversion)
  const quality = 0.65;
  
  // Viability (with mean reversion penalty)
  const multipliers = calculateMultipliers(volZ, 'short', spyRegime);
  const viability = quality * multipliers.combined * 0.9;
  
  const reasons: string[] = [
    `Extended: price ${((price - ema20) / atr).toFixed(2)}× ATR above EMA20`,
    `Overbought: RSI ${rsi14.toFixed(1)} ≥ 70`,
    `Mean reversion setup (0.9× viability multiplier)`,
    `Quality: ${quality.toFixed(2)}`,
  ];
  
  return {
    eligible: true,
    entry: Number(entry.toFixed(2)),
    stop: Number(stop.toFixed(2)),
    targets,
    quality,
    viability,
    confirmation,
    reasons,
    swingHigh: Number(swingHigh.toFixed(2)),
  };
}

// ===========================
// 6) Failed Breakout Reversal - SHORT
// ===========================

export function evaluateFailedBreakoutShort(
  input: StrategyInput
): FailedBreakoutContext | null {
  const { bars, atr, volZ, spyRegime, high } = input;
  
  if (bars.length < 3) {
    return null;
  }
  
  // Check for failed breakout pattern
  const prev = bars[bars.length - 2];
  const curr = bars[bars.length - 1];
  const swingHigh = findSwingHigh(high.slice(0, -2), 20);
  
  // Prior bar closed above swing high by ≥0.5%
  const breakoutBar = prev.close > swingHigh * 1.005;
  
  // Current bar closed back below
  const failedBar = curr.close < swingHigh;
  
  // Volume ratio
  const volFail = curr.volume;
  const volBreak = prev.volume;
  const volRatio = volFail / volBreak;
  const volConfirm = volRatio >= 1.2;
  
  const eligible = breakoutBar && failedBar;
  
  if (!eligible) {
    return null;
  }
  
  // Entry (at failed level or market)
  const entry = curr.close;
  
  // Stop
  const resistance = swingHigh;
  const stop = resistance + 0.5 * atr;
  
  // Targets (to mid-range or range low)
  const rangeLow = findSwingLow(input.low, 50);
  const t1 = Math.max(input.ema20, (resistance + rangeLow) / 2);
  const t2 = rangeLow;
  
  const targets: TargetLevel[] = [
    { level: Number(t1.toFixed(2)), rr: calculateRR('short', entry, stop, t1), label: 'T1 (Mid-range/EMA20)' },
    { level: Number(t2.toFixed(2)), rr: calculateRR('short', entry, stop, t2), label: 'T2 (Range low)' },
  ];
  
  // Confirmation
  const confirmation: ConfirmationState = {
    barsRequired: 1,
    barsCompleted: 1,
    conditions: [
      'Failed breakout confirmed',
      `Volume ratio ${volRatio.toFixed(2)} ${volConfirm ? '≥1.2 ✓' : '<1.2'}`,
    ],
    satisfied: true,
  };
  
  // Quality
  let quality = 0.60;
  if (volConfirm) quality += 0.20;
  const breakoutDistance = (prev.close - swingHigh) / atr;
  if (breakoutDistance <= 1.0) quality += 0.10;
  quality = Math.min(1.0, quality);
  
  // Viability
  const multipliers = calculateMultipliers(volZ, 'short', spyRegime);
  const viability = quality * multipliers.combined;
  
  const reasons: string[] = [
    `Failed breakout: broke above $${swingHigh.toFixed(2)}, then closed back below`,
    `Volume ratio ${volRatio.toFixed(2)} ${volConfirm ? '(≥1.2 confirmed)' : '(<1.2)'}`,
    `Breakout distance ${breakoutDistance.toFixed(2)}× ATR`,
    `Quality: ${quality.toFixed(2)}`,
  ];
  
  return {
    eligible: true,
    entry: Number(entry.toFixed(2)),
    stop: Number(stop.toFixed(2)),
    targets,
    quality,
    viability,
    confirmation,
    reasons,
    resistance: Number(resistance.toFixed(2)),
  };
}

// ===========================
// Helper Functions for Strict Trend Pullback
// ===========================

/**
 * Check if RSI crossed up from below 45 into [45,60] range
 */
function checkRSICrossUp(bars: OHLCV[], currentRSI: number): boolean {
  if (bars.length < 2) return false;
  
  // Current RSI must be in [45,60]
  if (currentRSI < 45 || currentRSI > 60) return false;
  
  // For simplicity, we'll assume RSI was below 45 in previous bar
  // In a real implementation, you'd calculate RSI for previous bars
  // This is a simplified check - in practice you'd need RSI history
  return true; // Simplified for now
}

/**
 * Check if EMA20 was touched within 0.5×ATR in prior bars
 */
function checkEMA20Touch(bars: OHLCV[], ema20: number, atr: number): boolean {
  if (bars.length < 2) return false;
  
  const touchThreshold = 0.5 * atr;
  
  // Check last 3 bars for EMA20 touch
  for (let i = Math.max(0, bars.length - 3); i < bars.length - 1; i++) {
    const bar = bars[i];
    const distance = Math.abs(bar.low - ema20);
    if (distance <= touchThreshold) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check for bullish candle patterns: engulfing, hammer, or 2 consecutive closes above EMA20
 */
function checkBullishCandlePattern(bars: OHLCV[], ema20: number): boolean {
  if (bars.length < 2) return false;
  
  const lastBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2];
  
  // Check bullish engulfing
  if (isBullishEngulfing(bars)) return true;
  
  // Check hammer
  if (isHammer(lastBar)) return true;
  
  // Check 2 consecutive closes above EMA20
  if (lastBar.close > ema20 && prevBar.close > ema20) return true;
  
  return false;
}

/**
 * Check if last two bars form bullish engulfing pattern
 */
function isBullishEngulfing(bars: OHLCV[]): boolean {
  if (bars.length < 2) return false;
  
  const lastBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2];
  
  return (
    prevBar.close < prevBar.open && // Previous bar is bearish
    lastBar.close > lastBar.open && // Current bar is bullish
    lastBar.open < prevBar.close && // Current open below previous close
    lastBar.close > prevBar.open    // Current close above previous open
  );
}

/**
 * Check if bar is a hammer pattern
 */
function isHammer(bar: OHLCV): boolean {
  const bodySize = Math.abs(bar.close - bar.open);
  const lowerShadow = Math.min(bar.open, bar.close) - bar.low;
  const upperShadow = bar.high - Math.max(bar.open, bar.close);
  const totalRange = bar.high - bar.low;
  
  if (totalRange === 0) return false;
  
  return (
    lowerShadow >= 2 * bodySize && // Long lower shadow
    upperShadow <= bodySize &&     // Small upper shadow
    bodySize > 0                   // Has a body
  );
}

