/**
 * Candlestick Pattern Detection V2 - Deterministic & Fact-Based
 * Each pattern includes validation facts for explainability
 */

import { getConfidenceLabel, calculateVolumeZScore } from './pattern-utils';

interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlestickFacts {
  bodyPct?: number;        // Body as % of range
  wickTopPct?: number;     // Top wick as % of range
  wickBotPct?: number;     // Bottom wick as % of range
  engulfPct?: number;      // Engulfment percentage
  gapPct?: number;         // Gap percentage
  volRatio?: number;       // Volume ratio to previous
  volZ?: number;           // Volume Z-score
  closeLocationPct?: number; // Where close is in the range (0=low, 100=high)
}

export interface CandlestickPattern {
  name: string;
  type: "bullish" | "bearish" | "neutral";
  confidence: number; // 0-95 (capped)
  confidenceLabel: string;
  description: string;
  timeframe: string;
  facts: CandlestickFacts;
  confirmationNeeded?: boolean;
  reasons: string[];
}

/**
 * Calculate basic candle metrics
 */
function analyzeCandle(bar: OHLCV, prevBar?: OHLCV): {
  body: number;
  range: number;
  wickTop: number;
  wickBot: number;
  bodyPct: number;
  wickTopPct: number;
  wickBotPct: number;
  closeLocationPct: number;
  volRatio?: number;
} {
  const body = Math.abs(bar.close - bar.open);
  const range = bar.high - bar.low;
  const wickTop = bar.high - Math.max(bar.open, bar.close);
  const wickBot = Math.min(bar.open, bar.close) - bar.low;
  
  const bodyPct = range > 0 ? (body / range) * 100 : 0;
  const wickTopPct = range > 0 ? (wickTop / range) * 100 : 0;
  const wickBotPct = range > 0 ? (wickBot / range) * 100 : 0;
  const closeLocationPct = range > 0 ? ((bar.close - bar.low) / range) * 100 : 50;
  
  const volRatio = prevBar ? bar.volume / prevBar.volume : undefined;
  
  return {
    body,
    range,
    wickTop,
    wickBot,
    bodyPct,
    wickTopPct,
    wickBotPct,
    closeLocationPct,
    volRatio
  };
}

/**
 * Detect Bullish Engulfing
 * Requirements: Current body ≥ 1.1× prior body, complete engulfment, volume boost
 */
export function detectBullishEngulfing(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 2) return null;

  const current = bars[bars.length - 1];
  const prior = bars[bars.length - 2];
  
  // Must be bullish candle
  if (current.close <= current.open) return null;
  
  // Prior should be bearish
  if (prior.close >= prior.open) return null;

  const currentBody = current.close - current.open;
  const priorBody = Math.abs(prior.close - prior.open);
  
  // Body size requirement
  if (currentBody < priorBody * 1.1) return null;
  
  // Engulfment check
  if (current.open > prior.close || current.close < prior.open) return null;
  
  const engulfPct = (currentBody / priorBody) * 100;
  const metrics = analyzeCandle(current, prior);
  
  // Use canonical 20-bar window for volZ
  const volZ = calculateVolumeZScore(bars);
  
  let confidence = 50;
  if (engulfPct >= 120) confidence += 15;
  else if (engulfPct >= 110) confidence += 10;
  if (metrics.volRatio && metrics.volRatio >= 1.2) confidence += 10;
  if (volZ > 0.5) confidence += 5;
  if (volZ > 1.0) confidence += 5;
  if (current.close > prior.high) confidence += 5; // Full engulfment
  
  const cappedConfidence = Math.min(95, confidence);
  
  const reasons: string[] = [];
  reasons.push(`Body engulfs prior by ${engulfPct.toFixed(0)}%`);
  if (metrics.volRatio) reasons.push(`Volume ratio: ${metrics.volRatio.toFixed(2)}×`);
  reasons.push(`Volume Z-score: ${volZ.toFixed(1)}`);
  if (current.close > prior.high) reasons.push('Full engulfment above prior high');
  
  return {
    name: "Bullish Engulfing",
    type: "bullish",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "Bullish candle engulfs prior bearish body, reversal signal",
    timeframe: "1 bar",
    facts: {
      bodyPct: Number(metrics.bodyPct.toFixed(1)),
      engulfPct: Number(engulfPct.toFixed(1)),
      volRatio: metrics.volRatio,
      volZ: Number(volZ.toFixed(2))
    },
    reasons
  };
}

/**
 * Detect Bearish Engulfing
 */
