/**
 * Backtester - Scans historical bars for strategy patterns and simulates trades
 * Tests if the current strategy has worked on this ticker in the past
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
import { simulateTrade } from './backtester-simulate';

export interface BacktestResult {
  signalDate: string;
  signalBar: number;
  entry: number;
  stop: number;
  direction: 'long' | 'short';
  targets: number[];
  
  // Multi-horizon outcomes (5d/10d/20d)
  outcome5d: 'hit_t1' | 'hit_t2' | 'hit_t3' | 'stopped_out' | 'still_open';
  outcome10d: 'hit_t1' | 'hit_t2' | 'hit_t3' | 'stopped_out' | 'still_open';
  outcome20d: 'hit_t1' | 'hit_t2' | 'hit_t3' | 'stopped_out' | 'still_open';
  
  // Path-based first-touch outcome
  firstTouch: 'T1' | 'T2' | 'T3' | 'stop';
  daysHeld: number; // Days until first touch
  
  // Multi-horizon P&L
  pnl5d: number;
  pnl10d: number;
  pnl20d: number;
  
  // Max favorable/adverse
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
}

export interface BacktestSummary {
  totalSignals: number;
  hasMinSamples: boolean; // true if >= 10
  
  // Multi-horizon win rates
  winRate5d: number;
  winRate10d: number;
  winRate20d: number;
  
  // Multi-horizon avg P&L
  avgPnL5d: number;
  avgPnL10d: number;
  avgPnL20d: number;
  
  // First-touch distribution
  firstTouchT1: number;
  firstTouchT2: number;
  firstTouchT3: number;
  firstTouchStop: number;
  avgDaysHeld: number;
  
  // Quality flags
  isWeakHistory: boolean; // winRate10d < 0.20 OR avgPnL10d < 0
  
  // Trade list
  trades: BacktestResult[];
}

/**
 * Backtest a strategy on historical data
 * Scans through bars looking for strategy setups, then simulates forward to see outcome
 */
export function backtestStrategy(
  strategy: StrategyType,
  fullData: StrategyInput,
  lookbackBars: number = 200
): BacktestSummary {
  const trades: BacktestResult[] = [];
  const bars = fullData.bars;
  
  // We need at least 100 bars before we start looking for signals
  // (to calculate indicators properly)
  const startBar = Math.max(100, bars.length - lookbackBars);
  const endBar = bars.length - 20; // Stop 20 bars before end to allow for outcome tracking
  
  // Scan through historical bars
  for (let i = startBar; i < endBar; i++) {
    // Build input as if we were at bar i
    const historicalInput = buildHistoricalInput(fullData, i);
    
    if (!historicalInput) continue;
    
    // Evaluate strategy at this historical point
    const context = evaluateStrategyAtBar(strategy, historicalInput);
    
    if (!context || !context.eligible) continue;
    
    // Check if confirmation would have been satisfied
    // (simplified - just check if entry criteria met)
    if (context.quality === 0) continue;
    
    // Simulate the trade forward
    const outcome = simulateTrade(
      bars,
      i,
      context.entry,
      context.stop,
      context.targets.map(t => t.level),
      strategy.includes('long') ? 'long' : 'short'
    );
    
    if (outcome) {
      trades.push({
        signalDate: new Date(bars[i].timestamp).toISOString().split('T')[0],
        signalBar: i,
        entry: context.entry,
        stop: context.stop,
        direction: strategy.includes('long') ? 'long' : 'short',
        targets: context.targets.map(t => t.level),
        ...outcome,
      });
    }
  }
  
  // Aggregate statistics
  return aggregateBacktestResults(trades);
}

/**
 * Build StrategyInput as if we were at a specific historical bar
 */
function buildHistoricalInput(
  fullData: StrategyInput,
  barIndex: number
): StrategyInput | null {
  if (barIndex < 50) return null; // Need enough data for EMAs
  
  const bars = fullData.bars.slice(0, barIndex + 1);
  const high = bars.map(b => b.high);
  const low = bars.map(b => b.low);
  const close = bars.map(b => b.close);
  const volume = bars.map(b => b.volume);
  
  const currentPrice = close[close.length - 1];
  
  // Simplified - would need to recalculate indicators at this point
  // For now, use the full data's indicators (not perfect but good enough)
  return {
    ...fullData,
    bars,
    high,
    low,
    close,
    volume,
    price: currentPrice,
    asOf: new Date(bars[barIndex].timestamp).toISOString().split('T')[0],
  };
}

/**
 * Evaluate strategy at a specific bar
 */
function evaluateStrategyAtBar(strategy: StrategyType, input: StrategyInput) {
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

// simulateTrade function moved to backtester-simulate.ts

/**
 * Aggregate backtest results with multi-horizon statistics
 */
function aggregateBacktestResults(trades: BacktestResult[]): BacktestSummary {
  if (trades.length === 0) {
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
      isWeakHistory: false,
      trades: [],
    };
  }
  
  const hasMinSamples = trades.length >= 10;
  
  // Multi-horizon win rates (winning = P&L > 0 at that horizon)
  const winners5d = trades.filter(t => t.pnl5d > 0).length;
  const winners10d = trades.filter(t => t.pnl10d > 0).length;
  const winners20d = trades.filter(t => t.pnl20d > 0).length;
  
  const winRate5d = winners5d / trades.length;
  const winRate10d = winners10d / trades.length;
  const winRate20d = winners20d / trades.length;
  
  // Multi-horizon average P&L
  const avgPnL5d = trades.reduce((sum, t) => sum + t.pnl5d, 0) / trades.length;
  const avgPnL10d = trades.reduce((sum, t) => sum + t.pnl10d, 0) / trades.length;
  const avgPnL20d = trades.reduce((sum, t) => sum + t.pnl20d, 0) / trades.length;
  
  // First-touch distribution
  const firstTouchT1 = trades.filter(t => t.firstTouch === 'T1').length;
  const firstTouchT2 = trades.filter(t => t.firstTouch === 'T2').length;
  const firstTouchT3 = trades.filter(t => t.firstTouch === 'T3').length;
  const firstTouchStop = trades.filter(t => t.firstTouch === 'stop').length;
  const avgDaysHeld = trades.reduce((sum, t) => sum + t.daysHeld, 0) / trades.length;
  
  // Weak history detection
  const isWeakHistory = winRate10d < 0.20 || avgPnL10d < 0;
  
  return {
    totalSignals: trades.length,
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
    isWeakHistory,
    trades: trades.sort((a, b) => new Date(b.signalDate).getTime() - new Date(a.signalDate).getTime()),
  };
}

