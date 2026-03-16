/**
 * Comprehensive Stock Screener Engine
 * 
 * Evaluates stocks against flexible filter configurations
 * Works independently without requiring strategy definitions
 */

import type { OHLCV } from '../types/market';
import type { 
  ScreenerFilters,
  PriceFilter,
  PriceChangeFilter,
  PricePositionFilter,
  PriceToMAFilter,
  MACrossoverFilter,
  MAAlignmentFilter,
  ADXFilter,
  DirectionalFilter,
  RSIFilter,
  StochasticFilter,
  MACDFilter,
  VolumeFilter,
  DollarVolumeFilter,
  OBVFilter,
  CMFFilter,
  ATRFilter,
  BollingerFilter,
  HistoricalVolatilityFilter,
  TTMSqueezeFilter,
  MarketCapFilter,
  ExchangeFilter,
  TrendType,
} from './screener-filters';

// ═══════════════════════════════════════════════════════════════════════════
// SCREENER RESULT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FilterResult {
  name: string;
  passed: boolean;
  value: number | string | boolean;
  threshold?: string;
  reason?: string;
}

export interface ScreenerResult {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  
  // Filter results
  passed: boolean;
  filterResults: FilterResult[];
  passedCount: number;
  totalFilters: number;
  matchScore: number; // 0-100
  
  // Key indicator values (for display)
  indicators: {
    // EMAs
    ema9?: number;
    ema20?: number;
    ema50?: number;
    ema200?: number;
    ema20Distance?: number;
    ema50Distance?: number;
    
    // Trend
    adx?: number;
    plusDI?: number;
    minusDI?: number;
    
    // Momentum
    rsi?: number;
    stochK?: number;
    stochD?: number;
    macdLine?: number;
    macdSignal?: number;
    macdHistogram?: number;
    
    // Volume
    relativeVolume?: number;
    dollarVolume?: number;
    obv?: number;
    obvTrend?: string;
    cmf?: number;
    
    // Volatility
    atr?: number;
    atrPercent?: number;
    bollingerB?: number;
    bollingerBandwidth?: number;
    historicalVolatility?: number;
    
    // Squeeze
    ttmSqueezeState?: string;
    ttmSqueezeBars?: number;
    ttmMomentum?: number;
  };
  
  // Metadata
  marketCap?: number;
  sector?: string;
  exchange?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// INDICATOR CALCULATION IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

import { 
  calculateEMA, 
  calculateSMA,
  calculateRSI, 
  calculateATR, 
  calculateMACD, 
  calculateADX,
  calculateOBV,
  calculateCMF,
  calculateStochastic,
  calculateBollingerBands,
} from '../technical-analysis/advanced-indicators';

// ═══════════════════════════════════════════════════════════════════════════
// SCREENER ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ScreenerEngine {
  private filters: ScreenerFilters;
  
  constructor(filters: ScreenerFilters) {
    this.filters = filters;
  }
  
  /**
   * Update filters
   */
  setFilters(filters: ScreenerFilters): void {
    this.filters = filters;
  }
  