export function detectBearishEngulfing(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 2) return null;

  const current = bars[bars.length - 1];
  const prior = bars[bars.length - 2];
  
  if (current.close >= current.open) return null;
  if (prior.close <= prior.open) return null;

  const currentBody = current.open - current.close;
  const priorBody = Math.abs(prior.close - prior.open);
  
  if (currentBody < priorBody * 1.1) return null;
  if (current.open < prior.close || current.close > prior.open) return null;
  
  const engulfPct = (currentBody / priorBody) * 100;
  const metrics = analyzeCandle(current, prior);
  
  // Use canonical 20-bar window for volZ
  const volZ = calculateVolumeZScore(bars);
  
  let confidence = 50;
  if (engulfPct >= 120) confidence += 15;
  else if (engulfPct >= 110) confidence += 10;
  if (metrics.volRatio && metrics.volRatio >= 1.2) confidence += 10;
  if (volZ > 0.5) confidence += 5;
  if (volZ > 1.0) confidence += 5;
  if (current.close < prior.low) confidence += 5;
  
  const cappedConfidence = Math.min(95, confidence);
  
  const reasons: string[] = [];
  reasons.push(`Body engulfs prior by ${engulfPct.toFixed(0)}%`);
  if (metrics.volRatio) reasons.push(`Volume ratio: ${metrics.volRatio.toFixed(2)}×`);
  reasons.push(`Volume Z-score: ${volZ.toFixed(1)}`);
  if (current.close < prior.low) reasons.push('Full engulfment below prior low');
  
  return {
    name: "Bearish Engulfing",
    type: "bearish",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "Bearish candle engulfs prior bullish body, reversal signal",
    timeframe: "1 bar",
    facts: {
      bodyPct: Number(metrics.bodyPct.toFixed(1)),
      engulfPct: Number(engulfPct.toFixed(1)),
      volRatio: metrics.volRatio,
      volZ: Number(volZ.toFixed(2))
    },
    reasons
  };
}

/**
 * Detect Hammer
 * Requirements: Wick ≥ 2× body, close ≥ 60% of range, tiny top wick
 */
export function detectHammer(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 1) return null;

  const current = bars[bars.length - 1];
  const metrics = analyzeCandle(current, bars.length > 1 ? bars[bars.length - 2] : undefined);
  
  // Bottom wick must be ≥ 2× body
  if (metrics.wickBot < metrics.body * 2) return null;
  
  // Close should be near top (≥60% of range)
  if (metrics.closeLocationPct < 60) return null;
  
  // Top wick should be tiny
  if (metrics.wickTopPct > 15) return null;
  
  const wickToBodyRatio = metrics.body > 0 ? metrics.wickBot / metrics.body : 0;
  
  let confidence = 50;
  if (wickToBodyRatio >= 3) confidence += 15;
  else if (wickToBodyRatio >= 2) confidence += 10;
  if (metrics.closeLocationPct >= 75) confidence += 10;
  if (metrics.closeLocationPct >= 85) confidence += 5;
  if (metrics.wickTopPct <= 10) confidence += 5;
  if (metrics.volRatio && metrics.volRatio >= 1.1) confidence += 5;
  
  const cappedConfidence = Math.min(95, confidence);
  
  const reasons: string[] = [];
  reasons.push(`Bottom wick ${wickToBodyRatio.toFixed(1)}× body size`);
  reasons.push(`Close at ${metrics.closeLocationPct.toFixed(0)}% of range`);
  reasons.push(`Top wick only ${metrics.wickTopPct.toFixed(0)}% (valid hammer)`);
  
  return {
    name: "Hammer",
    type: "bullish",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "Long lower wick shows rejection of lower prices, bullish reversal",
    timeframe: "1 bar",
    facts: {
      bodyPct: Number(metrics.bodyPct.toFixed(1)),
      wickTopPct: Number(metrics.wickTopPct.toFixed(1)),
      wickBotPct: Number(metrics.wickBotPct.toFixed(1)),
      closeLocationPct: Number(metrics.closeLocationPct.toFixed(1))
    },
    reasons
  };
}

/**
 * Detect Shooting Star
 * Requirements: Top wick ≥ 2× body, close ≤ 40% of range, tiny bottom wick
 */
export function detectShootingStar(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 1) return null;

  const current = bars[bars.length - 1];
  const metrics = analyzeCandle(current, bars.length > 1 ? bars[bars.length - 2] : undefined);
  
  if (metrics.wickTop < metrics.body * 2) return null;
  if (metrics.closeLocationPct > 40) return null;
  if (metrics.wickBotPct > 15) return null;
  
  const wickToBodyRatio = metrics.body > 0 ? metrics.wickTop / metrics.body : 0;
  
  let confidence = 50;
  if (wickToBodyRatio >= 3) confidence += 15;
  else if (wickToBodyRatio >= 2) confidence += 10;
  if (metrics.closeLocationPct <= 25) confidence += 10;
  if (metrics.closeLocationPct <= 15) confidence += 5;
  if (metrics.wickBotPct <= 10) confidence += 5;
  if (metrics.volRatio && metrics.volRatio >= 1.1) confidence += 5;
  
  const cappedConfidence = Math.min(95, confidence);
  
  const reasons: string[] = [];
  reasons.push(`Top wick ${wickToBodyRatio.toFixed(1)}× body size`);
  reasons.push(`Close at ${metrics.closeLocationPct.toFixed(0)}% of range`);
  reasons.push(`Bottom wick only ${metrics.wickBotPct.toFixed(0)}% (valid shooting star)`);
  
  return {
    name: "Shooting Star",
    type: "bearish",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "Long upper wick shows rejection of higher prices, bearish reversal",
    timeframe: "1 bar",
    facts: {
      bodyPct: Number(metrics.bodyPct.toFixed(1)),
      wickTopPct: Number(metrics.wickTopPct.toFixed(1)),
      wickBotPct: Number(metrics.wickBotPct.toFixed(1)),
      closeLocationPct: Number(metrics.closeLocationPct.toFixed(1))
    },
    reasons
  };
}

