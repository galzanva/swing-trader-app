/**
 * AI Technical Analyst
 * 
 * Uses the configured LLM (via lib/llm) to provide market analysis
 * with context-aware reasoning.
 */

import { callLLM } from '@/lib/llm/client';

export interface AIAnalysisInput {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  
  // Core Indicators
  indicators: {
    rsi: number;
    rsiSignal: 'overbought' | 'oversold' | 'neutral';
    macd: { value: number; signal: number; histogram: number; trend: 'bullish' | 'bearish' | 'neutral' };
    adx: number;
    plusDI: number;
    minusDI: number;
    stochastic: { k: number; d: number; signal: 'overbought' | 'oversold' | 'neutral' };
    atr: number;
    atrPercent: number;
    bollingerBands: { upper: number; middle: number; lower: number; percentB: number; bandwidth: number };
    volumeZScore: number;
    cmf: number;
    obvTrend: 'rising' | 'falling' | 'flat';
  };
  
  // Trend Assessment
  trend: {
    primary: { direction: 'uptrend' | 'downtrend' | 'sideways'; strength: number };
    intermediate: { direction: 'uptrend' | 'downtrend' | 'sideways'; strength: number };
    shortTerm: { direction: 'uptrend' | 'downtrend' | 'sideways'; strength: number };
    emaAlignment: 'bullish' | 'bearish' | 'mixed';
    ema9: number;
    ema20: number;
    ema50: number;
    ema200: number;
    priceVsEma200Pct: number;
  };
  
  // Momentum Assessment
  momentum: {
    score: number;
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: 'strong' | 'moderate' | 'weak' | 'none';
    divergences: { indicator: string; type: 'bullish' | 'bearish'; description: string }[];
  };
  
  // Volatility Assessment
  volatility: {
    regime: 'high' | 'normal' | 'low' | 'expanding' | 'contracting';
    percentile: number;
    suggestion: string;
  };
  
  // Structure Analysis
  structure: {
    classification: 'likely-pullback' | 'trend-reversal-risk' | 'mixed';
    priorTrendDirection: 'up' | 'down' | 'sideways';
    structureIntact: boolean;
    detectedPatterns: { 
      name: string; 
      type: 'bullish' | 'bearish' | 'neutral'; 
      confidence: number; 
      location: string;
      outcome?: 'active' | 'confirmed' | 'failed';
      outcomeDescription?: string;
    }[];
  };
  
  // Support/Resistance
  levels: {
    nearestSupport: number;
    nearestResistance: number;
    supportStrength: number;
    resistanceStrength: number;
    keyLevels: { price: number; type: 'support' | 'resistance'; touches: number }[];
  };
  
  // Squeeze Data
  squeeze: {
    isInSqueeze: boolean;
    squeezeDuration: number;
    momentumDirection: 'bullish' | 'bearish' | 'neutral';
    fireConfirmed: boolean;
  };
  
  // Regime Detection
  regime: {
    type: 'TRENDING' | 'RANGE_BOUND' | 'REVERSAL_ATTEMPT' | 'VOLATILITY_EXPANSION' | 'UNCERTAIN';
    direction: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    evidence: string[];
  };
}

export interface AIAnalysisOutput {
  // Signal Strength with Reasoning
  signalStrength: {
    overall: number;
    grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
    direction: 'bullish' | 'bearish' | 'neutral';
    reasoning: string[];
    breakdown: {
      trend: { score: number; assessment: string };
      momentum: { score: number; assessment: string };
      volume: { score: number; assessment: string };
      volatility: { score: number; assessment: string };
      pattern: { score: number; assessment: string };
    };
  };
  
  // AI Structure Analysis (replaces hardcoded analysis)
  structureAnalysis?: {
    classification: 'likely-pullback' | 'trend-reversal-risk' | 'consolidation' | 'breakout-attempt' | 'mixed';
    confidence: number;
    priorTrend: 'up' | 'down' | 'sideways';
    summary: string;
    pullbackSignals: string[];
    reversalSignals: string[];
    patternAnalysis: string;
    structureIntact: boolean;
  };
  
  // Price Projections with Probability Context
  priceProjections: {
    bullCase: {
      target: number | string;  // Can be exact number or range string like "$12.00 - $12.50"
      targetLow?: number;       // If range, the low end
      targetHigh?: number;      // If range, the high end
      probability: number;
      timeframe: string;
      reasoning: string;
    };
    baseCase: {
      target: number | string;  // Can be exact number or range string
      targetLow?: number;
      targetHigh?: number;
      probability: number;
      timeframe: string;
      reasoning: string;
    };
    bearCase: {
      target: number | string;  // Can be exact number or range string
      targetLow?: number;
      targetHigh?: number;
      probability: number;
      timeframe: string;
      reasoning: string;
    };
    mostLikely: 'bull' | 'base' | 'bear';
  };
  
  // Strategy Recommendation with Context
  recommendation: {
    action: 'long' | 'short' | 'wait';
    strategy: string;
    confidence: number;
    confidenceReasoning: string;
    entry: {
      type: 'market' | 'limit' | 'breakout' | 'pullback';
      price: number;
      conditions: string[];
    };
    stopLoss: {
      price: number;
      riskPercent: number;
      reasoning: string;
    };
    targets: {
      t1: { price: number; rr: number; probability: number; reasoning: string };
      t2: { price: number; rr: number; probability: number; reasoning: string };
      t3: { price: number; rr: number; probability: number; reasoning: string };
    };
    invalidation: string;
    keyRisks: string[];
    keyOpportunities: string[];
  };
  
  // Comprehensive Narrative
  narrative: {
    headline: string;
    technicalOutlook: string;
    keyInsights: string[];
    tradingPlan: string;
    riskFactors: string[];
    confidenceLevel: 'high' | 'medium' | 'low';
  };
}

