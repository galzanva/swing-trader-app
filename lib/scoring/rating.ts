/**
 * Scoring and Rating System
 * Calculates overall setup score based on multiple factors
 */

import { TechnicalIndicators } from "../indicators/technical";
import { DetectedPattern, CompositePattern } from "../patterns/detector";
import { ChartPattern } from "../patterns/chart-patterns";

export interface SetupScore {
  overall: number; // 0-100
  technical: number; // 0-100
  momentum: number; // 0-100
  trend: number; // 0-100
  pattern: number; // 0-100
  volume: number; // 0-100
  rating: "A+" | "A" | "B" | "C" | "D";
  recommendation: "Strong Buy" | "Buy" | "Strong Short" | "Short" | "Watch" | "Pass";
}

/**
 * Score technical alignment (EMAs, trend)
 */
function scoreTechnical(indicators: TechnicalIndicators): number {
  let score = 0;
  
  // EMA alignment (40 points max)
  const { ema9, ema20, ema50, ema200, trend } = indicators;
  
  if (trend === "bullish") {
    if (ema9 > ema20) score += 10;
    if (ema20 > ema50) score += 10;
    if (ema50 > ema200) score += 10;
    if (ema9 > ema200) score += 10;
  } else if (trend === "bearish") {
    if (ema9 < ema20) score += 10;
    if (ema20 < ema50) score += 10;
    if (ema50 < ema200) score += 10;
    if (ema9 < ema200) score += 10;
  } else {
    score += 20; // neutral gets mid-score
  }
  
  // Trend strength (30 points max)
  score += (indicators.strength / 100) * 30;
  
  // Distance from key EMA (30 points max)
  const currentPrice = ema9; // Latest price approximation
  const distanceFrom20 = Math.abs((currentPrice - ema20) / ema20) * 100;
  
  if (distanceFrom20 < 2) {
    score += 30; // Very close to EMA20 (good entry)
  } else if (distanceFrom20 < 5) {
    score += 20; // Reasonably close
  } else if (distanceFrom20 < 10) {
    score += 10; // A bit extended
  }
  
  return Math.min(100, score);
}

/**
 * Score momentum indicators (RSI, MACD)
 * Cap at 70-75 unless RSI > 60 OR MACD is positive (prevents over-scoring neutral momentum)
 */
function scoreMomentum(indicators: TechnicalIndicators): number {
  let score = 0;
  
  const { rsi, macd } = indicators;
  
  // RSI scoring (50 points max)
  if (rsi >= 30 && rsi <= 40) {
    score += 50; // Oversold but recovering
  } else if (rsi > 40 && rsi <= 50) {
    score += 45; // Bullish territory
  } else if (rsi > 50 && rsi <= 60) {
    score += 40; // Strong bullish
  } else if (rsi > 60 && rsi <= 70) {
    score += 30; // Overbought approaching
  } else if (rsi > 70) {
    score += 10; // Overbought - caution
  } else if (rsi < 30) {
    score += 20; // Oversold - wait for turn
  }
  
  // MACD scoring (50 points max)
  const macdPositive = macd.value > macd.signal || macd.histogram > 0;
  
  if (macd.histogram > 0 && macd.value > macd.signal) {
    score += 50; // Bullish MACD
  } else if (macd.histogram > 0) {
    score += 35; // Improving
  } else if (macd.histogram < 0 && macd.value < macd.signal) {
    score += 10; // Bearish MACD
  } else {
    score += 25; // Neutral
  }
  
  // Cap momentum at 70-75 unless strong bullish indicators
  const hasStrongMomentum = rsi > 60 || macdPositive;
  const maxScore = hasStrongMomentum ? 100 : 75;
  
  return Math.min(maxScore, score);
}

/**
 * Score volume
 */
function scoreVolume(volumeZScore: number): number {
  // Higher volume is better for swing trading
  if (volumeZScore > 2) return 100; // Very high volume
  if (volumeZScore > 1) return 80;  // High volume
  if (volumeZScore > 0) return 60;  // Above average
  if (volumeZScore > -1) return 40; // Below average
  return 20; // Low volume - caution
}

/**
 * Score pattern - adjusted for volume confirmation
 */
function scorePattern(pattern: DetectedPattern, volumeZScore: number): number {
  let score = pattern.confidence;
  
  // Penalize patterns with weak volume
  // Engulfing and breakout patterns NEED volume confirmation
  const needsVolume = pattern.name.includes("Engulfing") || pattern.name.includes("Breakout");
  
  if (needsVolume) {
    if (volumeZScore < 0) {
      // Below average volume - significant penalty
      score = score * 0.7; // 30% reduction
    } else if (volumeZScore < 0.5) {
      // Slightly below average
      score = score * 0.85; // 15% reduction
    } else if (volumeZScore > 2) {
      // Very high volume - bonus
      score = Math.min(100, score * 1.1); // 10% bonus
    }
  }
  
  return Math.round(score);
}

