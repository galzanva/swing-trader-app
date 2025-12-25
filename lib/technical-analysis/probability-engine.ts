/**
 * Probability Engine - Statistical Price Movement Predictions
 * Based purely on technical analysis, indicators, and historical patterns
 */

import { OHLCV, calculateATR, calculateRSI, calculateMACD, calculateADX, calculateStochastic, calculateBollingerBands } from './advanced-indicators';
import { scanRecentPatternsWithContext, PatternWithContext, CandlestickPattern } from '../patterns/candlestick-v2';

export interface ProbabilityScenario {
  direction: 'up' | 'down';
  targetPrice: number;
  targetPercent: number;
  probability: number;
  daysToTarget: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  supportingIndicators: string[];
  conflictingIndicators: string[];
}

export interface MomentumAssessment {
  score: number; // -100 to +100 (negative = bearish, positive = bullish)
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  direction: 'bullish' | 'bearish' | 'neutral';
  divergences: {
    indicator: string;
    type: 'bullish' | 'bearish' | 'none';
    description: string;
  }[];
  keyFactors: string[];
}

export interface TrendAssessment {
  primary: {
    direction: 'uptrend' | 'downtrend' | 'sideways';
    strength: number; // 0-100
    duration: number; // bars
  };
  intermediate: {
    direction: 'uptrend' | 'downtrend' | 'sideways';
    strength: number;
  };
  shortTerm: {
    direction: 'uptrend' | 'downtrend' | 'sideways';
    strength: number;
  };
  emaAlignment: 'bullish' | 'bearish' | 'mixed';
  priceLocation: 'above-all-emas' | 'below-all-emas' | 'mixed';
}

export interface VolatilityAssessment {
  current: number; // Current ATR
  average: number; // Average ATR
  percentile: number; // Where current vol is vs history
  regime: 'high' | 'normal' | 'low' | 'expanding' | 'contracting';
  expectedDailyRange: { low: number; high: number };
  suggestion: string;
}

export interface PriceProjection {
  currentPrice: number;
  upside: {
    conservative: { price: number; percent: number; probability: number; days: number };
    moderate: { price: number; percent: number; probability: number; days: number };
    aggressive: { price: number; percent: number; probability: number; days: number };
  };
  downside: {
    conservative: { price: number; percent: number; probability: number; days: number };
    moderate: { price: number; percent: number; probability: number; days: number };
    aggressive: { price: number; percent: number; probability: number; days: number };
  };
  mostProbable: {
    direction: 'up' | 'down' | 'sideways';
    priceRange: { low: number; high: number };
    probability: number;
    timeframe: string;
  };
}

export interface SignalStrength {
  overall: number; // 0-100
  direction: 'bullish' | 'bearish' | 'neutral';
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    trend: { score: number; weight: number; signal: string };
    momentum: { score: number; weight: number; signal: string };
    volume: { score: number; weight: number; signal: string };
    volatility: { score: number; weight: number; signal: string };
    pattern: { score: number; weight: number; signal: string };
  };
}

export interface StrategyRecommendation {
  strategy: string;
  direction: 'long' | 'short' | 'wait';
  confidence: number;
  entry: {
    type: 'market' | 'limit' | 'breakout' | 'pullback';
    price: number;
    conditions: string[];
  };
  stopLoss: {
    price: number;
    reason: string;
    riskPercent: number;
  };
  targets: {
    t1: { price: number; rr: number; probability: number };
    t2: { price: number; rr: number; probability: number };
    t3: { price: number; rr: number; probability: number };
  };
  invalidation: string;
  notes: string[];
}

