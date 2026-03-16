/**
 * Comprehensive Stock Screener Filters
 * 
 * Modular, composable filter system that works without strategies
 * Similar to professional screeners like Finviz, TradingView, etc.
 */

// ═══════════════════════════════════════════════════════════════════════════
// FILTER OPERATOR TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ComparisonOperator = 
  | 'gt'      // >
  | 'gte'     // >=
  | 'lt'      // <
  | 'lte'     // <=
  | 'eq'      // =
  | 'neq'     // !=
  | 'between' // min <= x <= max
  | 'outside'; // x < min OR x > max

export type CrossoverType = 
  | 'above'   // Just crossed above
  | 'below'   // Just crossed below
  | 'any';    // Any recent crossover

export type TrendType = 
  | 'rising'
  | 'falling'
  | 'flat'
  | 'any';

// ═══════════════════════════════════════════════════════════════════════════
// PRICE FILTERS
// ═══════════════════════════════════════════════════════════════════════════

export interface PriceFilter {
  type: 'price';
  enabled: boolean;
  
  // Absolute price range
  minPrice?: number;
  maxPrice?: number;
}

export interface PriceChangeFilter {
  type: 'priceChange';
  enabled: boolean;
  
  // Change from previous close
  minChangePercent?: number;
  maxChangePercent?: number;
  
  // Multi-day change (e.g., 5-day, 20-day)
  period?: number; // Days
}

export interface PricePositionFilter {
  type: 'pricePosition';
  enabled: boolean;
  
  // Price relative to 52-week range
  min52WeekPercent?: number; // 0 = at 52w low, 100 = at 52w high
  max52WeekPercent?: number;
  
  // New highs/lows
  newHighDays?: number; // New X-day high (e.g., 20, 52, 252)
  newLowDays?: number;  // New X-day low
}

// ═══════════════════════════════════════════════════════════════════════════
// MOVING AVERAGE FILTERS
// ═══════════════════════════════════════════════════════════════════════════

export type EMAType = 9 | 20 | 50 | 100 | 200;
export type SMAType = 10 | 20 | 50 | 100 | 200;
export type MAType = 'ema' | 'sma';

export interface PriceToMAFilter {
  type: 'priceToMA';
  enabled: boolean;
  
  maType: MAType;
  maPeriod: number;
  
  // Position relative to MA
  position: 'above' | 'below' | 'any';
  
  // Distance from MA (as percentage)
  minDistancePercent?: number;
  maxDistancePercent?: number;
}

export interface MACrossoverFilter {
  type: 'maCrossover';
  enabled: boolean;
  
  fastMA: { type: MAType; period: number };
  slowMA: { type: MAType; period: number };
  
  // Crossover type
  crossover: CrossoverType;
  
  // Lookback for "recent" crossover
  withinBars?: number;
}

export interface MAAlignmentFilter {
  type: 'maAlignment';
  enabled: boolean;
  
  // Bullish alignment: EMA9 > EMA20 > EMA50 > EMA200
  // Bearish alignment: EMA9 < EMA20 < EMA50 < EMA200
  alignment: 'bullish' | 'bearish' | 'mixed' | 'any';
  
  // Which MAs to check
  checkMAs: number[]; // e.g., [9, 20, 50, 200]
  maType: MAType;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADX / DIRECTIONAL MOVEMENT FILTERS
// ═══════════════════════════════════════════════════════════════════════════

export interface ADXFilter {
  type: 'adx';
  enabled: boolean;
  
  period?: number; // Default: 14
  
  // ADX value range (trend strength)
  minADX?: number;
  maxADX?: number;
  
  // ADX trend
  adxTrend?: TrendType; // Rising ADX = strengthening trend
}

export interface DirectionalFilter {
  type: 'directional';
  enabled: boolean;
  
  period?: number; // Default: 14
  
  // +DI vs -DI
  plusDIAboveMinusDI?: boolean; // Bullish
  minusDIAbovePlusDI?: boolean; // Bearish
  
