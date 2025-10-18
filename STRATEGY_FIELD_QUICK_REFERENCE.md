# Strategy Builder - Quick Reference Guide

## 🎯 Common Field Values (Copy & Paste Ready)

### Trigger Level (Entry Points)

#### **For Broad Scans (Recommended)**
```
ema20
ema50
ema200
vwap
close
entry+1*ATR
ema50-1*ATR
```

#### **For Pattern-Based (Rare, expect 0-5% qualified)**
```
double_bottom_support
primary_support
ascending_triangle_resistance
```

### Stop Loss

#### **ATR-Based (Most Common)**
```
entry-1*ATR
entry-1.5*ATR
entry-2*ATR
```

#### **Percentage-Based**
```
entry-2%
entry-3%
entry-5%
```

#### **Indicator-Based**
```
ema50
ema20-0.5*ATR
vwap-1%
```

### Profit Targets

#### **ATR-Based (Best for Dynamic R:R)**
```
entry+1.5*ATR
entry+2*ATR
entry+3*ATR
```

#### **Percentage-Based**
```
entry+5%
entry+10%
entry+15%
```

#### **Indicator-Based**
```
ema200
ema50+1*ATR
```

### Price Distance Rules

#### **Format**
```
From Level: ema50
Max Distance: 1.5
Unit: atr
```

#### **Common Combinations**
- `ema50` within `1.5` `ATR` (pullback to EMA50)
- `ema20` within `2` `%` (near-term moving average)
- `vwap` within `1` `ATR` (VWAP reversion)

### Expression Syntax

#### **Basic Operations**
```
entry+1*ATR       → Entry plus 1 ATR
entry-2%          → 2% below entry
ema50+0.5*ATR     → Half ATR above EMA50
(ema20+ema50)/2   → Midpoint of two EMAs
```

#### **Important Rules**
- `ATR` must be UPPERCASE
- Use `*` for multiplication
- Use parentheses for order: `(a+b)/2`
- Percentages are relative: `ema50+5%` = EMA50 × 1.05

## ⚠️ Why Am I Getting 0 Qualified Results?

### **Most Common Reason: Pattern Variables**
If your strategy uses:
- `double_bottom_support`
- `double_top_resistance`
- `ascending_triangle_resistance`
- Any pattern-derived variable

**These patterns are detected in only 1-5% of stocks!**

### **Solution: Use Indicators Instead**
Replace pattern variables with:
- ✅ `ema20`, `ema50`, `ema200` (always available)
- ✅ `vwap` (for intraday)
- ✅ `entry+1*ATR` (dynamic)
- ✅ `close+2%` (percentage-based)

### **Example Fix**
```diff
❌ BEFORE (0 qualified):
Trigger: double_bottom_support
Price Distance: from double_bottom_support within 0.5 ATR

✅ AFTER (many qualified):
Trigger: ema50
Price Distance: from ema50 within 1.5 ATR
```

## 📊 Pattern Detection Details

### **Double Bottom**
- Window: Last **50 bars**
- Criteria: Symmetry ≤2%, Separation ≥10 bars, Height ≥1× ATR
- Availability: **1-3% of stocks**

### **Ascending Triangle**
- Window: Last **80 bars**
- Criteria: Flat resistance (R²≥0.70), Rising support, ≥5 touches
- Availability: **1-2% of stocks**

### **Flags**
- Window: Last **45 bars**
- Criteria: ≥8% pole move, Parallel channels, Declining volume
- Availability: **1-3% of stocks**

## 💡 Best Practices

### **For Maximum Qualified Results**
1. ✅ Use EMAs, VWAP, or ATR-based levels
2. ✅ Keep eligibility conditions simple (2-4 criteria)
3. ✅ Use pattern detection as a *bonus*, not a requirement
4. ✅ Test with broad criteria first, then narrow down

### **For Specific Pattern-Based Strategies**
1. ⚠️ Accept that only 1-5% of stocks will qualify
2. ⚠️ Use pattern variables only for specialized, patient strategies
3. ⚠️ Consider using pattern variables in *description* only, not eligibility
4. ⚠️ Increase scan breadth (don't use early exit)

## 🔍 How to Find Valid Variables

### **In Strategy Builder**
Click the **ℹ️ icon** next to any field to see:
- Complete list of valid variables
- Expression syntax examples
- Pattern variable warnings
- Format requirements

### **Quick Access**
- Entry field → Click ℹ️ → "Trigger Level" tab
- Stop Loss field → Click ℹ️ → "Stop Loss" tab
- Targets field → Click ℹ️ → "Target Level" tab
- Price Distance → Click ℹ️ in section header → "Price Distance" tab

## 📝 Complete Example Strategy

### **Reliable EMA Pullback Strategy**
```
Name: EMA50 Pullback Long
Direction: Long
Timeframe: Daily

Eligibility:
- EMA20 > EMA50 > EMA200 (uptrend)
- RSI: 40-70 (not overbought/oversold)
- Volume: z-score >= 1 (above average)
- Price Distance: from ema50 within 1.5 ATR (pullback)

Trigger: ema50
Stop Loss: entry-1.5*ATR
Targets:
- T1: entry+1.5*ATR
- T2: entry+3*ATR
```

**Expected Results**: 10-50 qualified stocks per scan

### **Rare Pattern-Based Strategy**
```
Name: Double Bottom Breakout
Direction: Long
Timeframe: Daily

Eligibility:
- EMA20 > EMA50 (mild uptrend)
- RSI: 40-60
- Price Distance: from double_bottom_support within 0.5 ATR

Trigger: double_bottom_neckline
Stop Loss: double_bottom_support-1*ATR
Targets:
- T1: double_bottom_target
```

**Expected Results**: 0-3 qualified stocks per scan (very rare!)

## 🚀 Quick Fixes for Common Issues

### **Issue: "Unresolved variables in expression"**
**Cause**: Using a pattern variable that wasn't detected
**Fix**: Replace with `ema20`, `ema50`, or `vwap`

### **Issue: "0 qualified results"**
**Cause**: Pattern variables in eligibility criteria
**Fix**: Remove pattern-based price distances, use EMAs instead

### **Issue: "Invalid expression syntax"**
**Cause**: Lowercase `atr` or missing operators
**Fix**: Use `ATR` (uppercase), add `*` for multiplication

### **Issue: "Only 20 analyzed"**
**Cause**: Scanner early exit (by design)
**Fix**: Adjust `maxResults` in scanner config if needed

## 📚 Additional Resources

- **Full Documentation**: Open any help modal (ℹ️ icon)
- **Expression Syntax**: Help modal → "Expression Syntax" tab
- **Pattern Variables**: Help modal → "Patterns" tab
- **Troubleshooting**: See `MARKET_SCANNER_PATTERN_SUPPORT_COMPLETE.md`

