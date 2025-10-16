/**
 * Plain-English Strategy Parser
 * 
 * Converts natural language strategy descriptions into structured DSL JSON
 */

import { createDefaultStrategyDsl, type StrategyDsl, validateStrategyDsl } from './dsl-schema';

/**
 * Parse plain-English strategy description into DSL
 * 
 * This is a simplified deterministic parser. For production, integrate with OpenAI/Anthropic.
 */
export async function parseStrategyFromText(
  text: string
): Promise<{
  success: boolean;
  dsl?: StrategyDsl;
  followUp?: string;
  errors?: string[];
}> {
  try {
    // Extract key components from text
    const analysis = analyzeStrategyText(text);
    
    // Build DSL with extracted components
    const dsl = buildDslFromAnalysis(analysis);
    
    // Validate the generated DSL
    const validation = validateStrategyDsl(dsl);
    
    if (!validation.success) {
      return {
        success: false,
        errors: validation.errors,
      };
    }
    
    // Check if we need a follow-up question
    const followUp = getFollowUpQuestion(analysis);
    
    return {
      success: true,
      dsl: validation.data,
      followUp,
    };
  } catch (error) {
    return {
      success: false,
      errors: [(error as Error).message],
    };
  }
}

interface StrategyAnalysis {
  name?: string;
  direction?: 'long' | 'short';
  timeframe?: '1min' | '5min' | '15min' | '1hour' | '1day';
  
  // Trend analysis
  hasTrendRequirement?: boolean;
  trendDirection?: 'up' | 'down';
  
  // EMA mentions
  emaValues: number[];
  emaRules: string[];
  
  // RSI mentions
  rsiRange?: { min: number; max: number };
  
  // ATR mentions
  hasAtrReference?: boolean;
  
  // Volume mentions
  volumeRequirement?: string;
  
  // Entry conditions
  entryLevel?: string;
  entryDescription?: string;
  
  // Stop loss
  stopType?: string;
  stopValue?: string;
  
  // Targets
  targets: Array<{ level: string; label?: string }>;
  
  // Patterns
  candlePattern?: string;
  chartPattern?: string;
  
  // Raw text for fallback
  rawText: string;
}