/**
 * Detect Doji
 * Requirements: Body ≤ 10% of range
 */
export function detectDoji(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 1) return null;

  const current = bars[bars.length - 1];
  const metrics = analyzeCandle(current);
  
  if (metrics.bodyPct > 10) return null;
  
  let confidence = 40; // Lower base for doji (needs confirmation)
  if (metrics.bodyPct <= 5) confidence += 10;
  if (metrics.bodyPct <= 3) confidence += 5;
  
  const cappedConfidence = Math.min(95, confidence);
  
  const reasons: string[] = [];
  reasons.push(`Tiny body: ${metrics.bodyPct.toFixed(1)}% of range`);
  reasons.push('Indecision candle - needs next bar confirmation');
  
  return {
    name: "Doji",
    type: "neutral",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "Indecision candle, wait for next bar direction",
    timeframe: "1 bar",
    facts: {
      bodyPct: Number(metrics.bodyPct.toFixed(1)),
      wickTopPct: Number(metrics.wickTopPct.toFixed(1)),
      wickBotPct: Number(metrics.wickBotPct.toFixed(1))
    },
    confirmationNeeded: true,
    reasons
  };
}

/**
 * Detect Inside Bar (Harami)
 * Requirements: Current high/low inside prior bar
 */
export function detectInsideBar(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 2) return null;

  const current = bars[bars.length - 1];
  const prior = bars[bars.length - 2];
  
  if (current.high > prior.high || current.low < prior.low) return null;
  
  const currentRange = current.high - current.low;
  const priorRange = prior.high - prior.low;
  const rangePct = (currentRange / priorRange) * 100;
  
  let confidence = 45; // Lower base (needs breakout confirmation)
  if (rangePct <= 50) confidence += 10;
  if (rangePct <= 30) confidence += 5;
  
  const cappedConfidence = Math.min(95, confidence);
  
  const reasons: string[] = [];
  reasons.push(`Range ${rangePct.toFixed(0)}% of prior bar`);
  reasons.push('Inside bar - watch for breakout direction');
  
  return {
    name: "Inside Bar",
    type: "neutral",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "Consolidation inside prior bar, breakout pending",
    timeframe: "2 bars",
    facts: {
      bodyPct: Number(rangePct.toFixed(1))
    },
    confirmationNeeded: true,
    reasons
  };
}

/**
 * Detect Morning Star (3-candle bullish reversal)
 * Requirements: Bearish candle, small body/doji, bullish candle closing above midpoint of first
 */
export function detectMorningStar(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 3) return null;

  const first = bars[bars.length - 3];
  const second = bars[bars.length - 2];
  const third = bars[bars.length - 1];
  
  // First candle must be bearish with decent body
  const firstBody = Math.abs(first.close - first.open);
  const firstRange = first.high - first.low;
  if (first.close >= first.open || firstBody < firstRange * 0.5) return null;
  
  // Second candle must have small body (star)
  const secondBody = Math.abs(second.close - second.open);
  const secondRange = second.high - second.low;
  if (secondRange > 0 && secondBody / secondRange > 0.3) return null;
  
  // Second should gap down or be below first's close
  if (second.high > first.close) return null;
  
  // Third candle must be bullish
  if (third.close <= third.open) return null;
  
  // Third must close above midpoint of first candle
  const firstMidpoint = (first.open + first.close) / 2;
  if (third.close < firstMidpoint) return null;
  
  const metrics = analyzeCandle(third, second);
  const volZ = calculateVolumeZScore(bars);
  
  let confidence = 60;
  if (third.close > first.open) confidence += 15; // Full recovery
  if (secondBody / secondRange < 0.15) confidence += 10; // True doji star
  if (metrics.volRatio && metrics.volRatio >= 1.2) confidence += 5;
  if (volZ > 0.5) confidence += 5;
  
  const cappedConfidence = Math.min(95, confidence);
  
  return {
    name: "Morning Star",
    type: "bullish",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "3-candle bullish reversal: bearish, star, bullish recovery",
    timeframe: "3 bars",
    facts: {
      bodyPct: Number(((secondBody / secondRange) * 100).toFixed(1)),
      volZ: Number(volZ.toFixed(2))
    },
    reasons: [
      'Strong bearish first candle',
      `Small-body star (${((secondBody / secondRange) * 100).toFixed(0)}% body)`,
      `Bullish third candle closes ${third.close > first.open ? 'above first open' : 'above midpoint'}`
    ]
  };
}

/**
 * Detect Evening Star (3-candle bearish reversal)
 */