  /**
   * Evaluate a single stock against all enabled filters
   */
  evaluate(
    ticker: string,
    name: string,
    bars: OHLCV[],
    metadata?: {
      marketCap?: number;
      sector?: string;
      exchange?: string;
      avgDollarVolume?: number;
    }
  ): ScreenerResult | null {
    if (bars.length < 50) {
      return null; // Insufficient data
    }
    
    const currentBar = bars[bars.length - 1];
    const prevBar = bars[bars.length - 2];
    const price = currentBar.close;
    const change = price - prevBar.close;
    const changePercent = (change / prevBar.close) * 100;
    const volume = currentBar.volume;
    
    // Calculate all indicators
    const indicators = this.calculateIndicators(bars);
    
    // Evaluate each filter
    const filterResults: FilterResult[] = [];
    
    // Price filters
    if (this.filters.price?.enabled) {
      filterResults.push(this.evaluatePriceFilter(price, this.filters.price));
    }
    
    if (this.filters.priceChange?.enabled) {
      filterResults.push(this.evaluatePriceChangeFilter(bars, this.filters.priceChange));
    }
    
    if (this.filters.pricePosition?.enabled) {
      filterResults.push(this.evaluatePricePositionFilter(bars, this.filters.pricePosition));
    }
    
    // MA filters
    if (this.filters.priceToMA) {
      for (const maFilter of this.filters.priceToMA) {
        if (maFilter.enabled) {
          filterResults.push(this.evaluatePriceToMAFilter(bars, maFilter, indicators));
        }
      }
    }
    
    if (this.filters.maCrossover) {
      for (const crossFilter of this.filters.maCrossover) {
        if (crossFilter.enabled) {
          filterResults.push(this.evaluateMACrossoverFilter(bars, crossFilter));
        }
      }
    }
    
    if (this.filters.maAlignment?.enabled) {
      filterResults.push(this.evaluateMAAlignmentFilter(bars, this.filters.maAlignment, indicators));
    }
    
    // ADX filters
    if (this.filters.adx?.enabled) {
      filterResults.push(this.evaluateADXFilter(indicators, this.filters.adx));
    }
    
    if (this.filters.directional?.enabled) {
      filterResults.push(this.evaluateDirectionalFilter(indicators, this.filters.directional));
    }
    
    // Momentum filters
    if (this.filters.rsi?.enabled) {
      filterResults.push(this.evaluateRSIFilter(indicators, this.filters.rsi));
    }
    
    if (this.filters.stochastic?.enabled) {
      filterResults.push(this.evaluateStochasticFilter(indicators, this.filters.stochastic));
    }
    
    if (this.filters.macd?.enabled) {
      filterResults.push(this.evaluateMACDFilter(indicators, this.filters.macd));
    }
    
    // Volume filters
    if (this.filters.volume?.enabled) {
      filterResults.push(this.evaluateVolumeFilter(bars, this.filters.volume, indicators));
    }
    
    if (this.filters.dollarVolume?.enabled) {
      filterResults.push(this.evaluateDollarVolumeFilter(
        metadata?.avgDollarVolume || indicators.dollarVolume,
        this.filters.dollarVolume
      ));
    }
    
    if (this.filters.obv?.enabled) {
      filterResults.push(this.evaluateOBVFilter(indicators, this.filters.obv));
    }
    
    if (this.filters.cmf?.enabled) {
      filterResults.push(this.evaluateCMFFilter(indicators, this.filters.cmf));
    }
    
    // Volatility filters
    if (this.filters.atr?.enabled) {
      filterResults.push(this.evaluateATRFilter(indicators, this.filters.atr));
    }
    
    if (this.filters.bollinger?.enabled) {
      filterResults.push(this.evaluateBollingerFilter(indicators, this.filters.bollinger));
    }
    
    if (this.filters.historicalVolatility?.enabled) {
      filterResults.push(this.evaluateHistoricalVolatilityFilter(indicators, this.filters.historicalVolatility));
    }
    
    if (this.filters.ttmSqueeze?.enabled) {
      filterResults.push(this.evaluateTTMSqueezeFilter(indicators, this.filters.ttmSqueeze));
    }
    
    // Fundamental filters
    if (this.filters.marketCap?.enabled && metadata?.marketCap) {
      filterResults.push(this.evaluateMarketCapFilter(metadata.marketCap, this.filters.marketCap));
    }
    
    if (this.filters.exchange?.enabled) {
      // Evaluate exchange filter (it will handle generic/unknown exchanges gracefully)
      filterResults.push(this.evaluateExchangeFilter(
        ticker, 
        metadata?.exchange || 'US', 
        this.filters.exchange
      ));
    }
    
    // Calculate results
    const passedFilters = filterResults.filter(r => r.passed);
    const passed = filterResults.length === 0 || passedFilters.length === filterResults.length;
    const matchScore = filterResults.length > 0 
      ? Math.round((passedFilters.length / filterResults.length) * 100)
      : 100;
    
    return {
      ticker,
      name,
      price,
      change,
      changePercent,
      volume,
      passed,
      filterResults,
      passedCount: passedFilters.length,
      totalFilters: filterResults.length,
      matchScore,
      indicators: {
        ema9: indicators.ema9,
        ema20: indicators.ema20,
        ema50: indicators.ema50,
        ema200: indicators.ema200,
        ema20Distance: indicators.ema20Distance,
        ema50Distance: indicators.ema50Distance,
        adx: indicators.adx,
        plusDI: indicators.plusDI,
        minusDI: indicators.minusDI,
        rsi: indicators.rsi,
        stochK: indicators.stochK,
        stochD: indicators.stochD,
        macdLine: indicators.macdLine,
        macdSignal: indicators.macdSignal,
        macdHistogram: indicators.macdHistogram,
        relativeVolume: indicators.relativeVolume,
        dollarVolume: indicators.dollarVolume,
        obv: indicators.obv,
        obvTrend: indicators.obvTrend,
        cmf: indicators.cmf,
        atr: indicators.atr,
        atrPercent: indicators.atrPercent,
        bollingerB: indicators.bollingerB,
        bollingerBandwidth: indicators.bollingerBandwidth,
        historicalVolatility: indicators.historicalVolatility,
        ttmSqueezeState: indicators.ttmSqueezeState,
        ttmSqueezeBars: indicators.ttmSqueezeBars,
        ttmMomentum: indicators.ttmMomentum,
      },
      marketCap: metadata?.marketCap,
      sector: metadata?.sector,
      exchange: metadata?.exchange,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INDICATOR CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  private calculateIndicators(bars: OHLCV[]): Record<string, any> {
    const closes = bars.map(b => b.close);
    const volumes = bars.map(b => b.volume);
    const price = closes[closes.length - 1];
    
    // EMAs
    const ema9Array = calculateEMA(closes, 9);
    const ema20Array = calculateEMA(closes, 20);
    const ema50Array = calculateEMA(closes, 50);
    const ema200Array = calculateEMA(closes, 200);
    
    const ema9 = ema9Array[ema9Array.length - 1] || price;
    const ema20 = ema20Array[ema20Array.length - 1] || price;
    const ema50 = ema50Array[ema50Array.length - 1] || price;
    const ema200 = ema200Array[ema200Array.length - 1] || price;
    
    // EMA distances
    const ema20Distance = ((price - ema20) / ema20) * 100;
    const ema50Distance = ((price - ema50) / ema50) * 100;
    
    // ADX
    const adxData = calculateADX(bars, 14);
    const adx = adxData.adx[adxData.adx.length - 1] || 0;
    const plusDI = adxData.plusDI[adxData.plusDI.length - 1] || 0;
    const minusDI = adxData.minusDI[adxData.minusDI.length - 1] || 0;
    
    // RSI
    const rsiArray = calculateRSI(closes, 14);
    const rsi = rsiArray[rsiArray.length - 1] || 50;
    
    // Stochastic
    const stochData = calculateStochastic(bars, 14, 3, 3);
    const stochK = stochData.k[stochData.k.length - 1] || 50;
    const stochD = stochData.d[stochData.d.length - 1] || 50;
    
    // MACD
    const macdData = calculateMACD(closes, 12, 26, 9);
    const macdLine = macdData.macd[macdData.macd.length - 1] || 0;
    const macdSignal = macdData.signal[macdData.signal.length - 1] || 0;
    const macdHistogram = macdData.histogram[macdData.histogram.length - 1] || 0;
    
    // ATR
    const atrArray = calculateATR(bars, 14);
    const atr = atrArray[atrArray.length - 1] || 0;
    const atrPercent = (atr / price) * 100;
    
    // Volume
    const avgVolume20 = this.calculateAverage(volumes.slice(-20));
    const currentVolume = volumes[volumes.length - 1];
    const relativeVolume = avgVolume20 > 0 ? currentVolume / avgVolume20 : 1;
    const dollarVolume = avgVolume20 * price;
    
    // OBV
    const obvArray = calculateOBV(bars);
    const obv = obvArray[obvArray.length - 1] || 0;
    const obvMA = this.calculateAverage(obvArray.slice(-20));
    const obvTrend = obv > obvMA * 1.02 ? 'rising' : obv < obvMA * 0.98 ? 'falling' : 'flat';
    
    // CMF
    const cmfArray = calculateCMF(bars, 20);
    const cmf = cmfArray[cmfArray.length - 1] || 0;
    
    // Bollinger Bands
    const bbData = calculateBollingerBands(closes, 20, 2);
    const bollingerB = bbData.percentB[bbData.percentB.length - 1] || 50;
    const bollingerBandwidth = bbData.bandwidth[bbData.bandwidth.length - 1] || 0;
    
    // Historical Volatility
    const historicalVolatility = this.calculateHistoricalVolatility(closes, 20);
    
    // TTM Squeeze (simplified)
    const { squeezeState, squeezeBars, momentum } = this.calculateTTMSqueeze(bars, bbData);
    
    return {
      ema9, ema20, ema50, ema200,
      ema9Array, ema20Array, ema50Array, ema200Array,
      ema20Distance, ema50Distance,
      adx, plusDI, minusDI, adxData,
      rsi, rsiArray,
      stochK, stochD, stochData,
      macdLine, macdSignal, macdHistogram, macdData,
      atr, atrPercent,
      relativeVolume, dollarVolume,
      obv, obvTrend, obvArray,
      cmf,
      bollingerB, bollingerBandwidth, bbData,
      historicalVolatility,
      ttmSqueezeState: squeezeState,
      ttmSqueezeBars: squeezeBars,
      ttmMomentum: momentum,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FILTER EVALUATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════
  
  private evaluatePriceFilter(price: number, filter: PriceFilter): FilterResult {
    const minOk = filter.minPrice === undefined || price >= filter.minPrice;
    const maxOk = filter.maxPrice === undefined || price <= filter.maxPrice;
    
    return {
      name: 'Price',
      passed: minOk && maxOk,
      value: price,
      threshold: `$${filter.minPrice || 0} - $${filter.maxPrice || '∞'}`,
      reason: !minOk ? `Below min $${filter.minPrice}` : !maxOk ? `Above max $${filter.maxPrice}` : undefined,
    };
  }
  
  private evaluatePriceChangeFilter(bars: OHLCV[], filter: PriceChangeFilter): FilterResult {
    const period = filter.period || 1;
    const currentClose = bars[bars.length - 1].close;
    const pastClose = bars[bars.length - 1 - period]?.close || currentClose;
    const changePercent = ((currentClose - pastClose) / pastClose) * 100;
    
    const minOk = filter.minChangePercent === undefined || changePercent >= filter.minChangePercent;
    const maxOk = filter.maxChangePercent === undefined || changePercent <= filter.maxChangePercent;
    
    return {
      name: `${period}D Change`,
      passed: minOk && maxOk,
      value: Number(changePercent.toFixed(2)),
      threshold: `${filter.minChangePercent || '-∞'}% to ${filter.maxChangePercent || '+∞'}%`,
    };
  }
  
  private evaluatePricePositionFilter(bars: OHLCV[], filter: PricePositionFilter): FilterResult {
    const price = bars[bars.length - 1].close;
    const high52Week = Math.max(...bars.slice(-252).map(b => b.high));
    const low52Week = Math.min(...bars.slice(-252).map(b => b.low));
    const percentOf52Week = ((price - low52Week) / (high52Week - low52Week)) * 100;
    
    const minOk = filter.min52WeekPercent === undefined || percentOf52Week >= filter.min52WeekPercent;
    const maxOk = filter.max52WeekPercent === undefined || percentOf52Week <= filter.max52WeekPercent;
    
    // Check new highs/lows
    let newHighOk = true;
    let newLowOk = true;
    
    if (filter.newHighDays) {
      const lookbackHigh = Math.max(...bars.slice(-filter.newHighDays, -1).map(b => b.high));
      newHighOk = price > lookbackHigh;
    }
    
    if (filter.newLowDays) {
      const lookbackLow = Math.min(...bars.slice(-filter.newLowDays, -1).map(b => b.low));
      newLowOk = price < lookbackLow;
    }
    
    return {
      name: 'Price Position',
      passed: minOk && maxOk && newHighOk && newLowOk,
      value: Number(percentOf52Week.toFixed(1)),
      threshold: `${filter.min52WeekPercent || 0}% - ${filter.max52WeekPercent || 100}% of 52W range`,
    };
  }
  
  private evaluatePriceToMAFilter(bars: OHLCV[], filter: PriceToMAFilter, indicators: any): FilterResult {
    const price = bars[bars.length - 1].close;
    const closes = bars.map(b => b.close);
    
    // Get the MA value
    let maValue: number;
    if (filter.maType === 'ema') {
      const maArray = calculateEMA(closes, filter.maPeriod);
      maValue = maArray[maArray.length - 1] || price;
    } else {
      const maArray = calculateSMA(closes, filter.maPeriod);
      maValue = maArray[maArray.length - 1] || price;
    }
    
    const distance = ((price - maValue) / maValue) * 100;
    const isAbove = price >= maValue; // Allow exactly at MA
    
    // Check position
    let positionOk = true;
    if (filter.position === 'above') positionOk = isAbove;
    if (filter.position === 'below') positionOk = !isAbove;
    
    // Check distance constraints
    let distanceOk = true;
    
    if (filter.position === 'above') {
      // For 'above', distance must be >= minDistancePercent and <= maxDistancePercent
      // If minDistancePercent is 0, allow distance >= 0 (at or above MA)
      const minDist = filter.minDistancePercent || 0;
      const maxDist = filter.maxDistancePercent ?? Infinity;
      distanceOk = distance >= minDist && distance <= maxDist;
    } else if (filter.position === 'below') {
      // For 'below', use absolute distance
      const absDistance = Math.abs(distance);
      const minDist = filter.minDistancePercent || 0;
      const maxDist = filter.maxDistancePercent ?? Infinity;
      distanceOk = absDistance >= minDist && absDistance <= maxDist;
    } else {
      // 'any' position - use absolute distance
      const absDistance = Math.abs(distance);
      const minDist = filter.minDistancePercent || 0;
      const maxDist = filter.maxDistancePercent ?? Infinity;
      distanceOk = absDistance >= minDist && absDistance <= maxDist;
    }
    
    return {
      name: `Price vs ${filter.maType.toUpperCase()}${filter.maPeriod}`,
      passed: positionOk && distanceOk,
      value: Number(distance.toFixed(2)),
      threshold: `${filter.position} by ${filter.minDistancePercent || 0}% - ${filter.maxDistancePercent || '∞'}%`,
    };
  }
  
  private evaluateMACrossoverFilter(bars: OHLCV[], filter: MACrossoverFilter): FilterResult {
    const closes = bars.map(b => b.close);
    
    // Calculate MAs
    const fastMA = filter.fastMA.type === 'ema' 
      ? calculateEMA(closes, filter.fastMA.period)
      : calculateSMA(closes, filter.fastMA.period);
    
    const slowMA = filter.slowMA.type === 'ema'
      ? calculateEMA(closes, filter.slowMA.period)
      : calculateSMA(closes, filter.slowMA.period);
    
    // Check for crossover within lookback
    const lookback = filter.withinBars || 5;
    let crossedAbove = false;
    let crossedBelow = false;
    
    for (let i = fastMA.length - lookback; i < fastMA.length; i++) {
      if (i > 0) {
        const prevFast = fastMA[i - 1];
        const prevSlow = slowMA[i - 1];
        const currFast = fastMA[i];
        const currSlow = slowMA[i];
        
        if (prevFast <= prevSlow && currFast > currSlow) crossedAbove = true;
        if (prevFast >= prevSlow && currFast < currSlow) crossedBelow = true;
      }
    }
    
    let passed = false;
    if (filter.crossover === 'above') passed = crossedAbove;
    else if (filter.crossover === 'below') passed = crossedBelow;
    else if (filter.crossover === 'any') passed = crossedAbove || crossedBelow;
    
    return {
      name: `MA Crossover`,
      passed,
      value: crossedAbove ? 'Above' : crossedBelow ? 'Below' : 'None',
      threshold: `${filter.crossover} within ${lookback} bars`,
    };
  }
  
  private evaluateMAAlignmentFilter(bars: OHLCV[], filter: MAAlignmentFilter, indicators: any): FilterResult {
    const closes = bars.map(b => b.close);
    const maValues: number[] = [];
    
    for (const period of filter.checkMAs) {
      const maArray = filter.maType === 'ema' 
        ? calculateEMA(closes, period)
        : calculateSMA(closes, period);
      maValues.push(maArray[maArray.length - 1] || 0);
    }
    
    // Check alignment
    let isBullish = true;
    let isBearish = true;
    
    for (let i = 0; i < maValues.length - 1; i++) {
      if (maValues[i] <= maValues[i + 1]) isBullish = false;
      if (maValues[i] >= maValues[i + 1]) isBearish = false;
    }
    
    let passed = false;
    let alignment = 'mixed';
    
    if (isBullish) alignment = 'bullish';
    else if (isBearish) alignment = 'bearish';
    
    if (filter.alignment === 'bullish') passed = isBullish;
    else if (filter.alignment === 'bearish') passed = isBearish;
    else if (filter.alignment === 'mixed') passed = !isBullish && !isBearish;
    else if (filter.alignment === 'any') passed = true;
    
    return {
      name: 'MA Alignment',
      passed,
      value: alignment,
      threshold: filter.alignment,
    };
  }
  
  private evaluateADXFilter(indicators: any, filter: ADXFilter): FilterResult {
    const adx = indicators.adx;
    
    const minOk = filter.minADX === undefined || adx >= filter.minADX;
    const maxOk = filter.maxADX === undefined || adx <= filter.maxADX;
    
    // Check ADX trend if specified
    let trendOk = true;
    if (filter.adxTrend && filter.adxTrend !== 'any') {
      const adxArray = indicators.adxData?.adx || [];
      const trend = this.detectTrend(adxArray.slice(-10));
      trendOk = trend === filter.adxTrend;
    }
    
    return {
      name: 'ADX',
      passed: minOk && maxOk && trendOk,
      value: Number(adx.toFixed(1)),
      threshold: `${filter.minADX || 0} - ${filter.maxADX || 100}`,
    };
  }
  
  private evaluateDirectionalFilter(indicators: any, filter: DirectionalFilter): FilterResult {
    const plusDI = indicators.plusDI;
    const minusDI = indicators.minusDI;
    
    let passed = true;
    const reasons: string[] = [];
    
    if (filter.plusDIAboveMinusDI && plusDI <= minusDI) {
      passed = false;
      reasons.push('+DI not > -DI');
    }
    
    if (filter.minusDIAbovePlusDI && minusDI <= plusDI) {
      passed = false;
      reasons.push('-DI not > +DI');
    }
    
    if (filter.minDIDifference !== undefined) {
      const diff = Math.abs(plusDI - minusDI);
      if (diff < filter.minDIDifference) {
        passed = false;
        reasons.push(`DI diff ${diff.toFixed(1)} < ${filter.minDIDifference}`);
      }
    }
    
    if (filter.minPlusDI !== undefined && plusDI < filter.minPlusDI) {
      passed = false;
      reasons.push(`+DI < ${filter.minPlusDI}`);
    }
    
    if (filter.minMinusDI !== undefined && minusDI < filter.minMinusDI) {
      passed = false;
      reasons.push(`-DI < ${filter.minMinusDI}`);
    }
    
    return {
      name: 'Directional',
      passed,
      value: `+DI: ${plusDI.toFixed(1)}, -DI: ${minusDI.toFixed(1)}`,
      reason: reasons.length > 0 ? reasons.join(', ') : undefined,
    };
  }
  
  private evaluateRSIFilter(indicators: any, filter: RSIFilter): FilterResult {
    const rsi = indicators.rsi;
    
    let minRSI = filter.minRSI;
    let maxRSI = filter.maxRSI;
    
    // Apply zone presets
    if (filter.zone) {
      switch (filter.zone) {
        case 'oversold': minRSI = 0; maxRSI = 30; break;
        case 'overbought': minRSI = 70; maxRSI = 100; break;
        case 'neutral': minRSI = 40; maxRSI = 60; break;
        case 'bullish': minRSI = 55; maxRSI = 65; break;
        case 'bearish': minRSI = 35; maxRSI = 45; break;
      }
    }
    
    const minOk = minRSI === undefined || rsi >= minRSI;
    const maxOk = maxRSI === undefined || rsi <= maxRSI;
    
    return {
      name: 'RSI',
      passed: minOk && maxOk,
      value: Number(rsi.toFixed(1)),
      threshold: `${minRSI || 0} - ${maxRSI || 100}`,
    };
  }
  
  private evaluateStochasticFilter(indicators: any, filter: StochasticFilter): FilterResult {
    const stochK = indicators.stochK;
    const stochD = indicators.stochD;
    
    let minK = filter.minK;
    let maxK = filter.maxK;
    
    // Apply zone presets
    if (filter.zone) {
      switch (filter.zone) {
        case 'oversold': minK = 0; maxK = 20; break;
        case 'overbought': minK = 80; maxK = 100; break;
        case 'neutral': minK = 30; maxK = 70; break;
      }
    }
    
    const minKOk = minK === undefined || stochK >= minK;
    const maxKOk = maxK === undefined || stochK <= maxK;
    const minDOk = filter.minD === undefined || stochD >= filter.minD;
    const maxDOk = filter.maxD === undefined || stochD <= filter.maxD;
    
    let crossOk = true;
    if (filter.crossover === 'kAboveD') crossOk = stochK > stochD;
    if (filter.crossover === 'kBelowD') crossOk = stochK < stochD;
    
    return {
      name: 'Stochastic',
      passed: minKOk && maxKOk && minDOk && maxDOk && crossOk,
      value: `%K: ${stochK.toFixed(1)}, %D: ${stochD.toFixed(1)}`,
      threshold: `K: ${minK || 0}-${maxK || 100}`,
    };
  }
  
  private evaluateMACDFilter(indicators: any, filter: MACDFilter): FilterResult {
    const { macdLine, macdSignal, macdHistogram, macdData } = indicators;
    
    let passed = true;
    const reasons: string[] = [];
    
    // Check for recent bullish cross as alternative to macdAboveZero
    let hasRecentBullishCross = false;
    if (macdData?.histogram) {
      const hist = macdData.histogram;
      const lookback = 5;
      for (let i = hist.length - lookback; i < hist.length; i++) {
        if (i > 0 && hist[i - 1] <= 0 && hist[i] > 0) {
          hasRecentBullishCross = true;
          break;
        }
      }
    }
    
    if (filter.macdAboveZero) {
      // Allow if MACD > 0 OR recent bullish cross
      if (macdLine <= 0 && !hasRecentBullishCross) {
        passed = false;
        reasons.push('MACD not > 0 and no recent bullish cross');
      }
    }
    
    if (filter.macdBelowZero && macdLine >= 0) {
      passed = false;
      reasons.push('MACD not < 0');
    }
    
    if (filter.histogramPositive && macdHistogram <= 0) {
      passed = false;
      reasons.push('Histogram not > 0');
    }
    
    if (filter.histogramNegative && macdHistogram >= 0) {
      passed = false;
      reasons.push('Histogram not < 0');
    }
    
    // Check crossover
    if (filter.crossover && filter.crossover !== 'any') {
      const lookback = filter.crossoverWithinBars || 5;
      const hist = macdData.histogram || [];
      let foundCross = false;
      
      for (let i = hist.length - lookback; i < hist.length; i++) {
        if (i > 0) {
          if (filter.crossover === 'bullish' && hist[i - 1] <= 0 && hist[i] > 0) foundCross = true;
          if (filter.crossover === 'bearish' && hist[i - 1] >= 0 && hist[i] < 0) foundCross = true;
        }
      }
      
      if (!foundCross) {
        passed = false;
        reasons.push(`No ${filter.crossover} cross within ${lookback} bars`);
      }
    }
    
    return {
      name: 'MACD',
      passed,
      value: `Line: ${macdLine.toFixed(3)}, Hist: ${macdHistogram.toFixed(3)}`,
      reason: reasons.length > 0 ? reasons.join(', ') : undefined,
    };
  }
  
  private evaluateVolumeFilter(bars: OHLCV[], filter: VolumeFilter, indicators: any): FilterResult {
    const currentVolume = bars[bars.length - 1].volume;
    const relativeVolume = indicators.relativeVolume;
    
    let passed = true;
    const reasons: string[] = [];
    
    if (filter.minVolume !== undefined && currentVolume < filter.minVolume) {
      passed = false;
      reasons.push(`Volume ${currentVolume.toLocaleString()} < ${filter.minVolume.toLocaleString()}`);
    }
    
    if (filter.maxVolume !== undefined && currentVolume > filter.maxVolume) {
      passed = false;
      reasons.push(`Volume > ${filter.maxVolume.toLocaleString()}`);
    }
    
    if (filter.minRelativeVolume !== undefined && relativeVolume < filter.minRelativeVolume) {
      passed = false;
      reasons.push(`Rel vol ${relativeVolume.toFixed(2)}× < ${filter.minRelativeVolume}×`);
    }
    
    if (filter.maxRelativeVolume !== undefined && relativeVolume > filter.maxRelativeVolume) {
      passed = false;
      reasons.push(`Rel vol ${relativeVolume.toFixed(2)}× > ${filter.maxRelativeVolume}×`);
    }
    
    return {
      name: 'Volume',
      passed,
      value: `${relativeVolume.toFixed(2)}× avg`,
      threshold: filter.minRelativeVolume ? `≥${filter.minRelativeVolume}× avg` : undefined,
      reason: reasons.length > 0 ? reasons.join(', ') : undefined,
    };
  }
  
  private evaluateDollarVolumeFilter(dollarVolume: number, filter: DollarVolumeFilter): FilterResult {
    const minOk = filter.minDollarVolume === undefined || dollarVolume >= filter.minDollarVolume;
    const maxOk = filter.maxDollarVolume === undefined || dollarVolume <= filter.maxDollarVolume;
    
    return {
      name: 'Dollar Volume',
      passed: minOk && maxOk,
      value: this.formatDollarVolume(dollarVolume),
      threshold: filter.minDollarVolume ? `≥${this.formatDollarVolume(filter.minDollarVolume)}` : undefined,
    };
  }
  
  private evaluateOBVFilter(indicators: any, filter: OBVFilter): FilterResult {
    const obvTrend = indicators.obvTrend;
    
    let passed = true;
    
    if (filter.trend && filter.trend !== 'any' && obvTrend !== filter.trend) {
      passed = false;
    }
    
    if (filter.aboveMA) {
      const obv = indicators.obv;
      const obvArray = indicators.obvArray || [];
      const obvMA = this.calculateAverage(obvArray.slice(-(filter.maPeriod || 20)));
      if (obv <= obvMA) {
        passed = false;
      }
    }
    
    return {
      name: 'OBV',
      passed,
      value: obvTrend,
      threshold: filter.trend || 'any',
    };
  }
  
  private evaluateCMFFilter(indicators: any, filter: CMFFilter): FilterResult {
    const cmf = indicators.cmf;
    
    let minCMF = filter.minCMF;
    let maxCMF = filter.maxCMF;
    
    // Apply zone presets
    if (filter.zone) {
      switch (filter.zone) {
        case 'accumulation': minCMF = 0.1; maxCMF = 1; break;
        case 'distribution': minCMF = -1; maxCMF = -0.1; break;
        case 'neutral': minCMF = -0.1; maxCMF = 0.1; break;
      }
    }
    
    const minOk = minCMF === undefined || cmf >= minCMF;
    const maxOk = maxCMF === undefined || cmf <= maxCMF;
    
    return {
      name: 'CMF',
      passed: minOk && maxOk,
      value: Number(cmf.toFixed(3)),
      threshold: `${minCMF ?? '-1'} to ${maxCMF ?? '1'}`,
    };
  }
  
  private evaluateATRFilter(indicators: any, filter: ATRFilter): FilterResult {
    const atrPercent = indicators.atrPercent;
    
    const minOk = filter.minATRPercent === undefined || atrPercent >= filter.minATRPercent;
    const maxOk = filter.maxATRPercent === undefined || atrPercent <= filter.maxATRPercent;
    
    return {
      name: 'ATR%',
      passed: minOk && maxOk,
      value: Number(atrPercent.toFixed(2)),
      threshold: `${filter.minATRPercent || 0}% - ${filter.maxATRPercent || '∞'}%`,
    };
  }
  
  private evaluateBollingerFilter(indicators: any, filter: BollingerFilter): FilterResult {
    const { bollingerB, bollingerBandwidth } = indicators;
    
    let passed = true;
    const reasons: string[] = [];
    
    if (filter.minPercentB !== undefined && bollingerB < filter.minPercentB) {
      passed = false;
      reasons.push(`%B ${bollingerB.toFixed(1)}% < ${filter.minPercentB}%`);
    }
    
    if (filter.maxPercentB !== undefined && bollingerB > filter.maxPercentB) {
      passed = false;
      reasons.push(`%B ${bollingerB.toFixed(1)}% > ${filter.maxPercentB}%`);
    }
    
    if (filter.minBandwidth !== undefined && bollingerBandwidth < filter.minBandwidth) {
      passed = false;
      reasons.push(`Bandwidth ${bollingerBandwidth.toFixed(1)}% < ${filter.minBandwidth}%`);
    }
    
    if (filter.maxBandwidth !== undefined && bollingerBandwidth > filter.maxBandwidth) {
      passed = false;
      reasons.push(`Bandwidth ${bollingerBandwidth.toFixed(1)}% > ${filter.maxBandwidth}%`);
    }
    
    if (filter.squeeze && bollingerBandwidth > 10) {
      passed = false;
      reasons.push('Not in squeeze');
    }
    
    return {
      name: 'Bollinger',
      passed,
      value: `%B: ${bollingerB.toFixed(1)}%, BW: ${bollingerBandwidth.toFixed(1)}%`,
      reason: reasons.length > 0 ? reasons.join(', ') : undefined,
    };
  }
  
  private evaluateHistoricalVolatilityFilter(indicators: any, filter: HistoricalVolatilityFilter): FilterResult {
    const hv = indicators.historicalVolatility;
    
    const minOk = filter.minHV === undefined || hv >= filter.minHV;
    const maxOk = filter.maxHV === undefined || hv <= filter.maxHV;
    
    return {
      name: 'Historical Vol',
      passed: minOk && maxOk,
      value: Number(hv.toFixed(1)),
      threshold: `${filter.minHV || 0}% - ${filter.maxHV || '∞'}%`,
    };
  }
  
  private evaluateTTMSqueezeFilter(indicators: any, filter: TTMSqueezeFilter): FilterResult {
    const { ttmSqueezeState, ttmSqueezeBars, ttmMomentum } = indicators;
    
    let passed = true;
    const reasons: string[] = [];
    
    if (filter.state && filter.state !== 'any') {
      const stateMatch = ttmSqueezeState.toLowerCase() === filter.state;
      if (!stateMatch) {
        passed = false;
        reasons.push(`Squeeze ${ttmSqueezeState} != ${filter.state}`);
      }
    }
    
    if (filter.minSqueezeBars !== undefined && ttmSqueezeBars < filter.minSqueezeBars) {
      passed = false;
      reasons.push(`${ttmSqueezeBars} bars < ${filter.minSqueezeBars}`);
    }
    
    if (filter.maxSqueezeBars !== undefined && ttmSqueezeBars > filter.maxSqueezeBars) {
      passed = false;
      reasons.push(`${ttmSqueezeBars} bars > ${filter.maxSqueezeBars}`);
    }
    
    if (filter.momentumDirection && filter.momentumDirection !== 'any') {
      const isBullish = ttmMomentum > 0;
      const momMatch = (filter.momentumDirection === 'bullish' && isBullish) ||
                       (filter.momentumDirection === 'bearish' && !isBullish);
      if (!momMatch) {
        passed = false;
        reasons.push(`Momentum not ${filter.momentumDirection}`);
      }
    }
    
    return {
      name: 'TTM Squeeze',
      passed,
      value: `${ttmSqueezeState} (${ttmSqueezeBars} bars)`,
      reason: reasons.length > 0 ? reasons.join(', ') : undefined,
    };
  }
  
  private evaluateMarketCapFilter(marketCap: number, filter: MarketCapFilter): FilterResult {
    let minCap = filter.minMarketCap || 0;
    let maxCap = filter.maxMarketCap || Infinity;
    
    // Apply preset
    if (filter.preset && filter.preset !== 'any') {
      const presets: Record<string, { min: number; max: number }> = {
        nano: { min: 0, max: 50_000_000 },
        micro: { min: 50_000_000, max: 300_000_000 },
        small: { min: 300_000_000, max: 2_000_000_000 },
        mid: { min: 2_000_000_000, max: 10_000_000_000 },
        large: { min: 10_000_000_000, max: 200_000_000_000 },
        mega: { min: 200_000_000_000, max: Infinity },
      };
      const preset = presets[filter.preset];
      if (preset) {
        minCap = preset.min;
        maxCap = preset.max;
      }
    }
    
    const passed = marketCap >= minCap && marketCap <= maxCap;
    
    return {
      name: 'Market Cap',
      passed,
      value: this.formatMarketCap(marketCap),
      threshold: filter.preset || `${this.formatMarketCap(minCap)} - ${this.formatMarketCap(maxCap)}`,
    };
  }
  
  private evaluateExchangeFilter(ticker: string, exchange: string, filter: ExchangeFilter): FilterResult {
    let passed = true;
    const reasons: string[] = [];
    
    // If exchange is generic/unknown, skip exchange checks but still check symbol-based exclusions
    const isGenericExchange = !exchange || exchange === 'US' || exchange === 'UNKNOWN';
    
    if (!isGenericExchange && filter.includeExchanges && filter.includeExchanges.length > 0) {
      const exchangeUpper = exchange.toUpperCase();
      const included = filter.includeExchanges.some(e => exchangeUpper.includes(e));
      if (!included) {
        passed = false;
        reasons.push(`Exchange ${exchange} not in ${filter.includeExchanges.join(', ')}`);
      }
    }
    
    // Check exclusions (these work even without exchange data)
    const symbol = ticker.toUpperCase();
    
    if (filter.excludeWarrants && (symbol.includes('.W') || symbol.includes('-W') || symbol.endsWith('W'))) {
      passed = false;
      reasons.push('Excluded: Warrant');
    }
    
    if (filter.excludeADRs && symbol.length === 4 && symbol.endsWith('Y')) {
      passed = false;
      reasons.push('Excluded: ADR');
    }
    
    return {
      name: 'Exchange',
      passed,
      value: isGenericExchange ? 'US (generic)' : exchange,
      reason: reasons.length > 0 ? reasons.join(', ') : undefined,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════
  
  private calculateAverage(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  
  private detectTrend(values: number[]): TrendType {
    if (values.length < 3) return 'flat';
    
    const start = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const end = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const diff = ((end - start) / start) * 100;
    
    if (diff > 5) return 'rising';
    if (diff < -5) return 'falling';
    return 'flat';
  }
  
  private calculateHistoricalVolatility(closes: number[], period: number): number {
    if (closes.length < period + 1) return 0;
    
    const returns: number[] = [];
    for (let i = closes.length - period; i < closes.length; i++) {
      const ret = Math.log(closes[i] / closes[i - 1]);
      returns.push(ret);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Annualize
    return stdDev * Math.sqrt(252) * 100;
  }
  
  private calculateTTMSqueeze(bars: OHLCV[], bbData: any): { squeezeState: string; squeezeBars: number; momentum: number } {
    // Simplified TTM Squeeze calculation
    const closes = bars.map(b => b.close);
    const highs = bars.map(b => b.high);
    const lows = bars.map(b => b.low);
    
    // Keltner Channel (simplified)
    const atr = calculateATR(bars, 20);
    const ema20 = calculateEMA(closes, 20);
    
    const lastIdx = closes.length - 1;
    const kcUpper = ema20[lastIdx] + 1.5 * atr[lastIdx];
    const kcLower = ema20[lastIdx] - 1.5 * atr[lastIdx];
    
    const bbUpper = bbData.upper[lastIdx];
    const bbLower = bbData.lower[lastIdx];
    
    // Squeeze is ON when BB inside KC
    const isSqueezeOn = bbLower > kcLower && bbUpper < kcUpper;
    
    // Count squeeze bars
    let squeezeBars = 0;
    for (let i = lastIdx; i >= 0; i--) {
      const kcU = ema20[i] + 1.5 * atr[i];
      const kcL = ema20[i] - 1.5 * atr[i];
      if (bbData.lower[i] > kcL && bbData.upper[i] < kcU) {
        squeezeBars++;
      } else {
        break;
      }
    }
    
    // Momentum (simplified - using linear regression of price)
    const momentum = closes[lastIdx] - closes[lastIdx - 10];
    
    return {
      squeezeState: isSqueezeOn ? 'ON' : 'OFF',
      squeezeBars,
      momentum,
    };
  }
  
  private formatDollarVolume(vol: number): string {
    if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(1)}B`;
    if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  }
  
  private formatMarketCap(cap: number): string {
    if (cap === Infinity) return '∞';
    if (cap >= 1_000_000_000_000) return `$${(cap / 1_000_000_000_000).toFixed(1)}T`;
    if (cap >= 1_000_000_000) return `$${(cap / 1_000_000_000).toFixed(1)}B`;
    if (cap >= 1_000_000) return `$${(cap / 1_000_000).toFixed(1)}M`;
    return `$${cap.toLocaleString()}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export function createScreener(filters?: ScreenerFilters): ScreenerEngine {
  return new ScreenerEngine(filters || {});
}

