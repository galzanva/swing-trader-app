# Confirmation Entry System — Quick Reference

## Entry Types

| Type | When Used | Example |
|------|-----------|---------|
| **Breakout** | Bullish setup, waiting for confirmation above level | Entry = $100 resistance × 1.005 = $100.50 |
| **Breakdown** | Bearish setup, waiting for confirmation below level | Entry = $95 neckline × 0.995 = $94.52 |
| **Retest** | Already broke out/down, now retesting level | Entry = $100 ± 0.2×ATR if holds/rejects |
| **Market** | Already confirmed (closed beyond trigger) | Entry at current price, note confirms breakout occurred |

## Status Badges

| Status | Badge | Composite | When |
|--------|-------|-----------|------|
| **Ready** | ✅ Green | Full score | Institutional pattern, no blockers |
| **Candidate** | 🔸 Orange | Capped at 65 | Candidate pattern, not institutional |
| **Missed** | ⏱️ Yellow | N/A | Price moved >0.75×ATR beyond trigger |
| **Blocked** | ⛔ Red | ≤40 earnings, ≤70 liquidity | Earnings ≤2 days OR liquidity <$1M |
| **Neutral** | Gray | N/A | No directional bias |

## Key Calculations

### Entry Trigger
```
Bullish:  breakoutLevel × 1.005  (+0.5%)
Bearish:  breakoutLevel × 0.995  (−0.5%)
```

### Stop Loss
```
Bullish:  entry − 1.5×ATR  (or structural if tighter)
Bearish:  entry + 1.5×ATR  (or structural if tighter)
```

### Targets
```
TP1: entry ± 2.0 × risk  (2.0:1 R:R)
TP2: entry ± 3.0 × risk  (3.0:1 R:R)
TP3: entry ± 4.0 × risk  (4.0:1 R:R)
```

### % Move
```
movePct = ((level − entry) / entry) × 100
```

### Position Viability Index
```
riskPct = |entry − stop| / entry
rewardPct = |entry − TP1| / entry
confirmationStrength = 0..0.6 (breakout status, volume, trend alignment)
PVI = (rewardPct / riskPct) × (1 + confirmationStrength)
```

**Labels:**
- ≥ 2.0 = Very Good (green)
- 1.2–1.99 = Adequate (yellow)
- < 1.2 = Weak (red)

## Warnings

| Warning | Trigger | Action |
|---------|---------|--------|
| **Earnings** | ≤2 days | Block trade, cap composite ≤40 |
| **Low Liquidity** | Avg vol <$1M | Cap composite ≤70, use limit orders |
| **Counter-Trend** | Signal vs EMA200 | Half size, tighter stops |
| **High Volatility** | ATR% >8% | Wider stop or smaller size |
| **Gap-Through** | Open >1×ATR beyond trigger | Switch to retest logic |

## Candlestick-Specific Rules

| Pattern | Entry Logic |
|---------|-------------|
| **Inside Bar** | Mother bar high/low × 1.005/0.995 |
| **Hammer** | High × 1.005 |
| **Shooting Star** | Low × 0.995 |
| **Engulfing** | Prior high/low × 1.005/0.995 |
| **Doji** | Confirmation needed, cap at 55 |

## Tunables

```typescript
CONFIRMATION_BUFFER = 0.005       // 0.5% (range: 0.3–0.8%)
RETEST_BAND_ATR = 0.2             // ±0.2×ATR
MISSED_THRESHOLD_ATR = 0.75       // 0.75×ATR
ATR_STOP_MULTIPLE = 1.5           // 1.5×ATR
MIN_LIQUIDITY = 1000000           // $1M
CANDIDATE_CAP = 65
NO_STRUCTURE_CAP = 55
```

## API Response Structure

```json
{
  "execution": {
    "entry": {
      "type": "breakout",
      "triggerPrice": 100.50,
      "note": "Wait for confirmation breakout above $100.50..."
    },
    "stopLoss": {
      "price": 95.00,
      "movePct": -5.5
    },
    "targets": [
      { "name": "Target 1", "price": 111.50, "movePct": 10.9, "rr": 2.0 },
      { "name": "Target 2", "price": 116.75, "movePct": 16.2, "rr": 3.0 },
      { "name": "Target 3", "price": 122.00, "movePct": 21.4, "rr": 4.0 }
    ],
    "status": "ready",
    "viabilityIndex": 2.15,
    "viabilityLabel": "Very Good",
    "warnings": [],
    "patternTarget": {
      "price": 112.00,
      "movePct": 11.4,
      "confluence": "Aligns with Target 1 (confluence)"
    }
  }
}
```

## UI Components

### 1. Status Badge (Top-Right)
Color-coded badge showing trade readiness

### 2. Entry Trigger Card
- Type icon (📈/📉/🔁/💹)
- Trigger price (large, bold)
- Viability Index (color-coded)
- Entry note (plain English)

### 3. Warnings Section
Yellow cards for each warning

### 4. Stop & Targets Grid
- 1 stop + 3 targets
- Each shows: Price, % move, R:R

### 5. Pattern Target Card (if applicable)
Purple card with confluence note

### 6. Info Box
Explains confirmation-based entry logic

## Files Modified

1. **`lib/execution/confirmation-entries.ts`** — Core logic
2. **`app/api/analyze/route.ts`** — Integration (step 6.5)
3. **`app/analyze-client.tsx`** — UI display

## Zero Linter Errors ✅

All TypeScript strict mode compliant!

