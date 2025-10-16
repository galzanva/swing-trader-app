/**
 * User Strategy Evaluator
 * 
 * Evaluates user-defined strategies using the DSL against market data
 */

import type { StrategyInput, StrategyEvaluation } from '../strategies/types';
import type { StrategyDsl, EmaRule, CandlePattern as DslCandlePattern } from './dsl-schema';
import { evaluateExpression, type EvaluationContext } from './expression-evaluator';
import { calculateRR, isBullishEngulfing, isHammer } from '../strategies/core-calculations';

/**
 * Evaluate a user-defined strategy
 */
export function evaluateUserStrategy(
  dsl: StrategyDsl,
  input: StrategyInput,
  strategyId?: string
): StrategyEvaluation | null {
  // Build evaluation context
  const context: EvaluationContext = {
    price: input.price,
    high: input.bars.map(b => b.high),
    low: input.bars.map(b => b.low),
    close: input.bars.map(b => b.close),
    open: input.bars.map(b => b.open),
    ema9: input.ema9,
    ema20: input.ema20,
    ema50: input.ema50,
    ema200: input.ema200,
    rsi14: input.rsi14,
    atr: input.atr,
    volZ: input.volZ,
  };
  
  // Check eligibility
  const eligibilityCheck = checkEligibility(dsl, input, context);
  if (!eligibilityCheck.eligible) {
    console.log(`[Evaluator] Strategy "${dsl.name}" failed eligibility:`, eligibilityCheck.reasons);
    return null; // Strategy not eligible
  }
  console.log(`[Evaluator] Strategy "${dsl.name}" passed eligibility:`, eligibilityCheck.reasons);
  
  // Calculate entry, stop, targets
  try {
    const entry = evaluateExpression(dsl.trigger.level, context);
    context.entry = entry; // Add entry to context for target/stop calculations
    
    const stop = evaluateExpression(dsl.stop.value, context);
    context.stop = stop;
    
    const targets = dsl.targets.map((t, i) => {
      const level = evaluateExpression(t.level, context);
      const rr = calculateRR(dsl.direction, entry, stop, level);
      return {
        level: Number(level.toFixed(2)),
        rr,
        label: t.label || `T${i + 1}`,
      };
    });
    
    // Validate minimum R:R
    const minRR = dsl.riskManagement?.minRR || 1.5;
    const rrFirst = targets[0]?.rr || 0;
    if (rrFirst < minRR) {
      return null; // Does not meet minimum R:R
    }
    
    // Calculate quality score
    const quality = calculateQuality(dsl, input, eligibilityCheck.reasons);
    
    // Calculate viability (quality + regime + volume multipliers)
    let viability = quality;
    const regimeMultiplier = input.spyRegime === 'bullish' ? 1.2 : 
                            input.spyRegime === 'neutral' ? 1.0 : 0.8;
    viability *= regimeMultiplier;
    
    const volumeMultiplier = input.volZ >= 0 ? 1.1 : 0.9;
    viability *= volumeMultiplier;
    viability = Math.min(0.95, viability);
    
    // Build confirmation state
    const confirmation = {
      barsRequired: dsl.confirmation?.barsRequired || 1,
      barsCompleted: 1, // Simplified - assume confirmed
      conditions: dsl.confirmation?.conditions || eligibilityCheck.reasons,
      satisfied: true,
    };
    
    return {
      strategy: 'user_defined' as any, // Will need to extend StrategyType
      symbol: input.symbol,
      timeframe: input.timeframe,
      asOf: new Date().toISOString(),
      status: 'ready',
      quality,
      viability,
      rrFirst,
      reasons: eligibilityCheck.reasons,
      plan: {
        trigger: {
          type: dsl.trigger.type === 'breakout' ? 'breakout' : 
                dsl.trigger.type === 'custom' ? 'limit' : 'limit',
          level: entry,
          description: dsl.trigger.description,
        },
        entry: Number(entry.toFixed(2)),
        stop: Number(stop.toFixed(2)),
        targets,
        direction: dsl.direction,
        invalidationRules: ['Price closes below stop loss'],
      },
      metadata: {
        strategyName: dsl.name,
        userStrategyId: strategyId,
        dsl,
        confirmation,
        allEvaluatedStrategies: [dsl.name],
        selectedReason: 'User-defined strategy',
        totalEvaluated: 1,
        eligibleFound: 1,
        passedRR: 1,
        isUserStrategy: true, // Flag for mentor to recognize user strategy
      },
    };
  } catch (error) {
    // Expression evaluation failed
    console.error('User strategy evaluation failed:', error);
    return null;
  }
}

interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

function checkEligibility(
  dsl: StrategyDsl,
  input: StrategyInput,
  context: EvaluationContext
): EligibilityResult {
  const reasons: string[] = [];
  const { eligibility } = dsl;
  
  if (!eligibility) {
    return { eligible: true, reasons: ['No eligibility criteria defined'] };
  }
  
  // Check EMA rules
  if (eligibility.emaRules && eligibility.emaRules.length > 0) {
    for (const rule of eligibility.emaRules) {
      const ema1Val = getEmaValue(rule.ema1, input);
      const ema2Val = getEmaValue(rule.ema2, input);
      
      if (ema1Val === undefined || ema2Val === undefined) {
        return { eligible: false, reasons: [`Missing EMA${rule.ema1} or EMA${rule.ema2}`] };
      }
      
      const passes = evaluateComparison(ema1Val, rule.operator, ema2Val);
      if (!passes) {
        return { 
          eligible: false, 
          reasons: [`EMA${rule.ema1} ${rule.operator} EMA${rule.ema2} not met`] 
        };
      }
      
      reasons.push(`EMA${rule.ema1} ${rule.operator} EMA${rule.ema2} ✓`);
    }
  }
  
  // Check RSI range
  if (eligibility.rsiRange) {
    const rsi = input.rsi14;
    const { min, max } = eligibility.rsiRange;
    
    if (rsi < min || rsi > max) {
      return { 
        eligible: false, 
        reasons: [`RSI ${rsi.toFixed(1)} outside range [${min}, ${max}]`] 
      };
    }
    
    reasons.push(`RSI ${rsi.toFixed(1)} in range [${min}, ${max}] ✓`);
  }
  
  // Check ATR range
  if (eligibility.atrRange) {
    const atrPct = (input.atr / input.price) * 100;
    const { minPct, maxPct } = eligibility.atrRange;
    
    if (atrPct < minPct || atrPct > maxPct) {
      return { 
        eligible: false, 
        reasons: [`ATR ${atrPct.toFixed(2)}% outside range [${minPct}%, ${maxPct}%]`] 
      };
    }
    
    reasons.push(`ATR ${atrPct.toFixed(2)}% in range ✓`);
  }
  
  // Check volume rule
  if (eligibility.volumeRule) {
    const { threshold, operator, type } = eligibility.volumeRule;
    let volumeValue = input.volZ; // Default to z-score
    
    if (type === 'relative') {
      // Relative to recent average (simplified)
      volumeValue = input.volZ;
    } else if (type === 'absolute') {
      // Get current bar's volume
      const currentVolume = Array.isArray(input.volume) 
        ? input.volume[input.volume.length - 1] 
        : input.volume;
      volumeValue = currentVolume;
    }
    
    const passes = evaluateComparison(volumeValue, operator, threshold);
    if (!passes) {
      return { 
        eligible: false, 
        reasons: [`Volume ${volumeValue.toFixed(2)} ${operator} ${threshold} not met`] 
      };
    }
    
    reasons.push(`Volume confirmation ✓`);
  }
  
  // Check price distance
  if (eligibility.priceDistance) {
    const { fromLevel, maxDistance, unit } = eligibility.priceDistance;
    const levelValue = evaluateExpression(fromLevel, context);
    const distance = Math.abs(input.price - levelValue);
    
    let maxDistanceValue = maxDistance;
    if (unit === 'atr') {
      maxDistanceValue = maxDistance * input.atr;
    } else {
      // percentage
      maxDistanceValue = (maxDistance / 100) * input.price;
    }
    
    if (distance > maxDistanceValue) {
      return { 
        eligible: false, 
        reasons: [`Price too far from ${fromLevel} (${distance.toFixed(2)} > ${maxDistanceValue.toFixed(2)})`] 
      };
    }
    
    reasons.push(`Price within ${maxDistance}${unit === 'atr' ? '×ATR' : '%'} of ${fromLevel} ✓`);
  }
  
  // Check candle pattern
  if (eligibility.candlePattern) {
    const passes = checkCandlePattern(eligibility.candlePattern, input);
    if (!passes) {
      return { 
        eligible: false, 
        reasons: [`Required candle pattern not found`] 
      };
    }
    
    reasons.push(`Candle pattern confirmed ✓`);
  }
  
  // Check chart pattern
  if (eligibility.chartPattern) {
    const passes = checkChartPattern(eligibility.chartPattern, input);
    if (!passes) {
      return { 
        eligible: false, 
        reasons: [`Required chart pattern not found`] 
      };
    }
    
    reasons.push(`Chart pattern confirmed ✓`);
  }
  
  // Check multi-bar condition (e.g., "2+ red candles above EMA50")
  if (eligibility.multiBarCondition) {
    const multiBarCheck = checkMultiBarCondition(
      eligibility.multiBarCondition,
      input,
      context
    );
    
    if (!multiBarCheck.passes) {
      return {
        eligible: false,
        reasons: [multiBarCheck.reason],
      };
    }
    
    reasons.push(multiBarCheck.reason);
  }
  
  return { eligible: true, reasons };
}

