/**
 * User Strategy Evaluator
 * 
 * Evaluates user-defined strategies using the DSL against market data
 */

import type { StrategyInput, StrategyEvaluation } from '../strategies/types';
import type { StrategyDsl, EmaRule, CandlePattern as DslCandlePattern, SqueezeDynamics } from './dsl-schema';
import { evaluateExpression, type EvaluationContext } from './expression-evaluator';
import { calculateRR, isBullishEngulfing, isHammer } from '../strategies/core-calculations';
import { analyzeCombinedSqueeze, analyzeTTMSqueeze, analyzeShortSqueeze } from '../indicators/squeeze';

/**
 * Evaluate a user-defined strategy
 */
export function evaluateUserStrategy(
  dsl: StrategyDsl,
  input: StrategyInput,
  strategyId?: string
): StrategyEvaluation | null {
  // Build evaluation context with pattern levels
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
    patternLevels: input.patternLevels, // Include pattern-derived price levels
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
    
    // Calculate viability (quality + regime + volume + squeeze multipliers)
    let viability = quality;
    const regimeMultiplier = input.spyRegime === 'bullish' ? 1.2 : 
                            input.spyRegime === 'neutral' ? 1.0 : 0.8;
    viability *= regimeMultiplier;
    
    const volumeMultiplier = input.volZ >= 0 ? 1.1 : 0.9;
    viability *= volumeMultiplier;
    
    // SQUEEZE MULTIPLIER (amplifies viability based on combined squeeze score)
    if ((input as any).squeezeAnalysis) {
      const sq = (input as any).squeezeAnalysis;
      // Score 80-100 → 1.3x multiplier (extreme squeeze)
      // Score 60-79  → 1.2x multiplier (high squeeze)
      // Score 40-59  → 1.1x multiplier (moderate squeeze)
      // Score 20-39  → 1.05x multiplier (low squeeze)
      // Score 0-19   → 1.0x multiplier (no squeeze)
      let squeezeMultiplier = 1.0;
      if (sq.combinedScore >= 80) {
        squeezeMultiplier = 1.3;
      } else if (sq.combinedScore >= 60) {
        squeezeMultiplier = 1.2;
      } else if (sq.combinedScore >= 40) {
        squeezeMultiplier = 1.1;
      } else if (sq.combinedScore >= 20) {
        squeezeMultiplier = 1.05;
      }
      
      viability *= squeezeMultiplier;
    }
    
    viability = Math.min(0.99, viability); // Allow up to 99% viability with all factors aligned
    
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
        isUserStrategy: true,
        strategyName: dsl.name,
        userStrategyId: strategyId,
        dsl,
        confirmation,
        allEvaluatedStrategies: [dsl.name],
        selectedReason: 'User-defined strategy',
        totalEvaluated: 1,
        eligibleFound: 1,
        passedRR: 1,
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
  
  console.log(`[Evaluator] Checking eligibility for strategy: ${dsl.name}`);
  
  // Check ALL EMA rules (must pass ALL)
  if (eligibility.emaRules && eligibility.emaRules.length > 0) {
    console.log(`[Evaluator] Checking ${eligibility.emaRules.length} EMA rules...`);
    for (const rule of eligibility.emaRules) {
      const ema1Val = getEmaValue(rule.ema1, input);
      const ema2Val = getEmaValue(rule.ema2, input);
      
      if (ema1Val === undefined || ema2Val === undefined) {
        console.log(`[Evaluator] ✗ Missing EMA data`);
        return { eligible: false, reasons: [`Missing EMA${rule.ema1} or EMA${rule.ema2}`] };
      }
      
      const passes = evaluateComparison(ema1Val, rule.operator, ema2Val);
      if (!passes) {
        console.log(`[Evaluator] ✗ EMA${rule.ema1} (${ema1Val.toFixed(2)}) ${rule.operator} EMA${rule.ema2} (${ema2Val.toFixed(2)}) failed`);
        return { 
          eligible: false, 
          reasons: [`EMA${rule.ema1} ${rule.operator} EMA${rule.ema2} not met (${ema1Val.toFixed(2)} vs ${ema2Val.toFixed(2)})`] 
        };
      }
      
      const msg = `EMA${rule.ema1} ${rule.operator} EMA${rule.ema2} ✓`;
      reasons.push(msg);
      console.log(`[Evaluator] ✓ ${msg}`);
    }
  }
  
  // Check RSI range
  if (eligibility.rsiRange) {
    const rsi = input.rsi14;
    const { min, max } = eligibility.rsiRange;
    console.log(`[Evaluator] Checking RSI: ${rsi.toFixed(1)} should be in [${min}, ${max}]`);
    
    if (rsi < min || rsi > max) {
      console.log(`[Evaluator] ✗ RSI outside range`);
      return { 
        eligible: false, 
        reasons: [`RSI ${rsi.toFixed(1)} outside range [${min}, ${max}]`] 
      };
    }
    
    const msg = `RSI ${rsi.toFixed(1)} in range [${min}, ${max}] ✓`;
    reasons.push(msg);
    console.log(`[Evaluator] ✓ ${msg}`);
  }
  
  // Check ATR range
  if (eligibility.atrRange) {
    const atrPct = (input.atr / input.price) * 100;
    const { minPct, maxPct } = eligibility.atrRange;
    console.log(`[Evaluator] Checking ATR: ${atrPct.toFixed(2)}% should be in [${minPct}%, ${maxPct}%]`);
    
    if (atrPct < minPct || atrPct > maxPct) {
      console.log(`[Evaluator] ✗ ATR outside range`);
      return { 
        eligible: false, 
        reasons: [`ATR ${atrPct.toFixed(2)}% outside range [${minPct}%, ${maxPct}%]`] 
      };
    }
    
    const msg = `ATR ${atrPct.toFixed(2)}% in range ✓`;
    reasons.push(msg);
    console.log(`[Evaluator] ✓ ${msg}`);
  }
  
  // Check ALL volume rules (support both legacy and array forms)
  const volumeRules = eligibility.volumeRules || (eligibility.volumeRule ? [eligibility.volumeRule] : []);
  if (volumeRules.length > 0) {
    console.log(`[Evaluator] Checking ${volumeRules.length} volume rules...`);
    for (const volumeRule of volumeRules) {
      const { threshold, operator, type } = volumeRule;
      let volumeValue = input.volZ; // Default to z-score
      
      if (type === 'relative') {
        volumeValue = input.volZ;
      } else if (type === 'absolute') {
        const currentVolume = Array.isArray(input.volume) 
          ? input.volume[input.volume.length - 1] 
          : input.volume;
        volumeValue = currentVolume;
      }
      
      const passes = evaluateComparison(volumeValue, operator, threshold);
      if (!passes) {
        console.log(`[Evaluator] ✗ Volume ${volumeValue.toFixed(2)} ${operator} ${threshold} failed`);
        return { 
          eligible: false, 
          reasons: [`Volume (${type}) ${volumeValue.toFixed(2)} ${operator} ${threshold} not met`] 
        };
      }
      
      const msg = `Volume (${type}) ${operator} ${threshold} ✓`;
      reasons.push(msg);
      console.log(`[Evaluator] ✓ ${msg}`);
    }
  }
  
  // Check ALL price distance rules (support both legacy and array forms)
  const priceDistances = eligibility.priceDistances || (eligibility.priceDistance ? [eligibility.priceDistance] : []);
  if (priceDistances.length > 0) {
    console.log(`[Evaluator] Checking ${priceDistances.length} price distance rules...`);
    for (const priceDistance of priceDistances) {
      const { fromLevel, maxDistance, unit } = priceDistance;
      try {
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
          console.log(`[Evaluator] ✗ Price distance ${distance.toFixed(2)} > ${maxDistanceValue.toFixed(2)}`);
          return { 
            eligible: false, 
            reasons: [`Price too far from ${fromLevel} (${distance.toFixed(2)} > ${maxDistanceValue.toFixed(2)})`] 
          };
        }
        
        const msg = `Price within ${maxDistance}${unit === 'atr' ? '×ATR' : '%'} of ${fromLevel} ✓`;
        reasons.push(msg);
        console.log(`[Evaluator] ✓ ${msg}`);
      } catch (err) {
        // Gracefully handle pattern variables that aren't available
        const errorMsg = (err as Error).message;
        if (errorMsg.includes('Pattern variables not available')) {
          console.log(`[Evaluator] ✗ Pattern not detected: ${fromLevel}`);
          return {
            eligible: false,
            reasons: [`Required pattern not detected: ${fromLevel}`]
          };
        }
        
        console.error(`[Evaluator] Error evaluating price distance from ${fromLevel}:`, err);
        return {
          eligible: false,
          reasons: [`Invalid price distance expression: ${fromLevel}`]
        };
      }
    }
  }
  
  // Check ALL candle patterns (support both legacy and array forms)
  const candlePatterns = eligibility.candlePatterns || (eligibility.candlePattern ? [eligibility.candlePattern] : []);
  if (candlePatterns.length > 0) {
    console.log(`[Evaluator] Checking ${candlePatterns.length} candle patterns...`);
    for (const pattern of candlePatterns) {
      const passes = checkCandlePattern(pattern, input);
      if (!passes) {
        console.log(`[Evaluator] ✗ Candle pattern ${pattern.name} not found`);
        return { 
          eligible: false, 
          reasons: [`Required candle pattern ${pattern.name.replace(/_/g, ' ')} not found`] 
        };
      }
      
      const msg = `Candle pattern ${pattern.name.replace(/_/g, ' ')} ✓`;
      reasons.push(msg);
      console.log(`[Evaluator] ✓ ${msg}`);
    }
  }
  
  // Check ALL chart patterns (support both legacy and array forms)
  const chartPatterns = eligibility.chartPatterns || (eligibility.chartPattern ? [eligibility.chartPattern] : []);
  if (chartPatterns.length > 0) {
    console.log(`[Evaluator] Checking ${chartPatterns.length} chart patterns...`);
    for (const pattern of chartPatterns) {
      const passes = checkChartPattern(pattern, input);
      if (!passes) {
        console.log(`[Evaluator] ✗ Chart pattern ${pattern.type} not found`);
        return { 
          eligible: false, 
          reasons: [`Required ${pattern.direction} ${pattern.type} chart pattern not found`] 
        };
      }
      
      const msg = `Chart pattern ${pattern.direction} ${pattern.type} ✓`;
      reasons.push(msg);
      console.log(`[Evaluator] ✓ ${msg}`);
    }
  }
  
  // Check ALL multi-bar conditions (support both legacy and array forms)
  const multiBarConditions = eligibility.multiBarConditions || (eligibility.multiBarCondition ? [eligibility.multiBarCondition] : []);
  if (multiBarConditions.length > 0) {
    console.log(`[Evaluator] Checking ${multiBarConditions.length} multi-bar conditions...`);
    for (const condition of multiBarConditions) {
      const multiBarCheck = checkMultiBarCondition(condition, input, context);
      
      if (!multiBarCheck.passes) {
        console.log(`[Evaluator] ✗ Multi-bar condition failed: ${multiBarCheck.reason}`);
        return {
          eligible: false,
          reasons: [multiBarCheck.reason],
        };
      }
      
      reasons.push(multiBarCheck.reason);
      console.log(`[Evaluator] ✓ ${multiBarCheck.reason}`);
    }
  }
  
  // Check Squeeze Dynamics (Short Float Squeeze & TTM Squeeze)
  if (eligibility.squeezeDynamics) {
    console.log(`[Evaluator] Checking squeeze dynamics...`);
    const squeezeCheck = checkSqueezeDynamics(eligibility.squeezeDynamics, input);
    
    if (!squeezeCheck.passes) {
      console.log(`[Evaluator] ✗ Squeeze dynamics failed: ${squeezeCheck.reason}`);
      return {
        eligible: false,
        reasons: [squeezeCheck.reason],
      };
    }
    
    squeezeCheck.reasons.forEach(r => reasons.push(r));
    console.log(`[Evaluator] ✓ Squeeze dynamics passed (${squeezeCheck.reasons.length} checks)`);
  }
  
  // Check custom conditions
  if (eligibility.custom && eligibility.custom.length > 0) {
    console.log(`[Evaluator] Note: ${eligibility.custom.length} custom conditions defined (not yet evaluated)`);
    eligibility.custom.forEach(cond => {
      reasons.push(`Custom: ${cond} (assumed ✓)`);
    });
  }
  
  console.log(`[Evaluator] ✓ All eligibility criteria passed (${reasons.length} checks)`);
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
  
  // UNIFIED SQUEEZE SCORING BONUS (scale with combined score)
  if ((input as any).squeezeAnalysis) {
    const sq = (input as any).squeezeAnalysis;
    const squeezeBonusWeight = 0.20; // Max 20% bonus from squeeze
    
    // Score-based bonus (0-20% added to quality)
    // 100/100 score = +20% quality
    // 50/100 score = +10% quality
    // 0/100 score = +0% quality
    const scoreMultiplier = sq.combinedScore / 100;
    let squeezeBonus = squeezeBonusWeight * scoreMultiplier;
    
    // Additional bonus for alignment (both squeezes working together)
    if (sq.alignment && sq.combinedScore >= 50) {
      squeezeBonus += 0.05; // Extra 5% for synergy
    }
    
    // Boost for FIRE confirmation (immediate action setups)
    if (sq.ttmSqueeze.fireConfirmed && sq.combinedScore >= 60) {
      squeezeBonus += 0.05; // Extra 5% for confirmed breakout
    }
    
    quality += squeezeBonus;
  }
  
  return Math.min(0.98, quality); // Allow up to 98% quality with perfect squeeze
}

