/**
 * Scanner Cache System
 * Caches OHLCV data by (ticker, timeframe, lastBarTimestamp)
 * Reduces API calls and speeds up repeated scans
 */

import type { OHLCV } from '../strategies/types';
import type { TechnicalIndicators } from '../indicators/technical';

interface CacheEntry {
  ticker: string;
  timeframe: string;
  lastBarTimestamp: number;
  bars: OHLCV[];
  indicators: TechnicalIndicators;
  cachedAt: number; // Epoch timestamp
}

class ScannerCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxAge = 24 * 60 * 60 * 1000; // 24 hours
  private maxEntries = 1000; // Limit cache size

  /**
   * Generate cache key
   */
  private getCacheKey(ticker: string, timeframe: string): string {
    return `${ticker.toUpperCase()}_${timeframe}`;
  }

  /**
   * Get cached data if still valid
   */
  get(
    ticker: string,
    timeframe: string,
    lastBarTimestamp?: number
  ): { bars: OHLCV[]; indicators: TechnicalIndicators } | null {
    const key = this.getCacheKey(ticker, timeframe);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if cache expired
    const now = Date.now();
    if (now - entry.cachedAt > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    // If lastBarTimestamp provided, check if data is still current
    if (lastBarTimestamp !== undefined && entry.lastBarTimestamp !== lastBarTimestamp) {
      // Data is stale (new bar arrived)
      this.cache.delete(key);
      return null;
    }

    return {
      bars: entry.bars,
      indicators: entry.indicators,
    };
  }

  /**
   * Store data in cache
   */
  set(
    ticker: string,
    timeframe: string,
    bars: OHLCV[],
    indicators: TechnicalIndicators
  ): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const key = this.getCacheKey(ticker, timeframe);
    const lastBarTimestamp = bars[bars.length - 1]?.timestamp || 0;

    this.cache.set(key, {
      ticker: ticker.toUpperCase(),
      timeframe,
      lastBarTimestamp,
      bars,
      indicators,
      cachedAt: Date.now(),
    });
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxEntries,
      maxAge: this.maxAge,
    };
  }

  /**
   * Prune expired entries
   */
  prune(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.cachedAt > this.maxAge) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

// Singleton instance
export const scannerCache = new ScannerCache();