function getEmaValue(period: number, input: StrategyInput): number | undefined {
  switch (period) {
    case 9: return input.ema9;
    case 20: return input.ema20;
    case 50: return input.ema50;
    case 200: return input.ema200;
    default: return undefined;
  }
}

function evaluateComparison(
  left: number,
  operator: '>' | '<' | '>=' | '<=' | '==',
  right: number
): boolean {
  switch (operator) {
    case '>': return left > right;
    case '<': return left < right;
    case '>=': return left >= right;
    case '<=': return left <= right;
    case '==': return Math.abs(left - right) < 0.01; // Float comparison
    default: return false;
  }
}

function checkCandlePattern(
  pattern: DslCandlePattern,
  input: StrategyInput
): boolean {
  const bars = input.bars;
  if (bars.length < 2) return false;
  
  const current = bars[bars.length - 1];
  const previous = bars[bars.length - 2];
  
  switch (pattern.name) {
    case 'bullish_engulfing':
      return isBullishEngulfing([previous, current]);
    
    case 'bearish_engulfing':
      // Inverse of bullish engulfing
      return current.open > current.close && 
             previous.close > previous.open &&
             current.open >= previous.close &&
             current.close < previous.open;
    
    case 'hammer':
      return isHammer([current]);
    
    case 'shooting_star':
      const body = Math.abs(current.close - current.open);
      const upperShadow = current.high - Math.max(current.open, current.close);
      const lowerShadow = Math.min(current.open, current.close) - current.low;
      return upperShadow > body * 2 && lowerShadow < body * 0.5;
    
    case 'doji':
      const dojiBody = Math.abs(current.close - current.open);
      const dojiRange = current.high - current.low;
      return dojiBody < dojiRange * 0.1;
    
    case 'consecutive_closes':
      const requiredBars = pattern.params?.count || 2;
      if (bars.length < requiredBars) return false;
      const recentBars = bars.slice(-requiredBars);
      const direction = pattern.params?.direction || 'up';
      
      if (direction === 'up') {
        return recentBars.every((b, i) => i === 0 || b.close > recentBars[i - 1].close);
      } else {
        return recentBars.every((b, i) => i === 0 || b.close < recentBars[i - 1].close);
      }
    
    case 'any_bullish':
      return current.close > current.open;
    
    case 'any_bearish':
      return current.close < current.open;
    
    default:
      return false;
  }
}

function checkChartPattern(
  pattern: any,
  input: StrategyInput
): boolean {
  // Use pattern contexts from input if available
  if (!input.patternContexts) return false;
  
  const { type, direction, status } = pattern;
  
  let contextPattern = null;
  switch (type) {
    case 'triangle':
      contextPattern = input.patternContexts.triangle;
      break;
    case 'flag':
      contextPattern = input.patternContexts.flag;
      break;
    case 'double_top':
      contextPattern = input.patternContexts.doubleTop;
      break;
    case 'double_bottom':
      contextPattern = input.patternContexts.doubleBottom;
      break;
  }
  
  if (!contextPattern) return false;
  
  // Check direction match
  if (direction !== 'any' && contextPattern.direction !== direction) {
    return false;
  }
  
  // Check status match
  if (status === 'institutional' && contextPattern.status !== 'institutional') {
    return false;
  }
  
  return true;
}

