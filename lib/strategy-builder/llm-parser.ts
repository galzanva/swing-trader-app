/**
 * LLM-Powered Strategy Parser
 * 
 * Uses the configured LLM to convert plain-English strategy descriptions
 * into structured DSL JSON.
 */

import { callLLM } from '@/lib/llm/client';
import { createDefaultStrategyDsl, validateStrategyDsl, type StrategyDsl } from './dsl-schema';

const SYSTEM_PROMPT = `You are an expert trading strategy parser. Convert plain-English strategy descriptions into structured JSON following this comprehensive schema:

{
  "name": "Strategy name (max 100 chars)",
  "description": "Brief description (optional)",
  "direction": "long" | "short",
  "timeframe": "1min" | "5min" | "15min" | "1hour" | "1day",
  "eligibility": {
    "emaRules": [{"ema1": number, "operator": ">" | "<" | ">=" | "<=" | "==", "ema2": number, "description": "optional"}],
    "rsiRange": {"period": 14, "min": number, "max": number},
    "atrRange": {"period": 14, "minPct": number, "maxPct": number},
    "volumeRules": [{"type": "z-score" | "relative" | "absolute", "threshold": number, "operator": ">=" | ">" | "<=" | "<", "description": "optional"}],
    "priceDistances": [{"fromLevel": "expression", "maxDistance": number, "unit": "pct" | "atr", "description": "optional"}],
    "candlePatterns": [{"name": "bullish_engulfing" | "bearish_engulfing" | "hammer" | "shooting_star" | "doji" | "consecutive_closes" | "any_bullish" | "any_bearish", "params": {}, "description": "optional"}],
    "chartPatterns": [{"type": "triangle" | "flag" | "double_top" | "double_bottom" | "head_shoulders" | "wedge", "direction": "bullish" | "bearish" | "any", "status": "institutional" | "candidate" | "any", "description": "optional"}],
    "multiBarConditions": [{"count": number, "direction": "up" | "down" | "any", "minLevel": "expression", "maxLevel": "expression", "checkLows": boolean, "checkHighs": boolean, "description": "optional"}],
    "squeezeDynamics": {
      "minDaysToCover": number (optional),
      "maxDaysToCover": number (optional),
      "minShortFloat": number (optional, 0-100%),
      "maxShortFloat": number (optional, 0-100%),
      "shortVolumeTrend": "increasing" | "decreasing" | "stable" | "any",
      "minShortVolumeZ": number (optional),
      "ttmSqueezeState": "ON" | "FIRE" | "OFF" | "any",
      "minSqueezeDuration": number (default 5),
      "maxSqueezeDuration": number (optional),
      "ttmFireConfirmation": {
        "required": boolean,
        "momentumDirection": "bullish" | "bearish" | "any",
        "minHistogram": number (optional),
        "maxHistogram": number (optional),
        "additionalFilters": ["string expressions"] (optional)
      },
      "requireBothSqueezes": boolean,
      "minCombinedScore": number (0-100, optional),
      "shortSqueezeWeight": number (0-1, default 0.6, how much short squeeze contributes to combined score),
      "ttmSqueezeWeight": number (0-1, default 0.4, how much TTM squeeze contributes to combined score),
      "description": "optional"
    },
    "custom": ["custom boolean expression strings"]
  },
  "trigger": {
    "type": "breakout" | "pullback" | "reversal" | "continuation" | "custom",
    "level": "expression (e.g., 'ema20', 'high', 'price')",
    "description": "Plain English description"
  },
  "stop": {
    "type": "fixed" | "atr" | "swing" | "ema",
    "value": "expression (e.g., 'entry-1.5*ATR', 'ema50', '45.50')",
    "description": "optional"
  },
  "targets": [
    {"level": "expression (e.g., 'entry+1.5*ATR', 'entry+3*ATR')", "label": "T1", "rr": optional_number}
  ],
  "confirmation": {
    "barsRequired": number,
    "conditions": ["string descriptions of what needs to be confirmed"],
    "allRequired": boolean
  },
  "riskManagement": {
    "minRR": 1.5,
    "maxPositionSize": 2,
    "earningsDaysBuffer": 3
  }
}

**CRITICAL PARSING RULES:**

1. **Multiple EMA Rules**: Parse ALL EMA conditions separately
   - "EMA20 > EMA50 > EMA200" → [{"ema1": 20, "operator": ">", "ema2": 50}, {"ema1": 50, "operator": ">", "ema2": 200}]
   - Each comparison is a separate rule in the emaRules array

2. **Volume Conditions**: Use volumeRules array (plural)
   - "volume higher than average by z-score 1" → volumeRules: [{"type": "z-score", "threshold": 1, "operator": ">=", "description": "Above average"}]
   - "higher than average" = z-score, "relative" = percentage change, "absolute" = specific volume number

3. **RSI Range**: Single object with min and max
   - "RSI between 40 and 70" → rsiRange: {"period": 14, "min": 40, "max": 70}
   - "RSI above 50" → rsiRange: {"period": 14, "min": 50, "max": 100}

4. **Price Distance (Pullback)**: Use priceDistances array
   - "price pulls back within 1.5 ATR of EMA50" → priceDistances: [{"fromLevel": "ema50", "maxDistance": 1.5, "unit": "atr", "description": "Pullback to EMA50 support"}]
   - "within 2% of support" → {"fromLevel": "support", "maxDistance": 2, "unit": "pct"}

5. **Candle Patterns**: Use candlePatterns array
   - "bullish engulfing candle" → candlePatterns: [{"name": "bullish_engulfing"}]
   - "confirmed by hammer" → candlePatterns: [{"name": "bullish_engulfing"}, {"name": "hammer"}]

6. **Multi-Bar Confirmation**: Use multiBarConditions array
   - "minimum 2 bars closing above EMA50" → multiBarConditions: [{"count": 2, "direction": "up", "minLevel": "ema50", "checkLows": false, "description": "2 bars above EMA50"}]
   - "2+ red candles above EMA50" → [{"count": 2, "direction": "down", "minLevel": "ema50", "checkLows": true}]
   - checkLows: true = bar.low must stay above minLevel
   - checkHighs: true = bar.high must stay below maxLevel

7. **Stop Loss**: Parse ATR multiples carefully
   - "stop loss 1.5 ATR below entry" → stop: {"type": "atr", "value": "entry-1.5*ATR", "description": "1.5 ATR below entry"}
   - "stop at swing low" → {"type": "swing", "value": "low-0.5*ATR"}

8. **Targets**: Extract ALL targets mentioned
   - "targets at 1.5 and 3 ATR" → targets: [{"level": "entry+1.5*ATR", "label": "T1"}, {"level": "entry+3*ATR", "label": "T2"}]
   - "2:1 reward ratio" → targets: [{"level": "entry+2*ATR", "label": "T1"}]

9. **Trigger Conditions**:
   - "when price crosses above EMA20" → trigger: {"type": "breakout", "level": "ema20", "description": "Price crosses above EMA20"}
   - "on pullback to support" → {"type": "pullback", "level": "ema50"}
   - "when RSI crosses above 50" → {"type": "custom", "level": "price", "description": "RSI crosses above 50"}

10. **Direction Inference**:
    - "go long" / "buy" / "bullish" / "uptrend" = "long"
    - "go short" / "sell" / "bearish" / "downtrend" = "short"
    - Pullback in uptrend = "long", Rally in downtrend = "short"

11. **Squeeze Dynamics** (Short Float Squeeze & TTM Squeeze):
    - "high short interest" / "days to cover above 5" → squeezeDynamics: {"minDaysToCover": 5}
    - "short float above 15%" → squeezeDynamics: {"minShortFloat": 15}
    - "TTM squeeze active" / "in squeeze" → squeezeDynamics: {"ttmSqueezeState": "ON", "minSqueezeDuration": 5}
    - "squeeze fired" / "TTM squeeze breakout" → squeezeDynamics: {"ttmSqueezeState": "FIRE", "ttmFireConfirmation": {"required": true, "momentumDirection": "bullish"}}
    - "short squeeze setup" → squeezeDynamics: {"minDaysToCover": 5, "minShortFloat": 10}
    - "both squeezes aligned" → squeezeDynamics: {"requireBothSqueezes": true, "ttmSqueezeState": "ON", "minDaysToCover": 5}
    - Direction for fire confirmation: "bullish breakout" = momentumDirection: "bullish", "bearish breakout" = "bearish"

**Expression Syntax:**
- Variables: "entry", "stop", "price", "high", "low", "close", "ema9", "ema20", "ema50", "ema200"
- Math operators: +, -, *, /, ()
- ATR: Always use "ATR" (case-sensitive)
- Examples: "entry+1.5*ATR", "ema50-0.5*ATR", "low-2*ATR", "entry+3*ATR"

**Example 1 - EMA Pullback Strategy:**
Input: "Go long on daily timeframe when EMA20 > EMA50 > EMA200, RSI is between 40 and 70, volume is higher than average by z-score 1, price pulls back within 1.5 ATR of EMA50 support, confirmed by bullish engulfing candle, with stop loss 1.5 ATR below entry, targets at 1.5 and 3 ATR, and minimum 2 bars closing above EMA50 for confirmation."

Output:
{
  "name": "EMA Pullback with Confirmation",
  "direction": "long",
  "timeframe": "1day",
  "eligibility": {
    "emaRules": [
      {"ema1": 20, "operator": ">", "ema2": 50, "description": "EMA20 above EMA50"},
      {"ema1": 50, "operator": ">", "ema2": 200, "description": "EMA50 above EMA200"}
    ],
    "rsiRange": {"period": 14, "min": 40, "max": 70},
    "volumeRules": [{"type": "z-score", "threshold": 1, "operator": ">=", "description": "Above average volume"}],
    "priceDistances": [{"fromLevel": "ema50", "maxDistance": 1.5, "unit": "atr", "description": "Within 1.5 ATR of EMA50"}],
    "candlePatterns": [{"name": "bullish_engulfing"}],
    "multiBarConditions": [{"count": 2, "direction": "any", "minLevel": "ema50", "checkLows": false, "description": "2 bars closing above EMA50"}]
  },
  "trigger": {
    "type": "pullback",
    "level": "ema50",
    "description": "Price pulls back to EMA50 support"
  },
  "stop": {
    "type": "atr",
    "value": "entry-1.5*ATR",
    "description": "1.5 ATR below entry"
  },
  "targets": [
    {"level": "entry+1.5*ATR", "label": "T1"},
    {"level": "entry+3*ATR", "label": "T2"}
  ],
  "riskManagement": {
    "minRR": 1.5,
    "maxPositionSize": 2,
    "earningsDaysBuffer": 3
  }
}

**Example 2 - Short Squeeze Strategy:**
Input: "Go long when days to cover is above 6, short float above 15%, and TTM squeeze fires with bullish momentum above 20 EMA, stop at 1.5 ATR, targets at 2 and 4 ATR."

Output:
{
  "name": "Short Squeeze Breakout",
  "direction": "long",
  "timeframe": "1day",
  "eligibility": {
    "emaRules": [{"ema1": 9, "operator": ">", "ema2": 20, "description": "Above 20 EMA"}],
    "squeezeDynamics": {
      "minDaysToCover": 6,
      "minShortFloat": 15,
      "ttmSqueezeState": "FIRE",
      "minSqueezeDuration": 5,
      "ttmFireConfirmation": {
        "required": true,
        "momentumDirection": "bullish",
        "minHistogram": 0
      },
      "description": "High short interest with TTM squeeze breakout"
    }
  },
  "trigger": {
    "type": "breakout",
    "level": "ema20",
    "description": "Squeeze fires with price above 20 EMA"
  },
  "stop": {
    "type": "atr",
    "value": "entry-1.5*ATR",
    "description": "1.5 ATR below entry"
  },
  "targets": [
    {"level": "entry+2*ATR", "label": "T1"},
    {"level": "entry+4*ATR", "label": "T2"}
  ]
}

**IMPORTANT:**
- Use array forms (volumeRules, priceDistances, candlePatterns, chartPatterns, multiBarConditions) for ALL conditions
- Parse ALL conditions mentioned - don't skip any
- Each condition is evaluated cumulatively (all must pass)
- Provide detailed descriptions for complex conditions
- Return ONLY valid JSON, no explanation or markdown`;

