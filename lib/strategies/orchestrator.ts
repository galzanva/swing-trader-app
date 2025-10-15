/**
 * Strategy Orchestrator - Main Entry Point
 * Version 1.1 - Evaluates all strategies and returns best candidate
 */

import {
  StrategyInput,
  StrategyEvaluation,
  StrategyType,
  TradePlan,
  TargetLevel,
  Direction,
} from './types';
import {
  checkHardBlocks,
  validateMinimumRR,
} from './core-calculations';
import {
  evaluateTriangleBreakoutLong,
  evaluateFlagBreakoutLong,
  evaluateDoubleTopShort,
  evaluateTrendPullbackLong,
  evaluateMeanReversionShort,
  evaluateFailedBreakoutShort,
} from './evaluators';
import {
  getBacktestedHistorical,
} from './historical-context';

// ===========================
// Main Orchestrator
// ===========================

/**
 * Evaluate all strategies and return the best one
 * Returns null if no valid strategy found
 */
export async function evaluateAllStrategies(
  input: StrategyInput
): Promise<StrategyEvaluation | null> {
  // Check hard blocks first
  const hardBlock = checkHardBlocks(
    input.price,
    input.spreadBps,
    input.advUsd,
    input.earningsDays
  );
  
  if (hardBlock.blocked) {
    return {
      symbol: input.symbol,
      timeframe: input.timeframe,
      asOf: input.asOf,
      strategy: 'triangle_breakout_long', // Placeholder
      status: 'blocked',
      plan: null,
      quality: 0,
      viability: 0,
      rrFirst: 0,
      reasons: [],
      blockReason: hardBlock.reason,
      metadata: {},
    };
  }
  
  // Evaluate all strategies
  const evaluations: Array<{
    type: StrategyType;
    context: any;
  }> = [];
  
  // 1. Triangle Breakout - LONG
  const triangleCtx = evaluateTriangleBreakoutLong(input);
  if (triangleCtx?.eligible) {
    evaluations.push({
      type: 'triangle_breakout_long',
      context: triangleCtx,
    });
  }
  
  // 2. Flag Breakout - LONG
  const flagCtx = evaluateFlagBreakoutLong(input);
  if (flagCtx?.eligible) {
    evaluations.push({
      type: 'flag_breakout_long',
      context: flagCtx,
    });
  }
  
  // 3. Double Top - SHORT
  const doubleTopCtx = evaluateDoubleTopShort(input);
  if (doubleTopCtx?.eligible) {
    evaluations.push({
      type: 'double_top_short',
      context: doubleTopCtx,
    });
  }
  
  // 4. Trend Pullback - LONG (now with strict confirmations)
  const pullbackCtx = evaluateTrendPullbackLong(input);
  if (pullbackCtx?.eligible) {
    evaluations.push({
      type: 'trend_pullback_long',
      context: pullbackCtx,
    });
  }
  
  // 5. Mean Reversion - SHORT
  const meanRevCtx = evaluateMeanReversionShort(input);
  if (meanRevCtx?.eligible) {
    evaluations.push({
      type: 'mean_reversion_short',
      context: meanRevCtx,
    });
  }
  
  // 6. Failed Breakout - SHORT
  const failedCtx = evaluateFailedBreakoutShort(input);
  if (failedCtx?.eligible) {
    evaluations.push({
      type: 'failed_breakout_short',
      context: failedCtx,
    });
  }
  
  // No valid strategies
  if (evaluations.length === 0) {
    // Provide detailed reasons for why each strategy failed
    const failureReasons: string[] = [];
    
    if (!triangleCtx) failureReasons.push('Triangle Breakout: No triangle pattern detected');
    else if (!triangleCtx.eligible) failureReasons.push('Triangle Breakout: Eligibility criteria not met');
    
    if (!flagCtx) failureReasons.push('Flag Breakout: No flag pattern detected');
    else if (!flagCtx.eligible) failureReasons.push('Flag Breakout: Eligibility criteria not met');
    
    if (!doubleTopCtx) failureReasons.push('Double Top: No double top pattern detected');
    else if (!doubleTopCtx.eligible) failureReasons.push('Double Top: Eligibility criteria not met');
    
    if (!pullbackCtx) failureReasons.push('Trend Pullback: Not eligible (need uptrend + EMA proximity)');
    else if (!pullbackCtx.eligible) failureReasons.push('Trend Pullback: Eligibility criteria not met');
    
    if (!meanRevCtx) failureReasons.push('Mean Reversion: Not eligible (need overbought extension)');
    else if (!meanRevCtx.eligible) failureReasons.push('Mean Reversion: Eligibility criteria not met');
    
    if (!failedCtx) failureReasons.push('Failed Breakout: No failed breakout pattern detected');
    else if (!failedCtx.eligible) failureReasons.push('Failed Breakout: Eligibility criteria not met');
    
    return {
      symbol: input.symbol,
      timeframe: input.timeframe,
      asOf: input.asOf,
      strategy: 'triangle_breakout_long', // Placeholder
      status: 'no_trade',
      plan: null,
      quality: 0,
      viability: 0,
      rrFirst: 0,
      reasons: failureReasons.length > 0 ? failureReasons : ['No strategy eligibility criteria met'],
      metadata: {
        evaluatedStrategies: 6,
        eligibleFound: 0,
        emaAlignment: `${input.ema20 > input.ema50 && input.ema50 > input.ema200 ? 'Bullish' : input.ema20 < input.ema50 && input.ema50 < input.ema200 ? 'Bearish' : 'Mixed'}`,
        rsi: input.rsi14,
        volZ: input.volZ,
      },
    };
  }
  
  // Filter by minimum RR requirement (first target >= 1.5)
  const validEvaluations = evaluations.filter(ev => {
    const firstTarget = ev.context.targets[0];
    return validateMinimumRR(firstTarget.rr);
  });
  
  if (validEvaluations.length === 0) {
    return {
      symbol: input.symbol,
      timeframe: input.timeframe,
      asOf: input.asOf,
      strategy: evaluations[0].type,
      status: 'no_trade',
      plan: null,
      quality: 0,
      viability: 0,
      rrFirst: evaluations[0].context.targets[0].rr,
      reasons: ['All strategies failed minimum RR requirement (first target < 1.5)'],
      metadata: {},
    };
  }
  
  // Select best strategy by viability score
  validEvaluations.sort((a, b) => b.context.viability - a.context.viability);
  const best = validEvaluations[0];
  
  // Get historical context via BACKTESTING
  // This scans the actual historical bars for past occurrences of this pattern
  const historicalRecent = getBacktestedHistorical(best.type, input);
  
  // Global analog data - would need to run backtests across many tickers
  // For now, set to undefined (future enhancement)
  const historical = undefined;
  
  // Build trade plan
  const direction: Direction = best.type.includes('long') ? 'long' : 'short';
  
  const plan: TradePlan = {
    direction,
    trigger: {
      type: best.context.confirmation.barsRequired > 1 ? 'multi-bar' : 'breakout',
      level: best.context.entry,
      description: best.context.confirmation.conditions.join('; '),
    },
    entry: best.context.entry,
    stop: best.context.stop,
    targets: best.context.targets,
    invalidationRules: getInvalidationRules(best.type),
  };
  
  // Build detailed strategy evaluation summary
  const strategyDetails = evaluations.map(ev => ({
    strategy: ev.type,
    eligible: true,
    quality: ev.context.quality,
    viability: ev.context.viability,
    rrFirst: ev.context.targets[0].rr,
    status: ev.context.confirmation.satisfied ? 'ready' : 'candidate',
    reasons: ev.context.reasons.slice(0, 3), // Top 3 reasons
  }));

  // Build final evaluation
  const evaluation: StrategyEvaluation = {
    symbol: input.symbol,
    timeframe: input.timeframe,
    asOf: input.asOf,
    strategy: best.type,
    status: best.context.confirmation.satisfied ? 'ready' : 'candidate',
    plan,
    quality: best.context.quality,
    viability: best.context.viability,
    rrFirst: best.context.targets[0].rr,
    historicalRecent,
    historical,
    reasons: best.context.reasons,
    metadata: {
      confirmation: best.context.confirmation,
      allEvaluatedStrategies: evaluations.map(e => e.type),
      selectedReason: 'Highest viability score',
      strategyDetails, // Add detailed breakdown
      totalEvaluated: 6,
      eligibleFound: evaluations.length,
      passedRR: validEvaluations.length,
      patternContexts: input.patternContexts, // Add pattern contexts
      volZ: input.volZ, // Add volume Z-score for warnings
    },
  };
  
  return evaluation;
}

