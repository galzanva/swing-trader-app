# Deep Analysis Feature Guide

## Overview

The Deep Analysis feature provides comprehensive technical analysis for any stock symbol, including:
- Real-time market data from Polygon.io
- Technical indicators (EMAs, RSI, MACD, Volume)
- Pattern detection (engulfing, hammer, trends, etc.)
- Risk management with entry/stop/targets
- AI-powered insights via OpenAI GPT-4
- Setup scoring and recommendations

## Setup

### Required API Keys

Add these to your `.env` file:

```env
POLYGON_API_KEY="your_polygon_api_key"
OPENAI_API_KEY="your_openai_api_key"  # Optional but recommended
```

### Get API Keys

**Polygon.io** (Market Data)
1. Go to https://polygon.io
2. Sign up for a free account
3. Get your API key from dashboard
4. Free tier includes: 5 API calls/minute, delayed data

**OpenAI** (AI Analysis) - Optional
1. Go to https://platform.openai.com
2. Create an account
3. Generate API key
4. Add credits to your account (~$5 recommended)

## Features

### 1. Technical Indicators

**Moving Averages:**
- EMA 9, 20, 50, 200
- Trend identification
- Support/resistance levels

**Momentum Indicators:**
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- Volume Z-Score

**Volatility:**
- ATR (Average True Range) for stop-loss calculation

### 2. Pattern Detection

Automatically detects:
- **Bullish Patterns:** Engulfing, Hammer, Uptrend
- **Bearish Patterns:** Bearish Engulfing, Shooting Star, Downtrend
- **Neutral Patterns:** Consolidation, Range
- **Volume Patterns:** Breakouts on high volume

Each pattern includes:
- Confidence score (0-100%)
- Description
- Timeframe

### 3. Setup Scoring

Multi-factor scoring system (0-100):
- **Technical (30%):** EMA alignment, trend strength
- **Momentum (25%):** RSI, MACD status
- **Trend (20%):** Trend direction and strength
- **Pattern (15%):** Pattern confidence
- **Volume (10%):** Volume confirmation

**Ratings:**
- A+/A: 85-100 (Strong Buy)
- B+/B: 70-84 (Buy)
- C+/C: 50-69 (Hold)
- D: 40-49 (Sell)
- F: 0-39 (Strong Sell)

### 4. Risk Management

Automatically calculates:
- **Entry:** Current market price
- **Stop Loss:** Based on ATR and support levels
- **Targets:** 3 targets at 2R, 3R, 4R
- **Risk/Reward Ratios:** For each target
- **Position Sizing:** 1-2% account risk rule

### 5. AI Analysis

GPT-4 powered insights:
- **Narrative:** Clear explanation of the technical setup
- **Mentor Notes:** Educational insights on indicators
- **Strengths:** What's working in the setup
- **Warnings:** Risks to be aware of
- **Rules Fired:** Transparency on what triggered the analysis

## Usage

### Basic Analysis

1. Navigate to **Deep Analysis** tab
2. Enter ticker symbol (e.g., AAPL, TSLA, SPY)
3. Select timeframe (1 day, 1 hour, 15 min, etc.)
4. Click **Analyze**

### Reading the Report

**Header Section:**
- Symbol, pattern name, score rating
- Current price, market cap, exchange

**Risk Management:**
- Entry, stop loss, and 3 targets
- Risk/reward ratios
- Position sizing guidance

**Technical Indicators:**
- All EMAs, RSI, MACD values
- Volume analysis
- Support/resistance levels

**Score Breakdown:**
- Visual breakdown of each scoring component
- Overall rating and recommendation

**AI Analysis:**
- Narrative summary
- Mentor educational notes
- Strengths, warnings, and reasoning

## Best Practices

### For Swing Trading

1. **Use Daily Timeframe** for swing trades (2-10 days)
2. **Minimum 2:1 R:R** - Don't take setups below this
3. **Check Multiple Timeframes** - Analyze daily, then confirm on hourly
4. **Volume Confirmation** - Look for Z-score > 1
5. **Trend Alignment** - Best setups have bullish/bearish trend

### Risk Management Rules

