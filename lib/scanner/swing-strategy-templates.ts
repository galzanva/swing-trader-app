/**
 * Swing Trading Strategy Templates
 * 
 * Pre-built scanner configurations for swing trading strategies
 * These are rule-based templates designed for 5-15 day holding periods
 */

import type { StrategyDsl } from '../strategy-builder/dsl-schema';

// ═══════════════════════════════════════════════════════════════════════════
// SWING STRATEGY CONFIGURATION INTERFACE
// Extends the base strategy DSL with swing-specific parameters
// ═══════════════════════════════════════════════════════════════════════════

export interface SwingStrategyConfig {
  // Strategy Metadata
  id: string;
  name: string;
  description: string;
  strategyType: 'early-stage-bullish' | 'momentum-continuation' | 'pullback-entry' | 'breakout-confirmation';
  holdingPeriod: { min: number; max: number }; // Days
  
  // Universe & Liquidity Filters (Hard Filters)
  universe: {
    markets: ('NYSE' | 'NASDAQ' | 'AMEX')[];
    minPrice: number;
    maxPrice?: number;
    minAvgDollarVolume: number; // 20-day average dollar volume
    excludeETFs: boolean;
    excludeADRs: boolean;
    excludeOTC: boolean;
  };
  
  // Trend / Structure Filters
  trend: {
    // EMA Requirements
    priceAboveEMA20: boolean;
    priceAboveEMA50: boolean;
    priceAboveEMA200?: boolean;
    
    // Distance from EMA (as percentage)
    ema20DistanceMin: number; // Min % above EMA20 (e.g., 0)
    ema20DistanceMax: number; // Max % above EMA20 (e.g., 10)
    
    // ADX Requirements
    adxMin: number;
    adxMax: number;
    plusDIGreaterThanMinusDI: boolean; // +DI > -DI for bullish bias
    
    // Optional Structure Add-ons
    newHighWithinBars?: number; // New 20-day high within last N sessions
    breakoutAbovePriorBars?: number; // Close above highest close of prior N bars
  };
  
  // Momentum Filters
  momentum: {
    // RSI Requirements
    rsiMin: number;
    rsiMax: number;
    
    // MACD Requirements
    macdAboveZero?: boolean;
    macdCrossedSignalWithinBars?: number; // MACD crossed above signal within N bars
    
    // Stochastic (optional - for avoiding exhaustion)
    stochMaxForEntry?: number; // Avoid if Stoch > this value
  };
  
  // Volume / Flow Filters
  volume: {
    // Volume Ratio (today's volume vs 20-day avg)
    volumeRatioMin: number; // e.g., 1.2
    volumeRatioMax?: number; // e.g., 5.0 (avoid blow-offs)
    use3DayAverage: boolean; // Use 3-day avg instead of single day
    
    // OBV/CMF Requirements
    obvAboveMA?: boolean; // OBV > its 20-bar MA
    cmfMin?: number; // Minimum CMF (e.g., 0)
    cmfExcludeBelow?: number; // Exclude if CMF below this (e.g., -0.1)
  };
  
  // Risk / Volatility Filters
  volatility: {
    atrPercentMin: number; // Min ATR% (e.g., 2%)
    atrPercentMax: number; // Max ATR% (e.g., 8%)
  };
  
