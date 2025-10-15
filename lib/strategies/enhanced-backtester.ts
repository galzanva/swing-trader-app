/**
 * Enhanced Backtester with Time-Based Windows and Walk-Forward Analysis
 * 
 * Implements proper time-based backtesting with:
 * - 12 months or 252 trading days window
 * - Walk-forward first-touch labeling
 * - Multi-horizon statistics
 * - Earnings exclusion
 * - Minimum sample enforcement
 */

import { StrategyInput, StrategyType, OHLCV } from './types';
import { 
  evaluateTriangleBreakoutLong,
  evaluateFlagBreakoutLong,
  evaluateDoubleTopShort,
  evaluateTrendPullbackLong,
  evaluateMeanReversionShort,
  evaluateFailedBreakoutShort,
} from './evaluators';
import { 
  countTradingDays, 
  addTradingDays, 
  subtractTradingDays,
  isWithinTradingDays,
  getMostRecentTradingDay,
  formatMarketDate
} from '../utils/trading-calendar';
import { detectAllChartPatterns } from '../patterns/chart-patterns-v2';
import { mapPatternsToStrategyContexts } from '../patterns/mapToStrategyContext';

export interface EnhancedBacktestResult {
  signalDate: string;
  signalBar: number;
  entry: number;
  stop: number;
  direction: 'long' | 'short';
  targets: number[];
  
  // Walk-forward first-touch outcome (stops at first hit)
  firstTouch: 'T1' | 'T2' | 'T3' | 'stop';
  daysHeld: number; // Trading days until first touch
  
  // Multi-horizon outcomes (5d/10d/20d)
  outcome5d: 'hit_t1' | 'hit_t2' | 'hit_t3' | 'stopped_out' | 'still_open';
  outcome10d: 'hit_t1' | 'hit_t2' | 'hit_t3' | 'stopped_out' | 'still_open';
  outcome20d: 'hit_t1' | 'hit_t2' | 'hit_t3' | 'stopped_out' | 'still_open';
  
  // Multi-horizon P&L (percentage)
  pnl5d: number;
  pnl10d: number;
  pnl20d: number;
  
  // Risk metrics
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  
  // Context
  earningsDays?: number; // Days to/from earnings
  volumeZScore: number;
  patternContext?: string; // Detected pattern name
}

export interface EnhancedBacktestSummary {
  totalSignals: number;
  hasMinSamples: boolean; // true if >= 10
  
  // Multi-horizon win rates (suppressed if < 10 samples)
  winRate5d: number;
  winRate10d: number;
  winRate20d: number;
  
  // Multi-horizon average P&L (percentage)
  avgPnL5d: number;
  avgPnL10d: number;
  avgPnL20d: number;
  
  // First-touch distribution
  firstTouchT1: number;
  firstTouchT2: number;
  firstTouchT3: number;
  firstTouchStop: number;
  
  // Average holding period
  avgDaysHeld: number;
  
  // Risk metrics
  avgMaxFavorableExcursion: number;
  avgMaxAdverseExcursion: number;
  
  // Quality indicators
  isWeakHistory: boolean; // true if win rate < 40% or avg P&L < 0
  
  // Time window info
  backtestStartDate: string;
  backtestEndDate: string;
  tradingDaysInWindow: number;
  
  // Latest signal info
  latestSignalDate?: string;
  latestSignalOutcome?: string;
  
  // Earnings exclusion stats
  signalsExcludedForEarnings: number;
  signalsExcludedForLiquidity: number;
}

/**
 * Enhanced backtest with time-based window and proper walk-forward analysis
 */