function analyzeStrategyText(text: string): StrategyAnalysis {
  const lower = text.toLowerCase();
  const analysis: StrategyAnalysis = {
    rawText: text,
    emaValues: [],
    emaRules: [],
    targets: [],
  };
  
  // Extract name (first sentence or up to 50 chars)
  const firstSentence = text.split(/[.!?]/)[0].trim();
  analysis.name = firstSentence.length <= 50 ? firstSentence : text.slice(0, 50).trim();
  
  // Direction
  if (/(go\s+)?long|buy|bull(ish)?/i.test(lower)) {
    analysis.direction = 'long';
  } else if (/(go\s+)?short|sell|bear(ish)?/i.test(lower)) {
    analysis.direction = 'short';
  }
  
  // Timeframe
  if (/daily|day|1d/i.test(lower)) {
    analysis.timeframe = '1day';
  } else if (/hour(ly)?|1h/i.test(lower)) {
    analysis.timeframe = '1hour';
  } else if (/15\s*min/i.test(lower)) {
    analysis.timeframe = '15min';
  } else if (/5\s*min/i.test(lower)) {
    analysis.timeframe = '5min';
  } else if (/1\s*min/i.test(lower)) {
    analysis.timeframe = '1min';
  }
  
  // EMA extraction
  const emaMatches = text.match(/ema\s*(\d+)/gi);
  if (emaMatches) {
    analysis.emaValues = emaMatches.map(m => parseInt(m.match(/\d+/)![0]));
  }
  
  // Common EMA rules
  if (/ema20\s*(>|above)\s*ema50/i.test(lower)) {
    analysis.emaRules.push('ema20 > ema50');
    analysis.hasTrendRequirement = true;
    analysis.trendDirection = 'up';
  }
  if (/ema50\s*(>|above)\s*ema200/i.test(lower)) {
    analysis.emaRules.push('ema50 > ema200');
  }
  if (/uptrend|up\s*trend/i.test(lower)) {
    analysis.hasTrendRequirement = true;
    analysis.trendDirection = 'up';
  }
  if (/downtrend|down\s*trend/i.test(lower)) {
    analysis.hasTrendRequirement = true;
    analysis.trendDirection = 'down';
  }
  
  // RSI extraction
  const rsiMatch = lower.match(/rsi\s*(below|under|<|above|over|>)\s*(\d+)/);
  if (rsiMatch) {
    const value = parseInt(rsiMatch[2]);
    if (rsiMatch[1].includes('below') || rsiMatch[1].includes('under') || rsiMatch[1].includes('<')) {
      analysis.rsiRange = { min: 0, max: value };
    } else {
      analysis.rsiRange = { min: value, max: 100 };
    }
  }
  
  // RSI range (e.g., "RSI between 40 and 60")
  const rsiRangeMatch = lower.match(/rsi\s*(?:between|from)?\s*(\d+)\s*(?:and|to|-)\s*(\d+)/);
  if (rsiRangeMatch) {
    analysis.rsiRange = {
      min: parseInt(rsiRangeMatch[1]),
      max: parseInt(rsiRangeMatch[2]),
    };
  }
  
  // ATR
  if (/\batr\b/i.test(lower)) {
    analysis.hasAtrReference = true;
  }
  
  // Volume
  if (/volume\s*(increase|surge|spike|above\s*average)/i.test(lower)) {
    analysis.volumeRequirement = 'above_average';
  }
  
  // Entry (common patterns)
  if (/break(out)?\s*(above|over)/i.test(lower)) {
    analysis.entryLevel = 'breakout';
    analysis.entryDescription = 'Price breaks above resistance';
  } else if (/pullback\s*to\s*ema(\d+)?/i.test(lower)) {
    const emaMatch = lower.match(/pullback\s*to\s*ema(\d+)/);
    const ema = emaMatch ? emaMatch[1] : '20';
    analysis.entryLevel = `ema${ema}`;
    analysis.entryDescription = `Pullback to EMA${ema}`;
  } else if (/touch(es)?\s*ema(\d+)/i.test(lower)) {
    const emaMatch = lower.match(/touch(es)?\s*ema(\d+)/);
    const ema = emaMatch ? emaMatch[2] : '20';
    analysis.entryLevel = `ema${ema}`;
    analysis.entryDescription = `Price touches EMA${ema}`;
  }
  
  // Stop loss
  if (/stop\s*(loss)?\s*(?:at|:)?\s*ema(\d+)/i.test(lower)) {
    const emaMatch = lower.match(/stop\s*(?:loss)?\s*(?:at|:)?\s*ema(\d+)/);
    analysis.stopType = 'ema';
    analysis.stopValue = `ema${emaMatch![2]}`;
  } else if (/stop\s*(loss)?\s*(?:at|:)?\s*(\d+(?:\.\d+)?)\s*\*?\s*atr/i.test(lower)) {
    const atrMatch = lower.match(/stop\s*(?:loss)?\s*(?:at|:)?\s*(\d+(?:\.\d+)?)\s*\*?\s*atr/);
    analysis.stopType = 'atr';
    analysis.stopValue = `entry-${atrMatch![2]}*ATR`;
  }
  
  // Targets
  const targetMatches = text.matchAll(/target\s*\d*\s*(?:at|:)?\s*([^,.\n]+)/gi);
  for (const match of targetMatches) {
    const targetText = match[1].trim().toLowerCase();
    
    // Parse target level
    let level = 'entry+1.5*ATR'; // Default
    if (/(\d+(?:\.\d+)?)\s*\*?\s*atr/i.test(targetText)) {
      const atrMatch = targetText.match(/(\d+(?:\.\d+)?)\s*\*?\s*atr/i);
      level = `entry+${atrMatch![1]}*ATR`;
    } else if (/ema(\d+)/i.test(targetText)) {
      const emaMatch = targetText.match(/ema(\d+)/i);
      level = `ema${emaMatch![1]}`;
    }
    
    analysis.targets.push({ level });
  }
  
  // Candle patterns
  if (/bullish\s*engulfing/i.test(lower)) {
    analysis.candlePattern = 'bullish_engulfing';
  } else if (/bearish\s*engulfing/i.test(lower)) {
    analysis.candlePattern = 'bearish_engulfing';
  } else if (/hammer/i.test(lower)) {
    analysis.candlePattern = 'hammer';
  }
  
  // Chart patterns
  if (/triangle/i.test(lower)) {
    analysis.chartPattern = 'triangle';
  } else if (/flag/i.test(lower)) {
    analysis.chartPattern = 'flag';
  } else if (/double\s*top/i.test(lower)) {
    analysis.chartPattern = 'double_top';
  } else if (/double\s*bottom/i.test(lower)) {
    analysis.chartPattern = 'double_bottom';
  }
  
  return analysis;
}