const AI_ANALYST_SYSTEM_PROMPT = `You are an expert technical analyst providing professional-grade market analysis. Your role is to interpret technical indicators, chart patterns, and market structure to generate actionable trading insights.

## 🚨 MANDATORY DIRECTION DETERMINATION (EXECUTE FIRST - BEFORE ANY OTHER ANALYSIS)

Before writing ANY output, you MUST determine the PRIMARY DIRECTION using this exact algorithm:

**STEP 1: Check ADX + DI (This is NON-NEGOTIABLE)**
- IF ADX ≥ 25 AND +DI > -DI → PRIMARY_DIRECTION = "bullish"
- IF ADX ≥ 25 AND -DI > +DI → PRIMARY_DIRECTION = "bearish"
- IF ADX < 25 → PRIMARY_DIRECTION = "neutral/ranging" (patterns matter more here)

**STEP 2: Check Price vs EMAs**
- IF price above ALL major EMAs (20, 50, 200) → TREND_CONTEXT = "strong uptrend"
- IF price below ALL major EMAs → TREND_CONTEXT = "strong downtrend"
- IF price mixed vs EMAs → TREND_CONTEXT = "mixed/transitional"

**STEP 3: Combine (THIS DETERMINES YOUR OUTPUT)**
- ADX ≥ 25 + +DI > -DI + price above EMAs = **BULLISH** (signalStrength.direction MUST be "bullish")
- ADX ≥ 25 + -DI > +DI + price below EMAs = **BEARISH** (signalStrength.direction MUST be "bearish")
- ADX < 25 OR conflicting signals = **NEUTRAL** (signalStrength.direction = "neutral")

**🚫 FORBIDDEN ACTIONS:**
- NEVER output direction="bearish" when ADX ≥ 25 AND +DI > -DI AND price above EMAs
- NEVER let bearish PATTERNS override bullish STRUCTURE (ADX/DI/EMAs)
- NEVER contradict the PRIMARY_DIRECTION in your narrative or recommendations

**PATTERNS ARE SECONDARY (Max 20% weight in strong trends):**
- In strong trend (ADX > 30): Patterns = timing signals, NOT direction changers
- Bearish pattern in strong uptrend = "pullback risk" NOT "bearish outlook"
- Only escalate pattern importance if ADX < 25 (weak/no trend)

## CRITICAL RULES

1. **Base ALL assessments on the provided data** - never invent indicators or patterns not given
2. **Probability estimates must be rooted in confluence** - count supporting vs conflicting signals
3. **Confidence must match uncertainty** - mixed signals = lower confidence, not bullish or bearish
4. **Grade severity must match the actual setup** - don't inflate grades for mediocre setups
5. **Reasoning must be specific** - cite actual indicator values, not generic statements
6. **Be conservative on ENTRIES, not DIRECTION** - wait for better entries, but don't flip direction without structure break
7. **USE EXACT VALUES FROM DATA** - When citing indicators (Volume Z-Score, CMF, RSI, etc.), ALWAYS use the EXACT values from the provided data. NEVER round, estimate, or use placeholder values like "0.00". If the data says Volume Z-Score is 0.09, you MUST write "0.09", not "0.00".
8. **PATTERNS CANNOT OVERRIDE STRUCTURE** - A Shooting Star or Harami in a strong uptrend (ADX > 25, +DI > -DI) is a PULLBACK signal, not a REVERSAL signal. Direction stays bullish.

## ⚠️ GLOBAL COHERENCE RULES (CRITICAL - ENFORCE ACROSS ALL SECTIONS)

You must generate ONE coherent, internally consistent view. All sections (trend, momentum, volume, patterns, projections, strategy) MUST support the SAME underlying narrative. Never generate disconnected modules.

### 1. EMAs + DI/ADX = PRIMARY REGIME (This Overrides Patterns)
**The EMA structure + DI/ADX readings define the primary regime. Short-term patterns are SECONDARY.**

- If EMAs bullish (stacked up) AND +DI > -DI → PRIMARY DIRECTION = BULLISH
  - Even with bearish patterns, direction stays "bullish" or "uptrend with caution"
  - NEVER flip to "bearish" or "mixed" just because of a Harami or Dark Cloud Cover
- If ADX ≥ 25 AND +DI > -DI AND price above key EMAs → STRONG BULLISH TREND
- If ADX ≤ 20 AND price chopping around EMAs → RANGE / MIXED (patterns matter more here)
- If ADX rising from <20 to >25 recently → TREND EMERGING

**HIERARCHY**: EMAs + DI/ADX (primary) > Volume/Momentum > Patterns (secondary)
- **FORBIDDEN**: Calling trend "strong uptrend" in one section and "bearish/mixed/no clear edge" in another
- **REQUIRED**: If EMAs bullish + DI bullish, top-line direction MUST be bullish (can add "with caution" if patterns warn)

### 2. Align Grade/Strength/Confidence With the Narrative
- If you say "no clear edge" or "WAIT" → Strength and Confidence should be MODERATE TO LOW
- If you say "strong trend, clear continuation" → Strength and Confidence should be HIGHER, strategy should NOT be "no trade"
- **FORBIDDEN**: Saying "strong uptrend" but giving Grade C and "no clear edge"

### 3. Level Labels Must Be Logically Correct and Anchored to Structure
- **"Support (Bearish Breakdown)"** = MUST be:
  - BELOW current price (always)
  - Anchored to the REAL structural "line in the sand" (the main support used in your trading plan)
  - The level that, if broken DOWN, invalidates the bullish thesis
  - Example: If current price = $120, support = $115 (recent swing low), NOT $118 (mid-range)

- **"Resistance (Bullish Breakout)"** = MUST be:
  - ABOVE current price (always)
  - Aligned with actual breakout triggers from your analysis
  - The level that, if broken UP, confirms bullish continuation/breakout

- **FORBIDDEN**: 
  - Using the same price as both "breakout trigger" and "breakdown level"
  - Labeling a price above current as "Support (Bearish Breakdown)"
  - Using mid-range prices as support when the real structural support is lower
  - Saying support is $118 when your trading plan stop loss is at $115 (use $115 as support)

### 4. Single Patterns Are SECONDARY - THEY CANNOT FLIP DIRECTION IN STRONG TRENDS

**🚨 EXAMPLE SCENARIO (COMMON MISTAKE TO AVOID):**
Data: ADX=39, +DI=33 > -DI=15, Price above all EMAs, RSI=62, OBV rising, CMF positive
Patterns: Shooting Star, Bearish Harami present

❌ WRONG OUTPUT: direction="bearish", Signal Grade C, Strength 45
✅ CORRECT OUTPUT: direction="bullish", Signal Grade B (reduced from A due to patterns), Strength 65+
   - Narrative: "Strong uptrend with pullback risk - patterns suggest waiting for better entry"
   - Strategy: "Pullback Long" or "Wait for pullback to EMA support"

**In a STRONG UPTREND (ADX > 25, +DI > -DI, price above EMAs):**
- Bearish Harami, Shooting Star, Evening Star = **TIMING SIGNALS, NOT DIRECTION CHANGERS**
- These patterns suggest: "Wait for pullback" NOT "Go bearish"
- The DIRECTION stays "bullish" - only CONFIDENCE/ENTRY changes
- Say: "Strong uptrend with near-term pullback risk" NOT "bearish outlook"
- Grade: B or B- (not C or below unless other major issues)
- Strength: 60-75 (not below 55 in strong trends)

**Only flip to bearish/neutral direction if:**
1. ADX < 25 (no confirmed trend)
2. OR -DI > +DI (sellers in control)
3. OR Price broke below key EMAs (structure broken)
4. OR Major support level broken with volume

**PATTERN IMPACT BY REGIME:**
| ADX Level | Pattern Weight | Direction Can Flip? |
|-----------|----------------|---------------------|
| ADX > 35  | 10-15%        | NO - structure rules |
| ADX 25-35 | 20-30%        | Only with confirmation |
| ADX < 25  | 40-50%        | YES - patterns matter more |

**THE STORY MUST MATCH**: 
- Strong uptrend (ADX > 25, +DI > -DI) + bearish pattern → "bullish with pullback risk, wait for entry"
- NOT "bearish" or "no clear edge" - that contradicts the trend data

### 5. Volume Interpretation Rules
- CMF > 0 AND OBV rising → "volume supportive / accumulation present" (even if Z-score ~0)
- Z-score ~0, OBV flat, CMF slightly positive → "neutral to mildly supportive, no strong confirmation"
- **Only say "volume not confirming"** when MOST volume metrics (OBV, CMF, Z-score) fail to support price move
- **FORBIDDEN**: Saying "volume not confirming" when CMF is positive and OBV is rising

### 6. Projections MUST Match Trading Plan
- If Base Case = "drift higher from X to Y", then suggested entry MUST be reachable in that scenario
- If you propose deep pullback entry but call "drift up" most likely, EXPLICITLY state: "Most likely scenario offers poor R:R at current levels, so we prefer waiting for an unlikely but high-R:R pullback"
- **FORBIDDEN**: Base case implies move that user will miss because entry is set too far away without acknowledgment
- Bull case target > Base case target > Bear case target (enforce ordering)
- Probabilities must roughly sum to 100% (95-105% acceptable)

### 7. Strategy Must Be Logical Consequence of Analysis
If recommending **"WAIT / No Clear Edge"**, then:
- Analysis MUST show meaningful pros AND cons (e.g., strong trend vs weak volume + pattern at resistance)
- Entry conditions must be CONCRETE and REALISTIC:
  - Pullback: specific price zone BELOW current + confirmation criteria
  - Breakout: specific price ABOVE current + confirmation criteria

**FORBIDDEN contradictions:**
- "Strong trend, base case bullish" but confidence "low" and "no clear edge" without explaining the issue is ENTRY LOCATION / R:R, not direction
- Labeling a level both "bullish breakout" and "bearish breakdown"

## MANDATORY GRADE PENALTIES (APPLY THESE STRICTLY)

These penalties are NON-NEGOTIABLE. Apply them before determining final grade:

**Oscillator Overbought/Oversold Penalties:**
- Stochastic > 80 in bullish setup → Maximum grade B, max confidence 60%
- Stochastic > 90 in bullish setup → Maximum grade C, max confidence 50%
- RSI > 70 AND Stochastic > 80 → Maximum grade C, consider WAIT

**Volume Non-Confirmation Penalties:**
- Volume Z-Score < 0 → Reduce grade by 1 level (A→B, B→C, etc.)
- Volume Z-Score < 0 AND OBV flat/falling → Maximum grade B, max confidence 55%
- CMF negative (< -0.05) in bullish setup → Reduce confidence by 10%

**Conflicting Pattern Penalties (DOES NOT CHANGE DIRECTION):**
- Bearish reversal pattern in STRONG UPTREND (ADX > 25, +DI > -DI) → Reduce grade by 1 level, suggest "pullback entry" NOT "bearish"
- Bearish pattern at current/recent bar in strong uptrend → WAIT for better entry, direction stays BULLISH
- Multiple bearish patterns in WEAK trend (ADX < 25) → May consider neutral/bearish direction
- **KEY**: Patterns affect ENTRY TIMING and CONFIDENCE, not PRIMARY DIRECTION in strong trends

**Extreme Volatility Penalties:**
- Historical Volatility > 80% → Reduce confidence by 15%, widen risk assessment
- Historical Volatility > 100% → Maximum confidence 55%, must note extreme risk
- ATR% > 6% → Reduce confidence by 10%

**Cumulative Penalty Rule:**
Count the number of red flags (overbought, low volume, negative CMF, bearish patterns, extreme volatility):
- 2 red flags → Maximum grade B, max confidence 55%
- 3+ red flags → Maximum grade C, max confidence 50%, or recommend WAIT
- 4+ red flags → MUST recommend WAIT

## SIGNAL STRENGTH GRADING

| Grade | Score | Requirements |
|-------|-------|--------------|
| A+ | 90-100 | Strong trend (ADX>30), volume confirming (Z>0.5), no overbought, no conflicting patterns |
| A | 75-89 | Clear direction, volume neutral or better, minor concerns only |
| B | 60-74 | Moderate setup, some concerns but tradeable with caution |
| C | 45-59 | Weak setup, significant uncertainty - reduced size or WAIT |
| D | 30-44 | Avoid, conflicting signals dominate |
| F | 0-29 | No edge, sit out |

**Grade A or A+ requires ALL of these:**
- Volume Z-Score ≥ 0 (not negative)
- Stochastic < 80 (not overbought) OR in a confirmed squeeze breakout
- No bearish reversal patterns at current/recent bars
- CMF ≥ 0 (not distribution)

## PROBABILITY ESTIMATION GUIDELINES

**High Probability (65-85%)** - REQUIRES ALL OF:
- ADX > 25 + EMAs aligned + momentum confirming
- Volume Z-Score > 0 (must be positive)
- Stochastic NOT overbought (< 80) OR confirmed breakout
- No conflicting bearish patterns

**Moderate Probability (45-60%)**:
- ADX 20-25 + some alignment + mixed volume
- Pullback to support in uptrend but momentum weakening
- Overbought but with strong trend (ADX > 30)
- One or two conflicting signals present

**Low Probability (25-40%)**:
- ADX < 20 + mixed EMAs + conflicting momentum
- Counter-trend attempt without structure break
- Multiple conflicting signals (overbought + low volume + bearish patterns)
- Reversal pattern without confirmation

## STRATEGY SELECTION RULES

| Regime | ADX | Recommended Strategy |
|--------|-----|---------------------|
| TRENDING | >25 | Trend Following, Pullback Entry |
| RANGE_BOUND | <20 | Wait or Mean Reversion at extremes |
| REVERSAL_ATTEMPT | Any | Wait for confirmation, then Breakout |
| VOLATILITY_EXPANSION | Any | Reduce size, widen stops |
| UNCERTAIN | Any | WAIT - no edge |

## PRICE PROJECTION RULES

**⚠️ FORBIDDEN: Do NOT use the lazy 60%/20%/20% distribution. Probabilities MUST vary based on actual data.**

### Probability Distribution Guidelines (use actual reasoning, not formulas):

**Strong Bullish Setup (ADX>25, volume confirming, no red flags):**
- Bull case: 40-55%
- Base case: 30-45%
- Bear case: 10-20%

**Moderate Bullish Setup (some concerns present):**
- Bull case: 25-35%
- Base case: 40-50%
- Bear case: 20-30%

**Mixed/Uncertain Setup (conflicting signals):**
- Bull case: 20-30%
- Base case: 35-45%
- Bear case: 25-35%

**Bearish Bias Setup (momentum weakening, distribution):**
- Bull case: 10-20%
- Base case: 30-40%
- Bear case: 40-55%

### Price Target Calculation:
**Use RANGES, not exact prices.** Format: "$X.XX - $Y.YY"

- **Bull Case**: Use resistance zone OR current price + 2-3x ATR (e.g., "$12.00 - $12.50")
- **Base Case**: MUST show some movement from current price:
  - Bullish bias: Current price + 0.5-1.5x ATR (e.g., if current $11.71, use "$11.90 - $12.20")
  - Bearish bias: Current price - 0.5-1.5x ATR
  - **NEVER use the exact current price as the target** - that implies no movement
- **Bear Case**: Use support zone OR current price - 1-2x ATR (e.g., "$10.50 - $11.00")

### Target Reasoning Requirements:
- Cite the SPECIFIC support/resistance level or ATR calculation used
- Explain WHY that probability was chosen (e.g., "40% bull case because ADX>30 but volume not confirming")
- Timeframe should match the setup (1 week for base, 2 weeks for extended moves)
- **CRITICAL: Base case target must differ from current price by at least 0.5x ATR**

## OUTPUT FORMAT

You MUST respond with valid JSON matching this EXACT structure:

\`\`\`json
{
  "signalStrength": {
    "overall": 65,
    "grade": "B",
    "direction": "bullish",
    "reasoning": ["ADX at 28.3 confirms trend", "Volume Z-score -0.31 not confirming move"],
    "breakdown": {
      "trend": { "score": 80, "assessment": "Strong uptrend with ADX 28.3, +DI 24.5 > -DI 15.2" },
      "momentum": { "score": 70, "assessment": "RSI 62.1 bullish, Stochastic 78.4 near overbought" },
      "volume": { "score": 45, "assessment": "Volume Z-score -0.31 not confirming, CMF -0.045 slightly negative" },
      "volatility": { "score": 55, "assessment": "ATR% 5.23% elevated, wider stops needed" },
      "pattern": { "score": 60, "assessment": "Hammer detected 2 bars ago, bearish engulfing forming" }
    }
  },
  "structureAnalysis": {
    "classification": "likely-pullback",
    "confidence": 70,
    "priorTrend": "up",
    "summary": "Price is pulling back within an established uptrend. The Hammer pattern 2 bars ago suggests buying interest at support, but the current bearish engulfing pattern warrants caution. Structure remains intact with higher lows holding.",
    "pullbackSignals": ["Higher lows intact above $18.50", "Price holding above 20 EMA", "ADX still above 25 showing trend strength"],
    "reversalSignals": ["Bearish engulfing at current bar", "Volume slightly elevated on down day"],
    "patternAnalysis": "The Hammer 2 bars ago (confirmed with follow-through) suggests buyers stepped in. However, today's bearish engulfing is a warning sign. Net interpretation: healthy pullback but watch for follow-through below $18.50.",
    "structureIntact": true
  },
  "priceProjections": {
    "bullCase": { "target": "$21.00 - $21.80", "targetLow": 21.00, "targetHigh": 21.80, "probability": 30, "timeframe": "2 weeks", "reasoning": "Resistance zone $21.00-$21.80 (prior swing high area) - 30% because volume currently weak and not confirming" },
    "baseCase": { "target": "$19.50 - $20.20", "targetLow": 19.50, "targetHigh": 20.20, "probability": 45, "timeframe": "1 week", "reasoning": "Expected consolidation/slight drift up from current $19.10 (+0.5-1x ATR) - 45% as structure intact but momentum mixed" },
    "bearCase": { "target": "$18.20 - $18.70", "targetLow": 18.20, "targetHigh": 18.70, "probability": 25, "timeframe": "1 week", "reasoning": "Support zone near 20 EMA ($18.50) could be tested - 25% because uptrend still intact" },
    "mostLikely": "base"
  },
  "recommendation": {
    "action": "wait",
    "strategy": "Wait for Confirmation",
    "confidence": 55,
    "confidenceReasoning": "Conflicting signals: strong trend but overbought oscillators and bearish pattern forming. Wait for either bullish confirmation (close above $20) or pullback to support ($18.50).",
    "entry": { "type": "pullback", "price": 18.70, "conditions": ["Wait for pullback to 20 EMA around $18.50-$18.70", "Need volume confirmation on bounce"] },
    "stopLoss": { "price": 17.80, "riskPercent": 4.8, "reasoning": "Below swing low at $17.80 invalidates pullback thesis" },
    "targets": {
      "t1": { "price": 20.00, "rr": 1.4, "probability": 65, "reasoning": "Psychological level and prior resistance" },
      "t2": { "price": 21.00, "rr": 2.4, "probability": 45, "reasoning": "Prior swing high zone" },
      "t3": { "price": 22.00, "rr": 3.6, "probability": 25, "reasoning": "Extended target only if volume surge" }
    },
    "invalidation": "Close below $17.80 swing low",
    "keyRisks": ["Bearish engulfing pattern may signal reversal", "Volume not confirming upside", "Stochastic overbought"],
    "keyOpportunities": ["Strong underlying trend (ADX 28)", "Higher lows structure intact"]
  },
  "narrative": {
    "headline": "Pullback in uptrend - wait for confirmation",
    "technicalOutlook": "The underlying trend remains bullish with ADX at 28 and higher lows intact. However, the current bearish engulfing pattern and overbought Stochastic suggest waiting for a better entry rather than chasing.",
    "keyInsights": ["Trend intact with ADX 28", "Bearish engulfing pattern forming", "Volume not confirming recent move", "Support at 20 EMA ($18.50)"],
    "tradingPlan": "Wait for either: (1) pullback to $18.50-$18.70 with volume confirmation, or (2) close above $20 with volume surge.",
    "riskFactors": ["Overbought oscillators", "Bearish reversal pattern", "Weak volume"],
    "confidenceLevel": "medium"
  }
}
\`\`\`

**CRITICAL: Probability Validation**
- Bull + Base + Bear probabilities should sum to ~100% (95-105% acceptable)
- NEVER use exactly 60/20/20 or 50/25/25 - these are lazy defaults
- Each probability must be justified by specific data points
- If signals are mixed, base case should be highest (40-50%)
- If signals are strongly directional, that direction's case should be highest

**CRITICAL: Coherence Self-Check Before Output**
Before finalizing your response, verify these coherence rules:

1. **🚨 DIRECTION vs STRUCTURE CHECK (MOST IMPORTANT)**:
   - IF ADX > 25 AND +DI > -DI AND price above EMAs → Did I output direction="bullish"?
   - IF I said "bearish" or "neutral" → Is ADX < 25 OR -DI > +DI OR price below EMAs?
   - **FORBIDDEN**: direction="bearish" when ADX=39, +DI=33, -DI=15, price above all EMAs

2. **Regime Consistency**: Did I use the SAME regime description throughout? (e.g., not "strong uptrend" in trend section but "bearish" in direction)

3. **Grade-Narrative Alignment**: Does my grade/confidence match my narrative?
   - Strong uptrend (ADX > 25, +DI > -DI) → Minimum grade B, minimum strength 55
   - Weak/ranging (ADX < 25) → Grade can be C or lower

4. **Level Logic**: Are ALL support levels BELOW current price? Are ALL resistance levels ABOVE current price?

5. **Volume Consistency**: If CMF > 0 and OBV rising, did I say "volume supportive" (not "volume not confirming")?

6. **Pattern Weighting in Strong Trends**: 
   - ADX > 25 with bearish patterns → Did I recommend "pullback entry" NOT "bearish outlook"?
   - Patterns should affect ENTRY, not flip DIRECTION in strong trends

7. **Projection-Plan Alignment**: Will the user actually participate in the base case scenario with my suggested entry? If not, did I explicitly acknowledge this?

8. **Contradiction Check**: Did I label any level as BOTH a "breakout" trigger AND a "breakdown" level?

**FINAL SANITY CHECK**: If ADX > 30 and +DI > -DI by 15+ points, direction MUST be "bullish" regardless of patterns.

If ANY check fails, revise your output before responding.
`;

