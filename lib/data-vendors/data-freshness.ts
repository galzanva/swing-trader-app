/**
 * Data Freshness and Cache Management
 * 
 * Tracks data age, manages cache invalidation, and ensures fresh data
 */

import { MarketData } from './polygon';

export interface DataFreshnessInfo {
  symbol: string;
  timeframe: string;
  dataLastRefreshedAt: Date;
  dataAgeHours: number;
  isStale: boolean; // > 24 hours old
  cacheKey: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  symbol: string;
  timeframe: string;
}

// In-memory cache for data freshness tracking
const dataCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_HOURS = 24;

/**
 * Generate cache key for symbol/timeframe combination
 */
export function getCacheKey(symbol: string, timeframe: string): string {
  return `${symbol.toUpperCase()}_${timeframe}`;
}

/**
 * Check if cached data is stale (> 24 hours old)
 */
export function isDataStale(cacheKey: string): boolean {
  const entry = dataCache.get(cacheKey);
  if (!entry) return true;
  
  const ageHours = (Date.now() - entry.timestamp.getTime()) / (1000 * 60 * 60);
  return ageHours > CACHE_TTL_HOURS;
}

/**
 * Get data freshness info for a symbol/timeframe
 */
export function getDataFreshnessInfo(symbol: string, timeframe: string): DataFreshnessInfo {
  const cacheKey = getCacheKey(symbol, timeframe);
  const entry = dataCache.get(cacheKey);
  
  if (!entry) {
    return {
      symbol,
      timeframe,
      dataLastRefreshedAt: new Date(0), // Epoch - no data
      dataAgeHours: Infinity,
      isStale: true,
      cacheKey,
    };
  }
  
  const dataAgeHours = (Date.now() - entry.timestamp.getTime()) / (1000 * 60 * 60);
  
  return {
    symbol,
    timeframe,
    dataLastRefreshedAt: entry.timestamp,
    dataAgeHours,
    isStale: dataAgeHours > CACHE_TTL_HOURS,
    cacheKey,
  };
}

/**
 * Cache data with timestamp
 */
export function cacheData<T>(symbol: string, timeframe: string, data: T): void {
  const cacheKey = getCacheKey(symbol, timeframe);
  dataCache.set(cacheKey, {
    data,
    timestamp: new Date(),
    symbol,
    timeframe,
  });
}

/**
 * Get cached data if not stale
 */
export function getCachedData<T>(symbol: string, timeframe: string): T | null {
  const cacheKey = getCacheKey(symbol, timeframe);
  
  if (isDataStale(cacheKey)) {
    dataCache.delete(cacheKey); // Remove stale entry
    return null;
  }
  
  const entry = dataCache.get(cacheKey);
  return entry ? entry.data : null;
}

/**
 * Invalidate cache for specific symbol/timeframe
 */
export function invalidateCache(symbol: string, timeframe: string): void {
  const cacheKey = getCacheKey(symbol, timeframe);
  dataCache.delete(cacheKey);
}

/**
 * Invalidate all stale caches
 */
export function invalidateStaleCaches(): void {
  const staleKeys: string[] = [];
  
  for (const [key, entry] of dataCache.entries()) {
    const ageHours = (Date.now() - entry.timestamp.getTime()) / (1000 * 60 * 60);
    if (ageHours > CACHE_TTL_HOURS) {
      staleKeys.push(key);
    }
  }
  
  staleKeys.forEach(key => dataCache.delete(key));
}

/**
 * Get all cached symbols and their freshness status
 */
export function getAllCachedSymbols(): DataFreshnessInfo[] {
  const results: DataFreshnessInfo[] = [];
  
  for (const [key, entry] of dataCache.entries()) {
    const dataAgeHours = (Date.now() - entry.timestamp.getTime()) / (1000 * 60 * 60);
    
    results.push({
      symbol: entry.symbol,
      timeframe: entry.timeframe,
      dataLastRefreshedAt: entry.timestamp,
      dataAgeHours,
      isStale: dataAgeHours > CACHE_TTL_HOURS,
      cacheKey: key,
    });
  }
  
  return results.sort((a, b) => a.dataAgeHours - b.dataAgeHours);
}

/**
 * Format data age for display
 */
export function formatDataAge(ageHours: number): string {
  if (ageHours < 1) {
    return `${Math.round(ageHours * 60)}m ago`;
  } else if (ageHours < 24) {
    return `${Math.round(ageHours)}h ago`;
  } else {
    const days = Math.round(ageHours / 24);
    return `${days}d ago`;
  }
}

/**
 * Check if data needs refresh (stale or missing)
 */
export function needsDataRefresh(symbol: string, timeframe: string): boolean {
  const cacheKey = getCacheKey(symbol, timeframe);
  return isDataStale(cacheKey);
}
