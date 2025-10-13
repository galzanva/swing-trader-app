# Deep Analysis - Quick Reference Card

## 🚀 Getting Started (2 Minutes)

### 1. Add API Keys to `.env`
```env
POLYGON_API_KEY="your_key_here"  # Required
OPENAI_API_KEY="your_key_here"   # Optional
```

### 2. Get Keys
- **Polygon:** https://polygon.io (FREE)
- **OpenAI:** https://platform.openai.com ($5 credit)

### 3. Restart Server
```bash
npm run dev
```

### 4. Analyze!
1. Login → Dashboard
2. Click "Deep Analysis" tab
3. Enter ticker (e.g., AAPL)
4. Click "Analyze"
5. Get comprehensive report in 5-10 seconds!

## 📊 What You Get

### Header
- Pattern name with confidence %
- Letter grade (A+ to F)
- Buy/Sell recommendation
- Current price

### Risk Management
- Entry price
- Stop loss (-2ATR or below support)
- 3 targets with R:R ratios
- Position sizing guidance

### Technical Indicators
- EMAs (9, 20, 50, 200)
- RSI, MACD, Volume
- Trend direction + strength
- Support/resistance levels

### Score Breakdown
- Technical (30%)
- Momentum (25%)
- Trend (20%)
- Pattern (15%)
- Volume (10%)
= Overall 0-100

### AI Analysis
- Clear narrative
- Mentor educational notes
- Strengths (what's working)
- Warnings (what to watch)
- Rules fired (transparency)

## 🎯 Trading Rules

### Only Take These Trades:
✅ Score 70+ (B or better)
✅ R:R minimum 2:1
✅ Trend aligned with setup
✅ Volume confirmation (Z-score > 0)
✅ Pattern confidence > 70%

### Risk 1-2% Per Trade:
```
$10,000 account = risk $100-200
$50,000 account = risk $500-1000
```

### Take Profits:
- 50% at Target 1
- 30% at Target 2
- 20% at Target 3
- Move stop to breakeven after T1

## 📈 Timeframes

**Swing Trading (2-10 days):**
- Use: 1 Day
- Confirm: 1 Hour

**Day Trading (hours):**
- Use: 15 Min
- Confirm: 1 Hour

**Scalping (minutes):**
- Use: 1 Min / 5 Min
- Confirm: 15 Min

## 🎓 Score Meanings

| Score | Rating | Action |
|-------|--------|--------|
| 85-100 | A+/A | Strong Buy - Full size |
| 70-84 | B+/B | Buy - Normal size |
| 50-69 | C+/C | Hold - Half size or pass |
| 40-49 | D | Sell - Avoid |
| 0-39 | F | Strong Sell - Avoid |

## ⚠️ Red Flags (Don't Trade)

❌ Score below 70
❌ R:R below 2:1
❌ RSI > 75 (overbought)
❌ RSI < 25 (oversold)
❌ Volume Z-score < -1 (low volume)
❌ Trend = "neutral" (no clear direction)
❌ Pattern confidence < 60%

## 🔍 Pattern Types

### Bullish (🟢):
- Bullish Engulfing
- Hammer
- Uptrend
- Volume Breakout (up)

### Bearish (🔴):
- Bearish Engulfing
- Shooting Star
- Downtrend
- Volume Breakout (down)

### Neutral (🔵):
- Consolidation
- No Clear Pattern

## 💡 Pro Tips

1. **Best stocks:** Large caps (AAPL, MSFT, TSLA)
2. **Best time:** After market open, before close
3. **Verify:** Check on TradingView
4. **Wait:** Quality over quantity
5. **Journal:** Track all trades
6. **Review:** Learn from winners AND losers

## 🛠️ Troubleshooting

**"POLYGON_API_KEY not configured"**
→ Add key to `.env`, restart server

**"Insufficient data"**
→ Symbol might be delisted, try different timeframe

**"Analysis failed"**
→ Check console, verify API keys, check rate limits (5/min free)

**No AI analysis**
→ Check `OPENAI_API_KEY`, add credits, or use without (fallback works)

## 📚 Learn More

- Full Guide: `docs/DEEP_ANALYSIS_GUIDE.md`
- Complete Summary: `DEEP_ANALYSIS_COMPLETE.md`
- Product Vision: `docs/PRODUCT_OVERVIEW.md`

## 🎉 You're Ready!

Start with:
1. AAPL (Apple) - stable large cap
2. SPY (S&P 500 ETF) - market indicator
3. TSLA (Tesla) - high volatility

**Remember:** The best trade is often the one you DON'T take. Wait for quality setups!

---

**Good luck and trade safe!** 📈