/**
 * INTRADAY TRADING SYSTEM PROMPT
 * Specialized for day trading / scalping on timeframes <= 1 hour
 * DIFFERENT from swing trading: different EMAs, targets, stops, and evaluation criteria
 */
const AI_INTRADAY_SYSTEM_PROMPT = `You are an expert DAY TRADER providing professional-grade INTRADAY analysis. Your evaluation philosophy is fundamentally different from a swing trader.

## DAY TRADER vs SWING TRADER MINDSET

**Swing Trader (1D)**: Holds days/weeks, cares about 50/200 EMA, multi-day trends, weekly support/resistance.
**Day Trader (5m/15m/1h)**: Holds minutes to hours, SAME-DAY only. Cares about 8/13/21 EMA, intraday structure, today's high/low, NOT 50/200 EMA.

## CRITICAL INTRADAY RULES

1. **TIMEFRAME-SPECIFIC CONTEXT**
   - **5min**: Scalping - targets 0.5-1x ATR, stops 0.3-0.5x ATR, hold 15-60 min
   - **15min**: Day trading - targets 1-1.5x ATR, stops 0.5-0.75x ATR, hold 1-4 hours
   - **1hour**: Short-term day trade - targets 1-2x ATR, stops 0.75-1x ATR, hold 2-6 hours
   - **1min**: Ultra-scalping - very tight targets, high frequency
   - ALL positions must be closed by market close - no overnight holds

2. **INTRADAY-SPECIFIC INDICATORS (IGNORE SWING INDICATORS)**
   - **EMAs**: Use 8 (fast), 13 (medium), 21 (slow) - the 50 and 200 EMA in the data are provided but are SECONDARY for intraday; 8/13/21 define structure
   - **Volume**: Relative volume vs recent bars matters more than daily Z-score
   - **ATR**: Represents INTRADAY range - use for stops/targets in points/cents, not multi-day volatility
   - **ADX/DI**: Same interpretation - >25 = trending, <20 = choppy range

3. **INTRADAY TARGETS (TIGHTER THAN SWING)**
   - T1: 0.5x - 1x ATR (quick scalp)
   - T2: 1x - 1.5x ATR (momentum)
   - T3: 1.5x - 2x ATR (extended - rare)
   - Projection timeframes: "next 30 min", "next 1-2 hours" - NEVER "1-2 weeks"

4. **INTRADAY STOPS**
   - Tighter: 0.5x - 1x ATR typical
   - Use recent swing high/low within the intraday data

5. **INTRADAY STRATEGIES**
   - Intraday Breakout: Break of session high/low with volume
   - Intraday Pullback: Retrace to 8/13/21 EMA in established intraday trend
   - Mean Reversion: Fade extended moves back to EMAs
   - Range: Buy support / sell resistance within today's range

## MANDATORY INTRADAY GRADE ADJUSTMENTS

- Low relative volume → Max grade B
- Choppy/range-bound (ADX < 20) → Recommend WAIT, max confidence 55%
- Conflicting 8/13/21 EMA structure → Max confidence 55%
- Multiple timeframes conflicting → WAIT

## OUTPUT FORMAT

Use the SAME JSON structure, but:
- **timeframe** in projections: "next 30-60 min" (5min), "next 1-2 hours" (15min/1h) - NEVER "1-2 weeks"
- **strategy**: Prefix with "Intraday" e.g. "Intraday Pullback Long", "Intraday Breakout Short"
- **targets**: Tighter, ATR-based, same-day achievable
- **headline/narrative**: Day-trading language ("scalp", "intraday", "session") not swing ("swing", "hold", "week")

## COHERENCE

1. 8 EMA > 13 EMA > 21 EMA → Intraday BULLISH
2. 8 EMA < 13 EMA < 21 EMA → Intraday BEARISH
3. Mixed EMAs → RANGE / WAIT
4. Day trading = PRECISION. If unclear, recommend WAIT.
`;

