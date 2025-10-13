# Understanding Polygon Data & Freshness

## What You Should Expect

According to [Polygon's documentation](https://polygon.io/docs/rest/quickstart), the free tier provides:

✅ **End-of-Day Data** - Updated daily after market close  
✅ **Historical Data** - Full historical trading data  
✅ **Same-day availability** - Yesterday's close available today  

### Normal Data Age:

| Day | Expected Data Age | Normal? |
|-----|------------------|---------|
| Monday | 1-3 days (includes weekend) | ✅ Yes |
| Tuesday-Friday | 1 day | ✅ Yes |
| After hours | Same day (today's data) | ✅ Yes |

### Abnormal Data Age:

| Age | Likely Cause | Action |
|-----|--------------|--------|
| 7+ days | Stock delisted/suspended | 🛑 Do not trade |
| 30+ days | Company inactive | 🛑 Do not trade |
| 296 days | Symbol issue or delisted | 🛑 Verify symbol |

## Common Scenarios

### ✅ Scenario 1: Weekend Gap (Normal)
```
Today: Monday, Oct 14, 2025
Last data: Friday, Oct 11, 2025
Age: 3 days
Status: NORMAL - Weekend gap
Action: Safe to analyze
```

### ✅ Scenario 2: After Market Close (Normal)
```
Today: Tuesday, Oct 15, 2025 (8PM ET)
Last data: Tuesday, Oct 15, 2025 (4PM close)
Age: 0 days
Status: NORMAL - Same day data
Action: Perfect for next-day swing trades
```

### ⚠️ Scenario 3: Holiday/Long Weekend (Normal)
```
Today: Tuesday, Oct 15, 2025
Last data: Thursday, Oct 10, 2025
Age: 5 days (includes 3-day weekend)
Status: CHECK - Verify no major news
Action: Verify price hasn't gapped
```

### 🛑 Scenario 4: Very Old Data (PROBLEM!)
```
Today: Oct 12, 2025
Last data: Dec 20, 2024
Age: 296 days
Status: PROBLEM - Stock likely delisted
Action: DO NOT TRADE - Verify symbol
```

## What Causes Very Old Data?

### 1. Delisted Stocks
- Company went bankrupt
- Merged/acquired by another company
- Moved to OTC markets
- Example: GPRO (GoPro) if delisted

### 2. Suspended Trading
- SEC investigation
- Regulatory issues
- Pending major announcement

### 3. Invalid Symbol
- Typo in ticker entry
- Symbol changed (corporate action)
- Wrong exchange

### 4. API Issues (Rare)
- Polygon data gap
- Rate limiting issue
- Technical problem

## How Our App Handles This

### ✅ Enhanced Logging
```
[Polygon] Symbol: AAPL
[Polygon] Requesting data from 2023-10-12 to 2025-10-12
[Polygon] Received 504 bars. Status: OK
[Polygon] Last bar date: 2025-10-11T04:00:00.000Z
[Polygon] Days since last bar: 1
[Polygon] Last close price: $178.45
```

### ✅ Warning System
- **0-1 days:** ✅ No warning (current data)
- **2-7 days:** ⚠️ Yellow warning (verify price)
- **7+ days:** 🛑 Red warning (do not trade!)

### ✅ Clear UI Indicators
- Shows exact last data date
- Calculates days old
- Different warning levels
- Actionable guidance

## Testing Your Setup

Try these symbols to verify data freshness:

### ✅ Should Have Fresh Data (1 day old):
- **AAPL** - Apple (highly liquid)
- **SPY** - S&P 500 ETF (always trades)
- **MSFT** - Microsoft (major stock)
- **TSLA** - Tesla (active trading)

### 🛑 Might Have Old Data:
- Recently delisted companies
- Bankrupt companies
- Very low-volume penny stocks

## What to Do if Data is Very Old

### Step 1: Verify the Symbol
```bash
# Check on major sites:
- TradingView.com
- Yahoo Finance
- Your broker (Robinhood, etc.)
```

### Step 2: Check Company Status
- Is company still trading?
- Any recent news about delisting?
- Did it merge with another company?

### Step 3: Try Alternative Symbol
- Some companies change tickers
- May need to add exchange suffix
- Example: GOOGL vs GOOG

### Step 4: Report if Issue Persists
If major stocks (AAPL, MSFT, etc.) show old data:
1. Check your Polygon API key is valid
2. Verify API request in console logs
3. Check Polygon API status page
4. Contact support if needed

## Polygon API Best Practices

From [Polygon's REST API docs](https://polygon.io/docs/rest/quickstart):

### Authentication
```bash
# Include API key in request
curl "https://api.polygon.io/v2/aggs/ticker/AAPL/range/1/day/2023-01-01/2025-10-12?apiKey=YOUR_KEY"
```

### Response Format
```json
{
  "status": "OK",
  "results": [
    {
      "t": 1697040000000,  // timestamp
      "o": 178.20,         // open
      "h": 179.50,         // high
      "l": 177.80,         // low
      "c": 178.45,         // close
      "v": 45823000        // volume
    }
  ]
}
```

### Rate Limits (Free Tier)
- 5 API calls per minute
- Unlimited historical data access
- End-of-day data only

## Upgrading for Real-Time Data

If you need fresher data:

### Polygon Paid Plans
- **Starter:** $200/month - Real-time stocks
- **Developer:** $250/month - Real-time + options
- Visit: https://polygon.io/pricing

### Benefits of Paid Plans
- Real-time quotes (15-second delay)
- Intraday bars (1min, 5min, etc.)
- Higher rate limits
- WebSocket streaming
- Better for day trading

### Free Alternatives
- **TradingView** - Free real-time charts
- **Yahoo Finance** - 15-minute delayed quotes
- **Your Broker** - Real-time for customers

## Bottom Line

**End-of-day data should be 0-3 days old:**
- ✅ 0-1 days: Perfect for swing trading
- ⚠️ 2-7 days: Acceptable with verification
- 🛑 7+ days: Problem - investigate before trading
- 🛑 30+ days: Definitely a problem - do not trade

**If you see 296-day-old data:**
1. Stock is likely delisted or suspended
2. Verify symbol is correct
3. Check company status
4. DO NOT trade without verification

**Our app now:**
- ✅ Requests data up to today (not yesterday)
- ✅ Shows clear warnings based on age
- ✅ Logs detailed info to console
- ✅ Prevents trading on stale data

---

**Always verify data freshness before trading!** When in doubt, check TradingView or your broker.

