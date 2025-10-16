/**
 * User Strategy Backtester
 * 
 * Backtest user-defined strategies on historical data
 * Implements same enhanced backtesting logic as core strategies
 */

import { StrategyInput, OHLCV, HistoricalRecent } from '../strategies/types';
import type { StrategyDsl } from './dsl-schema';
import { evaluateUserStrategy } from './evaluator';
import { 
  subtractTradingDays,
  formatMarketDate
} from '../utils/trading-calendar';
import { getDataFreshnessInfo } from '../data-vendors/data-freshness';
import { calculateTechnicalIndicators } from '../indicators/technical';

export interface UserStrategyBacktestResult {
  signalDate: string;
  signalBar: number;
  entry: number;
  stop: number;
  direction: 'long' | 'short';
  targets: number[];
  
  // Walk-forward first-touch outcome
  firstTouch: 'T1' | 'T2' | 'T3' | 'stop';
  daysHeld: number;
  
  // Multi-horizon outcomes
  outcome5d: 'hit_t1' | 'hit_t2' | 'hit_t3' | 'stopped_out' | 'still_open';
  outcome10d: 'hit_t1' | 'hit_t2' | 'hit_t3' | 'stopped_out' | 'still_open';
  outcome20d: 'hit_t1' | 'hit_t2' | 'hit_t3' | 'stopped_out' | 'still_open';
  
  // Multi-horizon P&L
  pnl5d: number;
  pnl10d: number;
  pnl20d: number;
  
  volumeZScore: number;
}

/**
 * Backtest a user-defined strategy on historical data
 */
export function backtestUserStrategy(
  dsl: StrategyDsl,
  fullData: StrategyInput,
  maxTradingDays: number = 252
): HistoricalRecent {
  const { bars, symbol, timeframe } = fullData;
  
  // Get data freshness
  const freshnessInfo = getDataFreshnessInfo(symbol, timeframe);
  
  if (bars.length < 50) {
    return createEmptyResult(freshnessInfo);
  }
  
  // Determine time-based window (last 12 months or 252 trading days)
  const endDate = new Date(bars[bars.length - 1].timestamp);
  const startDate = subtractTradingDays(endDate, maxTradingDays);
  
  // Filter bars to time window
  const windowBars = bars.filter(bar => {
    const barDate = new Date(bar.timestamp);
    return barDate >= startDate && barDate <= endDate;
  });
  
  if (windowBars.length < 20) {
    return createEmptyResult(freshnessInfo, formatMarketDate(startDate));
  }
  
  const results: UserStrategyBacktestResult[] = [];
  
  // Walk through bars and find signals
  for (let i = 50; i < windowBars.length - 5; i++) { // Need indicators + future bars
    const currentBars = windowBars.slice(0, i + 1);
    
    // Build strategy input for this point in time
    const strategyInput = buildStrategyInputAtBar(fullData, currentBars, i);
    
    if (!strategyInput) continue;
    
    // Evaluate user strategy
    const evaluation = evaluateUserStrategy(dsl, strategyInput);
    
    if (evaluation && evaluation.status === 'ready' && evaluation.plan) {
      // Simulate trade forward
      const futureBars = windowBars.slice(i + 1, i + 25); // Look ahead 25 bars max
      const tradeResult = simulateUserTrade(
        evaluation.plan.entry,
        evaluation.plan.stop,
        evaluation.plan.targets.map(t => t.level),
        evaluation.plan.direction,
        futureBars,
        new Date(currentBars[i].timestamp),
        strategyInput.volZ
      );
      
      if (tradeResult) {
        results.push(tradeResult);
      }
    }
  }
  
  // Aggregate results
  return aggregateUserResults(results, startDate, endDate, freshnessInfo);
}

/**
 * Build strategy input for a specific point in time
 */
function buildStrategyInputAtBar(
  fullData: StrategyInput,
  bars: OHLCV[],
  currentBarIndex: number
): StrategyInput | null {
  if (bars.length < 50) return null;
  
  const current = bars[bars.length - 1];
  
  // Calculate indicators for this point in time
  const indicators = calculateTechnicalIndicators(bars);
  
  return {
    symbol: fullData.symbol,
    timeframe: fullData.timeframe,
    asOf: new Date(current.timestamp).toISOString(),
    price: current.close,
    bars,
    high: bars.map(b => b.high),
    low: bars.map(b => b.low),
    close: bars.map(b => b.close),
    volume: bars.map(b => b.volume),
    ema9: indicators.ema9,
    ema20: indicators.ema20,
    ema50: indicators.ema50,
    ema200: indicators.ema200,
    rsi14: indicators.rsi,
    atr: indicators.atr,
    atrPct: (indicators.atr / current.close) * 100,
    volZ: indicators.volumeZScore,
    spyRegime: fullData.spyRegime,
    earningsDays: fullData.earningsDays,
    spreadBps: fullData.spreadBps || 0,
    advUsd: fullData.advUsd || 0,
    patternContexts: undefined, // Simplified for now
  };
}

