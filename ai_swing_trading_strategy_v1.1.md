# AI Swing Trading — Strategy Rules & Prompt Spec
**Version:** 1.1  
**Owner:** ChatGPT (Mentor)  
**Scope:** Strategy-driven swing trading advisor for Next.js + TypeScript + Prisma + Polygon.  
**Purpose:** Provide *machine-checkable* rules for core swing-trading strategies and a *prompt contract* for the AI mentor. Includes historical context and multi-bar confirmations.

---

## 0) Shared Inputs & Definitions
**Per Ticker / Timeframe Inputs (from Polygon & your feature pipeline):**
- `price` (last close), arrays: `high[n]`, `low[n]`, `close[n]`, `volume[n]`
- EMAs: `ema9`, `ema20`, `ema50`, `ema200`
- Momentum/volatility: `rsi14`, `atr` (14), `atrPct = atr/price*100`
- Volume: `volZ` = z-score vs last 20 bars (median/σ method)
- Optional **pattern contexts** (from detectors):  
  - `triangle`: `upperNow`, `lowerNow`, `widthPct`, `contractionsOk`, `touches`, `status`
  - `flag`: `pullbackDepthPct`, `parallelOk`, `channelSlope`, `status`
  - `doubleTop`: `neckline`, `separationBars`, `symmetryPct`, `heightAtr`, `touches`, `status`
  - `pullback`: `reached`, `reversalCandle`, `status`
- **Regime & risk:**  
  - `spyRegime ∈ {bullish, neutral, bearish}`  
  - Liquidity: `spreadBps`, `advUsd`, `price`
  - `earningsDays` (days until/after next earnings)

**Global Hard Blocks:**
- `abs(earningsDays) ≤ 2` → **BLOCK**
- `price < 5` or `spreadBps > 40` or `advUsd < 2_000_000` → **BLOCK**

**Volume Confirmation Multiplier:**
```js
volMultiplier(z):
  if z ≤ −1.5 → 0.6
  if −1.5 < z < 0 → 0.6 → 1.0 (linear)
  if 0 ≤ z < 1.2 → 1.0 → 1.25 (linear)
  else → 1.25
```

**Market Regime Multiplier (directional):**
- **Long:** bullish 1.10, neutral 1.00, bearish 0.85
- **Short:** bullish 0.85, neutral 1.00, bearish 1.10

**Minimum First Target Risk/Reward:**  
`RR_first < 1.5` → **Reject**

**Generic RR calculation:**
- Long: `risk = entry - stop`, `reward = target - entry`, `RR = reward / risk`
- Short: `risk = stop - entry`, `reward = entry - target`, `RR = reward / risk`

---

## 1) Strategy: Triangle Breakout — LONG
**Intent:** Buy compressed triangle near resistance; ride measured move.

**Eligibility:**
- Triangle context present, `touches ≥ 6`, `contractionsOk = true`, `widthPct ≤ 8`
- Price within `≤ 1×ATR` of `upperNow`

**Confirmation (Multi-bar):**
- Entry: `entry = max(upperNow*(1+min(0.002, 0.5*atrPct/100)), close)`
- Requires **2 closes** above `upperNow` with **rising volume**
- `volZ ≥ 0`

**Stop:** `stop = lowerNow − 0.5×ATR`

**Targets:**
- `H = upperNow − lowerNow`
- `T1 = entry + 0.75×H`, `T2 = entry + 1.00×H`, `T3 = entry + 1.25×H`

**Invalidate:**  
- Daily close back inside triangle with rising volume  
- Bearish engulfing below EMA20 within 3 bars post-entry

**Quality (0–1):**
- Base 0.70  
  +0.10 if `widthPct ≤ 6`  
  +0.10 if `touches ≥ 8`  
  +0.10 if `atrPct` declining over last 20 bars  
- Cap 1.00

**Viability:** `quality × volMultiplier(volZ) × regimeMultiplier(LONG, spyRegime)`

---

## 2) Strategy: Flag Breakout — LONG
**Intent:** Buy continuation after orderly pullback (flag).

**Eligibility:**
- Flag context present  
- Trend up: `ema20 > ema50 > ema200`  
- `parallelOk = true`, `pullbackDepthPct ≤ 50`  
- Price ≥ EMA20 and within `0.5×ATR` of flag top

**Confirmation (Multi-bar):**
- Entry = `lastPrice + 0.2×ATR`
- Require **2 green bars** post-breakout totaling ≥ 1 ATR
- `volZ ≥ 0.3`

**Stop:** `stop = min(flagLow - 0.5×ATR, entry - 1.0×ATR)`

**Targets:** `T1 = entry + 1.0×ATR`, `T2 = entry + 1.8×ATR`, `T3 = entry + 2.5×ATR`

**Invalidate:** Close below EMA20 on rising volume

**Quality (0–1):**
- Base 0.65  
  +0.15 if `pullbackDepthPct ≤ 38.2`  
  +0.10 if slope modest  
  +0.10 if `rsi14 ∈ [45,60]`  
- Cap 1.00

---

## 3) Strategy: Double-Top Confirmation — SHORT
**Intent:** Short confirmed double-top via neckline break.

**Eligibility:**
- Context present  
- `touches ≥ 6`, `separationBars ≥ 10`, `symmetryPct ≤ 2.0`, `heightAtr ≥ 1.0`  
- Price within ≤ 1×ATR above neckline

**Confirmation (Multi-bar):**
- Entry: `entry = min(neckline×0.998, close)`  
- Require **1 confirmation bar** below neckline & EMA20  
- `volZ ≥ 0`

