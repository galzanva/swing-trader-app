# Hybrid Historical Model - Quick Start Guide

## What Changed?

The historical performance system now provides **multi-horizon tracking** and **first-touch outcomes** instead of single-point evaluations.

## Key New Metrics

### Multi-Horizon Win Rates
- **5-day**: Win rate if you closed after 5 trading days
- **10-day**: Win rate if you closed after 10 trading days  
- **20-day**: Win rate if you closed after 20 trading days

**What to look for:**
- ✅ Increasing win rates (5d→10d→20d) = strong trend continuation
- ⚠️ Decreasing win rates (5d→10d→20d) = mean reversion pattern
- ⚠️ All low (< 50%) = weak strategy on this ticker

### Multi-Horizon Average P&L
- Shows actual profit/loss percentage at each time horizon
- Color-coded: green (positive), red (negative)

**What to look for:**
- ✅ Positive at all horizons = consistently profitable
- ⚠️ Negative at early horizons but positive later = requires patience
- ⚠️ Negative at all horizons = avoid this setup

### First-Touch Outcomes
Shows which level was hit FIRST in historical trades:
- **T1 First**: Price hit first target quickly
- **T2 First**: Price bypassed T1 and hit T2
- **T3 First**: Price ran to T3 without hitting T1/T2
- **Stop First**: Trade was stopped out before any target

**What to look for:**
- ✅ High T2/T3 first count = strong breakouts
- ⚠️ High stop first count = stops too tight or strategy doesn't work
- ✅ Low average days held = quick, decisive moves

### Quality Warnings

**Limited Sample Size** (< 10 samples):
- Statistics may not be reliable
- Use caution, consider waiting for more confirmation

**Weak Historical Performance**:
- Win rate < 20% OR average P&L negative at 10 days
- Suggests strategy hasn't worked well on this ticker historically
- Strongly consider skipping this trade

**No Historical Precedent**:
- Pattern has never occurred before on this ticker
- No data to validate the setup
- Maximum caution advised

## Reading the Results

### Example 1: Strong Setup
```
Total Signals: 12 ✓
Win Rates: 50% (5d) → 66% (10d) → 75% (20d)
Avg P&L: 1.2% (5d) → 3.5% (10d) → 5.8% (20d)
First-Touch: T1: 3, T2: 5, T3: 2, Stop: 2
```
**Interpretation**: Excellent! Win rate improves over time, P&L grows, mostly hitting T2 first. Strong trend continuation pattern.

### Example 2: Risky Setup
```
⚠ Limited Sample Size: Only 4 signals
Win Rates: 25% (5d) → 25% (10d) → 50% (20d)
Avg P&L: -0.8% (5d) → 0.5% (10d) → 1.2% (20d)
First-Touch: T1: 1, T2: 0, T3: 0, Stop: 3
```
**Interpretation**: Red flags! Small sample, low early win rates, high stop rate. Proceed with extreme caution or skip.

### Example 3: Patient Setup
```
Total Signals: 15 ✓
Win Rates: 40% (5d) → 53% (10d) → 73% (20d)
Avg P&L: -0.5% (5d) → 1.8% (10d) → 4.2% (20d)
First-Touch: T1: 4, T2: 3, T3: 5, Stop: 3
```
**Interpretation**: Requires patience! Early pain but strong later. Good for swing traders willing to hold 15-20 days. High T3 first count confirms.

## Mentor Output Changes

The AI mentor now includes:
- Multi-horizon statistics in the historical context section
- Quality warnings (prominently displayed with ⚠ symbol)
- First-touch distribution breakdown
- Most recent signal details (which level hit first, days held, 10d P&L)

## UI Changes

### New Sections:
1. **Sample Count & Quality Warning**: Top of historical section
2. **Multi-Horizon Win Rates**: 3-column grid (5d/10d/20d)
3. **Multi-Horizon Avg P&L**: 3-column grid with color coding
4. **First-Touch Distribution**: 4-column grid (T1/T2/T3/Stop)
5. **Most Recent Signal**: Shows last pattern occurrence details

### Color Coding:
- 🟢 **Green**: Positive P&L, sufficient samples
- 🔴 **Red**: Negative P&L, stop-first outcomes
- 🟠 **Amber**: Warnings (limited samples, weak history)
- ⚪ **White**: Neutral data (counts, win rates)

## Decision Framework

### ✅ Take the Trade If:
- `hasMinSamples === true` (10+ samples)
- `isWeakHistory === false`
- Win rate at 10d >= 60%
- Avg P&L at 10d >= 2%
- First-touch stop count < 30% of total

### ⚠️ Proceed with Caution If:
- 5-9 samples (limited data)
- Win rate 40-60%
- Moderate stop rate (30-40%)
- Use smaller position size

### ❌ Skip the Trade If:
- < 5 samples AND pattern is critical
- `isWeakHistory === true`
- Win rate < 40%
- Avg P&L negative
- Stop first > 50% of outcomes

## Technical Notes

### Data Source
- Real-time backtesting on actual historical bars from Polygon API
- No database required (computed on-demand)
- Uses last 200 bars (~10 months for daily data)

### Calculations
- **Win Rate**: Percentage where P&L > 0 at that horizon
- **Avg P&L**: Mean of all P&L values at that horizon (% of risk)
- **First Touch**: Chronologically first level hit (stop has priority)

### Performance
- Backtesting runs in < 2 seconds for most tickers
- Results are NOT cached (always fresh)
- Pattern detection runs on every bar in history

## FAQs

**Q: Why might win rates differ across horizons?**
A: Early exits may lock in small gains while later horizons allow trends to develop (or reverse).

**Q: What does "Stop First: 8" mean?**
A: Out of all historical trades, 8 hit the stop loss before reaching any target.

**Q: Is 5 samples enough?**
A: Not really. You'll see a warning. 10+ is recommended for statistical reliability.

**Q: What if I see "No historical occurrences"?**
A: The pattern has never appeared on this ticker in the last 200 bars. Highest caution - no proof it works here.

**Q: Can I see individual trade details?**
A: Currently only the most recent signal is shown. Full trade log may be added in future.

**Q: How often should I re-run analysis?**
A: Daily if the ticker is active. Historical data updates as new bars arrive.

## Summary

The hybrid model gives you **three lenses** to evaluate a trade:
1. **Multi-horizon**: Does it get better or worse over time?
2. **First-touch**: What actually happens in practice?
3. **Quality**: Can I trust this data?

Use all three to make informed, confident trading decisions. The system warns you proactively when data is weak or insufficient.

---

**Remember**: Historical performance doesn't guarantee future results, but it's a powerful data point. Combine it with your own analysis, risk management, and market context.