  // DI difference threshold
  minDIDifference?: number; // Min absolute difference between +DI and -DI
  
  // Individual DI values
  minPlusDI?: number;
  maxPlusDI?: number;
  minMinusDI?: number;
  maxMinusDI?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// RSI FILTER
// ═══════════════════════════════════════════════════════════════════════════

export interface RSIFilter {
  type: 'rsi';
  enabled: boolean;
  
  period?: number; // Default: 14
  
  // RSI value range
  minRSI?: number;
  maxRSI?: number;
  
  // Preset zones
  zone?: 'oversold' | 'overbought' | 'neutral' | 'bullish' | 'bearish' | 'any';
  // oversold: < 30
  // overbought: > 70
  // neutral: 40-60
  // bullish: 55-65 (momentum without exhaustion)
  // bearish: 35-45
}

// ═══════════════════════════════════════════════════════════════════════════
// STOCHASTIC FILTER
// ═══════════════════════════════════════════════════════════════════════════

export interface StochasticFilter {
  type: 'stochastic';
  enabled: boolean;
  
  kPeriod?: number; // Default: 14
  dPeriod?: number; // Default: 3
  
  // %K value range
  minK?: number;
  maxK?: number;
  
  // %D value range
  minD?: number;
  maxD?: number;
  
  // Crossover
  crossover?: 'kAboveD' | 'kBelowD' | 'any';
  
  // Preset zones
  zone?: 'oversold' | 'overbought' | 'neutral' | 'any';
}

// ═══════════════════════════════════════════════════════════════════════════
// MACD FILTER
// ═══════════════════════════════════════════════════════════════════════════

export interface MACDFilter {
  type: 'macd';
  enabled: boolean;
  
  fastPeriod?: number;  // Default: 12
  slowPeriod?: number;  // Default: 26
  signalPeriod?: number; // Default: 9
  
  // MACD line position
  macdAboveZero?: boolean;
  macdBelowZero?: boolean;
  
  // Signal line crossover
  crossover?: 'bullish' | 'bearish' | 'any'; // MACD crosses signal
  crossoverWithinBars?: number;
  
  // Histogram
  histogramPositive?: boolean;
  histogramNegative?: boolean;
  histogramTrend?: TrendType; // Rising/falling histogram
}

// ═══════════════════════════════════════════════════════════════════════════
// VOLUME FILTERS
// ═══════════════════════════════════════════════════════════════════════════

export interface VolumeFilter {
  type: 'volume';
  enabled: boolean;
  
  // Absolute volume
  minVolume?: number;
  maxVolume?: number;
  
  // Relative volume (vs average)
  minRelativeVolume?: number; // e.g., 1.5 = 150% of average
  maxRelativeVolume?: number;
  averagePeriod?: number; // Default: 20
  
  // Use recent average (e.g., 3-day) vs single day
  useRecentAverage?: boolean;
  recentAverageDays?: number;
}

export interface DollarVolumeFilter {
  type: 'dollarVolume';
  enabled: boolean;
  
  // Average daily dollar volume
  minDollarVolume?: number;
  maxDollarVolume?: number;
  averagePeriod?: number; // Default: 20
}

export interface OBVFilter {
  type: 'obv';
  enabled: boolean;
  
  // OBV trend
  trend?: TrendType;
  
  // OBV relative to its MA
  aboveMA?: boolean;
  maPeriod?: number; // Default: 20
  
  // Divergence detection
  priceDivergence?: 'bullish' | 'bearish' | 'none' | 'any';
}

export interface CMFFilter {
  type: 'cmf';
  enabled: boolean;
  
  period?: number; // Default: 20
  
  // CMF value range
  minCMF?: number;
  maxCMF?: number;
  
