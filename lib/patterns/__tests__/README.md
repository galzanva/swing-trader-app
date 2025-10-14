# Pattern Detection V2 - Test Suite

## Test File
`acceptance.test.js` - Validates all 9 acceptance criteria from the V2 specification

## Running Tests

```bash
# Run all tests
npm test

# Run pattern tests specifically
npm test acceptance.test
```

## Test Coverage

### ✅ AC1: Triangle Quality Metrics
- Validates ≥5 touches, width ≤3%, breakoutVolZ>1
- Confirms composite score ≥80 for high-quality patterns

### ✅ AC2: Flag with Retest
- Tests declining volume + confirmed breakout + retest
- Validates composite ≥85 and explainability (reasons array)

### ✅ AC3: Double Top Quality
- Checks symmetry ≤2%, separation ≥10 bars, volZ ≥1.2
- Validates price target calculation

### ✅ AC4: Opposition Penalty
- Verifies -10 penalty when candlestick opposes chart pattern
- Checks conflict messaging in analysis

### ✅ AC5: No Structure Cap
- Confirms composite ≤55 when only basic trend present
- Validates "wait for structure" messaging

### ✅ AC6: Confidence Cap
- Ensures no pattern exceeds 95% confidence
- Tests realistic confidence labeling

### ✅ AC7: Liquidity Safeguards
- Validates cap at 70 when avgDollarVolume < threshold
- Checks liquidity warning in analysis

### ✅ AC8: Earnings Safeguards
- Tests blocking (cap at 40) when earnings within 1 day
- Validates warning for earnings 3+ days away

### ✅ AC9: Explainability
- Confirms comprehensive reasons[] arrays
- Validates all scores have explanations

## Test Data

The test suite uses synthetic OHLCV data generators:
- `createBars()` - Creates bar patterns (flag, triangle, double_top, flat)
- Each pattern follows strict formation rules
- Volume, price, and timing are deterministic

## Expected Results

All tests should pass with:
- Pattern detection accurate
- Confidence scores realistic (≤95%)
- Reasons arrays populated
- Safeguards working correctly
- Analysis narratives appropriate

## Note

Test file is `.js` to avoid TypeScript Jest configuration complexity. 
The V2 system itself is fully typed in TypeScript.

