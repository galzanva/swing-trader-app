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
  swingScanMode?: boolean; // If true, use swing strategy scanner
  swingStrategyId?: string; // ID of swing strategy to use
  
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
  volumeRatioMin?: number; // Min volume vs 20-day avg (default: 1.5)
  volumeRatioMax?: number; // Max volume vs 20-day avg (blow-off filter)
  
  // Volatility
  minAtrPct?: number;
  maxAtrPct?: number;
  
  // Trend
  trendDirection?: TrendDirection;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SWING STRATEGY FILTERS (NEW)
  // For "US Swing – Early-Stage Bullish Trend" strategy
  // ═══════════════════════════════════════════════════════════════════════════
  
  // ADX Range Filter
  minAdx?: number; // Min ADX (default: 20 for early-stage trend)
  maxAdx?: number; // Max ADX (default: 30 to avoid mature trends)
  requirePlusDIAboveMinusDI?: boolean; // +DI > -DI for bullish bias
  
  // EMA Distance Filter
  minEma20Distance?: number; // Min % above EMA20 (default: 0)
  maxEma20Distance?: number; // Max % above EMA20 (default: 10, reject extended)
  
  // RSI Range Filter (for momentum without exhaustion)
  minRsi?: number; // Min RSI (default: 55)
  maxRsi?: number; // Max RSI (default: 65, avoid overbought)
  
  // MACD Filter
  requireMacdAboveZero?: boolean;
  macdCrossWithinBars?: number; // Require MACD cross within N bars
  
  // Flow Filters
  requireOBVUptrend?: boolean; // OBV > 20-bar MA
  minCmf?: number; // Min CMF (default: 0)
  excludeCmfBelow?: number; // Exclude if CMF below this (e.g., -0.1)
  
  // Structure Filters
  requireNewHighWithinBars?: number; // New 20-day high within N bars
  requireBreakoutAbovePriorBars?: number; // Close above highest close of prior N bars
  
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
  marketCapPreset: 'any', // No market cap filter by default - dollar volume is sufficient
  minVolume: 500_000,
  minDollarVolume: 20_000_000, // $20M median - this is the primary liquidity filter
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
 * Preset for "US Swing – Early-Stage Bullish Trend (5–15 days)" strategy
 * 
 * This preset implements the following filters:
 * 1. Universe: US stocks (NYSE, NASDAQ, AMEX), Price > $5, $5M+ daily dollar volume
 * 2. Trend: Price > EMA20 > EMA50, 0% ≤ EMA20 distance ≤ 10%, ADX 20-30, +DI > -DI
 * 3. Momentum: RSI 55-65, MACD > 0 or recent cross
 * 4. Volume: 1.5× average, OBV uptrend, CMF > -0.1
 * 5. Volatility: ATR% 2-8%
 */
export const SWING_EARLY_BULLISH_CONFIG: EnhancedScannerConfig = {
  // Swing scan mode
  swingScanMode: true,
  swingStrategyId: 'us-swing-early-bullish',
  
  // Universe & Liquidity
  minPrice: 5, // User can raise to 10 for higher quality
  maxPrice: 500,
  minVolume: 500_000,
  minDollarVolume: 5_000_000, // $5M minimum, user can raise to $10M
  volumeRatioMin: 1.5, // 1.5× 20-day average
  volumeRatioMax: 5.0, // Avoid blow-offs
  
  // Volatility
  minAtrPct: 2, // Not too slow
  maxAtrPct: 8, // Not too wild
  
  // Trend - ADX Range
  minAdx: 20,
  maxAdx: 30,
  requirePlusDIAboveMinusDI: true,
  
  // EMA Distance
  minEma20Distance: 0,
  maxEma20Distance: 10, // Reject if >10% above EMA20 (extended)
  
  // Momentum - RSI Range (NOT overbought)
  minRsi: 55,
  maxRsi: 65, // Explicitly avoiding RSI > 70
  
  // MACD
  requireMacdAboveZero: true,
  macdCrossWithinBars: 5,
  
  // Flow
  requireOBVUptrend: true,
  minCmf: 0,
  excludeCmfBelow: -0.1, // Hard exclude distribution
  
  // Exchange/Type
  exchange: 'major',
  excludeOTC: true,
  excludeETFs: true,
  excludeWarrants: true,
  excludeADRs: true,
  
  // Other
  skipEarnings: true,
  earningsDaysBuffer: 3,
  maxResults: 50,
  earlyExitEnabled: true,
  sortByDollarVolume: true,
};

/**
 * Get swing strategy config preset by ID
 */
export function getSwingStrategyConfig(strategyId: string): EnhancedScannerConfig | null {
  switch (strategyId) {
    case 'us-swing-early-bullish':
      return SWING_EARLY_BULLISH_CONFIG;
    default:
      return null;
  }
}

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

