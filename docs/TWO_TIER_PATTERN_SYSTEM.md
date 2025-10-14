# Two-Tier Pattern Detection System

## Overview

The Swing Advisor now implements a **deterministic, auditable two-tier pattern detection system** that distinguishes between:

1. **Institutional (Valid/Tradeable)** patterns that meet strict, professional-grade criteria
2. **Candidate (Not Confirmed)** patterns that show potential but fail one or more strict gates

This approach provides both **realistic trading signals** and **educational value**, helping traders understand what makes a pattern truly tradeable versus merely suggestive.

---

## System Architecture

### Core Modules

#### 1. **`pattern-utils.ts`** — Shared Definitions
Single source of truth for all calculations:

- **ATR(14)**: True Range = max(high-low, |high-prevClose|, |low-prevClose|); ATR = SMA(14)
- **Volume Z-Score**: Canonical 20-bar window, rounded to 2 decimals
- **Confidence Labels**: 90-95 "very high", 75-89 "high", 60-74 "moderate", 45-59 "low", <45 "very low". All capped at 95% for realism.
- **EMA Alignment & Trend**:
  - Bullish alignment: EMA9 > EMA20 > EMA50 > EMA200
  - Bearish alignment: EMA9 < EMA20 < EMA50 < EMA200
  - Long-term bias: bullish if price > EMA200
  - Band compression: (max-min EMA 9/20/50) / price × 100

#### 2. **`chart-patterns-v2.ts`** — Two-Tier Chart Pattern Detection

Implements 6 major chart patterns, each with **Institutional** and **Candidate** gates:

**Double Top / Double Bottom (Reversal)**
- **Institutional**: symmetry ≤2.0%, separation ≥10 bars, height ≥1.0×ATR, touches ≥5, breakout confirmed with volZ ≥1.2
- **Candidate**: symmetry ≤3.5%, separation ≥6 bars, height ≥0.8×ATR, touches ≥4, breakout not required

**Bullish / Bearish Flag (Continuation)**
- **Institutional**: pole ≥8%, both boundaries slope against pole, parallelism ≤0.15%/bar, width ≤3% or ≤1.0×ATR, declining volume, breakout confirmed
- **Candidate**: pole ≥6%, parallelism ≤0.22%/bar, width ≤4% or ≤1.3×ATR, volume may be ambiguous

**Ascending / Descending Triangle (Continuation)**
- **Institutional**: flat side slope ≤0.10%/bar & R²≥0.70, rising/falling side slope ≥0.05%/bar, touches ≥5 total (≥2 each side), width ≤3% or ≤1.0×ATR
- **Candidate**: flat side slope ≤0.15%/bar & R²≥0.60, rising/falling side slope ≥0.03%/bar, touches ≥4 total

Each detector returns:
```typescript
interface TwoTierPatternResult {
  institutional: InstitutionalPattern | null;
  candidate: CandidatePattern | null;
}
```

#### 3. **`candlestick-v2.ts`** — Fact-Based Candlestick Detection

Implements 6 candlestick patterns with full validation facts:
- Bullish/Bearish Engulfing
- Hammer
- Shooting Star
- Doji
- Inside Bar

Each pattern includes:
- **Facts**: bodyPct, wickTopPct, wickBotPct, engulfPct, volRatio, volZ, closeLocationPct
- **No trend claims**: Candlestick module only detects patterns, EMA alignment is handled separately

#### 4. **`fusion-v2.ts`** — Deterministic Composite Scoring

**Formula:**

**Case 1: Institutional pattern exists**
```
composite = (0.6 × chartScore) + (0.4 × candleScore) + bonuses - penalties
```

**Bonuses:**
- Alignment: +15 (chart and candle directions match)
- Breakout pending: +5
- Breakout confirmed: +15
- Breakout retest: +20 (strongest)
- Volume: +5 (flags/triangles volZ ≥1.0; doubles volZ ≥1.2)

**Penalties:**
- Opposition: -10 (chart and candle directions conflict)

**Case 2: Candidate pattern only (no institutional)**
```
composite = candleScore, capped at 65
Reason: "Candidate structure detected (not institutional) — capped at 65 until confirmation"
```

**Case 3: No structure pattern**
```
composite = candleScore, capped at 55
Reason: "No structure pattern — capped at 55 (wait for setup)"
```

**Safeguards:**
- **Liquidity**: If avg dollar volume < $1M, cap composite ≤70
- **Earnings**: If earnings ≤3 days, add warning; if ≤1 day, cap composite ≤40

#### 5. **`detector-v2.ts`** — Master Coordinator

Orchestrates the entire system:
1. Detect all chart patterns (returns array of `TwoTierPatternResult`)
2. Select primary institutional pattern (highest confidence)
3. If no institutional, select primary candidate pattern
4. Detect candlestick pattern
5. Fuse patterns using two-tier logic
6. Apply safeguards

Returns `DetectionResult`:
```typescript
interface DetectionResult {
  institutional: InstitutionalPattern | null;
  candidate: CandidatePattern | null;
  allTwoTierResults: TwoTierPatternResult[];
  candlestickPattern: CandlestickPattern;
  composite: CompositePattern;
  compositeReasons: string[];
  chartPatternReasons: string[];
  candlestickFacts: any;
  chartPatternMetadata: any;
}
```

---

## API Integration

### `app/api/analyze/route.ts`