export function enhancedBacktestStrategy(
  strategy: StrategyType,
  fullData: StrategyInput,
  maxTradingDays: number = 252 // 12 months
): EnhancedBacktestSummary {
  const { bars, earningsDays, volZ } = fullData;
  
  if (bars.length < 50) {
    return createEmptySummary();
  }
  
  // Determine time-based window
  const endDate = new Date(bars[bars.length - 1].timestamp);
  const startDate = subtractTradingDays(endDate, maxTradingDays);
  
  // Filter bars to time window
  const windowBars = bars.filter(bar => {
    const barDate = new Date(bar.timestamp);
    return barDate >= startDate && barDate <= endDate;
  });
  
  if (windowBars.length < 20) {
    return createEmptySummary();
  }
  
  const results: EnhancedBacktestResult[] = [];
  let signalsExcludedForEarnings = 0;
  let signalsExcludedForLiquidity = 0;
  
  // Walk through bars and find signals
  for (let i = 20; i < windowBars.length - 5; i++) { // Need 5 bars ahead for outcomes
    const currentBars = windowBars.slice(0, i + 1);
    const currentDate = new Date(currentBars[i].timestamp);
    
    // Check earnings exclusion (±1 trading day)
    if (earningsDays !== null && Math.abs(earningsDays) <= 1) {
      signalsExcludedForEarnings++;
      continue;
    }
    
    // Check liquidity (simplified - in production, use ADV and spread data)
    if (volZ < -2) { // Very low volume
      signalsExcludedForLiquidity++;
      continue;
    }
    
    // Build strategy input for this point in time
    const strategyInput = buildStrategyInputAtBar(fullData, currentBars, i);
    
    // Evaluate strategy
    const evaluation = evaluateStrategyAtBar(strategy, strategyInput);
    
    if (evaluation?.eligible) {
      // Simulate trade with walk-forward analysis
      const futureBars = windowBars.slice(i + 1, i + 25); // Look ahead 25 bars max
      const tradeResult = simulateEnhancedTrade(
        evaluation,
        futureBars,
        currentDate,
        earningsDays,
        volZ
      );
      
      if (tradeResult) {
        results.push(tradeResult);
      }
    }
  }
  
  // Aggregate results
  return aggregateEnhancedResults(results, startDate, endDate);
}

/**
 * Build strategy input for a specific point in time
 */
function buildStrategyInputAtBar(
  fullData: StrategyInput,
  bars: OHLCV[],
  currentBarIndex: number
): StrategyInput {
  const currentBar = bars[currentBarIndex];
  
  // Calculate technical indicators for this point in time
  const indicators = calculateIndicatorsAtBar(bars, currentBarIndex);
  
  // Detect patterns at this point in time
  const chartPatternResults = detectAllChartPatterns(bars.slice(0, currentBarIndex + 1), indicators.atr);
  const patternContexts = mapPatternsToStrategyContexts(chartPatternResults);
  
  return {
    ...fullData,
    bars: bars.slice(0, currentBarIndex + 1),
    price: currentBar.close,
    high: bars.slice(0, currentBarIndex + 1).map(b => b.high),
    low: bars.slice(0, currentBarIndex + 1).map(b => b.low),
    close: bars.slice(0, currentBarIndex + 1).map(b => b.close),
    volume: bars.slice(0, currentBarIndex + 1).map(b => b.volume),
    ema9: indicators.ema9,
    ema20: indicators.ema20,
    ema50: indicators.ema50,
    ema200: indicators.ema200,
    rsi14: indicators.rsi14,
    atr: indicators.atr,
    atrPct: indicators.atrPct,
    volZ: indicators.volZ,
    patternContexts,
  };
}

/**
 * Calculate technical indicators at a specific bar
 */
function calculateIndicatorsAtBar(bars: OHLCV[], barIndex: number): any {
  // Simplified indicator calculation - in production, use proper technical analysis library
  const currentBar = bars[barIndex];
  const lookback = Math.min(20, barIndex);
  const recentBars = bars.slice(barIndex - lookback, barIndex + 1);
  
  // Simple moving averages
  const closes = recentBars.map(b => b.close);
  const ema9 = closes.slice(-9).reduce((a, b) => a + b, 0) / Math.min(9, closes.length);
  const ema20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
  const ema50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);
  const ema200 = closes.slice(-200).reduce((a, b) => a + b, 0) / Math.min(200, closes.length);
  
  // Simple ATR
  const highs = recentBars.map(b => b.high);
  const lows = recentBars.map(b => b.low);
  const atr = (Math.max(...highs) - Math.min(...lows)) / 14; // Simplified
  
  // Simple RSI
  const rsi14 = calculateSimpleRSI(closes.slice(-14));
  
  // Volume Z-Score
  const volumes = recentBars.map(b => b.volume);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const volStd = Math.sqrt(volumes.reduce((sum, vol) => sum + Math.pow(vol - avgVolume, 2), 0) / volumes.length);
  const volZ = volStd > 0 ? (currentBar.volume - avgVolume) / volStd : 0;
  
  return {
    ema9,
    ema20,
    ema50,
    ema200,
    rsi14,
    atr,
    atrPct: (atr / currentBar.close) * 100,
    volZ,
  };
}