  // Preset zones
  zone?: 'accumulation' | 'distribution' | 'neutral' | 'any';
  // accumulation: > 0.1
  // distribution: < -0.1
  // neutral: -0.1 to 0.1
}

// ═══════════════════════════════════════════════════════════════════════════
// VOLATILITY FILTERS
// ═══════════════════════════════════════════════════════════════════════════

export interface ATRFilter {
  type: 'atr';
  enabled: boolean;
  
  period?: number; // Default: 14
  
  // ATR as percentage of price
  minATRPercent?: number;
  maxATRPercent?: number;
  
  // ATR trend
  atrTrend?: TrendType;
}

export interface BollingerFilter {
  type: 'bollinger';
  enabled: boolean;
  
  period?: number; // Default: 20
  stdDev?: number; // Default: 2
  
  // %B value (0 = lower band, 1 = upper band)
  minPercentB?: number;
  maxPercentB?: number;
  
  // Bandwidth (volatility)
  minBandwidth?: number;
  maxBandwidth?: number;
  
  // Squeeze detection
  squeeze?: boolean; // Low bandwidth
}

export interface HistoricalVolatilityFilter {
  type: 'historicalVolatility';
  enabled: boolean;
  
  period?: number; // Default: 20
  
  // HV percentage range
  minHV?: number;
  maxHV?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// TTM SQUEEZE FILTER
// ═══════════════════════════════════════════════════════════════════════════

export interface TTMSqueezeFilter {
  type: 'ttmSqueeze';
  enabled: boolean;
  
  // Squeeze state
  state?: 'on' | 'off' | 'firing' | 'any';
  
  // Duration in squeeze
  minSqueezeBars?: number;
  maxSqueezeBars?: number;
  
  // Momentum direction (when firing)
  momentumDirection?: 'bullish' | 'bearish' | 'any';
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNDAMENTAL FILTERS
// ═══════════════════════════════════════════════════════════════════════════

export interface MarketCapFilter {
  type: 'marketCap';
  enabled: boolean;
  
  // Preset
  preset?: 'nano' | 'micro' | 'small' | 'mid' | 'large' | 'mega' | 'any';
  
  // Custom range
  minMarketCap?: number;
  maxMarketCap?: number;
}

export interface SectorFilter {
  type: 'sector';
  enabled: boolean;
  
  // Include sectors
  includeSectors?: string[];
  
  // Exclude sectors
  excludeSectors?: string[];
}

export interface ExchangeFilter {
  type: 'exchange';
  enabled: boolean;
  
  // Include exchanges
  includeExchanges?: ('NYSE' | 'NASDAQ' | 'AMEX' | 'OTC')[];
  
  // Exclude types
  excludeETFs?: boolean;
  excludeADRs?: boolean;
  excludeWarrants?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CANDLESTICK PATTERN FILTERS
// ═══════════════════════════════════════════════════════════════════════════

export interface CandlePatternFilter {
  type: 'candlePattern';
  enabled: boolean;
  
  // Patterns to look for
  patterns?: (
    | 'hammer'
    | 'inverted_hammer'
    | 'bullish_engulfing'
    | 'bearish_engulfing'
    | 'doji'
    | 'morning_star'
    | 'evening_star'
    | 'shooting_star'
    | 'three_white_soldiers'
    | 'three_black_crows'
  )[];
  
  // Pattern location
  location?: 'at_support' | 'at_resistance' | 'near_ema' | 'any';
  