/**
 * Simulate a trade forward and determine outcomes
 */
function simulateUserTrade(
  entry: number,
  stop: number,
  targets: number[],
  direction: 'long' | 'short',
  futureBars: OHLCV[],
  signalDate: Date,
  volumeZScore: number
): UserStrategyBacktestResult | null {
  if (futureBars.length < 5) return null;
  
  // Walk-forward first-touch analysis
  let firstTouch: 'T1' | 'T2' | 'T3' | 'stop' | null = null;
  let daysHeld = 0;
  
  for (let day = 0; day < futureBars.length; day++) {
    const bar = futureBars[day];
    daysHeld = day + 1;
    
    // Check stop first
    if (direction === 'long') {
      if (bar.low <= stop) {
        firstTouch = 'stop';
        break;
      }
      // Check targets
      for (let t = 0; t < targets.length; t++) {
        if (bar.high >= targets[t]) {
          firstTouch = (t === 0 ? 'T1' : t === 1 ? 'T2' : 'T3') as 'T1' | 'T2' | 'T3';
          break;
        }
      }
    } else { // short
      if (bar.high >= stop) {
        firstTouch = 'stop';
        break;
      }
      // Check targets
      for (let t = 0; t < targets.length; t++) {
        if (bar.low <= targets[t]) {
          firstTouch = (t === 0 ? 'T1' : t === 1 ? 'T2' : 'T3') as 'T1' | 'T2' | 'T3';
          break;
        }
      }
    }
    
    if (firstTouch) break;
  }
  
  // If no touch occurred, mark as still open
  if (!firstTouch) {
    firstTouch = 'stop'; // Conservative - assume it would have stopped out
    daysHeld = futureBars.length;
  }
  
  // Multi-horizon outcomes
  const outcome5d = getOutcomeAtHorizon(futureBars, entry, stop, targets, direction, 5);
  const outcome10d = getOutcomeAtHorizon(futureBars, entry, stop, targets, direction, 10);
  const outcome20d = getOutcomeAtHorizon(futureBars, entry, stop, targets, direction, 20);
  
  // Calculate P&L
  const pnl5d = calculatePnL(futureBars, entry, stop, targets, direction, 5);
  const pnl10d = calculatePnL(futureBars, entry, stop, targets, direction, 10);
  const pnl20d = calculatePnL(futureBars, entry, stop, targets, direction, 20);
  
  return {
    signalDate: formatMarketDate(signalDate),
    signalBar: 0, // Not used for now
    entry,
    stop,
    direction,
    targets,
    firstTouch,
    daysHeld,
    outcome5d,
    outcome10d,
    outcome20d,
    pnl5d,
    pnl10d,
    pnl20d,
    volumeZScore,
  };
}

/**
 * Get outcome at a specific horizon (5d/10d/20d)
 */
function getOutcomeAtHorizon(
  futureBars: OHLCV[],
  entry: number,
  stop: number,
  targets: number[],
  direction: 'long' | 'short',
  horizon: number
): 'hit_t1' | 'hit_t2' | 'hit_t3' | 'stopped_out' | 'still_open' {
  const barsToCheck = futureBars.slice(0, Math.min(horizon, futureBars.length));
  
  if (barsToCheck.length === 0) return 'still_open';
  
  // Check what happened within this horizon
  let hitStop = false;
  let hitT1 = false;
  let hitT2 = false;
  let hitT3 = false;
  
  for (const bar of barsToCheck) {
    if (direction === 'long') {
      if (bar.low <= stop) hitStop = true;
      if (targets[0] && bar.high >= targets[0]) hitT1 = true;
      if (targets[1] && bar.high >= targets[1]) hitT2 = true;
      if (targets[2] && bar.high >= targets[2]) hitT3 = true;
    } else {
      if (bar.high >= stop) hitStop = true;
      if (targets[0] && bar.low <= targets[0]) hitT1 = true;
      if (targets[1] && bar.low <= targets[1]) hitT2 = true;
      if (targets[2] && bar.low <= targets[2]) hitT3 = true;
    }
  }
  
  if (hitStop) return 'stopped_out';
  if (hitT3) return 'hit_t3';
  if (hitT2) return 'hit_t2';
  if (hitT1) return 'hit_t1';
  
  return 'still_open';
}

/**
 * Calculate P&L at a specific horizon
 */