/**
 * Check squeeze dynamics eligibility
 */
function checkSqueezeDynamics(
  squeezeDynamics: SqueezeDynamics,
  input: StrategyInput
): { passes: boolean; reason: string; reasons: string[] } {
  const reasons: string[] = [];
  
  // Convert OHLCV bars for squeeze analysis
  const ohlcv = input.bars.map(bar => ({
    timestamp: bar.timestamp || Date.now(),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  }));
  
  // Get short interest data from input (if available)
  const shortInterest = (input as any).shortInterest || {};
  
  // Perform squeeze analysis with custom weights (if provided)
  const combinedAnalysis = analyzeCombinedSqueeze(
    ohlcv,
    shortInterest,
    squeezeDynamics.minSqueezeDuration || 5,
    squeezeDynamics.shortSqueezeWeight ?? 0.6,
    squeezeDynamics.ttmSqueezeWeight ?? 0.4
  );
  
  // Attach to input for quality bonus calculation
  (input as any).squeezeAnalysis = combinedAnalysis;
  
  const { shortSqueeze, ttmSqueeze } = combinedAnalysis;
  
  // Check Days to Cover
  if (squeezeDynamics.minDaysToCover !== undefined) {
    if (!shortSqueeze.daysToCover || shortSqueeze.daysToCover < squeezeDynamics.minDaysToCover) {
      return {
        passes: false,
        reason: `Days to cover ${shortSqueeze.daysToCover?.toFixed(1) || 'N/A'} < ${squeezeDynamics.minDaysToCover}`,
        reasons: [],
      };
    }
    reasons.push(`DTC ${shortSqueeze.daysToCover.toFixed(1)} ≥ ${squeezeDynamics.minDaysToCover} ✓`);
  }
  
  if (squeezeDynamics.maxDaysToCover !== undefined) {
    if (shortSqueeze.daysToCover && shortSqueeze.daysToCover > squeezeDynamics.maxDaysToCover) {
      return {
        passes: false,
        reason: `Days to cover ${shortSqueeze.daysToCover.toFixed(1)} > ${squeezeDynamics.maxDaysToCover}`,
        reasons: [],
      };
    }
  }
  
  // Check Short Float %
  if (squeezeDynamics.minShortFloat !== undefined) {
    if (!shortSqueeze.shortFloat || shortSqueeze.shortFloat < squeezeDynamics.minShortFloat) {
      return {
        passes: false,
        reason: `Short float ${shortSqueeze.shortFloat?.toFixed(1) || 'N/A'}% < ${squeezeDynamics.minShortFloat}%`,
        reasons: [],
      };
    }
    reasons.push(`Short float ${shortSqueeze.shortFloat.toFixed(1)}% ≥ ${squeezeDynamics.minShortFloat}% ✓`);
  }
  
  if (squeezeDynamics.maxShortFloat !== undefined) {
    if (shortSqueeze.shortFloat && shortSqueeze.shortFloat > squeezeDynamics.maxShortFloat) {
      return {
        passes: false,
        reason: `Short float ${shortSqueeze.shortFloat.toFixed(1)}% > ${squeezeDynamics.maxShortFloat}%`,
        reasons: [],
      };
    }
  }
  
  // Check Short Volume Trend
  if (squeezeDynamics.shortVolumeTrend && squeezeDynamics.shortVolumeTrend !== 'any') {
    if (shortSqueeze.shortVolumeTrend !== squeezeDynamics.shortVolumeTrend) {
      return {
        passes: false,
        reason: `Short volume trend ${shortSqueeze.shortVolumeTrend} != ${squeezeDynamics.shortVolumeTrend}`,
        reasons: [],
      };
    }
    reasons.push(`Short volume ${shortSqueeze.shortVolumeTrend} ✓`);
  }
  
  // Check Short Volume Z-score
  if (squeezeDynamics.minShortVolumeZ !== undefined) {
    if (!shortSqueeze.shortVolumeZ || shortSqueeze.shortVolumeZ < squeezeDynamics.minShortVolumeZ) {
      return {
        passes: false,
        reason: `Short volume Z ${shortSqueeze.shortVolumeZ?.toFixed(2) || 'N/A'} < ${squeezeDynamics.minShortVolumeZ}`,
        reasons: [],
      };
    }
    reasons.push(`Short vol Z ${shortSqueeze.shortVolumeZ.toFixed(2)} ≥ ${squeezeDynamics.minShortVolumeZ} ✓`);
  }
  
  // Check TTM Squeeze State
  if (squeezeDynamics.ttmSqueezeState && squeezeDynamics.ttmSqueezeState !== 'any') {
    if (ttmSqueeze.current.state !== squeezeDynamics.ttmSqueezeState) {
      return {
        passes: false,
        reason: `TTM squeeze ${ttmSqueeze.current.state} != ${squeezeDynamics.ttmSqueezeState}`,
        reasons: [],
      };
    }
    reasons.push(`TTM squeeze ${ttmSqueeze.current.state} ✓`);
  }
  
  // Check TTM Squeeze Duration
  if (squeezeDynamics.minSqueezeDuration !== undefined) {
    if (ttmSqueeze.squeezeDuration < squeezeDynamics.minSqueezeDuration) {
      return {
        passes: false,
        reason: `TTM squeeze duration ${ttmSqueeze.squeezeDuration} < ${squeezeDynamics.minSqueezeDuration} bars`,
        reasons: [],
      };
    }
    reasons.push(`TTM squeeze ≥${squeezeDynamics.minSqueezeDuration} bars ✓`);
  }
  
  if (squeezeDynamics.maxSqueezeDuration !== undefined) {
    if (ttmSqueeze.squeezeDuration > squeezeDynamics.maxSqueezeDuration) {
      return {
        passes: false,
        reason: `TTM squeeze duration ${ttmSqueeze.squeezeDuration} > ${squeezeDynamics.maxSqueezeDuration} bars`,
        reasons: [],
      };
    }
  }
  
  // Check TTM Fire Confirmation
  if (squeezeDynamics.ttmFireConfirmation?.required) {
    if (!ttmSqueeze.fireConfirmed) {
      return {
        passes: false,
        reason: `TTM squeeze fire not confirmed`,
        reasons: [],
      };
    }
    
    const conf = squeezeDynamics.ttmFireConfirmation;
    
    // Check momentum direction
    if (conf.momentumDirection && conf.momentumDirection !== 'any') {
      if (ttmSqueeze.potentialBreakout !== conf.momentumDirection) {
        return {
          passes: false,
          reason: `TTM fire direction ${ttmSqueeze.potentialBreakout} != ${conf.momentumDirection}`,
          reasons: [],
        };
      }
    }
    
    // Check histogram range
    if (conf.minHistogram !== undefined && ttmSqueeze.current.histogram < conf.minHistogram) {
      return {
        passes: false,
        reason: `TTM histogram ${ttmSqueeze.current.histogram.toFixed(2)} < ${conf.minHistogram}`,
        reasons: [],
      };
    }
    
    if (conf.maxHistogram !== undefined && ttmSqueeze.current.histogram > conf.maxHistogram) {
      return {
        passes: false,
        reason: `TTM histogram ${ttmSqueeze.current.histogram.toFixed(2)} > ${conf.maxHistogram}`,
        reasons: [],
      };
    }
    
    reasons.push(`TTM fire confirmed (${ttmSqueeze.potentialBreakout}) ✓`);
  }
  
  // Check Both Squeezes Alignment
  if (squeezeDynamics.requireBothSqueezes) {
    if (!combinedAnalysis.alignment) {
      return {
        passes: false,
        reason: `Both squeezes not aligned`,
        reasons: [],
      };
    }
    reasons.push(`Both squeezes aligned ✓`);
  }
  
  // Check Combined Score
  if (squeezeDynamics.minCombinedScore !== undefined) {
    if (combinedAnalysis.combinedScore < squeezeDynamics.minCombinedScore) {
      return {
        passes: false,
        reason: `Combined squeeze score ${combinedAnalysis.combinedScore} < ${squeezeDynamics.minCombinedScore}`,
        reasons: [],
      };
    }
    reasons.push(`Combined score ${combinedAnalysis.combinedScore} ≥ ${squeezeDynamics.minCombinedScore} ✓`);
  }
  
  return {
    passes: true,
    reason: 'Squeeze dynamics passed',
    reasons,
  };
}
