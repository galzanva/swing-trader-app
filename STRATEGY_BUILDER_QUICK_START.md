# Strategy Builder - Quick Start Guide

## 🚀 Getting Started

The Strategy Builder allows you to create custom trading strategies using plain English. Your strategies will be **automatically evaluated first** before the 6 core strategies when analyzing a ticker.

---

## 📝 How to Use

### 1. Access the Strategy Builder
1. Log in to your dashboard
2. Click the **🛠️ Strategy Builder** tab

### 2. Describe Your Strategy
Write your strategy in plain English in the textarea. Include:
- **Direction**: Long or short
- **Timeframe**: Daily, hourly, 15min, etc.
- **Entry conditions**: When to enter (pullback, breakout, etc.)
- **Stop loss**: Where to place your stop
- **Targets**: Your profit targets

### 3. Review & Edit
- The system will parse your description into a structured strategy
- Review the auto-generated parameters
- Edit any field directly in the form
- Adjust risk management settings

### 4. Save & Activate
- Click **Save Strategy**
- Your strategy is now active and will be evaluated automatically

---

## 💡 Example Strategies

### Trend Pullback Long
```
Go long on daily timeframe when price pulls back to EMA20 in an uptrend 
(EMA20 > EMA50 > EMA200). Enter when RSI crosses above 50 with volume 
confirmation. Stop loss at 1 ATR below entry. Target 1 at entry + 1.5×ATR, 
Target 2 at entry + 2.5×ATR.
```

### RSI Reversal Short
```
Short on 1-hour timeframe when RSI is above 70 and price breaks below EMA20 
with high volume. Stop at EMA50. Target at EMA200.
```

### Flag Breakout Long
```
Go long when a bullish flag pattern forms on the daily chart and price breaks 
above the flag with volume. Stop below the flag base. Target at 2×ATR from entry.
```

### Mean Reversion Short
```
Short when price extends 2 ATR above EMA20 with RSI above 75. Stop at entry + 1 ATR. 
Target 1 at EMA20, Target 2 at EMA50.
```

---

## 🎯 Key Concepts

### Direction
- **Long**: Buy (profit when price goes up)
- **Short**: Sell (profit when price goes down)

### Timeframe
- `1day`: Daily bars (swing trading)
- `1hour`: Hourly bars (intraday)
- `15min`, `5min`, `1min`: Shorter timeframes (day trading)

### Entry Triggers
- **Pullback**: Price retraces to a level (e.g., EMA20)
- **Breakout**: Price breaks above/below a level
- **Reversal**: Price changes direction at extremes

### Stop Loss Types
- **ATR-based**: `entry - 1*ATR` (dynamic based on volatility)
- **EMA-based**: `ema20` or `ema50` (support/resistance)
- **Fixed**: `45.50` (specific price level)

### Target Expressions
- **ATR multipliers**: `entry + 1.5*ATR` (scales with volatility)
- **EMAs**: `ema50` or `ema200` (key levels)
- **Fixed prices**: `52.00` (specific target)

### Volume Confirmation
- **Above average**: Volume higher than recent average
- **Z-score**: Statistical volume spike (>0, >1, >2)

### RSI Conditions
- **Oversold**: RSI < 30 (potential bounce)
- **Overbought**: RSI > 70 (potential reversal)
- **Range**: RSI between 40-60 (momentum confirmation)

---

## 🔧 Advanced Features

### EMA Rules
```
"EMA20 > EMA50 > EMA200" → Uptrend
"EMA20 < EMA50 < EMA200" → Downtrend
"price near EMA20" → Pullback setup
```

### Pattern Requirements
```
"bullish engulfing candle"
"hammer at support"
"flag pattern forms"
"double top pattern"
```

### Multi-Bar Confirmation
```
"wait for 2 consecutive closes above EMA20"
"confirm with 3 bars of increasing volume"
```

### Risk Management
- **Minimum R:R**: Won't enter if reward/risk < 1.5 (default)
- **Max Position**: Caps position size at 2% (default)
- **Earnings Buffer**: Avoids trades within 3 days of earnings

---

## 📊 How It Works

1. **You describe** your strategy in plain English
2. **System parses** it into structured DSL (Domain Specific Language)
3. **You review** the auto-generated parameters
4. **You save** and activate the strategy
5. **System evaluates** your strategy first when analyzing any ticker
6. **Best strategy** (yours or core) is selected based on viability score

---

## 🎓 Pro Tips

### Be Specific
❌ "Buy when price is good"
✅ "Go long when price pulls back to EMA20 with RSI above 50"

### Include Key Details
- Entry trigger
- Stop loss level
- At least one target
- Timeframe preference

### Use Standard Terms
- EMAs: EMA9, EMA20, EMA50, EMA200
- RSI: RSI values (0-100)
- ATR: ATR multipliers (0.5×, 1×, 1.5×, 2×)
- Volume: "high volume", "above average", "volume confirmation"

### Start Simple
Begin with basic conditions and add complexity as you test:
1. Direction + Timeframe
2. Entry condition
3. Stop and Target
4. Add filters (RSI, volume, etc.)

---

## 🔄 Managing Your Strategies

### View All Strategies
- (Coming soon) Dedicated management page
- See active/inactive status
- View performance stats

### Edit Strategy
- Click edit on any strategy
- Modify parameters
- Save changes

### Deactivate Strategy
- Toggle active/inactive status
- Inactive strategies won't be evaluated

### Delete Strategy
- Permanently remove a strategy
- Cannot be undone

---

## 🚨 Common Questions

### Q: How many strategies can I create?
A: No limit! Create as many as you need.

### Q: Can I have multiple strategies active?
A: Yes. The system evaluates all active strategies and picks the best one.

### Q: What if my strategy and a core strategy both qualify?
A: Your strategy always takes priority (evaluated first).

### Q: How do I know if my strategy is working?
A: (Coming soon) Historical backtesting will show past performance.

### Q: Can I copy and modify existing strategies?
A: (Coming soon) Clone feature will allow easy duplication.

### Q: What if I make a mistake?
A: You can edit or delete strategies anytime. Changes take effect immediately.

---

## 🎯 Strategy Checklist

Before saving, ensure your strategy has:
- [ ] Clear direction (long/short)
- [ ] Specific timeframe
- [ ] Entry condition/trigger
- [ ] Stop loss level
- [ ] At least one target
- [ ] Name that describes the strategy
- [ ] (Optional) Filters like RSI, volume, patterns

---

## 🔗 Integration with Analysis

When you analyze a ticker:
1. System fetches market data
2. **Evaluates your active strategies first** (sorted by priority/viability)
3. If no user strategy qualifies, evaluates core strategies
4. Returns best setup with full mentor analysis
5. Tracks usage for each strategy

Your strategies get the **same rich context** as core strategies:
- Setup summary
- Trade plan (entry, stop, targets)
- Risk/reward ratios
- Historical performance (when available)
- Qualification reasons
- Invalidation rules

---

## 📚 Next Steps

1. **Create your first strategy** using one of the examples above
2. **Test it** on a few tickers you're familiar with
3. **Refine** based on results
4. **Build a library** of strategies for different market conditions

Happy trading! 🚀

---

**Last Updated**: October 16, 2025
