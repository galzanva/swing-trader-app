/**
 * Market Scanner - High-Performance Multi-Ticker Strategy Matching
 * 
 * Approach:
 * 1. Use Polygon Snapshot API for fast pre-filtering (price, volume, liquidity)
 * 2. Batch fetch full OHLCV data for qualified tickers
 * 3. Calculate indicators and match against strategy criteria
 * 4. Return ranked results sorted by match score
 */

import { PolygonClient } from '../data-vendors/polygon';
import type { StrategyInput, OHLCV } from '../strategies/types';
import type { StrategyDsl } from '../strategy-builder/dsl-schema';
import type { EnhancedScannerConfig, TrendDirection } from './scanner-config';
import { 
  getMarketCapRange, 
  shouldExcludeByType, 
  DEFAULT_SCANNER_CONFIG 
} from './scanner-config';
import { scannerCache } from './scanner-cache';
import { ScannerAnalyzer } from './scanner-analyzer';

// Legacy support
export type ScannerConfig = EnhancedScannerConfig;

export interface ScanResult {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  matchScore: number; // 0-100, how well it matches the strategy
  matchDetails: {
    eligible: boolean;
    viability?: number;
    quality?: number;
    failureReason?: string;
    passedCriteria: string[];
    rrFirst?: number;
  };
  indicators?: {
    ema9: number;
    ema20: number;
    ema50: number;
    rsi14: number;
    atrPct: number;
    volZ: number;
  };
  squeeze?: {
    combinedScore: number;
    combinedPotential: 'extreme' | 'high' | 'moderate' | 'low' | 'none';
    alignment: boolean;
    shortFloat: number | null;
    daysToCover: number | null;
    ttmState: 'ON' | 'FIRE' | 'OFF';
    ttmDuration: number;
  };
}

export interface ScanProgress {
  phase: 'snapshot' | 'filtering' | 'detailed' | 'ranking' | 'complete' | 'aborted';
  total: number;
  processed: number;
  found: number;
  qualified: number;
  message: string;
  percent: number; // 0-100
  cacheHits?: number;
  apiCalls?: number;
}

export class MarketScanner {
  private polygonClient: PolygonClient;
  private analyzer: ScannerAnalyzer;
  private progressCallback?: (progress: ScanProgress) => void;
  private abortController?: AbortController;

  constructor(apiKey: string) {
    this.polygonClient = new PolygonClient(apiKey);
    this.analyzer = new ScannerAnalyzer(apiKey);
  }

  /**
   * Set progress callback for real-time updates
   */
  onProgress(callback: (progress: ScanProgress) => void) {
    this.progressCallback = callback;
  }