export async function parseStrategyWithLLM(
  text: string,
  _openaiApiKey?: string
): Promise<{
  success: boolean;
  dsl?: StrategyDsl;
  followUp?: string;
  errors?: string[];
  warnings?: string[];
}> {
  try {
    console.log('[LLM Parser] Sending strategy to LLM for parsing...');
    const result = await callLLM({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Parse this strategy:\n\n${text}` },
      ],
      jsonMode: true,
      temperature: 0.1,
    });

    const content = result.content;
    if (!content) {
      return {
        success: false,
        errors: ['No response from LLM'],
      };
    }

    // Parse JSON response
    let parsedJson: any;
    try {
      parsedJson = JSON.parse(content);
      console.log('[LLM Parser] Successfully parsed JSON from LLM');
      console.log('[LLM Parser] Parsed strategy:', JSON.stringify(parsedJson, null, 2));
    } catch (err) {
      console.error('[LLM Parser] Failed to parse JSON:', err);
      return {
        success: false,
        errors: ['Invalid JSON response from LLM - please try rephrasing your strategy'],
      };
    }

    // Validate with Zod
    console.log('[LLM Parser] Validating against DSL schema...');
    const validation = validateStrategyDsl(parsedJson);
    
    if (!validation.success) {
      console.error('[LLM Parser] Schema validation failed:', validation.errors);
      console.error('[LLM Parser] Raw LLM response:', JSON.stringify(parsedJson, null, 2));
      
      // Provide user-friendly error messages
      const userFriendlyErrors = validation.errors?.map(err => {
        if (err.includes('direction')) return 'Please specify if this is a long or short strategy';
        if (err.includes('trigger')) return 'Please specify when to enter the trade';
        if (err.includes('stop')) return 'Please specify where to place the stop loss';
        if (err.includes('targets')) return 'Please specify at least one profit target';
        if (err.includes('timeframe')) return 'Please specify the timeframe (e.g., daily, 1hour, 5min)';
        return err;
      });
      
      return {
        success: false,
        errors: userFriendlyErrors,
      };
    }
    
    console.log('[LLM Parser] Schema validation succeeded!');
    
    // Log all parsed conditions for debugging
    if (validation.data) {
      const eligibility = validation.data.eligibility;
      console.log('[LLM Parser] Parsed eligibility criteria:');
      if (eligibility.emaRules?.length) console.log(`  - ${eligibility.emaRules.length} EMA rules`);
      if (eligibility.rsiRange) console.log(`  - RSI range: ${eligibility.rsiRange.min}-${eligibility.rsiRange.max}`);
      if (eligibility.volumeRules?.length) console.log(`  - ${eligibility.volumeRules.length} volume rules`);
      if (eligibility.priceDistances?.length) console.log(`  - ${eligibility.priceDistances.length} price distance rules`);
      if (eligibility.candlePatterns?.length) console.log(`  - ${eligibility.candlePatterns.length} candle patterns`);
      if (eligibility.multiBarConditions?.length) console.log(`  - ${eligibility.multiBarConditions.length} multi-bar conditions`);
    }

    // Check if we need a follow-up
    const followUp = getFollowUpQuestion(validation.data!);
    if (followUp) {
      console.log('[LLM Parser] Follow-up question needed:', followUp);
    }

    return {
      success: true,
      dsl: validation.data,
      followUp,
      warnings: validation.warnings,
    };
  } catch (error: any) {
    console.error('[LLM Parser] Exception during parsing:', error?.message ?? error);
    
    let errorMessage = 'Failed to parse strategy';
    if (error.message?.includes('API key') || error.message?.includes('not configured')) {
      errorMessage = 'LLM API configuration error - please check your API key settings';
    } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      errorMessage = 'Too many requests - please wait a moment and try again';
    } else if (error.message) {
      errorMessage = `Parsing error: ${error.message}`;
    }
    
    return {
      success: false,
      errors: [errorMessage],
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
