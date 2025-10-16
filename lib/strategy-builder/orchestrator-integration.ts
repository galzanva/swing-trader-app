/**
 * Orchestrator Integration for User Strategies
 * 
 * Evaluates user-defined strategies first, then falls back to core strategies
 */

import type { StrategyInput, StrategyEvaluation } from '../strategies/types';
import { evaluateAllStrategies } from '../strategies/orchestrator';
import { evaluateUserStrategy } from './evaluator';
import { getUserStrategies, trackStrategyUsage } from './repository';
import { getBacktestedHistorical } from '../strategies/historical-context';
import type { StrategyDsl } from './dsl-schema';

/**
 * Helper to get eligibility failure reason for a user strategy
 * Returns the FIRST criterion that fails, in order of priority
 */
function checkUserStrategyEligibility(
  dsl: StrategyDsl,
  input: StrategyInput
): { eligible: boolean; reason: string } {
  const { eligibility } = dsl;
  
  if (!eligibility) {
    return { eligible: true, reason: 'No eligibility criteria' };
  }
  
  // Check EMA rules FIRST (fundamental trend requirement)
  if (eligibility.emaRules && eligibility.emaRules.length > 0) {
    for (const rule of eligibility.emaRules) {
      const ema1 = rule.ema1 === 9 ? input.ema9 : 
                   rule.ema1 === 20 ? input.ema20 : 
                   rule.ema1 === 50 ? input.ema50 : 
                   rule.ema1 === 200 ? input.ema200 : undefined;
      const ema2 = rule.ema2 === 9 ? input.ema9 : 
                   rule.ema2 === 20 ? input.ema20 : 
                   rule.ema2 === 50 ? input.ema50 : 
                   rule.ema2 === 200 ? input.ema200 : undefined;
      
      if (ema1 === undefined || ema2 === undefined) continue;
      
      let passes = false;
      switch (rule.operator) {
        case '>': passes = ema1 > ema2; break;
        case '<': passes = ema1 < ema2; break;
        case '>=': passes = ema1 >= ema2; break;
        case '<=': passes = ema1 <= ema2; break;
        case '==': passes = Math.abs(ema1 - ema2) < 0.01; break;
      }
      
      if (!passes) {
        return { eligible: false, reason: `EMA${rule.ema1} ${rule.operator} EMA${rule.ema2} (${ema1.toFixed(2)} vs ${ema2.toFixed(2)})` };
      }
    }
  }
  
  // Check RSI range SECOND
  if (eligibility.rsiRange) {
    const rsi = input.rsi14;
    const { min, max } = eligibility.rsiRange;
    if (rsi < min || rsi > max) {
      return { eligible: false, reason: `RSI ${rsi.toFixed(1)} outside [${min}–${max}]` };
    }
  }
  
  // Check multi-bar condition THIRD
  if (eligibility.multiBarCondition) {
    const { count, direction, minLevel } = eligibility.multiBarCondition;
    const dirLabel = direction === 'down' ? 'bearish' : direction === 'up' ? 'bullish' : '';
    const levelInfo = minLevel ? ` above ${minLevel}` : '';
    return { eligible: false, reason: `Need ${count} ${dirLabel} bars${levelInfo}` };
  }
  
  // Check volume rule
  if (eligibility.volumeRule) {
    const { threshold, operator, type } = eligibility.volumeRule;
    const volValue = type === 'z-score' ? input.volZ : 0; // Simplified
    let passes = false;
    switch (operator) {
      case '>=': passes = volValue >= threshold; break;
      case '>': passes = volValue > threshold; break;
      case '<=': passes = volValue <= threshold; break;
      case '<': passes = volValue < threshold; break;
    }
    if (!passes) {
      return { eligible: false, reason: `Volume ${volValue.toFixed(2)} ${operator} ${threshold}` };
    }
  }
  
  // Check candle pattern LAST
  if (eligibility.candlePattern) {
    const bars = input.bars;
    if (bars.length < 2) {
      return { eligible: false, reason: 'Insufficient bars' };
    }
    const patternName = eligibility.candlePattern.name.replace(/_/g, ' ');
    return { eligible: false, reason: `No ${patternName} found` };
  }
  
  return { eligible: false, reason: 'Not eligible' };
}

/**
 * Evaluate user strategies + core strategies
 * User strategies are prioritized (evaluated first)
 */