function calculatePnL(
  futureBars: OHLCV[],
  entry: number,
  stop: number,
  targets: number[],
  direction: 'long' | 'short',
  horizon: number
): number {
  const outcome = getOutcomeAtHorizon(futureBars, entry, stop, targets, direction, horizon);
  const risk = Math.abs(entry - stop);
  
  if (outcome === 'stopped_out') {
    return -100 * (risk / entry); // Loss as percentage
  }
  
  if (outcome === 'hit_t1') {
    const reward = Math.abs(targets[0] - entry);
    return direction === 'long' 
      ? 100 * (reward / entry)
      : -100 * (reward / entry);
  }
  
  if (outcome === 'hit_t2') {
    const reward = Math.abs(targets[1] - entry);
    return direction === 'long'
      ? 100 * (reward / entry)
      : -100 * (reward / entry);
  }
  
  if (outcome === 'hit_t3' && targets[2]) {
    const reward = Math.abs(targets[2] - entry);
    return direction === 'long'
      ? 100 * (reward / entry)
      : -100 * (reward / entry);
  }
  
  return 0; // Still open
}

/**
 * Aggregate results into HistoricalRecent format
 */
function aggregateUserResults(
  results: UserStrategyBacktestResult[],
  startDate: Date,
  endDate: Date,
  freshnessInfo: { dataLastRefreshedAt: Date; dataAgeHours: number }
): HistoricalRecent {
  const totalSignals = results.length;
  
  if (totalSignals === 0) {
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
      lastSignalNote: `No qualifying signals since ${formatMarketDate(startDate)}`,
      dataLastRefreshedAt: freshnessInfo.dataLastRefreshedAt,
      dataAgeHours: freshnessInfo.dataAgeHours,
    };
  }
  
  const hasMinSamples = totalSignals >= 10;
  
  // Calculate multi-horizon win rates
  const wins5d = results.filter(r => r.pnl5d > 0).length;
  const wins10d = results.filter(r => r.pnl10d > 0).length;
  const wins20d = results.filter(r => r.pnl20d > 0).length;
  
  const winRate5d = Math.min(100, (wins5d / totalSignals) * 100);
  const winRate10d = Math.min(100, (wins10d / totalSignals) * 100);
  const winRate20d = Math.min(100, (wins20d / totalSignals) * 100);
  
  // Calculate average P&L
  const avgPnL5d = results.reduce((sum, r) => sum + r.pnl5d, 0) / totalSignals;
  const avgPnL10d = results.reduce((sum, r) => sum + r.pnl10d, 0) / totalSignals;
  const avgPnL20d = results.reduce((sum, r) => sum + r.pnl20d, 0) / totalSignals;
  
  // First-touch distribution
  const firstTouchT1 = results.filter(r => r.firstTouch === 'T1').length;
  const firstTouchT2 = results.filter(r => r.firstTouch === 'T2').length;
  const firstTouchT3 = results.filter(r => r.firstTouch === 'T3').length;
  const firstTouchStop = results.filter(r => r.firstTouch === 'stop').length;
  
  // Average days held
  const avgDaysHeld = results.reduce((sum, r) => sum + r.daysHeld, 0) / totalSignals;
  
  // Determine if weak history
  const isWeakHistory = winRate10d < 40 || avgPnL10d < 0;
  
  // Get most recent signal
  const sortedResults = [...results].sort((a, b) => 
    new Date(b.signalDate).getTime() - new Date(a.signalDate).getTime()
  );
  const mostRecent = sortedResults[0];
  
  return {
    samples: totalSignals,
    hasMinSamples,
    winRate5d: Number(winRate5d.toFixed(1)),
    winRate10d: Number(winRate10d.toFixed(1)),
    winRate20d: Number(winRate20d.toFixed(1)),
    avgPnL5d: Number(avgPnL5d.toFixed(1)),
    avgPnL10d: Number(avgPnL10d.toFixed(1)),
    avgPnL20d: Number(avgPnL20d.toFixed(1)),
    firstTouchT1,
    firstTouchT2,
    firstTouchT3,
    firstTouchStop,
    avgDaysHeld: Number(avgDaysHeld.toFixed(1)),
    isWeakHistory,
    lastSignal: mostRecent ? {
      date: mostRecent.signalDate,
      firstTouch: mostRecent.firstTouch,
      daysHeld: mostRecent.daysHeld,
      pnl10d: mostRecent.pnl10d,
    } : undefined,
    dataLastRefreshedAt: freshnessInfo.dataLastRefreshedAt,
    dataAgeHours: freshnessInfo.dataAgeHours,
  };
}

/**
 * Create empty result when no data available
 */
function createEmptyResult(
  freshnessInfo: { dataLastRefreshedAt: Date; dataAgeHours: number },
  startDate?: string
): HistoricalRecent {
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
    lastSignalNote: startDate 
      ? `No qualifying signals since ${startDate}`
      : 'Insufficient historical data',
    dataLastRefreshedAt: freshnessInfo.dataLastRefreshedAt,
    dataAgeHours: freshnessInfo.dataAgeHours,
  };
}