**Stop:** `stop = neckline + 0.5×ATR`

**Targets:** Based on `H$ = heightAtr×ATR`

**Invalidate:** Close above neckline with rising volume

**Quality (0–1):**
- Base 0.75  
  +0.10 if `symmetryPct ≤ 1.0`  
  +0.10 if `heightAtr ≥ 1.4`  
  +0.05 if `separationBars ≥ 14`  
- Cap 1.00

**Viability:** `quality × volMultiplier × regimeMultiplier(SHORT)` then ×0.90 if counter-trend.

---

## 4) Strategy: Trend Pullback to EMA — LONG
**Intent:** Buy pullback into EMA20/50 in uptrend.

**Eligibility:**
- `ema20 > ema50 > ema200`
- `distance(price, EMA20/EMA50) ≤ 0.8×ATR`
- `rsi14 ∈ [45,60]`

**Confirmation:**  
- Retest entry at `max(ema20, min(price, ema50))` with reversal signal  
- Signal: Bullish engulfing, hammer, or **2 closes above EMA20**  
- `volZ ≥ 0` preferred

**Stop:** `stop = entry − 1.0×ATR`

**Targets:** `T1 = +1.5×ATR`, `T2 = +2.0×ATR`, `T3 = +3.0×ATR`

**Quality (0–1):**
- Base 0.60  
  +0.15 if touch = EMA20  
  +0.10 if `rsi14 ∈ [48,56]`  
  +0.10 if EMA20 slope increasing  
- Cap 1.00

---

## 5) Strategy: Mean Reversion to 20EMA — SHORT
**Intent:** Fade overbought extensions.

**Eligibility:**
- `price ≥ ema20 + 1.5×ATR`, `rsi14 ≥ 70`, `abs(earningsDays) > 3`
- `ema50 ≥ ema200` (non-bearish trend)

**Confirmation (Multi-bar):**
- **3 red candles** or bearish engulfing / first close below EMA9  
- `volZ ≥ 0` preferred

**Stop:** `stop = swingHigh + 0.5×ATR`

**Targets:** `T1 = ema20`, `T2 = ema20 − 0.5×ATR`

**Viability:** `quality × volMultiplier × regimeMultiplier(SHORT)` × 0.9

---

## 6) Strategy: Failed Breakout Reversal — SHORT
**Intent:** Short failed highs returning to range.

**Eligibility:**
- Prior bar closed above swing high by ≥ 0.5%
- Next bar closes back below with `vol_fail / vol_break ≥ 1.2`

**Confirmation:**  
- Limit near failed level on retest or market on failure close

**Stop:** `stop = resistance + 0.5×ATR`

**Targets:** `T1 = mid-range or EMA20`, `T2 = prior range low`

**Quality (0–1):**
- Base 0.60  
  +0.20 if volume ratio ≥1.2  
  +0.10 if breakout distance ≤1×ATR  

---

## 7) New Historical Context Extension
Each evaluation now includes a **ticker-specific 200-bar summary**:
```json
"historicalRecent": {
  "samples": 5,
  "winRate10d": 0.6,
  "avgPnL10d": 0.018,
  "lastSignal": {
    "date": "2025-09-28",
    "outcome": "hit T2",
    "rrHit": 2.0,
    "daysHeld": 5
  }
}
```
Mentor will reference both **ticker-local** and **global analog** data.

---

## 8) Output Contract (Example)
```jsonc
{
  "symbol": "LYFT",
  "timeframe": "1D",
  "asOf": "2025-10-13",
  "strategy": "double_top_short",
  "status": "candidate",
  "plan": {
    "direction": "short",
    "trigger": { "type": "breakdown", "level": 18.76 },
    "stop": 20.32,
    "targets": [
      { "level": 15.64, "rr": 2.0 },
      { "level": 14.08, "rr": 3.0 }
    ]
  },
  "quality": 0.85,
  "viability": 0.62,
  "rrFirst": 2.0,
  "historicalRecent": {
    "samples": 4,
    "winRate10d": 0.5,
    "lastSignal": { "date": "2025-09-28", "outcome": "hit T2" }
  },
  "historical": {
    "hitRate": 0.55,
    "medianRet10d": 0.019,
    "evAfterCosts": 0.012
  }
}
```

---

## 9) Mentor Prompt Contract
**System message (fixed):**
> You are an objective swing-trading mentor. You never invent facts. You only use the JSON "Facts" provided. Explain setup, rules passed/failed, entry/stop/targets, risk/reward, and context (earnings/regime/liquidity). If RR_first < 1.5 or hard block applies, reply “No trade” and explain which rule blocked it.

**Sections:**
- Setup Summary  
- Why It Qualifies / Fails  
- Plan (trigger, stop, targets, RR)  
- Context & Risks (earnings/regime/liquidity)  
- Historical Context (recent & analog)  
- Invalidate / Exit Rules

---

## 10) Feedback & Improvements (from GPT-5)
- ✅ Add per-ticker 200-bar stats to enhance recent context.  
- ✅ Add multi-bar confirmations for realism.  
- ✅ Include transaction cost & slippage in RR calculation.  
- ✅ Introduce sector regime multipliers (ETF-based).  
- ✅ Normalize viability [0,1], use it for position sizing.  
- ✅ Extend mentor explanations to mention hard blocks & recent signal outcomes.  
- ✅ Define trade management (stop-to-BE after T1, partial exits).  

---

**End of Spec v1.1**
