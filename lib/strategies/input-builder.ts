/**
 * Input Builder - Converts Market Data to Strategy Input
 * Version 1.1 - Builds StrategyInput from Polygon data and indicators
 */

import { MarketData } from '../data-vendors/polygon';
import { calculateTechnicalIndicators } from '../indicators/technical';
import { detectAllPatterns } from '../patterns/detector-v2';
import { detectAllChartPatterns } from '../patterns/chart-patterns-v2';
import { mapPatternsToStrategyContexts } from '../patterns/mapToStrategyContext';
import { cacheData, needsDataRefresh } from '../data-vendors/data-freshness';
import { 
  StrategyInput, 
  TriangleContext, 
  FlagContext, 
  DoubleTopContext,
  MarketRegime,
  OHLCV,
} from './types';

// ===========================
// Main Builder
// ===========================

/**
 * Build StrategyInput from market data
 */
export function buildStrategyInput(
  marketData: MarketData,
  spyRegime: MarketRegime = 'neutral',
  earningsDays: number | null = null
): StrategyInput {
  const { bars, symbol, timeframe, currentPrice } = marketData;
  
  // Convert bars to OHLCV format
  const ohlcv: OHLCV[] = bars.map(b => ({
    timestamp: b.timestamp,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));
  
  // Calculate technical indicators
  const indicators = calculateTechnicalIndicators(ohlcv);
  
  // Extract arrays
  const high = ohlcv.map(b => b.high);
  const low = ohlcv.map(b => b.low);
  const close = ohlcv.map(b => b.close);
  const volume = ohlcv.map(b => b.volume);
  
  // Calculate ATR percentage
  const atrPct = (indicators.atr / currentPrice) * 100;
  
  // Detect patterns
  const patternResult = detectAllPatterns(ohlcv);
  
  // Extract pattern contexts
  const triangle = extractTriangleContext(patternResult);
  const flag = extractFlagContext(patternResult);
  const doubleTop = extractDoubleTopContext(patternResult);
  
  // Detect chart patterns using V2 system
  const chartPatternResults = detectAllChartPatterns(ohlcv, indicators.atr);
  const patternContexts = mapPatternsToStrategyContexts(chartPatternResults);
  
  // Cache the processed data for freshness tracking
  cacheData(marketData.symbol, marketData.timeframe, {
    marketData,
    indicators,
    patternContexts,
    processedAt: new Date(),
  });
  
  // Estimate liquidity metrics (simplified - would need real data)
  const spreadBps = estimateSpreadBps(currentPrice);
  const advUsd = estimateADV(volume, currentPrice);
  
  // Get current date
  const asOf = new Date().toISOString().split('T')[0];
  
  return {
    symbol,
    timeframe,
    asOf,
    bars: ohlcv,
    price: currentPrice,
    high,
    low,
    close,
    volume,
    ema9: indicators.ema9,
    ema20: indicators.ema20,
    ema50: indicators.ema50,
    ema200: indicators.ema200,
    rsi14: indicators.rsi,
    atr: indicators.atr,
    atrPct,
    volZ: indicators.volumeZScore,
    triangle,
    flag,
    doubleTop,
    patternContexts,
    spyRegime,
    spreadBps,
    advUsd,
    earningsDays,
  };
}

// ===========================
// Pattern Context Extractors
// ===========================

function extractTriangleContext(patternResult: any): TriangleContext | undefined {
  // Look for ascending or descending triangle in institutional or candidate
  const pattern = patternResult.institutional || patternResult.candidate;
  
  if (!pattern) return undefined;
  
  if (pattern.name === 'Ascending Triangle' || pattern.name === 'Descending Triangle' || 
      pattern.name.includes('Triangle')) {
    const metadata = pattern.metadata || {};
    
    // Extract triangle properties
    const resistance = pattern.keyLevels?.resistance?.[0] || 0;
    const support = pattern.keyLevels?.support?.[0] || 0;
    const widthPct = metadata.widthPct || 0;
    const touches = metadata.totalTouches || 0;
    
    return {
      upperNow: resistance,
      lowerNow: support,
      widthPct,
      contractionsOk: widthPct <= 8,
      touches,
      status: pattern.breakoutStatus === 'confirmed' ? 'broken' : 
              pattern.breakoutStatus === 'pending' ? 'ready' : 'forming',
    };
  }
  
  return undefined;
}

function extractFlagContext(patternResult: any): FlagContext | undefined {
  const pattern = patternResult.institutional || patternResult.candidate;
  
  if (!pattern) return undefined;
  
  if (pattern.name === 'Bullish Flag' || pattern.name === 'Bearish Flag') {
    const metadata = pattern.metadata || {};
    const resistance = pattern.keyLevels?.resistance?.[0] || 0;
    const support = pattern.keyLevels?.support?.[0] || 0;
    
    // Calculate pullback depth (approximate)
    const pullbackDepth = metadata.poleGain || 0;
    
    return {
      pullbackDepthPct: pullbackDepth,
      parallelOk: metadata.parallelDelta !== undefined && metadata.parallelDelta <= 0.15,
      channelSlope: metadata.parallelDelta || 0,
      status: pattern.breakoutStatus === 'confirmed' ? 'broken' :
              pattern.breakoutStatus === 'pending' ? 'ready' : 'forming',
      flagTop: resistance,
      flagLow: support,
    };
  }
  
  return undefined;
}

function extractDoubleTopContext(patternResult: any): DoubleTopContext | undefined {
  const pattern = patternResult.institutional || patternResult.candidate;
  
  if (!pattern) return undefined;
  
  if (pattern.name === 'Double Top') {
    const metadata = pattern.metadata || {};
    
    return {
      neckline: metadata.neckline || pattern.keyLevels?.support?.[0] || 0,
      separationBars: metadata.separationBars || 0,
      symmetryPct: metadata.symmetryPct || 0,
      heightAtr: metadata.heightATR || 0,
      touches: metadata.totalTouches || 0,
      status: pattern.breakoutStatus === 'confirmed' ? 'broken' :
              pattern.breakoutStatus === 'pending' ? 'ready' : 'forming',
      peak1Price: metadata.peak1Price || 0,
      peak2Price: metadata.peak2Price || 0,
    };
  }
  
  return undefined;
}

// ===========================
// Liquidity Estimation
// ===========================

/**
 * Estimate bid-ask spread in basis points
 * Simple heuristic based on price (real implementation would use L2 data)
 */
function estimateSpreadBps(price: number): number {
  if (price < 5) return 100; // Wide spread for low price
  if (price < 20) return 40;
  if (price < 50) return 20;
  if (price < 100) return 10;
  return 5; // Tight spread for high price stocks
}

/**
 * Estimate average daily volume in USD
 */
function estimateADV(volumes: number[], price: number): number {
  const recentVolumes = volumes.slice(-20); // Last 20 days
  const avgVolume = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
  return avgVolume * price;
}

// ===========================
// SPY Regime Detection
// ===========================

/**
 * Determine SPY market regime (simplified version)
 * Real implementation would fetch SPY data and analyze
 */
export async function detectSPYRegime(): Promise<MarketRegime> {
  // Placeholder - in production, fetch SPY data and analyze EMAs
  // For now, return neutral as safe default
  return 'neutral';
}

/**
 * Detect SPY regime from SPY market data
 */
export function detectSPYRegimeFromData(spyBars: OHLCV[]): MarketRegime {
  const indicators = calculateTechnicalIndicators(spyBars);
  
  // Bullish: 20 > 50 > 200 and price > 20EMA
  const bullish = 
    indicators.ema20 > indicators.ema50 &&
    indicators.ema50 > indicators.ema200 &&
    spyBars[spyBars.length - 1].close > indicators.ema20;
  
  // Bearish: 20 < 50 < 200 and price < 20EMA
  const bearish =
    indicators.ema20 < indicators.ema50 &&
    indicators.ema50 < indicators.ema200 &&
    spyBars[spyBars.length - 1].close < indicators.ema20;
  
  if (bullish) return 'bullish';
  if (bearish) return 'bearish';
  return 'neutral';
}

// ===========================
// Batch Building
// ===========================

/**
 * Build inputs for multiple symbols
 */
export function buildMultipleInputs(
  marketDataList: MarketData[],
  spyRegime: MarketRegime = 'neutral'
): StrategyInput[] {
  return marketDataList.map(data => buildStrategyInput(data, spyRegime));
}