  // Lookback
  withinBars?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED FILTER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export interface ScreenerFilters {
  // Price & Change
  price?: PriceFilter;
  priceChange?: PriceChangeFilter;
  pricePosition?: PricePositionFilter;
  
  // Moving Averages
  priceToMA?: PriceToMAFilter[];
  maCrossover?: MACrossoverFilter[];
  maAlignment?: MAAlignmentFilter;
  
  // Trend Strength
  adx?: ADXFilter;
  directional?: DirectionalFilter;
  
  // Momentum Oscillators
  rsi?: RSIFilter;
  stochastic?: StochasticFilter;
  macd?: MACDFilter;
  
  // Volume & Flow
  volume?: VolumeFilter;
  dollarVolume?: DollarVolumeFilter;
  obv?: OBVFilter;
  cmf?: CMFFilter;
  
  // Volatility
  atr?: ATRFilter;
  bollinger?: BollingerFilter;
  historicalVolatility?: HistoricalVolatilityFilter;
  ttmSqueeze?: TTMSqueezeFilter;
  
  // Fundamentals
  marketCap?: MarketCapFilter;
  sector?: SectorFilter;
  exchange?: ExchangeFilter;
  
  // Patterns
  candlePattern?: CandlePatternFilter;
}

// ═══════════════════════════════════════════════════════════════════════════
// FILTER PRESETS
// ═══════════════════════════════════════════════════════════════════════════

export const FILTER_PRESETS = {
  // Pre-market / Day trading - high volume movers
  preMarketDayTrading: {
    name: 'Pre-Market / Day Trading',
    description: 'Unusual volume (5×+), liquid names for pre-market setups',
    filters: {
      price: { type: 'price', enabled: true, minPrice: 5, maxPrice: 300 },
      dollarVolume: { type: 'dollarVolume', enabled: true, minDollarVolume: 20_000_000 },
      volume: { type: 'volume', enabled: true, minRelativeVolume: 5 },
      atr: { type: 'atr', enabled: true, minATRPercent: 1, maxATRPercent: 15 },
      exchange: { type: 'exchange', enabled: true, includeExchanges: ['NYSE', 'NASDAQ', 'AMEX'], excludeETFs: true, excludeADRs: true, excludeWarrants: true },
    } as ScreenerFilters,
  },

  // Early-stage bullish trend (5-15 day swings)
  earlyBullishTrend: {
    name: 'Early-Stage Bullish Trend',
    description: 'Stocks in early uptrend, not extended, good for swing trades',
    filters: {
      price: { type: 'price', enabled: true, minPrice: 5, maxPrice: 500 },
      dollarVolume: { type: 'dollarVolume', enabled: true, minDollarVolume: 5_000_000 },
      priceToMA: [
        { type: 'priceToMA', enabled: true, maType: 'ema', maPeriod: 20, position: 'above', minDistancePercent: 0, maxDistancePercent: 10 },
        { type: 'priceToMA', enabled: true, maType: 'ema', maPeriod: 50, position: 'above' },
      ],
      adx: { type: 'adx', enabled: true, minADX: 20, maxADX: 30 },
      directional: { type: 'directional', enabled: true, plusDIAboveMinusDI: true },
      rsi: { type: 'rsi', enabled: true, minRSI: 50, maxRSI: 70 }, // Relaxed from 55-65 to 50-70
      macd: { type: 'macd', enabled: true, macdAboveZero: true },
      volume: { type: 'volume', enabled: true, minRelativeVolume: 0.8 }, // Relaxed to 0.8× (allows slightly below average)
      cmf: { type: 'cmf', enabled: true, minCMF: -0.15 }, // Relaxed from -0.1 to -0.15
      atr: { type: 'atr', enabled: true, minATRPercent: 2, maxATRPercent: 8 },
      exchange: { type: 'exchange', enabled: true, includeExchanges: ['NYSE', 'NASDAQ', 'AMEX'], excludeETFs: true, excludeADRs: true },
    } as ScreenerFilters,
  },
  
  // Oversold bounce candidates
  oversoldBounce: {
    name: 'Oversold Bounce',
    description: 'Stocks that are oversold and may bounce',
    filters: {
      price: { type: 'price', enabled: true, minPrice: 5 },
      dollarVolume: { type: 'dollarVolume', enabled: true, minDollarVolume: 10_000_000 },
      priceToMA: [
        { type: 'priceToMA', enabled: true, maType: 'ema', maPeriod: 50, position: 'above' }, // Still in uptrend
      ],
      rsi: { type: 'rsi', enabled: true, minRSI: 25, maxRSI: 40 },
      stochastic: { type: 'stochastic', enabled: true, maxK: 30 },
      exchange: { type: 'exchange', enabled: true, includeExchanges: ['NYSE', 'NASDAQ'], excludeETFs: true },
    } as ScreenerFilters,
  },
  
  // Breakout candidates
  breakoutSetup: {
    name: 'Breakout Setup',
    description: 'Stocks consolidating near highs with squeeze',
    filters: {
      price: { type: 'price', enabled: true, minPrice: 10 },
      dollarVolume: { type: 'dollarVolume', enabled: true, minDollarVolume: 20_000_000 },
      pricePosition: { type: 'pricePosition', enabled: true, min52WeekPercent: 80 },
      bollinger: { type: 'bollinger', enabled: true, maxBandwidth: 15, squeeze: true },
      ttmSqueeze: { type: 'ttmSqueeze', enabled: true, state: 'on', minSqueezeBars: 5 },
      adx: { type: 'adx', enabled: true, minADX: 15, maxADX: 25 },
      exchange: { type: 'exchange', enabled: true, includeExchanges: ['NYSE', 'NASDAQ'], excludeETFs: true },
    } as ScreenerFilters,
  },
  
  // High volume movers
  highVolumeMovers: {
    name: 'High Volume Movers',
    description: 'Stocks with unusual volume activity',
    filters: {
      price: { type: 'price', enabled: true, minPrice: 5 },
      volume: { type: 'volume', enabled: true, minRelativeVolume: 3.0 },
      priceChange: { type: 'priceChange', enabled: true, minChangePercent: 3 },
      exchange: { type: 'exchange', enabled: true, includeExchanges: ['NYSE', 'NASDAQ', 'AMEX'], excludeETFs: true },
    } as ScreenerFilters,
  },
  
  // Strong trend
  strongTrend: {
    name: 'Strong Trend',
    description: 'Stocks in strong established trends',
    filters: {
      price: { type: 'price', enabled: true, minPrice: 10 },
      dollarVolume: { type: 'dollarVolume', enabled: true, minDollarVolume: 10_000_000 },
      maAlignment: { type: 'maAlignment', enabled: true, alignment: 'bullish', checkMAs: [9, 20, 50, 200], maType: 'ema' },
      adx: { type: 'adx', enabled: true, minADX: 30 },
      directional: { type: 'directional', enabled: true, plusDIAboveMinusDI: true, minDIDifference: 10 },
      rsi: { type: 'rsi', enabled: true, minRSI: 50, maxRSI: 75 },
      exchange: { type: 'exchange', enabled: true, includeExchanges: ['NYSE', 'NASDAQ'], excludeETFs: true },
    } as ScreenerFilters,
  },
};

export type FilterPresetKey = keyof typeof FILTER_PRESETS;

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a filter preset by key
 */
export function getFilterPreset(key: FilterPresetKey): {
  name: string;
  description: string;
  filters: ScreenerFilters;
} {
  return FILTER_PRESETS[key];
}

/**
 * Create an empty filter config
 */
export function createEmptyFilters(): ScreenerFilters {
  return {};
}

/**
 * Merge filters with a preset
 */
export function mergeFilters(
  base: ScreenerFilters,
  overrides: Partial<ScreenerFilters>
): ScreenerFilters {
  return { ...base, ...overrides };
}

/**
 * Get all enabled filters from a config
 */
export function getEnabledFilters(filters: ScreenerFilters): string[] {
  const enabled: string[] = [];
  
  for (const [key, filter] of Object.entries(filters)) {
    if (Array.isArray(filter)) {
      filter.forEach((f, i) => {
        if (f?.enabled) enabled.push(`${key}[${i}]`);
      });
    } else if (filter?.enabled) {
      enabled.push(key);
    }
  }
  
  return enabled;
}

/**
 * Count enabled filters
 */
export function countEnabledFilters(filters: ScreenerFilters): number {
  return getEnabledFilters(filters).length;
}