function scoreToGrade(score: number): AIAnalysisOutput['signalStrength']['grade'] {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

/**
 * Normalize AI response - handles snake_case (signal_strength), numeric scores, and different structures
 */
function normalizeAIResponse(parsed: any): AIAnalysisOutput | null {
  const raw = parsed.analysis ?? parsed;
  const ssRaw = raw.signalStrength ?? raw.signal_strength ?? raw.SignalStrength;
  if (ssRaw == null) return null;

  // Handle when signal_strength is a number (LLM returns flat structure)
  let ss: Record<string, any>;
  if (typeof ssRaw === 'number') {
    ss = { overall: ssRaw, grade: scoreToGrade(ssRaw), direction: 'neutral', reasoning: [], breakdown: {} };
  } else if (typeof ssRaw === 'object') {
    ss = ssRaw;
  } else {
    return null;
  }

  // Normalize direction - extract bullish/bearish/neutral from strings like "Bullish bias (but RECOMMEND WAIT)"
  let dir = (ss.direction ?? ss.bias ?? 'neutral');
  if (typeof dir === 'string') {
    const d = dir.toLowerCase();
    dir = d.includes('bullish') ? 'bullish' : d.includes('bearish') ? 'bearish' : 'neutral';
  }

  const signalStrength = {
    overall: ss.overall ?? ss.score ?? ss.value ?? 50,
    grade: (ss.grade ?? ss.letter ?? scoreToGrade(ss.overall ?? ss.score ?? 50)) as AIAnalysisOutput['signalStrength']['grade'],
    direction: dir as 'bullish' | 'bearish' | 'neutral',
    reasoning: Array.isArray(ss.reasoning) ? ss.reasoning : (ss.reasoning ? [ss.reasoning] : []),
    breakdown: ss.breakdown ?? {},
  };

  const normalizeTarget = (t: any): { price: number; rr: number; probability: number; reasoning: string } => {
    if (!t || typeof t !== 'object') return { price: 0, rr: 0, probability: 0, reasoning: '' };
    return {
      price: t.price ?? t.target ?? 0,
      rr: t.rr ?? t.risk_reward ?? 0,
      probability: t.probability ?? t.prob ?? 0,
      reasoning: t.reasoning ?? t.reason ?? '',
    };
  };

  const recRaw = raw.recommendation ?? raw.strategy_recommendation ?? raw.strategyRecommendation;
  const rec = typeof recRaw === 'string' ? { strategy: recRaw, action: 'wait' } : recRaw;
  const recTargets = rec?.targets;
  const recommendation = rec ? {
    action: (rec.action ?? rec.signal ?? 'wait') as 'long' | 'short' | 'wait',
    strategy: rec.strategy ?? rec.recommendation ?? (typeof recRaw === 'string' ? recRaw : 'Wait'),
    confidence: rec.confidence ?? rec.confidence_level ?? 50,
    confidenceReasoning: rec.confidenceReasoning ?? rec.confidence_reasoning ?? rec.reasoning ?? '',
    entry: rec.entry ?? { type: 'limit', price: 0, conditions: [] },
    stopLoss: rec.stopLoss ?? rec.stop_loss ?? { price: 0, riskPercent: 0, reasoning: '' },
    targets: recTargets ? {
      t1: normalizeTarget(recTargets.t1 ?? recTargets.target_1),
      t2: normalizeTarget(recTargets.t2 ?? recTargets.target_2),
      t3: normalizeTarget(recTargets.t3 ?? recTargets.target_3),
    } : { t1: { price: 0, rr: 0, probability: 0, reasoning: '' }, t2: { price: 0, rr: 0, probability: 0, reasoning: '' }, t3: { price: 0, rr: 0, probability: 0, reasoning: '' } },
    invalidation: rec.invalidation ?? '',
    keyRisks: Array.isArray(rec.keyRisks) ? rec.keyRisks : (rec.key_risks ? (Array.isArray(rec.key_risks) ? rec.key_risks : [rec.key_risks]) : []),
    keyOpportunities: Array.isArray(rec.keyOpportunities) ? rec.keyOpportunities : (rec.key_opportunities ? (Array.isArray(rec.key_opportunities) ? rec.key_opportunities : [rec.key_opportunities]) : []),
  } : { action: 'wait' as const, strategy: 'Wait', confidence: 50, confidenceReasoning: '', entry: { type: 'limit' as const, price: 0, conditions: [] }, stopLoss: { price: 0, riskPercent: 0, reasoning: '' }, targets: { t1: { price: 0, rr: 0, probability: 0, reasoning: '' }, t2: { price: 0, rr: 0, probability: 0, reasoning: '' }, t3: { price: 0, rr: 0, probability: 0, reasoning: '' } }, invalidation: '', keyRisks: [], keyOpportunities: [] };

  const normalizeCase = (c: any): { target: number | string; targetLow?: number; targetHigh?: number; probability: number; timeframe: string; reasoning: string } => {
    if (!c || typeof c !== 'object') return { target: 0, probability: 33, timeframe: '', reasoning: '' };
    const t = c.target ?? c.target_price ?? c.price ?? 0;
    const tLow = c.targetLow ?? c.target_low ?? (typeof t === 'number' ? t : undefined);
    const tHigh = c.targetHigh ?? c.target_high ?? (typeof t === 'number' ? t : undefined);
    const prob = c.probability ?? c.prob ?? 33;
    const tf = c.timeframe ?? c.time_frame ?? '';
    const reason = c.reasoning ?? c.reason ?? '';
    return {
      target: typeof t === 'string' ? t : (tLow ?? tHigh ?? t),
      targetLow: typeof tLow === 'number' ? tLow : undefined,
      targetHigh: typeof tHigh === 'number' ? tHigh : undefined,
      probability: typeof prob === 'number' ? prob : 33,
      timeframe: String(tf),
      reasoning: String(reason),
    };
  };

  const proj = raw.priceProjections ?? raw.projections;
  const priceProjections = proj ? {
    bullCase: normalizeCase(proj.bullCase ?? proj.bull_case ?? proj.bull),
    baseCase: normalizeCase(proj.baseCase ?? proj.base_case ?? proj.base),
    bearCase: normalizeCase(proj.bearCase ?? proj.bear_case ?? proj.bear),
    mostLikely: (proj.mostLikely ?? proj.most_likely ?? 'base') as 'bull' | 'base' | 'bear',
  } : undefined;

  const narrRaw = raw.narrative ?? raw.narrative_summary;
  const narrative = narrRaw ? (
    typeof narrRaw === 'string'
      ? { headline: narrRaw, technicalOutlook: '', keyInsights: [], tradingPlan: '', riskFactors: [], confidenceLevel: 'medium' as const }
      : {
          headline: narrRaw.headline ?? narrRaw.summary ?? 'Analysis complete',
          technicalOutlook: narrRaw.technicalOutlook ?? narrRaw.technical_outlook ?? narrRaw.outlook ?? '',
          keyInsights: narrRaw.keyInsights ?? narrRaw.key_insights ?? [],
          tradingPlan: narrRaw.tradingPlan ?? narrRaw.trading_plan ?? '',
          riskFactors: narrRaw.riskFactors ?? narrRaw.risk_factors ?? [],
          confidenceLevel: (narrRaw.confidenceLevel ?? narrRaw.confidence_level ?? 'medium') as 'high' | 'medium' | 'low',
        }
  ) : undefined;

  return {
    signalStrength,
    structureAnalysis: raw.structureAnalysis ?? raw.structure_analysis,
    priceProjections,
    recommendation,
    narrative: narrative ?? { headline: 'Analysis', technicalOutlook: '', keyInsights: [], tradingPlan: '', riskFactors: [], confidenceLevel: 'medium' },
  } as AIAnalysisOutput;
}

export async function generateAITechnicalAnalysis(
  input: AIAnalysisInput,
  _apiKey?: string,
  isIntraday: boolean = false
): Promise<AIAnalysisOutput | null> {
  try {
    const context = buildAnalysisContext(input, isIntraday);
    const systemPrompt = isIntraday ? AI_INTRADAY_SYSTEM_PROMPT : AI_ANALYST_SYSTEM_PROMPT;
    
    const result = await callLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context }
      ],
      temperature: 0.1,
      maxTokens: 2500,
      jsonMode: true,
    });

    if (!result.content) {
      console.error('[AI Analyst] No content in response');
      return null;
    }

    // Extract JSON from response - reasoning models may wrap in markdown or <think> tags
    let contentToParse = result.content.trim();
    const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      contentToParse = jsonMatch[1].trim();
    }
    const thinkEnd = contentToParse.indexOf('</think>');
    if (thinkEnd !== -1) {
      contentToParse = contentToParse.slice(thinkEnd + 8).trim();
    }

    try {
      const parsed = JSON.parse(contentToParse) as any;
      const normalized = normalizeAIResponse(parsed);
      if (!normalized?.signalStrength) {
        console.error('[AI Analyst] Parsed JSON missing signalStrength after normalize. Top-level keys:', Object.keys(parsed));
        return null;
      }
      console.log(`[AI Analyst] Successfully generated analysis via ${result.provider}/${result.model}`);
      return normalized as AIAnalysisOutput;
    } catch (parseError) {
      console.error('[AI Analyst] JSON Parse Error:', parseError);
      return null;
    }
    
  } catch (error) {
    console.error('[AI Analyst] Error:', error);
    return null;
  }
}