1. **Never risk more than 1-2%** of account on single trade
2. **Use the calculated stop loss** - Don't widen it
3. **Take profits at targets** - Scale out: 50% at T1, 30% at T2, 20% at T3
4. **Move stop to breakeven** after T1 is hit
5. **Don't force trades** - Wait for quality setups (Score 70+)

### Interpreting Scores

**A/A+ (85-100): Excellent Setup**
- Strong trend alignment
- High pattern confidence
- Favorable risk/reward
- Good volume
- **Action:** Full position size

**B/B+ (70-84): Good Setup**
- Most factors aligned
- Minor concerns
- **Action:** Normal position size

**C/C+ (50-69): Marginal**
- Mixed signals
- Lower confidence
- **Action:** Half position or pass

**D/F (<50): Avoid**
- Poor setup quality
- High risk
- **Action:** Do not trade

## Timeframe Guide

### Swing Trading (2-10 days)
- **Primary:** 1 Day
- **Confirmation:** 1 Hour
- Best for: Position trades, less screen time

### Day Trading (intraday)
- **Primary:** 15 Min / 5 Min
- **Confirmation:** 1 Hour
- Best for: Active traders, quick moves

### Scalping (minutes)
- **Primary:** 1 Min / 5 Min
- **Confirmation:** 15 Min
- Best for: Very active traders, small gains

## Limitations

1. **Market Hours:** Polygon free tier has delayed data
2. **Rate Limits:** 5 calls/minute on free tier
3. **Historical Data:** Limited to available bars
4. **AI Analysis:** Requires OpenAI API key and credits
5. **Pattern Detection:** No pattern is 100% accurate
6. **Not Financial Advice:** Use for education and research

## Troubleshooting

### "POLYGON_API_KEY not configured"
- Add `POLYGON_API_KEY` to `.env` file
- Restart dev server: `npm run dev`

### "Insufficient data for analysis"
- Symbol might be delisted or inactive
- Try a different timeframe
- Check symbol is correct

### "Analysis failed"
- Check API key is valid
- Check rate limits (5/min on free tier)
- Check console for detailed errors

### No AI Analysis
- Check `OPENAI_API_KEY` in `.env`
- Check OpenAI account has credits
- Analysis will still work without AI (uses fallback)

## Technical Details

### Data Flow

1. **User Input:** Symbol + Timeframe
2. **Fetch Data:** Polygon API → OHLCV bars
3. **Calculate:** Technical indicators
4. **Detect:** Patterns
5. **Score:** Setup quality
6. **Risk:** Entry/stops/targets
7. **AI:** GPT-4 analysis
8. **Display:** Comprehensive report

### File Structure

```
lib/
├── indicators/
│   └── technical.ts        # EMA, RSI, MACD, Volume
├── patterns/
│   └── detector.ts         # Pattern detection
├── scoring/
│   └── rating.ts           # Setup scoring
├── risk/
│   └── management.ts       # Risk/reward calculations
├── data-vendors/
│   └── polygon.ts          # Polygon API client
└── llm/
    └── analyzer.ts         # OpenAI integration

app/
├── api/
│   └── analyze/
│       └── route.ts        # Main analysis API
└── analyze-client.tsx      # UI component
```

## Examples

### High-Quality Setup (A Rating)

```
Symbol: AAPL
Pattern: Bullish Engulfing
Score: 87/100
Trend: Bullish (85 strength)
RSI: 55 (neutral)
Volume: 2.3x average
R:R: 3.2:1
```

**Interpretation:** Strong buy signal, bullish trend, high volume confirmation.

### Low-Quality Setup (D Rating)

```
Symbol: XYZ
Pattern: No Clear Pattern
Score: 45/100
Trend: Neutral (50 strength)
RSI: 72 (overbought)
Volume: 0.6x average
R:R: 1.8:1
```

**Interpretation:** Pass. Mixed signals, overbought, low volume, poor R:R.

## Support

For issues or questions:
1. Check this guide
2. Review console logs for errors
3. Verify API keys are correct
4. Check API rate limits

## Updates

This is MVP v1. Future enhancements:
- Historical cohort probability analysis
- Earnings calendar integration
- News sentiment analysis
- Backtesting capabilities
- Real-time alerts

---

**Remember:** This tool provides analysis and education. It is NOT financial advice. Always do your own research and never risk more than you can afford to lose.

