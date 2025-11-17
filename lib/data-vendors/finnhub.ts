/**
 * Finnhub API Client - Comprehensive fundamental data for swing trading
 * Docs: https://finnhub.io/docs/api/introduction
 */

export interface FinnhubMetrics {
  // Profitability & Efficiency
  roeTTM?: number; // Return on Equity
  roaTTM?: number; // Return on Assets
  grossMarginTTM?: number; // Gross Margin %
  operatingMarginTTM?: number; // Operating Margin %
  fcfMarginTTM?: number; // Free Cash Flow Margin %
  netMarginTTM?: number; // Net Profit Margin %
  
  // Valuation
  peBasicExclExtraTTM?: number; // P/E Ratio
  peNormalizedAnnual?: number; // Forward P/E
  pbAnnual?: number; // Price to Book
  psAnnual?: number; // Price to Sales
  
  // Growth
  revenueGrowthTTMYoy?: number; // Revenue Growth YoY %
  epsGrowthTTMYoy?: number; // EPS Growth YoY %
  revenueGrowth3Y?: number; // 3-Year Revenue CAGR
  epsGrowth3Y?: number; // 3-Year EPS CAGR
  
  // Leverage & Stability
  'totalDebt/ebitdaTTM'?: number; // Debt to EBITDA
  currentRatioAnnual?: number; // Current Ratio
  quickRatioAnnual?: number; // Quick Ratio
  interestCoverageAnnual?: number; // Interest Coverage
  cashRatioAnnual?: number; // Cash Ratio
  
  // Dividends
  dividendYieldIndicatedAnnual?: number; // Dividend Yield %
  payoutRatioAnnual?: number; // Payout Ratio %
  
  // Market Data
  marketCapitalization?: number; // Market Cap
  enterpriseValueTTM?: number; // Enterprise Value
  beta?: number; // Beta
}

export interface FinnhubInsiderSentiment {
  symbol: string;
  year: number;
  month: number;
  change: number; // Net insider share change
  mspr: number; // Monthly share purchase ratio
}

export interface FinnhubRecommendation {
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  period: string; // YYYY-MM-DD
}

export interface FinnhubEarningsCalendar {
  date: string;
  epsActual?: number;
  epsEstimate?: number;
  hour?: string; // 'bmo' | 'amc'
  quarter: number;
  revenueActual?: number;
  revenueEstimate?: number;
  symbol: string;
  year: number;
}

export interface FinnhubComprehensiveFundamentals {
  // Processed scores
  qualityScore: number; // 0-100
  viabilityScore: number; // 0-100
  riskScore: number; // 0-100 (higher = more risk)
  
  // Quality factors
  quality: {
    grade: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
    roe: number | null;
    roa: number | null;
    grossMargin: number | null;
    operatingMargin: number | null;
    fcfMargin: number | null;
    summary: string;
  };
  
  // Viability factors
  viability: {
    valuation: 'undervalued' | 'fairly valued' | 'overvalued' | 'unknown';
    pe: number | null;
    forwardPe: number | null;
    pb: number | null;
    revenueGrowth: number | null;
    epsGrowth: number | null;
    analystRating: 'strong buy' | 'buy' | 'hold' | 'sell' | 'strong sell' | 'unknown';
    summary: string;
  };
  
  // Risk factors
  risk: {
    level: 'low' | 'moderate' | 'high' | 'extreme';
    debtToEbitda: number | null;
    currentRatio: number | null;
    interestCoverage: number | null;
    beta: number | null;
    daysToEarnings: number | null;
    earningsRisk: boolean;
    insiderSentiment: 'bullish' | 'bearish' | 'neutral';
    summary: string;
  };
  
  // Raw metrics for reference
  rawMetrics: FinnhubMetrics;
  // Company profile for industry context
  profile?: {
    name?: string;
    ticker?: string;
    exchange?: string;
    industry?: string;
    sector?: string;
    ipo?: string;
    country?: string;
    currency?: string;
    marketCap?: number;
  };
}