function buildDslFromAnalysis(analysis: StrategyAnalysis): Partial<StrategyDsl> {
  const dsl: Partial<StrategyDsl> = {
    name: analysis.name || 'My Strategy',
    direction: analysis.direction || 'long',
    timeframe: analysis.timeframe || '1day',
    eligibility: {},
  };
  
  // Build eligibility criteria
  const eligibility: any = {};
  
  // EMA rules
  if (analysis.emaRules.length > 0 || analysis.hasTrendRequirement) {
    eligibility.emaRules = [];
    
    if (analysis.trendDirection === 'up') {
      eligibility.emaRules.push(
        { ema1: 20, operator: '>' as const, ema2: 50 },
        { ema1: 50, operator: '>' as const, ema2: 200 }
      );
    } else if (analysis.trendDirection === 'down') {
      eligibility.emaRules.push(
        { ema1: 20, operator: '<' as const, ema2: 50 },
        { ema1: 50, operator: '<' as const, ema2: 200 }
      );
    }
  }
  
  // RSI range
  if (analysis.rsiRange) {
    eligibility.rsiRange = {
      period: 14,
      min: analysis.rsiRange.min,
      max: analysis.rsiRange.max,
    };
  }
  
  // Volume
  if (analysis.volumeRequirement === 'above_average') {
    eligibility.volumeRule = {
      type: 'z-score' as const,
      threshold: 0,
      operator: '>=' as const,
    };
  }
  
  // Candle pattern
  if (analysis.candlePattern) {
    eligibility.candlePattern = {
      name: analysis.candlePattern as any,
    };
  }
  
  // Chart pattern
  if (analysis.chartPattern) {
    eligibility.chartPattern = {
      type: analysis.chartPattern as any,
      direction: dsl.direction === 'long' ? 'bullish' as const : 'bearish' as const,
      status: 'any' as const,
      lookbackBars: 50,
    };
  }
  
  dsl.eligibility = eligibility;
  
  // Trigger
  dsl.trigger = {
    type: analysis.entryLevel === 'breakout' ? 'breakout' : 'pullback',
    level: analysis.entryLevel || 'ema20',
    description: analysis.entryDescription || 'Entry condition',
  };
  
  // Stop loss
  if (analysis.stopType === 'atr' && analysis.stopValue) {
    dsl.stop = {
      type: 'atr',
      value: analysis.stopValue,
    };
  } else if (analysis.stopType === 'ema' && analysis.stopValue) {
    dsl.stop = {
      type: 'ema',
      value: analysis.stopValue,
    };
  } else {
    // Default stop
    dsl.stop = {
      type: 'atr',
      value: dsl.direction === 'long' ? 'entry-1*ATR' : 'entry+1*ATR',
    };
  }
  
  // Targets
  if (analysis.targets.length > 0) {
    dsl.targets = analysis.targets.map((t, i) => ({
      level: t.level,
      label: t.label || `T${i + 1}`,
    }));
  } else {
    // Default targets
    if (dsl.direction === 'long') {
      dsl.targets = [
        { level: 'entry+1.5*ATR', label: 'T1' },
        { level: 'entry+2.5*ATR', label: 'T2' },
      ];
    } else {
      dsl.targets = [
        { level: 'entry-1.5*ATR', label: 'T1' },
        { level: 'entry-2.5*ATR', label: 'T2' },
      ];
    }
  }
  
  return dsl;
}

function getFollowUpQuestion(analysis: StrategyAnalysis): string | undefined {
  // Only ask if truly essential info is missing
  
  if (!analysis.direction) {
    return 'Is this a long (buy) or short (sell) strategy?';
  }
  
  // If no clear entry condition
  if (!analysis.entryLevel && !analysis.emaRules.length && !analysis.candlePattern) {
    return 'What triggers the entry? (e.g., "break above EMA20" or "pullback to EMA50")';
  }
  
  // No follow-up needed - defaults are sufficient
  return undefined;
}

/**
 * Apply user's answer to follow-up question
 */
export function applyFollowUpAnswer(
  dsl: StrategyDsl,
  followUpQuestion: string,
  answer: string
): StrategyDsl {
  const lower = answer.toLowerCase();
  
  // Direction follow-up
  if (followUpQuestion.includes('long') && followUpQuestion.includes('short')) {
    if (/(go\s+)?long|buy|bull/i.test(lower)) {
      dsl.direction = 'long';
    } else if (/(go\s+)?short|sell|bear/i.test(lower)) {
      dsl.direction = 'short';
    }
  }
  
  // Entry follow-up
  if (followUpQuestion.includes('entry')) {
    const entryAnalysis = analyzeStrategyText(answer);
    if (entryAnalysis.entryLevel) {
      dsl.trigger.level = entryAnalysis.entryLevel;
      dsl.trigger.description = entryAnalysis.entryDescription || dsl.trigger.description;
    }
  }
  
  return dsl;
}
