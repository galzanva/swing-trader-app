# Strategy Builder - Quick Reference Guide

## 🚀 Quick Start

### Creating Your First Complex Strategy

**Step 1: Natural Language Input**
```
Go long on daily when EMA20 > EMA50 > EMA200, RSI between 40-70, 
volume above average, price within 1.5 ATR of EMA50, bullish engulfing, 
2 bars above support, stop 1.5 ATR below entry, targets at 1.5 and 3 ATR
```

**Step 2: Parse & Review**
- System automatically parses all conditions
- Review summary with ✓ checkmarks
- Check for warnings

**Step 3: Edit (Optional)**
- Expand any section
- Add/remove conditions
- Adjust parameters

**Step 4: Save**
- Strategy validated automatically
- Available immediately in scanner

## 📋 Condition Types Reference

### 1. EMA Trend Rules
**Purpose:** Define trend direction using moving averages

**Examples:**
```
- EMA20 > EMA50
- EMA20 > EMA50 > EMA200 (creates 2 rules)
- EMA9 > EMA20 AND EMA50 > EMA200
```

**UI:**
- Expand "EMA Trend Rules"
- Click "+ Add Another"
- Select EMAs and operator
- Add as many as needed

### 2. RSI Range
**Purpose:** Filter by momentum

**Examples:**
```
- RSI between 40 and 70
- RSI above 50 (sets range 50-100)
- RSI below 30 (sets range 0-30)
```

**UI:**
- Expand "RSI Range"
- Set Min and Max values
- Only one RSI range per strategy

### 3. Volume Rules
**Purpose:** Require volume confirmation

**Types:**
- **Z-Score**: Standard deviations from average
- **Relative**: Percentage above/below average
- **Absolute**: Specific volume number

**Examples:**
```
- Volume z-score >= 1 (above average)
- Volume z-score >= 2 (significantly above average)
- Volume relative >= 50 (50% above average)
```

**UI:**
- Expand "Volume Rules"
- Select type, operator, threshold
- Can add multiple volume rules

### 4. Price Distance Rules
**Purpose:** Ensure price near key level

**Examples:**
```
- Price within 1.5 ATR of EMA50
- Price within 2% of EMA20
- Price within 1 ATR of entry
```

**UI:**
- Expand "Price Distance Rules"
- Enter level (e.g., "ema50")
- Set distance and unit (ATR or %)
- Can add multiple distance checks

### 5. Candle Patterns
**Purpose:** Require specific candle formations

**Available Patterns:**
- Bullish Engulfing
- Bearish Engulfing
- Hammer
- Shooting Star
- Doji
- Any Bullish
- Any Bearish

**UI:**
- Expand "Candle Patterns"
- Select pattern from dropdown
- Can require multiple patterns (AND logic)

### 6. Multi-Bar Conditions
**Purpose:** Require multiple bars meeting criteria

**Parameters:**
- **Count**: Number of bars required (1-10)
- **Direction**: Up/Down/Any
- **Min Level**: Bars must stay above (e.g., "ema50")
- **Max Level**: Bars must stay below (e.g., "ema20")

**Examples:**
```
- 2 bars closing above EMA50
- 3 consecutive bullish bars
- 2 red candles staying above EMA50 support
```

**UI:**
- Expand "Multi-Bar Conditions"
- Set count, direction, levels
- Can add multiple conditions

## 🎯 Expression Syntax

### Variables
```
entry    - Entry price
stop     - Stop loss price
price    - Current price
high     - Current bar high
low      - Current bar low
close    - Current bar close
ema9     - 9-period EMA
ema20    - 20-period EMA
ema50    - 50-period EMA
ema200   - 200-period EMA
```

### Operators
```
+   Addition
-   Subtraction
*   Multiplication
/   Division
()  Grouping
```

### Examples
```
entry+1.5*ATR          Target 1.5 ATR above entry
entry-1*ATR            Stop 1 ATR below entry
ema50-0.5*ATR          Half ATR below EMA50
entry+3*ATR            Target 3 ATR above entry
low-2*ATR              2 ATR below swing low
```

## ✅ Validation Rules

### Required Fields
- ✅ Direction (long/short)
- ✅ Timeframe
- ✅ Entry trigger
- ✅ Stop loss
- ✅ At least one target

### Validation Checks
- ✅ RSI min < max
- ✅ ATR min < max
- ✅ Valid expression syntax
- ✅ All EMAs available

### Warnings (Non-Blocking)
- ⚠️ No eligibility criteria
- ⚠️ Very wide ranges

## 🔍 Evaluation Process

When a stock is analyzed:

