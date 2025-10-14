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
 * Detect all candlestick patterns and return the most confident
 */
export function detectCandlestickPatterns(bars: OHLCV[]): CandlestickPattern {
  const patterns: (CandlestickPattern | null)[] = [
    detectBullishEngulfing(bars),
    detectBearishEngulfing(bars),
    detectHammer(bars),
    detectShootingStar(bars),
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

