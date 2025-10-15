# AI Swing Trading Strategy System v1.1

Complete implementation of the AI swing trading advisor following the specification in `ai_swing_trading_strategy_v1.1.md`.

## 🎯 Overview

This system implements 6 distinct swing trading strategies with:
- **Deterministic rule-based evaluation** (no guessing)
- **Multi-bar confirmation logic** for entry validation
- **Risk/reward validation** (minimum 1.5:1 on first target)
- **Historical 200-bar tracking** for performance context
- **Volume & regime multipliers** for viability scoring
- **AI mentor explanations** following spec contract

## 📁 File Structure

```
lib/strategies/
├── types.ts                    # All TypeScript types
├── core-calculations.ts        # Multipliers, RR, hard blocks
├── evaluators.ts              # All 6 strategy implementations
├── orchestrator.ts            # Main entry point
├── historical-context.ts      # 200-bar signal tracking
├── mentor.ts                  # AI explanation generation
├── input-builder.ts           # Market data → StrategyInput
├── index.ts                   # Main export
└── README.md                  # This file
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { PolygonClient } from '@/lib/data-vendors/polygon';
import { buildStrategyInput } from '@/lib/strategies/input-builder';
import { evaluateAllStrategies } from '@/lib/strategies/orchestrator';
import { generateMentorExplanation } from '@/lib/strategies/mentor';

// 1. Fetch market data
const polygonClient = new PolygonClient(process.env.POLYGON_API_KEY!);
const marketData = await polygonClient.getAggregates('AAPL', '1day');

// 2. Build strategy input
const input = buildStrategyInput(marketData, 'bullish', null);

// 3. Evaluate all strategies
const evaluation = await evaluateAllStrategies(input);

// 4. Generate mentor explanation
const explanation = generateMentorExplanation(evaluation);

console.log(evaluation.strategy);  // 'triangle_breakout_long'
console.log(evaluation.status);    // 'ready' | 'candidate' | 'no_trade' | 'blocked'
console.log(evaluation.viability); // 0.85 (0-1 scale)
console.log(explanation);          // Full mentor text
```

### API Endpoint

```bash
# Analyze a symbol
curl -X POST http://localhost:3000/api/strategy-analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "timeframe": "1day"}'

# Get markdown report
curl http://localhost:3000/api/strategy-analyze?symbol=AAPL&timeframe=1day
```

## 📊 The 6 Strategies

### 1. Triangle Breakout (Long)
- **Pattern**: Compressed triangle near resistance
- **Entry**: 2 closes above upper with rising volume
- **Targets**: 0.75H, 1.00H, 1.25H (H = pattern height)
- **Quality**: Base 0.70, bonus for tight width, high touches

### 2. Flag Breakout (Long)
- **Pattern**: Orderly pullback after strong move
- **Entry**: 2 green bars totaling ≥1 ATR
- **Targets**: +1.0, +1.8, +2.5 ATR
- **Quality**: Base 0.65, bonus for shallow pullback, RSI 45-60

### 3. Double Top Confirmation (Short)
- **Pattern**: Two peaks with neckline break
- **Entry**: 1 bar below neckline & EMA20
- **Targets**: -0.75H, -1.00H, -1.25H
- **Quality**: Base 0.75, bonus for symmetry, height

### 4. Trend Pullback to EMA (Long)
- **Pattern**: Uptrend pullback to EMA20/50
- **Entry**: Reversal at EMA with confirmation
- **Targets**: +1.5, +2.0, +3.0 ATR
- **Quality**: Base 0.60, bonus for EMA20 touch, RSI range

### 5. Mean Reversion (Short)
- **Pattern**: Overbought extension from EMA20
- **Entry**: 3 red candles or bearish engulfing
- **Targets**: EMA20, EMA20 - 0.5 ATR
- **Quality**: Base 0.65, viability ×0.9 penalty

### 6. Failed Breakout Reversal (Short)
- **Pattern**: Failed high returning to range
- **Entry**: On failure close with volume
- **Targets**: Mid-range, range low
- **Quality**: Base 0.60, bonus for volume ratio ≥1.2

## 🎯 Core Concepts

### Hard Blocks (Trade Prevented)
- Earnings within 2 days
- Price < $5
- Spread > 40 bps
- ADV < $2M

### Volume Multiplier
```
z ≤ -1.5      → 0.60
-1.5 < z < 0  → 0.60 → 1.00 (linear)
0 ≤ z < 1.2   → 1.00 → 1.25 (linear)
z ≥ 1.2       → 1.25
```

### Regime Multiplier
**LONG**: bullish 1.10, neutral 1.00, bearish 0.85  
**SHORT**: bullish 0.85, neutral 1.00, bearish 1.10

