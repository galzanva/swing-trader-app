/**
 * Scoring and Rating System
 * Calculates overall setup score based on multiple factors
 */

import { TechnicalIndicators } from "../indicators/technical";
import { DetectedPattern } from "../patterns/detector";

export interface SetupScore {
  overall: number; // 0-100
  technical: number; // 0-100
  momentum: number; // 0-100
  trend: number; // 0-100
  pattern: number; // 0-100
  volume: number; // 0-100
  rating: "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F";
  recommendation: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
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
  if (macd.histogram > 0 && macd.value > macd.signal) {
    score += 50; // Bullish MACD
  } else if (macd.histogram > 0) {
    score += 35; // Improving
  } else if (macd.histogram < 0 && macd.value < macd.signal) {
    score += 10; // Bearish MACD
  } else {
    score += 25; // Neutral
  }
  
  return Math.min(100, score);
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
 * Score pattern
 */
function scorePattern(pattern: DetectedPattern): number {
  // Pattern confidence is already 0-100
  return pattern.confidence;
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
  const patternScore = scorePattern(pattern);
  const volume = scoreVolume(indicators.volumeZScore);
  
  // Weighted average
  const overall = (
    technical * 0.30 +
    momentum * 0.25 +
    trend * 0.20 +
    patternScore * 0.15 +
    volume * 0.10
  );
  
  // Determine rating
  let rating: SetupScore["rating"];
  let recommendation: SetupScore["recommendation"];
  
  if (overall >= 90) {
    rating = "A+";
    recommendation = "Strong Buy";
  } else if (overall >= 85) {
    rating = "A";
    recommendation = "Strong Buy";
  } else if (overall >= 80) {
    rating = "B+";
    recommendation = "Buy";
  } else if (overall >= 70) {
    rating = "B";
    recommendation = "Buy";
  } else if (overall >= 60) {
    rating = "C+";
    recommendation = "Hold";
  } else if (overall >= 50) {
    rating = "C";
    recommendation = "Hold";
  } else if (overall >= 40) {
    rating = "D";
    recommendation = "Sell";
  } else {
    rating = "F";
    recommendation = "Strong Sell";
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