export function detectEveningStar(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 3) return null;

  const first = bars[bars.length - 3];
  const second = bars[bars.length - 2];
  const third = bars[bars.length - 1];
  
  // First candle must be bullish with decent body
  const firstBody = Math.abs(first.close - first.open);
  const firstRange = first.high - first.low;
  if (first.close <= first.open || firstBody < firstRange * 0.5) return null;
  
  // Second candle must have small body (star)
  const secondBody = Math.abs(second.close - second.open);
  const secondRange = second.high - second.low;
  if (secondRange > 0 && secondBody / secondRange > 0.3) return null;
  
  // Second should gap up or be above first's close
  if (second.low < first.close) return null;
  
  // Third candle must be bearish
  if (third.close >= third.open) return null;
  
  // Third must close below midpoint of first candle
  const firstMidpoint = (first.open + first.close) / 2;
  if (third.close > firstMidpoint) return null;
  
  const metrics = analyzeCandle(third, second);
  const volZ = calculateVolumeZScore(bars);
  
  let confidence = 60;
  if (third.close < first.open) confidence += 15;
  if (secondBody / secondRange < 0.15) confidence += 10;
  if (metrics.volRatio && metrics.volRatio >= 1.2) confidence += 5;
  if (volZ > 0.5) confidence += 5;
  
  const cappedConfidence = Math.min(95, confidence);
  
  return {
    name: "Evening Star",
    type: "bearish",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "3-candle bearish reversal: bullish, star, bearish drop",
    timeframe: "3 bars",
    facts: {
      bodyPct: Number(((secondBody / secondRange) * 100).toFixed(1)),
      volZ: Number(volZ.toFixed(2))
    },
    reasons: [
      'Strong bullish first candle',
      `Small-body star (${((secondBody / secondRange) * 100).toFixed(0)}% body)`,
      `Bearish third candle closes ${third.close < first.open ? 'below first open' : 'below midpoint'}`
    ]
  };
}

/**
 * Detect Piercing Line (2-candle bullish reversal)
 */
export function detectPiercingLine(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 2) return null;

  const prior = bars[bars.length - 2];
  const current = bars[bars.length - 1];
  
  // Prior must be bearish
  if (prior.close >= prior.open) return null;
  
  // Current must be bullish
  if (current.close <= current.open) return null;
  
  // Current must open below prior's low (gap down)
  if (current.open >= prior.low) return null;
  
  // Current must close above midpoint of prior candle
  const priorMidpoint = (prior.open + prior.close) / 2;
  if (current.close < priorMidpoint) return null;
  
  // But not engulf (otherwise it's a bullish engulfing)
  if (current.close >= prior.open) return null;
  
  const penetrationPct = ((current.close - prior.close) / (prior.open - prior.close)) * 100;
  const volZ = calculateVolumeZScore(bars);
  
  let confidence = 55;
  if (penetrationPct >= 60) confidence += 10;
  if (penetrationPct >= 75) confidence += 5;
  if (volZ > 0.5) confidence += 5;
  
  const cappedConfidence = Math.min(95, confidence);
  
  return {
    name: "Piercing Line",
    type: "bullish",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "Gap down then strong recovery above midpoint, bullish reversal",
    timeframe: "2 bars",
    facts: {
      bodyPct: Number(penetrationPct.toFixed(1)),
      volZ: Number(volZ.toFixed(2))
    },
    reasons: [
      'Gapped down below prior low',
      `Recovered ${penetrationPct.toFixed(0)}% into prior body`,
      'Bulls stepped in aggressively'
    ]
  };
}

/**
 * Detect Dark Cloud Cover (2-candle bearish reversal)
 */
export function detectDarkCloudCover(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 2) return null;

  const prior = bars[bars.length - 2];
  const current = bars[bars.length - 1];
  
  // Prior must be bullish
  if (prior.close <= prior.open) return null;
  
  // Current must be bearish
  if (current.close >= current.open) return null;
  
  // Current must open above prior's high (gap up)
  if (current.open <= prior.high) return null;
  
  // Current must close below midpoint of prior candle
  const priorMidpoint = (prior.open + prior.close) / 2;
  if (current.close > priorMidpoint) return null;
  
  // But not engulf
  if (current.close <= prior.open) return null;
  
  const penetrationPct = ((prior.close - current.close) / (prior.close - prior.open)) * 100;
  const volZ = calculateVolumeZScore(bars);
  
  let confidence = 55;
  if (penetrationPct >= 60) confidence += 10;
  if (penetrationPct >= 75) confidence += 5;
  if (volZ > 0.5) confidence += 5;
  
  const cappedConfidence = Math.min(95, confidence);
  
  return {
    name: "Dark Cloud Cover",
    type: "bearish",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "Gap up then strong selloff below midpoint, bearish reversal",
    timeframe: "2 bars",
    facts: {
      bodyPct: Number(penetrationPct.toFixed(1)),
      volZ: Number(volZ.toFixed(2))
    },
    reasons: [
      'Gapped up above prior high',
      `Sold off ${penetrationPct.toFixed(0)}% into prior body`,
      'Bears rejected higher prices'
    ]
  };
}

/**
 * Detect Three White Soldiers (3-candle bullish continuation/reversal)
 */
