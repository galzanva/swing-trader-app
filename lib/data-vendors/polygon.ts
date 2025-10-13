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
    limit: number = 300
  ): Promise<MarketData> {
    try {
      // Calculate date range (get last N bars)
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
          from.setFullYear(from.getFullYear() - 2);
          break;
      }

      const fromStr = from.toISOString().split("T")[0];
      const toStr = to.toISOString().split("T")[0];

      // Map timeframe to Polygon format
      const timeframeMap: Record<string, string> = {
        "1min": "1/minute",
        "5min": "5/minute",
        "15min": "15/minute",
        "1hour": "1/hour",
        "1day": "1/day"
      };

      const url = `${this.baseUrl}/v2/aggs/ticker/${symbol.toUpperCase()}/range/${
        timeframeMap[timeframe]
      }/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=${limit}&apiKey=${this.apiKey}`;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.status} ${response.statusText}`);
      }

      const data: PolygonAggregatesResponse = await response.json();

      if (!data.results || data.results.length === 0) {
        throw new Error(`No data available for ${symbol}`);
      }

      // Get ticker details
      const details = await this.getTickerDetails(symbol);

      // Transform data
      const bars = data.results.map(bar => ({
        timestamp: bar.t,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v
      }));

      const currentPrice = bars[bars.length - 1].close;

      return {
        symbol: symbol.toUpperCase(),
        name: details.name,
        timeframe,
        bars,
        currentPrice,
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

