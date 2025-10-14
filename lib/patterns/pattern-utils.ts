/**
 * Shared Pattern Detection Utilities
 * Deterministic, explainable functions for pattern analysis
 */

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Two-Tier Pattern System Interfaces
 */

export interface InstitutionalPattern {
  name: string;
  type: 'reversal' | 'continuation';
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-95
  confidenceLabel: string;
  breakoutStatus: 'none' | 'pending' | 'confirmed' | 'retest';
  priceTarget: number | null;
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  volumeZScore: number;
  reasons: string[]; // Top 3 numeric facts
  metadata: Record<string, any>;
}

export interface CandidatePattern {
  name: string;
  type: 'reversal' | 'continuation';
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // Capped at 80
  confidenceLabel: string;
  metCriteria: string[]; // Bullets of what passed
  unmetCriteria: string[]; // Bullets with numeric deltas
  nextSteps: string[]; // What confirmations are needed
  metadata: Record<string, any>;
}

export interface TwoTierPatternResult {
  institutional: InstitutionalPattern | null;
  candidate: CandidatePattern | null;
  discarded: InstitutionalPattern | null; // For extreme rule violations
}

/**
 * Calculate ATR(14) using True Range with gaps
 */
export function calculateATR(bars: OHLCV[], period: number = 14): number {
  if (bars.length < period + 1) return 0;
  
  const trueRanges: number[] = [];
  
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }
  
  // Simple moving average of true ranges
  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((sum, tr) => sum + tr, 0) / period;
}

/**
 * Unified confidence labeling (90-95 "very high", 75-89 "high", etc.)
 * All confidences capped at 95 for realism
 */
export function getConfidenceLabel(confidence: number): string {
  const capped = Math.min(95, confidence);
  
  if (capped >= 90) return "very high confidence";
  if (capped >= 75) return "high confidence";
  if (capped >= 60) return "moderate confidence";
  if (capped >= 45) return "low confidence";
  return "very low confidence";
}

/**
 * Calculate volume Z-score using canonical 20-bar window
 * Rounds to 2 decimals for consistency across all reports
 */
export function calculateVolumeZScore(bars: OHLCV[], window: number = 20): number {
  if (bars.length < window + 1) return 0;
  
  // Use prior N-1 bars for mean/stddev, current bar for Z-score
  const priorVolumes = bars.slice(-(window + 1), -1).map(b => b.volume);
  const currentVolume = bars[bars.length - 1].volume;
  
  const mean = priorVolumes.reduce((sum, v) => sum + v, 0) / priorVolumes.length;
  const squareDiffs = priorVolumes.map(v => (v - mean) ** 2);
  const stdDev = Math.sqrt(squareDiffs.reduce((sum, d) => sum + d, 0) / priorVolumes.length);
  
  if (stdDev === 0) return 0;
  
  const zScore = (currentVolume - mean) / stdDev;
  return Math.round(zScore * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate linear regression for trendline
 */
export function linearRegression(values: number[]): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0, r2: 0 };
  
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, y) => sum + y, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  let ssRes = 0;
  let ssTot = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  
  // Calculate R²
  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }
  
  const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
  
  return { slope, intercept, r2: Math.max(0, r2) };
}

/**
 * Count touches to a trendline
 */
export function countTouches(
  values: number[],
  slope: number,
  intercept: number,
  threshold: number
): number {
  let touches = 0;
  
  for (let i = 0; i < values.length; i++) {
    const predicted = slope * i + intercept;
    const distance = Math.abs(values[i] - predicted);
    
    if (distance <= threshold) {
      touches++;
    }
  }
  
  return touches;
}

/**
 * Find peaks in price data
 */
export function findPeaks(values: number[], lookback: number = 3): number[] {
  const peaks: number[] = [];
  
  for (let i = lookback; i < values.length - lookback; i++) {
    let isPeak = true;
    for (let j = 1; j <= lookback; j++) {
      if (values[i] <= values[i - j] || values[i] <= values[i + j]) {
        isPeak = false;
        break;
      }
    }
    if (isPeak) peaks.push(i);
  }
  
  return peaks;
}

/**
 * Find troughs in price data
 */
export function findTroughs(values: number[], lookback: number = 3): number[] {
  const troughs: number[] = [];
  
  for (let i = lookback; i < values.length - lookback; i++) {
    let isTrough = true;
    for (let j = 1; j <= lookback; j++) {
      if (values[i] >= values[i - j] || values[i] >= values[i + j]) {
        isTrough = false;
        break;
      }
    }
    if (isTrough) troughs.push(i);
  }
  
  return troughs;
}