  /**
   * Abort ongoing scan
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Scan market for tickers matching a strategy
   */
  async scanMarket(
    strategy: StrategyDsl,
    config: ScannerConfig = {},
    maxResults: number = 20
  ): Promise<ScanResult[]> {
    // Reset stats
    this.analyzer.resetStats();
    
    // Create abort controller
    this.abortController = new AbortController();
    
    // Merge with defaults
    const finalConfig = { ...DEFAULT_SCANNER_CONFIG, ...config, maxResults };
    
    console.log(`[Scanner] Starting scan for strategy: ${strategy.name}`);
    console.log(`[Scanner] Config:`, finalConfig);

    try {
      // Phase 1: Get market snapshot
      this.reportProgress({
        phase: 'snapshot',
        total: 0,
        processed: 0,
        found: 0,
        qualified: 0,
        message: 'Fetching market snapshot...',
        percent: 5,
      });

      const snapshot = await this.getMarketSnapshot(finalConfig);
      console.log(`[Scanner] Snapshot returned ${snapshot.length} tickers`);
      
      if (this.abortController.signal.aborted) {
        throw new Error('Scan aborted by user');
      }

      // Phase 2: Pre-filter by basic criteria
      this.reportProgress({
        phase: 'filtering',
        total: snapshot.length,
        processed: 0,
        found: 0,
        qualified: 0,
        message: 'Pre-filtering tickers...',
        percent: 10,
      });

      const filtered = this.preFilter(snapshot, strategy, finalConfig);
      console.log(`[Scanner] Pre-filter passed: ${filtered.length} tickers`);
      
      if (this.abortController.signal.aborted) {
        throw new Error('Scan aborted by user');
      }

      // Phase 3: Detailed analysis (fetch OHLCV + indicators)
      const results: ScanResult[] = [];
      
      // HIGH concurrency for paid Polygon Starter plan (unlimited API calls!)
      const hasSqueezeFilters = finalConfig.minShortFloat || finalConfig.minDaysToCover || (finalConfig.ttmSqueezeState && finalConfig.ttmSqueezeState !== 'any');
      const isOverviewMode = finalConfig.overviewMode === true;
      
      // Maximize concurrency for paid plan
      let baseConcurrency: number;
      if (isOverviewMode) {
        baseConcurrency = 30; // Overview: very fast, no strategy evaluation
      } else if (hasSqueezeFilters) {
        baseConcurrency = 25; // Squeeze filtering: high concurrency
      } else {
        baseConcurrency = 20; // Strategy evaluation: moderate-high concurrency
      }
      
      const adaptiveConcurrency = Math.min(baseConcurrency, Math.ceil(filtered.length / 10));
      
      console.log(`[Scanner] Using concurrency: ${adaptiveConcurrency} (paid plan - unlimited API calls!)${hasSqueezeFilters ? ' [squeeze filtering]' : isOverviewMode ? ' [overview mode]' : ''}`);
      
      for (let i = 0; i < filtered.length; i += adaptiveConcurrency) {
        if (this.abortController.signal.aborted) {
          throw new Error('Scan aborted by user');
        }
        
        const batch = filtered.slice(i, i + adaptiveConcurrency);
        const stats = this.analyzer.getStats();
        
        const percent = 10 + Math.round((i / filtered.length) * 80);
        const qualified = results.filter(r => r.matchDetails.eligible).length;
        
        // Different message for overview vs strategy mode
        const progressMessage = isOverviewMode 
          ? `Scanning market... (${stats.cacheHits} cached, ${stats.apiCalls} API calls)`
          : `Analyzing tickers... (${stats.cacheHits} cached, ${stats.apiCalls} API calls)`;
        
        this.reportProgress({
          phase: 'detailed',
          total: filtered.length,
          processed: i,
          found: results.length,
          qualified,
          message: progressMessage,
          percent,
          cacheHits: stats.cacheHits,
          apiCalls: stats.apiCalls,
        });
        
        const batchResults = await Promise.allSettled(
          batch.map(ticker => this.analyzer.analyzeTicker(ticker, strategy, finalConfig))
        );
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
          }
        }
        
        // Minimal delay for paid accounts - can handle high throughput
        if (i + adaptiveConcurrency < filtered.length) {
          const delay = hasSqueezeFilters ? 200 : 500; // Very short delays
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Early exit if enabled and we have enough qualified matches
        // NEVER early exit in overview mode - user wants to see all filtered stocks
        if (!isOverviewMode) {
          const qualifiedMatches = results.filter(r => r.matchDetails.eligible && r.matchScore >= 50);
          const earlyExitThreshold = hasSqueezeFilters ? Math.max(maxResults, 20) : maxResults;
          
          if (finalConfig.earlyExitEnabled && qualifiedMatches.length >= earlyExitThreshold) {
            console.log(`[Scanner] Early exit: Found ${qualifiedMatches.length} qualified matches (threshold: ${earlyExitThreshold})`);
            break;
          }
        }
      }

      if (this.abortController.signal.aborted) {
        throw new Error('Scan aborted by user');
      }

      // Phase 4: Rank and sort results
      const qualifiedResults = results.filter(r => r.matchDetails.eligible);
      const unqualifiedResults = results.filter(r => !r.matchDetails.eligible);
      const stats = this.analyzer.getStats();
      
      console.log(`[Scanner] Total analyzed: ${results.length}, Qualified: ${qualifiedResults.length}, Not qualified: ${unqualifiedResults.length}`);
      console.log(`[Scanner] Cache performance: ${stats.cacheHits} hits, ${stats.apiCalls} API calls`);
      
      this.reportProgress({
        phase: 'ranking',
        total: results.length,
        processed: results.length,
        found: results.length,
        qualified: qualifiedResults.length,
        message: 'Ranking results...',
        percent: 95,
        cacheHits: stats.cacheHits,
        apiCalls: stats.apiCalls,
      });

      // Return ONLY qualified matches, or if none, return top unqualified with reasons
      let finalResults: ScanResult[];
      
      // In overview mode, return MORE results (users want broad market view)
      const maxResultsToReturn = isOverviewMode ? 100 : maxResults; // 100 for overview, 20 for strategy
      
      if (qualifiedResults.length > 0) {
        // Rank qualified results and return top ones
        const ranked = this.rankResults(qualifiedResults);
        finalResults = ranked.slice(0, maxResultsToReturn);
        console.log(`[Scanner] Returning ${finalResults.length} qualified matches${isOverviewMode ? ' (overview mode - showing top 100)' : ''}`);
      } else {
        // No qualified matches - return top unqualified results to show why they failed
        console.log(`[Scanner] No qualified matches found. Returning top ${Math.min(20, unqualifiedResults.length)} with failure reasons.`);
        const ranked = this.rankResults(unqualifiedResults);
        finalResults = ranked.slice(0, Math.min(20, maxResults));
      }

      this.reportProgress({
        phase: 'complete',
        total: results.length,
        processed: results.length,
        found: finalResults.length,
        qualified: qualifiedResults.length,
        message: qualifiedResults.length > 0 
          ? `Scan complete! Found ${qualifiedResults.length} qualified matches.`
          : `Scan complete. No qualified matches found (showing ${finalResults.length} closest).`,
        percent: 100,
        cacheHits: stats.cacheHits,
        apiCalls: stats.apiCalls,
      });

      console.log(`[Scanner] Scan complete. Returning ${finalResults.length} results.`);
      return finalResults;
    } catch (error: any) {
      const stats = this.analyzer.getStats();
      
      if (error.message === 'Scan aborted by user') {
        this.reportProgress({
          phase: 'aborted',
          total: 0,
          processed: 0,
          found: 0,
          qualified: 0,
          message: 'Scan aborted by user',
          percent: 0,
          cacheHits: stats.cacheHits,
          apiCalls: stats.apiCalls,
        });
      }
      
      console.error('[Scanner] Error:', error);
      throw error;
    }
  }

  /**
   * Get market snapshot using Polygon's Grouped Daily API
   * This fetches ALL U.S. stocks in a single API call (6000-8000 stocks)
   * Much more efficient for paid plans with unlimited API calls!
   */
  private async getMarketSnapshot(config: ScannerConfig): Promise<any[]> {
    try {
      console.log(`[Scanner] Fetching grouped daily for TODAY and YESTERDAY (2 API calls)...`);
      
      // Fetch TODAY and YESTERDAY to calculate proper day-over-day change
      const [todayData, yesterdayData] = await Promise.all([
        this.polygonClient.getGroupedDaily(), // Today (or latest trading day)
        this.polygonClient.getGroupedDaily(this.getDateNDaysAgo(2)), // Previous trading day
      ]);
      
      if (!todayData.results || todayData.results.length === 0) {
        console.warn('[Scanner] No results from grouped daily');
        return this.getFallbackTickers();
      }

      console.log(`[Scanner] Today: ${todayData.results.length} stocks, Yesterday: ${yesterdayData.results?.length || 0} stocks`);
      
      // Create a map of yesterday's data for quick lookup
      const yesterdayMap = new Map<string, any>();
      if (yesterdayData.results) {
        yesterdayData.results.forEach((bar: any) => {
          yesterdayMap.set(bar.T, bar);
        });
      }
      
      // Convert to snapshot format with proper day-over-day change
      const snapshots = todayData.results.map(bar => {
        const yesterdayBar = yesterdayMap.get(bar.T);
        const prevClose = yesterdayBar ? yesterdayBar.c : bar.o; // Fallback to today's open if no prev data
        const change = bar.c - prevClose;
        const changePerc = (change / prevClose) * 100;
        
        return {
          ticker: bar.T,
          day: {
            c: bar.c,  // Today's close
            h: bar.h,  // Today's high
            l: bar.l,  // Today's low
            o: bar.o,  // Today's open
            v: bar.v,  // Today's volume
            vw: bar.vw, // Volume-weighted average price
          },
          prevDay: {
            c: prevClose, // Yesterday's close (or today's open as fallback)
            v: yesterdayBar?.v || bar.v,
          },
          todaysChangePerc: changePerc, // Proper day-over-day % change
          updated: bar.t,
        };
      });

      return snapshots;
    } catch (error) {
      console.error('[Scanner] Error fetching grouped daily:', error);
      // Fallback to common tickers if API fails
      return this.getFallbackTickers();
    }
  }

  /**
   * Pre-filter tickers by basic criteria (no OHLCV data needed)
   * This is where we eliminate 95%+ of stocks based on simple filters!
   */
  private preFilter(
    tickers: any[],
    strategy: StrategyDsl,
    config: ScannerConfig
  ): any[] {
    console.log(`[Scanner] Pre-filtering ${tickers.length} tickers...`);
    
    // Get market cap range (optional - snapshot API doesn't always have this data)
    const marketCapRange = getMarketCapRange(config);

    // ETFs are excluded by default (unless explicitly disabled)
    const excludeETFs = config.excludeETFs !== false; // Default: true

    const filtered = tickers.filter(ticker => {
      const symbol = ticker.ticker;
      
      // Extract data from snapshot
      const price = ticker.day?.c || ticker.prevDay?.c || 0;
      const volume = ticker.day?.v || ticker.prevDay?.v || 0;
      
      // Market cap is NOT reliably available in snapshot API
      // We'll skip this filter in pre-filter and apply it during detailed analysis
      
      // Calculate dollar volume
      const dollarVolume = price * volume;

      // 1. Price filter
      if (config.minPrice && price < config.minPrice) return false;
      if (config.maxPrice && price > config.maxPrice) return false;

      // 2. Volume filter
      if (config.minVolume && volume < config.minVolume) return false;
      
      // 3. Dollar volume filter (liquidity) - PRIMARY FILTER
      if (config.minDollarVolume && dollarVolume < config.minDollarVolume) {
        return false;
      }

      // 4. Market cap filter - SKIP for now (not in snapshot API)
      // Will be applied in detailed analysis when we fetch full ticker data
      
      // 5. Type exclusions (basic pattern matching)
      if (shouldExcludeByType(symbol, config)) {
        return false;
      }
      
      // 6. ETF exclusion (DEFAULT ON - exclude by symbol patterns)
      if (excludeETFs && this.isLikelyETF(symbol)) {
        return false;
      }

      return true;
    });

    console.log(`[Scanner] Pre-filter: ${filtered.length}/${tickers.length} passed`);
    
    // ALWAYS sort by dollar volume (most liquid first)
    filtered.sort((a, b) => {
      const dollarVolA = (a.day?.c || a.prevDay?.c || 0) * (a.day?.v || a.prevDay?.v || 0);
      const dollarVolB = (b.day?.c || b.prevDay?.c || 0) * (b.day?.v || b.prevDay?.v || 0);
      return dollarVolB - dollarVolA;
    });
    console.log(`[Scanner] Sorted by dollar volume (highest liquidity first)`);
    
    // IMPORTANT: We already filtered ALL stocks above
    // Now we need to decide how many to actually SCAN (fetch detailed data for)
    // This is a performance optimization - we can't fetch OHLCV for 6000 stocks
    const hasSqueezeFilters = config.minShortFloat || config.minDaysToCover || (config.ttmSqueezeState && config.ttmSqueezeState !== 'any');
    const isOverviewMode = config.overviewMode === true;
    
    let maxToScan: number;
    if (isOverviewMode) {
      // Overview mode: Scan top 1000 most liquid (user wants broad market view)
      maxToScan = 1000;
    } else if (hasSqueezeFilters) {
      // Squeeze filters: scan 2000 (squeeze conditions are rare!)
      maxToScan = 2000;
    } else {
      // Strategy evaluation: scan top 300 most liquid
      maxToScan = 300;
    }
    
    if (filtered.length > maxToScan) {
      console.log(`[Scanner] Will scan top ${maxToScan} most liquid tickers${hasSqueezeFilters ? ' (extended for squeeze filtering)' : isOverviewMode ? ' (overview mode - broad scan)' : ''}`);
      console.log(`[Scanner] Note: ${filtered.length} stocks passed pre-filter, but we'll only fetch detailed data for top ${maxToScan} by liquidity`);
      return filtered.slice(0, maxToScan);
    }
    
    console.log(`[Scanner] Will scan all ${filtered.length} filtered tickers`);
    return filtered;
  }

  /**
   * Get date N trading days ago in YYYY-MM-DD format
   */
  private getDateNDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    
    // Skip weekends
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) { // Sunday -> go back to Friday
      date.setDate(date.getDate() - 2);
    } else if (dayOfWeek === 6) { // Saturday -> go back to Friday
      date.setDate(date.getDate() - 1);
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * Check if ticker is likely an ETF based on common patterns
   */
  private isLikelyETF(symbol: string): boolean {
    const upper = symbol.toUpperCase();
    
    // Explicit list of common ETFs (most reliable)
    const explicitETFs = [
      'SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI', 'VEA', 'VWO', 'AGG', 'BND',
      'IVV', 'IJH', 'IJR', 'IWF', 'IWD', 'IWB', 'VTV', 'VUG', 'EFA', 'EEM',
      'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLP', 'XLU', 'XLY', 'XLB', 'XLRE',
      'GLD', 'SLV', 'USO', 'UNG', 'TLT', 'SHY', 'SHV', 'LQD', 'HYG', 'JNK',
      'ARKK', 'ARKQ', 'ARKW', 'ARKG', 'ARKF', 'FXI', 'EWJ', 'EWZ', 'EWG',
      'SQQQ', 'TQQQ', 'UPRO', 'SPXU', 'TNA', 'TZA', 'FAZ', 'FAS', 'UDOW', 'SDOW',
    ];
    
    if (explicitETFs.includes(upper)) {
      return true;
    }
    
    // Pattern-based detection for less common ETFs
    const etfPatterns = [
      /^[A-Z]{2,4}[XY]$/,  // SPYX, etc.
      /^[A-Z]{2,3}[LU]$/,  // Leveraged (FAZ, TNA, TQQQ, etc.)
      /^V[A-Z]{2,3}$/,     // Vanguard (VTI, VOO, etc.)
      /^I[A-Z]{2,3}$/,     // iShares (IVV, IJH, etc.)
      /^XL[A-Z]$/,         // Sector SPDRs
      /^EW[A-Z]$/,         // Country ETFs
      /^ARK[A-Z]$/,        // ARK Innovation
      /^PSQ|QLD|DOG$/,     // More leveraged/inverse
    ];
    
    return etfPatterns.some(pattern => pattern.test(upper));
  }

  /**
   * Rank results by match score and other factors
   */
  private rankResults(results: ScanResult[]): ScanResult[] {
    return results.sort((a, b) => {
      // Primary: Eligible strategies first
      if (a.matchDetails.eligible && !b.matchDetails.eligible) return -1;
      if (!a.matchDetails.eligible && b.matchDetails.eligible) return 1;

      // Secondary: Higher match score
      if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore;

      // Tertiary: Higher dollar volume (price * volume) for better liquidity
      const dollarVolA = a.price * a.volume;
      const dollarVolB = b.price * b.volume;
      if (Math.abs(dollarVolA - dollarVolB) > 1000) { // Meaningful difference
        return dollarVolB - dollarVolA;
      }

      // Quaternary: Higher share volume
      return b.volume - a.volume;
    });
  }

  /**
   * Fallback tickers if snapshot API fails
   */
  private getFallbackTickers(): any[] {
    const commonTickers = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD', 
      'NFLX', 'DIS', 'BA', 'JPM', 'GS', 'BAC', 'WMT', 'HD', 'COST',
      'NKE', 'SBUX', 'MCD', 'PG', 'JNJ', 'PFE', 'MRNA', 'XOM', 'CVX',
      'SPY', 'QQQ', 'IWM', 'ARKK', 'PLTR', 'COIN', 'UBER', 'LYFT',
      'SNAP', 'PINS', 'SHOP', 'SQ', 'HOOD', 'SOFI', 'AFRM', 'UPST'
    ];

    return commonTickers.map(ticker => ({
      ticker,
      day: { c: 100, v: 1000000 }, // Placeholder
      prevDay: { c: 100, v: 1000000 },
    }));
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: ScanProgress) {
    console.log(`[Scanner] ${progress.phase}: ${progress.message}`);
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
}

