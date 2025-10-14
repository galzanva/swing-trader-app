# Pattern Detection V2 - Quick Reference 🚀

## Files Created
```
lib/patterns/
├── pattern-utils.ts           ✅ Foundation (ATR, regression, touches, breakouts)
├── chart-patterns-v2.ts       ✅ 6 patterns (flags, triangles, doubles)
├── candlestick-v2.ts          ✅ 6 patterns (engulfing, hammer, star, doji, inside, trend)
├── fusion-v2.ts               ✅ Explicit fusion (60/40, bonuses, penalties)
├── detector-v2.ts             ✅ Master detector + compatibility
└── __tests__/acceptance.test.ts ✅ 9 acceptance criteria
```

## Quick Usage

```typescript
import { detectAllPatterns } from '@/lib/patterns/detector-v2';

const result = detectAllPatterns(bars, {
  avgDollarVolume: 2000000,
  minLiquidityThreshold: 1000000,
  daysToEarnings: null
});

// result.chartPattern - Full pattern with metadata
// result.allChartPatterns - All ranked by confidence
// result.candlestickPattern - With facts
// result.composite - Fused score + reasons
```

## Key Rules

### Chart Patterns
- **Flags:** 5-25 bars, ≥5 touches, width ≤3%, declining vol
- **Triangles:** 20-80 bars, flat side R²>0.7, ≥5 touches
- **Doubles:** ≥30 bars, symmetry ≤2%, separation ≥10, height ≥1×ATR

### Fusion Formula
```
composite = 0.6×chart + 0.4×candle + bonuses - penalties
Bonuses: +15 alignment, +5/15/20 breakout, +5 volume
Penalties: -10 opposition
Cap: 95 (realism)
```

### Safeguards
- Low liquidity → cap at 70
- Earnings <1 day → cap at 40

## Test Status
✅ All 9 acceptance criteria pass
✅ Zero linter errors
✅ Backward compatible

## Integration
Replace in `app/api/analyze/route.ts`:
```typescript
const patterns = detectAllPatterns(bars, options);
```

See `PATTERN_DETECTION_V2.md` for full documentation.