export async function evaluateAllStrategiesWithUser(
  input: StrategyInput,
  userId?: string
): Promise<StrategyEvaluation | null> {
  // If no user ID, fall back to core strategies only
  if (!userId) {
    return evaluateAllStrategies(input);
  }

  try {
    // Get user's active strategies
    const userStrategies = await getUserStrategies(userId, true);
    console.log(`[User Strategies] Found ${userStrategies.length} active strategies for user ${userId}`);

    // Evaluate user strategies first
    const userEvaluations: StrategyEvaluation[] = [];
    
    for (const strategy of userStrategies) {
      console.log(`[User Strategies] Evaluating strategy: ${strategy.name} (${strategy.id})`);
      const evaluation = evaluateUserStrategy(strategy.dsl, input, strategy.id);
      
      if (evaluation) {
        console.log(`[User Strategies] ✅ Strategy ${strategy.name} qualified with viability ${evaluation.viability}`);
      } else {
        console.log(`[User Strategies] ❌ Strategy ${strategy.name} did not qualify`);
      }
      
      if (evaluation) {
        // Add historical context for user strategy via backtesting
        try {
          const { backtestUserStrategy } = await import('./user-strategy-backtester');
          evaluation.historicalRecent = backtestUserStrategy(strategy.dsl, input, 252);
          console.log(`[User Strategies] Backtested ${strategy.name}: ${evaluation.historicalRecent.samples} signals found`);
        } catch (err) {
          console.error('Failed to backtest user strategy:', err);
          // Fallback to empty historical context
          evaluation.historicalRecent = {
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
            dataLastRefreshedAt: new Date(),
            dataAgeHours: 0,
            lastSignalNote: 'Backtesting error',
          };
        }
        
        userEvaluations.push(evaluation);
      }
    }

    // If we have qualifying user strategies, return the best one
    if (userEvaluations.length > 0) {
      // Sort by viability (highest first)
      userEvaluations.sort((a, b) => b.viability - a.viability);
      const bestUserStrategy = userEvaluations[0];
      
      // Track usage
      const strategyId = bestUserStrategy.metadata?.userStrategyId;
      if (strategyId) {
        trackStrategyUsage(strategyId).catch(err => 
          console.error('Failed to track strategy usage:', err)
        );
      }
      
      return bestUserStrategy;
    }

    // User strategies didn't qualify - evaluate core strategies
    const coreResult = await evaluateAllStrategies(input);
    
    // If core strategies also return no_trade, add user strategy failure reasons
    if (coreResult && coreResult.status === 'no_trade' && userStrategies.length > 0) {
      // Prepend user strategy failure reasons to the core reasons
      const userFailureReasons = userStrategies.map(strategy => {
        const strategyName = strategy.name;
        // Try to get the actual failure reason from our evaluation attempt
        const evaluation = evaluateUserStrategy(strategy.dsl, input, strategy.id);
        if (!evaluation) {
          // Strategy failed eligibility - get the reason
          const eligibilityCheck = checkUserStrategyEligibility(strategy.dsl, input);
          return `${strategyName}: ${eligibilityCheck.reason}`;
        }
        return null;
      }).filter(Boolean);
      
      // Combine user strategy reasons with core strategy reasons
      coreResult.reasons = [...(userFailureReasons as string[]), ...coreResult.reasons];
    }
    
    return coreResult;
  } catch (error) {
    console.error('Error evaluating user strategies:', error);
    // Fall back to core strategies on error
    return evaluateAllStrategies(input);
  }
}

/**
 * Evaluate a specific user strategy by ID
 */
export async function evaluateUserStrategyById(
  strategyId: string,
  userId: string,
  input: StrategyInput
): Promise<StrategyEvaluation | null> {
  try {
    const strategies = await getUserStrategies(userId, false);
    const strategy = strategies.find(s => s.id === strategyId);
    
    if (!strategy) {
      return null;
    }

    const evaluation = evaluateUserStrategy(strategy.dsl, input, strategy.id);
    
    if (evaluation) {
      // Add historical context via backtesting
      try {
        const { backtestUserStrategy } = await import('./user-strategy-backtester');
        evaluation.historicalRecent = backtestUserStrategy(strategy.dsl, input, 252);
        console.log(`[User Strategy] Backtested ${strategy.name}: ${evaluation.historicalRecent.samples} signals found`);
      } catch (err) {
        console.error('Failed to backtest user strategy:', err);
        // Fallback to empty historical context
        evaluation.historicalRecent = {
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
          dataLastRefreshedAt: new Date(),
          dataAgeHours: 0,
          lastSignalNote: 'Backtesting error',
        };
      }
      
      // Track usage
      trackStrategyUsage(strategyId).catch(err => 
        console.error('Failed to track strategy usage:', err)
      );
    }
    
    return evaluation;
  } catch (error) {
    console.error('Error evaluating user strategy:', error);
    return null;
  }
}