export class FinnhubClient {
  private apiKey: string;
  private baseUrl = 'https://finnhub.io/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetch basic financial metrics
   */
  async getBasicFinancials(symbol: string): Promise<FinnhubMetrics | null> {
    try {
      const url = `${this.baseUrl}/stock/metric?symbol=${symbol}&metric=all&token=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`[Finnhub] Error fetching metrics for ${symbol}: ${response.statusText}`);
        return null;
      }
      
      const data = await response.json();
      return data.metric || null;
    } catch (error) {
      console.error(`[Finnhub] Exception fetching metrics for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch insider transactions (last 90 days)
   */
  async getInsiderSentiment(symbol: string): Promise<FinnhubInsiderSentiment[]> {
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 90);
      const from = fromDate.toISOString().split('T')[0];
      const to = new Date().toISOString().split('T')[0];
      
      const url = `${this.baseUrl}/stock/insider-sentiment?symbol=${symbol}&from=${from}&to=${to}&token=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`[Finnhub] Error fetching insider sentiment for ${symbol}: ${response.statusText}`);
        return [];
      }
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error(`[Finnhub] Exception fetching insider sentiment for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Fetch analyst recommendations
   */
  async getRecommendations(symbol: string): Promise<FinnhubRecommendation[]> {
    try {
      const url = `${this.baseUrl}/stock/recommendation?symbol=${symbol}&token=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`[Finnhub] Error fetching recommendations for ${symbol}: ${response.statusText}`);
        return [];
      }
      
      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error(`[Finnhub] Exception fetching recommendations for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Fetch earnings calendar
   */
  async getEarningsCalendar(symbol: string): Promise<FinnhubEarningsCalendar | null> {
    try {
      const fromDate = new Date();
      const toDate = new Date();
      toDate.setDate(toDate.getDate() + 90); // Next 90 days
      
      const from = fromDate.toISOString().split('T')[0];
      const to = toDate.toISOString().split('T')[0];
      
      const url = `${this.baseUrl}/calendar/earnings?from=${from}&to=${to}&symbol=${symbol}&token=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`[Finnhub] Error fetching earnings calendar for ${symbol}: ${response.statusText}`);
        return null;
      }
      
      const data = await response.json();
      
      // Find next earnings for this symbol
      if (data.earningsCalendar && data.earningsCalendar.length > 0) {
        return data.earningsCalendar[0];
      }
      
      return null;
    } catch (error) {
      console.error(`[Finnhub] Exception fetching earnings calendar for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch company profile (industry, sector, market cap)
   */
  async getCompanyProfile(symbol: string): Promise<{ industry?: string; sector?: string; name?: string; ticker?: string; exchange?: string; ipo?: string; country?: string; currency?: string; marketCap?: number } | null> {
    try {
      const url = `${this.baseUrl}/stock/profile2?symbol=${symbol}&token=${this.apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[Finnhub] Error fetching profile for ${symbol}: ${response.statusText}`);
        return null;
      }
      const data = await response.json();
      if (!data) return null;
      // Map finnhub fields to our profile shape
      return {
        name: data.name,
        ticker: data.ticker,
        exchange: data.exchange,
        ipo: data.ipo,
        country: data.country,
        currency: data.currency,
        // Finnhub uses 'finnhubIndustry' for industry; no sector provided
        industry: data.finnhubIndustry,
        sector: data.sector || undefined,
        marketCap: typeof data.marketCapitalization === 'number' ? data.marketCapitalization : undefined
      };
    } catch (error) {
      console.error(`[Finnhub] Exception fetching profile for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get comprehensive fundamental analysis
   * This is the main method that combines all data sources
   */
  async getComprehensiveFundamentals(symbol: string, currentPrice: number): Promise<FinnhubComprehensiveFundamentals> {
    console.log(`[Finnhub] Fetching comprehensive fundamentals for ${symbol}...`);
    
    // Fetch all data in parallel
    const [metrics, insiderData, recommendations, earningsCalendar, profile] = await Promise.all([
      this.getBasicFinancials(symbol),
      this.getInsiderSentiment(symbol),
      this.getRecommendations(symbol),
      this.getEarningsCalendar(symbol),
      this.getCompanyProfile(symbol)
    ]);

    if (!metrics) {
      console.log(`[Finnhub] No metrics available for ${symbol}`);
      return this.getDefaultFundamentals();
    }

    console.log(`[Finnhub] Processing fundamentals for ${symbol}...`);
    
    // Calculate Quality Score (0-100)
    const qualityScore = this.calculateQualityScore(metrics, insiderData);
    
    // Calculate Viability Score (0-100)
    const viabilityScore = this.calculateViabilityScore(metrics, recommendations);
    
    // Calculate Risk Score (0-100, higher = more risk)
    const riskScore = this.calculateRiskScore(metrics, earningsCalendar);
    
    // Build detailed quality assessment
    const quality = this.buildQualityAssessment(metrics, insiderData);
    
    // Build viability assessment
    const viability = this.buildViabilityAssessment(metrics, recommendations, currentPrice);
    
    // Build risk assessment
    const risk = this.buildRiskAssessment(metrics, earningsCalendar, insiderData);
    
    console.log(`[Finnhub] Scores - Quality: ${qualityScore}, Viability: ${viabilityScore}, Risk: ${riskScore}`);
    
    return {
      qualityScore,
      viabilityScore,
      riskScore,
      quality,
      viability,
      risk,
      rawMetrics: metrics,
      profile: profile || undefined
    };
  }

  /**
   * Calculate Quality Score based on profitability, margins, and ownership
   */
  private calculateQualityScore(metrics: FinnhubMetrics, insiderData: FinnhubInsiderSentiment[]): number {
    let score = 0;
    let factors = 0;
    
    // ROE (25 points max)
    if (metrics.roeTTM !== undefined && metrics.roeTTM !== null) {
      factors++;
      if (metrics.roeTTM > 20) score += 25;
      else if (metrics.roeTTM > 15) score += 20;
      else if (metrics.roeTTM > 10) score += 15;
      else if (metrics.roeTTM > 5) score += 10;
      else if (metrics.roeTTM > 0) score += 5;
    }
    
    // Operating Margin (25 points max)
    // Note: Finnhub returns margins as percentages already (e.g., 29.51 = 29.51%, not 0.2951)
    if (metrics.operatingMarginTTM !== undefined && metrics.operatingMarginTTM !== null) {
      factors++;
      const margin = metrics.operatingMarginTTM;
      if (margin > 20) score += 25;
      else if (margin > 15) score += 20;
      else if (margin > 10) score += 15;
      else if (margin > 5) score += 10;
      else if (margin > 0) score += 5;
    }
    
    // FCF Margin (25 points max)
    // Note: Finnhub returns margins as percentages already
    if (metrics.fcfMarginTTM !== undefined && metrics.fcfMarginTTM !== null) {
      factors++;
      const fcfMargin = metrics.fcfMarginTTM;
      if (fcfMargin > 15) score += 25;
      else if (fcfMargin > 10) score += 20;
      else if (fcfMargin > 5) score += 15;
      else if (fcfMargin > 0) score += 10;
    }
    
    // Insider Sentiment (25 points max)
    if (insiderData.length > 0) {
      factors++;
      const netChange = insiderData.reduce((sum, d) => sum + d.change, 0);
      if (netChange > 100000) score += 25; // Strong buying
      else if (netChange > 50000) score += 20;
      else if (netChange > 0) score += 15;
      else if (netChange > -50000) score += 10; // Mild selling
      else score += 5; // Heavy selling
    }
    
    // Score is already 0-100, don't divide by factors
    // (Each factor adds up to 25 points, 4 factors = 100 max)
    return factors > 0 ? Math.round(score) : 0;
  }

  /**
   * Calculate Viability Score based on valuation, growth, and analyst sentiment
   */
  private calculateViabilityScore(metrics: FinnhubMetrics, recommendations: FinnhubRecommendation[]): number {
    let score = 0;
    let factors = 0;
    
    // P/E Valuation (33 points max)
    if (metrics.peBasicExclExtraTTM !== undefined && metrics.peBasicExclExtraTTM !== null) {
      factors++;
      const pe = metrics.peBasicExclExtraTTM;
      if (pe > 0 && pe < 15) score += 33; // Undervalued
      else if (pe < 25) score += 25; // Fairly valued
      else if (pe < 35) score += 15; // Somewhat expensive
      else score += 5; // Overvalued
    }
    
    // Growth (33 points max)
    // Note: Finnhub returns growth as percentage already
    if (metrics.revenueGrowthTTMYoy !== undefined && metrics.revenueGrowthTTMYoy !== null) {
      factors++;
      const growth = metrics.revenueGrowthTTMYoy;
      if (growth > 20) score += 33;
      else if (growth > 10) score += 25;
      else if (growth > 5) score += 15;
      else if (growth > 0) score += 10;
      else score += 5;
    }
    
    // Analyst Rating (34 points max)
    if (recommendations.length > 0) {
      factors++;
      const latest = recommendations[0];
      const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
      
      if (total > 0) {
        const buyRatio = (latest.strongBuy * 2 + latest.buy) / (total * 2);
        if (buyRatio > 0.7) score += 34; // Strong consensus buy
        else if (buyRatio > 0.5) score += 25; // Buy
        else if (buyRatio > 0.3) score += 15; // Hold
        else score += 5; // Sell
      }
    }
    
    // Score is already 0-100, don't divide by factors
    return factors > 0 ? Math.round(score) : 0;
  }

  /**
   * Calculate Risk Score (higher = more risk)
   */
  private calculateRiskScore(metrics: FinnhubMetrics, earningsCalendar: FinnhubEarningsCalendar | null): number {
    let risk = 0;
    
    // Leverage risk (0-30 points)
    if (metrics['totalDebt/ebitdaTTM'] !== undefined && metrics['totalDebt/ebitdaTTM'] !== null) {
      const debtRatio = metrics['totalDebt/ebitdaTTM'];
      if (debtRatio > 5) risk += 30; // Extreme leverage
      else if (debtRatio > 3) risk += 20; // High leverage
      else if (debtRatio > 2) risk += 10; // Moderate
      else risk += 0; // Low risk
    }
    
    // Liquidity risk (0-25 points)
    if (metrics.currentRatioAnnual !== undefined && metrics.currentRatioAnnual !== null) {
      const currentRatio = metrics.currentRatioAnnual;
      if (currentRatio < 1.0) risk += 25; // Liquidity crisis
      else if (currentRatio < 1.5) risk += 15; // Tight
      else if (currentRatio < 2.0) risk += 5; // Adequate
      else risk += 0; // Strong
    }
    
    // Volatility risk (0-20 points)
    if (metrics.beta !== undefined && metrics.beta !== null) {
      const beta = metrics.beta;
      if (beta > 2.0) risk += 20; // Very volatile
      else if (beta > 1.5) risk += 15;
      else if (beta > 1.0) risk += 10;
      else risk += 5; // Stable
    }
    
    // Earnings proximity risk (0-25 points)
    if (earningsCalendar) {
      const earningsDate = new Date(earningsCalendar.date);
      const today = new Date();
      const daysToEarnings = Math.floor((earningsDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysToEarnings >= 0 && daysToEarnings <= 10) {
        risk += 25; // High event risk
      } else if (daysToEarnings <= 20) {
        risk += 15; // Moderate event risk
      }
    }
    
    return Math.min(100, risk);
  }

  /**
   * Build quality assessment object
   */
  private buildQualityAssessment(metrics: FinnhubMetrics, insiderData: FinnhubInsiderSentiment[]) {
    // Note: Finnhub returns margins as percentages already (e.g., 29.51 = 29.51%)
    const roe = metrics.roeTTM || null;
    const roa = metrics.roaTTM || null;
    const grossMargin = metrics.grossMarginTTM || null;
    const operatingMargin = metrics.operatingMarginTTM || null;
    const fcfMargin = metrics.fcfMarginTTM || null;
    
    // Determine grade
    let grade: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' = 'unknown';
    if (roe !== null && operatingMargin !== null) {
      if (roe > 20 && operatingMargin > 20) grade = 'excellent';
      else if (roe > 15 && operatingMargin > 15) grade = 'good';
      else if (roe > 10 && operatingMargin > 10) grade = 'fair';
      else grade = 'poor';
    }
    
    // Build summary
    let summary = `${grade.charAt(0).toUpperCase() + grade.slice(1)} quality`;
    if (roe !== null) summary += ` with ROE ${roe.toFixed(1)}%`;
    if (operatingMargin !== null) summary += `, operating margin ${operatingMargin.toFixed(1)}%`;
    
    // Add insider sentiment
    if (insiderData.length > 0) {
      const netChange = insiderData.reduce((sum, d) => sum + d.change, 0);
      if (netChange > 0) summary += '. Insiders buying.';
      else if (netChange < 0) summary += '. Insiders selling.';
    }
    
    return { grade, roe, roa, grossMargin, operatingMargin, fcfMargin, summary };
  }

  /**
   * Build viability assessment object
   */
  private buildViabilityAssessment(metrics: FinnhubMetrics, recommendations: FinnhubRecommendation[], currentPrice: number) {
    const pe = metrics.peBasicExclExtraTTM || null;
    const forwardPe = metrics.peNormalizedAnnual || null;
    const pb = metrics.pbAnnual || null;
    // Note: Finnhub returns growth rates as percentages already (e.g., 12.5 = 12.5%)
    const revenueGrowth = metrics.revenueGrowthTTMYoy || null;
    const epsGrowth = metrics.epsGrowthTTMYoy || null;
    
    // Determine valuation
    let valuation: 'undervalued' | 'fairly valued' | 'overvalued' | 'unknown' = 'unknown';
    if (pe !== null) {
      if (pe > 0 && pe < 15) valuation = 'undervalued';
      else if (pe < 25) valuation = 'fairly valued';
      else valuation = 'overvalued';
    }
    
    // Determine analyst rating
    let analystRating: 'strong buy' | 'buy' | 'hold' | 'sell' | 'strong sell' | 'unknown' = 'unknown';
    if (recommendations.length > 0) {
      const latest = recommendations[0];
      const strongBuyPct = latest.strongBuy / (latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell);
      const buyPct = latest.buy / (latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell);
      
      if (strongBuyPct > 0.5) analystRating = 'strong buy';
      else if (buyPct + strongBuyPct > 0.5) analystRating = 'buy';
      else if (latest.hold > latest.buy + latest.sell) analystRating = 'hold';
      else if (latest.sell > latest.buy) analystRating = 'sell';
      else analystRating = 'strong sell';
    }
    
    // Build summary
    let summary = `${valuation.charAt(0).toUpperCase() + valuation.slice(1)} valuation`;
    if (pe !== null) summary += ` (P/E ${pe.toFixed(1)})`;
    if (revenueGrowth !== null) summary += `, ${revenueGrowth > 0 ? '+' : ''}${revenueGrowth.toFixed(1)}% revenue growth`;
    if (analystRating !== 'unknown') summary += `. Analysts: ${analystRating}.`;
    
    return { valuation, pe, forwardPe, pb, revenueGrowth, epsGrowth, analystRating, summary };
  }

  /**
   * Build risk assessment object
   */
  private buildRiskAssessment(metrics: FinnhubMetrics, earningsCalendar: FinnhubEarningsCalendar | null, insiderData: FinnhubInsiderSentiment[]) {
    const debtToEbitda = metrics['totalDebt/ebitdaTTM'] || null;
    const currentRatio = metrics.currentRatioAnnual || null;
    const interestCoverage = metrics.interestCoverageAnnual || null;
    const beta = metrics.beta || null;
    
    // Calculate days to earnings (use UTC dates to avoid timezone issues)
    let daysToEarnings: number | null = null;
    let earningsRisk = false;
    if (earningsCalendar) {
      // Parse both dates at UTC midnight to avoid timezone shifts
      const earningsDate = new Date(earningsCalendar.date + 'T00:00:00.000Z');
      const today = new Date();
      // Normalize today to UTC midnight for accurate day count
      const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      daysToEarnings = Math.floor((earningsDate.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24));
      earningsRisk = Math.abs(daysToEarnings) <= 10; // Within 10 days before or after
    }
    
    // Determine insider sentiment
    let insiderSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (insiderData.length > 0) {
      const netChange = insiderData.reduce((sum, d) => sum + d.change, 0);
      if (netChange > 50000) insiderSentiment = 'bullish';
      else if (netChange < -50000) insiderSentiment = 'bearish';
    }
    
    // Determine risk level
    let level: 'low' | 'moderate' | 'high' | 'extreme' = 'moderate';
    let riskFactors = 0;
    
    if (debtToEbitda !== null && debtToEbitda > 3) riskFactors++;
    if (currentRatio !== null && currentRatio < 1.5) riskFactors++;
    if (earningsRisk) riskFactors++;
    if (beta !== null && beta > 1.5) riskFactors++;
    if (insiderSentiment === 'bearish') riskFactors++;
    
    if (riskFactors >= 4) level = 'extreme';
    else if (riskFactors >= 3) level = 'high';
    else if (riskFactors >= 2) level = 'moderate';
    else level = 'low';
    
    // Build summary
    let summary = `${level.charAt(0).toUpperCase() + level.slice(1)} risk`;
    if (debtToEbitda !== null) summary += ` (Debt/EBITDA: ${debtToEbitda.toFixed(1)})`;
    if (earningsRisk && daysToEarnings !== null) summary += `. Earnings in ${daysToEarnings} days.`;
    if (insiderSentiment !== 'neutral') summary += ` Insiders ${insiderSentiment}.`;
    
    return { level, debtToEbitda, currentRatio, interestCoverage, beta, daysToEarnings, earningsRisk, insiderSentiment, summary };
  }

  /**
   * Return default fundamentals when no data is available
   */
  private getDefaultFundamentals(): FinnhubComprehensiveFundamentals {
    return {
      qualityScore: 50,
      viabilityScore: 50,
      riskScore: 50,
      quality: {
        grade: 'unknown',
        roe: null,
        roa: null,
        grossMargin: null,
        operatingMargin: null,
        fcfMargin: null,
        summary: 'Fundamental data unavailable'
      },
      viability: {
        valuation: 'unknown',
        pe: null,
        forwardPe: null,
        pb: null,
        revenueGrowth: null,
        epsGrowth: null,
        analystRating: 'unknown',
        summary: 'Valuation data unavailable'
      },
      risk: {
        level: 'moderate',
        debtToEbitda: null,
        currentRatio: null,
        interestCoverage: null,
        beta: null,
        daysToEarnings: null,
        earningsRisk: false,
        insiderSentiment: 'neutral',
        summary: 'Risk assessment unavailable'
      },
      rawMetrics: {}
    };
  }
}