export function detectThreeWhiteSoldiers(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 3) return null;

  const candles = bars.slice(-3);
  
  // All three must be bullish
  for (const c of candles) {
    if (c.close <= c.open) return null;
  }
  
  // Each must close higher than prior
  for (let i = 1; i < 3; i++) {
    if (candles[i].close <= candles[i-1].close) return null;
  }
  
  // Each must open within prior body
  for (let i = 1; i < 3; i++) {
    if (candles[i].open <= candles[i-1].open || candles[i].open >= candles[i-1].close) return null;
  }
  
  // Bodies should be substantial (not tiny wicks)
  let avgBodyPct = 0;
  for (const c of candles) {
    const body = c.close - c.open;
    const range = c.high - c.low;
    avgBodyPct += range > 0 ? (body / range) * 100 : 0;
  }
  avgBodyPct /= 3;
  
  if (avgBodyPct < 50) return null;
  
  const volZ = calculateVolumeZScore(bars);
  
  let confidence = 65;
  if (avgBodyPct >= 70) confidence += 10;
  if (volZ > 0.5) confidence += 5;
  if (volZ > 1.0) confidence += 5;
  
  const cappedConfidence = Math.min(95, confidence);
  
  return {
    name: "Three White Soldiers",
    type: "bullish",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "3 consecutive bullish candles with higher closes, strong bullish signal",
    timeframe: "3 bars",
    facts: {
      bodyPct: Number(avgBodyPct.toFixed(1)),
      volZ: Number(volZ.toFixed(2))
    },
    reasons: [
      '3 consecutive bullish candles',
      'Each closes higher than prior',
      `Strong bodies (avg ${avgBodyPct.toFixed(0)}% body)`
    ]
  };
}

/**
 * Detect Three Black Crows (3-candle bearish continuation/reversal)
 */
export function detectThreeBlackCrows(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 3) return null;

  const candles = bars.slice(-3);
  
  // All three must be bearish
  for (const c of candles) {
    if (c.close >= c.open) return null;
  }
  
  // Each must close lower than prior
  for (let i = 1; i < 3; i++) {
    if (candles[i].close >= candles[i-1].close) return null;
  }
  
  // Each must open within prior body
  for (let i = 1; i < 3; i++) {
    if (candles[i].open >= candles[i-1].open || candles[i].open <= candles[i-1].close) return null;
  }
  
  // Bodies should be substantial
  let avgBodyPct = 0;
  for (const c of candles) {
    const body = c.open - c.close;
    const range = c.high - c.low;
    avgBodyPct += range > 0 ? (body / range) * 100 : 0;
  }
  avgBodyPct /= 3;
  
  if (avgBodyPct < 50) return null;
  
  const volZ = calculateVolumeZScore(bars);
  
  let confidence = 65;
  if (avgBodyPct >= 70) confidence += 10;
  if (volZ > 0.5) confidence += 5;
  if (volZ > 1.0) confidence += 5;
  
  const cappedConfidence = Math.min(95, confidence);
  
  return {
    name: "Three Black Crows",
    type: "bearish",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "3 consecutive bearish candles with lower closes, strong bearish signal",
    timeframe: "3 bars",
    facts: {
      bodyPct: Number(avgBodyPct.toFixed(1)),
      volZ: Number(volZ.toFixed(2))
    },
    reasons: [
      '3 consecutive bearish candles',
      'Each closes lower than prior',
      `Strong bodies (avg ${avgBodyPct.toFixed(0)}% body)`
    ]
  };
}

/**
 * Detect Bullish Harami (smaller bullish candle inside bearish)
 */
export function detectBullishHarami(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 2) return null;

  const prior = bars[bars.length - 2];
  const current = bars[bars.length - 1];
  
  // Prior must be bearish with substantial body
  if (prior.close >= prior.open) return null;
  const priorBody = prior.open - prior.close;
  const priorRange = prior.high - prior.low;
  if (priorRange > 0 && priorBody / priorRange < 0.5) return null;
  
  // Current must be bullish (or doji-ish)
  if (current.close < current.open) return null;
  
  // Current body must be inside prior body
  if (current.open < prior.close || current.close > prior.open) return null;
  
  const currentBody = Math.abs(current.close - current.open);
  const containmentPct = (currentBody / priorBody) * 100;
  
  let confidence = 50;
  if (containmentPct <= 50) confidence += 10;
  if (containmentPct <= 30) confidence += 5;
  
  const cappedConfidence = Math.min(95, confidence);
  
  return {
    name: "Bullish Harami",
    type: "bullish",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "Small bullish candle inside prior bearish, potential reversal",
    timeframe: "2 bars",
    facts: {
      bodyPct: Number(containmentPct.toFixed(1))
    },
    confirmationNeeded: true,
    reasons: [
      `Small body (${containmentPct.toFixed(0)}% of prior)`,
      'Contained within prior bearish candle',
      'Selling pressure may be exhausted'
    ]
  };
}

/**
 * Detect Bearish Harami (smaller bearish candle inside bullish)
 */
