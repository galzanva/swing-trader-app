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

export class PolygonClient {
  private apiKey: string;
  private baseUrl = "https://api.polygon.io";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetch all stocks for a given date (grouped daily endpoint)
   * This returns ALL U.S. stocks in a single API call - perfect for pre-filtering!
   */
  async getGroupedDaily(date?: string): Promise<GroupedDailyResponse> {
    try {
      // Use yesterday or provided date
      const targetDate = date || this.getYesterdayDate();
      
      const url = `${this.baseUrl}/v2/aggs/grouped/locale/us/market/stocks/${targetDate}`;
      const params = new URLSearchParams({
        adjusted: 'true',
        include_otc: 'false', // Exclude OTC by default
        apiKey: this.apiKey,
      });

      console.log(`[Polygon] Fetching grouped daily for ${targetDate}...`);
      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Polygon API error (${response.status}): ${errorText}`);
      }

      const data: GroupedDailyResponse = await response.json();
      console.log(`[Polygon] Grouped daily returned ${data.resultsCount || 0} stocks`);
      
      return data;
    } catch (error: any) {
      console.error('[Polygon] Grouped daily fetch failed:', error.message);
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
    limit: number = 500 // Increased for daily data
  ): Promise<MarketData> {
    try {
      // Calculate date range - get data up to today
      // Use UTC to avoid timezone issues
      const now = new Date();
      const to = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const from = new Date(to);
      
      // Adjust date range based on timeframe
      switch (timeframe) {
        case "1min":
          from.setUTCDate(from.getUTCDate() - 7);
          break;
        case "5min":
          from.setUTCDate(from.getUTCDate() - 21);
          break;
        case "15min":
          from.setUTCDate(from.getUTCDate() - 60);
          break;
        case "1hour":
          from.setUTCDate(from.getUTCDate() - 120);
          break;
        case "1day":
          from.setUTCFullYear(from.getUTCFullYear() - 2); // 2 years of daily data
          break;
      }

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
      }/${fromStr}/${toStr}?adjusted=true&sort=desc&limit=${limit}&apiKey=${this.apiKey}`;

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
      const url = `${this.baseUrl}/v3/reference/tickers/${symbol.toUpperCase()}?apiKey=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        return { name: symbol.toUpperCase() };
      }

      const data: PolygonTickerDetails = await response.json();

      return {
        name: data.results.name || symbol.toUpperCase(),
        marketCap: data.results.market_cap,
        exchange: data.results.primary_exchange
      };
    } catch (error) {
      console.error("Error fetching ticker details:", error);
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
      const shortInterestUrl = `${this.baseUrl}/stocks/v1/short-interest?ticker=${symbol.toUpperCase()}&limit=1&sort=settlement_date.desc&apiKey=${this.apiKey}`;
      
      console.log(`[Polygon] Fetching short interest for ${symbol}...`);
      const siResponse = await fetch(shortInterestUrl);

      if (!siResponse.ok) {
        console.warn(`[Polygon] Could not fetch short interest data for ${symbol} (${siResponse.status})`);
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
      const detailsUrl = `${this.baseUrl}/v3/reference/tickers/${symbol.toUpperCase()}?apiKey=${this.apiKey}`;
      const detailsResponse = await fetch(detailsUrl);
      
      let shortFloat: number | undefined;
      
      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();
        const sharesOutstanding = detailsData.results?.weighted_shares_outstanding || 
                                  detailsData.results?.share_class_shares_outstanding;
        
        if (sharesOutstanding && shortInterest) {
          // Calculate short float % = (short interest / shares outstanding) * 100
          shortFloat = (shortInterest / sharesOutstanding) * 100;
        }
      }
      
      // Fetch recent short volume data (daily reporting)
      // This gives us the short volume ratio for recent trading activity
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
}

