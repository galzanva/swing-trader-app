/**
 * LLM-Powered Strategy Parser
 * 
 * Uses OpenAI to convert plain-English strategy descriptions into structured DSL JSON
 */

import OpenAI from 'openai';
import { createDefaultStrategyDsl, validateStrategyDsl, type StrategyDsl } from './dsl-schema';

const SYSTEM_PROMPT = `You are a trading strategy parser. Convert plain-English strategy descriptions into structured JSON following this schema:

{
  "name": "Strategy name (max 100 chars)",
  "description": "Brief description (optional)",
  "direction": "long" | "short",
  "timeframe": "1min" | "5min" | "15min" | "1hour" | "1day",
  "eligibility": {
    "emaRules": [{"ema1": number, "operator": ">" | "<" | ">=" | "<=" | "==", "ema2": number}],
    "rsiRange": {"period": 14, "min": number, "max": number},
    "atrRange": {"period": 14, "minPct": number, "maxPct": number},
    "volumeRule": {"type": "z-score" | "relative" | "absolute", "threshold": number, "operator": ">=" | ">" | "<=" | "<"},
    "priceDistance": {"fromLevel": "expression", "maxDistance": number, "unit": "pct" | "atr"},
    "candlePattern": {"name": "bullish_engulfing" | "bearish_engulfing" | "hammer" | "shooting_star" | "doji" | "consecutive_closes" | "any_bullish" | "any_bearish"},
    "chartPattern": {"type": "triangle" | "flag" | "double_top" | "double_bottom", "direction": "bullish" | "bearish" | "any"},
    "multiBarCondition": {"count": number, "direction": "up" | "down" | "any", "minLevel": "expression", "maxLevel": "expression", "checkLows": boolean, "checkHighs": boolean}
  },
  "trigger": {
    "type": "breakout" | "pullback" | "reversal" | "continuation" | "custom",
    "level": "expression (e.g., 'ema20', 'high', 'price')",
    "description": "Plain English description"
  },
  "stop": {
    "type": "fixed" | "atr" | "swing" | "ema",
    "value": "expression (e.g., 'entry-1*ATR', 'ema50', '45.50')"
  },
  "targets": [
    {"level": "expression (e.g., 'entry+1.5*ATR', 'ema200')", "label": "T1"}
  ],
  "confirmation": {
    "barsRequired": number,
    "conditions": ["string descriptions"],
    "allRequired": boolean
  },
  "riskManagement": {
    "minRR": 1.5,
    "maxPositionSize": 2,
    "earningsDaysBuffer": 3
  }
}

**Expression Syntax:**
- Use "entry", "stop", "price", "high", "low", "close"
- EMAs: "ema9", "ema20", "ema50", "ema200"
- Math: "entry+1.5*ATR", "ema20-0.5*ATR", "low-2*ATR"
- For swing low/high: Use "low-1*ATR" or "high+1*ATR"

**Multi-Bar Conditions:**
- For "2+ red candles above EMA50", use: {"count": 2, "direction": "down", "minLevel": "ema50", "checkLows": true}
- For "3 consecutive green bars", use: {"count": 3, "direction": "up"}
- For "pullback staying above support", use: {"count": 2, "direction": "down", "minLevel": "ema50"}
- "checkLows": true means bar.low must stay above minLevel (default: true)
- "checkHighs": true means bar.high must stay below maxLevel (default: true)

**Important:**
1. ALWAYS provide valid expressions for stop.value and target levels
2. Default to "entry-1*ATR" for stop if unclear
3. Default to ["entry+1.5*ATR", "entry+2.5*ATR"] for targets if unclear
4. Use "1day" for daily timeframe
5. Infer direction from context (pullback in uptrend = long)
6. Fill all required fields with sane defaults
7. For "swing low", use "low-0.5*ATR" as approximation
8. For reward-to-risk ratios like "2:1", convert to targets: 2:1 means "entry+2*ATR" (for long)
9. When user mentions "N or more bars", "N+ bars", "N consecutive bars" with conditions, use multiBarCondition
10. Extract bar direction (red/bearish = "down", green/bullish = "up") and support levels (e.g., "above EMA50" → minLevel: "ema50")

Return ONLY valid JSON, no explanation.`;

export async function parseStrategyWithLLM(
  text: string,
  openaiApiKey: string
): Promise<{
  success: boolean;
  dsl?: StrategyDsl;
  followUp?: string;
  errors?: string[];
}> {
  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Parse this strategy:\n\n${text}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        errors: ['No response from OpenAI'],
      };
    }

    // Parse JSON response
    let parsedJson: any;
    try {
      parsedJson = JSON.parse(content);
    } catch (err) {
      return {
        success: false,
        errors: ['Invalid JSON response from LLM'],
      };
    }

    // Validate with Zod
    console.log('[LLM Parser] Validating parsed JSON...');
    const validation = validateStrategyDsl(parsedJson);
    
    if (!validation.success) {
      console.error('[LLM Parser] Validation failed:', validation.errors);
      console.error('[LLM Parser] Raw LLM response:', JSON.stringify(parsedJson, null, 2));
      return {
        success: false,
        errors: validation.errors,
      };
    }
    
    console.log('[LLM Parser] Validation succeeded!');

    // Check if we need a follow-up
    const followUp = getFollowUpQuestion(validation.data!);

    return {
      success: true,
      dsl: validation.data,
      followUp,
    };
  } catch (error: any) {
    console.error('LLM parsing error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
    });
    return {
      success: false,
      errors: [error.message || 'Failed to parse strategy with LLM'],
    };
  }
}

function getFollowUpQuestion(dsl: StrategyDsl): string | undefined {
  // Only ask if truly essential info is missing AND defaults might be wrong
  
  // Direction is critical - but we should always be able to infer it
  // If somehow we got here without direction, ask
  if (!dsl.direction) {
    return 'Is this a long (buy) or short (sell) strategy?';
  }

  // No follow-up needed - LLM should provide everything with smart defaults
  return undefined;
}

/**
 * Apply user's answer to follow-up question
 */
export function applyFollowUpAnswerLLM(
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
  
  return dsl;
}
