/**
 * Polygon.io API Client
 * Fetches market data for analysis
 */

interface PolygonBar {
  t: number;  // timestamp
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
}

interface PolygonAggregatesResponse {
  results: PolygonBar[];
  status: string;
  resultsCount: number;
}

interface PolygonTickerDetails {
  results: {
    ticker: string;
    name: string;
    market_cap?: number;
    primary_exchange?: string;
    description?: string;
    market?: string;
    locale?: string;
    currency_name?: string;
  };
}

export interface MarketData {
  symbol: string;
  name: string;
  timeframe: string;
  bars: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  currentPrice: number;
  lastBarDate: Date;
  dataAgeDays: number;
  marketCap?: number;
  exchange?: string;
  shortInterest?: {
    shortFloat?: number; // % of float shorted
    daysToCover?: number; // Days to cover
    shortVolume?: number; // Recent short volume
    shortVolumeRatio?: number; // Short volume / total volume
  };
}

export interface GroupedDailyBar {
  T: string;  // Ticker symbol
  c: number;  // Close
  h: number;  // High
  l: number;  // Low
  o: number;  // Open
  v: number;  // Volume
  vw: number; // VWAP
  t: number;  // Timestamp
  n?: number; // Number of transactions
  otc?: boolean; // Is OTC
}

export interface GroupedDailyResponse {
  status: string;
  resultsCount: number;
  results: GroupedDailyBar[];
  adjusted: boolean;
  queryCount: number;
}

export interface PolygonFundamentals {
  ticker: string;
  date: string;
  price: number;
  market_cap?: number;
  earnings_per_share?: number;
  price_to_earnings?: number;
  price_to_book?: number;
  price_to_sales?: number;
  dividend_yield?: number;
  return_on_equity?: number;
  return_on_assets?: number;
  debt_to_equity?: number;
  current_ratio?: number;
  quick_ratio?: number;
  free_cash_flow?: number;
  ev_to_ebitda?: number;
}

export interface PolygonNewsArticle {
  id: string;
  title: string;
  author: string;
  published_utc: string;
  article_url: string;
  description?: string;
  tickers: string[];
  image_url?: string;
  publisher?: {
    name: string;
    homepage_url?: string;
    logo_url?: string;
  };
  insights?: Array<{
    ticker: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    sentiment_reasoning?: string;
  }>;
}

