/**
 * Trade Simulation with Multi-Horizon and First-Touch Tracking
 * Extracted from backtester.ts for clarity
 */

import { OHLCV } from './types';
import { BacktestResult } from './backtester';

/**
 * Simulate a trade forward with multi-horizon tracking
 * Returns outcomes at 5d/10d/20d and first-touch result
 */
export function simulateTrade(
  bars: OHLCV[],
  signalBar: number,
  entry: number,
  stop: number,
  targets: number[],
  direction: 'long' | 'short'
): Omit<BacktestResult, 'signalDate' | 'signalBar' | 'entry' | 'stop' | 'direction' | 'targets'> {
  const maxBarsToTrack = 30;
  
  // Multi-horizon outcomes
  let outcome5d: any = 'still_open';
  let outcome10d: any = 'still_open';
  let outcome20d: any = 'still_open';
  
  // First-touch tracking
  let firstTouch: 'T1' | 'T2' | 'T3' | 'stop' | null = null;
  let daysHeld = 0;
  
  // Multi-horizon P&L
  let pnl5d = 0;
  let pnl10d = 0;
  let pnl20d = 0;
  
  let maxFavorable = 0;
  let maxAdverse = 0;
  
  // Walk forward bar-by-bar
  for (let i = signalBar + 1; i < Math.min(bars.length, signalBar + maxBarsToTrack + 1); i++) {
    const bar = bars[i];
    const daysFromSignal = i - signalBar;
    
    if (direction === 'long') {
      // Track excursions
      const favorable = (bar.high - entry) / entry * 100;
      const adverse = (bar.low - entry) / entry * 100;
      maxFavorable = Math.max(maxFavorable, favorable);
      maxAdverse = Math.min(maxAdverse, adverse);
      
      // Check first-touch (stop has priority)
      if (!firstTouch) {
        if (bar.low <= stop) {
          firstTouch = 'stop';
          daysHeld = daysFromSignal;
        } else if (targets[2] && bar.high >= targets[2]) {
          firstTouch = 'T3';
          daysHeld = daysFromSignal;
        } else if (targets[1] && bar.high >= targets[1]) {
          firstTouch = 'T2';
          daysHeld = daysFromSignal;
        } else if (targets[0] && bar.high >= targets[0]) {
          firstTouch = 'T1';
          daysHeld = daysFromSignal;
        }
      }
      
      // Calculate P&L and outcome at horizons
      if (daysFromSignal === 5) {
        pnl5d = (bar.close - entry) / entry * 100;
        outcome5d = determineOutcome(bar.close, entry, stop, targets, 'long');
      }
      if (daysFromSignal === 10) {
        pnl10d = (bar.close - entry) / entry * 100;
        outcome10d = determineOutcome(bar.close, entry, stop, targets, 'long');
      }
      if (daysFromSignal === 20) {
        pnl20d = (bar.close - entry) / entry * 100;
        outcome20d = determineOutcome(bar.close, entry, stop, targets, 'long');
      }
    } else {
      // Short trade
      const favorable = (entry - bar.low) / entry * 100;
      const adverse = (bar.high - entry) / entry * 100;
      maxFavorable = Math.max(maxFavorable, favorable);
      maxAdverse = Math.max(maxAdverse, adverse);
      
      // Check first-touch
      if (!firstTouch) {
        if (bar.high >= stop) {
          firstTouch = 'stop';
          daysHeld = daysFromSignal;
        } else if (targets[2] && bar.low <= targets[2]) {
          firstTouch = 'T3';
          daysHeld = daysFromSignal;
        } else if (targets[1] && bar.low <= targets[1]) {
          firstTouch = 'T2';
          daysHeld = daysFromSignal;
        } else if (targets[0] && bar.low <= targets[0]) {
          firstTouch = 'T1';
          daysHeld = daysFromSignal;
        }
      }
      
      // Calculate P&L at horizons
      if (daysFromSignal === 5) {
        pnl5d = (entry - bar.close) / entry * 100;
        outcome5d = determineOutcome(bar.close, entry, stop, targets, 'short');
      }
      if (daysFromSignal === 10) {
        pnl10d = (entry - bar.close) / entry * 100;
        outcome10d = determineOutcome(bar.close, entry, stop, targets, 'short');
      }
      if (daysFromSignal === 20) {
        pnl20d = (entry - bar.close) / entry * 100;
        outcome20d = determineOutcome(bar.close, entry, stop, targets, 'short');
      }
    }
  }
  
  // Default first-touch if none occurred
  if (!firstTouch) {
    firstTouch = 'T1';
    daysHeld = Math.min(30, bars.length - signalBar - 1);
  }
  
  return {
    outcome5d,
    outcome10d,
    outcome20d,
    firstTouch,
    daysHeld,
    pnl5d,
    pnl10d,
    pnl20d,
    maxFavorableExcursion: maxFavorable,
    maxAdverseExcursion: maxAdverse,
  };
}

/**
 * Determine outcome at specific price level
 */
function determineOutcome(
  price: number,
  entry: number,
  stop: number,
  targets: number[],
  direction: 'long' | 'short'
): 'hit_t1' | 'hit_t2' | 'hit_t3' | 'stopped_out' | 'still_open' {
  if (direction === 'long') {
    if (price <= stop) return 'stopped_out';
    if (targets[2] && price >= targets[2]) return 'hit_t3';
    if (targets[1] && price >= targets[1]) return 'hit_t2';
    if (targets[0] && price >= targets[0]) return 'hit_t1';
  } else {
    if (price >= stop) return 'stopped_out';
    if (targets[2] && price <= targets[2]) return 'hit_t3';
    if (targets[1] && price <= targets[1]) return 'hit_t2';
    if (targets[0] && price <= targets[0]) return 'hit_t1';
  }
  return 'still_open';
}