/**
 * Check if slopes are parallel (normalized % per bar)
 */
export function areSlopesParallel(
  slope1: number,
  slope2: number,
  avgPrice: number,
  threshold: number = 0.1 // 0.1% per bar difference
): boolean {
  const slope1PctPerBar = (slope1 / avgPrice) * 100;
  const slope2PctPerBar = (slope2 / avgPrice) * 100;
  
  return Math.abs(slope1PctPerBar - slope2PctPerBar) <= threshold;
}

/**
 * Calculate width as % of price
 */
export function calculateWidthPercent(high: number, low: number, avgPrice: number): number {
  return ((high - low) / avgPrice) * 100;
}

/**
 * EMA Alignment & Trend (single source of truth)
 */
export interface EMAData {
  ema9: number;
  ema20: number;
  ema50: number;
  ema200: number;
}

export interface TrendAnalysis {
  alignment: 'bullish' | 'bearish' | 'mixed';
  longTermBias: 'bullish' | 'bearish';
  bandCompression: 'compressed' | 'normal' | 'wide';
  bandPercent: number;
}

export function analyzeTrend(price: number, emas: EMAData): TrendAnalysis {
  // Alignment: bullish if EMA9 > EMA20 > EMA50 > EMA200
  const bullishAlignment = 
    emas.ema9 > emas.ema20 && 
    emas.ema20 > emas.ema50 && 
    emas.ema50 > emas.ema200;
  
  const bearishAlignment = 
    emas.ema9 < emas.ema20 && 
    emas.ema20 < emas.ema50 && 
    emas.ema50 < emas.ema200;
  
  const alignment: 'bullish' | 'bearish' | 'mixed' = 
    bullishAlignment ? 'bullish' : 
    bearishAlignment ? 'bearish' : 'mixed';
  
  // Long-term bias: bullish if price > EMA200
  const longTermBias: 'bullish' | 'bearish' = price > emas.ema200 ? 'bullish' : 'bearish';
  
  // EMA band compression: (max - min) / price × 100
  const maxEMA = Math.max(emas.ema9, emas.ema20, emas.ema50);
  const minEMA = Math.min(emas.ema9, emas.ema20, emas.ema50);
  const bandPercent = ((maxEMA - minEMA) / price) * 100;
  
  const bandCompression: 'compressed' | 'normal' | 'wide' = 
    bandPercent <= 1.5 ? 'compressed' : 
    bandPercent <= 5.0 ? 'normal' : 'wide';
  
  return {
    alignment,
    longTermBias,
    bandCompression,
    bandPercent: Math.round(bandPercent * 100) / 100
  };
}

/**
 * Check breakout status with volume confirmation
 */
export function checkBreakoutStatus(
  currentPrice: number,
  breakoutLevel: number,
  direction: 'bullish' | 'bearish',
  volumeZScore: number,
  atr: number,
  bars: OHLCV[]
): 'none' | 'pending' | 'confirmed' | 'retest' {
  const retestThreshold = atr * 0.5;
  
  if (direction === 'bullish') {
    if (currentPrice > breakoutLevel) {
      // Check if volume confirms
      if (volumeZScore >= 1.0) {
        // Check for retest: did price come back within 0.5 ATR after breaking out?
        const breakoutBarIdx = bars.findIndex(b => b.close > breakoutLevel);
        if (breakoutBarIdx > 0 && breakoutBarIdx < bars.length - 1) {
          const barsAfterBreakout = bars.slice(breakoutBarIdx + 1);
          const hasRetest = barsAfterBreakout.some(b => 
            b.low <= breakoutLevel + retestThreshold && b.close > breakoutLevel
          );
          return hasRetest ? 'retest' : 'confirmed';
        }
        return 'confirmed';
      }
      return 'pending';
    }
  } else {
    if (currentPrice < breakoutLevel) {
      if (volumeZScore >= 1.0) {
        const breakoutBarIdx = bars.findIndex(b => b.close < breakoutLevel);
        if (breakoutBarIdx > 0 && breakoutBarIdx < bars.length - 1) {
          const barsAfterBreakout = bars.slice(breakoutBarIdx + 1);
          const hasRetest = barsAfterBreakout.some(b => 
            b.high >= breakoutLevel - retestThreshold && b.close < breakoutLevel
          );
          return hasRetest ? 'retest' : 'confirmed';
        }
        return 'confirmed';
      }
      return 'pending';
    }
  }
  
  return 'none';
}

