/**
 * Core Calculation Functions for AI Swing Trading Strategy
 * Version 1.1 - Implements all multipliers, RR calculations, and hard blocks
 */

import { MarketRegime, Direction, HardBlockResult, MultiplierResult } from './types';

// ===========================
// Hard Blocks
// ===========================

/**
 * Check global hard blocks that prevent trading
 */
export function checkHardBlocks(
  price: number,
  spreadBps: number,
  advUsd: number,
  earningsDays: number | null
): HardBlockResult {
  // Earnings proximity block
  if (earningsDays !== null && Math.abs(earningsDays) <= 2) {
    return {
      blocked: true,
      reason: `Earnings in ${Math.abs(earningsDays)} days (within 2-day block window)`
    };
  }
  
  // Price too low
  if (price < 5) {
    return {
      blocked: true,
      reason: `Price $${price.toFixed(2)} below $5 minimum`
    };
  }
  
  // Spread too wide
  if (spreadBps > 40) {
    return {
      blocked: true,
      reason: `Spread ${spreadBps.toFixed(1)} bps exceeds 40 bps limit`
    };
  }
  
  // Insufficient liquidity
  if (advUsd < 2_000_000) {
    return {
      blocked: true,
      reason: `ADV $${(advUsd / 1_000_000).toFixed(2)}M below $2M minimum`
    };
  }
  
  return { blocked: false };
}

// ===========================
// Volume Multiplier
// ===========================

/**
 * Calculate volume confirmation multiplier based on z-score
 * Spec rules:
 * - z ≤ -1.5 → 0.6
 * - -1.5 < z < 0 → 0.6 to 1.0 (linear)
 * - 0 ≤ z < 1.2 → 1.0 to 1.25 (linear)
 * - z ≥ 1.2 → 1.25
 */
export function calculateVolumeMultiplier(volZ: number): number {
  if (volZ <= -1.5) {
    return 0.6;
  } else if (volZ < 0) {
    // Linear interpolation from 0.6 to 1.0
    const t = (volZ + 1.5) / 1.5; // Maps [-1.5, 0] to [0, 1]
    return 0.6 + (t * 0.4);
  } else if (volZ < 1.2) {
    // Linear interpolation from 1.0 to 1.25
    const t = volZ / 1.2; // Maps [0, 1.2] to [0, 1]
    return 1.0 + (t * 0.25);
  } else {
    return 1.25;
  }
}

// ===========================
// Regime Multiplier
// ===========================

/**
 * Calculate market regime multiplier based on direction
 * Spec rules:
 * - LONG: bullish 1.10, neutral 1.00, bearish 0.85
 * - SHORT: bullish 0.85, neutral 1.00, bearish 1.10
 */
export function calculateRegimeMultiplier(
  direction: Direction,
  spyRegime: MarketRegime
): number {
  if (direction === 'long') {
    switch (spyRegime) {
      case 'bullish': return 1.10;
      case 'neutral': return 1.00;
      case 'bearish': return 0.85;
    }
  } else {
    // short
    switch (spyRegime) {
      case 'bullish': return 0.85;
      case 'neutral': return 1.00;
      case 'bearish': return 1.10;
    }
  }
}

/**
 * Calculate combined multipliers
 */
export function calculateMultipliers(
  volZ: number,
  direction: Direction,
  spyRegime: MarketRegime
): MultiplierResult {
  const volume = calculateVolumeMultiplier(volZ);
  const regime = calculateRegimeMultiplier(direction, spyRegime);
  const combined = volume * regime;
  
  return { volume, regime, combined };
}

// ===========================
// Risk/Reward Calculations
// ===========================

/**
 * Calculate risk/reward ratio for LONG position
 */
export function calculateRRLong(
  entry: number,
  stop: number,
  target: number
): number {
  const risk = entry - stop;
  const reward = target - entry;
  
  if (risk <= 0) return 0;
  return reward / risk;
}

/**
 * Calculate risk/reward ratio for SHORT position
 */
export function calculateRRShort(
  entry: number,
  stop: number,
  target: number
): number {
  const risk = stop - entry;
  const reward = entry - target;
  
  if (risk <= 0) return 0;
  return reward / risk;
}

/**
 * Calculate RR based on direction
 */
export function calculateRR(
  direction: Direction,
  entry: number,
  stop: number,
  target: number
): number {
  return direction === 'long' 
    ? calculateRRLong(entry, stop, target)
    : calculateRRShort(entry, stop, target);
}

/**
 * Validate minimum RR requirement (first target must be >= 1.5)
 * Uses epsilon for floating point comparison
 */
export function validateMinimumRR(rrFirst: number): boolean {
  const EPSILON = 0.01; // Allow small floating point errors
  return rrFirst >= (1.5 - EPSILON);
}

