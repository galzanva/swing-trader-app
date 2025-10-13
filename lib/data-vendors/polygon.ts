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
}

export class PolygonClient {
  private apiKey: string;
  private baseUrl = "https://api.polygon.io";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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
      const to = new Date();
      const from = new Date();
      
      // Adjust date range based on timeframe
      switch (timeframe) {
        case "1min":
          from.setDate(from.getDate() - 7);
          break;
        case "5min":
          from.setDate(from.getDate() - 21);
          break;
        case "15min":
          from.setDate(from.getDate() - 60);
          break;
        case "1hour":
          from.setDate(from.getDate() - 120);
          break;
        case "1day":
          from.setFullYear(from.getFullYear() - 2); // 2 years of daily data
          break;
      }

      const fromStr = from.toISOString().split("T")[0];
      const toStr = to.toISOString().split("T")[0];
      
      console.log(`[Polygon] Requesting data from ${fromStr} to ${toStr} for ${symbol}`);

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

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.status} ${response.statusText}`);
      }

      const data: PolygonAggregatesResponse = await response.json();

      if (!data.results || data.results.length === 0) {
        throw new Error(`No data available for ${symbol}. This symbol may be delisted, invalid, or have no trading history.`);
      }
      
      console.log(`[Polygon] Received ${data.results.length} bars. Status: ${data.status}`);

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
      const daysSinceLastBar = Math.floor((Date.now() - lastBarDate.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`[Polygon] Symbol: ${symbol}`);
      console.log(`[Polygon] Total bars received: ${bars.length}`);
      console.log(`[Polygon] Date range: ${new Date(bars[0].timestamp).toISOString().split('T')[0]} to ${lastBarDate.toISOString().split('T')[0]}`);
      console.log(`[Polygon] Last bar date: ${lastBarDate.toISOString()}`);
      console.log(`[Polygon] Days since last bar: ${daysSinceLastBar}`);
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
}