  // Trading Blueprint (Output)
  tradingBlueprint: {
    // Entry Zone
    entryType: 'pullback' | 'breakout' | 'limit';
    entryZoneDescription: string;
    entryZoneFormula: string; // e.g., "ema20" or "prior_resistance"
    
    // Stop Loss
    stopType: 'swing_low' | 'atr_based' | 'ema_based';
    stopAtrMultiplier?: number; // e.g., 1.2-1.5
    stopDescription: string;
    
    // Targets
    primaryTargetAtrMultiplier: number; // e.g., 1.0-1.5
    extendedTargetAtrMultiplier?: number; // e.g., 2.0
    extendedTargetCondition?: string; // e.g., "ADX rises above 25"
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// US SWING – EARLY-STAGE BULLISH TREND (5–15 DAYS)
// ═══════════════════════════════════════════════════════════════════════════

export const EARLY_STAGE_BULLISH_TREND: SwingStrategyConfig = {
  id: 'us-swing-early-bullish',
  name: 'US Swing – Early-Stage Bullish Trend (5–15 days)',
  description: `
    Targets stocks already above 20/50 EMA with rising ADX (20-30 range).
    Prefers RSI 55–65 to avoid late overbought blow-offs.
    Requires confirming volume/flow and controlled ATR% (2-8%).
    Designed for directional long swings, NOT for mean-reversion shorts or late-stage chasing.
    
    KEY PRINCIPLES:
    • Capture trends that are established but not yet mature or parabolic
    • Avoid extended/vertical moves (price not >10% above EMA20)
    • Momentum must confirm trend but avoid exhaustion
    • Volume should confirm buying interest, not chase blow-offs
  `,
  strategyType: 'early-stage-bullish',
  holdingPeriod: { min: 5, max: 15 },
  
  // ─────────────────────────────────────────────────────────────────
  // 1. Universe & Liquidity (Hard Filters)
  // ─────────────────────────────────────────────────────────────────
  universe: {
    markets: ['NYSE', 'NASDAQ', 'AMEX'],
    minPrice: 5, // Default $5, user can raise to $10
    maxPrice: 500, // Avoid extremely high-priced stocks
    minAvgDollarVolume: 5_000_000, // $5M minimum, user can raise to $10M
    excludeETFs: true,
    excludeADRs: true,
    excludeOTC: true,
  },
  
  // ─────────────────────────────────────────────────────────────────
  // 2. Trend / Structure Filters (Early-Stage Uptrend)
  // ─────────────────────────────────────────────────────────────────
  trend: {
    priceAboveEMA20: true,
    priceAboveEMA50: true,
    priceAboveEMA200: false, // Not required, but nice to have
    
    // Distance from EMA20: 0% ≤ distance ≤ +10%
    // Reject tickers where price is more than 10% above EMA20 (too extended)
    ema20DistanceMin: 0,
    ema20DistanceMax: 10,
    
    // ADX(14) between 20 and 30 - trend is established but not mature
    adxMin: 20,
    adxMax: 30,
    plusDIGreaterThanMinusDI: true, // Bullish directional bias
    
    // Optional structure add-ons
    newHighWithinBars: 10, // New 20-day high within last 5-10 sessions
    breakoutAbovePriorBars: 40, // Close above highest close of prior 20-40 bars
  },
  
  // ─────────────────────────────────────────────────────────────────
  // 3. Momentum Filters (Bullish, Not Overbought)
  // ─────────────────────────────────────────────────────────────────
  momentum: {
    // RSI(14) between 55 and 65
    // DO NOT require RSI > 70 - explicitly avoid "RSI ≥ 70" as bullish condition
    rsiMin: 55,
    rsiMax: 65,
    
    // MACD: Either MACD > 0 OR crossed above signal within 5 bars
    macdAboveZero: true,
    macdCrossedSignalWithinBars: 5,
    
    // Avoid exhaustion - don't enter if Stoch > 90
    stochMaxForEntry: 90,
  },
  
  // ─────────────────────────────────────────────────────────────────
  // 4. Volume / Flow Filters (Confirm, Don't Chase Blow-Offs)
  // ─────────────────────────────────────────────────────────────────
  volume: {
    // Volume ratio: 1.2× to 2.0× the 20-day average
    volumeRatioMin: 1.5, // Default 1.5×, user-configurable
    volumeRatioMax: 5.0, // Avoid blow-offs
    use3DayAverage: true, // Use 3-day average for stability
    
    // OBV should be in uptrend (OBV > 20-bar MA)
    obvAboveMA: true,
    
    // CMF: Must be ≥ 0, exclude if ≤ -0.1
    cmfMin: 0,
    cmfExcludeBelow: -0.1, // Hard exclude distribution
  },
  
  // ─────────────────────────────────────────────────────────────────
  // 5. Risk / Volatility Filters
  // ─────────────────────────────────────────────────────────────────
  volatility: {
    // ATR(14) as % of price: between 2% and 8%
    atrPercentMin: 2, // Too slow below 2%
    atrPercentMax: 8, // Too wild above 8%
  },
  
  // ─────────────────────────────────────────────────────────────────
  // 6. Trading Blueprint
  // ─────────────────────────────────────────────────────────────────
  tradingBlueprint: {
    entryType: 'pullback',
    entryZoneDescription: 'Pullback toward EMA20 or prior breakout level',
    entryZoneFormula: 'ema20',
    
    stopType: 'swing_low',
    stopAtrMultiplier: 1.35, // ~1.2-1.5× ATR below entry
    stopDescription: 'Below last swing low, or ~1.2-1.5× ATR below entry zone',
    
    primaryTargetAtrMultiplier: 1.25, // 1.0-1.5× ATR for 5-10 day swing
    extendedTargetAtrMultiplier: 2.0, // Up to 2× ATR extended
    extendedTargetCondition: 'ADX rises above 25 and trend quality remains intact',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SWING STRATEGY SCAN RESULT
// Output structure for stocks that pass the scan
// ═══════════════════════════════════════════════════════════════════════════

export interface SwingScanResult {
  ticker: string;
  name: string;
  price: number;
  
  // Regime Label
  regimeLabel: string; // e.g., "Early-stage bullish trend, 5–15 day swing candidate"
  
  // Filter Scores
  filterScores: {
    trend: { passed: boolean; score: number; details: string[] };
    momentum: { passed: boolean; score: number; details: string[] };
    volume: { passed: boolean; score: number; details: string[] };
    volatility: { passed: boolean; score: number; details: string[] };
  };
  
  // Overall Score (0-100)
  overallScore: number;
  confidence: 'high' | 'medium' | 'low';
  
  // Key Indicators
  indicators: {
    ema20: number;
    ema50: number;
    ema200?: number;
    ema20Distance: number; // % above EMA20
    adx: number;
    plusDI: number;
    minusDI: number;
    rsi: number;
    macdLine: number;
    macdSignal: number;
    macdHistogram: number;
    volumeRatio: number;
    obvTrend: 'rising' | 'falling' | 'flat';
    cmf: number;
    atrPercent: number;
  };
  
  // Trading Blueprint
  blueprint: {
    // Entry Zone
    suggestedEntryZone: { low: number; high: number };
    entryType: string;
    entryDescription: string;
    
    // Stop Loss
    suggestedStop: number;
    stopRiskPercent: number;
    stopDescription: string;
    
    // Targets
    primaryTarget: number;
    primaryTargetRR: number;
    primaryTargetDescription: string;
    extendedTarget?: number;
    extendedTargetRR?: number;
    extendedTargetCondition?: string;
    
    // Holding Period
    suggestedHoldingDays: { min: number; max: number };
  };
  
  // Notes & Warnings
  notes: string[];
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// USER-CONFIGURABLE SCAN PARAMETERS
// ═══════════════════════════════════════════════════════════════════════════

export interface SwingScanParameters {
  // Liquidity
  minPrice: number; // Default: 5, Option: 10
  minAvgDollarVolume: number; // Default: 5M, Option: 10M
  
  // Volume Ratio
  volumeRatioMin: number; // Default: 1.5, Range: 1.2-2.0
  
  // ADX Range
  adxMin: number; // Default: 20
  adxMax: number; // Default: 30
  
  // RSI Range
  rsiMin: number; // Default: 55
  rsiMax: number; // Default: 65
  
  // EMA Distance
  ema20DistanceMax: number; // Default: 10%
  
  // ATR% Range
  atrPercentMin: number; // Default: 2%
  atrPercentMax: number; // Default: 8%
  
  // Optional Filters
  requireNewHigh: boolean; // Require new 20-day high
  requireOBVConfirm: boolean; // Require OBV > MA
  excludeNegativeCMF: boolean; // Exclude CMF < -0.1
  
  // Results
  maxResults: number; // Default: 50
  sortBy: 'score' | 'volume' | 'adx' | 'momentum';
}

export const DEFAULT_SWING_SCAN_PARAMETERS: SwingScanParameters = {
  minPrice: 5,
  minAvgDollarVolume: 5_000_000,
  volumeRatioMin: 1.5,
  adxMin: 20,
  adxMax: 30,
  rsiMin: 55,
  rsiMax: 65,
  ema20DistanceMax: 10,
  atrPercentMin: 2,
  atrPercentMax: 8,
  requireNewHigh: false, // Optional
  requireOBVConfirm: true,
  excludeNegativeCMF: true,
  maxResults: 50,
  sortBy: 'score',
};

// ═══════════════════════════════════════════════════════════════════════════
// CONVERT TO STRATEGY DSL
// Creates a StrategyDsl from the swing config for use with existing evaluator
// ═══════════════════════════════════════════════════════════════════════════

export function swingConfigToStrategyDsl(config: SwingStrategyConfig): StrategyDsl {
  return {
    name: config.name,
    description: config.description,
    direction: 'long',
    timeframe: '1day',
    eligibility: {
      // EMA Rules
      emaRules: [
        ...(config.trend.priceAboveEMA20 ? [{ ema1: 9 as 9, operator: '>' as '>', ema2: 20 as 20, description: 'Price above EMA20' }] : []),
        ...(config.trend.priceAboveEMA50 ? [{ ema1: 20 as 20, operator: '>' as '>', ema2: 50 as 50, description: 'EMA20 above EMA50 (uptrend)' }] : []),
      ],
      
      // RSI Range
      rsiRange: {
        period: 14,
        min: config.momentum.rsiMin,
        max: config.momentum.rsiMax,
      },
      
      // ATR Range
      atrRange: {
        period: 14,
        minPct: config.volatility.atrPercentMin,
        maxPct: config.volatility.atrPercentMax,
      },
      
      // Volume Rule
      volumeRules: [
        {
          type: 'relative' as 'relative',
          threshold: config.volume.volumeRatioMin,
          operator: '>=' as '>=',
          description: `Volume ≥ ${config.volume.volumeRatioMin}× 20-day average`,
        },
      ],
      
      // Custom conditions for ADX range, +DI/-DI, etc.
      custom: [
        `ADX >= ${config.trend.adxMin} AND ADX <= ${config.trend.adxMax}`,
        config.trend.plusDIGreaterThanMinusDI ? '+DI > -DI' : '',
        `EMA20_DISTANCE <= ${config.trend.ema20DistanceMax}%`,
        config.momentum.macdAboveZero ? 'MACD > 0 OR MACD_CROSS_UP within 5 bars' : '',
        config.volume.cmfExcludeBelow ? `CMF > ${config.volume.cmfExcludeBelow}` : '',
      ].filter(Boolean),
    },
    trigger: {
      type: 'pullback',
      level: config.tradingBlueprint.entryZoneFormula,
      description: config.tradingBlueprint.entryZoneDescription,
    },
    stop: {
      type: 'atr',
      value: `entry-${config.tradingBlueprint.stopAtrMultiplier}*ATR`,
      description: config.tradingBlueprint.stopDescription,
    },
    targets: [
      {
        level: `entry+${config.tradingBlueprint.primaryTargetAtrMultiplier}*ATR`,
        label: 'T1 (5-10 day)',
        rr: config.tradingBlueprint.primaryTargetAtrMultiplier / (config.tradingBlueprint.stopAtrMultiplier || 1.35),
      },
      ...(config.tradingBlueprint.extendedTargetAtrMultiplier ? [{
        level: `entry+${config.tradingBlueprint.extendedTargetAtrMultiplier}*ATR`,
        label: 'T2 (Extended)',
        rr: config.tradingBlueprint.extendedTargetAtrMultiplier / (config.tradingBlueprint.stopAtrMultiplier || 1.35),
      }] : []),
    ],
    riskManagement: {
      minRR: 1.0,
      maxPositionSize: 2,
      earningsDaysBuffer: 3,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AVAILABLE SWING STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════

export const SWING_STRATEGIES: SwingStrategyConfig[] = [
  EARLY_STAGE_BULLISH_TREND,
];

export function getSwingStrategyById(id: string): SwingStrategyConfig | undefined {
  return SWING_STRATEGIES.find(s => s.id === id);
}