// ===========================
// Utility Functions
// ===========================

/**
 * Calculate ATR percentage of price
 */
export function calculateATRPct(atr: number, price: number): number {
  return (atr / price) * 100;
}

/**
 * Calculate distance from price to level in ATR units
 */
export function calculateATRDistance(
  price: number,
  level: number,
  atr: number
): number {
  return Math.abs(price - level) / atr;
}

/**
 * Check if price is within distance of a level
 */
export function isWithinATRDistance(
  price: number,
  level: number,
  atr: number,
  maxDistance: number
): boolean {
  const distance = calculateATRDistance(price, level, atr);
  return distance <= maxDistance;
}

/**
 * Find swing high in recent bars
 */
export function findSwingHigh(high: number[], lookback: number = 20): number {
  const recentHigh = high.slice(-lookback);
  return Math.max(...recentHigh);
}

/**
 * Find swing low in recent bars
 */
export function findSwingLow(low: number[], lookback: number = 20): number {
  const recentLow = low.slice(-lookback);
  return Math.min(...recentLow);
}

/**
 * Check if EMAs are in bullish alignment (20 > 50 > 200)
 */
export function isBullishAlignment(
  ema20: number,
  ema50: number,
  ema200: number
): boolean {
  return ema20 > ema50 && ema50 > ema200;
}

/**
 * Check if EMAs are in bearish alignment (20 < 50 < 200)
 */
export function isBearishAlignment(
  ema20: number,
  ema50: number,
  ema200: number
): boolean {
  return ema20 < ema50 && ema50 < ema200;
}

/**
 * Check if ATR is declining (comparing recent vs older period)
 */
export function isATRDeclining(bars: any[], atr: number): boolean {
  if (bars.length < 40) return false;
  
  // Compare current ATR to ATR from 20 bars ago
  const olderBars = bars.slice(-40, -20);
  const trueRanges: number[] = [];
  
  for (let i = 1; i < olderBars.length; i++) {
    const high = olderBars[i].high;
    const low = olderBars[i].low;
    const prevClose = olderBars[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  
  const olderATR = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  
  return atr < olderATR * 0.9; // Declining if 10% lower
}

/**
 * Count consecutive red candles
 */
export function countRedCandles(bars: any[], count: number = 3): boolean {
  if (bars.length < count) return false;
  
  const recentBars = bars.slice(-count);
  return recentBars.every(bar => bar.close < bar.open);
}

/**
 * Count consecutive green candles
 */
export function countGreenCandles(bars: any[], count: number = 2): boolean {
  if (bars.length < count) return false;
  
  const recentBars = bars.slice(-count);
  return recentBars.every(bar => bar.close > bar.open);
}

/**
 * Check for bearish engulfing pattern
 */
export function isBearishEngulfing(bars: any[]): boolean {
  if (bars.length < 2) return false;
  
  const prev = bars[bars.length - 2];
  const curr = bars[bars.length - 1];
  
  // Previous is bullish, current is bearish
  const prevBullish = prev.close > prev.open;
  const currBearish = curr.close < curr.open;
  
  // Current engulfs previous
  const engulfs = curr.open > prev.close && curr.close < prev.open;
  
  return prevBullish && currBearish && engulfs;
}

/**
 * Check for bullish engulfing pattern
 */
export function isBullishEngulfing(bars: any[]): boolean {
  if (bars.length < 2) return false;
  
  const prev = bars[bars.length - 2];
  const curr = bars[bars.length - 1];
  
  // Previous is bearish, current is bullish
  const prevBearish = prev.close < prev.open;
  const currBullish = curr.close > curr.open;
  
  // Current engulfs previous
  const engulfs = curr.open < prev.close && curr.close > prev.open;
  
  return prevBearish && currBullish && engulfs;
}

/**
 * Check for hammer candle (bullish reversal)
 */
export function isHammer(bar: any): boolean {
  const body = Math.abs(bar.close - bar.open);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;
  const upperWick = bar.high - Math.max(bar.open, bar.close);
  
  // Lower wick at least 2x body, upper wick small
  return lowerWick >= body * 2 && upperWick <= body * 0.5;
}

/**
 * Calculate total range of green bars (for flag breakout confirmation)
 */
export function calculateGreenBarsRange(bars: any[], count: number = 2): number {
  if (bars.length < count) return 0;
  
  const recentBars = bars.slice(-count);
  const greenBars = recentBars.filter(bar => bar.close > bar.open);
  
  if (greenBars.length !== count) return 0;
  
  const totalRange = greenBars.reduce((sum, bar) => sum + (bar.high - bar.low), 0);
  return totalRange;
}

