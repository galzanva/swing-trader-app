/**
 * Historical Context via Enhanced Backtesting
 * 
 * Scans actual historical bars for past pattern occurrences and simulates trades
 * This provides ticker-specific and strategy-specific performance data with:
 * - Time-based windows (12 months/252 trading days)
 * - Walk-forward first-touch analysis
 * - Multi-horizon statistics
 * - Earnings exclusion
 * - Minimum sample enforcement
 */

import { HistoricalRecent, StrategyType, StrategyInput } from './types';
import { enhancedBacktestStrategy } from './enhanced-backtester';
import { getDataFreshnessInfo, formatDataAge } from '../data-vendors/data-freshness';
import { getMostRecentTradingDay, formatMarketDate } from '../utils/trading-calendar';

// ===========================
// Backtested Historical Data
// ===========================

/**
 * Get enhanced backtested historical performance by scanning actual historical bars
 * This finds where the pattern occurred in the past and simulates trades with proper time-based windows
 */
export function getBacktestedHistorical(
  strategy: StrategyType,
  fullData: StrategyInput
): HistoricalRecent {
  const { symbol, timeframe } = fullData;
  
  // Get data freshness info
  const freshnessInfo = getDataFreshnessInfo(symbol, timeframe);
  
  // Run enhanced backtest on the data (12 months or 252 trading days)
  const backtest = enhancedBacktestStrategy(strategy, fullData, 252);
  
  if (backtest.totalSignals === 0) {
    return {
      samples: 0,
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
      lastSignal: undefined,
      lastSignalNote: `No qualifying signals since ${backtest.backtestStartDate}`,
      dataLastRefreshedAt: freshnessInfo.dataLastRefreshedAt,
      dataAgeHours: freshnessInfo.dataAgeHours,
    };
  }
  
  // Convert enhanced backtest results to HistoricalRecent format
  return {
    samples: backtest.totalSignals,
    hasMinSamples: backtest.hasMinSamples,
    winRate5d: backtest.winRate5d,
    winRate10d: backtest.winRate10d,
    winRate20d: backtest.winRate20d,
    avgPnL5d: backtest.avgPnL5d / 100, // Convert from % to decimal
    avgPnL10d: backtest.avgPnL10d / 100,
    avgPnL20d: backtest.avgPnL20d / 100,
    firstTouchT1: backtest.firstTouchT1,
    firstTouchT2: backtest.firstTouchT2,
    firstTouchT3: backtest.firstTouchT3,
    firstTouchStop: backtest.firstTouchStop,
    avgDaysHeld: backtest.avgDaysHeld,
    isWeakHistory: backtest.isWeakHistory,
    lastSignal: backtest.latestSignalDate ? {
      date: backtest.latestSignalDate,
      firstTouch: backtest.latestSignalOutcome as 'T1' | 'T2' | 'T3' | 'stop',
      daysHeld: backtest.avgDaysHeld,
      pnl10d: backtest.avgPnL10d / 100, // Convert from % to decimal
    } : undefined,
    lastSignalNote: backtest.latestSignalDate ? 
      `Latest signal: ${backtest.latestSignalDate} (${backtest.latestSignalOutcome})` : 
      `No qualifying signals since ${backtest.backtestStartDate}`,
    dataLastRefreshedAt: freshnessInfo.dataLastRefreshedAt,
    dataAgeHours: freshnessInfo.dataAgeHours,
  };
}

/**
 * Format outcome for display
 */
function formatOutcome(outcome: string): string {
  switch (outcome) {
    case 'hit_t1': return 'Hit T1';
    case 'hit_t2': return 'Hit T2';
    case 'hit_t3': return 'Hit T3';
    case 'stopped_out': return 'Stopped Out';
    case 'still_open': return 'Still Open';
    default: return outcome;
  }
}
