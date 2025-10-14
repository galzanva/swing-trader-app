/**
 * Master Pattern Detector V2 - Two-Tier System
 * Integrates chart patterns (institutional/candidate), candlestick patterns, and fusion logic
 */

import {
  OHLCV,
  TwoTierPatternResult,
  InstitutionalPattern,
  CandidatePattern,
  calculateATR
} from './pattern-utils';
import { detectAllChartPatterns } from './chart-patterns-v2';
import { detectCandlestickPatterns, CandlestickPattern } from './candlestick-v2';
import { fusePatterns, applyLiquiditySafeguards, applyEarningsSafeguards, CompositePattern } from './fusion-v2';

export interface DetectionResult {
  // Two-tier chart patterns
  institutional: InstitutionalPattern | null;
  candidate: CandidatePattern | null;
  allTwoTierResults: TwoTierPatternResult[];
  
  // Candlestick pattern
  candlestickPattern: CandlestickPattern;
  
  // Composite (fused) result
  composite: CompositePattern;
  
  // Metadata
  compositeReasons: string[];
  chartPatternReasons: string[];
  candlestickFacts: any;
  chartPatternMetadata: any;
}

/**
 * Detect all patterns (chart + candlestick) and return composite
 * Main entry point for pattern detection
 */
export function detectAllPatterns(
  bars: OHLCV[],
  options?: {
    avgDollarVolume?: number;
    minLiquidityThreshold?: number;
    daysToEarnings?: number | null;
    earningsBlockWindow?: number;
  }
): DetectionResult {
  // Calculate ATR for chart pattern detection
  const atr = calculateATR(bars, 14);
  
  // Detect all chart patterns (two-tier)
  const allTwoTierResults = detectAllChartPatterns(bars, atr);
  
  // Find the primary institutional pattern (highest confidence)
  const institutionalPatterns = allTwoTierResults
    .map(r => r.institutional)
    .filter((p): p is InstitutionalPattern => p !== null)
    .sort((a, b) => b.confidence - a.confidence);
  
  const primaryInstitutional = institutionalPatterns.length > 0 ? institutionalPatterns[0] : null;
  
  // If no institutional, find the primary candidate pattern
  const candidatePatterns = allTwoTierResults
    .map(r => r.candidate)
    .filter((p): p is CandidatePattern => p !== null)
    .sort((a, b) => b.confidence - a.confidence);
  
  const primaryCandidate = candidatePatterns.length > 0 ? candidatePatterns[0] : null;
  
  // Create TwoTierPatternResult for fusion
  const twoTierResult: TwoTierPatternResult = {
    institutional: primaryInstitutional,
    candidate: primaryCandidate
  };
  
  // Detect candlestick pattern
  const candlestickPattern = detectCandlestickPatterns(bars);
  
  // Fuse patterns
  let composite = fusePatterns(twoTierResult, candlestickPattern);
  
  // Apply safeguards if provided
  if (options?.avgDollarVolume !== undefined && options?.minLiquidityThreshold !== undefined) {
    composite = applyLiquiditySafeguards(composite, options.avgDollarVolume, options.minLiquidityThreshold);
  }
  
  if (options?.daysToEarnings !== undefined) {
    composite = applyEarningsSafeguards(composite, options.daysToEarnings, options.earningsBlockWindow);
  }
  
  return {
    institutional: primaryInstitutional,
    candidate: primaryCandidate,
    allTwoTierResults,
    candlestickPattern,
    composite,
    compositeReasons: composite.reasons,
    chartPatternReasons: primaryInstitutional?.reasons || primaryCandidate?.metCriteria || [],
    candlestickFacts: candlestickPattern.facts,
    chartPatternMetadata: primaryInstitutional?.metadata || primaryCandidate?.metadata || {}
  };
}

/**
 * Get primary pattern (for backward compatibility)
 */
export function getPrimaryPattern(bars: OHLCV[]): CandlestickPattern {
  return detectCandlestickPatterns(bars);
}

/**
 * Get composite pattern (for backward compatibility with existing system)
 * This adapts the new V2 system to work with the existing interface
 */
export function getCompositePatternV2(bars: OHLCV[]): {
  chartPattern: any; // Compatible with old ChartPattern interface
  candlestickPattern: CandlestickPattern;
  fusedConfidence: number;
  fusionBonus: number;
  analysis: string;
  reasons: string[];
} {
  const result = detectAllPatterns(bars);
  
  // Calculate fusion bonus (total of all bonuses - penalties)
  const totalBonuses = Object.values(result.composite.bonuses).reduce((sum, val) => sum + (val || 0), 0);
  const totalPenalties = Object.values(result.composite.penalties).reduce((sum, val) => sum + (val || 0), 0);
  const fusionBonus = totalBonuses - totalPenalties;
  
  // Convert institutional pattern to old format for backward compatibility
  const chartPattern = result.institutional ? {
    name: result.institutional.name,
    type: result.institutional.direction,
    confidence: result.institutional.confidence,
    confidenceLabel: result.institutional.confidenceLabel,
    description: `${result.institutional.name} (${result.institutional.type})`,
    breakoutStatus: result.institutional.breakoutStatus,
    priceTarget: result.institutional.priceTarget,
    keyLevels: result.institutional.keyLevels,
    volumeConfirmation: result.institutional.volumeZScore >= 1.0,
    volumeZScore: result.institutional.volumeZScore,
    patternHeight: null,
    metadata: result.institutional.metadata,
    reasons: result.institutional.reasons
  } : null;
  
  return {
    chartPattern,
    candlestickPattern: result.candlestickPattern,
    fusedConfidence: result.composite.composite,
    fusionBonus,
    analysis: result.composite.analysis,
    reasons: result.composite.reasons
  };
}