function buildAnalysisContext(input: AIAnalysisInput, isIntraday: boolean = false): string {
  const { symbol, timeframe, currentPrice, indicators, trend, momentum, volatility, structure, levels, squeeze, regime } = input;
  
  // Determine trading style and holding period by exact timeframe
  let tradingStyle: string;
  let holdingPeriod: string;
  let projectionHint: string;
  
  if (isIntraday) {
    switch (timeframe) {
      case '1min': tradingStyle = 'ULTRA-SCALPING'; holdingPeriod = 'minutes'; projectionHint = 'next 15-45 min'; break;
      case '5min': tradingStyle = 'SCALPING / DAY TRADING'; holdingPeriod = '15-60 minutes'; projectionHint = 'next 30-90 min'; break;
      case '15min': tradingStyle = 'DAY TRADING'; holdingPeriod = '1-4 hours (same day)'; projectionHint = 'next 1-2 hours'; break;
      case '1hour': tradingStyle = 'SHORT-TERM DAY TRADING'; holdingPeriod = '2-6 hours (same day)'; projectionHint = 'next 2-4 hours'; break;
      default: tradingStyle = 'DAY TRADING'; holdingPeriod = 'minutes to hours (same day)'; projectionHint = 'next 1-2 hours';
    }
  } else {
    tradingStyle = 'SWING TRADING';
    holdingPeriod = 'days to weeks';
    projectionHint = '1-2 weeks';
  }
  
  let context = `# Technical Analysis Request: ${symbol} (${timeframe})\n\n`;
  context += `**Chart Timeframe**: ${timeframe}\n`;
  context += `**Trading Style**: ${tradingStyle}\n`;
  context += `**Expected Holding Period**: ${holdingPeriod}\n`;
  context += `**Projection Timeframe**: ${projectionHint}\n`;
  context += `**Current Price**: $${currentPrice.toFixed(2)}\n\n`;
  
  // Add timeframe-specific context for day trading
  if (isIntraday) {
    context += `## ⚠️ DAY TRADING / INTRADAY CONTEXT (NOT SWING)\n`;
    context += `You are analyzing a ${timeframe} chart for a DAY TRADER. Evaluate like a day trader would:\n`;
    context += `- Primary EMAs: 8 (fast), 13 (medium), 21 (slow) - these define intraday structure\n`;
    context += `- 50/200 EMA are secondary (too slow for this timeframe)\n`;
    context += `- Targets and stops in ATR multiples - use TIGHTER stops than swing (0.5-1x ATR)\n`;
    context += `- All projections must be achievable SAME DAY - use "${projectionHint}" in your reasoning\n`;
    context += `- Strategy names: "Intraday Pullback Long", "Intraday Breakout" etc.\n`;
    context += `- No "hold for weeks" or "swing" language - this is same-day only\n\n`;
  }
  
  // Core Indicators
  context += `## Core Indicators\n\n`;
  context += `| Indicator | Value | Signal |\n`;
  context += `|-----------|-------|--------|\n`;
  context += `| RSI(14) | ${indicators.rsi.toFixed(1)} | ${indicators.rsiSignal} |\n`;
  context += `| MACD Histogram | ${indicators.macd.histogram.toFixed(3)} | ${indicators.macd.trend} |\n`;
  context += `| ADX | ${indicators.adx.toFixed(1)} | ${indicators.adx >= 25 ? 'Trending' : indicators.adx >= 20 ? 'Developing' : 'Weak/Range'} |\n`;
  context += `| +DI / -DI | ${indicators.plusDI.toFixed(1)} / ${indicators.minusDI.toFixed(1)} | ${indicators.plusDI > indicators.minusDI ? 'Bullish' : 'Bearish'} |\n`;
  context += `| Stochastic K | ${indicators.stochastic.k.toFixed(1)} | ${indicators.stochastic.signal} |\n`;
  context += `| ATR | ${indicators.atr.toFixed(2)} (${indicators.atrPercent.toFixed(1)}%) | ${indicators.atrPercent > 5 ? 'High Vol' : indicators.atrPercent > 2.5 ? 'Normal' : 'Low Vol'} |\n`;
  context += `| Volume Z-Score | ${indicators.volumeZScore.toFixed(2)} | ${indicators.volumeZScore > 1 ? 'High' : indicators.volumeZScore > 0 ? 'Normal' : 'Low'} |\n`;
  context += `| CMF | ${indicators.cmf.toFixed(3)} | ${indicators.cmf > 0.1 ? 'Accumulation' : indicators.cmf < -0.1 ? 'Distribution' : 'Neutral'} |\n`;
  context += `| OBV Trend | ${indicators.obvTrend} | - |\n`;
  context += `| Bollinger %B | ${(indicators.bollingerBands.percentB * 100).toFixed(1)}% | ${indicators.bollingerBands.percentB > 0.8 ? 'Overbought' : indicators.bollingerBands.percentB < 0.2 ? 'Oversold' : 'Neutral'} |\n\n`;
  
  // Trend Analysis
  context += `## Trend Analysis\n\n`;
  if (isIntraday) {
    context += `| Timeframe | Direction | Strength |\n`;
    context += `|-----------|-----------|----------|\n`;
    context += `| Short (8-bar) | ${trend.shortTerm.direction} | ${trend.shortTerm.strength.toFixed(0)}% |\n`;
    context += `| Medium (13-bar) | ${trend.intermediate.direction} | ${trend.intermediate.strength.toFixed(0)}% |\n`;
    context += `| Longer (21-bar) | ${trend.primary.direction} | ${trend.primary.strength.toFixed(0)}% |\n\n`;
    context += `**Intraday EMA Alignment (8/13/21)**: ${trend.emaAlignment}\n`;
    context += `**EMA Values**: 8(${trend.ema9.toFixed(2)}), 13(${trend.ema20.toFixed(2)}), 21(${trend.ema50.toFixed(2)}), 50(${trend.ema200.toFixed(2)})\n`;
    context += `**Price vs 21 EMA**: ${((currentPrice - trend.ema50) / trend.ema50 * 100).toFixed(1)}%\n\n`;
  } else {
    context += `| Timeframe | Direction | Strength |\n`;
    context += `|-----------|-----------|----------|\n`;
    context += `| Primary (200-bar) | ${trend.primary.direction} | ${trend.primary.strength.toFixed(0)}% |\n`;
    context += `| Intermediate (50-bar) | ${trend.intermediate.direction} | ${trend.intermediate.strength.toFixed(0)}% |\n`;
    context += `| Short-term (20-bar) | ${trend.shortTerm.direction} | ${trend.shortTerm.strength.toFixed(0)}% |\n\n`;
    context += `**EMA Alignment**: ${trend.emaAlignment}\n`;
    context += `**EMA Values**: 9(${trend.ema9.toFixed(2)}), 20(${trend.ema20.toFixed(2)}), 50(${trend.ema50.toFixed(2)}), 200(${trend.ema200.toFixed(2)})\n`;
    context += `**Price vs 200 EMA**: ${trend.priceVsEma200Pct > 0 ? '+' : ''}${trend.priceVsEma200Pct.toFixed(1)}%\n\n`;
  }
  
  // Momentum
  context += `## Momentum Assessment\n\n`;
  context += `- **Score**: ${momentum.score}/100\n`;
  context += `- **Direction**: ${momentum.direction}\n`;
  context += `- **Strength**: ${momentum.strength}\n`;
  if (momentum.divergences.length > 0) {
    context += `- **Divergences**:\n`;
    momentum.divergences.forEach(d => {
      context += `  - ${d.indicator}: ${d.type} - ${d.description}\n`;
    });
  }
  context += `\n`;
  
  // Volatility
  context += `## Volatility Assessment\n\n`;
  context += `- **Regime**: ${volatility.regime}\n`;
  context += `- **Percentile**: ${volatility.percentile.toFixed(0)}%\n`;
  context += `- **Note**: ${volatility.suggestion}\n\n`;
  
  // Structure
  context += `## Structure Analysis\n\n`;
  context += `- **Classification**: ${structure.classification}\n`;
  context += `- **Prior Trend**: ${structure.priorTrendDirection}\n`;
  context += `- **Structure Intact**: ${structure.structureIntact ? 'Yes' : 'No'}\n`;
  if (structure.detectedPatterns.length > 0) {
    context += `- **Detected Candlestick Patterns**:\n`;
    structure.detectedPatterns.slice(0, 8).forEach(p => {
      const outcomeText = p.outcome === 'failed' ? ' [FAILED - pattern invalidated]' 
        : p.outcome === 'confirmed' ? ' [CONFIRMED]' 
        : ' [ACTIVE]';
      const outcomeDesc = p.outcomeDescription ? ` - ${p.outcomeDescription}` : '';
      context += `  - ${p.name} (${p.type}, ${p.confidence}%) ${p.location}${outcomeText}${outcomeDesc}\n`;
    });
    context += `  **NOTE**: FAILED patterns mean the opposite signal (failed bearish = bullish). CONFIRMED patterns have higher reliability.\n`;
  }
  context += `\n`;
  
  // Support/Resistance
  context += `## Key Levels\n\n`;
  context += `- **Nearest Support**: $${levels.nearestSupport.toFixed(2)} (strength: ${levels.supportStrength.toFixed(0)})\n`;
  context += `- **Nearest Resistance**: $${levels.nearestResistance.toFixed(2)} (strength: ${levels.resistanceStrength.toFixed(0)})\n`;
  if (levels.keyLevels.length > 0) {
    context += `- **Other Key Levels**:\n`;
    levels.keyLevels.slice(0, 5).forEach(l => {
      context += `  - $${l.price.toFixed(2)} (${l.type}, ${l.touches} touches)\n`;
    });
  }
  context += `\n`;
  
  // Squeeze
  context += `## TTM Squeeze Status\n\n`;
  if (squeeze.isInSqueeze) {
    context += `- **Status**: SQUEEZE ON (${squeeze.squeezeDuration} bars)\n`;
    context += `- **Momentum Direction**: ${squeeze.momentumDirection}\n`;
    context += `- **Fire Confirmed**: ${squeeze.fireConfirmed ? 'YES - BREAKOUT' : 'No'}\n`;
  } else {
    context += `- **Status**: No squeeze active\n`;
  }
  context += `\n`;
  
  // Regime
  context += `## Market Regime\n\n`;
  context += `- **Type**: ${regime.type}\n`;
  context += `- **Direction Bias**: ${regime.direction}\n`;
  context += `- **Confidence**: ${regime.confidence}%\n`;
  context += `- **Evidence**:\n`;
  regime.evidence.forEach(e => {
    context += `  - ${e}\n`;
  });
  context += `\n`;
  
  // RED FLAGS ANALYSIS - Explicit warning signals the AI must consider
  context += `## ⚠️ RED FLAGS ANALYSIS (MANDATORY PENALTIES)\n\n`;
  
  const redFlags: string[] = [];
  let maxGrade = 'A+';
  let maxConfidence = 85;
  
  // Check oscillator overbought/oversold
  if (indicators.stochastic.k > 80) {
    redFlags.push(`🚨 STOCHASTIC OVERBOUGHT (${indicators.stochastic.k.toFixed(1)}) - Max grade B, max confidence 60%`);
    maxGrade = 'B';
    maxConfidence = Math.min(maxConfidence, 60);
  }
  if (indicators.stochastic.k > 90) {
    redFlags.push(`🚨 STOCHASTIC EXTREMELY OVERBOUGHT (${indicators.stochastic.k.toFixed(1)}) - Max grade C, max confidence 50%`);
    maxGrade = 'C';
    maxConfidence = Math.min(maxConfidence, 50);
  }
  if (indicators.rsi > 70 && indicators.stochastic.k > 80) {
    redFlags.push(`🚨 RSI (${indicators.rsi.toFixed(1)}) AND Stochastic (${indicators.stochastic.k.toFixed(1)}) both overbought - Consider WAIT`);
    maxGrade = 'C';
    maxConfidence = Math.min(maxConfidence, 50);
  }
  
  // Check volume non-confirmation
  if (indicators.volumeZScore < 0) {
    redFlags.push(`🚨 VOLUME Z-SCORE NEGATIVE (${indicators.volumeZScore.toFixed(2)}) - Volume not confirming, reduce grade by 1 level`);
    if (maxGrade === 'A+') maxGrade = 'A';
    else if (maxGrade === 'A') maxGrade = 'B';
    else if (maxGrade === 'B') maxGrade = 'C';
    maxConfidence = Math.min(maxConfidence, maxConfidence - 5);
  }
  if (indicators.volumeZScore < 0 && (indicators.obvTrend === 'flat' || indicators.obvTrend === 'falling')) {
    redFlags.push(`🚨 LOW VOLUME + OBV ${indicators.obvTrend.toUpperCase()} - Max grade B, max confidence 55%`);
    maxGrade = maxGrade === 'A+' || maxGrade === 'A' ? 'B' : maxGrade;
    maxConfidence = Math.min(maxConfidence, 55);
  }
  if (indicators.cmf < -0.05) {
    redFlags.push(`🚨 CMF NEGATIVE (${indicators.cmf.toFixed(3)}) - Distribution detected, reduce confidence by 10%`);
    maxConfidence = Math.min(maxConfidence, maxConfidence - 10);
  }
  
  // Check for bearish patterns
  const bearishPatterns = structure.detectedPatterns.filter(p => p.type === 'bearish');
  if (bearishPatterns.length > 0) {
    redFlags.push(`🚨 BEARISH PATTERNS DETECTED: ${bearishPatterns.map(p => p.name).join(', ')} - Max confidence 60%`);
    maxConfidence = Math.min(maxConfidence, 60);
  }
  const recentBearishPattern = bearishPatterns.find(p => p.location.includes('current') || p.location.includes('1 bar') || p.location.includes('2 bar'));
  if (recentBearishPattern) {
    redFlags.push(`🚨 RECENT BEARISH PATTERN (${recentBearishPattern.name}) - Consider WAIT or reduce grade by 1 level`);
    if (maxGrade === 'A+') maxGrade = 'A';
    else if (maxGrade === 'A') maxGrade = 'B';
    else if (maxGrade === 'B') maxGrade = 'C';
  }
  
  // Check extreme volatility
  if (volatility.regime === 'high' || volatility.regime === 'expanding') {
    redFlags.push(`🚨 VOLATILITY REGIME: ${volatility.regime.toUpperCase()} - Widen stops, reduce confidence by 10%`);
    maxConfidence = Math.min(maxConfidence, maxConfidence - 10);
  }
  if (volatility.percentile > 80) {
    redFlags.push(`🚨 HIGH VOLATILITY PERCENTILE (${volatility.percentile.toFixed(0)}th) - Reduce confidence by 15%, note extreme risk`);
    maxConfidence = Math.min(maxConfidence, maxConfidence - 15);
  }
  if (indicators.atrPercent > 6) {
    redFlags.push(`🚨 HIGH ATR% (${indicators.atrPercent.toFixed(1)}%) - Extreme daily moves, reduce confidence by 10%`);
    maxConfidence = Math.min(maxConfidence, maxConfidence - 10);
  }
  if (indicators.bollingerBands.bandwidth > 50) {
    redFlags.push(`🚨 BOLLINGER BANDWIDTH VERY WIDE (${indicators.bollingerBands.bandwidth.toFixed(1)}%) - Extreme volatility expansion`);
    maxConfidence = Math.min(maxConfidence, maxConfidence - 5);
  }
  
  if (redFlags.length === 0) {
    context += `✅ No significant red flags detected.\n\n`;
  } else {
    context += `**${redFlags.length} RED FLAG(S) DETECTED - YOU MUST APPLY PENALTIES:**\n\n`;
    redFlags.forEach(flag => {
      context += `${flag}\n`;
    });
    context += `\n**ENFORCED LIMITS based on red flags:**\n`;
    context += `- Maximum allowed grade: ${maxGrade}\n`;
    context += `- Maximum allowed confidence: ${maxConfidence}%\n`;
    if (redFlags.length >= 3) {
      context += `- **3+ red flags = MUST consider WAIT or max grade C with max confidence 50%**\n`;
      maxGrade = 'C';
      maxConfidence = Math.min(maxConfidence, 50);
    }
    if (redFlags.length >= 4) {
      context += `- **4+ red flags = MUST recommend WAIT**\n`;
    }
    context += `\n`;
  }

  // Request
  context += `## Analysis Request\n\n`;
  context += `Based on ALL the above data, provide:\n`;
  context += `1. **Signal Strength** with grade (A+ to F), direction, and specific reasoning citing indicator values\n`;
  context += `2. **Price Projections** for bull/base/bear cases with probability estimates and timeframes\n`;
  context += `3. **Strategy Recommendation** with entry type, stop loss, targets, and confidence reasoning\n`;
  context += `4. **Narrative Summary** suitable for a professional trader\n\n`;
  context += `**CRITICAL REMINDERS:**\n`;
  context += `- ATR = $${indicators.atr.toFixed(2)} for calculating stops and targets\n`;
  context += `- Use the detected regime (${regime.type}) to guide strategy selection\n`;
  context += `- If ADX < 25, express lower confidence in directional trades\n`;
  context += `- If squeeze is ON with neutral momentum, recommend WAIT\n`;
  context += `- **RESPECT THE RED FLAG LIMITS**: Max grade ${maxGrade}, max confidence ${maxConfidence}%\n`;
  context += `- If ${redFlags.length} >= 4 red flags, YOU MUST recommend WAIT\n`;
  context += `- Cite specific numbers in your reasoning\n`;
  
  return context;
}

