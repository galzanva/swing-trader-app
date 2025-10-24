/**
 * Scanner Configuration Types & Presets
 * Professional-grade filtering options
 */

export type MarketCapPreset = 
  | 'any'
  | 'nano'      // < $50M
  | 'micro'     // $50M - $300M
  | 'small'     // $300M - $2B
  | 'mid'       // $2B - $10B
  | 'large'     // $10B - $200B
  | 'mega'      // > $200B
  | 'mid_plus'  // >= $2B (Mid + Large + Mega)
  | 'large_plus' // >= $10B (Large + Mega)
  | 'custom';

export type TrendDirection = 
  | 'any'
  | 'uptrend'    // SMA50 > SMA200
  | 'downtrend'  // SMA50 < SMA200
  | 'neutral';

export type ExchangeFilter =
  | 'all'
  | 'major'      // NYSE, NASDAQ, AMEX
  | 'nyse'
  | 'nasdaq'
  | 'amex';

export interface MarketCapRange {
  min: number;
  max: number;
}

export const MARKET_CAP_PRESETS: Record<MarketCapPreset, MarketCapRange | null> = {
  any: null,
  nano: { min: 0, max: 50_000_000 },
  micro: { min: 50_000_000, max: 300_000_000 },
  small: { min: 300_000_000, max: 2_000_000_000 },
  mid: { min: 2_000_000_000, max: 10_000_000_000 },
  large: { min: 10_000_000_000, max: 200_000_000_000 },
  mega: { min: 200_000_000_000, max: Infinity },
  mid_plus: { min: 2_000_000_000, max: Infinity },
  large_plus: { min: 10_000_000_000, max: Infinity },
  custom: null, // Use custom min/max
};

export interface EnhancedScannerConfig {
  // Scan mode
  overviewMode?: boolean; // If true, skip strategy evaluation and just show filtered stocks
  
  // Price filters
  minPrice?: number;
  maxPrice?: number;
  
  // Market cap
  marketCapPreset?: MarketCapPreset;
  customMarketCapMin?: number;
  customMarketCapMax?: number;
  
  // Volume filters
  minVolume?: number; // Shares per day
  minDollarVolume?: number; // Median $ volume (default: $20M)
  
  // Volatility
  minAtrPct?: number;
  maxAtrPct?: number;
  
  // Trend
  trendDirection?: TrendDirection;
  
  // Squeeze filters (Short Float Squeeze + TTM Squeeze)
  minDaysToCover?: number; // Min days to cover (e.g., 5)
  minShortFloat?: number; // Min short float % (e.g., 15)
  ttmSqueezeState?: 'ON' | 'FIRE' | 'OFF' | 'any'; // TTM squeeze state filter
  
  // Exchange/Type
  exchange?: ExchangeFilter;
  excludeOTC?: boolean;
  excludeETFs?: boolean; // Default: true (exclude ETFs by default)
  excludeWarrants?: boolean;
  excludeADRs?: boolean;
  
  // Fundamental
  skipEarnings?: boolean; // Skip stocks within ±2 days of earnings
  earningsDaysBuffer?: number; // Default: 2
  
  // Performance
  maxResults?: number;
  earlyExitEnabled?: boolean; // Exit early when enough qualified matches
  sortByDollarVolume?: boolean; // Pre-sort by liquidity
}

export const DEFAULT_SCANNER_CONFIG: EnhancedScannerConfig = {
  minPrice: 5,
  maxPrice: 10000,
  marketCapPreset: 'mid_plus', // >= $2B by default
  minVolume: 500_000,
  minDollarVolume: 20_000_000, // $20M median
  minAtrPct: 0,
  maxAtrPct: 100,
  trendDirection: 'any',
  exchange: 'major',
  excludeOTC: true,
  excludeETFs: true,
  excludeWarrants: true,
  excludeADRs: true,
  skipEarnings: true,
  earningsDaysBuffer: 2,
  maxResults: 50,
  earlyExitEnabled: true,
  sortByDollarVolume: true,
};

/**
 * Get market cap range from preset or custom values
 */
export function getMarketCapRange(config: EnhancedScannerConfig): MarketCapRange | null {
  if (config.marketCapPreset === 'custom') {
    if (config.customMarketCapMin !== undefined || config.customMarketCapMax !== undefined) {
      return {
        min: config.customMarketCapMin || 0,
        max: config.customMarketCapMax || Infinity,
      };
    }
    return null;
  }
  
  if (config.marketCapPreset && config.marketCapPreset !== 'any') {
    return MARKET_CAP_PRESETS[config.marketCapPreset];
  }
  
  return null;
}

/**
 * Check if ticker symbol is likely an ETF, warrant, or ADR
 */
export function shouldExcludeByType(
  ticker: string,
  config: EnhancedScannerConfig
): boolean {
  const symbol = ticker.toUpperCase();
  
  // Check for warrants
  if (config.excludeWarrants) {
    if (symbol.includes('.W') || symbol.includes('-W') || symbol.endsWith('W')) {
      return true;
    }
  }
  
  // Check for ADRs (usually end in Y or have specific patterns)
  if (config.excludeADRs) {
    // Common ADR patterns (not perfect but catches most)
    if (symbol.length === 4 && symbol.endsWith('Y')) {
      return true;
    }
  }
  
  // ETFs are harder to detect from symbol alone
  // Will rely on Polygon metadata if available
  
  return false;
}

/**
 * Format market cap for display
 */
export function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1_000_000_000_000) {
    return `$${(marketCap / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (marketCap >= 1_000_000_000) {
    return `$${(marketCap / 1_000_000_000).toFixed(2)}B`;
  }
  if (marketCap >= 1_000_000) {
    return `$${(marketCap / 1_000_000).toFixed(2)}M`;
  }
  return `$${marketCap.toLocaleString()}`;
}

/**
 * Format dollar volume for display
 */
export function formatDollarVolume(dollarVol: number): string {
  if (dollarVol >= 1_000_000_000) {
    return `$${(dollarVol / 1_000_000_000).toFixed(1)}B`;
  }
  if (dollarVol >= 1_000_000) {
    return `$${(dollarVol / 1_000_000).toFixed(1)}M`;
  }
  return `$${(dollarVol / 1000).toFixed(0)}K`;
}

/**
 * Get display label for market cap preset
 */
export function getMarketCapLabel(preset: MarketCapPreset): string {
  const labels: Record<MarketCapPreset, string> = {
    any: 'Any',
    nano: 'Nano (< $50M)',
    micro: 'Micro ($50M–$300M)',
    small: 'Small ($300M–$2B)',
    mid: 'Mid ($2B–$10B)',
    large: 'Large ($10B–$200B)',
    mega: 'Mega (> $200B)',
    mid_plus: 'Mid+ (≥ $2B)',
    large_plus: 'Large+ (≥ $10B)',
    custom: 'Custom Range',
  };
  return labels[preset];
}