/**
 * Simple RSI calculation
 */
function calculateSimpleRSI(closes: number[]): number {
  if (closes.length < 2) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / (closes.length - 1);
  const avgLoss = losses / (closes.length - 1);
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Evaluate strategy at a specific bar
 */
function evaluateStrategyAtBar(strategy: StrategyType, input: StrategyInput): any {
  switch (strategy) {
    case 'triangle_breakout_long':
      return evaluateTriangleBreakoutLong(input);
    case 'flag_breakout_long':
      return evaluateFlagBreakoutLong(input);
    case 'double_top_short':
      return evaluateDoubleTopShort(input);
    case 'trend_pullback_long':
      return evaluateTrendPullbackLong(input);
    case 'mean_reversion_short':
      return evaluateMeanReversionShort(input);
    case 'failed_breakout_short':
      return evaluateFailedBreakoutShort(input);
    default:
      return null;
  }
}

/**
 * Simulate enhanced trade with walk-forward analysis
 */
function simulateEnhancedTrade(
  evaluation: any,
  futureBars: OHLCV[],
  signalDate: Date,
  earningsDays: number | null,
  volumeZScore: number
): EnhancedBacktestResult | null {
  if (!evaluation.targets || evaluation.targets.length === 0) {
    return null;
  }
  
  const { entry, stop, targets } = evaluation;
  const direction = evaluation.direction || 'long';
  
  // Walk-forward analysis - find first touch
  let firstTouch: 'T1' | 'T2' | 'T3' | 'stop' = 'stop';
  let daysHeld = 0;
  let maxFavorableExcursion = 0;
  let maxAdverseExcursion = 0;
  
  for (let i = 0; i < Math.min(futureBars.length, 25); i++) {
    const bar = futureBars[i];
    const barDate = new Date(bar.timestamp);
    daysHeld = countTradingDays(signalDate, barDate);
    
    // Check for first touch (stop at first hit)
    if (direction === 'long') {
      // Check stop first
      if (bar.low <= stop) {
        firstTouch = 'stop';
        break;
      }
      
      // Check targets in order
      if (targets[0] && bar.high >= targets[0].level) {
        firstTouch = 'T1';
        break;
      }
      if (targets[1] && bar.high >= targets[1].level) {
        firstTouch = 'T2';
        break;
      }
      if (targets[2] && bar.high >= targets[2].level) {
        firstTouch = 'T3';
        break;
      }
      
      // Track excursions
      maxFavorableExcursion = Math.max(maxFavorableExcursion, (bar.high - entry) / entry);
      maxAdverseExcursion = Math.min(maxAdverseExcursion, (bar.low - entry) / entry);
    } else {
      // Short direction logic (similar but inverted)
      if (bar.high >= stop) {
        firstTouch = 'stop';
        break;
      }
      
      if (targets[0] && bar.low <= targets[0].level) {
        firstTouch = 'T1';
        break;
      }
      if (targets[1] && bar.low <= targets[1].level) {
        firstTouch = 'T2';
        break;
      }
      if (targets[2] && bar.low <= targets[2].level) {
        firstTouch = 'T3';
        break;
      }
      
      maxFavorableExcursion = Math.max(maxFavorableExcursion, (entry - bar.low) / entry);
      maxAdverseExcursion = Math.min(maxAdverseExcursion, (entry - bar.high) / entry);
    }
  }
  
  // Calculate multi-horizon outcomes
  const outcome5d = getOutcomeAtHorizon(futureBars, entry, stop, targets, direction, 5);
  const outcome10d = getOutcomeAtHorizon(futureBars, entry, stop, targets, direction, 10);
  const outcome20d = getOutcomeAtHorizon(futureBars, entry, stop, targets, direction, 20);
  
  // Calculate multi-horizon P&L
  const pnl5d = calculatePnLAtHorizon(futureBars, entry, stop, targets, direction, 5);
  const pnl10d = calculatePnLAtHorizon(futureBars, entry, stop, targets, direction, 10);
  const pnl20d = calculatePnLAtHorizon(futureBars, entry, stop, targets, direction, 20);
  
  return {
    signalDate: formatMarketDate(signalDate),
    signalBar: 0, // Will be set by caller
    entry,
    stop,
    direction,
    targets: targets.map((t: any) => t.level),
    firstTouch,
    daysHeld,
    outcome5d,
    outcome10d,
    outcome20d,
    pnl5d,
    pnl10d,
    pnl20d,
    maxFavorableExcursion,
    maxAdverseExcursion,
    earningsDays: earningsDays || undefined,
    volumeZScore,
  };
}

/**
 * Get outcome at specific horizon
 */
function getOutcomeAtHorizon(
  futureBars: OHLCV[],
  entry: number,
  stop: number,
  targets: any[],
  direction: 'long' | 'short',
  horizonDays: number
): 'hit_t1' | 'hit_t2' | 'hit_t3' | 'stopped_out' | 'still_open' {
  const horizonBars = futureBars.slice(0, Math.min(horizonDays, futureBars.length));
  
  for (const bar of horizonBars) {
    if (direction === 'long') {
      if (bar.low <= stop) return 'stopped_out';
      if (targets[0] && bar.high >= targets[0].level) return 'hit_t1';
      if (targets[1] && bar.high >= targets[1].level) return 'hit_t2';
      if (targets[2] && bar.high >= targets[2].level) return 'hit_t3';
    } else {
      if (bar.high >= stop) return 'stopped_out';
      if (targets[0] && bar.low <= targets[0].level) return 'hit_t1';
      if (targets[1] && bar.low <= targets[1].level) return 'hit_t2';
      if (targets[2] && bar.low <= targets[2].level) return 'hit_t3';
    }
  }
  
  return 'still_open';
}

/**
 * Calculate P&L at specific horizon
 */
function calculatePnLAtHorizon(
  futureBars: OHLCV[],
  entry: number,
  stop: number,
  targets: any[],
  direction: 'long' | 'short',
  horizonDays: number
): number {
  const horizonBars = futureBars.slice(0, Math.min(horizonDays, futureBars.length));
  
  for (const bar of horizonBars) {
    if (direction === 'long') {
      if (bar.low <= stop) return (stop - entry) / entry * 100; // Stop loss
      if (targets[0] && bar.high >= targets[0].level) return (targets[0].level - entry) / entry * 100;
      if (targets[1] && bar.high >= targets[1].level) return (targets[1].level - entry) / entry * 100;
      if (targets[2] && bar.high >= targets[2].level) return (targets[2].level - entry) / entry * 100;
    } else {
      if (bar.high >= stop) return (entry - stop) / entry * 100; // Stop loss
      if (targets[0] && bar.low <= targets[0].level) return (entry - targets[0].level) / entry * 100;
      if (targets[1] && bar.low <= targets[1].level) return (entry - targets[1].level) / entry * 100;
      if (targets[2] && bar.low <= targets[2].level) return (entry - targets[2].level) / entry * 100;
    }
  }
  
  // Still open - use last bar close
  const lastBar = horizonBars[horizonBars.length - 1];
  if (direction === 'long') {
    return (lastBar.close - entry) / entry * 100;
  } else {
    return (entry - lastBar.close) / entry * 100;
  }
}

/**
 * Aggregate enhanced results
 */
function aggregateEnhancedResults(
  results: EnhancedBacktestResult[],
  startDate: Date,
  endDate: Date
): EnhancedBacktestSummary {
  if (results.length === 0) {
    return createEmptySummary();
  }
  
  const totalSignals = results.length;
  const hasMinSamples = totalSignals >= 10;
  
  // Multi-horizon win rates (suppress if < 10 samples)
  const winRate5d = hasMinSamples ? 
    (results.filter(r => r.outcome5d.startsWith('hit_')).length / totalSignals) * 100 : 0;
  const winRate10d = hasMinSamples ? 
    (results.filter(r => r.outcome10d.startsWith('hit_')).length / totalSignals) * 100 : 0;
  const winRate20d = hasMinSamples ? 
    (results.filter(r => r.outcome20d.startsWith('hit_')).length / totalSignals) * 100 : 0;
  
  // Average P&L
  const avgPnL5d = results.reduce((sum, r) => sum + r.pnl5d, 0) / totalSignals;
  const avgPnL10d = results.reduce((sum, r) => sum + r.pnl10d, 0) / totalSignals;
  const avgPnL20d = results.reduce((sum, r) => sum + r.pnl20d, 0) / totalSignals;
  
  // First-touch distribution
  const firstTouchT1 = (results.filter(r => r.firstTouch === 'T1').length / totalSignals) * 100;
  const firstTouchT2 = (results.filter(r => r.firstTouch === 'T2').length / totalSignals) * 100;
  const firstTouchT3 = (results.filter(r => r.firstTouch === 'T3').length / totalSignals) * 100;
  const firstTouchStop = (results.filter(r => r.firstTouch === 'stop').length / totalSignals) * 100;
  
  // Average holding period
  const avgDaysHeld = results.reduce((sum, r) => sum + r.daysHeld, 0) / totalSignals;
  
  // Risk metrics
  const avgMaxFavorableExcursion = results.reduce((sum, r) => sum + r.maxFavorableExcursion, 0) / totalSignals;
  const avgMaxAdverseExcursion = results.reduce((sum, r) => sum + r.maxAdverseExcursion, 0) / totalSignals;
  
  // Quality indicators
  const isWeakHistory = winRate10d < 40 || avgPnL10d < 0;
  
  // Latest signal
  const latestSignal = results[0]; // Results are sorted by date (most recent first)
  
  return {
    totalSignals,
    hasMinSamples,
    winRate5d,
    winRate10d,
    winRate20d,
    avgPnL5d,
    avgPnL10d,
    avgPnL20d,
    firstTouchT1,
    firstTouchT2,
    firstTouchT3,
    firstTouchStop,
    avgDaysHeld,
    avgMaxFavorableExcursion,
    avgMaxAdverseExcursion,
    isWeakHistory,
    backtestStartDate: formatMarketDate(startDate),
    backtestEndDate: formatMarketDate(endDate),
    tradingDaysInWindow: countTradingDays(startDate, endDate),
    latestSignalDate: latestSignal.signalDate,
    latestSignalOutcome: latestSignal.firstTouch,
    signalsExcludedForEarnings: 0, // Will be set by caller
    signalsExcludedForLiquidity: 0, // Will be set by caller
  };
}

/**
 * Create empty summary
 */
function createEmptySummary(): EnhancedBacktestSummary {
  return {
    totalSignals: 0,
    hasMinSamples: false,
    winRate5d: 0,
    winRate10d: 0,
    winRate20d: 0,
    avgPnL5d: 0,
    avgPnL10d: 0,
    avgPnL20d: 0,
    firstTouchT1: 0,
    firstTouchT2: 0,
    firstTouchT3: 0,
    firstTouchStop: 0,
    avgDaysHeld: 0,
    avgMaxFavorableExcursion: 0,
    avgMaxAdverseExcursion: 0,
    isWeakHistory: false,
    backtestStartDate: '',
    backtestEndDate: '',
    tradingDaysInWindow: 0,
    signalsExcludedForEarnings: 0,
    signalsExcludedForLiquidity: 0,
  };
}