/**
 * Calculate overall setup score
 */
export function calculateSetupScore(
  indicators: TechnicalIndicators,
  pattern: DetectedPattern
): SetupScore {
  const technical = scoreTechnical(indicators);
  const momentum = scoreMomentum(indicators);
  const trend = indicators.strength;
  const patternScore = scorePattern(pattern, indicators.volumeZScore); // Pass volume for adjustment
  const volume = scoreVolume(indicators.volumeZScore);
  
  // Weighted average
  const overall = (
    technical * 0.30 +
    momentum * 0.25 +
    trend * 0.20 +
    patternScore * 0.15 +
    volume * 0.10
  );
  
  // Determine rating and recommendation (direction-aware)
  // Grade mapping: 0-40=D, 41-60=C, 61-75=B, 76-90=A, 90+=A+
  let rating: SetupScore["rating"];
  let recommendation: SetupScore["recommendation"];
  
  const isBullish = pattern.type === "bullish";
  const isBearish = pattern.type === "bearish";
  
  if (overall >= 90) {
    rating = "A+";
    recommendation = isBullish ? "Strong Buy" : isBearish ? "Strong Short" : "Strong Buy";
  } else if (overall >= 76) {
    rating = "A";
    recommendation = isBullish ? "Strong Buy" : isBearish ? "Strong Short" : "Strong Buy";
  } else if (overall >= 61) {
    rating = "B";
    recommendation = isBullish ? "Buy" : isBearish ? "Short" : "Buy";
  } else if (overall >= 41) {
    rating = "C";
    recommendation = "Watch";
  } else {
    rating = "D";
    recommendation = "Pass";
  }
  
  return {
    overall: Math.round(overall),
    technical: Math.round(technical),
    momentum: Math.round(momentum),
    trend: Math.round(trend),
    pattern: Math.round(patternScore),
    volume: Math.round(volume),
    rating,
    recommendation
  };
}

/**
 * Calculate setup score with chart pattern fusion
 * This version considers both candlestick and chart patterns
 */
export function calculateCompositeScore(
  indicators: TechnicalIndicators,
  compositePattern: CompositePattern
): SetupScore {
  const technical = scoreTechnical(indicators);
  const momentum = scoreMomentum(indicators);
  const trend = indicators.strength;
  const candlestickScore = scorePattern(compositePattern.candlestickPattern, indicators.volumeZScore);
  const volume = scoreVolume(indicators.volumeZScore);
  
  // If we have a chart pattern, factor it in
  let chartPatternScore = 0;
  if (compositePattern.chartPattern) {
    chartPatternScore = compositePattern.chartPattern.confidence;
    
    // Bonus for confirmed breakout
    if (compositePattern.chartPattern.breakoutStatus === "confirmed") {
      chartPatternScore = Math.min(100, chartPatternScore + 10);
    }
  }
  
  // Use fused confidence which already accounts for pattern alignment
  const fusedPatternScore = compositePattern.fusedConfidence;
  
  // Weighted average with chart pattern factored in
  const overall = compositePattern.chartPattern
    ? (
        technical * 0.25 +
        momentum * 0.20 +
        trend * 0.15 +
        fusedPatternScore * 0.25 + // Increased weight for fused pattern
        chartPatternScore * 0.10 +  // Additional chart pattern influence
        volume * 0.05
      )
    : (
        technical * 0.30 +
        momentum * 0.25 +
        trend * 0.20 +
        fusedPatternScore * 0.15 +
        volume * 0.10
      );
  
  // Determine rating and recommendation (direction-aware)
  let rating: SetupScore["rating"];
  let recommendation: SetupScore["recommendation"];
  
  // Use the fused confidence pattern type for direction
  const patternType = compositePattern.chartPattern?.type || compositePattern.candlestickPattern.type;
  const isBullish = patternType === "bullish";
  const isBearish = patternType === "bearish";
  
  if (overall >= 90) {
    rating = "A+";
    recommendation = isBullish ? "Strong Buy" : isBearish ? "Strong Short" : "Strong Buy";
  } else if (overall >= 76) {
    rating = "A";
    recommendation = isBullish ? "Strong Buy" : isBearish ? "Strong Short" : "Strong Buy";
  } else if (overall >= 61) {
    rating = "B";
    recommendation = isBullish ? "Buy" : isBearish ? "Short" : "Buy";
  } else if (overall >= 41) {
    rating = "C";
    recommendation = "Watch";
  } else {
    rating = "D";
    recommendation = "Pass";
  }
  
  return {
    overall: Math.round(overall),
    technical: Math.round(technical),
    momentum: Math.round(momentum),
    trend: Math.round(trend),
    pattern: Math.round(fusedPatternScore),
    volume: Math.round(volume),
    rating,
    recommendation
  };
}