export interface StructureAnalysis {
  classification: 'likely-pullback' | 'trend-reversal-risk' | 'mixed';
  confidence: number; // 0-100
  summary: string; // 1-2 sentence trader-friendly explanation
  pullbackSignals: string[]; // Reasons supporting pullback thesis (structure + patterns)
  reversalSignals: string[]; // Reasons supporting reversal thesis (structure + patterns)
  dominantBias: 'pullback' | 'reversal' | 'neutral';
  priorTrendDirection: 'up' | 'down' | 'sideways';
  structureIntact: boolean;
  detectedPatterns: {
    name: string;
    type: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    location: string; // e.g., "at support (current)", "near EMA (3 bars ago)"
    outcome: 'active' | 'confirmed' | 'failed';
    outcomeDescription: string;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKET REGIME REASONING ENGINE
// This system INFERS regimes from raw indicators before assigning scores.
// The reasoning flow is: Regime → Valid Strategies → Trade Parameters
// ═══════════════════════════════════════════════════════════════════════════

/**
 * STEP 1: MARKET REGIME INFERENCE
 * Infer current market state from structure, not scores
 */
export interface MarketRegimeInference {
  regime: 'trending' | 'range-bound' | 'reversal-attempt' | 'unstable';
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: 'strong' | 'developing' | 'weak' | 'none';
  evidence: string[];
}

/**
 * STEP 2: RISK REGIME INFERENCE  
 * Infer risk environment from volatility behavior
 */
export interface RiskRegimeInference {
  regime: 'compressed' | 'normal' | 'expanding' | 'unstable';
  atrContext: 'low' | 'normal' | 'high' | 'extreme';
  momentumDispersion: 'aligned' | 'diverging' | 'conflicting';
  evidence: string[];
}

/**
 * STEP 3: BEHAVIORAL CONTEXT INFERENCE
 * Infer what market participants are doing
 */
export interface BehavioralContextInference {
  context: 'accumulation' | 'distribution' | 'chasing' | 'mean-reversion-risk' | 'neutral';
  volumeSignature: 'confirming' | 'diverging' | 'exhaustion' | 'neutral';
  oscillatorState: 'overbought' | 'oversold' | 'neutral' | 'extreme';
  evidence: string[];
}

/**
 * STEP 4: STRATEGY FEASIBILITY
 * Based on inferred regimes, determine valid strategy families
 */
export interface StrategyFeasibility {
  valid: string[];      // Strategies that satisfy all constraints
  invalid: string[];    // Strategies explicitly forbidden by regime
  conditional: string[]; // Strategies allowed with additional confirmation
  defaultAction: 'trade' | 'wait';
  reasoning: string[];
}

/**
 * Combined regime analysis output
 */
export interface RegimeAnalysis {
  market: MarketRegimeInference;
  risk: RiskRegimeInference;
  behavioral: BehavioralContextInference;
  feasibility: StrategyFeasibility;
}

// Legacy interface for backwards compatibility
export interface TradeRegime {
  // Core regime classification
  volatilityClass: 'low' | 'normal' | 'high' | 'speculative';
  structureClass: 'trending' | 'range-bound' | 'transitional';
  
  // Allowed strategy types based on regime
  allowedStrategies: (
    | 'trend-continuation'      // Low volatility + trending
    | 'pullback-continuation'   // Normal volatility + trending
    | 'breakout-expansion'      // Any volatility + transitional
    | 'speculative-pullback'    // High volatility + trending
    | 'mean-reversion'          // Any regime + range-bound
    | 'wait'                    // Conflicts or no edge
  )[];
  
  // Regime constraints
  maxConfidence: number;       // Cap on confidence based on regime
  maxTargetMultiple: number;   // Cap on ATR multiples for targets
  maxHoldingDays: number;      // Max holding period
  stopMultiplier: number;      // Volatility-adjusted stop multiplier
  
  // Flags
  isSpeculative: boolean;      // If true, position sizing must be reduced
  requiresConfirmation: boolean; // If true, no market entries allowed
  
  // Reasoning
  constraints: string[];       // List of active regime constraints
  
  // NEW: Full regime analysis
  regimeAnalysis?: RegimeAnalysis;
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECTED MARKET REGIME - HIGH-LEVEL CLASSIFICATION
// Maps detailed regime analysis to one of 5 actionable regime types
// This determines which gates, unlocks, and rules apply to recommendations
// ═══════════════════════════════════════════════════════════════════════════
export type DetectedRegimeType = 'TRENDING' | 'RANGE_BOUND' | 'REVERSAL_ATTEMPT' | 'VOLATILITY_EXPANSION' | 'UNCERTAIN';

export interface DetectedRegime {
  type: DetectedRegimeType;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-100
  
  // Regime-specific rules
  rules: {
    useADXGate: boolean;           // Whether ADX gate applies
    useStochSupression: boolean;   // Whether overbought/oversold suppresses direction
    allowMeanReversion: boolean;   // Whether mean reversion trades are allowed
    requireBreakoutConfirmation: boolean; // Require breakout + hold for entry
    requireStructureBreak: boolean; // Require prior swing high/low break
    widenStops: boolean;           // Widen stops due to volatility
    reduceConfidence: boolean;     // Auto-reduce confidence
  };
  
  // Unlock conditions specific to this regime
  unlockConditions: string[];
  
  // Evidence used to determine regime
  evidence: string[];
}

/**
 * DETECT MARKET REGIME
 * Maps existing regime analysis to one of 5 high-level actionable regimes
 * and determines which rules/gates apply
 */
export function detectMarketRegime(
  adx: number,
  emaAlignment: 'bullish' | 'bearish' | 'mixed',
  priorTrend: 'up' | 'down' | 'sideways',
  structureClassification: 'likely-pullback' | 'trend-reversal-risk' | 'mixed',
  volatilityRegime: 'high' | 'normal' | 'low' | 'expanding' | 'contracting',
  bollingerBandwidth: number,
  atrPercent: number,
  squeezeIsActive: boolean,
  squeezeMomentumDirection: 'bullish' | 'bearish' | 'neutral',
  stochK: number,
  rsi: number,
  cmf: number,
  obvTrend: 'rising' | 'falling' | 'flat',
  volumeZScore: number,
  nearResistance: boolean,
  nearSupport: boolean,
  brokeSwingHigh: boolean,
  brokeSwingLow: boolean
): DetectedRegime {
  const evidence: string[] = [];
  let type: DetectedRegimeType;
  let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  let confidence = 50;
  
  // ─────────────────────────────────────────────────────────────────
  // STEP 1: Check for VOLATILITY_EXPANSION first (overrides others)
  // ─────────────────────────────────────────────────────────────────
  const isVolatilityExpanding = 
    volatilityRegime === 'expanding' ||
    volatilityRegime === 'high' ||
    atrPercent >= 6 ||
    bollingerBandwidth > 40;
    
  if (isVolatilityExpanding && !squeezeIsActive) {
    type = 'VOLATILITY_EXPANSION';
    evidence.push(`Volatility expanding: ATR ${atrPercent.toFixed(1)}%, BB width ${bollingerBandwidth.toFixed(1)}%`);
    confidence = 60;
    
    // Determine direction from stronger indicators
    if (emaAlignment === 'bullish' && rsi > 50) {
      direction = 'bullish';
    } else if (emaAlignment === 'bearish' && rsi < 50) {
      direction = 'bearish';
    }
  }
  // ─────────────────────────────────────────────────────────────────
  // STEP 2: Check for TRENDING regime
  // ─────────────────────────────────────────────────────────────────
  else if (adx >= 25 && emaAlignment !== 'mixed') {
    type = 'TRENDING';
    direction = emaAlignment === 'bullish' ? 'bullish' : 'bearish';
    confidence = Math.min(80, 50 + adx);
    evidence.push(`Strong trend: ADX ${adx.toFixed(0)}, ${emaAlignment} EMAs`);
    
    if (structureClassification === 'likely-pullback') {
      evidence.push('Structure confirms trend continuation');
      confidence += 10;
    }
  }
  // ─────────────────────────────────────────────────────────────────
  // STEP 3: Check for REVERSAL_ATTEMPT regime
  // ─────────────────────────────────────────────────────────────────
  else if (
    structureClassification === 'trend-reversal-risk' ||
    (priorTrend === 'down' && brokeSwingHigh) ||
    (priorTrend === 'up' && brokeSwingLow)
  ) {
    type = 'REVERSAL_ATTEMPT';
    evidence.push(`Reversal attempt: structure=${structureClassification}, prior trend=${priorTrend}`);
    
    // Determine attempted direction
    if (priorTrend === 'down' && (brokeSwingHigh || emaAlignment === 'bullish')) {
      direction = 'bullish';
      evidence.push('Attempting bullish reversal of downtrend');
    } else if (priorTrend === 'up' && (brokeSwingLow || emaAlignment === 'bearish')) {
      direction = 'bearish';
      evidence.push('Attempting bearish reversal of uptrend');
    }
    
    // Confidence based on confirmation
    confidence = 40;
    if ((direction === 'bullish' && obvTrend === 'rising' && cmf > 0) ||
        (direction === 'bearish' && obvTrend === 'falling' && cmf < 0)) {
      confidence += 15;
      evidence.push('Volume/flow confirms reversal attempt');
    }
  }
  // ─────────────────────────────────────────────────────────────────
  // STEP 4: Check for RANGE_BOUND regime
  // ─────────────────────────────────────────────────────────────────
  else if (adx < 25 && emaAlignment === 'mixed') {
    type = 'RANGE_BOUND';
    evidence.push(`Range-bound: ADX ${adx.toFixed(0)} < 25, mixed EMAs`);
    confidence = 55;
    
    // In range-bound, direction is based on position within range
    if (nearResistance && stochK > 70) {
      direction = 'bearish'; // Favor mean reversion down from resistance
      evidence.push('Near resistance with overbought oscillators');
    } else if (nearSupport && stochK < 30) {
      direction = 'bullish'; // Favor mean reversion up from support
      evidence.push('Near support with oversold oscillators');
    }
    
    // Squeeze affects range-bound interpretation
    if (squeezeIsActive) {
      evidence.push(`Squeeze active (${squeezeMomentumDirection} momentum) - breakout pending`);
      confidence = 45; // Lower confidence during squeeze
    }
  }
  // ─────────────────────────────────────────────────────────────────
  // STEP 5: Default to UNCERTAIN
  // ─────────────────────────────────────────────────────────────────
  else {
    type = 'UNCERTAIN';
    evidence.push('Mixed signals - no clear regime');
    confidence = 35;
    
    // List what's unclear
    if (adx >= 20 && adx < 25) {
      evidence.push(`ADX ${adx.toFixed(0)} in transition zone (20-25)`);
    }
    if (emaAlignment === 'mixed') {
      evidence.push('EMAs not aligned');
    }
  }
  
  // ─────────────────────────────────────────────────────────────────
  // DETERMINE REGIME-SPECIFIC RULES
  // ─────────────────────────────────────────────────────────────────
  const rules = getRegimeRules(type, direction, stochK, nearResistance, nearSupport, volatilityRegime);
  
  // ─────────────────────────────────────────────────────────────────
  // GENERATE UNLOCK CONDITIONS FOR THIS REGIME
  // ─────────────────────────────────────────────────────────────────
  const unlockConditions = getRegimeUnlockConditions(
    type, direction, adx, stochK, nearResistance, nearSupport, 
    squeezeIsActive, squeezeMomentumDirection, cmf, obvTrend
  );
  
  return {
    type,
    direction,
    confidence: Math.min(100, Math.max(0, confidence)),
    rules,
    unlockConditions,
    evidence
  };
}

/**
 * Get regime-specific rules that control gating behavior
 */
function getRegimeRules(
  type: DetectedRegimeType,
  direction: 'bullish' | 'bearish' | 'neutral',
  stochK: number,
  nearResistance: boolean,
  nearSupport: boolean,
  volatilityRegime: string
): DetectedRegime['rules'] {
  switch (type) {
    case 'TRENDING':
      return {
        useADXGate: true,               // ADX gate applies in trending
        useStochSupression: false,      // Overbought doesn't suppress in strong trends
        allowMeanReversion: false,      // Don't mean-revert against trend
        requireBreakoutConfirmation: false,
        requireStructureBreak: false,
        widenStops: false,
        reduceConfidence: false
      };
      
    case 'RANGE_BOUND':
      return {
        useADXGate: false,              // ADX gate does NOT apply in range
        useStochSupression: true,       // Use oscillators for timing
        allowMeanReversion: true,       // Mean reversion allowed at extremes
        requireBreakoutConfirmation: true, // Require breakout + hold for directional trades
        requireStructureBreak: false,
        widenStops: false,
        reduceConfidence: true          // Cap confidence until breakout
      };
      
    case 'REVERSAL_ATTEMPT':
      return {
        useADXGate: false,              // ADX low is expected in reversals
        useStochSupression: false,      // Oscillators confirm reversal timing
        allowMeanReversion: false,
        requireBreakoutConfirmation: true,
        requireStructureBreak: true,    // Must break prior swing
        widenStops: true,               // Wider stops for reversals
        reduceConfidence: true
      };
      
    case 'VOLATILITY_EXPANSION':
      return {
        useADXGate: true,
        useStochSupression: true,       // More conservative in high vol
        allowMeanReversion: false,      // Don't mean-revert in vol expansion
        requireBreakoutConfirmation: true,
        requireStructureBreak: false,
        widenStops: true,               // Must widen stops
        reduceConfidence: true          // Reduce confidence
      };
      
    case 'UNCERTAIN':
    default:
      return {
        useADXGate: true,
        useStochSupression: true,
        allowMeanReversion: false,
        requireBreakoutConfirmation: true,
        requireStructureBreak: true,
        widenStops: true,
        reduceConfidence: true
      };
  }
}

/**
 * Generate regime-specific unlock conditions
 */
function getRegimeUnlockConditions(
  type: DetectedRegimeType,
  direction: 'bullish' | 'bearish' | 'neutral',
  adx: number,
  stochK: number,
  nearResistance: boolean,
  nearSupport: boolean,
  squeezeIsActive: boolean,
  squeezeMomentumDirection: string,
  cmf: number,
  obvTrend: string
): string[] {
  const conditions: string[] = [];
  
  switch (type) {
    case 'TRENDING':
      if (adx < 30) {
        conditions.push(`ADX must strengthen above 30 (currently ${adx.toFixed(0)})`);
      }
      if (direction === 'bullish') {
        conditions.push('Maintain higher highs and higher lows structure');
      } else if (direction === 'bearish') {
        conditions.push('Maintain lower highs and lower lows structure');
      }
      break;
      
    case 'RANGE_BOUND':
      // Range-bound uses breakout/breakdown unlocks, NOT ADX
      conditions.push('LONG: Breakout above range resistance + close/hold confirmation');
      conditions.push('SHORT: Breakdown below range support + close/hold confirmation');
      if (squeezeIsActive) {
        conditions.push(`Wait for squeeze release (momentum: ${squeezeMomentumDirection})`);
      }
      // Mean reversion unlock (optional)
      if (nearResistance && stochK > 85) {
        conditions.push('Mean reversion SHORT: Stoch > 85 at resistance + bearish candle');
      }
      if (nearSupport && stochK < 15) {
        conditions.push('Mean reversion LONG: Stoch < 15 at support + bullish candle');
      }
      break;
      
    case 'REVERSAL_ATTEMPT':
      conditions.push('Require break of prior swing high/low');
      if (direction === 'bullish') {
        conditions.push('Volume confirmation: OBV rising + CMF positive');
        if (obvTrend !== 'rising' || cmf <= 0) {
          conditions.push(`Currently: OBV ${obvTrend}, CMF ${cmf.toFixed(3)} - not yet confirmed`);
        }
      } else if (direction === 'bearish') {
        conditions.push('Volume confirmation: OBV falling + CMF negative');
        if (obvTrend !== 'falling' || cmf >= 0) {
          conditions.push(`Currently: OBV ${obvTrend}, CMF ${cmf.toFixed(3)} - not yet confirmed`);
        }
      }
      conditions.push('Candlestick pattern must align with structure break at key level');
      break;
      
    case 'VOLATILITY_EXPANSION':
      conditions.push('Require stronger confirmation (volume z-score > 1.5 OR multi-indicator alignment)');
      conditions.push('Use wider stops (1.5-2x normal ATR multiple)');
      conditions.push('Reduce position size proportionally to volatility');
      break;
      
    case 'UNCERTAIN':
    default:
      conditions.push('Wait for regime clarity');
      conditions.push('ADX must rise above 25 for trend confirmation');
      conditions.push('OR clear range boundaries must form for range trading');
      conditions.push('OR structure break must occur for reversal setup');
      break;
  }
  
  return conditions;
}

// ═══════════════════════════════════════════════════════════════════════════
// VOLUME LABELING - FIXED TO PREVENT OVERSTATEMENT
// Only label "Accumulation" when genuinely confirmed
// ═══════════════════════════════════════════════════════════════════════════
export function getVolumeLabel(
  cmf: number,
  cmfPrev: number | undefined,
  obvTrend: 'rising' | 'falling' | 'flat',
  volumeZScore: number
): { label: string; isAccumulation: boolean; isDistribution: boolean } {
  const cmfRising = cmfPrev !== undefined && cmf > cmfPrev;
  const cmfPositive = cmf > 0;
  const obvRising = obvTrend === 'rising';
  const zScorePositive = volumeZScore > 0.5; // Meaningful positive threshold
  
  // TRUE ACCUMULATION: CMF positive AND rising OR OBV strongly rising, AND meaningful volume
  if ((cmfPositive && cmfRising) || (obvRising && cmfPositive)) {
    if (zScorePositive) {
      return { label: 'Accumulation', isAccumulation: true, isDistribution: false };
    } else {
      return { label: 'Accumulation (low volume)', isAccumulation: true, isDistribution: false };
    }
  }
  
  // TRUE DISTRIBUTION: CMF negative AND falling OR OBV falling
  const cmfFalling = cmfPrev !== undefined && cmf < cmfPrev;
  const cmfNegative = cmf < 0;
  const obvFalling = obvTrend === 'falling';
  
  if ((cmfNegative && cmfFalling) || (obvFalling && cmfNegative)) {
    return { label: 'Distribution', isAccumulation: false, isDistribution: true };
  }
  
  // ELEVATED ACTIVITY: High volume but mixed signals
  if (volumeZScore > 1.0) {
    return { label: 'Elevated activity', isAccumulation: false, isDistribution: false };
  }
  
  // NORMAL PARTICIPATION: Default
  return { label: 'Normal participation', isAccumulation: false, isDistribution: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// CANDLESTICK SIGNAL CANCELLATION
// When bullish and bearish patterns cluster at same level, they cancel out
// ═══════════════════════════════════════════════════════════════════════════
export function checkCandlestickCancellation(
  bullishPatterns: { name: string; barsAgo: number; confidence: number }[],
  bearishPatterns: { name: string; barsAgo: number; confidence: number }[],
  lookbackBars: number = 5,
  regimeType: DetectedRegimeType
): { 
  cancelled: boolean; 
  netBias: 'bullish' | 'bearish' | 'neutral';
  reason: string;
} {
  // Filter patterns within lookback window
  const recentBullish = bullishPatterns.filter(p => p.barsAgo <= lookbackBars);
  const recentBearish = bearishPatterns.filter(p => p.barsAgo <= lookbackBars);
  
  // No patterns = neutral
  if (recentBullish.length === 0 && recentBearish.length === 0) {
    return { cancelled: false, netBias: 'neutral', reason: 'No recent patterns' };
  }
  
  // Calculate weighted scores
  const bullishScore = recentBullish.reduce((sum, p) => sum + p.confidence * (1 - p.barsAgo / 10), 0);
  const bearishScore = recentBearish.reduce((sum, p) => sum + p.confidence * (1 - p.barsAgo / 10), 0);
  
  // Check for cancellation (both present with similar strength)
  if (recentBullish.length > 0 && recentBearish.length > 0) {
    const ratio = Math.min(bullishScore, bearishScore) / Math.max(bullishScore, bearishScore);
    
    // If scores are within 40% of each other, signals cancel
    if (ratio > 0.6) {
      // Exception: REVERSAL_ATTEMPT regime may use conflicting patterns differently
      if (regimeType === 'REVERSAL_ATTEMPT') {
        return { 
          cancelled: false, 
          netBias: bullishScore > bearishScore ? 'bullish' : 'bearish',
          reason: 'Reversal regime: conflicting patterns may indicate transition'
        };
      }
      
      return { 
        cancelled: true, 
        netBias: 'neutral',
        reason: `Signal cancellation: ${recentBullish.length} bullish vs ${recentBearish.length} bearish patterns`
      };
    }
  }
  
  // No cancellation - return dominant bias
  if (bullishScore > bearishScore * 1.5) {
    return { cancelled: false, netBias: 'bullish', reason: `Bullish patterns dominant (${bullishScore.toFixed(0)} vs ${bearishScore.toFixed(0)})` };
  } else if (bearishScore > bullishScore * 1.5) {
    return { cancelled: false, netBias: 'bearish', reason: `Bearish patterns dominant (${bearishScore.toFixed(0)} vs ${bullishScore.toFixed(0)})` };
  }
  
  return { cancelled: false, netBias: 'neutral', reason: 'Patterns balanced' };
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: INFER MARKET REGIME
// Treat indicators as evidence, not signals
// ═══════════════════════════════════════════════════════════════════════════
export function inferMarketRegime(
  adx: number,
  plusDI: number,
  minusDI: number,
  emaAlignment: 'bullish' | 'bearish' | 'mixed',
  priceVs200EMA: number, // % distance from 200 EMA
  higherHighsLows: boolean,
  lowerHighsLows: boolean
): MarketRegimeInference {
  const evidence: string[] = [];
  
  // Infer regime from ADX + structure
  let regime: MarketRegimeInference['regime'];
  let strength: MarketRegimeInference['strength'];
  let direction: MarketRegimeInference['direction'];
  
  // ADX tells us trend existence, not direction
  if (adx >= 30) {
    regime = 'trending';
    strength = 'strong';
    evidence.push(`ADX ${adx.toFixed(0)} indicates strong trend`);
  } else if (adx >= 20) {
    regime = 'trending';
    strength = 'developing';
    evidence.push(`ADX ${adx.toFixed(0)} indicates developing trend`);
  } else if (adx >= 15) {
    // Weak ADX - could be range or transition
    if (emaAlignment === 'mixed') {
      regime = 'range-bound';
      strength = 'weak';
      evidence.push(`ADX ${adx.toFixed(0)} + mixed EMAs = range-bound`);
    } else {
      regime = 'reversal-attempt';
      strength = 'weak';
      evidence.push(`ADX ${adx.toFixed(0)} with aligned EMAs = potential transition`);
    }
  } else {
    regime = 'range-bound';
    strength = 'none';
    evidence.push(`ADX ${adx.toFixed(0)} indicates no trend`);
  }
  
  // Infer direction from DI and structure
  if (plusDI > minusDI + 5 && emaAlignment === 'bullish') {
    direction = 'bullish';
    evidence.push(`+DI > -DI with bullish EMAs`);
  } else if (minusDI > plusDI + 5 && emaAlignment === 'bearish') {
    direction = 'bearish';
    evidence.push(`-DI > +DI with bearish EMAs`);
  } else {
    direction = 'neutral';
    evidence.push(`DI balanced or EMAs mixed = neutral direction`);
  }
  
  // Check for structure confirmation
  if (direction === 'bullish' && !higherHighsLows) {
    regime = 'reversal-attempt';
    evidence.push(`Bullish indicators but no higher highs/lows = reversal attempt`);
  }
  if (direction === 'bearish' && !lowerHighsLows) {
    regime = 'reversal-attempt';
    evidence.push(`Bearish indicators but no lower highs/lows = reversal attempt`);
  }
  
  // 200 EMA context
  if (Math.abs(priceVs200EMA) > 20) {
    evidence.push(`Price ${priceVs200EMA > 0 ? 'far above' : 'far below'} 200 EMA (${priceVs200EMA.toFixed(0)}%)`);
    if ((priceVs200EMA > 20 && direction === 'bullish') || (priceVs200EMA < -20 && direction === 'bearish')) {
      evidence.push(`Extended move - mean reversion risk elevated`);
    }
  }
  
  return { regime, direction, strength, evidence };
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: INFER RISK REGIME
// ═══════════════════════════════════════════════════════════════════════════
export function inferRiskRegime(
  atrPercent: number,
  historicalVolatility: number,
  bollingerBandwidth: number,
  bollingerB: number,
  rsi: number,
  stochK: number,
  macdHistogram: number
): RiskRegimeInference {
  const evidence: string[] = [];
  
  // ATR context
  let atrContext: RiskRegimeInference['atrContext'];
  if (atrPercent >= 10) {
    atrContext = 'extreme';
    evidence.push(`ATR ${atrPercent.toFixed(1)}% = extreme volatility`);
  } else if (atrPercent >= 6) {
    atrContext = 'high';
    evidence.push(`ATR ${atrPercent.toFixed(1)}% = high volatility`);
  } else if (atrPercent >= 3) {
    atrContext = 'normal';
    evidence.push(`ATR ${atrPercent.toFixed(1)}% = normal volatility`);
  } else {
    atrContext = 'low';
    evidence.push(`ATR ${atrPercent.toFixed(1)}% = low volatility`);
  }
  
  // Risk regime from Bollinger behavior
  let regime: RiskRegimeInference['regime'];
  if (bollingerBandwidth < 15 || historicalVolatility < 25) {
    regime = 'compressed';
    evidence.push(`BB width ${bollingerBandwidth.toFixed(0)}% = volatility compressed`);
  } else if (bollingerBandwidth > 40 || historicalVolatility > 60) {
    regime = 'expanding';
    evidence.push(`BB width ${bollingerBandwidth.toFixed(0)}% = volatility expanding`);
  } else if (atrContext === 'extreme') {
    regime = 'unstable';
    evidence.push(`Extreme ATR with moderate BB = unstable regime`);
  } else {
    regime = 'normal';
  }
  
  // Momentum dispersion (are oscillators agreeing?)
  let momentumDispersion: RiskRegimeInference['momentumDispersion'];
  const rsiBullish = rsi > 50;
  const stochBullish = stochK > 50;
  const macdBullish = macdHistogram > 0;
  
  const bullishCount = [rsiBullish, stochBullish, macdBullish].filter(Boolean).length;
  
  if (bullishCount === 3 || bullishCount === 0) {
    momentumDispersion = 'aligned';
    evidence.push(`Momentum oscillators aligned (${bullishCount}/3 bullish)`);
  } else if (bullishCount === 2 || bullishCount === 1) {
    momentumDispersion = 'diverging';
    evidence.push(`Momentum oscillators diverging (${bullishCount}/3 bullish)`);
  } else {
    momentumDispersion = 'conflicting';
  }
  
  return { regime, atrContext, momentumDispersion, evidence };
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: INFER BEHAVIORAL CONTEXT
// ═══════════════════════════════════════════════════════════════════════════
export function inferBehavioralContext(
  obvTrend: 'rising' | 'falling' | 'flat',
  cmf: number,
  volumeZScore: number,
  rsi: number,
  stochK: number,
  mfi: number,
  priceVs200EMA: number
): BehavioralContextInference {
  const evidence: string[] = [];
  
  // Volume signature
  let volumeSignature: BehavioralContextInference['volumeSignature'];
  const isAccumulation = obvTrend === 'rising' && cmf > 0.05;
  const isDistribution = obvTrend === 'falling' && cmf < -0.05;
  const isExhaustion = volumeZScore > 2.0; // Extreme volume
  
  if (isExhaustion) {
    volumeSignature = 'exhaustion';
    evidence.push(`Volume Z-score ${volumeZScore.toFixed(1)} = potential exhaustion`);
  } else if (isAccumulation) {
    volumeSignature = 'confirming';
    evidence.push(`Rising OBV + positive CMF = accumulation`);
  } else if (isDistribution) {
    volumeSignature = 'diverging';
    evidence.push(`Falling OBV + negative CMF = distribution`);
  } else {
    volumeSignature = 'neutral';
  }
  
  // Oscillator state
  let oscillatorState: BehavioralContextInference['oscillatorState'];
  const avgOscillator = (rsi + stochK + mfi) / 3;
  
  if (stochK > 80 && rsi > 70 && mfi > 80) {
    oscillatorState = 'extreme';
    evidence.push(`All oscillators overbought = extreme`);
  } else if (stochK < 20 && rsi < 30 && mfi < 20) {
    oscillatorState = 'extreme';
    evidence.push(`All oscillators oversold = extreme`);
  } else if (avgOscillator > 65) {
    oscillatorState = 'overbought';
    evidence.push(`Oscillators overbought (avg ${avgOscillator.toFixed(0)})`);
  } else if (avgOscillator < 35) {
    oscillatorState = 'oversold';
    evidence.push(`Oscillators oversold (avg ${avgOscillator.toFixed(0)})`);
  } else {
    oscillatorState = 'neutral';
  }
  
  // Infer behavioral context
  let context: BehavioralContextInference['context'];
  
  if (isAccumulation && oscillatorState !== 'overbought') {
    context = 'accumulation';
    evidence.push(`Accumulation context: volume confirming without overbought`);
  } else if (isDistribution && oscillatorState !== 'oversold') {
    context = 'distribution';
    evidence.push(`Distribution context: volume diverging without oversold`);
  } else if (oscillatorState === 'extreme' || oscillatorState === 'overbought') {
    if (priceVs200EMA > 15) {
      context = 'chasing';
      evidence.push(`Chasing context: overbought + extended above 200 EMA`);
    } else {
      context = 'mean-reversion-risk';
      evidence.push(`Mean-reversion risk: overbought conditions`);
    }
  } else if (oscillatorState === 'oversold' && priceVs200EMA < -15) {
    context = 'mean-reversion-risk';
    evidence.push(`Mean-reversion risk: oversold + extended below 200 EMA`);
  } else {
    context = 'neutral';
  }
  
  return { context, volumeSignature, oscillatorState, evidence };
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: DETERMINE STRATEGY FEASIBILITY
// Based on inferred regimes, determine valid/invalid/conditional strategies
// ═══════════════════════════════════════════════════════════════════════════
export function determineStrategyFeasibility(
  market: MarketRegimeInference,
  risk: RiskRegimeInference,
  behavioral: BehavioralContextInference
): StrategyFeasibility {
  const valid: string[] = [];
  const invalid: string[] = [];
  const conditional: string[] = [];
  const reasoning: string[] = [];
  
  // ─────────────────────────────────────────────────────────────────
  // RULE 1: Weak or range-bound regimes suppress trend-following
  // ─────────────────────────────────────────────────────────────────
  if (market.regime === 'range-bound' || market.strength === 'none' || market.strength === 'weak') {
    invalid.push('trend-continuation');
    invalid.push('breakout-expansion');
    reasoning.push(`Range-bound/weak regime: trend-following and breakouts INVALID`);
    
    valid.push('mean-reversion');
    reasoning.push(`Mean-reversion is valid in range-bound regime`);
    
    conditional.push('speculative-pullback');
    reasoning.push(`Speculative pullback conditional on structure confirmation`);
  }
  
  // ─────────────────────────────────────────────────────────────────
  // RULE 2: Overbought/oversold in weak trends → WAIT or mean-reversion
  // ─────────────────────────────────────────────────────────────────
  if ((behavioral.oscillatorState === 'overbought' || behavioral.oscillatorState === 'extreme') 
      && market.strength !== 'strong') {
    invalid.push('trend-continuation');
    invalid.push('pullback-continuation'); // Buying into overbought
    reasoning.push(`Overbought in weak trend: continuation strategies INVALID`);
    
    if (behavioral.context === 'chasing') {
      valid.push('wait');
      reasoning.push(`Chasing context detected: WAIT is optimal`);
    } else {
      conditional.push('mean-reversion');
      reasoning.push(`Mean-reversion conditional on structure support`);
    }
  }
  
  if ((behavioral.oscillatorState === 'oversold' || behavioral.oscillatorState === 'extreme')
      && market.strength !== 'strong') {
    invalid.push('breakdown-short');
    reasoning.push(`Oversold in weak trend: shorting INVALID`);
    
    conditional.push('mean-reversion');
  }
  
  // ─────────────────────────────────────────────────────────────────
  // RULE 3: Unstable risk regime → speculative only or WAIT
  // ─────────────────────────────────────────────────────────────────
  if (risk.regime === 'unstable' || risk.atrContext === 'extreme') {
    invalid.push('trend-continuation');
    invalid.push('pullback-continuation');
    reasoning.push(`Unstable/extreme volatility: standard strategies INVALID`);
    
    conditional.push('speculative-pullback');
    valid.push('wait');
    reasoning.push(`Speculative pullback or WAIT only in unstable regime`);
  }
  
  // ─────────────────────────────────────────────────────────────────
  // RULE 4: Distribution context suppresses longs
  // ─────────────────────────────────────────────────────────────────
  if (behavioral.context === 'distribution') {
    invalid.push('trend-continuation');
    conditional.push('pullback-continuation');
    reasoning.push(`Distribution context: long strategies suppressed`);
  }
  
  // ─────────────────────────────────────────────────────────────────
  // RULE 5: Strong trending + aligned momentum → full strategy set
  // ─────────────────────────────────────────────────────────────────
  if (market.regime === 'trending' && market.strength === 'strong' 
      && risk.momentumDispersion === 'aligned'
      && behavioral.context !== 'distribution'
      && behavioral.context !== 'chasing') {
    
    if (risk.atrContext === 'low' || risk.atrContext === 'normal') {
      valid.push('trend-continuation');
      valid.push('pullback-continuation');
      reasoning.push(`Strong trend + aligned momentum + normal vol: full strategies VALID`);
    } else {
      valid.push('pullback-continuation');
      conditional.push('trend-continuation');
      reasoning.push(`Strong trend but high vol: pullback valid, continuation conditional`);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────
  // RULE 6: Reversal attempt → breakout only
  // ─────────────────────────────────────────────────────────────────
  if (market.regime === 'reversal-attempt') {
    invalid.push('trend-continuation');
    conditional.push('breakout-expansion');
    reasoning.push(`Reversal attempt: only breakout is conditionally valid`);
    valid.push('wait');
  }
  
  // ─────────────────────────────────────────────────────────────────
  // RULE 7: Compressed volatility → breakout preparation
  // ─────────────────────────────────────────────────────────────────
  if (risk.regime === 'compressed') {
    valid.push('breakout-expansion');
    reasoning.push(`Compressed volatility: breakout strategy valid`);
  }
  
  // ─────────────────────────────────────────────────────────────────
  // DETERMINE DEFAULT ACTION
  // ─────────────────────────────────────────────────────────────────
  let defaultAction: 'trade' | 'wait';
  
  // If no valid strategies OR too many constraints → WAIT
  if (valid.length === 0 || (valid.length === 1 && valid[0] === 'wait')) {
    defaultAction = 'wait';
    if (!valid.includes('wait')) valid.push('wait');
    reasoning.push(`No satisfiable strategies: default to WAIT`);
  } else {
    defaultAction = 'trade';
  }
  
  // If conflicting conditions exist → prefer WAIT
  if (invalid.length >= 3 && valid.length <= 2) {
    defaultAction = 'wait';
    reasoning.push(`Multiple strategy families invalid: WAIT preferred`);
  }
  
  return { valid, invalid, conditional, defaultAction, reasoning };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED REGIME ANALYSIS
// Run all inference steps and return unified analysis
// ═══════════════════════════════════════════════════════════════════════════
export function analyzeRegime(
  adx: number,
  plusDI: number,
  minusDI: number,
  emaAlignment: 'bullish' | 'bearish' | 'mixed',
  priceVs200EMA: number,
  higherHighsLows: boolean,
  lowerHighsLows: boolean,
  atrPercent: number,
  historicalVolatility: number,
  bollingerBandwidth: number,
  bollingerB: number,
  rsi: number,
  stochK: number,
  mfi: number,
  macdHistogram: number,
  obvTrend: 'rising' | 'falling' | 'flat',
  cmf: number,
  volumeZScore: number
): RegimeAnalysis {
  // Step 1: Market regime
  const market = inferMarketRegime(
    adx, plusDI, minusDI, emaAlignment, priceVs200EMA, higherHighsLows, lowerHighsLows
  );
  
  // Step 2: Risk regime
  const risk = inferRiskRegime(
    atrPercent, historicalVolatility, bollingerBandwidth, bollingerB, rsi, stochK, macdHistogram
  );
  
  // Step 3: Behavioral context
  const behavioral = inferBehavioralContext(
    obvTrend, cmf, volumeZScore, rsi, stochK, mfi, priceVs200EMA
  );
  
  // Step 4: Strategy feasibility
  const feasibility = determineStrategyFeasibility(market, risk, behavioral);
  
  return { market, risk, behavioral, feasibility };
}

/**
 * REGIME-FIRST CLASSIFICATION
 * This function MUST run before any strategy recommendation.
 * It determines which strategy types are valid and sets constraints.
 */
export function classifyTradeRegime(
  atrPercent: number,           // ATR as % of price
  historicalVolatility: number, // Historical volatility %
  adx: number,                  // ADX value
  emaAlignment: 'bullish' | 'bearish' | 'mixed',
  structureClassification: 'likely-pullback' | 'trend-reversal-risk' | 'mixed',
  hasReversalPatterns: boolean, // Active bearish patterns at resistance or bullish at support
  hasOBVDivergence: boolean     // OBV diverging from price
): TradeRegime {
  const constraints: string[] = [];
  
  // ═══════════════════════════════════════════════════════════════
  // STEP 1: VOLATILITY CLASS DETERMINATION
  // ═══════════════════════════════════════════════════════════════
  let volatilityClass: 'low' | 'normal' | 'high' | 'speculative';
  let stopMultiplier: number;
  let isSpeculative = false;
  
  if (atrPercent > 10 || historicalVolatility > 80) {
    // SPECULATIVE: Standard trend-following assumptions are INVALID
    volatilityClass = 'speculative';
    stopMultiplier = 2.5; // Wider stops required
    isSpeculative = true;
    constraints.push('⚠️ SPECULATIVE: ATR/HV exceeds safe thresholds');
    constraints.push('Tight stops, aggressive targets, and high confidence are INVALID');
    constraints.push('Reduce position size significantly');
  } else if (atrPercent > 6 || historicalVolatility > 50) {
    volatilityClass = 'high';
    stopMultiplier = 2.0;
    constraints.push('High volatility - wider stops, reduced confidence');
  } else if (atrPercent < 3 && historicalVolatility < 25) {
    volatilityClass = 'low';
    stopMultiplier = 1.25;
    constraints.push('Low volatility - tighter stops, trend continuation favored');
  } else {
    volatilityClass = 'normal';
    stopMultiplier = 1.5;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // STEP 2: STRUCTURE CLASS DETERMINATION
  // ═══════════════════════════════════════════════════════════════
  let structureClass: 'trending' | 'range-bound' | 'transitional';
  
  if (adx >= 25 && emaAlignment !== 'mixed') {
    structureClass = 'trending';
  } else if (adx < 20 || emaAlignment === 'mixed') {
    structureClass = 'range-bound';
    constraints.push('ADX < 20 or mixed EMAs - range-bound regime');
  } else {
    structureClass = 'transitional';
    constraints.push('Transitional regime - wait for confirmation');
  }
  
  // ═══════════════════════════════════════════════════════════════
  // STEP 3: DETERMINE ALLOWED STRATEGY TYPES
  // ═══════════════════════════════════════════════════════════════
  const allowedStrategies: TradeRegime['allowedStrategies'] = [];
  
  if (volatilityClass === 'speculative') {
    // Speculative regime: only mean-reversion and speculative pullbacks
    allowedStrategies.push('speculative-pullback');
    allowedStrategies.push('mean-reversion');
    allowedStrategies.push('wait');
    constraints.push('Trend-continuation and standard breakouts PROHIBITED');
  } else if (structureClass === 'range-bound') {
    // Range-bound: mean-reversion and breakout expansion only
    allowedStrategies.push('mean-reversion');
    allowedStrategies.push('breakout-expansion');
    allowedStrategies.push('wait');
    constraints.push('Trend-following strategies PROHIBITED in range');
  } else if (structureClass === 'trending') {
    // Trending: full strategy set available
    if (volatilityClass === 'low') {
      allowedStrategies.push('trend-continuation');
    }
    allowedStrategies.push('pullback-continuation');
    allowedStrategies.push('breakout-expansion');
    if (volatilityClass === 'high') {
      allowedStrategies.push('speculative-pullback');
    }
    allowedStrategies.push('wait');
  } else {
    // Transitional: breakout or wait
    allowedStrategies.push('breakout-expansion');
    allowedStrategies.push('wait');
  }
  
  // ═══════════════════════════════════════════════════════════════
  // STEP 4: SET REGIME CONSTRAINTS (caps on confidence, targets, holding period)
  // ═══════════════════════════════════════════════════════════════
  let maxConfidence: number;
  let maxTargetMultiple: number;
  let maxHoldingDays: number;
  let requiresConfirmation = false;
  
  // Confidence caps based on regime
  if (volatilityClass === 'speculative') {
    maxConfidence = 50;
    maxTargetMultiple = 1.5;
    maxHoldingDays = 3;
    requiresConfirmation = true;
  } else if (volatilityClass === 'high') {
    maxConfidence = 60;
    maxTargetMultiple = 2.0;
    maxHoldingDays = 5;
  } else if (structureClass === 'range-bound') {
    maxConfidence = 55;
    maxTargetMultiple = 1.5;
    maxHoldingDays = 5;
  } else if (structureClass === 'transitional') {
    maxConfidence = 60;
    maxTargetMultiple = 2.0;
    maxHoldingDays = 7;
    requiresConfirmation = true;
  } else {
    // Normal trending
    maxConfidence = 75;
    maxTargetMultiple = 3.0;
    maxHoldingDays = 15;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // STEP 5: CONTRADICTION DOWNGRADES
  // ═══════════════════════════════════════════════════════════════
  // Reversal patterns or OBV divergence MUST reduce confidence
  if (hasReversalPatterns) {
    maxConfidence = Math.min(maxConfidence, 55);
    requiresConfirmation = true;
    constraints.push('Reversal patterns detected - confirmation required');
  }
  
  if (hasOBVDivergence) {
    maxConfidence = Math.min(maxConfidence, 55);
    constraints.push('OBV divergence - confidence capped, early exits encouraged');
  }
  
  // Both present = WAIT recommended
  if (hasReversalPatterns && hasOBVDivergence) {
    maxConfidence = Math.min(maxConfidence, 45);
    constraints.push('Multiple contradictions - WAIT or reduce position significantly');
  }
  
  return {
    volatilityClass,
    structureClass,
    allowedStrategies,
    maxConfidence,
    maxTargetMultiple,
    maxHoldingDays,
    stopMultiplier,
    isSpeculative,
    requiresConfirmation,
    constraints
  };
}

/**
 * Analyze price action and structure to classify current move
 * as pullback, potential reversal, or mixed/unclear
 * Integrates candlestick pattern detection with structural analysis
 */
export function analyzeStructure(
  bars: OHLCV[],
  momentum: MomentumAssessment,
  trend: TrendAssessment,
  volatility: VolatilityAssessment,
  nearTermSupport: { price: number; touches: number; strength: number }[],
  nearTermResistance: { price: number; touches: number; strength: number }[]
): StructureAnalysis {
  if (bars.length < 20) {
    return {
      classification: 'mixed',
      confidence: 0,
      summary: 'Insufficient data for structure analysis',
      pullbackSignals: [],
      reversalSignals: [],
      dominantBias: 'neutral',
      priorTrendDirection: 'sideways',
      structureIntact: false,
      detectedPatterns: []
    };
  }

  const currentPrice = bars[bars.length - 1].close;
  const atr = volatility.current;
  
  // Get recent bars for analysis (last 20 bars)
  const recentBars = bars.slice(-20);
  const last5Bars = bars.slice(-5);
  
  // Calculate EMAs for reference
  const closes = bars.map(b => b.close);
  const ema9 = calculateEMAValue(closes, 9);
  const ema20 = calculateEMAValue(closes, 20);
  const ema50 = calculateEMAValue(closes, 50);
  
  // Find swing highs and lows in recent bars
  const swingPoints = findSwingPoints(bars.slice(-50));
  const recentSwingHigh = swingPoints.highs[0] || { price: currentPrice + atr * 2, index: 0 };
  const recentSwingLow = swingPoints.lows[0] || { price: currentPrice - atr * 2, index: 0 };
  
  // Determine prior trend direction
  let priorTrendDirection: 'up' | 'down' | 'sideways';
  if (trend.primary.direction === 'uptrend') {
    priorTrendDirection = 'up'; 
  } else if (trend.primary.direction === 'downtrend') {
    priorTrendDirection = 'down';
  } else {
    priorTrendDirection = 'sideways';
  }
  
  // ==========================================
  // CANDLESTICK PATTERN DETECTION
  // ==========================================
  const supportPrices = nearTermSupport.map(s => s.price);
  const resistancePrices = nearTermResistance.map(r => r.price);
  const emaLevels = [ema9, ema20, ema50];
  
  // Scan last 10 bars for candlestick patterns near key levels
  const detectedPatternsRaw = scanRecentPatternsWithContext(
    bars,
    10,
    supportPrices,
    resistancePrices,
    emaLevels
  );
  
  // Convert patterns to the output format with location context and outcome
  const detectedPatterns: StructureAnalysis['detectedPatterns'] = detectedPatternsRaw.map(p => {
    // Build location with both level context AND bar position
    const barPosition = p.barIndex === 0 ? 'current' : `${p.barIndex} bars ago`;
    
    let levelContext = '';
    if (p.nearSupport && p.nearResistance) {
      levelContext = 'at key level';
    } else if (p.nearSupport) {
      levelContext = 'at support';
    } else if (p.nearResistance) {
      levelContext = 'at resistance';
    } else if (p.nearEMA) {
      levelContext = 'near EMA';
    }
    
    // Combine: "near EMA (current)" or "at support (2 bars ago)"
    const location = levelContext 
      ? `${levelContext} (${barPosition})`
      : barPosition;
    
    return {
      name: p.pattern.name,
      type: p.pattern.type,
      confidence: p.pattern.confidence,
      location,
      outcome: p.outcome,
      outcomeDescription: p.outcomeDescription
    };
  });
  
  // ==========================================
  // SIGNAL ARRAYS (declare both early so patterns can add to either)
  // ==========================================
  const pullbackSignals: string[] = [];
  let pullbackScore = 0;
  const reversalSignals: string[] = [];
  let reversalScore = 0;
  
  // 1. Trend still intact (ADX shows trend, EMAs aligned)
  const adxData = calculateADX(bars);
  const currentADX = adxData.adx.filter(v => v !== undefined).pop() || 15;
  const plusDI = adxData.plusDI.filter(v => v !== undefined).pop() || 20;
  const minusDI = adxData.minusDI.filter(v => v !== undefined).pop() || 20;
  
  if (currentADX >= 20) {
    if (priorTrendDirection === 'up' && plusDI > minusDI) {
      pullbackSignals.push('Uptrend intact: ADX ' + currentADX.toFixed(0) + ' with +DI > -DI');
      pullbackScore += 15;
    } else if (priorTrendDirection === 'down' && minusDI > plusDI) {
      pullbackSignals.push('Downtrend intact: ADX ' + currentADX.toFixed(0) + ' with -DI > +DI');
      pullbackScore += 15;
    }
  }
  
  // 2. Higher highs / higher lows (uptrend) or lower highs / lower lows (downtrend)
  const higherLows = checkHigherLows(recentBars);
  const lowerHighs = checkLowerHighs(recentBars);
  
  if (priorTrendDirection === 'up' && higherLows) {
    pullbackSignals.push('Higher lows intact above support - uptrend structure holding');
    pullbackScore += 20;
  } else if (priorTrendDirection === 'down' && lowerHighs) {
    pullbackSignals.push('Lower highs below resistance - downtrend structure holding');
    pullbackScore += 20;
  }
  
  // 3. Small or wick-heavy candles (indecision, not conviction selling/buying)
  const recentCandleAnalysis = analyzeCandleCharacter(last5Bars, atr);
  if (recentCandleAnalysis.smallBodies) {
    pullbackSignals.push('Small candle bodies show weak counter-trend pressure');
    pullbackScore += 10;
  }
  if (recentCandleAnalysis.longWicks) {
    pullbackSignals.push('Long wicks indicate price rejection at extremes');
    pullbackScore += 10;
  }
  
  // 4. Normal or lower volume on the dip/rally
  const volumeAnalysis = analyzeVolumePattern(bars);
  if (volumeAnalysis.decliningOnCounter) {
    pullbackSignals.push('Volume declining on pullback (healthy correction)');
    pullbackScore += 15;
  }
  
  // 5. EMA position analysis - be precise about above/below
  // Calculate actual percentages for accuracy
  const pctFromEma20 = ((currentPrice - ema20) / ema20) * 100;
  const pctFromEma50 = ((currentPrice - ema50) / ema50) * 100;
  
  // Thresholds: "above" means actually above (positive %), "near" means within 1%
  const aboveEMA20 = pctFromEma20 > 0;
  const aboveEMA50 = pctFromEma50 > 0;
  const nearEMA20 = Math.abs(pctFromEma20) <= 1.0; // Within 1%
  const nearEMA50 = Math.abs(pctFromEma50) <= 1.5; // Within 1.5%
  const belowEMA20 = pctFromEma20 < -1.0; // More than 1% below
  const belowEMA50 = pctFromEma50 < -1.5; // More than 1.5% below
  
  if (priorTrendDirection === 'up') {
    // In uptrend, price above EMAs is bullish confirmation
    if (aboveEMA20) {
      pullbackSignals.push('Price above 20 EMA ($' + ema20.toFixed(2) + ')');
      pullbackScore += 15;
    } else if (nearEMA20 && !belowEMA20) {
      pullbackSignals.push('Price testing 20 EMA ($' + ema20.toFixed(2) + ') - watching for bounce');
      pullbackScore += 8;
    }
    
    if (aboveEMA50) {
      pullbackSignals.push('Price above 50 EMA ($' + ema50.toFixed(2) + ')');
      pullbackScore += 10;
    } else if (nearEMA50 && !belowEMA50) {
      pullbackSignals.push('Price near 50 EMA ($' + ema50.toFixed(2) + ') - key support test');
      pullbackScore += 5;
    }
  } else if (priorTrendDirection === 'down') {
    // In downtrend, price below EMAs is bearish confirmation
    if (!aboveEMA20 && belowEMA20) {
      pullbackSignals.push('Price below 20 EMA ($' + ema20.toFixed(2) + ')');
      pullbackScore += 15;
    } else if (nearEMA20) {
      pullbackSignals.push('Price testing 20 EMA ($' + ema20.toFixed(2) + ') - watching for rejection');
      pullbackScore += 8;
    }
    
    if (!aboveEMA50 && belowEMA50) {
      pullbackSignals.push('Price below 50 EMA ($' + ema50.toFixed(2) + ')');
      pullbackScore += 10;
    } else if (nearEMA50) {
      pullbackSignals.push('Price near 50 EMA ($' + ema50.toFixed(2) + ') - key resistance test');
      pullbackScore += 5;
    }
  }
  
  // 6. RSI not extreme / showing divergence
  const rsiArray = calculateRSI(closes, 14);
  const currentRSI = rsiArray[rsiArray.length - 1] || 50;
  if (priorTrendDirection === 'up' && currentRSI >= 35 && currentRSI <= 55) {
    pullbackSignals.push('RSI (' + currentRSI.toFixed(0) + ') in healthy pullback zone');
    pullbackScore += 10;
  } else if (priorTrendDirection === 'down' && currentRSI >= 45 && currentRSI <= 65) {
    pullbackSignals.push('RSI (' + currentRSI.toFixed(0) + ') in healthy rally zone');
    pullbackScore += 10;
  }
  
  // 7. CANDLESTICK PATTERNS - with OUTCOME awareness
  // Track which pattern names we've already processed to avoid duplicates
  const processedPatternsPullback = new Set<string>();
  const processedPatternsReversal = new Set<string>();
  
  for (const p of detectedPatternsRaw) {
    const locationDesc = p.nearSupport ? 'at support' : p.nearResistance ? 'at resistance' : p.nearEMA ? 'near EMA' : '';
    const barsAgo = p.barIndex === 0 ? '' : ` (${p.barIndex} bars ago)`;
    const patternKey = `${p.pattern.name}-${p.pattern.type}`;
    
    // ===== BULLISH patterns in UPTREND =====
    if (priorTrendDirection === 'up' && p.pattern.type === 'bullish') {
      if (p.outcome === 'confirmed' && !processedPatternsPullback.has(patternKey)) {
        // Confirmed bullish pattern = strong pullback confirmation
        const signal = `✓ ${p.pattern.name} ${locationDesc}${barsAgo} confirmed - buyers in control`;
        pullbackSignals.push(signal);
        pullbackScore += 25;
        processedPatternsPullback.add(patternKey);
      } else if (p.outcome === 'active' && p.barIndex <= 2 && (p.nearSupport || p.nearEMA) && !processedPatternsPullback.has(patternKey)) {
        // ONLY recent active patterns (<=2 bars) count as developing
        const signal = `✓ ${p.pattern.name} ${locationDesc} (${p.barIndex === 0 ? 'current' : p.barIndex + ' bars ago'})`;
        pullbackSignals.push(signal);
        pullbackScore += p.pattern.confidence >= 60 ? 15 : 10;
        processedPatternsPullback.add(patternKey);
      } else if (p.outcome === 'failed' && !processedPatternsReversal.has(patternKey)) {
        // FAILED bullish pattern in uptrend = BEARISH warning! Bulls tried and lost
        const signal = `⚠️ Failed ${p.pattern.name}${barsAgo} - bulls rejected, selling pressure`;
        reversalSignals.push(signal);
        reversalScore += 15;
        processedPatternsReversal.add(patternKey);
      }
    }
    
    // ===== BEARISH patterns in UPTREND - key for reversal/confirmation =====
    if (priorTrendDirection === 'up' && p.pattern.type === 'bearish') {
      if (p.outcome === 'failed' && !processedPatternsPullback.has(patternKey)) {
        // FAILED bearish pattern = BULLISH confirmation! Bears tried and lost
        const signal = `✓ Failed ${p.pattern.name}${barsAgo} - bears rejected, bulls in control`;
        pullbackSignals.push(signal);
        pullbackScore += 20;
        processedPatternsPullback.add(patternKey);
      }
      // Active or confirmed bearish patterns handled in reversal section below
    }
    
    // ===== BEARISH patterns in DOWNTREND =====
    if (priorTrendDirection === 'down' && p.pattern.type === 'bearish') {
      if (p.outcome === 'confirmed' && !processedPatternsPullback.has(patternKey)) {
        const signal = `✓ ${p.pattern.name} ${locationDesc}${barsAgo} confirmed - sellers in control`;
        pullbackSignals.push(signal);
        pullbackScore += 25;
        processedPatternsPullback.add(patternKey);
      } else if (p.outcome === 'active' && p.barIndex <= 2 && (p.nearResistance || p.nearEMA) && !processedPatternsPullback.has(patternKey)) {
        const signal = `✓ ${p.pattern.name} ${locationDesc} (${p.barIndex === 0 ? 'current' : p.barIndex + ' bars ago'})`;
        pullbackSignals.push(signal);
        pullbackScore += p.pattern.confidence >= 60 ? 15 : 10;
        processedPatternsPullback.add(patternKey);
      } else if (p.outcome === 'failed' && !processedPatternsReversal.has(patternKey)) {
        // FAILED bearish pattern in downtrend = BULLISH warning
        const signal = `⚠️ Failed ${p.pattern.name}${barsAgo} - sellers rejected, buying pressure`;
        reversalSignals.push(signal);
        reversalScore += 15;
        processedPatternsReversal.add(patternKey);
      }
    }
    
    // ===== BULLISH patterns in DOWNTREND - key for reversal/confirmation =====
    if (priorTrendDirection === 'down' && p.pattern.type === 'bullish') {
      if (p.outcome === 'failed' && !processedPatternsPullback.has(patternKey)) {
        // FAILED bullish pattern = BEARISH confirmation! Bulls tried and lost
        const signal = `✓ Failed ${p.pattern.name}${barsAgo} - bulls rejected, bears in control`;
        pullbackSignals.push(signal);
        pullbackScore += 20;
        processedPatternsPullback.add(patternKey);
      }
    }
  }
  
  // ==========================================
  // REVERSAL SIGNALS (structure breaking) - continued
  // ==========================================
  
  // 1. Break of prior swing high/low
  if (priorTrendDirection === 'up' && currentPrice < recentSwingLow.price) {
    reversalSignals.push('⚠️ Broke prior swing low ($' + recentSwingLow.price.toFixed(2) + ') - structure break');
    reversalScore += 25;
  } else if (priorTrendDirection === 'down' && currentPrice > recentSwingHigh.price) {
    reversalSignals.push('⚠️ Broke prior swing high ($' + recentSwingHigh.price.toFixed(2) + ') - structure break');
    reversalScore += 25;
  }
  
  // 2. Large wide-range candles through support/resistance
  if (recentCandleAnalysis.wideRangeBars) {
    reversalSignals.push('Wide-range candles indicate strong conviction');
    reversalScore += 15;
  }
  
  // Check for key level breaks
  const nearestSupport = nearTermSupport[0]?.price || currentPrice - atr * 2;
  const nearestResistance = nearTermResistance[0]?.price || currentPrice + atr * 2;
  
  if (priorTrendDirection === 'up' && currentPrice < nearestSupport) {
    reversalSignals.push('⚠️ Closed below support ($' + nearestSupport.toFixed(2) + ')');
    reversalScore += 20;
  } else if (priorTrendDirection === 'down' && currentPrice > nearestResistance) {
    reversalSignals.push('⚠️ Closed above resistance ($' + nearestResistance.toFixed(2) + ')');
    reversalScore += 20;
  }
  
  // 3. Elevated volume on the counter-trend move
  if (volumeAnalysis.elevatedOnCounter) {
    reversalSignals.push('⚠️ Elevated volume on counter-trend (distribution)');
    reversalScore += 20;
  }
  
  // 4. Closes below/above key EMAs - use the already calculated percentages
  // Only flag as reversal warning if clearly below (not just touching)
  if (priorTrendDirection === 'up') {
    // In uptrend, being significantly below EMAs is a warning
    if (belowEMA20 && belowEMA50) {
      // Clearly below both - strong warning
      reversalSignals.push('⚠️ Price below both 20 EMA (' + pctFromEma20.toFixed(1) + '%) and 50 EMA (' + pctFromEma50.toFixed(1) + '%)');
      reversalScore += 20;
    } else if (belowEMA50 && !aboveEMA20) {
      // Below 50 EMA and not clearly above 20 EMA
      reversalSignals.push('⚠️ Price below 50 EMA (' + pctFromEma50.toFixed(1) + '%)');
      reversalScore += 12;
    } else if (belowEMA20 && nearEMA50) {
      // Below 20 EMA, testing 50 EMA
      reversalSignals.push('⚠️ Price below 20 EMA, testing 50 EMA support');
      reversalScore += 10;
    }
  } else if (priorTrendDirection === 'down') {
    // In downtrend, being significantly above EMAs is a warning
    const aboveThreshold20 = pctFromEma20 > 1.0;
    const aboveThreshold50 = pctFromEma50 > 1.5;
    
    if (aboveThreshold20 && aboveThreshold50) {
      reversalSignals.push('⚠️ Price above both 20 EMA (+'+ pctFromEma20.toFixed(1) + '%) and 50 EMA (+' + pctFromEma50.toFixed(1) + '%)');
      reversalScore += 20;
    } else if (aboveThreshold50 && aboveEMA20) {
      reversalSignals.push('⚠️ Price above 50 EMA (+' + pctFromEma50.toFixed(1) + '%)');
      reversalScore += 12;
    } else if (aboveThreshold20 && nearEMA50) {
      reversalSignals.push('⚠️ Price above 20 EMA, testing 50 EMA resistance');
      reversalScore += 10;
    }
  }
  
  // 5. Momentum flipping (MACD cross, Stoch cross)
  const macd = calculateMACD(closes);
  const currentHist = macd.histogram[macd.histogram.length - 1] || 0;
  const prevHist = macd.histogram[macd.histogram.length - 2] || 0;
  
  if (priorTrendDirection === 'up' && currentHist < 0 && prevHist > 0) {
    reversalSignals.push('MACD histogram crossed below zero - momentum shift');
    reversalScore += 10;
  } else if (priorTrendDirection === 'down' && currentHist > 0 && prevHist < 0) {
    reversalSignals.push('MACD histogram crossed above zero - momentum shift');
    reversalScore += 10;
  }
  
  // 6. RSI extreme readings
  if (priorTrendDirection === 'up' && currentRSI < 30) {
    reversalSignals.push('⚠️ RSI (' + currentRSI.toFixed(0) + ') deeply oversold - panic selling');
    reversalScore += 10;
  } else if (priorTrendDirection === 'down' && currentRSI > 70) {
    reversalSignals.push('⚠️ RSI (' + currentRSI.toFixed(0) + ') deeply overbought');
    reversalScore += 10;
  }
  
  // 7. OBV divergence / CMF showing distribution
  if (volumeAnalysis.obvDiverging) {
    reversalSignals.push('OBV diverging from price - hidden weakness');
    reversalScore += 10;
  }
  
  // 8. CANDLESTICK PATTERNS - REVERSAL SIGNALS with OUTCOME awareness
  for (const p of detectedPatternsRaw) {
    const locationDesc = p.nearSupport ? 'at support' : p.nearResistance ? 'at resistance' : p.nearEMA ? 'near EMA' : '';
    const barsAgo = p.barIndex === 0 ? '' : ` (${p.barIndex} bars ago)`;
    
    // Skip patterns that have already been handled as pullback confirmations
    // (e.g., failed bearish patterns in uptrend = bullish, already added above)
    
    // ===== BEARISH patterns in UPTREND - potential reversal signals =====
    if (priorTrendDirection === 'up' && p.pattern.type === 'bearish') {
      // Only flag as reversal risk if pattern is ACTIVE or CONFIRMED
      // FAILED patterns were already handled as bullish confirmation above
      if (p.outcome === 'confirmed') {
        // Confirmed bearish pattern in uptrend = serious reversal warning
        const signal = `⚠️ ${p.pattern.name}${barsAgo} CONFIRMED - reversal in progress`;
        if (!reversalSignals.some(s => s.includes(p.pattern.name))) {
          reversalSignals.push(signal);
          reversalScore += 25;
        }
      } else if (p.outcome === 'active' && p.barIndex <= 2) {
        // Active bearish pattern (recent) = watch for confirmation
        const signal = `⚠️ ${p.pattern.name} ${locationDesc} (watch for follow-through)`;
        if (!reversalSignals.some(s => s.includes(p.pattern.name))) {
          reversalSignals.push(signal);
          reversalScore += p.pattern.confidence >= 70 ? 15 : 10;
        }
      }
      // Note: p.outcome === 'failed' is handled in pullback section as bullish confirmation
    }
    
    // ===== BULLISH patterns in DOWNTREND - potential reversal signals =====
    if (priorTrendDirection === 'down' && p.pattern.type === 'bullish') {
      if (p.outcome === 'confirmed') {
        const signal = `⚠️ ${p.pattern.name}${barsAgo} CONFIRMED - reversal in progress`;
        if (!reversalSignals.some(s => s.includes(p.pattern.name))) {
          reversalSignals.push(signal);
          reversalScore += 25;
        }
      } else if (p.outcome === 'active' && p.barIndex <= 2) {
        const signal = `⚠️ ${p.pattern.name} ${locationDesc} (watch for follow-through)`;
        if (!reversalSignals.some(s => s.includes(p.pattern.name))) {
          reversalSignals.push(signal);
          reversalScore += p.pattern.confidence >= 70 ? 15 : 10;
        }
      }
    }
    
    // Also check for patterns breaking key levels
    const isBreakingSupport = nearTermSupport.length > 0 && currentPrice <= nearTermSupport[0].price;
    const isBreakingResistance = nearTermResistance.length > 0 && currentPrice >= nearTermResistance[0].price;
    
    if (priorTrendDirection === 'up' && p.pattern.type === 'bearish' && isBreakingSupport && p.outcome !== 'failed') {
      const signal = `⚠️ ${p.pattern.name} breaking support - high reversal risk`;
      if (!reversalSignals.some(s => s.includes('breaking support'))) {
        reversalSignals.push(signal);
        reversalScore += 20;
      }
    }
    
    if (priorTrendDirection === 'down' && p.pattern.type === 'bullish' && isBreakingResistance && p.outcome !== 'failed') {
      const signal = `⚠️ ${p.pattern.name} breaking resistance - high reversal risk`;
      if (!reversalSignals.some(s => s.includes('breaking resistance'))) {
        reversalSignals.push(signal);
        reversalScore += 20;
      }
    }
  }
  
  // ==========================================
  // CLASSIFICATION
  // ==========================================
  
  // Determine dominant bias and classification
  let classification: 'likely-pullback' | 'trend-reversal-risk' | 'mixed';
  let dominantBias: 'pullback' | 'reversal' | 'neutral';
  let confidence: number;
  let structureIntact: boolean;
  
  const pullbackStrength = Math.min(100, pullbackScore);
  const reversalStrength = Math.min(100, reversalScore);
  const netScore = pullbackStrength - reversalStrength;
  
  if (netScore >= 25 && pullbackStrength >= 40) {
    classification = 'likely-pullback';
    dominantBias = 'pullback';
    confidence = Math.min(85, 50 + netScore / 2);
    structureIntact = true;
  } else if (netScore <= -20 && reversalStrength >= 35) {
    classification = 'trend-reversal-risk';
    dominantBias = 'reversal';
    confidence = Math.min(85, 50 + Math.abs(netScore) / 2);
    structureIntact = false;
  } else {
    classification = 'mixed';
    dominantBias = 'neutral';
    confidence = Math.max(20, 50 - Math.abs(netScore) / 2);
    structureIntact = pullbackStrength > reversalStrength;
  }
  
  // Generate summary with CORRECT pattern context
  // Find a pattern that SUPPORTS the thesis (not failed, correct type, preferably recent)
  let summary: string;
  let patternContext = '';
  
  // Find the best supporting pattern based on thesis
  let supportingPattern: typeof detectedPatterns[0] | null = null;
  let warningPattern: typeof detectedPatterns[0] | null = null;
  
  for (const p of detectedPatterns) {
    // Skip failed patterns from being used as "supporting" evidence
    if (p.outcome === 'failed') {
      // A failed pattern of the OPPOSITE type could be supporting
      // e.g., failed bearish in uptrend = bullish confirmation
      if (priorTrendDirection === 'up' && p.type === 'bearish' && !supportingPattern) {
        supportingPattern = { ...p, name: `Failed ${p.name}` };
      } else if (priorTrendDirection === 'down' && p.type === 'bullish' && !supportingPattern) {
        supportingPattern = { ...p, name: `Failed ${p.name}` };
      }
      // Failed pattern of same type as trend = warning
      else if (priorTrendDirection === 'up' && p.type === 'bullish' && !warningPattern) {
        warningPattern = p;
      } else if (priorTrendDirection === 'down' && p.type === 'bearish' && !warningPattern) {
        warningPattern = p;
      }
      continue;
    }
    
    // For pullback classification in uptrend, bullish patterns support
    if (classification === 'likely-pullback' && priorTrendDirection === 'up') {
      if (p.type === 'bullish' && (p.outcome === 'confirmed' || p.outcome === 'active') && !supportingPattern) {
        supportingPattern = p;
      } else if (p.type === 'bearish' && p.outcome === 'active' && !warningPattern) {
        warningPattern = p;
      }
    }
    // For pullback classification in downtrend, bearish patterns support
    else if (classification === 'likely-pullback' && priorTrendDirection === 'down') {
      if (p.type === 'bearish' && (p.outcome === 'confirmed' || p.outcome === 'active') && !supportingPattern) {
        supportingPattern = p;
      } else if (p.type === 'bullish' && p.outcome === 'active' && !warningPattern) {
        warningPattern = p;
      }
    }
    // For reversal classification, opposite patterns support
    else if (classification === 'trend-reversal-risk') {
      if (priorTrendDirection === 'up' && p.type === 'bearish' && (p.outcome === 'confirmed' || p.outcome === 'active') && !supportingPattern) {
        supportingPattern = p;
      } else if (priorTrendDirection === 'down' && p.type === 'bullish' && (p.outcome === 'confirmed' || p.outcome === 'active') && !supportingPattern) {
        supportingPattern = p;
      }
    }
  }
  
  // Build pattern context based on what we found
  if (supportingPattern) {
    const outcomeNote = supportingPattern.outcome === 'confirmed' ? ' (confirmed)' : '';
    patternContext = ` ${supportingPattern.name} ${supportingPattern.location}${outcomeNote} supports this view.`;
  } else if (warningPattern) {
    if (warningPattern.outcome === 'failed') {
      patternContext = ` Note: ${warningPattern.name} ${warningPattern.location} failed - watch for follow-through.`;
    } else {
      patternContext = ` Caution: ${warningPattern.name} ${warningPattern.location} suggests caution.`;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // LANGUAGE DISCIPLINE: Pullback wording must reflect momentum state
  // "Healthy" ONLY allowed when momentum confirms (score > 0)
  // ═══════════════════════════════════════════════════════════════
  
  const hasWarning = !!warningPattern;
  // Check if momentum is bearish from the assessment
  const isBearishMomentumContext = momentum.direction === 'bearish' || momentum.score < -10;
  
  if (classification === 'likely-pullback') {
    if (priorTrendDirection === 'up') {
      if (hasWarning || isBearishMomentumContext) {
        // Cautious language when warnings OR bearish momentum
        summary = `Pullback in uptrend - under pressure. Momentum deterioration warrants caution.${patternContext}`;
      } else {
        // Only use "healthy" when momentum is not bearish and no warnings
        summary = `Healthy pullback in uptrend. Structure intact with higher lows holding.${patternContext}`;
      }
    } else if (priorTrendDirection === 'down') {
      if (hasWarning || momentum.direction === 'bullish') {
        summary = `Bounce in downtrend - testing resistance. Watch for reversal signals.${patternContext}`;
      } else {
        summary = `Normal bounce in downtrend. Lower highs intact, resistance likely to hold.${patternContext}`;
      }
    } else {
      summary = `Correction within range. Price action suggests the recent trend is intact.${patternContext}`;
    }
  } else if (classification === 'trend-reversal-risk') {
    if (priorTrendDirection === 'up') {
      summary = `Potential trend reversal. Multiple signals suggest the uptrend may be breaking down.${patternContext}`;
    } else if (priorTrendDirection === 'down') {
      summary = `Possible trend reversal forming. Downtrend structure showing cracks.${patternContext}`;
    } else {
      summary = `Structure breakout developing. Directional move may be starting.${patternContext}`;
    }
  } else {
    summary = `Mixed signals - no clear edge. ${pullbackSignals.length} pullback vs ${reversalSignals.length} reversal signals.${patternContext}`;
  }
  
  return {
    classification,
    confidence: Math.round(confidence),
    summary,
    pullbackSignals: pullbackSignals.slice(0, 5),
    reversalSignals: reversalSignals.slice(0, 5),
    dominantBias,
    priorTrendDirection,
    structureIntact,
    detectedPatterns
  };
}

// ==========================================
// HELPER FUNCTIONS FOR STRUCTURE ANALYSIS
// ==========================================

function calculateEMAValue(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;
  
  const multiplier = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

function findSwingPoints(bars: OHLCV[]): { 
  highs: { price: number; index: number }[]; 
  lows: { price: number; index: number }[] 
} {
  const highs: { price: number; index: number }[] = [];
  const lows: { price: number; index: number }[] = [];
  
  for (let i = 2; i < bars.length - 2; i++) {
    // Swing high: higher than 2 bars on each side
    if (bars[i].high > bars[i-1].high && bars[i].high > bars[i-2].high &&
        bars[i].high > bars[i+1].high && bars[i].high > bars[i+2].high) {
      highs.push({ price: bars[i].high, index: i });
    }
    
    // Swing low: lower than 2 bars on each side
    if (bars[i].low < bars[i-1].low && bars[i].low < bars[i-2].low &&
        bars[i].low < bars[i+1].low && bars[i].low < bars[i+2].low) {
      lows.push({ price: bars[i].low, index: i });
    }
  }
  
  // Sort by recency (most recent first)
  highs.sort((a, b) => b.index - a.index);
  lows.sort((a, b) => b.index - a.index);
  
  return { highs, lows };
}

function checkHigherLows(bars: OHLCV[]): boolean {
  const lows = bars.map(b => b.low);
  let higherLowCount = 0;
  
  for (let i = 5; i < lows.length; i += 5) {
    const prevMin = Math.min(...lows.slice(Math.max(0, i - 5), i));
    const currMin = Math.min(...lows.slice(i, Math.min(lows.length, i + 5)));
    if (currMin > prevMin * 0.99) higherLowCount++;
  }
  
  return higherLowCount >= 2;
}

function checkLowerHighs(bars: OHLCV[]): boolean {
  const highs = bars.map(b => b.high);
  let lowerHighCount = 0;
  
  for (let i = 5; i < highs.length; i += 5) {
    const prevMax = Math.max(...highs.slice(Math.max(0, i - 5), i));
    const currMax = Math.max(...highs.slice(i, Math.min(highs.length, i + 5)));
    if (currMax < prevMax * 1.01) lowerHighCount++;
  }
  
  return lowerHighCount >= 2;
}

function analyzeCandleCharacter(bars: OHLCV[], atr: number): {
  smallBodies: boolean;
  longWicks: boolean;
  wideRangeBars: boolean;
} {
  let smallBodyCount = 0;
  let longWickCount = 0;
  let wideRangeCount = 0;
  
  for (const bar of bars) {
    const body = Math.abs(bar.close - bar.open);
    const range = bar.high - bar.low;
    const upperWick = bar.high - Math.max(bar.open, bar.close);
    const lowerWick = Math.min(bar.open, bar.close) - bar.low;
    const totalWicks = upperWick + lowerWick;
    
    // Small body (less than 30% of ATR)
    if (body < atr * 0.3) smallBodyCount++;
    
    // Long wicks (wicks > body)
    if (totalWicks > body * 1.5) longWickCount++;
    
    // Wide range bar (range > 1.5x ATR)
    if (range > atr * 1.5) wideRangeCount++;
  }
  
  return {
    smallBodies: smallBodyCount >= Math.ceil(bars.length * 0.5),
    longWicks: longWickCount >= Math.ceil(bars.length * 0.4),
    wideRangeBars: wideRangeCount >= 2
  };
}

function analyzeVolumePattern(bars: OHLCV[]): {
  decliningOnCounter: boolean;
  elevatedOnCounter: boolean;
  obvDiverging: boolean;
} {
  if (bars.length < 20) {
    return { decliningOnCounter: false, elevatedOnCounter: false, obvDiverging: false };
  }
  
  const recentBars = bars.slice(-10);
  const priorBars = bars.slice(-20, -10);
  
  // Calculate average volumes
  const recentAvgVol = recentBars.reduce((sum, b) => sum + b.volume, 0) / recentBars.length;
  const priorAvgVol = priorBars.reduce((sum, b) => sum + b.volume, 0) / priorBars.length;
  
  // Determine if recent move is counter-trend
  const recentClose = recentBars[recentBars.length - 1].close;
  const priorClose = priorBars[priorBars.length - 1].close;
  const priorTrend = priorClose > priorBars[0].close ? 'up' : 'down';
  const recentMove = recentClose > priorClose ? 'up' : 'down';
  const isCounterTrend = priorTrend !== recentMove;
  
  // Volume declining on counter-trend = healthy pullback
  const decliningOnCounter = isCounterTrend && recentAvgVol < priorAvgVol * 0.85;
  
  // Volume elevated on counter-trend = potential reversal
  const elevatedOnCounter = isCounterTrend && recentAvgVol > priorAvgVol * 1.3;
  
  // OBV divergence check
  let obv = 0;
  const obvArray: number[] = [];
  for (const bar of bars.slice(-30)) {
    if (bar.close > bar.open) {
      obv += bar.volume;
    } else if (bar.close < bar.open) {
      obv -= bar.volume;
    }
    obvArray.push(obv);
  }
  
  const priceUp = bars[bars.length - 1].close > bars[bars.length - 10].close;
  const obvUp = obvArray[obvArray.length - 1] > obvArray[obvArray.length - 10];
  const obvDiverging = priceUp !== obvUp;
  
  return { decliningOnCounter, elevatedOnCounter, obvDiverging };
}

/**
 * Calculate momentum score from multiple indicators
 */
export function assessMomentum(bars: OHLCV[]): MomentumAssessment {
  const closes = bars.map(b => b.close);
  
  // Calculate indicators
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const stoch = calculateStochastic(bars);
  const adx = calculateADX(bars);
  
  const currentRSI = rsi[rsi.length - 1] || 50;
  const currentMACD = macd.histogram[macd.histogram.length - 1] || 0;
  const prevMACD = macd.histogram[macd.histogram.length - 2] || 0;
  const currentStochK = stoch.k[stoch.k.length - 1] || 50;
  const currentADX = adx.adx[adx.adx.length - 1] || 0;
  const plusDI = adx.plusDI[adx.plusDI.length - 1] || 0;
  const minusDI = adx.minusDI[adx.minusDI.length - 1] || 0;
  
  // Calculate momentum score (-100 to +100)
  let score = 0;
  const keyFactors: string[] = [];
  const divergences: { indicator: string; type: 'bullish' | 'bearish' | 'none'; description: string }[] = [];
  
  // RSI contribution (-25 to +25)
  // FIXED: Oversold is NOT bullish - it indicates weakness. Don't conflate reversal potential with current state.
  if (currentRSI > 70) {
    score -= 10; // Overbought = potential weakness, but still in uptrend
    keyFactors.push(`RSI overbought (${currentRSI.toFixed(1)}) - caution`);
  } else if (currentRSI > 55) {
    score += 15;
    keyFactors.push(`RSI bullish (${currentRSI.toFixed(1)})`);
  } else if (currentRSI >= 45) {
    // Neutral zone - no contribution
    keyFactors.push(`RSI neutral (${currentRSI.toFixed(1)})`);
  } else if (currentRSI >= 30) {
    score -= 15;
    keyFactors.push(`RSI bearish (${currentRSI.toFixed(1)})`);
  } else {
    score -= 20; // Deeply oversold = extreme bearish, NOT bullish
    keyFactors.push(`RSI oversold (${currentRSI.toFixed(1)}) - extreme weakness`);
  }
  
  // MACD contribution (-30 to +30)
  if (currentMACD > 0 && currentMACD > prevMACD) {
    score += 25;
    keyFactors.push('MACD bullish and rising');
  } else if (currentMACD > 0) {
    score += 10;
    keyFactors.push('MACD positive');
  } else if (currentMACD < 0 && currentMACD < prevMACD) {
    score -= 25;
    keyFactors.push('MACD bearish and falling');
  } else if (currentMACD < 0) {
    score -= 10;
    keyFactors.push('MACD negative');
  }
  
  // Stochastic contribution (-20 to +20)
  // FIXED: Oversold is NOT bullish - it indicates current bearish momentum
  if (currentStochK > 80) {
    score -= 5; // Overbought - minor caution, still bullish
    keyFactors.push(`Stochastic overbought (${currentStochK.toFixed(1)})`);
  } else if (currentStochK > 50) {
    score += 15;
    keyFactors.push(`Stochastic bullish (${currentStochK.toFixed(1)})`);
  } else if (currentStochK >= 20) {
    score -= 15;
    keyFactors.push(`Stochastic bearish (${currentStochK.toFixed(1)})`);
  } else {
    score -= 20; // Deeply oversold = extreme bearish momentum, NOT bullish
    keyFactors.push(`Stochastic oversold (${currentStochK.toFixed(1)}) - extreme`);
  }
  
  // ADX/DMI contribution (-25 to +25)
  if (currentADX > 25) {
    if (plusDI > minusDI) {
      score += 20;
      keyFactors.push(`Strong uptrend (ADX: ${currentADX.toFixed(1)}, +DI > -DI)`);
    } else {
      score -= 20;
      keyFactors.push(`Strong downtrend (ADX: ${currentADX.toFixed(1)}, -DI > +DI)`);
    }
  } else {
    keyFactors.push(`Weak trend (ADX: ${currentADX.toFixed(1)})`);
  }
  
  // Check for divergences (simplified)
  const priceHigh = Math.max(...bars.slice(-10).map(b => b.high));
  const priceLow = Math.min(...bars.slice(-10).map(b => b.low));
  const rsiRecent = rsi.slice(-10).filter(v => v !== undefined);
  const rsiHigh = Math.max(...rsiRecent);
  const rsiLow = Math.min(...rsiRecent);
  
  const currentPrice = closes[closes.length - 1];
  if (currentPrice >= priceHigh * 0.98 && currentRSI < rsiHigh * 0.95) {
    divergences.push({
      indicator: 'RSI',
      type: 'bearish',
      description: 'Price making new highs but RSI is not - potential bearish divergence'
    });
    score -= 10;
  }
  if (currentPrice <= priceLow * 1.02 && currentRSI > rsiLow * 1.05) {
    divergences.push({
      indicator: 'RSI',
      type: 'bullish',
      description: 'Price making new lows but RSI is not - potential bullish divergence'
    });
    score += 10;
  }
  
  // Clamp score
  score = Math.max(-100, Math.min(100, score));
  
  // Determine strength and direction
  let strength: 'strong' | 'moderate' | 'weak' | 'none';
  let direction: 'bullish' | 'bearish' | 'neutral';
  
  if (Math.abs(score) >= 50) strength = 'strong';
  else if (Math.abs(score) >= 30) strength = 'moderate';
  else if (Math.abs(score) >= 15) strength = 'weak';
  else strength = 'none';
  
  if (score >= 15) direction = 'bullish';
  else if (score <= -15) direction = 'bearish';
  else direction = 'neutral';
  
  return { score, strength, direction, divergences, keyFactors };
}

/**
 * Assess trend on multiple timeframes
 */
export function assessTrend(bars: OHLCV[]): TrendAssessment {
  const closes = bars.map(b => b.close);
  const currentPrice = closes[closes.length - 1];
  
  // Calculate EMAs
  const ema9 = closes.slice(-9).reduce((a, b) => a + b, 0) / 9;
  const ema20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
  const ema50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);
  const ema200 = closes.slice(-200).reduce((a, b) => a + b, 0) / Math.min(200, closes.length);
  
  // EMA alignment
  const bullishAlignment = ema9 > ema20 && ema20 > ema50 && ema50 > ema200;
  const bearishAlignment = ema9 < ema20 && ema20 < ema50 && ema50 < ema200;
  const emaAlignment: 'bullish' | 'bearish' | 'mixed' = 
    bullishAlignment ? 'bullish' : bearishAlignment ? 'bearish' : 'mixed';
  
  // Price location
  const aboveAll = currentPrice > ema9 && currentPrice > ema20 && currentPrice > ema50 && currentPrice > ema200;
  const belowAll = currentPrice < ema9 && currentPrice < ema20 && currentPrice < ema50 && currentPrice < ema200;
  const priceLocation: 'above-all-emas' | 'below-all-emas' | 'mixed' = 
    aboveAll ? 'above-all-emas' : belowAll ? 'below-all-emas' : 'mixed';
  
  // Primary trend (long-term: 200 bars)
  const primarySlice = bars.slice(-Math.min(200, bars.length));
  const primaryFirst = primarySlice[0].close;
  const primaryLast = primarySlice[primarySlice.length - 1].close;
  const primaryChange = ((primaryLast - primaryFirst) / primaryFirst) * 100;
  
  const primaryDirection: 'uptrend' | 'downtrend' | 'sideways' = 
    primaryChange > 5 ? 'uptrend' : primaryChange < -5 ? 'downtrend' : 'sideways';
  const primaryStrength = Math.min(100, Math.abs(primaryChange) * 2);
  
  // Intermediate trend (50 bars)
  const intSlice = bars.slice(-Math.min(50, bars.length));
  const intFirst = intSlice[0].close;
  const intLast = intSlice[intSlice.length - 1].close;
  const intChange = ((intLast - intFirst) / intFirst) * 100;
  
  const intDirection: 'uptrend' | 'downtrend' | 'sideways' = 
    intChange > 3 ? 'uptrend' : intChange < -3 ? 'downtrend' : 'sideways';
  const intStrength = Math.min(100, Math.abs(intChange) * 5);
  
  // Short-term trend (20 bars)
  const shortSlice = bars.slice(-Math.min(20, bars.length));
  const shortFirst = shortSlice[0].close;
  const shortLast = shortSlice[shortSlice.length - 1].close;
  const shortChange = ((shortLast - shortFirst) / shortFirst) * 100;
  
  const shortDirection: 'uptrend' | 'downtrend' | 'sideways' = 
    shortChange > 2 ? 'uptrend' : shortChange < -2 ? 'downtrend' : 'sideways';
  const shortStrength = Math.min(100, Math.abs(shortChange) * 10);
  
  // Count trend duration
  let duration = 0;
  for (let i = bars.length - 2; i >= 0; i--) {
    if (primaryDirection === 'uptrend' && bars[i].close < bars[i + 1].close) {
      duration++;
    } else if (primaryDirection === 'downtrend' && bars[i].close > bars[i + 1].close) {
      duration++;
    } else if (primaryDirection === 'sideways') {
      duration++;
    } else {
      break;
    }
  }
  
  return {
    primary: { direction: primaryDirection, strength: primaryStrength, duration },
    intermediate: { direction: intDirection, strength: intStrength },
    shortTerm: { direction: shortDirection, strength: shortStrength },
    emaAlignment,
    priceLocation
  };
}

/**
 * Assess volatility regime
 */
export function assessVolatility(bars: OHLCV[]): VolatilityAssessment {
  const atrArray = calculateATR(bars, 14);
  const currentATR = atrArray[atrArray.length - 1] || 0;
  const currentPrice = bars[bars.length - 1].close;
  
  // Calculate average ATR over longer period
  const validATR = atrArray.filter(v => v !== undefined);
  const avgATR = validATR.reduce((a, b) => a + b, 0) / validATR.length;
  
  // Calculate ATR percentile
  const sortedATR = [...validATR].sort((a, b) => a - b);
  const percentile = (sortedATR.findIndex(v => v >= currentATR) / sortedATR.length) * 100;
  
  // Recent ATR trend
  const recentATR = validATR.slice(-5);
  const atrChanging = recentATR.length >= 2 
    ? ((recentATR[recentATR.length - 1] - recentATR[0]) / recentATR[0]) * 100
    : 0;
  
  // Determine regime
  let regime: 'high' | 'normal' | 'low' | 'expanding' | 'contracting';
  if (atrChanging > 15) {
    regime = 'expanding';
  } else if (atrChanging < -15) {
    regime = 'contracting';
  } else if (currentATR > avgATR * 1.3) {
    regime = 'high';
  } else if (currentATR < avgATR * 0.7) {
    regime = 'low';
  } else {
    regime = 'normal';
  }
  
  // Expected daily range
  const expectedDailyRange = {
    low: currentPrice - currentATR,
    high: currentPrice + currentATR
  };
  
  // Suggestion based on regime
  let suggestion: string;
  switch (regime) {
    case 'high':
      suggestion = 'Wide stops recommended. Consider reduced position size.';
      break;
    case 'low':
      suggestion = 'Low volatility - potential breakout setup. Watch for squeeze.';
      break;
    case 'expanding':
      suggestion = 'Volatility increasing - momentum trade opportunity.';
      break;
    case 'contracting':
      suggestion = 'Volatility decreasing - consolidation phase. Wait for breakout.';
      break;
    default:
      suggestion = 'Normal volatility conditions.';
  }
  
  return {
    current: currentATR,
    average: avgATR,
    percentile,
    regime,
    expectedDailyRange,
    suggestion
  };
}

/**
 * Calculate price projections based on technical analysis
 * 
 * FIXED: 
 * - Probabilities rounded to 5s (no false precision)
 * - Time horizons shortened for weak trends
 * - Aggressive targets suppressed when momentum is weak
 */
export function calculatePriceProjections(
  bars: OHLCV[],
  momentum: MomentumAssessment,
  trend: TrendAssessment,
  volatility: VolatilityAssessment
): PriceProjection {
  const currentPrice = bars[bars.length - 1].close;
  const atr = volatility.current;
  const adxData = calculateADX(bars);
  const adx = adxData.adx[adxData.adx.length - 1] || 0;
  
  // Check if we have a weak trend (reduce confidence and shorten horizons)
  const isWeakTrend = trend.primary.strength < 40 || trend.emaAlignment === 'mixed';
  const isNeutralMomentum = momentum.strength === 'weak' || momentum.strength === 'none';
  
  // Base probability adjustments based on momentum and trend
  let bullishBias = 50;
  bullishBias += momentum.score * 0.3; // ±30 from momentum
  
  if (trend.emaAlignment === 'bullish') bullishBias += 10;
  else if (trend.emaAlignment === 'bearish') bullishBias -= 10;
  
  if (trend.primary.direction === 'uptrend') bullishBias += 5;
  else if (trend.primary.direction === 'downtrend') bullishBias -= 5;
  
  bullishBias = Math.max(10, Math.min(90, bullishBias));
  const bearishBias = 100 - bullishBias;
  
  // FIXED: Round probabilities to 5s - no false precision
  const roundTo5 = (n: number) => Math.round(n / 5) * 5;
  
  // ═══════════════════════════════════════════════════════════════
  // RULE 4️⃣: PROJECTION DISCIPLINE
  // High-vol / weak-trend regimes → constrained probabilities & horizons
  // ═══════════════════════════════════════════════════════════════
  
  // Check if momentum is bearish/bullish and if volatility is high
  const isBearishMomentum = momentum.score < -10;
  const isBullishMomentum = momentum.score > 10;
  const isHighVol = volatility.regime === 'high' || volatility.regime === 'expanding';
  
  // Shorten time horizons for weak trends
  // ADX/structure handled upstream via trendAssessment; here we just compress timing
  const conservativeDays = isWeakTrend ? 3 : 4;
  const moderateDays = isWeakTrend ? 5 : 8;
  // Aggressive days shortened further for weak trends - these are speculative extensions
  const aggressiveDays = isWeakTrend ? 6 : 15;
  
  // Base probability caps
  let upsideProbCap = isWeakTrend ? 65 : 85;
  let downsideProbCap = isWeakTrend ? 65 : 85;
  
  // Weak trend + bearish momentum = very constrained upside
  if (isWeakTrend && isBearishMomentum) {
    upsideProbCap = 55;
  }
  // Weak trend + bullish momentum = very constrained downside
  if (isWeakTrend && isBullishMomentum) {
    downsideProbCap = 55;
  }
  
  // High volatility or weak trend → overall tighter caps
  if (isHighVol || isWeakTrend) {
    upsideProbCap = Math.min(upsideProbCap, 70);   // Never > 70% in these regimes
    downsideProbCap = Math.min(downsideProbCap, 80);
  }
  
  // ADX < 35 = mixed/moderate trend → never allow 80–85% style scenarios
  if (adx < 35) {
    upsideProbCap = Math.min(upsideProbCap, 70);
    downsideProbCap = Math.min(downsideProbCap, 80);
  }
  
  // Floor for probabilities - never show < 35% for downside in mixed/weak regimes
  const probFloor = (isWeakTrend || isHighVol || adx < 35) ? 35 : 25;
  
  // Calculate targets based on ATR multiples with regime-aware probability caps
  const upside = {
    conservative: {
      price: Number((currentPrice + atr * 1).toFixed(2)),
      percent: Number(((atr * 1) / currentPrice * 100).toFixed(2)),
      probability: roundTo5(Math.min(upsideProbCap, bullishBias + 5)),
      days: conservativeDays
    },
    moderate: {
      price: Number((currentPrice + atr * 1.5).toFixed(2)),
      percent: Number(((atr * 1.5) / currentPrice * 100).toFixed(2)),
      probability: roundTo5(Math.min(upsideProbCap - 10, bullishBias)),
      days: moderateDays
    },
    aggressive: {
      price: Number((currentPrice + atr * 2.5).toFixed(2)),
      percent: Number(((atr * 2.5) / currentPrice * 100).toFixed(2)),
      // Aggressive = heavily suppressed in weak regimes
      probability: roundTo5(Math.max(probFloor, Math.min(upsideProbCap - 30, bullishBias - 20))),
      days: aggressiveDays
    }
  };
  
  const downside = {
    conservative: {
      price: Number((currentPrice - atr * 1).toFixed(2)),
      percent: Number(((atr * 1) / currentPrice * 100).toFixed(2)),
      probability: roundTo5(Math.min(downsideProbCap, bearishBias + 5)),
      days: conservativeDays
    },
    moderate: {
      price: Number((currentPrice - atr * 1.5).toFixed(2)),
      percent: Number(((atr * 1.5) / currentPrice * 100).toFixed(2)),
      probability: roundTo5(Math.min(downsideProbCap - 10, bearishBias)),
      days: moderateDays
    },
    aggressive: {
      price: Number((currentPrice - atr * 2.5).toFixed(2)),
      percent: Number(((atr * 2.5) / currentPrice * 100).toFixed(2)),
      probability: roundTo5(Math.max(probFloor, Math.min(downsideProbCap - 30, bearishBias - 20))),
      days: aggressiveDays
    }
  };
  
  // Most probable scenario
  let mostProbable: PriceProjection['mostProbable'];
  
  // FIXED: For weak trends or neutral momentum, default to sideways
  if (isWeakTrend || isNeutralMomentum) {
    mostProbable = {
      direction: 'sideways',
      priceRange: { 
        low: currentPrice - atr * 0.75, 
        high: currentPrice + atr * 0.75 
      },
      probability: roundTo5(Math.min(65, 55)), // Lower confidence, capped
      timeframe: '3-5 days' // Shorter horizon
    };
  } else if (bullishBias >= 60) {
    mostProbable = {
      direction: 'up',
      priceRange: { low: currentPrice, high: upside.moderate.price },
      probability: roundTo5(Math.min(upsideProbCap, bullishBias)),
      timeframe: `${moderateDays}-${moderateDays + 3} days`
    };
  } else if (bearishBias >= 60) {
    mostProbable = {
      direction: 'down',
      priceRange: { low: downside.moderate.price, high: currentPrice },
      probability: roundTo5(Math.min(downsideProbCap, bearishBias)),
      timeframe: `${moderateDays}-${moderateDays + 3} days`
    };
  } else {
    mostProbable = {
      direction: 'sideways',
      priceRange: { 
        low: currentPrice - atr * 0.75, 
        high: currentPrice + atr * 0.75 
      },
      probability: roundTo5(55),
      timeframe: '5-8 days'
    };
  }
  
  return {
    currentPrice,
    upside,
    downside,
    mostProbable
  };
}

/**
 * Calculate overall signal strength
 * 
 * FIXED: Now accepts ADX and volume flow data to properly weight signals
 * - Trend score scales with ADX (not just EMA alignment)
 * - Volume score incorporates OBV trend and CMF
 */
export function calculateSignalStrength(
  bars: OHLCV[],
  momentum: MomentumAssessment,
  trend: TrendAssessment,
  volatility: VolatilityAssessment,
  adxData?: { adx: number; plusDI: number; minusDI: number },
  volumeFlow?: { obvTrend: 'rising' | 'falling' | 'flat'; cmf: number }
): SignalStrength {
  // Calculate ADX if not provided
  let adx = 20, plusDI = 20, minusDI = 20;
  if (adxData) {
    adx = adxData.adx;
    plusDI = adxData.plusDI;
    minusDI = adxData.minusDI;
  } else {
    const adxResult = calculateADX(bars);
    adx = adxResult.adx[adxResult.adx.length - 1] || 20;
    plusDI = adxResult.plusDI[adxResult.plusDI.length - 1] || 20;
    minusDI = adxResult.minusDI[adxResult.minusDI.length - 1] || 20;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // RULE 2️⃣: MOMENTUM SCORE = FINAL AUTHORITY (calculate FIRST)
  // This is the single source of truth for momentum
  // ═══════════════════════════════════════════════════════════════
  
  let momentumScore = 50 + momentum.score * 0.5;
  momentumScore = Math.min(100, Math.max(0, momentumScore));
  
  // Momentum signal must match score, not individual oscillators
  let momentumSignal: string;
  if (momentumScore >= 60) {
    momentumSignal = `Bullish (${momentum.strength})`;
  } else if (momentumScore <= 40) {
    momentumSignal = `Bearish (${momentum.strength})`;
  } else {
    momentumSignal = momentum.strength === 'none' ? 'Neutral' : `Neutral (${momentum.strength})`;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // RULE 1️⃣: TREND SCORE (capped by ADX + momentum)
  // Trend is driven by EMA alignment but CAPPED by ADX + momentum
  // ═══════════════════════════════════════════════════════════════
  
  let trendScore = 50;
  
  // EMA alignment bonus (capped contribution)
  if (trend.emaAlignment === 'bullish') trendScore += 15;
  else if (trend.emaAlignment === 'bearish') trendScore += 15;
  else trendScore -= 10;
  
  // Direction bonus
  if (trend.primary.direction !== 'sideways') trendScore += 10;
  if (trend.shortTerm.direction === trend.intermediate.direction) trendScore += 5;
  
  // ADX CAPS TREND SCORE
  // ADX < 20 → max 55–60 (range/weak, further capped by momentum below)
  // ADX 20-30 → max ~70–72 (developing trend, never "80+")
  // ADX > 30 → max 85 (confirmed/strong)
  let trendCap = 85;
  if (adx < 20) {
    trendCap = 60;
    trendScore -= 10; // Additional penalty for no trend
    
    // STRICTER RULE: ADX < 20 + bearish momentum = max 55
    // This ensures AMAT (ADX 18, momentum 27) aligns with APLD (ADX 17, momentum 30)
    if (momentumScore < 35) {
      trendCap = 55;
    }
  } else if (adx < 30) {
    trendCap = 72;
  }
  
  // Momentum < 40 penalizes trend (uses pre-calculated momentumScore)
  if (momentumScore < 40) {
    trendScore -= 7;
  }
  
  // Distribution pressure penalizes trend
  const hasDistributionPressure = volumeFlow && 
    (volumeFlow.obvTrend === 'falling' && volumeFlow.cmf < 0);
  if (hasDistributionPressure) {
    trendScore -= 5;
  }
  
  trendScore = Math.min(trendCap, Math.max(0, trendScore));
  
  // LANGUAGE RULE: Trend signal must match ADX context
  let trendSignal: string;
  if (adx < 20) {
    trendSignal = 'Mixed signals'; // Never call it bullish/bearish with weak ADX
  } else if (adx < 25) {
    // "developing", "under pressure", "range-bound" only
    trendSignal = trend.emaAlignment === 'bullish' ? 'Bullish (developing)' :
                  trend.emaAlignment === 'bearish' ? 'Bearish (developing)' : 'Range-bound';
  } else {
    // ADX >= 25: Can use "alignment" language
    trendSignal = trend.emaAlignment === 'bullish' ? 'Bullish alignment' :
                  trend.emaAlignment === 'bearish' ? 'Bearish alignment' : 'Mixed signals';
  }

  // ═══════════════════════════════════════════════════════════════
  // RULE 2️⃣ (continued): Momentum MUST NOT dominate trend
  // Momentum score is not allowed to exceed trendScore - keeps structure/regime primary
  // ═══════════════════════════════════════════════════════════════
  if (momentumScore > trendScore) {
    momentumScore = trendScore;
  }

  // Recompute momentumSignal after clamping
  if (momentumScore >= 60) {
    momentumSignal = `Bullish (${momentum.strength})`;
  } else if (momentumScore <= 40) {
    momentumSignal = `Bearish (${momentum.strength})`;
  } else {
    momentumSignal = momentum.strength === 'none' ? 'Neutral' : `Neutral (${momentum.strength})`;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // RULE 3️⃣: VOLUME AS CONVICTION MULTIPLIER
  // Volume never flips bias — it modifies confidence
  // "Accumulation" REQUIRES rising OBV + positive CMF (strict rule)
  // ═══════════════════════════════════════════════════════════════
  
  // Volume score - INCORPORATES OBV AND CMF
  const volumes = bars.slice(-20).map(b => b.volume);
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const volRatio = recentVol / avgVol;
  
  // Base volume score from activity level
  let volumeScore = 50;
  if (volRatio > 1.5) volumeScore = 60; // High activity, but not "accumulation" yet
  else if (volRatio > 1.2) volumeScore = 55;
  else if (volRatio < 0.7) volumeScore = 40;
  
  // OBV and CMF determine conviction direction
  if (volumeFlow) {
    // TRUE ACCUMULATION: Rising OBV + Positive CMF (both required)
    const isAccumulation = volumeFlow.obvTrend === 'rising' && volumeFlow.cmf > 0.05;
    // TRUE DISTRIBUTION: Falling OBV + Negative CMF (both required)  
    const isDistribution = volumeFlow.obvTrend === 'falling' && volumeFlow.cmf < -0.05;
    // MIXED: High volume but conflicting OBV/CMF
    const isMixed = (volRatio > 1.2) && !isAccumulation && !isDistribution;
    
    if (isAccumulation) {
      volumeScore += 20; // Strong conviction boost
    } else if (isDistribution) {
      volumeScore -= 20; // Strong conviction penalty
    } else if (volumeFlow.obvTrend === 'falling') {
      volumeScore -= 10; // Falling OBV alone = caution
    } else if (volumeFlow.cmf < -0.05) {
      volumeScore -= 10; // Negative CMF alone = caution
    } else if (volumeFlow.cmf > 0.10) {
      // If we're here, OBV is not falling (rising or flat)
      volumeScore += 5; // Positive CMF without falling OBV = slight positive
    }
  }
  
  volumeScore = Math.min(100, Math.max(0, volumeScore));
  
  // Volume signal label - STRICT LANGUAGE RULES
  let volumeSignal: string;
  const isConfirmedAccum = volumeFlow && volumeFlow.obvTrend === 'rising' && volumeFlow.cmf > 0.05;
  const isConfirmedDist = volumeFlow && volumeFlow.obvTrend === 'falling' && volumeFlow.cmf < -0.05;
  
  if (isConfirmedDist) {
    volumeSignal = 'Distribution pressure';
  } else if (isConfirmedAccum) {
    volumeSignal = volRatio > 1.2 ? 'High volume + accumulation' : 'Accumulation';
  } else if (volumeFlow && volumeFlow.obvTrend === 'falling') {
    volumeSignal = 'OBV divergence (caution)';
  } else if (volRatio > 1.5) {
    // High volume but OBV flat/CMF modest = "elevated activity", NOT accumulation
    volumeSignal = 'Elevated activity';
  } else if (volRatio > 1.2) {
    volumeSignal = 'Above average volume';
  } else if (volRatio < 0.8) {
    volumeSignal = 'Below average volume';
  } else {
    volumeSignal = 'Normal volume';
  }
  
  // Volatility score
  let volatilityScore = 50;
  if (volatility.regime === 'expanding' || volatility.regime === 'low') volatilityScore = 70;
  else if (volatility.regime === 'contracting') volatilityScore = 60;
  else if (volatility.regime === 'high') volatilityScore = 40;
  const volatilitySignal = `${volatility.regime.charAt(0).toUpperCase() + volatility.regime.slice(1)} volatility`;
  
  // ═══════════════════════════════════════════════════════════════
  // PATTERN SCORE - Must respect momentum hierarchy AND price context
  // Bullish patterns can't override bearish momentum
  // Bullish signals below 200 EMA = "attempts", not "bullish price action"
  // ═══════════════════════════════════════════════════════════════
  
  const recentBars = bars.slice(-5);
  const bullishCandles = recentBars.filter(b => b.close > b.open).length;
  
  // CONTEXT RULE: Determine price location relative to 200 EMA
  const closes = bars.map(b => b.close);
  const ema200 = calculateEMAValue(closes, Math.min(200, closes.length));
  const currentPrice = bars[bars.length - 1].close;
  const priceVsEma200 = ((currentPrice - ema200) / ema200) * 100;
  const isBelow200EMA = priceVsEma200 < -2; // More than 2% below
  const isAbove200EMA = priceVsEma200 > 2;  // More than 2% above
  
  // Base pattern score from candle direction
  let patternScore = 50;
  if (bullishCandles >= 4) patternScore = 65; // Reduced from 75
  else if (bullishCandles >= 3) patternScore = 55; // Reduced from 60
  else if (bullishCandles <= 1) patternScore = 40;
  else if (bullishCandles === 0) patternScore = 30;
  
  // RULE: Pattern score CANNOT be bullish when momentum is bearish
  // This prevents "60 Bullish price action" when momentum = 30 bearish
  if (momentumScore < 40 && patternScore > 50) {
    patternScore = 50; // Cap at neutral when momentum is bearish
  }
  
  // RULE: Pattern score CANNOT be bearish when momentum is bullish
  if (momentumScore > 60 && patternScore < 50) {
    patternScore = 50; // Floor at neutral when momentum is bullish
  }
  
  // RULE: ADX < 20 = no strong pattern claims (range-bound)
  if (adx < 20 && Math.abs(patternScore - 50) > 10) {
    patternScore = patternScore > 50 ? 55 : 45; // Compress toward neutral
  }
  
  // CONTEXT RULE: Bullish patterns below 200 EMA are "attempts", not "price action"
  // Bearish patterns above 200 EMA are "reaction moves", not "price action"
  if (isBelow200EMA && patternScore > 55) {
    patternScore = 55; // Cap bullish patterns below 200 EMA
  }
  if (isAbove200EMA && patternScore < 45) {
    patternScore = 45; // Floor bearish patterns above 200 EMA
  }
  
  // Pattern signal label - CONTEXT-AWARE (Critical Rule)
  // Labels must reflect structural context, not just candle counts
  let patternSignal: string;
  if (patternScore >= 60) {
    // Only call it "bullish price action" if above 200 EMA and in trending regime
    if (isAbove200EMA && adx >= 20) {
      patternSignal = 'Bullish price action';
    } else if (isBelow200EMA) {
      patternSignal = 'Bullish attempts (below 200 EMA)';
    } else {
      patternSignal = 'Bullish attempts (range)';
    }
  } else if (patternScore <= 40) {
    // Only call it "bearish price action" if below 200 EMA and in trending regime
    if (isBelow200EMA && adx >= 20) {
      patternSignal = 'Bearish price action';
    } else if (isAbove200EMA) {
      patternSignal = 'Bearish reaction (above 200 EMA)';
    } else {
      patternSignal = 'Bearish reaction (range)';
    }
  } else {
    // 41-59 = mixed/neutral - context-dependent labels
    if (momentumScore < 40) {
      patternSignal = isAbove200EMA ? 'Counter-trend pressure' : 'Bearish pressure';
    } else if (momentumScore > 60) {
      patternSignal = isBelow200EMA ? 'Counter-trend rally' : 'Bullish attempts';
    } else {
      patternSignal = 'Mixed price action';
    }
  }
  
  // Weights
  const weights = {
    trend: 0.30,
    momentum: 0.25,
    volume: 0.15,
    volatility: 0.15,
    pattern: 0.15
  };
  
  // Calculate overall score
  const overall = Math.round(
    trendScore * weights.trend +
    momentumScore * weights.momentum +
    volumeScore * weights.volume +
    volatilityScore * weights.volatility +
    patternScore * weights.pattern
  );
  
  // Determine direction - REQUIRES STRONG ALIGNMENT
  // If momentum is weak or trend is mixed, default to neutral
  // This prevents "bullish" labels when signals are conflicting
  let direction: 'bullish' | 'bearish' | 'neutral';
  
  // Must have at least moderate momentum strength AND aligned trend to be directional
  const hasStrongMomentum = momentum.strength === 'strong' || momentum.strength === 'moderate';
  const hasTrendAlignment = trend.emaAlignment !== 'mixed';
  
  if (hasStrongMomentum && hasTrendAlignment) {
    if (momentum.direction === 'bullish' && trend.emaAlignment === 'bullish') {
      direction = 'bullish';
    } else if (momentum.direction === 'bearish' && trend.emaAlignment === 'bearish') {
      direction = 'bearish';
    } else {
      // Conflicting momentum and trend = neutral
      direction = 'neutral';
    }
  } else {
    // Weak momentum OR mixed trend = neutral (no clear edge)
    direction = 'neutral';
  }
  
  // Determine grade
  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  if (overall >= 85) grade = 'A+';
  else if (overall >= 75) grade = 'A';
  else if (overall >= 60) grade = 'B';
  else if (overall >= 45) grade = 'C';
  else if (overall >= 30) grade = 'D';
  else grade = 'F';
  
  return {
    overall,
    direction,
    grade,
    breakdown: {
      trend: { score: trendScore, weight: weights.trend, signal: trendSignal },
      momentum: { score: momentumScore, weight: weights.momentum, signal: momentumSignal },
      volume: { score: volumeScore, weight: weights.volume, signal: volumeSignal },
      volatility: { score: volatilityScore, weight: weights.volatility, signal: volatilitySignal },
      pattern: { score: patternScore, weight: weights.pattern, signal: patternSignal }
    }
  };
}

/**
 * Generate strategy recommendations based on technical analysis
 * REGIME-FIRST APPROACH: Volatility and structure classification happens
 * BEFORE any strategy, entry, stop, or target logic runs.
 */
export function generateStrategyRecommendation(
  bars: OHLCV[],
  momentum: MomentumAssessment,
  trend: TrendAssessment,
  volatility: VolatilityAssessment,
  signalStrength: SignalStrength,
  supportResistance: {
    support: { price: number; touches: number; strength: number }[];
    resistance: { price: number; touches: number; strength: number }[];
  },
  // Structure analysis context
  structureContext?: {
    classification: 'likely-pullback' | 'trend-reversal-risk' | 'mixed';
    priorTrendDirection: 'up' | 'down' | 'sideways';
    dominantBias: 'pullback' | 'reversal' | 'neutral';
  },
  // Additional indicators for overbought/oversold and squeeze detection
  oscillators?: {
    stochK?: number;
    mfi?: number;
    historicalVolatility?: number;
    bollingerBandwidth?: number;
    bollingerB?: number;
  },
  // ADX data for regime classification
  adxValue?: number,
  // TTM Squeeze data for compression regime detection
  squeezeData?: {
    isInSqueeze: boolean;
    squeezeDuration: number;
    momentum: number;
    momentumDirection: 'bullish' | 'bearish' | 'neutral';
  },
  // Volume flow data for confirmation
  volumeFlowData?: {
    obvTrend: 'rising' | 'falling' | 'flat';
    cmf: number;
    volumeZScore: number;
  }
): StrategyRecommendation {
  const currentPrice = bars[bars.length - 1].close;
  const atr = volatility.current;
  const atrPercent = (atr / currentPrice) * 100;
  
  // Find RELEVANT key levels (within 3x ATR of current price)
  const maxDistanceForRelevance = atr * 3;
  
  const relevantSupports = supportResistance.support.filter(
    s => currentPrice - s.price <= maxDistanceForRelevance && s.price < currentPrice
  );
  const relevantResistances = supportResistance.resistance.filter(
    r => r.price - currentPrice <= maxDistanceForRelevance && r.price > currentPrice
  );
  
  // Use relevant levels or ATR-based defaults
  const nearestRelevantSupport = relevantSupports[0]?.price || currentPrice - atr * 1.5;
  const nearestRelevantResistance = relevantResistances[0]?.price || currentPrice + atr * 1.5;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MARKET REGIME REASONING ENGINE
  // INFER regimes from raw indicators, then determine valid strategies
  // The flow: Regime → Valid Strategies → Trade Parameters (if any)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const adx = adxValue ?? 20;
  const stochK = oscillators?.stochK ?? 50;
  const mfi = oscillators?.mfi ?? 50;
  const bollingerBandwidth = oscillators?.bollingerBandwidth ?? 30;
  const historicalVol = oscillators?.historicalVolatility ?? 40;
  
  // Calculate additional required values for regime analysis
  const adxData = calculateADX(bars);
  const plusDI = adxData.plusDI[adxData.plusDI.length - 1] || 20;
  const minusDI = adxData.minusDI[adxData.minusDI.length - 1] || 20;
  
  // Calculate RSI for regime inference
  const closes = bars.map(b => b.close);
  const rsiArray = calculateRSI(closes, 14);
  const rsi = rsiArray[rsiArray.length - 1] || 50;
  
  // Calculate MACD histogram
  const macdData = calculateMACD(closes);
  const macdHistogram = macdData.histogram[macdData.histogram.length - 1] || 0;
  
  // Calculate 200 EMA for context
  const ema200 = calculateEMAValue(closes, Math.min(200, closes.length));
  const priceVs200EMA = ((currentPrice - ema200) / ema200) * 100;
  
  // Infer structure (higher highs/lows)
  const higherHighsLows = checkHigherLows(bars.slice(-20));
  const lowerHighsLows = checkLowerHighs(bars.slice(-20));
  
  // Extract volume flow data
  const patternSignalText = signalStrength.breakdown.pattern.signal.toLowerCase();
  const hasReversalPatterns =
    patternSignalText.includes('bearish') ||
    patternSignalText.includes('reversal') ||
    patternSignalText.includes('pressure');
  
  const volumeSignalText = signalStrength.breakdown.volume.signal.toLowerCase();
  const hasOBVDivergence =
    volumeSignalText.includes('divergence') ||
    volumeSignalText.includes('distribution');
  
  // Infer OBV trend and CMF from volume signal
  let obvTrend: 'rising' | 'falling' | 'flat' = 'flat';
  let cmf = 0;
  if (volumeSignalText.includes('accumulation')) {
    obvTrend = 'rising';
    cmf = 0.1;
  } else if (volumeSignalText.includes('distribution') || volumeSignalText.includes('divergence')) {
    obvTrend = 'falling';
    cmf = -0.1;
  }
  
  // Calculate volume Z-score
  const volumes = bars.slice(-20).map(b => b.volume);
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const volStdDev = Math.sqrt(volumes.reduce((sum, v) => sum + Math.pow(v - avgVol, 2), 0) / volumes.length);
  const volumeZScore = volStdDev > 0 ? (recentVol - avgVol) / volStdDev : 0;
  
  // Calculate Bollinger %B
  const bollingerData = calculateBollingerBands(closes, 20, 2);
  const bollingerB = bollingerData.percentB[bollingerData.percentB.length - 1] || 50;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RUN FULL REGIME ANALYSIS (Steps 1-4)
  // This determines what is TRADABLE, not what is theoretically bullish/bearish
  // ═══════════════════════════════════════════════════════════════════════════
  const regimeAnalysis = analyzeRegime(
    adx, plusDI, minusDI, trend.emaAlignment, priceVs200EMA,
    higherHighsLows, lowerHighsLows,
    atrPercent, historicalVol, bollingerBandwidth, bollingerB,
    rsi, stochK, mfi, macdHistogram,
    obvTrend, cmf, volumeZScore
  );
  
  // Legacy regime classification (for backwards compatibility and additional constraints)
  const regime = classifyTradeRegime(
    atrPercent,
    historicalVol,
    adx,
    trend.emaAlignment,
    structureContext?.classification || 'mixed',
    hasReversalPatterns,
    hasOBVDivergence
  );
  
  // Attach regime analysis to regime object
  regime.regimeAnalysis = regimeAnalysis;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FEASIBILITY CHECK - If no valid strategies, force WAIT
  // ═══════════════════════════════════════════════════════════════════════════
  const feasibility = regimeAnalysis.feasibility;
  const forceWaitFromRegime = feasibility.defaultAction === 'wait' && feasibility.valid.every(s => s === 'wait');
  
  // ═══════════════════════════════════════════════════════════════
  // SQUEEZE AND OVERBOUGHT/OVERSOLD DETECTION
  // ═══════════════════════════════════════════════════════════════
  const isInSqueeze = (oscillators?.historicalVolatility ?? 0) > 150 || 
                      (oscillators?.bollingerBandwidth ?? 0) > 150;
  
  // Overbought/oversold detection
  const isOverbought = stochK > 70 || mfi > 85;
  const isOversold = stochK < 20 || mfi < 15;
  
  // ═══════════════════════════════════════════════════════════════
  // STEP 3: STOP MULTIPLIER FROM REGIME (not ad-hoc)
  // ═══════════════════════════════════════════════════════════════
  let stopMultiplier = regime.stopMultiplier;
  let useStructureBasedStops = regime.isSpeculative || atrPercent > 15;
  
  // In squeeze conditions: tighter stops (1x ATR)
  if (isInSqueeze) {
    stopMultiplier = 1.0;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // STEP 4: STRATEGY CLASSIFICATION - GATED BY REGIME
  // With explicit CONFLICT DETECTION - WAIT is a valid output
  // ═══════════════════════════════════════════════════════════════
  let strategy: string;
  let direction: 'long' | 'short' | 'wait';
  let confidence: number;
  
  const structure = structureContext?.classification || 'mixed';
  const priorTrend = structureContext?.priorTrendDirection || 'sideways';
  const dominantBias = structureContext?.dominantBias || 'neutral';
  
  // ═══════════════════════════════════════════════════════════════
  // CONFLICT DETECTION (Critical)
  // If regime + structure + momentum don't align → WAIT
  // WAIT is optimal when constraints conflict
  // ═══════════════════════════════════════════════════════════════
  
  // Use pre-calculated 200 EMA context from regime analysis
  const isBelow200EMA = priceVs200EMA < -2;
  const isAbove200EMA = priceVs200EMA > 2;
  
  // Detect conflicts between layers
  const conflicts: string[] = [];
  
  // Conflict: Bullish momentum below 200 EMA
  if (momentum.direction === 'bullish' && isBelow200EMA) {
    conflicts.push('Bullish momentum below 200 EMA (counter-trend)');
  }
  
  // Conflict: Bearish momentum above 200 EMA
  if (momentum.direction === 'bearish' && isAbove200EMA) {
    conflicts.push('Bearish momentum above 200 EMA (counter-trend)');
  }
  
  // Conflict: Structure and regime disagree
  if (regime.structureClass === 'range-bound' && structure === 'likely-pullback') {
    conflicts.push('Pullback structure in range-bound regime');
  }
  
  // Conflict: Speculative regime with trend-following signals
  if (regime.isSpeculative && signalStrength.direction !== 'neutral') {
    conflicts.push('Directional signal in speculative regime');
  }
  
  // Conflict: Momentum and trend direction disagree
  if (momentum.direction === 'bullish' && trend.emaAlignment === 'bearish') {
    conflicts.push('Bullish momentum against bearish trend');
  }
  if (momentum.direction === 'bearish' && trend.emaAlignment === 'bullish') {
    conflicts.push('Bearish momentum against bullish trend');
  }
  
  // Conflict: Reversal patterns with strong trend signals
  if (hasReversalPatterns && signalStrength.overall > 60) {
    conflicts.push('Reversal patterns contradict trend strength');
  }
  
  // If 2+ conflicts exist → WAIT is the optimal output
  const hasSignificantConflicts = conflicts.length >= 2;
  
  // Base criteria (only valid if no significant conflicts)
  const strongBullish = !hasSignificantConflicts &&
                        signalStrength.direction === 'bullish' && 
                        signalStrength.overall >= 55 && 
                        (momentum.strength === 'strong' || momentum.strength === 'moderate');
  const strongBearish = !hasSignificantConflicts &&
                        signalStrength.direction === 'bearish' && 
                        signalStrength.overall >= 55 && 
                        (momentum.strength === 'strong' || momentum.strength === 'moderate');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DETECTED REGIME - HIGH-LEVEL CLASSIFICATION
  // Maps to one of: TRENDING, RANGE_BOUND, REVERSAL_ATTEMPT, VOLATILITY_EXPANSION, UNCERTAIN
  // This determines which gates and rules apply to recommendations
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Check for support/resistance proximity
  const nearestSupport = relevantSupports[0]?.price ?? (currentPrice - atr * 2);
  const nearestResistance = relevantResistances[0]?.price ?? (currentPrice + atr * 2);
  const nearResistance = (nearestResistance - currentPrice) / currentPrice < 0.02; // Within 2%
  const nearSupport = (currentPrice - nearestSupport) / currentPrice < 0.02; // Within 2%
  
  // Check for swing high/low breaks
  const swingPoints = findSwingPoints(bars.slice(-30));
  const recentSwingHigh = swingPoints.highs[0]?.price ?? currentPrice * 1.1;
  const recentSwingLow = swingPoints.lows[0]?.price ?? currentPrice * 0.9;
  const brokeSwingHigh = currentPrice > recentSwingHigh;
  const brokeSwingLow = currentPrice < recentSwingLow;
  
  // Get effective squeeze data (use different var names to avoid conflict with later declarations)
  const regimeSqueezeActive = squeezeData?.isInSqueeze ?? false;
  const regimeSqueezeMomentum = squeezeData?.momentumDirection ?? 'neutral';
  
  // Get effective CMF and OBV
  const effectiveCMF = volumeFlowData?.cmf ?? cmf;
  const effectiveOBV = volumeFlowData?.obvTrend ?? obvTrend;
  
  // Detect the high-level market regime
  const detectedRegime = detectMarketRegime(
    adx,
    trend.emaAlignment,
    priorTrend,
    structure,
    volatility.regime,
    bollingerBandwidth,
    atrPercent,
    regimeSqueezeActive,
    regimeSqueezeMomentum,
    stochK,
    rsi,
    effectiveCMF,
    effectiveOBV,
    volumeZScore,
    nearResistance,
    nearSupport,
    brokeSwingHigh,
    brokeSwingLow
  );
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CANDLESTICK SIGNAL CANCELLATION CHECK
  // ═══════════════════════════════════════════════════════════════════════════
  const candlestickCheck = checkCandlestickCancellation(
    [], // Would need to pass bullish patterns - simplified for now
    [], // Would need to pass bearish patterns - simplified for now
    5,
    detectedRegime.type
  );
  
  // ═══════════════════════════════════════════════════════════════════════════
  // REGIME EXECUTION VERIFICATION
  // Before recommending ANY strategy, explicitly verify regime permits execution
  // This is the PRIMARY GATE - all trade recommendations are blocked if failed
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Add feasibility reasoning to conflicts
  if (feasibility.invalid.length > 0) {
    conflicts.push(...feasibility.reasoning.slice(0, 2));
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // HARD OUTPUT GATE - REGIME-AWARE STRATEGY GATING
  // ═══════════════════════════════════════════════════════════════════════════
  // Gates are now CONDITIONAL on detected regime type.
  // Different regimes use different gates and unlock conditions.
  // ═══════════════════════════════════════════════════════════════════════════
  
  const executionBlocks: string[] = [];
  const unlockConditions: string[] = [];
  
  // Get regime-specific rules
  const regimeRules = detectedRegime.rules;
  
  // ─────────────────────────────────────────────────────────────────
  // REGIME-AWARE HARD BLOCKS
  // Only apply gates that the detected regime allows
  // ─────────────────────────────────────────────────────────────────
  
  // HARD BLOCK 1: ADX Gate - ONLY applies if regime uses ADX gate
  // In RANGE_BOUND regime, ADX gate is NOT used
  if (regimeRules.useADXGate && adx < 25) {
    executionBlocks.push(`ADX ${adx.toFixed(0)} < 25: No confirmed trend`);
    unlockConditions.push(`ADX must rise above 25 for trend/breakout trades (currently ${adx.toFixed(0)})`);
  }
  
  // HARD BLOCK 2: Regime-specific execution blocks
  if (detectedRegime.type === 'RANGE_BOUND') {
    // RANGE_BOUND: Don't block based on ADX - use range-specific unlocks instead
    // Block directional trades until breakout confirmation
    if (!brokeSwingHigh && !brokeSwingLow) {
      executionBlocks.push('Range-bound: No breakout confirmation');
      // Use regime-specific unlock conditions
      unlockConditions.push(...detectedRegime.unlockConditions.slice(0, 2));
    }
    // Allow mean reversion only at extremes
    if (regimeRules.allowMeanReversion) {
      if (nearResistance && stochK > 85) {
        // Mean reversion short may be allowed - don't block
      } else if (nearSupport && stochK < 15) {
        // Mean reversion long may be allowed - don't block
      } else if (!nearResistance && !nearSupport) {
        // Not at extremes - can't mean revert
        executionBlocks.push('Range-bound: Not at range extremes for mean reversion');
      }
    }
  } else if (detectedRegime.type === 'REVERSAL_ATTEMPT') {
    // REVERSAL_ATTEMPT: Require structure break AND volume confirmation
    const hasStructureBreak = (detectedRegime.direction === 'bullish' && brokeSwingHigh) ||
                               (detectedRegime.direction === 'bearish' && brokeSwingLow);
    const hasVolumeConfirm = (detectedRegime.direction === 'bullish' && effectiveOBV === 'rising' && effectiveCMF > 0) ||
                              (detectedRegime.direction === 'bearish' && effectiveOBV === 'falling' && effectiveCMF < 0);
    
    if (!hasStructureBreak) {
      executionBlocks.push('Reversal attempt: No structure break confirmation');
      unlockConditions.push('Require break of prior swing high/low');
    }
    if (!hasVolumeConfirm) {
      executionBlocks.push('Reversal attempt: Volume not confirming');
      unlockConditions.push(`Volume confirmation: OBV ${effectiveOBV}, CMF ${effectiveCMF.toFixed(3)}`);
    }
  } else if (detectedRegime.type === 'VOLATILITY_EXPANSION') {
    // VOLATILITY_EXPANSION: Require stronger confirmation
    const hasStrongConfirmation = volumeZScore > 1.5 || 
                                   (signalStrength.overall > 65 && momentum.strength === 'strong');
    if (!hasStrongConfirmation) {
      executionBlocks.push('Volatility expansion: Insufficient confirmation');
      unlockConditions.push('Require volume z-score > 1.5 OR multi-indicator alignment');
    }
  } else if (detectedRegime.type === 'UNCERTAIN') {
    // UNCERTAIN: Always wait
    executionBlocks.push('Regime uncertain: No clear market structure');
    unlockConditions.push(...detectedRegime.unlockConditions);
  }
  
  // HARD BLOCK 3: Overbought/Oversold - ONLY applies if regime uses Stoch suppression
  // In TRENDING regime with strong ADX, overbought doesn't suppress longs
  if (regimeRules.useStochSupression) {
    if (stochK > 80 && signalStrength.direction === 'bullish') {
      executionBlocks.push(`Overbought (Stoch ${stochK.toFixed(0)}) - long entry suppressed`);
      unlockConditions.push('Wait for Stochastic to drop below 70');
    }
    if (stochK < 20 && signalStrength.direction === 'bearish') {
      executionBlocks.push(`Oversold (Stoch ${stochK.toFixed(0)}) - short entry suppressed`);
      unlockConditions.push('Wait for Stochastic to rise above 30');
    }
  }
  
  // HARD BLOCK 4: Volume not confirming (applies to all regimes)
  const effectiveVolumeZScore = volumeFlowData?.volumeZScore ?? volumeZScore;
  if (effectiveVolumeZScore < -1.0 || regimeAnalysis.behavioral.context === 'distribution') {
    executionBlocks.push(`Volume not confirming (Z: ${effectiveVolumeZScore.toFixed(2)})`);
    unlockConditions.push('Wait for volume confirmation (Z-score > 0)');
  }
  
  // HARD BLOCK 5: Chasing context = Always WAIT
  if (regimeAnalysis.behavioral.context === 'chasing') {
    executionBlocks.push('Chasing context - extended move');
    unlockConditions.push('Wait for meaningful pullback to support');
  }
  
  // HARD BLOCK 6: Mean reversion risk (unless in RANGE_BOUND with mean reversion allowed)
  if (regimeAnalysis.behavioral.context === 'mean-reversion-risk' && 
      !(detectedRegime.type === 'RANGE_BOUND' && regimeRules.allowMeanReversion)) {
    executionBlocks.push('Mean reversion risk elevated');
    unlockConditions.push('Wait for pullback or consolidation');
  }
  
  // ─────────────────────────────────────────────────────────────────
  // HARD BLOCK 8: TTM SQUEEZE ON + MOMENTUM ≠ BULLISH → BLOCK ALL TREND-FOLLOWING
  // This is CRITICAL: Compression regimes with bearish/neutral momentum must WAIT
  // No discretionary trader enters a pullback long inside a bearish squeeze
  // ─────────────────────────────────────────────────────────────────
  const squeezeIsActive = squeezeData?.isInSqueeze ?? false;
  const squeezeDuration = squeezeData?.squeezeDuration ?? 0;
  const squeezeMomentumDir = squeezeData?.momentumDirection ?? 'neutral';
  
  if (squeezeIsActive && squeezeMomentumDir !== 'bullish' && signalStrength.direction === 'bullish') {
    // Squeeze ON + bearish/neutral momentum → block longs
    executionBlocks.push(`TTM Squeeze ON (${squeezeDuration} bars) + ${squeezeMomentumDir} momentum`);
    unlockConditions.push('Wait for squeeze release with bullish momentum expansion');
    unlockConditions.push('Expansion direction must confirm before entry');
  } else if (squeezeIsActive && squeezeMomentumDir !== 'bearish' && signalStrength.direction === 'bearish') {
    // Squeeze ON + bullish/neutral momentum → block shorts
    executionBlocks.push(`TTM Squeeze ON (${squeezeDuration} bars) + ${squeezeMomentumDir} momentum`);
    unlockConditions.push('Wait for squeeze release with bearish momentum expansion');
    unlockConditions.push('Expansion direction must confirm before entry');
  } else if (squeezeIsActive && squeezeMomentumDir === 'neutral') {
    // Squeeze ON with neutral momentum → block all directional trades
    executionBlocks.push(`TTM Squeeze ON - Compression regime (direction unknown)`);
    unlockConditions.push('Wait for squeeze release and momentum direction confirmation');
  }
  
  // ─────────────────────────────────────────────────────────────────
  // HARD BLOCK 9: DISTRIBUTION DETECTED (CMF < -0.1) → BLOCK LONGS
  // Negative money flow indicates institutional selling - don't buy into distribution
  // ─────────────────────────────────────────────────────────────────
  const cmfValue = volumeFlowData?.cmf ?? 0;
  const volumeZScoreValue = volumeFlowData?.volumeZScore ?? 0;
  const obvTrendValue = volumeFlowData?.obvTrend ?? 'flat';
  
  if (cmfValue < -0.1 && signalStrength.direction === 'bullish') {
    executionBlocks.push(`Distribution detected (CMF: ${cmfValue.toFixed(3)})`);
    unlockConditions.push('Wait for CMF to turn positive (accumulation)');
  }
  
  // ─────────────────────────────────────────────────────────────────
  // HARD BLOCK 10: MULTIPLE FLOW INDICATORS NEGATIVE → BLOCK EXECUTION
  // When MACD histogram, CMF, and Volume Z all disagree with direction → no trade
  // This is a "3-strike" rule for flow confirmation
  // ─────────────────────────────────────────────────────────────────
  const macdHistogramValue = macdHistogram ?? 0;
  const flowStrikesAgainstLong = [
    macdHistogramValue < 0,           // MACD weakening
    cmfValue < 0,                     // Distribution
    volumeZScoreValue < -0.5          // Below average volume
  ].filter(Boolean).length;
  
  const flowStrikesAgainstShort = [
    macdHistogramValue > 0,           // MACD strengthening
    cmfValue > 0,                     // Accumulation
    volumeZScoreValue < -0.5          // Below average volume (no participation)
  ].filter(Boolean).length;
  
  if (flowStrikesAgainstLong >= 2 && signalStrength.direction === 'bullish') {
    executionBlocks.push(`Flow disagreement: ${flowStrikesAgainstLong}/3 indicators against long`);
    unlockConditions.push('Wait for MACD histogram positive AND CMF positive');
  }
  if (flowStrikesAgainstShort >= 2 && signalStrength.direction === 'bearish') {
    executionBlocks.push(`Flow disagreement: ${flowStrikesAgainstShort}/3 indicators against short`);
    unlockConditions.push('Wait for MACD histogram negative AND CMF negative');
  }
  
  // ─────────────────────────────────────────────────────────────────
  // DETERMINE IF STRATEGY GENERATION IS PERMITTED
  // If ANY hard block exists, strategy generation is PROHIBITED
  // ─────────────────────────────────────────────────────────────────
  const strategyGenerationBlocked = executionBlocks.length >= 1 ||
                                     forceWaitFromRegime ||
                                     hasSignificantConflicts;
  
  // Directional bias (can be stated for informational purposes only)
  const directionalBias = signalStrength.direction !== 'neutral' 
    ? signalStrength.direction 
    : (regimeAnalysis.market.direction !== 'neutral' ? regimeAnalysis.market.direction : 'neutral');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // HARD OUTPUT GATE - STRATEGY DECISION
  // ═══════════════════════════════════════════════════════════════════════════
  // CRITICAL: Strategy generation is CONDITIONAL on regime validation.
  // If strategyGenerationBlocked is true, we MUST output WAIT.
  // We do NOT generate a strategy and then block it.
  // The strategy generation code below ONLY runs if regime permits.
  // ═══════════════════════════════════════════════════════════════════════════
  
  // ─────────────────────────────────────────────────────────────────
  // HARD GATE: If strategy generation is blocked, output WAIT IMMEDIATELY
  // Do not proceed to any strategy generation logic
  // ─────────────────────────────────────────────────────────────────
  if (strategyGenerationBlocked) {
    // Determine the most appropriate WAIT reason from execution blocks
    const primaryBlock = executionBlocks[0] || 'Regime constraints not satisfied';
    
    if (executionBlocks.some(b => b.includes('ADX'))) {
      strategy = 'WAIT - No Confirmed Trend';
    } else if (executionBlocks.some(b => b.includes('Overbought'))) {
      strategy = 'WAIT - Overbought Conditions';
    } else if (executionBlocks.some(b => b.includes('regime'))) {
      strategy = 'WAIT - Regime Prohibits Execution';
    } else if (executionBlocks.some(b => b.includes('Volume'))) {
      strategy = 'WAIT - Volume Not Confirming';
    } else if (executionBlocks.some(b => b.includes('Chasing'))) {
      strategy = 'WAIT - Chasing Risk';
    } else if (hasSignificantConflicts) {
      strategy = 'WAIT - Conflicting Signals';
    } else {
      strategy = 'WAIT - Monitoring Conditions';
    }
    
    direction = 'wait';
    // HARD CAP: Confidence ≤40% for ALL blocked scenarios
    confidence = Math.min(40, signalStrength.overall - 10);
    
    // Strategy generation is SKIPPED entirely - we go directly to entry/target suppression
  }
  // ─────────────────────────────────────────────────────────────────
  // ONLY IF REGIME PERMITS: Generate strategy
  // This code only runs when strategyGenerationBlocked === false
  // ─────────────────────────────────────────────────────────────────
  else if (signalStrength.grade === 'F' || signalStrength.grade === 'D' || signalStrength.overall < 40) {
    // Weak setup - always wait
    strategy = 'WAIT - Weak Setup';
    direction = 'wait';
    confidence = Math.min(40, signalStrength.overall);
  }
  // ===== TREND REVERSAL RISK STRUCTURE =====
  // ONLY valid if ADX > 25 (already checked by hard gate)
  else if (structure === 'trend-reversal-risk') {
    if (priorTrend === 'down' && (strongBullish || dominantBias === 'reversal')) {
      strategy = 'Breakout Long';
      direction = 'long';
      confidence = signalStrength.overall;
    } else if (priorTrend === 'up' && (strongBearish || dominantBias === 'reversal')) {
      strategy = 'Breakdown Short';
      direction = 'short';
      confidence = signalStrength.overall;
    } else if (strongBullish) {
      strategy = 'Breakout Long';
      direction = 'long';
      confidence = Math.max(40, signalStrength.overall - 10);
    } else if (strongBearish) {
      strategy = 'Breakdown Short';
      direction = 'short';
      confidence = Math.max(40, signalStrength.overall - 10);
    } else {
      // Mixed signals - WAIT (not a trade recommendation)
      strategy = 'WAIT - Reversal Unconfirmed';
      direction = 'wait';
      confidence = Math.min(35, signalStrength.overall);
    }
  }
  // ===== LIKELY PULLBACK STRUCTURE =====
  // ONLY valid if ADX > 25 (already checked by hard gate)
  else if (structure === 'likely-pullback') {
    if (priorTrend === 'up' && (strongBullish || momentum.direction === 'bullish')) {
      const patternSignalText = signalStrength.breakdown.pattern.signal.toLowerCase();
      const hasPatternCaution =
        patternSignalText.includes('bearish') ||
        patternSignalText.includes('pressure') ||
        patternSignalText.includes('reversal');
      const volumeSignalText = signalStrength.breakdown.volume.signal.toLowerCase();
      const hasVolumeCaution =
        volumeSignalText.includes('distribution') ||
        volumeSignalText.includes('divergence') ||
        volumeSignalText.includes('caution');

      if (
        trend.emaAlignment === 'bullish' &&
        momentum.strength === 'strong' &&
        !isOverbought &&
        !hasVolumeCaution &&
        !hasPatternCaution
      ) {
        strategy = 'Trend Following Long';
        confidence = Math.min(85, signalStrength.overall + 10);
      } else {
        strategy = 'Pullback Long';
        confidence = Math.max(45, signalStrength.overall - 5);
      }
      direction = 'long';
    } else if (priorTrend === 'down' && (strongBearish || momentum.direction === 'bearish')) {
      if (trend.emaAlignment === 'bearish' && momentum.strength === 'strong') {
        strategy = 'Trend Following Short';
        confidence = Math.min(85, signalStrength.overall + 10);
      } else {
        strategy = 'Rally Short';
        confidence = Math.max(45, signalStrength.overall - 5);
      }
      direction = 'short';
    } else if (strongBullish) {
      strategy = 'Pullback Long';
      direction = 'long';
      confidence = Math.max(40, signalStrength.overall - 10);
    } else if (strongBearish) {
      strategy = 'Rally Short';
      direction = 'short';
      confidence = Math.max(40, signalStrength.overall - 10);
    } else {
      strategy = 'WAIT - No Clear Edge';
      direction = 'wait';
      confidence = Math.min(40, signalStrength.overall);
    }
  }
  // ===== MIXED/UNCLEAR STRUCTURE =====
  // More cautious approach
  else {
    if (strongBullish && trend.emaAlignment === 'bullish') {
      strategy = 'Trend Following Long';
      direction = 'long';
      confidence = Math.max(45, signalStrength.overall - 5);
    } else if (strongBearish && trend.emaAlignment === 'bearish') {
      strategy = 'Trend Following Short';
      direction = 'short';
      confidence = Math.max(45, signalStrength.overall - 5);
    } else if (strongBullish) {
      strategy = 'Breakout Long';
      direction = 'long';
      confidence = Math.max(40, signalStrength.overall - 10);
    } else if (strongBearish) {
      strategy = 'Breakdown Short';
      direction = 'short';
      confidence = Math.max(40, signalStrength.overall - 10);
    } else {
      strategy = 'No Clear Edge - Wait for Confirmation';
      direction = 'wait';
      confidence = Math.min(40, signalStrength.overall);
    }
  }

  // ==========================================
  // VOLUME / REVERSAL CAUTION → Already handled by regime.maxConfidence
  // Regime classification already caps confidence for OBV divergence 
  // and reversal patterns - no need to re-apply here
  // ==========================================
  
  // ==========================================
  // OVERBOUGHT/OVERSOLD CONFIDENCE ADJUSTMENT
  // ==========================================
  // Downgrade confidence by 10% if overbought for longs or oversold for shorts
  // BUT: In TRENDING regime with strong ADX, overbought doesn't suppress
  if (direction === 'long' && isOverbought) {
    if (detectedRegime.type === 'TRENDING' && adx >= 30) {
      // Strong trend - don't suppress for overbought
    } else {
      confidence = Math.max(30, confidence - 10);
    }
  } else if (direction === 'short' && isOversold) {
    if (detectedRegime.type === 'TRENDING' && adx >= 30) {
      // Strong trend - don't suppress for oversold
    } else {
      confidence = Math.max(30, confidence - 10);
    }
  }
  
  // ==========================================
  // REGIME-BASED CONFIDENCE ADJUSTMENT (NEW)
  // ==========================================
  // Cap or reduce confidence based on detected regime
  if (detectedRegime.rules.reduceConfidence) {
    if (detectedRegime.type === 'RANGE_BOUND') {
      // RANGE_BOUND: Cap confidence unless breakout confirmation
      confidence = Math.min(confidence, 55);
    } else if (detectedRegime.type === 'UNCERTAIN') {
      // UNCERTAIN: Hard cap at 40%
      confidence = Math.min(confidence, 40);
    } else if (detectedRegime.type === 'VOLATILITY_EXPANSION') {
      // VOLATILITY_EXPANSION: Reduce by 15%
      confidence = Math.max(30, confidence - 15);
    } else if (detectedRegime.type === 'REVERSAL_ATTEMPT') {
      // REVERSAL_ATTEMPT: Cap at 50% unless fully confirmed
      confidence = Math.min(confidence, 50);
    }
  }
  
  // ==========================================
  // SQUEEZE STRATEGY OVERRIDE
  // ==========================================
  // In squeezes: prefer breakout/market entries with tighter stops
  if (isInSqueeze && direction !== 'wait') {
    if (direction === 'long') {
      strategy = strategy.includes('Pullback') ? 'Breakout Long' : strategy;
    } else if (direction === 'short') {
      strategy = strategy.includes('Rally') ? 'Breakdown Short' : strategy;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // STEP 5: REGIME ENFORCEMENT - FINAL GATE
  // All previous logic is now validated against regime constraints
  // ═══════════════════════════════════════════════════════════════
  
  // 5a. Apply regime maxConfidence cap (HARD CAP)
  confidence = Math.min(confidence, regime.maxConfidence);
  
  // 5b. Speculative regime: reclassify trend-following to speculative
  if (regime.isSpeculative && direction !== 'wait') {
    if (strategy.includes('Trend Following')) {
      strategy = direction === 'long' ? 'Speculative Pullback Long' : 'Speculative Pullback Short';
    } else if (strategy.includes('Pullback') && !strategy.includes('Speculative')) {
      strategy = direction === 'long' ? 'Speculative Pullback Long' : 'Speculative Pullback Short';
    }
    // Further cap confidence in speculative regime
    confidence = Math.min(confidence, 50);
  }
  
  // 5c. Range-bound regime: reclassify trend-following to mean-reversion
  if (regime.structureClass === 'range-bound' && direction !== 'wait') {
    if (strategy.includes('Trend Following')) {
      strategy = direction === 'long' ? 'Mean Reversion Long' : 'Mean Reversion Short';
    }
  }
  
  // 5d. If regime requires confirmation, no market entries allowed (enforced below in entry logic)
  // This is applied in the entry calculation section
  
  // ═══════════════════════════════════════════════════════════════
  // STEP 6: STRATEGY-SPECIFIC CONSTRAINT ENFORCEMENT
  // After classifying strategy type, enforce strategy-specific constraints
  // ═══════════════════════════════════════════════════════════════
  
  // Determine if this is a high-volatility context
  const isHighVolContext = atrPercent >= 5 || historicalVol >= 50;
  const isVeryHighVol = atrPercent >= 8 || historicalVol >= 80;
  
  // Calculate what the stop distance will be (preview for constraint checking)
  const previewStopDistance = stopMultiplier * atr;
  const previewStopPercent = (previewStopDistance / currentPrice) * 100;
  
  // Track if we need to force downgrade
  let forceSpeculative = false;
  let forceWait = false;
  
  // ─────────────────────────────────────────────────────────────────
  // 6a. PULLBACK CONTINUATION IN HIGH-VOL REGIMES
  // ATR ≥5% or HV ≥50%: Risk must be capped or downgrade to speculative
  // ─────────────────────────────────────────────────────────────────
  if (strategy.includes('Pullback') && !strategy.includes('Speculative') && isHighVolContext && direction !== 'wait') {
    // In high-vol, pullback trades must have:
    // - Stops ≤1.25× ATR with reduced confidence, OR
    // - Downgrade to speculative pullback
    
    if (stopMultiplier > 1.25) {
      // Stop is too wide for a standard pullback in high vol
      // Option 1: Tighten stop and reduce confidence
      if (atrPercent < 8 && confidence >= 50) {
        // Can keep as pullback with tighter stop and reduced confidence
        stopMultiplier = 1.25;
        confidence = Math.min(confidence, 55);
      } else {
        // Must downgrade to speculative
        forceSpeculative = true;
      }
    }
    
    // Very high volatility (ATR ≥8% or HV ≥80%): Always speculative
    if (isVeryHighVol) {
      forceSpeculative = true;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────
  // 6b. APPLY SPECULATIVE DOWNGRADE IF REQUIRED
  // ─────────────────────────────────────────────────────────────────
  if (forceSpeculative && direction !== 'wait') {
    if (!strategy.includes('Speculative')) {
      strategy = direction === 'long' ? 'Speculative Pullback Long' : 'Speculative Pullback Short';
    }
    confidence = Math.min(confidence, 50);
  }
  
  // ─────────────────────────────────────────────────────────────────
  // 6c. SPECULATIVE PULLBACK CONSTRAINTS
  // May NOT project aggressive targets beyond nearby resistance
  // Must NOT exceed ~15% upside unless ADX expanding + vol contracting
  // ─────────────────────────────────────────────────────────────────
  let speculativeTargetCap = Infinity; // Will be applied to target calculation
  let speculativeMaxUpside = 0.15; // 15% default cap
  
  if (strategy.includes('Speculative')) {
    // Check for ADX expanding + vol contracting (allows more aggressive targets)
    const adxExpanding = adx > 25 && regime.structureClass === 'trending';
    const volContracting = volatility.regime === 'contracting' || volatility.regime === 'low';
    
    if (adxExpanding && volContracting) {
      // Favorable conditions: allow up to 20% upside
      speculativeMaxUpside = 0.20;
    } else {
      // Standard speculative: cap at 15% upside
      speculativeMaxUpside = 0.15;
    }
    
    // Calculate the max target price based on upside cap
    speculativeTargetCap = currentPrice * (1 + speculativeMaxUpside);
    
    // Also cap at nearest relevant resistance
    if (nearestRelevantResistance < speculativeTargetCap) {
      speculativeTargetCap = nearestRelevantResistance * 1.02; // Just above resistance
    }
  }
  
  // ─────────────────────────────────────────────────────────────────
  // 6d. LOW/MEDIUM CONFIDENCE + WIDE STOPS + AGGRESSIVE TARGETS CHECK
  // May NOT combine wide stops (>1.5× ATR) with aggressive targets
  // ─────────────────────────────────────────────────────────────────
  const isLowMediumConfidence = confidence < 60;
  const hasWideStop = stopMultiplier > 1.5;
  
  if (isLowMediumConfidence && hasWideStop && direction !== 'wait') {
    // This combination is invalid - must choose:
    // 1. Tighten stop (if setup supports it)
    // 2. Or force WAIT
    
    // Check if we can tighten the stop
    const canTightenStop = nearestRelevantSupport > currentPrice - atr * 1.5;
    
    if (canTightenStop) {
      // Tighten stop to structure-based level
      stopMultiplier = 1.5;
    } else {
      // Cannot make consistent - downgrade to WAIT
      forceWait = true;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────
  // 6e. INTERNAL CONSISTENCY CHECK
  // If stop distance, targets, and confidence cannot be made consistent → WAIT
  // ─────────────────────────────────────────────────────────────────
  // Calculate implied risk:reward based on stop and target cap
  if (direction !== 'wait' && !forceWait) {
    const impliedRiskPercent = previewStopPercent;
    const impliedMaxReward = strategy.includes('Speculative') 
      ? speculativeMaxUpside * 100 
      : Math.min(atrPercent * 3, 20); // Standard max 3x ATR or 20%
    
    const impliedRR = impliedMaxReward / impliedRiskPercent;
    
    // Consistency rules:
    // - Low confidence (<50%) requires at least 2:1 R:R to be valid
    // - Medium confidence (50-60%) requires at least 1.5:1 R:R
    // - High confidence (>60%) allows 1:1 R:R
    
    const minRequiredRR = confidence < 50 ? 2.0 : confidence < 60 ? 1.5 : 1.0;
    
    if (impliedRR < minRequiredRR) {
      // Cannot achieve required R:R with current constraints
      // Check if we can adjust
      if (impliedRR < 1.0) {
        // Risk exceeds potential reward - force WAIT
        forceWait = true;
      } else if (impliedRR < minRequiredRR && confidence >= 50) {
        // Downgrade confidence to match R:R
        confidence = Math.min(confidence, 50);
      }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────
  // 6f. APPLY FORCE WAIT IF CONSTRAINTS CANNOT BE MET
  // ─────────────────────────────────────────────────────────────────
  if (forceWait && direction !== 'wait') {
    strategy = 'No Trade - Constraints Not Satisfiable';
    direction = 'wait';
    confidence = Math.min(35, confidence);
    // Add to conflicts for explanation
    conflicts.push('Stop/target/confidence constraints cannot be made internally consistent');
  }
  
  // ==========================================
  // ENTRY CALCULATION - STRUCTURE AND REGIME AWARE
  // ==========================================
  let entryType: 'market' | 'limit' | 'breakout' | 'pullback';
  let entryPrice: number;
  const conditions: string[] = [];
  const atResistance = Math.abs(nearestRelevantResistance - currentPrice) <= atr * 1.0;
  const atSupport = Math.abs(currentPrice - nearestRelevantSupport) <= atr * 1.0;
  
  // REGIME ENFORCEMENT: If regime requires confirmation, convert market entries to conditional
  const marketEntryBlocked = regime.requiresConfirmation || 
                             (isOverbought && atResistance && direction === 'long') ||
                             (isOversold && atSupport && direction === 'short');
  
  if (direction === 'long') {
    if (strategy.includes('Breakout') || strategy.includes('Trend Following')) {
      // Check if market entry is blocked by regime or conditions
      if (marketEntryBlocked && !isInSqueeze) {
        // Force pullback or breakout entry
        if (atResistance) {
          // At resistance: require pullback entry
          entryType = 'pullback';
          const pullbackLevel = currentPrice - atr * 0.75;
          entryPrice = Number(pullbackLevel.toFixed(2));
          conditions.push(`⚠️ Market entry blocked by regime constraints`);
          conditions.push(`Wait for pullback to $${pullbackLevel.toFixed(2)} zone`);
          conditions.push('Enter on bullish reversal candle after pullback');
        } else {
          // Not at resistance: require breakout confirmation
          entryType = 'breakout';
          const breakoutLevel = nearestRelevantResistance;
          entryPrice = Number((breakoutLevel + atr * 0.05).toFixed(2));
          conditions.push(`Confirmation required: Break above $${breakoutLevel.toFixed(2)}`);
          conditions.push('Requires volume confirmation (Z-score > 1)');
        }
      } else if (isInSqueeze) {
        entryType = 'market';
        entryPrice = currentPrice;
        conditions.push('Enter at market on momentum confirmation');
        conditions.push('⚡ Squeeze breakout - expect volatility expansion');
      } else if (strategy.includes('Trend Following') && !marketEntryBlocked) {
        entryType = 'market';
        entryPrice = currentPrice;
        conditions.push('Enter at market on momentum confirmation');
      } else {
        entryType = 'breakout';
        const breakoutLevel = nearestRelevantResistance;
        entryPrice = Number((breakoutLevel + atr * 0.05).toFixed(2));
        conditions.push(`Break above $${breakoutLevel.toFixed(2)}`);
        conditions.push('Requires volume confirmation (Z-score > 1)');
      }
    } else if (strategy.includes('Pullback') || strategy.includes('Mean Reversion') || strategy.includes('Speculative')) {
      entryType = 'pullback';
      const pullbackLevel = currentPrice - atr * 0.75;
      entryPrice = Number(pullbackLevel.toFixed(2));
      conditions.push(`Wait for pullback to $${pullbackLevel.toFixed(2)} zone`);
      conditions.push('Enter on bullish reversal candle');
      if (strategy.includes('Speculative')) {
        conditions.push('⚠️ Speculative regime: reduce position size');
      }
    } else {
      // Default: conditional entry based on regime
      if (marketEntryBlocked) {
        entryType = 'pullback';
        const pullbackLevel = currentPrice - atr * 0.5;
        entryPrice = Number(pullbackLevel.toFixed(2));
        conditions.push('Wait for price confirmation before entry');
      } else {
        entryType = 'market';
        entryPrice = currentPrice;
        conditions.push('Enter at market with momentum confirmation');
      }
    }
  } else if (direction === 'short') {
    if (strategy.includes('Breakdown') || strategy.includes('Trend Following')) {
      // Check if market entry is blocked by regime or conditions
      if (marketEntryBlocked && !isInSqueeze) {
        if (atSupport) {
          // At support: require rally entry
          entryType = 'pullback';
          const rallyLevel = currentPrice + atr * 0.75;
          entryPrice = Number(rallyLevel.toFixed(2));
          conditions.push(`⚠️ Market entry blocked by regime constraints`);
          conditions.push(`Wait for rally to $${rallyLevel.toFixed(2)} zone`);
          conditions.push('Enter on bearish reversal candle after rally');
        } else {
          // Not at support: require breakdown confirmation
          entryType = 'breakout';
          const breakdownLevel = nearestRelevantSupport;
          entryPrice = Number((breakdownLevel - atr * 0.05).toFixed(2));
          conditions.push(`Confirmation required: Break below $${breakdownLevel.toFixed(2)}`);
          conditions.push('Requires volume confirmation (Z-score > 1)');
        }
      } else if (isInSqueeze) {
        entryType = 'market';
        entryPrice = currentPrice;
        conditions.push('Enter at market on momentum confirmation');
        conditions.push('⚡ Squeeze breakdown - expect volatility expansion');
      } else if (strategy.includes('Trend Following') && !marketEntryBlocked) {
        entryType = 'market';
        entryPrice = currentPrice;
        conditions.push('Enter at market on momentum confirmation');
      } else {
        entryType = 'breakout';
        const breakdownLevel = nearestRelevantSupport;
        entryPrice = Number((breakdownLevel - atr * 0.05).toFixed(2));
        conditions.push(`Break below $${breakdownLevel.toFixed(2)}`);
        conditions.push('Requires volume confirmation (Z-score > 1)');
      }
    } else if (strategy.includes('Rally') || strategy.includes('Mean Reversion') || strategy.includes('Speculative')) {
      entryType = 'pullback';
      const rallyLevel = currentPrice + atr * 0.75;
      entryPrice = Number(rallyLevel.toFixed(2));
      conditions.push(`Wait for rally to $${rallyLevel.toFixed(2)} zone`);
      conditions.push('Enter on bearish reversal candle');
      if (strategy.includes('Speculative')) {
        conditions.push('⚠️ Speculative regime: reduce position size');
      }
    } else {
      // Default: conditional entry based on regime
      if (marketEntryBlocked) {
        entryType = 'pullback';
        const rallyLevel = currentPrice + atr * 0.5;
        entryPrice = Number(rallyLevel.toFixed(2));
        conditions.push('Wait for price confirmation before entry');
      } else {
        entryType = 'market';
        entryPrice = currentPrice;
        conditions.push('Enter at market with momentum confirmation');
      }
    }
  } else {
    // ═══════════════════════════════════════════════════════════════════════════
    // WAIT SCENARIO - SUPPRESS ALL TRADE PARAMETERS
    // Show unlock conditions only, not entries/targets/R:R
    // ═══════════════════════════════════════════════════════════════════════════
    entryType = 'breakout'; // Reference only
    entryPrice = currentPrice; // Reference only
    
    // Suppressed trade parameters notice
    conditions.push('🚫 ENTRIES SUPPRESSED - Execution blocked by regime constraints');
    
    // Show unlock conditions instead of entry levels
    if (unlockConditions.length > 0) {
      conditions.push('🔓 Unlock conditions required:');
      unlockConditions.slice(0, 3).forEach(u => conditions.push(`   → ${u}`));
    }
    
    // Show key levels for reference only (not actionable)
    conditions.push(`📍 Reference: Resistance $${nearestRelevantResistance.toFixed(2)} | Support $${nearestRelevantSupport.toFixed(2)}`);
    
    // Show directional bias if present
    if (directionalBias !== 'neutral') {
      conditions.push(`📈 Bias: ${directionalBias.toUpperCase()} (not a trade signal)`);
    }
  }
  
  // ==========================================
  // STOP LOSS - VOLATILITY-AWARE CALCULATION
  // ==========================================
  let stopPrice: number;
  let stopReason: string;
  
  if (direction === 'long') {
    // Use volatility-aware stop multiplier
    stopPrice = entryPrice - atr * stopMultiplier;
    
    // For high volatility (ATR > 20%): also check structure-based stops
    if (useStructureBasedStops && relevantSupports.length > 0) {
      const supportBasedStop = nearestRelevantSupport - atr * 0.2;
      // Use structure stop if it provides better risk:reward
      if (supportBasedStop > entryPrice - atr * 3 && supportBasedStop > stopPrice) {
        stopPrice = supportBasedStop;
        stopReason = `Below support $${nearestRelevantSupport.toFixed(2)}`;
      } else {
        stopReason = `${stopMultiplier}x ATR (${atrPercent.toFixed(1)}% volatility)`;
      }
    } else {
      stopReason = `${stopMultiplier}x ATR below entry`;
    }
    
    // In squeeze: ensure minimum 2:1 R:R on T1
    if (isInSqueeze) {
      stopReason = `1x ATR (squeeze mode)`;
    }
  } else if (direction === 'short') {
    // Use volatility-aware stop multiplier
    stopPrice = entryPrice + atr * stopMultiplier;
    
    // For high volatility: also check structure-based stops
    if (useStructureBasedStops && relevantResistances.length > 0) {
      const resistanceBasedStop = nearestRelevantResistance + atr * 0.2;
      if (resistanceBasedStop < entryPrice + atr * 3 && resistanceBasedStop < stopPrice) {
        stopPrice = resistanceBasedStop;
        stopReason = `Above resistance $${nearestRelevantResistance.toFixed(2)}`;
      } else {
        stopReason = `${stopMultiplier}x ATR (${atrPercent.toFixed(1)}% volatility)`;
      }
    } else {
      stopReason = `${stopMultiplier}x ATR above entry`;
    }
    
    if (isInSqueeze) {
      stopReason = `1x ATR (squeeze mode)`;
    }
  } else {
    stopPrice = nearestRelevantSupport;
    stopReason = 'No trade - reference level only';
  }
  
  const riskPercent = Math.abs((entryPrice - stopPrice) / entryPrice) * 100;
  
  // ═══════════════════════════════════════════════════════════════
  // TARGET CALCULATIONS - REGIME AND STRUCTURE CONSTRAINED
  // Targets must be structurally reachable (200 EMA, major resistance)
  // Do NOT project beyond structural barriers unless breakout required
  // ═══════════════════════════════════════════════════════════════
  let targets: StrategyRecommendation['targets'];
  
  // Calculate 200 EMA for structural capping
  const allCloses = bars.map(b => b.close);
  const ema200ForTargets = calculateEMAValue(allCloses, Math.min(200, allCloses.length));
  
  // Base multipliers (before regime capping)
  let t1Multiplier = isInSqueeze ? 2.0 : 1.5;
  let t2Multiplier = isInSqueeze ? 3.5 : 2.25;
  let t3Multiplier = isInSqueeze ? 5.0 : 3.0;
  
  // REGIME ENFORCEMENT: Cap target multipliers by regime.maxTargetMultiple
  // If regime caps targets at 1.5x ATR, aggressive T3 targets are invalid
  const maxMultiple = regime.maxTargetMultiple;
  if (t3Multiplier > maxMultiple * 2) {
    // Compress targets for restrictive regimes
    t3Multiplier = Math.min(t3Multiplier, maxMultiple * 2);
    t2Multiplier = Math.min(t2Multiplier, maxMultiple * 1.5);
  }
  
  // Adjust probabilities for squeeze (higher momentum = higher probability of hitting targets)
  // ALSO reduce probabilities in speculative/restrictive regimes
  let t1Prob = isInSqueeze ? 70 : 65;
  let t2Prob = isInSqueeze ? 50 : 45;
  let t3Prob = isInSqueeze ? 30 : 25;
  
  // Speculative regime: reduce target probabilities
  if (regime.isSpeculative) {
    t1Prob = Math.min(t1Prob, 55);
    t2Prob = Math.min(t2Prob, 35);
    t3Prob = Math.min(t3Prob, 15);
  }
  
  // Low confidence regime: reduce probabilities
  if (regime.maxConfidence <= 55) {
    t1Prob = Math.min(t1Prob, 50);
    t2Prob = Math.min(t2Prob, 30);
    t3Prob = Math.min(t3Prob, 10);
  }
  
  if (direction === 'long') {
    const riskAmount = entryPrice - stopPrice;
    let t1Price = Number((entryPrice + riskAmount * t1Multiplier).toFixed(2));
    let t2Price = Number((entryPrice + riskAmount * t2Multiplier).toFixed(2));
    let t3Price = Number((entryPrice + riskAmount * t3Multiplier).toFixed(2));
    
    // ─────────────────────────────────────────────────────────────────
    // SPECULATIVE STRATEGY TARGET CAPPING (from Step 6c)
    // Speculative pullbacks may NOT project aggressive targets beyond cap
    // ─────────────────────────────────────────────────────────────────
    if (strategy.includes('Speculative') && speculativeTargetCap < Infinity) {
      if (t1Price > speculativeTargetCap) {
        t1Price = Number(speculativeTargetCap.toFixed(2));
        t1Prob = Math.min(t1Prob, 45); // Reduced probability
      }
      if (t2Price > speculativeTargetCap) {
        t2Price = Number(speculativeTargetCap.toFixed(2));
        t2Prob = Math.min(t2Prob, 25);
      }
      if (t3Price > speculativeTargetCap) {
        // T3 is capped at speculative max - not allowed beyond
        t3Price = Number(speculativeTargetCap.toFixed(2));
        t3Prob = Math.min(t3Prob, 10);
      }
    }
    
    // STRUCTURAL CAPPING: For longs below 200 EMA, cap aggressive targets at 200 EMA
    // This ensures targets are structurally reachable without breakout confirmation
    if (currentPrice < ema200ForTargets) {
      if (t2Price > ema200ForTargets) {
        t2Price = Number(ema200ForTargets.toFixed(2));
        t2Prob = Math.min(t2Prob, 35); // Reduced probability at structural barrier
      }
      if (t3Price > ema200ForTargets) {
        t3Price = Number((ema200ForTargets * 1.02).toFixed(2)); // Just above 200 EMA
        t3Prob = Math.min(t3Prob, 20); // Requires breakout confirmation
      }
    }
    
    // Cap targets at nearest major resistance if it's a barrier
    if (nearestRelevantResistance < t2Price && nearestRelevantResistance > entryPrice) {
      if (t2Price > nearestRelevantResistance * 1.05) {
        t2Price = Number(nearestRelevantResistance.toFixed(2));
      }
    }
    
    targets = {
      t1: { price: t1Price, rr: t1Multiplier, probability: t1Prob },
      t2: { price: t2Price, rr: t2Multiplier, probability: t2Prob },
      t3: { price: t3Price, rr: t3Multiplier, probability: t3Prob }
    };
  } else if (direction === 'short') {
    const riskAmount = stopPrice - entryPrice;
    let t1Price = Number((entryPrice - riskAmount * t1Multiplier).toFixed(2));
    let t2Price = Number((entryPrice - riskAmount * t2Multiplier).toFixed(2));
    let t3Price = Number((entryPrice - riskAmount * t3Multiplier).toFixed(2));
    
    // ─────────────────────────────────────────────────────────────────
    // SPECULATIVE STRATEGY TARGET CAPPING (from Step 6c) - SHORTS
    // Speculative pullbacks may NOT project aggressive targets beyond cap
    // For shorts, cap is downside (speculativeMaxUpside applied as downside)
    // ─────────────────────────────────────────────────────────────────
    if (strategy.includes('Speculative') && speculativeTargetCap < Infinity) {
      const speculativeDownsideCap = currentPrice * (1 - speculativeMaxUpside);
      if (t1Price < speculativeDownsideCap) {
        t1Price = Number(speculativeDownsideCap.toFixed(2));
        t1Prob = Math.min(t1Prob, 45);
      }
      if (t2Price < speculativeDownsideCap) {
        t2Price = Number(speculativeDownsideCap.toFixed(2));
        t2Prob = Math.min(t2Prob, 25);
      }
      if (t3Price < speculativeDownsideCap) {
        t3Price = Number(speculativeDownsideCap.toFixed(2));
        t3Prob = Math.min(t3Prob, 10);
      }
    }
    
    // STRUCTURAL CAPPING: For shorts above 200 EMA, cap aggressive targets at 200 EMA
    if (currentPrice > ema200ForTargets) {
      if (t2Price < ema200ForTargets) {
        t2Price = Number(ema200ForTargets.toFixed(2));
        t2Prob = Math.min(t2Prob, 35);
      }
      if (t3Price < ema200ForTargets) {
        t3Price = Number((ema200ForTargets * 0.98).toFixed(2));
        t3Prob = Math.min(t3Prob, 20);
      }
    }
    
    // Cap targets at nearest major support if it's a barrier
    if (nearestRelevantSupport > t2Price && nearestRelevantSupport < entryPrice) {
      if (t2Price < nearestRelevantSupport * 0.95) {
        t2Price = Number(nearestRelevantSupport.toFixed(2));
      }
    }
    
    // Prevent negative or absurdly low targets
    t1Price = Math.max(0.01, t1Price);
    t2Price = Math.max(0.01, t2Price);
    t3Price = Math.max(0.01, t3Price);
    
    targets = {
      t1: { price: t1Price, rr: t1Multiplier, probability: t1Prob },
      t2: { price: t2Price, rr: t2Multiplier, probability: t2Prob },
      t3: { price: t3Price, rr: t3Multiplier, probability: t3Prob }
    };
  } else {
    // ═══════════════════════════════════════════════════════════════
    // WAIT SCENARIO - STRATEGY CONSISTENCY RULE
    // If recommendation is WAIT, do NOT include entries, stops, or targets
    // Show only reference levels, not actionable trade levels
    // ═══════════════════════════════════════════════════════════════
    targets = {
      t1: {
        price: Number(nearestRelevantResistance.toFixed(2)),
        rr: 0,
        probability: 0  // 0 = reference level only
      },
      t2: {
        price: Number(ema200ForTargets.toFixed(2)), // 200 EMA as key level
        rr: 0,
        probability: 0
      },
      t3: {
        price: Number(nearestRelevantSupport.toFixed(2)),
        rr: 0,
        probability: 0
      }
    };
  }
  
  // Invalidation message
  let invalidation: string;
  if (direction === 'long') {
    invalidation = `Long trade invalidated if price closes below $${stopPrice.toFixed(2)}`;
  } else if (direction === 'short') {
    invalidation = `Short trade invalidated if price closes above $${stopPrice.toFixed(2)}`;
  } else {
    // ═══════════════════════════════════════════════════════════════════════════
    // WAIT SCENARIO - Provide unlock conditions, not trade parameters
    // Execution is blocked - show what conditions would unlock a valid trade
    // ═══════════════════════════════════════════════════════════════════════════
    if (unlockConditions.length > 0) {
      invalidation = `EXECUTION BLOCKED. Unlock conditions: ${unlockConditions.slice(0, 3).join(' • ')}`;
    } else if (conflicts.length > 0) {
      invalidation = `WAIT due to: ${conflicts.slice(0, 2).join('; ')}. Wait for resolution.`;
    } else {
      invalidation = 'Wait for clear directional breakout before taking a position';
    }
  }
  
  // Notes - now regime-reasoning aware
  const notes: string[] = [];
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DETECTED REGIME OUTPUT (NEW - TOP OF NOTES)
  // High-level regime classification that determines which rules apply
  // ═══════════════════════════════════════════════════════════════════════════
  notes.push(`🏷️ Regime: ${detectedRegime.type} (${detectedRegime.confidence}% confidence)`);
  
  // Show regime direction if not neutral
  if (detectedRegime.direction !== 'neutral') {
    notes.push(`   Direction: ${detectedRegime.direction.toUpperCase()}`);
  }
  
  // Show key regime rules that affect this analysis
  const activeRules: string[] = [];
  if (!detectedRegime.rules.useADXGate) {
    activeRules.push('ADX gate disabled');
  }
  if (!detectedRegime.rules.useStochSupression) {
    activeRules.push('Stoch suppression disabled');
  }
  if (detectedRegime.rules.allowMeanReversion) {
    activeRules.push('Mean reversion allowed');
  }
  if (detectedRegime.rules.requireBreakoutConfirmation) {
    activeRules.push('Breakout confirmation required');
  }
  if (detectedRegime.rules.widenStops) {
    activeRules.push('Wider stops recommended');
  }
  if (activeRules.length > 0) {
    notes.push(`   Rules: ${activeRules.join(' • ')}`);
  }
  
  // Show regime-specific unlock conditions
  if (detectedRegime.unlockConditions.length > 0 && direction === 'wait') {
    notes.push(`🔓 Regime Unlock Conditions:`);
    detectedRegime.unlockConditions.slice(0, 3).forEach(u => notes.push(`   • ${u}`));
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // REGIME REASONING OUTPUT (PRIMARY)
  // Report reflects what is TRADABLE, not theoretically bullish/bearish
  // ═══════════════════════════════════════════════════════════════════════════
  
  // ─────────────────────────────────────────────────────────────────
  // EXECUTION STATUS (MOST IMPORTANT)
  // ─────────────────────────────────────────────────────────────────
  if (strategyGenerationBlocked) {
    notes.push(`🚫 STRATEGY GENERATION BLOCKED - Regime constraints not satisfied`);
    
    // State directional bias WITHOUT recommending trade
    if (directionalBias !== 'neutral') {
      notes.push(`📈 Directional Bias: ${directionalBias.toUpperCase()} (informational only, NOT a trade signal)`);
    }
    
    // List blocking conditions
    if (executionBlocks.length > 0) {
      notes.push(`⛔ Blocking Conditions:`);
      executionBlocks.slice(0, 4).forEach(b => notes.push(`   • ${b}`));
    }
    
    // List unlock conditions (from hard blocks, not regime-specific)
    if (unlockConditions.length > 0) {
      notes.push(`🔓 Conditions Required for Strategy Generation:`);
      unlockConditions.slice(0, 4).forEach(u => notes.push(`   • ${u}`));
    }
  }
  
  // Market regime inference (detailed)
  notes.push(`🎯 Market: ${regimeAnalysis.market.regime.toUpperCase()} (${regimeAnalysis.market.strength}) - ${regimeAnalysis.market.direction}`);
  
  // Risk regime inference
  notes.push(`📊 Risk: ${regimeAnalysis.risk.regime} volatility, ${regimeAnalysis.risk.atrContext} ATR, momentum ${regimeAnalysis.risk.momentumDispersion}`);
  
  // Behavioral context
  notes.push(`👥 Context: ${regimeAnalysis.behavioral.context} • ${regimeAnalysis.behavioral.volumeSignature} volume • ${regimeAnalysis.behavioral.oscillatorState} oscillators`);
  
  // Strategy feasibility
  if (feasibility.valid.length > 0 && feasibility.valid[0] !== 'wait') {
    notes.push(`✅ Valid strategies: ${feasibility.valid.filter(s => s !== 'wait').join(', ')}`);
  }
  if (feasibility.invalid.length > 0) {
    notes.push(`❌ Invalid: ${feasibility.invalid.slice(0, 2).join(', ')}`);
  }
  
  // Add key evidence from regime analysis
  const keyEvidence = [
    ...regimeAnalysis.market.evidence.slice(0, 1),
    ...regimeAnalysis.behavioral.evidence.slice(0, 1)
  ];
  if (keyEvidence.length > 0) {
    notes.push(`📋 Evidence: ${keyEvidence.join(' | ')}`);
  }
  
  // Legacy regime notes
  notes.push(`📊 Regime: ${regime.volatilityClass.toUpperCase()} volatility + ${regime.structureClass}`);
  
  // Add regime constraints
  if (regime.constraints.length > 0) {
    regime.constraints.slice(0, 3).forEach(c => notes.push(c));
  }
  
  // Add speculative warning if applicable
  if (regime.isSpeculative || strategy.includes('Speculative')) {
    notes.push(`⚠️ SPECULATIVE SETUP - Reduce position size significantly`);
    notes.push(`Max hold: ${regime.maxHoldingDays} days • Max upside: ${(speculativeMaxUpside * 100).toFixed(0)}%`);
    if (speculativeTargetCap < Infinity) {
      notes.push(`Targets capped at $${speculativeTargetCap.toFixed(2)} (nearby resistance)`);
    }
  }
  
  // Add high-volatility pullback constraint notes
  if (isHighVolContext && strategy.includes('Pullback') && direction !== 'wait') {
    notes.push(`📉 High-vol pullback: stops ≤${stopMultiplier.toFixed(2)}x ATR, reduced confidence`);
  }
  
  // Add internal consistency notes if constraints were applied
  if (forceSpeculative && !regime.isSpeculative) {
    notes.push(`⚠️ Downgraded to speculative: high-vol pullback with wide stop`);
  }
  
  // Add confirmation requirement
  if (regime.requiresConfirmation && direction !== 'wait') {
    notes.push(`🔒 Confirmation required - No immediate market entry`);
  }
  
  // Secondary notes
  notes.push(`Signal: ${signalStrength.grade} (${signalStrength.overall}/100)`);
  notes.push(`Structure: ${structure} (${dominantBias} bias)`);
  notes.push(`Momentum: ${momentum.direction} (${momentum.strength})`);
  
  // Structure-specific notes
  if (structure === 'trend-reversal-risk') {
    notes.push(`⚡ Reversal setup - use breakout entries`);
  } else if (structure === 'likely-pullback') {
    notes.push(`📈 Pullback in ${priorTrend}trend - trade with trend`);
  }
  
  // Volatility regime notes
  if (isInSqueeze) {
    notes.push(`🔥 SQUEEZE: HV/BB high - expect volatility expansion`);
    notes.push(`Tight 1x ATR stops, min 2:1 R:R required`);
  } else if (atrPercent > 20) {
    notes.push(`⚠️ High volatility - structure-based stops used`);
  }
  
  // Overbought/Oversold warnings
  if (isOverbought && direction === 'long') {
    notes.push(`⚠️ Overbought conditions - confidence reduced`);
  } else if (isOversold && direction === 'short') {
    notes.push(`⚠️ Oversold conditions - confidence reduced`);
  }
  
  if (direction === 'wait') {
    notes.push(`Trading range: $${nearestRelevantSupport.toFixed(2)} - $${nearestRelevantResistance.toFixed(2)}`);
    notes.push('Wait for breakout with volume confirmation');
    
    // Add conflict explanation for WAIT recommendations
    if (conflicts.length > 0) {
      notes.push(`⚠️ CONFLICTS DETECTED:`);
      conflicts.forEach(c => notes.push(`  • ${c}`));
      notes.push(`WAIT is optimal when constraints conflict`);
    }
  }
  
  if (momentum.divergences.length > 0) {
    notes.push(`⚠️ ${momentum.divergences[0].indicator} divergence detected`);
  }
  
  return {
    strategy,
    direction,
    confidence,
    entry: {
      type: entryType,
      price: Number(entryPrice.toFixed(2)),
      conditions
    },
    stopLoss: {
      price: Number(stopPrice.toFixed(2)),
      reason: stopReason,
      riskPercent: Number(riskPercent.toFixed(2))
    },
    targets,
    invalidation,
    notes
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE SCENARIOS - REGIME-AWARE DECISION VALIDATION
// These serve as unit-test-like fixtures to validate expected behavior
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EXAMPLE A: RANGE_BOUND regime with resistance holding
 * 
 * Input:
 *   - ADX: 22 (weak trend)
 *   - EMA Alignment: mixed
 *   - Stochastic: 88 (overbought)
 *   - Price: at resistance level
 *   - Prior trend: sideways
 *   - Structure: mixed
 * 
 * Expected Regime: RANGE_BOUND
 * Expected Rules:
 *   - useADXGate: false (ADX gate disabled in range)
 *   - allowMeanReversion: true (at overbought near resistance)
 *   - requireBreakoutConfirmation: true
 * 
 * Expected Output:
 *   - Strategy: WAIT
 *   - Confidence: ≤40% (capped for RANGE_BOUND)
 *   - Unlock conditions:
 *     - "LONG: Breakout above range resistance + close/hold confirmation"
 *     - "Mean reversion SHORT: Stoch > 85 at resistance + bearish candle"
 *   - Notes should NOT include "ADX must rise above 25" (wrong unlock for range)
 */

/**
 * EXAMPLE B: TRENDING regime with overbought conditions
 * 
 * Input:
 *   - ADX: 31 (strong trend)
 *   - EMA Alignment: bullish
 *   - Stochastic: 90 (overbought)
 *   - Price: above all EMAs
 *   - Prior trend: up
 *   - Structure: likely-pullback
 * 
 * Expected Regime: TRENDING
 * Expected Rules:
 *   - useADXGate: true
 *   - useStochSupression: false (overbought DOES NOT suppress in strong trend)
 *   - allowMeanReversion: false
 * 
 * Expected Output:
 *   - Strategy: LONG (Trend Following or Pullback)
 *   - Confidence: NOT reduced for overbought (ADX > 30)
 *   - Notes: Should NOT say "overbought suppresses long"
 */

/**
 * EXAMPLE C: REVERSAL_ATTEMPT regime with partial confirmation
 * 
 * Input:
 *   - ADX: 18 (weak trend)
 *   - Prior trend: down
 *   - Structure: trend-reversal-risk
 *   - Price: broke recent swing high
 *   - OBV: rising
 *   - CMF: +0.15 (positive)
 *   - Stochastic: 65 (neutral)
 * 
 * Expected Regime: REVERSAL_ATTEMPT
 * Expected Rules:
 *   - useADXGate: false (low ADX expected in reversals)
 *   - requireBreakoutConfirmation: true
 *   - requireStructureBreak: true
 *   - widenStops: true
 * 
 * Expected Output:
 *   - Strategy: LONG (conditional on confirmation)
 *   - Confidence: ≤50% (capped for reversal)
 *   - Unlock conditions:
 *     - "Volume confirmation: OBV rising + CMF positive" (CHECK - satisfied)
 *     - "Require break of prior swing high" (CHECK - satisfied)
 *   - May allow execution IF all confirmations pass
 */

/**
 * EXAMPLE D: VOLATILITY_EXPANSION regime
 * 
 * Input:
 *   - ATR%: 8% (high)
 *   - Bollinger Bandwidth: 45% (expanding)
 *   - Volatility regime: expanding
 *   - ADX: 26
 *   - Squeeze: OFF (released)
 *   - Volume Z-score: 0.5
 * 
 * Expected Regime: VOLATILITY_EXPANSION
 * Expected Rules:
 *   - widenStops: true
 *   - reduceConfidence: true
 *   - requireBreakoutConfirmation: true
 * 
 * Expected Output:
 *   - Strategy: WAIT (unless very strong confirmation)
 *   - Confidence: reduced by 15%
 *   - Stop multiplier: increased (1.5-2x ATR)
 *   - Unlock conditions:
 *     - "Require stronger confirmation (volume z-score > 1.5 OR multi-indicator alignment)"
 *     - "Use wider stops (1.5-2x normal ATR multiple)"
 *   - Notes: "Reduce position size proportionally to volatility"
 */