**Step 1:** Check ALL EMA rules
- If ANY fails → Stock rejected

**Step 2:** Check RSI range
- If outside range → Stock rejected

**Step 3:** Check ALL volume rules
- If ANY fails → Stock rejected

**Step 4:** Check ALL price distances
- If ANY fails → Stock rejected

**Step 5:** Check ALL candle patterns
- If ANY missing → Stock rejected

**Step 6:** Check ALL multi-bar conditions
- If ANY fails → Stock rejected

**Result:** Only stocks passing ALL checks proceed to entry calculation

## 📊 Common Patterns

### Trend Following
```
EMA20 > EMA50 > EMA200
RSI > 50
Volume z-score >= 1
```

### Mean Reversion
```
EMA20 < EMA50 (but EMA50 > EMA200 for trend)
RSI < 30
Price within 2 ATR of EMA200
```

### Breakout Strategy
```
Price > high (previous day)
Volume z-score >= 2
EMA20 > EMA50
Bullish engulfing
```

### Pullback Strategy
```
EMA20 > EMA50 > EMA200 (uptrend)
Price within 1.5 ATR of EMA50
RSI 40-60
2 bars above EMA50
Bullish pattern
```

## 🛠️ Troubleshooting

### "No stocks qualified"
**Possible Causes:**
- Conditions too strict
- Combination too rare
- Wrong market conditions

**Solutions:**
- Relax some ranges (wider RSI, ATR)
- Remove optional conditions
- Try different timeframe
- Check market regime

### "Invalid expression"
**Common Issues:**
- Typos in variable names (use lowercase)
- Missing operators
- Unbalanced parentheses

**Fix:**
- Use exact names: entry, ema50, ATR
- Check math operators
- Test expression alone first

### "Missing EMA data"
**Cause:** Not enough historical bars

**Solution:**
- Strategy automatically skips if data missing
- Ensure sufficient history loaded

## 💡 Best Practices

### 1. Start Simple
Begin with 2-3 core conditions:
```
EMA20 > EMA50
RSI 40-70
Volume above average
```

### 2. Add Gradually
Test strategy, then add:
```
+ Price distance check
+ Candle pattern
+ Multi-bar confirmation
```

### 3. Balance Precision vs Opportunity
- Too strict → No matches
- Too loose → Low quality setups
- Find sweet spot through testing

### 4. Use Meaningful Conditions
Each condition should:
- Have a reason (not random)
- Add value (not redundant)
- Be testable

### 5. Test with Scanner
- Run scan with new strategy
- Review qualified stocks
- Check if results make sense
- Adjust as needed

## 📈 Example Strategies

### Conservative Long
```
Name: Conservative EMA Pullback
Direction: Long
Timeframe: Daily

Conditions:
- EMA20 > EMA50 > EMA200
- RSI 45-65
- Volume z-score >= 0.5
- Price within 1 ATR of EMA50
- 2 bars closing above EMA50

Entry: Price crosses EMA50
Stop: 1.5 ATR below entry
Targets: 1.5 ATR, 2.5 ATR
```

### Aggressive Breakout
```
Name: High Volume Breakout
Direction: Long
Timeframe: Daily

Conditions:
- EMA9 > EMA20
- RSI > 55
- Volume z-score >= 2
- Bullish engulfing
- 3 consecutive bullish bars

Entry: Previous day high
Stop: 1 ATR below entry
Targets: 2 ATR, 4 ATR
```

### Mean Reversion
```
Name: Oversold Bounce
Direction: Long
Timeframe: Daily

Conditions:
- EMA50 > EMA200 (trend filter)
- RSI < 35
- Price within 2 ATR of EMA200
- Hammer pattern

Entry: Price crosses above EMA9
Stop: 2 ATR below entry
Targets: 1.5 ATR, 3 ATR
```

## 🔗 Related Documentation

- **`STRATEGY_BUILDER_ENHANCEMENTS_COMPLETE.md`**: Full technical details
- **`ENHANCEMENTS_SUMMARY.md`**: High-level overview
- **`STRATEGY_BUILDER_QUICK_START.md`**: Original quick start guide

## 🆘 Need Help?

### Check Console Logs
Browser console shows:
- Parse process details
- Validation results
- Evaluation step-by-step

### Review Error Messages
System provides:
- Specific field with issue
- What's wrong
- How to fix

### Test Incrementally
1. Create basic strategy (works)
2. Add one condition
3. Test
4. Add next condition
5. Repeat

---

**Version:** Enhanced Multi-Condition Support
**Status:** Production Ready
**Last Updated:** Implementation Complete