**Updated `AnalysisReport` interface:**
```typescript
patternV2?: {
  // Institutional pattern (valid/tradeable)
  institutional?: {
    name: string;
    type: string;
    direction: string;
    confidence: number;
    confidenceLabel: string;
    breakoutStatus: string;
    priceTarget?: number;
    keyLevels: { support: number[]; resistance: number[]; };
    volumeZScore: number;
    reasons: string[];
    metadata: Record<string, any>;
  };
  // Candidate pattern (not confirmed)
  candidate?: {
    name: string;
    type: string;
    direction: string;
    confidence: number;
    confidenceLabel: string;
    metCriteria: string[];
    unmetCriteria: string[];
    nextSteps: string[];
    metadata: Record<string, any>;
  };
  // Explainability
  compositeReasons?: string[];
  chartPatternReasons?: string[];
  candlestickFacts?: { ... };
  chartPatternMetadata?: { ... };
};
```

**Feature flag:**
```typescript
const useV2 = process.env.PATTERN_DETECTION_V2 !== 'false'; // Default to V2
```

---

## UI Display

### `app/analyze-client.tsx`

**Three UI blocks:**

#### 1. Institutional (Tradeable) — Green gradient card
- Shows: name, direction, confidence, breakout status, volume Z-score
- Price target with % from current price
- Support/resistance levels
- Top 3 validation criteria (numeric facts)
- **Only shown when institutional pattern is detected**

#### 2. Candidate (Not Confirmed) — Orange gradient card
- Shows: name, direction, confidence (capped at 80)
- ✅ Met Criteria (what passed)
- ❌ Unmet Criteria (what failed, with numeric deltas)
- 🎯 Next Steps (what confirmations are needed)
- **Only shown when candidate pattern is detected (and no institutional)**

#### 3. No Pattern — Gray card
- Shown when neither institutional nor candidate patterns are detected
- Explains analysis is based on candlestick pattern and technical indicators only

---

## Acceptance Criteria

### Test Cases

1. **Strict Double Top**
   - Symmetry ≤2.0%, separation ≥10 bars, height ≥1.0×ATR, pending break volZ 0.9
   - **Expected**: Institutional (pending), composite ≥75 if candle aligns

2. **Candidate Double Top**
   - Symmetry 3.1%, separation 6, height 0.9×ATR
   - **Expected**: Candidate only; composite capped at 65; report shows unmet criteria with numeric deltas and next steps

3. **No Structure**
   - Neither strict nor candidate
   - **Expected**: Composite capped at 55 with reason

4. **Flag with Retest**
   - Declining consolidation volume, confirmed breakout volZ ≥1.0, retest near boundary
   - **Expected**: Strong Institutional, composite likely ≥85; reasons list includes touches, width, slopes, volZ, retest

5. **Consistency**
   - Single volZ across card
   - EMA proximity label matches math
   - Alignment/countertrend logic coherent

---

## Tone Guidelines

### Institutional
**Tone:** "Valid (Institutional) — Meets strict criteria. Tradeable structure."

**Always explain why** using numeric facts and breakout status. Example:
> "Symmetry 1.8% (≤2.0% required), Separation 12 bars (≥10 required), Height 1.3× ATR (≥1.0 required), 7 total touches (≥5 required), Breakout: confirmed, volZ 1.5"

### Candidate
**Tone:** "Candidate (Not Confirmed) — Fails institutional criteria. For learning; monitor for confirmation."

**Always show**:
- What criteria are met
- What criteria are unmet (with numeric deltas: e.g., "Separation 6 < 10 bars (need 4 more)")
- What to watch next (e.g., "Wait for neckline breakdown with volume confirmation (volZ ≥1.2)")

---

## Benefits

### For Trading
1. **Realism**: Only institutional patterns are truly tradeable
2. **Risk Management**: Composite capped at 65 (candidate) or 55 (no structure) prevents overconfidence
3. **Transparency**: Every confidence score is backed by explicit numeric rules

### For Learning
1. **Educational Value**: Candidate patterns show what's *almost* there
2. **Clear Feedback**: Unmet criteria with numeric deltas explain exactly what's missing
3. **Next Steps**: Actionable guidance on what confirmations to watch for

### For Explainability
1. **Auditable**: All decisions trace back to deterministic rules
2. **Reproducible**: Same data always produces same results
3. **Fact-Based**: No black-box AI in pattern detection

---

## Migration from V1

The system maintains **backward compatibility** through `getCompositePatternV2()` in `detector-v2.ts`, which adapts the new two-tier system to the old interface.

**Key differences:**
- V1: Single `chartPattern` field (null or pattern)
- V2: Two fields: `institutional` and `candidate` (both nullable)
- V2 provides explicit reasoning for why patterns do/don't qualify as institutional

**To enable V2:**
Set `PATTERN_DETECTION_V2=true` in `.env` (default behavior)

**To revert to V1:**
Set `PATTERN_DETECTION_V2=false` in `.env`

---

## Summary

The two-tier system provides:
- ✅ **Strict gates** for institutional-grade patterns
- ⚠️ **Educational feedback** for candidate patterns
- 📊 **Deterministic scoring** with full explainability
- 🎯 **Actionable guidance** on what to watch next
- 🔒 **Safeguards** for liquidity and earnings
- 🧑‍🏫 **Mentor-like** tone that teaches *why* patterns qualify or don't

This makes the Swing Advisor both a **realistic trading tool** and a **powerful learning platform**.