export interface OptionsContract {
  ticker: string; // e.g., "O:AAPL250117C00150000"
  strike: number;
  expiration: string; // YYYY-MM-DD
  type: 'call' | 'put';
  volume?: number;
  open_interest?: number;
  implied_volatility?: number;
  bid?: number;
  ask?: number;
  last_price?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export interface OptionsChainSnapshot {
  underlying_ticker: string;
  underlying_price: number;
  contracts: OptionsContract[];
  timestamp: number;
}

export interface OptionsInsight {
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  confidence: 'high' | 'medium' | 'low';
  message: string;
  callPutRatio: number;
  totalCallVolume: number;
  totalPutVolume: number;
  ivTrend: 'rising' | 'flat' | 'falling';
  atmStrike: number;
  topCallStrikes: Array<{ strike: number; volume: number; oi: number }>;
  topPutStrikes: Array<{ strike: number; volume: number; oi: number }>;
  expirations: string[];
  rawData: OptionsChainSnapshot;
}

export class PolygonClient {
  private apiKey: string;
  private baseUrl = "https://api.polygon.io";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetch all stocks snapshot (Massive.com full market snapshot)
   * This returns ALL U.S. stocks (10,000+) in a single API call - perfect for pre-filtering!
   * Documentation: https://massive.com/docs/rest/stocks/snapshots/full-market-snapshot
   */
  async getGroupedDaily(date?: string): Promise<GroupedDailyResponse> {
    try {
      // Massive.com uses the snapshot endpoint (no date parameter needed - always returns latest)
      const url = `${this.baseUrl}/v2/snapshot/locale/us/markets/stocks/tickers`;
      const params = new URLSearchParams({
        include_otc: 'false', // Exclude OTC by default
        apiKey: this.apiKey,
      });

      console.log(`[Polygon/Massive] Fetching full market snapshot (10,000+ stocks)...`);
      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Polygon/Massive] API error (${response.status}): ${errorText}`);
        throw new Error(`Massive.com API error (${response.status}): ${errorText}`);
      }

      const rawData: any = await response.json();
      console.log(`[Polygon/Massive] Raw response - status: ${rawData.status}, count: ${rawData.count}`);
      
      // Convert Massive.com snapshot format to our internal format
      // Massive returns: { status, count, tickers: [{ticker, day, prevDay, todaysChange, todaysChangePerc}] }
      // We need to preserve all the snapshot data including day, prevDay, and change data
      const converted: GroupedDailyResponse = {
        status: rawData.status,
        resultsCount: rawData.count || 0,
        results: (rawData.tickers || []).map((item: any) => ({
          T: item.ticker,
          c: item.day?.c || item.prevDay?.c || 0,
          h: item.day?.h || item.prevDay?.h || 0,
          l: item.day?.l || item.prevDay?.l || 0,
          o: item.day?.o || item.prevDay?.o || 0,
          v: item.day?.v || item.prevDay?.v || 0,
          vw: item.day?.vw || 0,
          t: item.updated || Date.now(),
          otc: item.day?.otc || false,
          // Preserve the full snapshot data for scanner
          day: item.day,
          prevDay: item.prevDay,
          todaysChange: item.todaysChange,
          todaysChangePerc: item.todaysChangePerc,
        })),
        adjusted: true,
        queryCount: rawData.count || 0,
      };
      
      console.log(`[Polygon/Massive] ✅ Snapshot converted: ${converted.results.length} stocks`);
      
      // DEBUG: Log a sample of tickers
      if (converted.results && converted.results.length > 0) {
        const sample = converted.results.slice(0, 5).map(r => r.T).join(', ');
        console.log(`[Polygon/Massive] Sample tickers: ${sample}... (total: ${converted.results.length})`);
      }
      
      return converted;
    } catch (error: any) {
      console.error('[Polygon/Massive] Full market snapshot fetch failed:', error.message);
      throw error;
    }
  }

  /**
   * Get yesterday's date in YYYY-MM-DD format
   */
  private getYesterdayDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    
    // If it's a weekend, go back to Friday
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) { // Sunday
      date.setDate(date.getDate() - 2);
    } else if (dayOfWeek === 6) { // Saturday
      date.setDate(date.getDate() - 1);
    }
    
    return date.toISOString().split('T')[0];
  }

  /**
   * Fetch aggregated bars (OHLCV data)
   */
  async getAggregates(
    symbol: string,
    timeframe: "1min" | "5min" | "15min" | "1hour" | "1day" = "1day",
    limit?: number // Will be set based on timeframe if not provided
  ): Promise<MarketData> {
    try {
      // Calculate date range - get data up to today
      // Use UTC to avoid timezone issues
      const now = new Date();
      const to = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const from = new Date(to);
      
      // Calculate appropriate limits and date ranges for each timeframe
      // We need at least 200+ bars for reliable technical analysis (indicators need history)
      // Market hours: ~6.5 hours/day = 390 minutes = 78 5-min bars = 26 15-min bars = 6.5 hourly bars
      let effectiveLimit = limit;
      
      switch (timeframe) {
        case "1min":
          // 1-min: 390 bars/day, need ~200 bars = 1 day minimum
          // Request 5 days to be safe (includes weekends/holidays in range)
          from.setUTCDate(from.getUTCDate() - 10);
          effectiveLimit = limit ?? 1000; // ~2.5 trading days worth
          break;
        case "5min":
          // 5-min: 78 bars/day, need ~200 bars = 3 days minimum  
          // Request 14 days to be safe
          from.setUTCDate(from.getUTCDate() - 30);
          effectiveLimit = limit ?? 1000; // ~12 trading days worth
          break;
        case "15min":
          // 15-min: 26 bars/day, need ~200 bars = 8 days minimum
          // Request 30 days to be safe
          from.setUTCDate(from.getUTCDate() - 60);
          effectiveLimit = limit ?? 1000; // ~38 trading days worth
          break;
        case "1hour":
          // 1-hour: 6.5 bars/day, need ~200 bars = 31 days minimum
          // Request 90 days to be safe
          from.setUTCDate(from.getUTCDate() - 180);
          effectiveLimit = limit ?? 1000; // ~154 trading days worth
          break;
        case "1day":
          // Daily: 1 bar/day, need ~200 bars = 200 trading days (~10 months)
          // Request 2 years to include full history
          from.setUTCFullYear(from.getUTCFullYear() - 2);
          effectiveLimit = limit ?? 500; // ~2 years of trading days
          break;
      }
      
      console.log(`[Polygon] Timeframe ${timeframe}: requesting ${effectiveLimit} bars from ${Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))} days`);

      const fromStr = from.toISOString().split("T")[0];
      const toStr = to.toISOString().split("T")[0];
      
      console.log(`[Polygon] Requesting data from ${fromStr} to ${toStr} for ${symbol} (current date: ${now.toISOString().split("T")[0]})`);

      // Map timeframe to Polygon format
      const timeframeMap: Record<string, string> = {
        "1min": "1/minute",
        "5min": "5/minute",
        "15min": "15/minute",
        "1hour": "1/hour",
        "1day": "1/day"
      };

      // Use sort=desc to get most recent bars first, then reverse
      // This ensures we always get the latest data even for newer stocks
      const url = `${this.baseUrl}/v2/aggs/ticker/${symbol.toUpperCase()}/range/${
        timeframeMap[timeframe]
      }/${fromStr}/${toStr}?adjusted=true&sort=desc&limit=${effectiveLimit}&apiKey=${this.apiKey}`;

      console.log(`[Polygon] Request URL: ${url.replace(this.apiKey, 'API_KEY_HIDDEN')}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.status} ${response.statusText}`);
      }

      const data: PolygonAggregatesResponse = await response.json();

      if (!data.results || data.results.length === 0) {
        throw new Error(`No data available for ${symbol}. This symbol may be delisted, invalid, or have no trading history.`);
      }
      
      console.log(`[Polygon] Received ${data.results.length} bars. Status: ${data.status} (Stocks Starter: 15-min delayed)`);
      console.log(`[Polygon] Results count: ${data.resultsCount}, Actual bars: ${data.results.length}`);

      // Get ticker details
      const details = await this.getTickerDetails(symbol);

      // Transform data and reverse since we used sort=desc
      // This gives us chronological order (oldest to newest) for indicator calculations
      const bars = data.results.map(bar => ({
        timestamp: bar.t,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v
      })).reverse(); // Reverse to get oldest to newest

      const currentPrice = bars[bars.length - 1].close;
      
      // Check data freshness - IMPORTANT for trading decisions
      const lastBarDate = new Date(bars[bars.length - 1].timestamp);
      const lastBarDay = new Date(lastBarDate);
      
      // Use UTC for date comparison to avoid timezone issues
      const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const lastBarDayUTC = new Date(Date.UTC(lastBarDay.getFullYear(), lastBarDay.getMonth(), lastBarDay.getDate()));
      const daysSinceLastBar = Math.floor((todayUTC.getTime() - lastBarDayUTC.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`[Polygon] Symbol: ${symbol}`);
      console.log(`[Polygon] Total bars received: ${bars.length}`);
      console.log(`[Polygon] Date range: ${new Date(bars[0].timestamp).toISOString().split('T')[0]} to ${lastBarDate.toISOString().split('T')[0]}`);
      console.log(`[Polygon] Last bar date: ${lastBarDate.toISOString()}`);
      console.log(`[Polygon] Data age calculation - Today (UTC): ${todayUTC.toISOString().split('T')[0]}, Last bar (UTC): ${lastBarDayUTC.toISOString().split('T')[0]}, Age: ${daysSinceLastBar} days`);
      console.log(`[Polygon] Last close price: $${currentPrice}`);
      
      // Warning if data is very stale (might be delisted)
      if (daysSinceLastBar > 7) {
        console.warn(`[Polygon] ⚠️ WARNING: Data is ${daysSinceLastBar} days old! Symbol may be delisted or suspended.`);
      } else if (daysSinceLastBar <= 3) {
        console.log(`[Polygon] ✅ Data is fresh (${daysSinceLastBar} days old)`);
      }

      return {
        symbol: symbol.toUpperCase(),
        name: details.name,
        timeframe,
        bars,
        currentPrice,
        lastBarDate: new Date(bars[bars.length - 1].timestamp),
        dataAgeDays: daysSinceLastBar,
        marketCap: details.marketCap,
        exchange: details.exchange
      };
    } catch (error) {
      console.error("Error fetching from Polygon:", error);
      throw error;
    }
  }

  /**
   * Get ticker details
   */
  async getTickerDetails(symbol: string): Promise<{
    name: string;
    marketCap?: number;
    exchange?: string;
  }> {
    try {
      // Massive.com updated the endpoint to use query parameters
      // https://massive.com/docs/rest/stocks/tickers/all-tickers
      const url = `${this.baseUrl}/v3/reference/tickers`;
      const params = new URLSearchParams({
        ticker: symbol.toUpperCase(),
        apiKey: this.apiKey,
      });
      
      const response = await fetch(`${url}?${params}`);

      if (!response.ok) {
        console.warn(`[Polygon/Massive] Could not fetch ticker details for ${symbol} (${response.status})`);
        return { name: symbol.toUpperCase() };
      }

      const data: any = await response.json();
      
      // Massive.com returns {results: [{ticker, name, market_cap, ...}]}
      if (!data.results || data.results.length === 0) {
        console.warn(`[Polygon/Massive] No ticker details found for ${symbol}`);
        return { name: symbol.toUpperCase() };
      }
      
      const tickerData = data.results[0];

      return {
        name: tickerData.name || symbol.toUpperCase(),
        marketCap: tickerData.market_cap,
        exchange: tickerData.primary_exchange
      };
    } catch (error) {
      console.error("[Polygon/Massive] Error fetching ticker details:", error);
      return { name: symbol.toUpperCase() };
    }
  }

  /**
   * Get earnings calendar (check if earnings are coming up)
   */
  async checkEarningsProximity(symbol: string): Promise<{
    hasUpcomingEarnings: boolean;
    daysUntilEarnings: number | null;
  }> {
    // Note: Polygon's earnings endpoint requires premium subscription
    // For MVP, we'll return a placeholder
    // In production, implement with proper earnings API or alternative source
    return {
      hasUpcomingEarnings: false,
      daysUntilEarnings: null
    };
  }

  /**
   * Get short interest data for a symbol
   * Uses Polygon's /v1/short-interest endpoint
   * Docs: https://polygon.io/docs/rest/stocks/fundamentals/short-interest
   */
  async getShortInterestData(symbol: string): Promise<{
    shortFloat?: number;
    daysToCover?: number;
    shortVolume?: number;
    shortVolumeRatio?: number;
    shortInterest?: number;
    avgDailyVolume?: number;
    settlementDate?: string;
  }> {
    try {
      // Fetch short interest data (bi-monthly FINRA reports)
      // https://massive.com/docs/rest/stocks/fundamentals/short-interest
      const shortInterestUrl = `${this.baseUrl}/stocks/v1/short-interest?ticker=${symbol.toUpperCase()}&limit=1&sort=settlement_date.desc&apiKey=${this.apiKey}`;
      
      console.log(`[Polygon/Massive] Fetching short interest for ${symbol}...`);
      const siResponse = await fetch(shortInterestUrl);

      if (!siResponse.ok) {
        console.warn(`[Polygon/Massive] Could not fetch short interest data for ${symbol} (${siResponse.status})`);
        return {};
      }

      const siData = await siResponse.json();
      
      if (!siData.results || siData.results.length === 0) {
        console.warn(`[Polygon] No short interest data available for ${symbol}`);
        return {};
      }

      const latestSI = siData.results[0];
      const shortInterest = latestSI.short_interest;
      const avgDailyVolume = latestSI.avg_daily_volume;
      const daysToCover = latestSI.days_to_cover;
      const settlementDate = latestSI.settlement_date;
      
      // Fetch ticker details to get shares outstanding for short float calculation
      const detailsUrl = `${this.baseUrl}/v3/reference/tickers`;
      const detailsParams = new URLSearchParams({
        ticker: symbol.toUpperCase(),
        apiKey: this.apiKey,
      });
      const detailsResponse = await fetch(`${detailsUrl}?${detailsParams}`);
      
      let shortFloat: number | undefined;
      
      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();
        // Massive.com returns results as an array
        const tickerInfo = detailsData.results?.[0];
        const sharesOutstanding = tickerInfo?.weighted_shares_outstanding || 
                                  tickerInfo?.share_class_shares_outstanding;
        
        if (sharesOutstanding && shortInterest) {
          // Calculate short float % = (short interest / shares outstanding) * 100
          shortFloat = (shortInterest / sharesOutstanding) * 100;
        }
      }
      
      // Fetch recent short volume data (daily reporting)
      // This gives us the short volume ratio for recent trading activity
      // https://massive.com/docs/rest/stocks/fundamentals/short-volume
      const shortVolumeUrl = `${this.baseUrl}/stocks/v1/short-volume?ticker=${symbol.toUpperCase()}&limit=1&sort=date.desc&apiKey=${this.apiKey}`;
      
      const svResponse = await fetch(shortVolumeUrl);
      let shortVolumeRatio: number | undefined;
      let shortVolume: number | undefined;
      
      if (svResponse.ok) {
        const svData = await svResponse.json();
        if (svData.results && svData.results.length > 0) {
          const latestSV = svData.results[0];
          shortVolumeRatio = latestSV.short_volume_ratio; // Already in percentage
          shortVolume = latestSV.short_volume;
        }
      }
      
      console.log(`[Polygon] Short interest data for ${symbol}:`, {
        shortInterest,
        shortFloat: shortFloat?.toFixed(2),
        daysToCover: daysToCover?.toFixed(2),
        shortVolumeRatio: shortVolumeRatio?.toFixed(2),
        settlementDate,
      });
      
      return {
        shortFloat,
        daysToCover,
        shortVolume,
        shortVolumeRatio: shortVolumeRatio ? shortVolumeRatio / 100 : undefined, // Convert to decimal
        shortInterest,
        avgDailyVolume,
        settlementDate,
      };
    } catch (error) {
      console.error(`[Polygon] Error fetching short interest for ${symbol}:`, error);
      return {};
    }
  }

  /**
   * Enhanced getAggregates with short interest data
   */
  async getAggregatesWithShortInterest(
    symbol: string,
    timeframe: "1min" | "5min" | "15min" | "1hour" | "1day" = "1day",
    limit: number = 500
  ): Promise<MarketData> {
    const marketData = await this.getAggregates(symbol, timeframe, limit);
    
    // Fetch short interest data in parallel
    try {
      const shortInterest = await this.getShortInterestData(symbol);
      marketData.shortInterest = shortInterest;
    } catch (error) {
      console.warn(`[Polygon] Could not fetch short interest for ${symbol}:`, error);
    }
    
    return marketData;
  }

  /**
   * Fetch comprehensive financial ratios and fundamentals
   * https://polygon.io/docs/rest/stocks/fundamentals/ratios
   */
  async getFundamentals(symbol: string): Promise<PolygonFundamentals | null> {
    try {
      const url = `${this.baseUrl}/stocks/financials/v1/ratios`;
      const params = new URLSearchParams({
        ticker: symbol,
        limit: '1',
        sort: 'date.desc', // Most recent first
        apiKey: this.apiKey,
      });

      console.log(`[Polygon] Fetching fundamentals for ${symbol}...`);
      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[Polygon] No fundamentals data for ${symbol}`);
          return null;
        }
        const errorText = await response.text();
        throw new Error(`Polygon API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        console.warn(`[Polygon] No fundamentals results for ${symbol}`);
        return null;
      }

      const result = data.results[0];
      console.log(`[Polygon] Fundamentals for ${symbol}: P/E ${result.price_to_earnings}, P/B ${result.price_to_book}`);
      
      return {
        ticker: result.ticker,
        date: result.date,
        price: result.price,
        market_cap: result.market_cap,
        earnings_per_share: result.earnings_per_share,
        price_to_earnings: result.price_to_earnings,
        price_to_book: result.price_to_book,
        price_to_sales: result.price_to_sales,
        dividend_yield: result.dividend_yield,
        return_on_equity: result.return_on_equity,
        return_on_assets: result.return_on_assets,
        debt_to_equity: result.debt_to_equity,
        current_ratio: result.current,
        quick_ratio: result.quick,
        free_cash_flow: result.free_cash_flow,
        ev_to_ebitda: result.ev_to_ebitda,
      };
    } catch (error) {
      console.error(`[Polygon] Error fetching fundamentals for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch recent news articles with sentiment analysis
   * https://polygon.io/docs/rest/stocks/news
   */
  async getNews(symbol: string, limit: number = 5): Promise<PolygonNewsArticle[]> {
    try {
      const url = `${this.baseUrl}/v2/reference/news`;
      const params = new URLSearchParams({
        ticker: symbol,
        limit: String(limit),
        sort: 'published_utc',
        order: 'desc', // Most recent first
        apiKey: this.apiKey,
      });

      console.log(`[Polygon] Fetching news for ${symbol} (limit: ${limit})...`);
      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[Polygon] No news data for ${symbol}`);
          return [];
        }
        const errorText = await response.text();
        throw new Error(`Polygon API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        console.warn(`[Polygon] No news results for ${symbol}`);
        return [];
      }

      console.log(`[Polygon] Found ${data.results.length} news articles for ${symbol}`);
      
      return data.results.map((article: any) => ({
        id: article.id,
        title: article.title,
        author: article.author,
        published_utc: article.published_utc,
        article_url: article.article_url,
        description: article.description,
        tickers: article.tickers || [],
        image_url: article.image_url,
        publisher: article.publisher,
        insights: article.insights,
      }));
    } catch (error) {
      console.error(`[Polygon] Error fetching news for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get real-time snapshot for a single ticker
   * Returns the most current price data available (15-min delayed for free tier)
   * https://polygon.io/docs/stocks/get_v2_snapshot_locale_us_markets_stocks_tickers__stocksticker
   */
  async getTickerSnapshot(symbol: string): Promise<{
    price: number;
    change: number;
    changePercent: number;
    open: number;
    high: number;
    low: number;
    volume: number;
    previousClose: number;
    timestamp: number;
    source: 'last_trade' | 'today_close' | 'prev_close' | 'error';
    isStale: boolean;
  } | null> {
    try {
      const url = `${this.baseUrl}/v2/snapshot/locale/us/markets/stocks/tickers/${symbol.toUpperCase()}`;
      const params = new URLSearchParams({
        apiKey: this.apiKey,
      });

      console.log(`[Polygon] Fetching snapshot for ${symbol}...`);
      const response = await fetch(`${url}?${params}`, {
        cache: 'no-store', // Disable caching to get fresh data
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[Polygon] Ticker ${symbol} not found`);
          return null;
        }
        const errorText = await response.text();
        console.error(`[Polygon] Snapshot error for ${symbol} (${response.status}): ${errorText}`);
        return null;
      }

      const data = await response.json();
      
      if (!data.ticker) {
        console.warn(`[Polygon] No snapshot data for ${symbol}`);
        return null;
      }

      const snapshot = data.ticker;
      
      // Helper to convert Polygon timestamp to milliseconds
      // Polygon uses nanoseconds (19 digits) for trade timestamps
      const toMs = (ts: number | undefined): number => {
        if (!ts || ts === 0) return Date.now();
        // Nanoseconds have 16-19 digits, milliseconds have 13
        if (ts > 1e15) return Math.floor(ts / 1e6); // nanoseconds to ms
        if (ts > 1e12) return ts; // already in ms
        return ts * 1000; // seconds to ms
      };

      // Debug: Log what we received from the API
      console.log(`[Polygon] ${symbol} snapshot:`, {
        hasLastTrade: !!snapshot.lastTrade?.p,
        hasMin: !!snapshot.min?.c,
        hasDay: !!snapshot.day?.c,
        hasPrevDay: !!snapshot.prevDay?.c,
        updated: snapshot.updated,
        todaysChange: snapshot.todaysChange,
      });

      // Determine market context FIRST to correctly label data sources
      const now = new Date();
      const estOptions = { timeZone: 'America/New_York' };
      const estNow = new Date(now.toLocaleString('en-US', estOptions));
      const estHour = estNow.getHours();
      const dayOfWeek = estNow.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isWeekday = !isWeekend;
      const isMarketHours = isWeekday && estHour >= 9 && estHour < 16;
      const isPreMarket = isWeekday && estHour >= 4 && estHour < 9;
      const isAfterHours = isWeekday && estHour >= 16 && estHour < 20;
      const isExtendedHours = isPreMarket || isAfterHours;
      
      console.log(`[Polygon] ${symbol}: Market context - ${isWeekend ? 'WEEKEND' : isMarketHours ? 'MARKET HOURS' : isExtendedHours ? 'EXTENDED HOURS' : 'OVERNIGHT'}`);

      // Priority: lastTrade.p > min.c > day.c > prevDay.c
      // Per Polygon docs: https://massive.com/docs/rest/stocks/snapshots/single-ticker-snapshot
      let price = 0;
      let timestamp = Date.now();
      let source: 'last_trade' | 'today_close' | 'prev_close' | 'error' = 'error';
      let dataDescription = '';
      
      // 1. Most recent trade price (includes pre/post market) - requires certain plan tiers
      if (snapshot.lastTrade?.p && snapshot.lastTrade.p > 0) {
        price = snapshot.lastTrade.p;
        timestamp = toMs(snapshot.lastTrade.t);
        // Only label as real-time if market is actually open/extended
        source = (isMarketHours || isExtendedHours) ? 'last_trade' : 'prev_close';
        dataDescription = 'Last trade';
        console.log(`[Polygon] ${symbol}: Last trade $${price.toFixed(2)} at ${new Date(timestamp).toLocaleString()}`);
      } 
      // 2. Most recent minute bar - more current than daily close
      else if (snapshot.min?.c && snapshot.min.c > 0) {
        price = snapshot.min.c;
        timestamp = toMs(snapshot.min.t || snapshot.updated);
        // Minute bar on weekend = Friday's last minute, not real-time
        source = (isMarketHours || isExtendedHours) ? 'last_trade' : 'prev_close';
        dataDescription = 'Minute bar';
        console.log(`[Polygon] ${symbol}: Minute bar $${price.toFixed(2)} at ${new Date(timestamp).toLocaleString()}`);
      }
      // 3. Today's aggregated data (OHLCV for current day)
      else if (snapshot.day?.c && snapshot.day.c > 0) {
        price = snapshot.day.c;
        timestamp = toMs(snapshot.updated);
        // On weekends, "today" is actually Friday
        source = isWeekend ? 'prev_close' : 'today_close';
        dataDescription = isWeekend ? 'Friday close' : 'Today close';
        console.log(`[Polygon] ${symbol}: Today's bar $${price.toFixed(2)}, updated: ${new Date(timestamp).toLocaleString()}`);
      } 
      // 4. Previous day's close (fallback)
      else if (snapshot.prevDay?.c && snapshot.prevDay.c > 0) {
        price = snapshot.prevDay.c;
        timestamp = toMs(snapshot.updated);
        source = 'prev_close';
        dataDescription = 'Previous close';
        console.log(`[Polygon] ${symbol}: Previous close $${price.toFixed(2)}`);
      }

      if (price === 0) {
        console.warn(`[Polygon] No valid price for ${symbol}`);
        return null;
      }

      // Determine staleness based on market context
      let isStale = false;
      
      if (isWeekend) {
        // On weekends, Friday's data is fresh (expected)
        isStale = false;
        console.log(`[Polygon] ${symbol}: Weekend - ${dataDescription} $${price.toFixed(2)} (Friday's close, fresh)`);
      } else if (source === 'last_trade') {
        // Real-time data during market/extended hours
        const dataAge = now.getTime() - timestamp;
        const minutesOld = dataAge / (1000 * 60);
        // Stale if more than 30 minutes old during market hours, or 2 hours in extended
        if (isMarketHours && minutesOld > 30) {
          isStale = true;
        } else if (isExtendedHours && minutesOld > 120) {
          isStale = true;
        }
        console.log(`[Polygon] ${symbol}: ${dataDescription} $${price.toFixed(2)} (${Math.round(minutesOld)} min old, ${isStale ? 'STALE' : 'fresh'})`);
      } else if (source === 'today_close') {
        // Today's close during weekday
        if (snapshot.todaysChange !== undefined && snapshot.todaysChange !== null) {
          isStale = false;
          console.log(`[Polygon] ${symbol}: Today's close $${price.toFixed(2)} (change: ${snapshot.todaysChangePerc?.toFixed(2) || 0}%, fresh)`);
        } else {
          const dataAge = now.getTime() - timestamp;
          isStale = dataAge > 2 * 24 * 60 * 60 * 1000;
          console.log(`[Polygon] ${symbol}: Today's close $${price.toFixed(2)} (no change data, ${isStale ? 'STALE' : 'ok'})`);
        }
      } else if (source === 'prev_close' && isWeekday) {
        // Previous close on a weekday - stale if market is open
        if (isMarketHours) {
          isStale = true;
          console.log(`[Polygon] ${symbol}: Previous close $${price.toFixed(2)} (market open, STALE - should have today's data)`);
        } else {
          console.log(`[Polygon] ${symbol}: Previous close $${price.toFixed(2)} (pre-market/overnight, ok)`);
        }
      }
      
      console.log(`[Polygon] ${symbol}: Final -> $${price.toFixed(2)} | source: ${source} | stale: ${isStale}`);
      

      return {
        price,
        change: snapshot.todaysChange || 0,
        changePercent: snapshot.todaysChangePerc || 0,
        open: snapshot.day?.o || snapshot.prevDay?.o || price,
        high: snapshot.day?.h || snapshot.prevDay?.h || price,
        low: snapshot.day?.l || snapshot.prevDay?.l || price,
        volume: snapshot.day?.v || snapshot.prevDay?.v || 0,
        previousClose: snapshot.prevDay?.c || price,
        timestamp,
        source,
        isStale,
      };
    } catch (error) {
      console.error(`[Polygon] Error fetching snapshot for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get real-time snapshots for multiple tickers using parallel individual calls
   * Polygon doesn't have a batch endpoint for specific tickers, so we make parallel calls
   */
  async getMultipleTickerSnapshots(symbols: string[]): Promise<Map<string, {
    price: number;
    change: number;
    changePercent: number;
    previousClose: number;
    timestamp: number;
    source: 'last_trade' | 'today_close' | 'prev_close';
    isStale: boolean;
  }>> {
    const results = new Map();
    
    if (symbols.length === 0) {
      return results;
    }

    console.log(`[Polygon] Fetching real-time snapshots for ${symbols.length} tickers: ${symbols.join(', ')}`);

    // Make parallel calls for each ticker
    const snapshots = await Promise.all(
      symbols.map(async (symbol) => {
        const snapshot = await this.getTickerSnapshot(symbol);
        return { symbol: symbol.toUpperCase(), snapshot };
      })
    );

    // Process results
    for (const { symbol, snapshot } of snapshots) {
      if (snapshot && snapshot.price > 0) {
        results.set(symbol, {
          price: snapshot.price,
          change: snapshot.change,
          changePercent: snapshot.changePercent,
          previousClose: snapshot.previousClose,
          timestamp: snapshot.timestamp,
          source: snapshot.source,
          isStale: snapshot.isStale,
        });
        console.log(`[Polygon] ${symbol}: $${snapshot.price.toFixed(2)} (${snapshot.source}, ${snapshot.isStale ? 'STALE' : 'fresh'})`);
      } else {
        console.warn(`[Polygon] ${symbol}: No price data available`);
      }
    }

    console.log(`[Polygon] Successfully fetched ${results.size}/${symbols.length} ticker prices`);
    return results;
  }

  /**
   * Get options chain snapshot for a stock
   * Fetches options contracts for the nearest 1-2 expirations
   * https://massive.com/docs/rest/options/overview
   */
  async getOptionsChain(symbol: string, underlyingPrice: number): Promise<OptionsChainSnapshot | null> {
    try {
      // For BASIC/PERSONAL accounts, use the options contracts reference endpoint
      // This endpoint is available to all account tiers
      // https://massive.com/docs/rest/options/contracts
      
      // Get nearest expiration dates (next 2 Fridays)
      const today = new Date();
      const expirationDates: string[] = [];
      
      for (let i = 0; i < 60; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        if (date.getDay() === 5) { // Friday
          expirationDates.push(date.toISOString().split('T')[0]);
          if (expirationDates.length === 2) break;
        }
      }
      
      console.log(`[Polygon/Massive] Fetching options contracts for ${symbol} (Basic Account Mode)...`);
      console.log(`[Polygon/Massive] Target expirations: ${expirationDates.join(', ')}`);
      
      // Use the options contracts endpoint with filters (basic account compatible)
      const url = `${this.baseUrl}/v3/reference/options/contracts`;
      const params = new URLSearchParams({
        underlying_ticker: symbol.toUpperCase(),
        expired: 'false',
        limit: '250', // Get up to 250 contracts
        apiKey: this.apiKey,
      });

      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          console.warn(`[Polygon/Massive] Options data not available for ${symbol} (${response.status}) - check account plan`);
          return null;
        }
        const errorText = await response.text();
        console.error(`[Polygon/Massive] Options API error (${response.status}): ${errorText}`);
        return null;
      }

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        console.warn(`[Polygon/Massive] No options contracts found for ${symbol}`);
        return null;
      }

      console.log(`[Polygon/Massive] Found ${data.results.length} total contracts for ${symbol}`);
      
      // Log sample contract for debugging
      if (data.results.length > 0) {
        console.log(`[Polygon/Massive] Sample contract:`, JSON.stringify(data.results[0], null, 2));
      }

      // Parse contracts from reference endpoint
      // Format: { ticker: "O:AAPL250117C00150000", contract_type: "call", expiration_date: "2025-01-17", strike_price: 150, ... }
      let allContracts: OptionsContract[] = data.results.map((contract: any) => {
        return {
          ticker: contract.ticker || '',
          strike: contract.strike_price || 0,
          expiration: contract.expiration_date || '',
          type: contract.contract_type === 'call' ? 'call' as const : 'put' as const,
          // Note: Reference endpoint doesn't include live data (volume, OI, IV)
          // We'll estimate based on strike proximity to ATM
          volume: 0, // Will be estimated below
          open_interest: 0,
          implied_volatility: undefined,
          bid: undefined,
          ask: undefined,
          last_price: undefined,
          delta: undefined,
          gamma: undefined,
          theta: undefined,
          vega: undefined,
        };
      });

      console.log(`[Polygon/Massive] Parsed ${allContracts.length} contracts`);

      // Filter to nearest 2 expirations only
      const expirationsList = [...new Set(allContracts.map(c => c.expiration))].sort();
      console.log(`[Polygon/Massive] Found ${expirationsList.length} unique expirations:`, expirationsList.slice(0, 5).join(', '), expirationsList.length > 5 ? '...' : '');
      const nearestExpirations = expirationsList.slice(0, 2);
      
      const contracts = allContracts.filter(c => nearestExpirations.includes(c.expiration));
      
      console.log(`[Polygon/Massive] Filtered to ${contracts.length} contracts across ${nearestExpirations.length} expirations`);
      console.log(`[Polygon/Massive] Expirations: ${nearestExpirations.join(', ')}`);
      
      // Check if we have enough contracts to analyze
      if (contracts.length === 0) {
        console.warn(`[Polygon/Massive] No contracts found after filtering for ${symbol}`);
        return null;
      }
      
      console.log(`[Polygon/Massive] ✅ Successfully prepared ${contracts.length} contracts for analysis`);

      return {
        underlying_ticker: symbol.toUpperCase(),
        underlying_price: underlyingPrice,
        contracts,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[Polygon/Massive] Error fetching options chain for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Analyze options sentiment and compare to swing setup
   * Provides beginner-friendly insights
   */
  analyzeOptionsInsight(
    optionsChain: OptionsChainSnapshot,
    swingSetup: {
      direction: 'bullish' | 'bearish' | 'neutral';
      rsi?: number;
      volZ?: number;
      trend?: string;
    }
  ): OptionsInsight {
    const { contracts, underlying_price, underlying_ticker } = optionsChain;

    // Filter to nearest 1-2 expirations
    const expirations = [...new Set(contracts.map(c => c.expiration))].sort();
    const nearestExpirations = expirations.slice(0, 2);
    
    const relevantContracts = contracts.filter(c => 
      nearestExpirations.includes(c.expiration)
    );

    // Find ATM strike (closest to current price)
    const atmStrike = relevantContracts.reduce((closest, contract) => {
      if (!closest) return contract.strike;
      return Math.abs(contract.strike - underlying_price) < Math.abs(closest - underlying_price)
        ? contract.strike
        : closest;
    }, 0);

    // Define "near money" range - wider for basic accounts since we need more contracts
    // Use ±10% of stock price or ±3 strikes (whichever is larger)
    const strikeSpacing = Math.max(underlying_price * 0.05, 2.5); // 5% of price or $2.50 minimum
    const nearMoneyRange = {
      min: Math.max(atmStrike - 3 * strikeSpacing, underlying_price * 0.85),
      max: Math.min(atmStrike + 3 * strikeSpacing, underlying_price * 1.15),
    };
    
    console.log(`[Polygon/Massive] Near-money range: $${nearMoneyRange.min.toFixed(2)} - $${nearMoneyRange.max.toFixed(2)} (ATM: $${atmStrike.toFixed(2)})`);

    // Group contracts into buckets
    const nearMoneyCalls = relevantContracts.filter(
      c => c.type === 'call' && c.strike >= nearMoneyRange.min && c.strike <= nearMoneyRange.max
    );
    const nearMoneyPuts = relevantContracts.filter(
      c => c.type === 'put' && c.strike >= nearMoneyRange.min && c.strike <= nearMoneyRange.max
    );

    // Check if we have volume data (enterprise) or just contract list (basic)
    const hasVolumeData = relevantContracts.some(c => c.volume && c.volume > 0);
    
    let totalCallVolume = 0;
    let totalPutVolume = 0;
    let callPutRatio = 1;
    
    if (hasVolumeData) {
      // Enterprise account with live data - use actual volume
      totalCallVolume = nearMoneyCalls.reduce((sum, c) => sum + (c.volume || 0), 0);
      totalPutVolume = nearMoneyPuts.reduce((sum, c) => sum + (c.volume || 0), 0);
      callPutRatio = totalPutVolume > 0 ? totalCallVolume / totalPutVolume : totalCallVolume > 0 ? 999 : 1;
    } else {
      // Basic account without live data - use contract count as proxy
      totalCallVolume = nearMoneyCalls.length;
      totalPutVolume = nearMoneyPuts.length;
      callPutRatio = totalPutVolume > 0 ? totalCallVolume / totalPutVolume : totalCallVolume > 0 ? 999 : 1;
      console.log(`[Polygon/Massive] Using contract count as proxy (Basic account): ${totalCallVolume} calls, ${totalPutVolume} puts`);
    }

    // Top strikes (by volume if available, otherwise by strike proximity to ATM)
    const topCallStrikes = nearMoneyCalls
      .sort((a, b) => {
        if (hasVolumeData) {
          return (b.volume || 0) - (a.volume || 0); // Sort by volume
        } else {
          // Sort by proximity to ATM
          return Math.abs(a.strike - atmStrike) - Math.abs(b.strike - atmStrike);
        }
      })
      .slice(0, 3)
      .map(c => ({ strike: c.strike, volume: c.volume || 0, oi: c.open_interest || 0 }));
    
    const topPutStrikes = nearMoneyPuts
      .sort((a, b) => {
        if (hasVolumeData) {
          return (b.volume || 0) - (a.volume || 0); // Sort by volume
        } else {
          // Sort by proximity to ATM
          return Math.abs(a.strike - atmStrike) - Math.abs(b.strike - atmStrike);
        }
      })
      .slice(0, 3)
      .map(c => ({ strike: c.strike, volume: c.volume || 0, oi: c.open_interest || 0 }));

    // IV trend (only if we have IV data from enterprise account)
    let ivTrend: 'rising' | 'flat' | 'falling' = 'flat';
    if (hasVolumeData && nearestExpirations.length >= 2) {
      const nearIV = contracts
        .filter(c => c.expiration === nearestExpirations[0] && Math.abs(c.strike - atmStrike) < strikeSpacing && c.implied_volatility)
        .reduce((sum, c, _, arr) => sum + (c.implied_volatility || 0) / arr.length, 0);
      
      const farIV = contracts
        .filter(c => c.expiration === nearestExpirations[1] && Math.abs(c.strike - atmStrike) < strikeSpacing && c.implied_volatility)
        .reduce((sum, c, _, arr) => sum + (c.implied_volatility || 0) / arr.length, 0);
      
      if (nearIV > 0 && farIV > 0) {
        if (nearIV > farIV * 1.1) ivTrend = 'rising';
        else if (nearIV < farIV * 0.9) ivTrend = 'falling';
      }
    }

    // Determine sentiment based on call/put ratio and swing setup
    let sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed' = 'neutral';
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    let message = '';

    const topCallStrike = topCallStrikes[0]?.strike || atmStrike;
    const topPutStrike = topPutStrikes[0]?.strike || atmStrike;
    
    // Data type indicator for messages
    const dataType = hasVolumeData ? 'volume' : 'available contracts';
    const activityThreshold = hasVolumeData ? 100 : 5; // Lower threshold for contract count (5 contracts = enough for basic analysis)
    
    console.log(`[Polygon/Massive] Activity check: ${totalCallVolume + totalPutVolume} ${dataType} (threshold: ${activityThreshold})`);

    if (totalCallVolume + totalPutVolume < activityThreshold) {
      // Low activity - not enough data
      sentiment = 'neutral';
      confidence = 'low';
      message = hasVolumeData 
        ? `Options activity is light today (${totalCallVolume + totalPutVolume} contracts near $${atmStrike.toFixed(2)}). Not enough data to confirm the swing setup.`
        : `Limited options data available (${totalCallVolume} call contracts, ${totalPutVolume} put contracts near $${atmStrike.toFixed(2)}). Based on available strikes, sentiment is neutral.`;
    } else if (callPutRatio > 2.0 && swingSetup.direction === 'bullish') {
      // High call/put ratio + bullish setup = strong confirmation
      sentiment = 'bullish';
      confidence = hasVolumeData ? 'high' : 'medium'; // Lower confidence for basic data
      message = hasVolumeData
        ? `✅ Options traders are bullish! Most activity was on upside calls around $${topCallStrike.toFixed(2)} (${totalCallVolume} calls vs ${totalPutVolume} puts). This supports your bullish swing idea.`
        : `✅ More call contracts available than puts near ATM (${totalCallVolume} calls vs ${totalPutVolume} puts around $${topCallStrike.toFixed(2)}), suggesting bullish positioning. This aligns with the swing setup.`;
    } else if (callPutRatio > 1.5 && swingSetup.direction === 'bullish') {
      // Moderate call bias + bullish setup
      sentiment = 'bullish';
      confidence = 'medium';
      message = hasVolumeData
        ? `Options traders were moderately bullish today, buying calls around $${topCallStrike.toFixed(2)}. This aligns with the bullish chart setup.`
        : `Moderately more call contracts than puts available near ATM ($${topCallStrike.toFixed(2)}), consistent with bullish positioning.`;
    } else if (callPutRatio < 0.5 && swingSetup.direction === 'bearish') {
      // High put activity + bearish setup = confirmation
      sentiment = 'bearish';
      confidence = hasVolumeData ? 'high' : 'medium';
      message = hasVolumeData
        ? `✅ Options traders are bearish! Heavy put buying around $${topPutStrike.toFixed(2)} (${totalPutVolume} puts vs ${totalCallVolume} calls) confirms the bearish swing setup.`
        : `✅ More put contracts available than calls near ATM (${totalPutVolume} puts vs ${totalCallVolume} calls around $${topPutStrike.toFixed(2)}), suggesting bearish positioning.`;
    } else if (callPutRatio < 0.7 && swingSetup.direction === 'bearish') {
      // Moderate put bias + bearish setup
      sentiment = 'bearish';
      confidence = 'medium';
      message = hasVolumeData
        ? `Options traders were moderately bearish, with more puts than calls around $${topPutStrike.toFixed(2)}. This supports the bearish chart pattern.`
        : `Moderately more put contracts than calls available near ATM, consistent with bearish positioning.`;
    } else if (callPutRatio > 2.0 && swingSetup.direction === 'bearish') {
      // Divergence: calls dominate but chart is bearish
      sentiment = 'mixed';
      confidence = 'low';
      message = `⚠️ Mixed signals: More ${hasVolumeData ? 'call buying' : 'call contracts'} around $${topCallStrike.toFixed(2)}, but the chart shows a bearish setup. This divergence suggests caution.`;
    } else if (callPutRatio < 0.5 && swingSetup.direction === 'bullish') {
      // Divergence: puts dominate but chart is bullish
      sentiment = 'mixed';
      confidence = 'low';
      message = `⚠️ Mixed signals: More ${hasVolumeData ? 'put buying' : 'put contracts'} around $${topPutStrike.toFixed(2)}, but the chart shows a bullish setup. Traders may be hedging.`;
    } else {
      // Balanced or unclear
      sentiment = 'neutral';
      confidence = 'medium';
      message = hasVolumeData
        ? `Options activity is balanced (${totalCallVolume} calls, ${totalPutVolume} puts near $${atmStrike.toFixed(2)}). No strong directional bias from options to confirm or contradict the swing setup.`
        : `Available options contracts are balanced (${totalCallVolume} calls, ${totalPutVolume} puts near $${atmStrike.toFixed(2)}). No clear directional bias.`;
    }

    // Add IV context (only if available)
    if (hasVolumeData && ivTrend === 'rising') {
      message += ` Implied volatility is rising, suggesting increased uncertainty or event risk.`;
    } else if (ivTrend === 'falling') {
      message += ` Implied volatility is falling, indicating calmer markets ahead.`;
    }

    return {
      sentiment,
      confidence,
      message,
      callPutRatio,
      totalCallVolume,
      totalPutVolume,
      ivTrend,
      atmStrike,
      topCallStrikes,
      topPutStrikes,
      expirations: nearestExpirations,
      rawData: optionsChain,
    };
  }
}