export function detectBearishHarami(bars: OHLCV[]): CandlestickPattern | null {
  if (bars.length < 2) return null;

  const prior = bars[bars.length - 2];
  const current = bars[bars.length - 1];
  
  // Prior must be bullish with substantial body
  if (prior.close <= prior.open) return null;
  const priorBody = prior.close - prior.open;
  const priorRange = prior.high - prior.low;
  if (priorRange > 0 && priorBody / priorRange < 0.5) return null;
  
  // Current must be bearish (or doji-ish)
  if (current.close > current.open) return null;
  
  // Current body must be inside prior body
  if (current.open > prior.close || current.close < prior.open) return null;
  
  const currentBody = Math.abs(current.close - current.open);
  const containmentPct = (currentBody / priorBody) * 100;
  
  let confidence = 50;
  if (containmentPct <= 50) confidence += 10;
  if (containmentPct <= 30) confidence += 5;
  
  const cappedConfidence = Math.min(95, confidence);
  
  return {
    name: "Bearish Harami",
    type: "bearish",
    confidence: Math.round(cappedConfidence),
    confidenceLabel: getConfidenceLabel(cappedConfidence),
    description: "Small bearish candle inside prior bullish, potential reversal",
    timeframe: "2 bars",
    facts: {
      bodyPct: Number(containmentPct.toFixed(1))
    },
    confirmationNeeded: true,
    reasons: [
      `Small body (${containmentPct.toFixed(0)}% of prior)`,
      'Contained within prior bullish candle',
      'Buying pressure may be exhausted'
    ]
  };
}

/**
 * Detect all candlestick patterns and return the most confident
 */
export function detectCandlestickPatterns(bars: OHLCV[]): CandlestickPattern {
  const patterns: (CandlestickPattern | null)[] = [
    detectBullishEngulfing(bars),
    detectBearishEngulfing(bars),
    detectHammer(bars),
    detectShootingStar(bars),
    detectMorningStar(bars),
    detectEveningStar(bars),
    detectPiercingLine(bars),
    detectDarkCloudCover(bars),
    detectThreeWhiteSoldiers(bars),
    detectThreeBlackCrows(bars),
    detectBullishHarami(bars),
    detectBearishHarami(bars),
    detectDoji(bars),
    detectInsideBar(bars),
  ];

  const validPatterns = patterns.filter((p): p is CandlestickPattern => p !== null);
  
  if (validPatterns.length === 0) {
    // Return basic trend if no pattern
    return detectBasicTrend(bars);
  }
  
  return validPatterns.sort((a, b) => b.confidence - a.confidence)[0];
}

/**
 * Scan last N bars for all candlestick patterns with context
 * Returns all detected patterns with their bar positions and outcome status
 */
export interface PatternWithContext {
  pattern: CandlestickPattern;
  barIndex: number; // Index from end (0 = most recent)
  nearSupport: boolean;
  nearResistance: boolean;
  nearEMA: boolean;
  // Pattern outcome tracking
  outcome: 'active' | 'confirmed' | 'failed';
  outcomeDescription: string;
}

