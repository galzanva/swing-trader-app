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
      
      // Adaptive concurrency based on plan
      const baseConcurrency = 5; // Free tier
      const adaptiveConcurrency = Math.min(baseConcurrency, Math.ceil(filtered.length / 10));
      
      console.log(`[Scanner] Using concurrency: ${adaptiveConcurrency}`);
      
      for (let i = 0; i < filtered.length; i += adaptiveConcurrency) {
        if (this.abortController.signal.aborted) {
          throw new Error('Scan aborted by user');
        }
        
        const batch = filtered.slice(i, i + adaptiveConcurrency);
        const stats = this.analyzer.getStats();
        
        const percent = 10 + Math.round((i / filtered.length) * 80);
        const qualified = results.filter(r => r.matchDetails.eligible).length;
        
        this.reportProgress({
          phase: 'detailed',
          total: filtered.length,
          processed: i,
          found: results.length,
          qualified,
          message: `Analyzing tickers... (${stats.cacheHits} cached, ${stats.apiCalls} API calls)`,
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
        
        // Rate limiting - wait between batches
        if (i + adaptiveConcurrency < filtered.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Early exit if enabled and we have enough qualified matches
        const qualifiedMatches = results.filter(r => r.matchDetails.eligible && r.matchScore >= 50);
        if (finalConfig.earlyExitEnabled && qualifiedMatches.length >= maxResults) {
          console.log(`[Scanner] Early exit: Found ${qualifiedMatches.length} qualified matches`);
          break;
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
      
      if (qualifiedResults.length > 0) {
        // Rank qualified results and return top ones
        const ranked = this.rankResults(qualifiedResults);
        finalResults = ranked.slice(0, maxResults);
        console.log(`[Scanner] Returning ${finalResults.length} qualified matches`);
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
   * Get market snapshot using Polygon API
   */
  private async getMarketSnapshot(config: ScannerConfig): Promise<any[]> {
    try {
      const apiKey = process.env.POLYGON_API_KEY;
      if (!apiKey) throw new Error('POLYGON_API_KEY not set');

      // Use Polygon's snapshot endpoint
      const includeOTC = config.excludeOTC === false;
      const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?include_otc=${includeOTC}&apiKey=${apiKey}`;
      
      console.log(`[Scanner] Fetching snapshot from Polygon...`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.tickers || data.tickers.length === 0) {
        console.warn('[Scanner] No tickers returned from snapshot');
        return [];
      }

      console.log(`[Scanner] Snapshot API returned ${data.tickers.length} tickers`);
      return data.tickers;
    } catch (error) {
      console.error('[Scanner] Error fetching snapshot:', error);
      // Fallback to common tickers if snapshot fails
      return this.getFallbackTickers();
    }
  }

  /**
   * Pre-filter tickers by basic criteria (no OHLCV data needed)
   */
  private preFilter(
    tickers: any[],
    strategy: StrategyDsl,
    config: ScannerConfig
  ): any[] {
    console.log(`[Scanner] Pre-filtering ${tickers.length} tickers...`);
    
    // Get market cap range (optional - snapshot API doesn't always have this data)
    const marketCapRange = getMarketCapRange(config);

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
      
      // 6. ETF exclusion (check metadata if available)
      if (config.excludeETFs && ticker.type?.toLowerCase().includes('etf')) {
        return false;
      }

      return true;
    });

    console.log(`[Scanner] Pre-filter: ${filtered.length}/${tickers.length} passed`);
    
    // Sort by dollar volume (most liquid first) if enabled
    if (config.sortByDollarVolume && filtered.length > 0) {
      filtered.sort((a, b) => {
        const dollarVolA = (a.day?.c || a.prevDay?.c || 0) * (a.day?.v || a.prevDay?.v || 0);
        const dollarVolB = (b.day?.c || b.prevDay?.c || 0) * (b.day?.v || b.prevDay?.v || 0);
        return dollarVolB - dollarVolA;
      });
      console.log(`[Scanner] Sorted by dollar volume (most liquid first)`);
      
      // Limit to top N by liquidity to avoid scanning too many low-volume stocks
      const maxPreFiltered = 200; // Scan top 200 by liquidity
      if (filtered.length > maxPreFiltered) {
        console.log(`[Scanner] Limiting to top ${maxPreFiltered} most liquid tickers`);
        return filtered.slice(0, maxPreFiltered);
      }
    }

    return filtered;
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

      // Tertiary: Higher volume
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