function checkMultiBarCondition(
  condition: any,
  input: StrategyInput,
  context: EvaluationContext
): { passes: boolean; reason: string } {
  const { count, direction, minLevel, maxLevel, checkLows, checkHighs } = condition;
  const bars = input.bars;
  
  if (bars.length < count) {
    return {
      passes: false,
      reason: `Insufficient bars (need ${count}, have ${bars.length})`,
    };
  }
  
  // Get the most recent N bars
  const recentBars = bars.slice(-count);
  
  // Check direction constraint
  if (direction !== 'any') {
    const directionMet = recentBars.every((bar, idx) => {
      if (direction === 'up') {
        return bar.close > bar.open;
      } else if (direction === 'down') {
        return bar.close < bar.open;
      }
      return true;
    });
    
    if (!directionMet) {
      const dirLabel = direction === 'up' ? 'bullish' : 'bearish';
      return {
        passes: false,
        reason: `Not all ${count} bars are ${dirLabel}`,
      };
    }
  }
  
  // Check minLevel constraint (bars must stay ABOVE this level)
  if (minLevel) {
    try {
      const minLevelValue = evaluateExpression(minLevel, context);
      const stayedAbove = recentBars.every(bar => {
        const valueToCheck = checkLows ? bar.low : bar.close;
        return valueToCheck > minLevelValue;
      });
      
      if (!stayedAbove) {
        const checkType = checkLows ? 'lows' : 'closes';
        return {
          passes: false,
          reason: `Bars dipped below ${minLevel} (checking ${checkType})`,
        };
      }
    } catch (err) {
      console.error('Error evaluating minLevel:', err);
      return {
        passes: false,
        reason: `Invalid minLevel expression: ${minLevel}`,
      };
    }
  }
  
  // Check maxLevel constraint (bars must stay BELOW this level)
  if (maxLevel) {
    try {
      const maxLevelValue = evaluateExpression(maxLevel, context);
      const stayedBelow = recentBars.every(bar => {
        const valueToCheck = checkHighs ? bar.high : bar.close;
        return valueToCheck < maxLevelValue;
      });
      
      if (!stayedBelow) {
        const checkType = checkHighs ? 'highs' : 'closes';
        return {
          passes: false,
          reason: `Bars exceeded ${maxLevel} (checking ${checkType})`,
        };
      }
    } catch (err) {
      console.error('Error evaluating maxLevel:', err);
      return {
        passes: false,
        reason: `Invalid maxLevel expression: ${maxLevel}`,
      };
    }
  }
  
  // Build success message
  let msg = `${count} bar${count > 1 ? 's' : ''}`;
  if (direction === 'up') msg += ' bullish';
  if (direction === 'down') msg += ' bearish';
  if (minLevel) msg += ` above ${minLevel}`;
  if (maxLevel) msg += ` below ${maxLevel}`;
  msg += ' ✓';
  
  return { passes: true, reason: msg };
}

function calculateQuality(
  dsl: StrategyDsl,
  input: StrategyInput,
  reasons: string[]
): number {
  const weights = dsl.qualityWeights || {
    baseQuality: 0.65,
    emaAlignment: 0.1,
    rsiMomentum: 0.1,
    volumeConfirmation: 0.05,
    patternStrength: 0.1,
  };
  
  let quality = weights.baseQuality;
  
  // EMA alignment bonus
  if (dsl.eligibility?.emaRules && dsl.eligibility.emaRules.length > 0) {
    quality += weights.emaAlignment;
  }
  
  // RSI momentum bonus
  if (dsl.eligibility?.rsiRange) {
    const rsi = input.rsi14;
    const { min, max } = dsl.eligibility.rsiRange;
    const midpoint = (min + max) / 2;
    const distance = Math.abs(rsi - midpoint);
    const normalized = 1 - (distance / ((max - min) / 2));
    quality += weights.rsiMomentum * normalized;
  }
  
  // Volume confirmation bonus
  if (input.volZ >= 0.5) {
    quality += weights.volumeConfirmation;
  }
  
  // Pattern strength bonus
  if (dsl.eligibility?.chartPattern && input.patternContexts) {
    const patternFound = reasons.some(r => r.includes('Chart pattern'));
    if (patternFound) {
      quality += weights.patternStrength;
    }
  }
  
  return Math.min(0.95, quality);
}