export function scanRecentPatternsWithContext(
  bars: OHLCV[],
  lookback: number = 10,
  supportLevels: number[] = [],
  resistanceLevels: number[] = [],
  emaLevels: number[] = []
): PatternWithContext[] {
  const results: PatternWithContext[] = [];
  const atr = calculateATR(bars);
  
  // For each position in the lookback window, check for patterns
  for (let i = 0; i < Math.min(lookback, bars.length - 3); i++) {
    const endIndex = bars.length - i;
    const slice = bars.slice(0, endIndex);
    
    if (slice.length < 3) continue;
    
    const patternBarPrice = slice[slice.length - 1];
    
    // Check all pattern types
    const patternFunctions = [
      detectBullishEngulfing,
      detectBearishEngulfing,
      detectHammer,
      detectShootingStar,
      detectMorningStar,
      detectEveningStar,
      detectPiercingLine,
      detectDarkCloudCover,
      detectThreeWhiteSoldiers,
      detectThreeBlackCrows,
      detectBullishHarami,
      detectBearishHarami,
      detectDoji,
    ];
    
    for (const detectFn of patternFunctions) {
      const pattern = detectFn(slice);
      if (pattern && pattern.confidence >= 50) {
        // Check proximity to key levels (within 1.5x ATR)
        const proximityThreshold = atr * 1.5;
        
        const nearSupport = supportLevels.some(s => 
          Math.abs(patternBarPrice.close - s) <= proximityThreshold && patternBarPrice.close >= s * 0.98
        );
        const nearResistance = resistanceLevels.some(r => 
          Math.abs(r - patternBarPrice.close) <= proximityThreshold && patternBarPrice.close <= r * 1.02
        );
        const nearEMA = emaLevels.some(e => 
          Math.abs(patternBarPrice.close - e) <= proximityThreshold * 0.75
        );
        
        // Evaluate pattern outcome based on subsequent price action
        const { outcome, outcomeDescription } = evaluatePatternOutcome(
          pattern.type,
          patternBarPrice,
          bars.slice(endIndex), // Bars AFTER the pattern
          atr,
          i // barIndex
        );
        
        results.push({
          pattern,
          barIndex: i,
          nearSupport,
          nearResistance,
          nearEMA,
          outcome,
          outcomeDescription
        });
      }
    }
  }
  
  // Remove duplicates (same pattern name at same index), keep highest confidence
  const uniqueResults: PatternWithContext[] = [];
  const seen = new Set<string>();
  
  for (const r of results.sort((a, b) => b.pattern.confidence - a.pattern.confidence)) {
    const key = `${r.pattern.name}-${r.barIndex}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(r);
    }
  }
  
  // ============================================
  // CONFLICT RESOLUTION: Remove contradictory patterns on the same bar
  // When both bullish and bearish patterns exist on the same bar index,
  // keep only the one that matches the confirmed outcome or has higher confidence
  // ============================================
  const conflictResolved: PatternWithContext[] = [];
  const patternsByBar = new Map<number, PatternWithContext[]>();
  
  // Group patterns by bar index
  for (const p of uniqueResults) {
    const existing = patternsByBar.get(p.barIndex) || [];
    existing.push(p);
    patternsByBar.set(p.barIndex, existing);
  }
  
  // For each bar, resolve conflicts
  for (const [barIndex, patterns] of patternsByBar) {
    if (patterns.length === 1) {
      conflictResolved.push(patterns[0]);
      continue;
    }
    
    // Separate by type
    const bullish = patterns.filter(p => p.pattern.type === 'bullish');
    const bearish = patterns.filter(p => p.pattern.type === 'bearish');
    const neutral = patterns.filter(p => p.pattern.type === 'neutral');
    
    // If both bullish and bearish exist on same bar, there's a conflict
    if (bullish.length > 0 && bearish.length > 0) {
      // Priority 1: Prefer CONFIRMED patterns over others
      const confirmedBullish = bullish.filter(p => p.outcome === 'confirmed');
      const confirmedBearish = bearish.filter(p => p.outcome === 'confirmed');
      
      if (confirmedBullish.length > 0 && confirmedBearish.length === 0) {
        // Bullish confirmed, bearish not - keep bullish, mark bearish as failed
        conflictResolved.push(...confirmedBullish);
      } else if (confirmedBearish.length > 0 && confirmedBullish.length === 0) {
        // Bearish confirmed, bullish not - keep bearish
        conflictResolved.push(...confirmedBearish);
      } else if (confirmedBullish.length > 0 && confirmedBearish.length > 0) {
        // Both confirmed? Rare edge case - keep highest confidence
        const all = [...confirmedBullish, ...confirmedBearish];
        conflictResolved.push(all.sort((a, b) => b.pattern.confidence - a.pattern.confidence)[0]);
      } else {
        // Neither confirmed - keep only the highest confidence pattern
        const all = [...bullish, ...bearish];
        const best = all.sort((a, b) => b.pattern.confidence - a.pattern.confidence)[0];
        conflictResolved.push(best);
      }
    } else {
      // No conflict between bullish/bearish - keep all (might be same type duplicates)
      // Keep highest confidence of each type
      if (bullish.length > 0) {
        conflictResolved.push(bullish.sort((a, b) => b.pattern.confidence - a.pattern.confidence)[0]);
      }
      if (bearish.length > 0) {
        conflictResolved.push(bearish.sort((a, b) => b.pattern.confidence - a.pattern.confidence)[0]);
      }
    }
    
    // Always include neutral patterns (Doji, etc.) - they don't conflict
    conflictResolved.push(...neutral);
  }
  
  // Sort by bar index (most recent first) then by confidence
  return conflictResolved
    .sort((a, b) => a.barIndex - b.barIndex || b.pattern.confidence - a.pattern.confidence)
    .slice(0, 5);
}

/**
 * Evaluate whether a pattern was confirmed or failed by subsequent price action
 */
function evaluatePatternOutcome(
  patternType: 'bullish' | 'bearish' | 'neutral',
  patternBar: OHLCV,
  subsequentBars: OHLCV[],
  atr: number,
  barIndex: number
): { outcome: 'active' | 'confirmed' | 'failed'; outcomeDescription: string } {
  
  // Patterns on current or very recent bars are still "active" - not enough data to evaluate
  if (barIndex <= 2 || subsequentBars.length < 2) {
    return { 
      outcome: 'active', 
      outcomeDescription: 'Pattern still developing' 
    };
  }
  
  // Neutral patterns (Doji, Inside Bar) need special handling
  if (patternType === 'neutral') {
    return { 
      outcome: 'active', 
      outcomeDescription: 'Awaiting directional confirmation' 
    };
  }
  
  // Get the pattern bar's key levels
  const patternHigh = patternBar.high;
  const patternLow = patternBar.low;
  const patternClose = patternBar.close;
  
  // Track what happened after the pattern
  let highestHighAfter = Math.max(...subsequentBars.map(b => b.high));
  let lowestLowAfter = Math.min(...subsequentBars.map(b => b.low));
  let currentClose = subsequentBars[subsequentBars.length - 1].close;
  
  // Thresholds for confirmation/failure (using ATR for significance)
  const significantMove = atr * 0.5; // Half ATR is meaningful
  
  if (patternType === 'bearish') {
    // Bearish pattern expectations: price should move lower
    // CONFIRMED: Made lower lows, price dropped significantly
    // FAILED: Made higher highs, price moved up instead
    
    const madeHigherHighs = highestHighAfter > patternHigh + significantMove;
    const madeLowerLows = lowestLowAfter < patternLow - significantMove;
    const priceRose = currentClose > patternClose + significantMove;
    const priceFell = currentClose < patternClose - significantMove;
    
    if (madeHigherHighs && priceRose) {
      return { 
        outcome: 'failed', 
        outcomeDescription: 'Bears rejected - price made higher highs' 
      };
    } else if (madeHigherHighs && !madeLowerLows) {
      return { 
        outcome: 'failed', 
        outcomeDescription: 'Bearish pattern failed - bulls took control' 
      };
    } else if (madeLowerLows && priceFell) {
      return { 
        outcome: 'confirmed', 
        outcomeDescription: 'Bearish pattern confirmed - lower lows made' 
      };
    } else if (madeLowerLows) {
      return { 
        outcome: 'confirmed', 
        outcomeDescription: 'Bearish pattern working - selling pressure evident' 
      };
    }
    
    // Mixed or unclear
    return { 
      outcome: 'active', 
      outcomeDescription: 'Outcome still unclear' 
    };
    
  } else if (patternType === 'bullish') {
    // Bullish pattern expectations: price should move higher
    // CONFIRMED: Made higher highs, price rose significantly
    // FAILED: Made lower lows, price moved down instead
    
    const madeHigherHighs = highestHighAfter > patternHigh + significantMove;
    const madeLowerLows = lowestLowAfter < patternLow - significantMove;
    const priceRose = currentClose > patternClose + significantMove;
    const priceFell = currentClose < patternClose - significantMove;
    
    if (madeLowerLows && priceFell) {
      return { 
        outcome: 'failed', 
        outcomeDescription: 'Bulls rejected - price made lower lows' 
      };
    } else if (madeLowerLows && !madeHigherHighs) {
      return { 
        outcome: 'failed', 
        outcomeDescription: 'Bullish pattern failed - bears took control' 
      };
    } else if (madeHigherHighs && priceRose) {
      return { 
        outcome: 'confirmed', 
        outcomeDescription: 'Bullish pattern confirmed - higher highs made' 
      };
    } else if (madeHigherHighs) {
      return { 
        outcome: 'confirmed', 
        outcomeDescription: 'Bullish pattern working - buying pressure evident' 
      };
    }
    
    // Mixed or unclear
    return { 
      outcome: 'active', 
      outcomeDescription: 'Outcome still unclear' 
    };
  }
  
  return { 
    outcome: 'active', 
    outcomeDescription: 'Pattern outcome unclear' 
  };
}

/**
 * Helper function to calculate ATR for the scan
 */
function calculateATR(bars: OHLCV[], period: number = 14): number {
  if (bars.length < period + 1) return 0;
  
  let atrSum = 0;
  for (let i = bars.length - period; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    );
    atrSum += tr;
  }
  
  return atrSum / period;
}

/**
 * Basic trend detector (de-emphasized, lower weight in fusion)
 */
function detectBasicTrend(bars: OHLCV[]): CandlestickPattern {
  if (bars.length < 3) {
    return {
      name: "No Pattern",
      type: "neutral",
      confidence: 30,
      confidenceLabel: "low confidence",
      description: "Insufficient data for pattern",
      timeframe: "N/A",
      facts: {},
      reasons: ['Need more bars for pattern detection']
    };
  }

  const recent = bars.slice(-5);
  const highs = recent.map(b => b.high);
  const lows = recent.map(b => b.low);
  
  // Simple HH/HL or LH/LL check
  let higherHighs = 0;
  let lowerLows = 0;
  
  for (let i = 1; i < highs.length; i++) {
    if (highs[i] > highs[i - 1]) higherHighs++;
    if (lows[i] < lows[i - 1]) lowerLows++;
  }
  
  if (higherHighs >= 3) {
    return {
      name: "Uptrend",
      type: "bullish",
      confidence: 40, // Low - it's context, not a signal
      confidenceLabel: "low confidence",
      description: "Recent higher highs, context only",
      timeframe: "5 bars",
      facts: {},
      reasons: [`${higherHighs} higher highs in last 5 bars`],
      confirmationNeeded: true
    };
  }
  
  if (lowerLows >= 3) {
    return {
      name: "Downtrend",
      type: "bearish",
      confidence: 40,
      confidenceLabel: "low confidence",
      description: "Recent lower lows, context only",
      timeframe: "5 bars",
      facts: {},
      reasons: [`${lowerLows} lower lows in last 5 bars`],
      confirmationNeeded: true
    };
  }
  
  return {
    name: "Consolidation",
    type: "neutral",
    confidence: 35,
    confidenceLabel: "low confidence",
    description: "No clear trend or pattern",
    timeframe: "5 bars",
    facts: {},
    reasons: ['Choppy price action, no clear pattern'],
    confirmationNeeded: true
  };
}

