/**
 * AI Swing Trading Strategy - TypeScript Types
 * Version 1.1 - Complete type definitions for all strategies
 */

// ===========================
// Core Data Types
// ===========================

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type MarketRegime = 'bullish' | 'neutral' | 'bearish';
export type Direction = 'long' | 'short';
export type StrategyType = 
  | 'triangle_breakout_long'
  | 'flag_breakout_long'
  | 'double_top_short'
  | 'trend_pullback_long'
  | 'mean_reversion_short'
  | 'failed_breakout_short';

// ===========================
// Pattern Contexts
// ===========================

export interface TriangleContext {
  upperNow: number;
  lowerNow: number;
  widthPct: number;
  contractionsOk: boolean;
  touches: number;
  status: 'forming' | 'ready' | 'broken';
}

export interface FlagContext {
  pullbackDepthPct: number;
  parallelOk: boolean;
  channelSlope: number;
  status: 'forming' | 'ready' | 'broken';
  flagTop: number;
  flagLow: number;
}

export interface DoubleTopContext {
  neckline: number;
  separationBars: number;
  symmetryPct: number;
  heightAtr: number;
  touches: number;
  status: 'forming' | 'ready' | 'broken';
  peak1Price: number;
  peak2Price: number;
}

export interface PullbackContext {
  reached: boolean;
  reversalCandle: boolean;
  status: 'approaching' | 'at_level' | 'bounced';
  emaLevel: number; // Which EMA (20 or 50)
}

// ===========================
// Strategy Input Data
// ===========================

export interface StrategyInput {
  // Basic data
  symbol: string;
  timeframe: string;
  asOf: string;
  bars: OHLCV[];
  
  // Current price data
  price: number;
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  
  // EMAs
  ema9: number;
  ema20: number;
  ema50: number;
  ema200: number;
  
  // Momentum/Volatility
  rsi14: number;
  atr: number;
  atrPct: number; // atr / price * 100
  
  // Volume
  volZ: number; // Z-score vs last 20 bars
  
  // Optional pattern contexts
  triangle?: TriangleContext;
  flag?: FlagContext;
  doubleTop?: DoubleTopContext;
  pullback?: PullbackContext;
  
  // Chart pattern contexts (from detectAllChartPatterns)
  patternContexts?: {
    triangle: any | null;
    flag: any | null;
    doubleTop: any | null;
    doubleBottom: any | null;
  };
  
  // Regime & Risk
  spyRegime: MarketRegime;
  spreadBps: number;
  advUsd: number; // Average daily volume in USD
  earningsDays: number | null; // Days until/after earnings (null if unknown)
}

// ===========================
// Strategy Output Types
// ===========================

export interface TriggerInfo {
  type: 'breakout' | 'breakdown' | 'limit' | 'market' | 'multi-bar';
  level?: number;
  description: string;
}

export interface TargetLevel {
  level: number;
  rr: number; // Risk/Reward ratio
  label?: string;
}

export interface TradePlan {
  direction: Direction;
  trigger: TriggerInfo;
  entry: number;
  stop: number;
  targets: TargetLevel[];
  invalidationRules: string[];
}

export interface HistoricalRecent {
  samples: number;
  hasMinSamples: boolean; // true if samples >= 10
  
  // Multi-horizon win rates
  winRate5d: number;
  winRate10d: number;
  winRate20d: number;
  
  // Multi-horizon average P&L
  avgPnL5d: number;
  avgPnL10d: number;
  avgPnL20d: number;
  
  // First-touch distribution
  firstTouchT1: number;  // Count hitting T1 first
  firstTouchT2: number;  // Count hitting T2 first
  firstTouchT3: number;  // Count hitting T3 first
  firstTouchStop: number; // Count hitting stop first
  avgDaysHeld: number;   // Average days until first touch
  
  // Data freshness
  dataLastRefreshedAt: Date;
  dataAgeHours: number;
  
  // Last signal tracking
  lastSignal?: {
    date: string;
    firstTouch: 'T1' | 'T2' | 'T3' | 'stop';
    daysHeld: number;
    pnl10d: number;
  };
  lastSignalNote?: string; // "No qualifying signals since <date>" or latest signal info
  
  // Quality flags
  isWeakHistory: boolean; // winRate10d < 0.20 OR avgPnL10d < 0
}

export interface HistoricalAnalog {
  hitRate: number;
  medianRet10d: number;
  evAfterCosts: number; // Expected value after costs
}

export interface StrategyEvaluation {
  symbol: string;
  timeframe: string;
  asOf: string;
  strategy: StrategyType;
  status: 'candidate' | 'ready' | 'no_trade' | 'blocked';
  
  plan: TradePlan | null;
  
  // Scoring
  quality: number; // 0-1
  viability: number; // 0-1, includes multipliers
  rrFirst: number; // Risk/reward of first target
  
  // Historical context
  historicalRecent?: HistoricalRecent;
  historical?: HistoricalAnalog;
  
  // Reasons
  reasons: string[]; // Why it qualifies or fails
  blockReason?: string; // If blocked
  
  // Metadata
  metadata: Record<string, any>;
}

// ===========================
// Multi-bar Confirmation State
// ===========================

export interface ConfirmationState {
  barsRequired: number;
  barsCompleted: number;
  conditions: string[];
  satisfied: boolean;
}

// ===========================
// Hard Block Result
// ===========================

export interface HardBlockResult {
  blocked: boolean;
  reason?: string;
}

// ===========================
// Multiplier Results
// ===========================

export interface MultiplierResult {
  volume: number;
  regime: number;
  combined: number;
}

// ===========================
// Strategy-Specific Contexts
// ===========================

export interface TriangleBreakoutContext {
  eligible: boolean;
  entry: number;
  stop: number;
  targets: TargetLevel[];
  quality: number;
  viability: number;
  confirmation: ConfirmationState;
  reasons: string[];
}

export interface FlagBreakoutContext {
  eligible: boolean;
  entry: number;
  stop: number;
  targets: TargetLevel[];
  quality: number;
  viability: number;
  confirmation: ConfirmationState;
  reasons: string[];
}

export interface DoubleTopShortContext {
  eligible: boolean;
  entry: number;
  stop: number;
  targets: TargetLevel[];
  quality: number;
  viability: number;
  confirmation: ConfirmationState;
  reasons: string[];
}

export interface TrendPullbackContext {
  eligible: boolean;
  entry: number;
  stop: number;
  targets: TargetLevel[];
  quality: number;
  viability: number;
  confirmation: ConfirmationState;
  reasons: string[];
}

export interface MeanReversionContext {
  eligible: boolean;
  entry: number;
  stop: number;
  targets: TargetLevel[];
  quality: number;
  viability: number;
  confirmation: ConfirmationState;
  reasons: string[];
  swingHigh: number;
}

export interface FailedBreakoutContext {
  eligible: boolean;
  entry: number;
  stop: number;
  targets: TargetLevel[];
  quality: number;
  viability: number;
  confirmation: ConfirmationState;
  reasons: string[];
  resistance: number;
}