// ===========================
// Helper Functions
// ===========================

/**
 * Get invalidation rules for each strategy
 */
function getInvalidationRules(strategy: StrategyType): string[] {
  switch (strategy) {
    case 'triangle_breakout_long':
      return [
        'Daily close back inside triangle with rising volume',
        'Bearish engulfing below EMA20 within 3 bars post-entry',
      ];
    
    case 'flag_breakout_long':
      return [
        'Close below EMA20 on rising volume',
      ];
    
    case 'double_top_short':
      return [
        'Close above neckline with rising volume',
      ];
    
    case 'trend_pullback_long':
      return [
        'Break below stop loss (entry - 1.0×ATR)',
        'Close below EMA50 with momentum breakdown',
      ];
    
    case 'mean_reversion_short':
      return [
        'Break above swing high + 0.5×ATR',
        'New swing high formation with volume',
      ];
    
    case 'failed_breakout_short':
      return [
        'Break back above resistance + 0.5×ATR',
        'Volume-confirmed reclaim of breakout level',
      ];
    
    default:
      return ['Stop loss hit'];
  }
}

// ===========================
// Batch Scanning
// ===========================

/**
 * Scan multiple symbols and return ranked results
 */
export async function scanMultipleSymbols(
  inputs: StrategyInput[]
): Promise<StrategyEvaluation[]> {
  const results: StrategyEvaluation[] = [];
  
  for (const input of inputs) {
    const evaluation = await evaluateAllStrategies(input);
    if (evaluation && evaluation.status !== 'blocked' && evaluation.status !== 'no_trade') {
      results.push(evaluation);
    }
  }
  
  // Sort by viability (highest first)
  results.sort((a, b) => b.viability - a.viability);
  
  return results;
}

/**
 * Get strategy summary statistics
 */
export function getStrategySummary(evaluation: StrategyEvaluation): {
  risk: number;
  reward: number;
  rrRatio: number;
  positionSize: number;
} {
  if (!evaluation.plan) {
    return { risk: 0, reward: 0, rrRatio: 0, positionSize: 0 };
  }
  
  const { entry, stop, targets } = evaluation.plan;
  const direction = evaluation.plan.direction;
  
  const risk = direction === 'long' 
    ? entry - stop 
    : stop - entry;
  
  const reward = direction === 'long'
    ? targets[0].level - entry
    : entry - targets[0].level;
  
  const rrRatio = risk > 0 ? reward / risk : 0;
  
  // Position sizing based on viability (1% risk per 0.5 viability)
  const positionSize = Math.min(5, evaluation.viability * 2); // Max 5% position
  
  return {
    risk: Number(risk.toFixed(2)),
    reward: Number(reward.toFixed(2)),
    rrRatio: Number(rrRatio.toFixed(2)),
    positionSize: Number(positionSize.toFixed(2)),
  };
}