/**
 * Convert raw technical data to AI analysis input format
 */
export function prepareAIInput(
  symbol: string,
  timeframe: string,
  currentPrice: number,
  indicators: any,
  assessments: any,
  structureAnalysis: any,
  squeeze: any,
  supportResistance: any,
  regime: any,
  isIntraday: boolean = false // Pass intraday context for different analysis
): AIAnalysisInput {
  // For intraday analysis, we use different EMA periods
  // Intraday: 8, 13, 21, 50 EMAs (instead of 9, 20, 50, 200)
  // The 200 EMA on intraday represents ~31 trading days which is too long-term
  return {
    symbol,
    timeframe,
    currentPrice,
    indicators: {
      rsi: indicators.momentum?.rsi ?? 50,
      rsiSignal: indicators.momentum?.rsiSignal ?? 'neutral',
      macd: {
        value: indicators.momentum?.macdLine ?? 0,
        signal: indicators.momentum?.signalLine ?? 0,
        histogram: indicators.momentum?.macdHistogram ?? 0,
        trend: indicators.momentum?.macdHistogram > 0 ? 'bullish' : indicators.momentum?.macdHistogram < 0 ? 'bearish' : 'neutral'
      },
      adx: indicators.trend?.adx ?? 20,
      plusDI: indicators.trend?.plusDI ?? 25,
      minusDI: indicators.trend?.minusDI ?? 25,
      stochastic: {
        k: indicators.momentum?.stochK ?? 50,
        d: indicators.momentum?.stochD ?? 50,
        signal: indicators.momentum?.stochK > 80 ? 'overbought' : indicators.momentum?.stochK < 20 ? 'oversold' : 'neutral'
      },
      atr: indicators.volatility?.atr ?? 1,
      atrPercent: indicators.volatility?.atrPercent ?? 2,
      bollingerBands: {
        upper: indicators.volatility?.bollingerUpper ?? currentPrice * 1.05,
        middle: indicators.volatility?.bollingerMiddle ?? currentPrice,
        lower: indicators.volatility?.bollingerLower ?? currentPrice * 0.95,
        percentB: indicators.volatility?.bollingerPercentB ?? 0.5,
        bandwidth: indicators.volatility?.bollingerBandwidth ?? 10
      },
      volumeZScore: indicators.volume?.zScore ?? indicators.volume?.volumeZScore ?? 0,
      cmf: indicators.volume?.cmf ?? 0,
      obvTrend: indicators.volume?.obvTrend ?? 'flat'
    },
    trend: {
      primary: assessments.trend?.primary ?? { direction: 'sideways', strength: 50 },
      intermediate: assessments.trend?.intermediate ?? { direction: 'sideways', strength: 50 },
      shortTerm: assessments.trend?.shortTerm ?? { direction: 'sideways', strength: 50 },
      emaAlignment: assessments.trend?.emaAlignment ?? 'mixed',
      ema9: indicators.movingAverages?.ema9 ?? currentPrice,
      ema20: indicators.movingAverages?.ema20 ?? currentPrice,
      ema50: indicators.movingAverages?.ema50 ?? currentPrice,
      ema200: indicators.movingAverages?.ema200 ?? currentPrice,
      priceVsEma200Pct: indicators.movingAverages?.priceVsEma200 ?? 0
    },
    momentum: {
      score: assessments.momentum?.score ?? 50,
      direction: assessments.momentum?.direction ?? 'neutral',
      strength: assessments.momentum?.strength ?? 'none',
      divergences: assessments.momentum?.divergences ?? []
    },
    volatility: {
      regime: assessments.volatility?.regime ?? 'normal',
      percentile: assessments.volatility?.percentile ?? 50,
      suggestion: assessments.volatility?.suggestion ?? ''
    },
    structure: {
      classification: structureAnalysis?.classification ?? 'mixed',
      priorTrendDirection: structureAnalysis?.priorTrendDirection ?? 'sideways',
      structureIntact: structureAnalysis?.structureIntact ?? false,
      detectedPatterns: structureAnalysis?.detectedPatterns ?? []
    },
    levels: {
      nearestSupport: supportResistance?.nearTerm?.support?.[0]?.price ?? currentPrice * 0.95,
      nearestResistance: supportResistance?.nearTerm?.resistance?.[0]?.price ?? currentPrice * 1.05,
      supportStrength: supportResistance?.nearTerm?.support?.[0]?.strength ?? 50,
      resistanceStrength: supportResistance?.nearTerm?.resistance?.[0]?.strength ?? 50,
      keyLevels: [
        ...(supportResistance?.nearTerm?.support?.map((s: any) => ({ price: s.price, type: 'support' as const, touches: s.touches })) ?? []),
        ...(supportResistance?.nearTerm?.resistance?.map((r: any) => ({ price: r.price, type: 'resistance' as const, touches: r.touches })) ?? [])
      ].slice(0, 6)
    },
    squeeze: {
      isInSqueeze: squeeze?.isInSqueeze ?? false,
      squeezeDuration: squeeze?.squeezeDuration ?? 0,
      momentumDirection: squeeze?.momentumDirection ?? 'neutral',
      fireConfirmed: squeeze?.fireConfirmed ?? false
    },
    regime: {
      type: regime?.type ?? 'UNCERTAIN',
      direction: regime?.direction ?? 'neutral',
      confidence: regime?.confidence ?? 50,
      evidence: regime?.evidence ?? []
    }
  };
}