### Viability Score
```
viability = quality × volMultiplier × regimeMultiplier
```

### Minimum RR Requirement
First target must have R:R ≥ 1.5, otherwise trade is rejected.

## 📈 Historical Tracking

### Signal Recording
```typescript
import { recordSignal } from '@/lib/strategies/historical-context';

await recordSignal({
  symbol: 'AAPL',
  timeframe: '1D',
  strategy: 'triangle_breakout_long',
  signalDate: new Date(),
  entry: 150.00,
  stop: 147.50,
  direction: 'long',
  target1: 153.75,
  target2: 156.25,
  target3: 158.75,
  quality: 0.85,
  viability: 0.78,
  rrFirst: 1.5,
  spyRegime: 'bullish',
  volZ: 1.2,
});
```

### Outcome Updates
```typescript
import { updateSignalOutcome } from '@/lib/strategies/historical-context';

await updateSignalOutcome(
  signalId,
  'hit_t2',           // outcome
  new Date(),         // exitDate
  156.25,             // exitPrice
  0.0417,             // pnlPct (4.17%)
  2.5,                // rrRealized
  5                   // daysHeld
);
```

### Statistics Retrieval
```typescript
import { getHistoricalRecent, getHistoricalAnalog } from '@/lib/strategies/historical-context';

// Ticker-specific recent performance
const recent = await getHistoricalRecent('AAPL', 'triangle_breakout_long');
console.log(recent.winRate10d);  // 0.65 (65%)
console.log(recent.avgPnL10d);   // 0.025 (2.5%)

// Global strategy performance
const analog = await getHistoricalAnalog('triangle_breakout_long');
console.log(analog.hitRate);     // 0.58 (58%)
console.log(analog.evAfterCosts); // 0.012 (1.2%)
```

## 🎓 Mentor System

### Output Contract
- **Setup Summary**: Pattern, direction, quality, viability
- **Qualification**: Why it meets/fails criteria
- **Trade Plan**: Entry, stop, targets, R:R
- **Context & Risks**: Regime, earnings, liquidity
- **Historical**: Recent ticker + global analog data
- **Invalidation**: Exit rules & stop loss

### Example Output
```typescript
import { generateFullMentorOutput } from '@/lib/strategies/mentor';

const output = generateFullMentorOutput(evaluation);

// output.systemMessage: Fixed mentor persona
// output.explanation: Full structured explanation
// output.facts: JSON evaluation object
```

## 🗄️ Database Schema

### StrategySignal
Tracks individual trade signals with outcomes:
- Entry/stop/targets
- Quality/viability metrics
- Outcome (hit_t1/t2/t3, stopped_out)
- P&L and days held

### StrategyStats
Cached aggregate statistics:
- Recent performance (last ~10 months)
- All-time performance
- Win rates, median returns, EV

## 🔧 Configuration

### Environment Variables
```bash
POLYGON_API_KEY=your_key_here
DATABASE_URL=postgresql://...
PATTERN_DETECTION_V2=true  # Use V2 pattern detection
```

### Timeframes
- `1min`, `5min`, `15min`, `1hour`, `1day`

### Market Regimes
Detect from SPY data or set manually: `bullish`, `neutral`, `bearish`

## 🧪 Testing

```bash
# Type checking
npm run type-check

# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Test API endpoint
curl -X POST http://localhost:3000/api/strategy-analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol": "MSFT", "timeframe": "1day"}'
```

## 📚 Related Documentation

- `ai_swing_trading_strategy_v1.1.md` - Full specification
- `docs/PRODUCT_OVERVIEW.md` - Product overview
- `docs/TWO_TIER_PATTERN_SYSTEM.md` - Pattern detection details

## 🚨 Important Notes

1. **Multi-bar confirmations** require state tracking - currently simplified
2. **Earnings data** integration pending (placeholder `null`)
3. **Liquidity metrics** are estimated - integrate real bid/ask spreads
4. **Historical tracking** requires manual outcome updates
5. **All strategies** are evaluated, best viability wins

## 🔮 Future Enhancements

- [ ] Real-time multi-bar confirmation tracking
- [ ] Earnings calendar integration (Polygon premium)
- [ ] Real-time bid/ask spread data
- [ ] Automated outcome tracking with price monitoring
- [ ] Sector regime multipliers
- [ ] Trade management rules (stop-to-BE, scaling)
- [ ] Portfolio-level position sizing
- [ ] Backtest engine for historical validation

## 📄 License

See LICENSE file in repository root.

---

**Version**: 1.1  
**Last Updated**: 2025-10-15  
**Maintainer**: AI Swing Trading Team

