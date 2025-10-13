/**
 * Pattern Detection Module
 * Identifies chart patterns for swing trading
 */

import { detectChartPatterns, ChartPattern } from "./chart-patterns";

interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DetectedPattern {
  name: string;
  type: "bullish" | "bearish" | "neutral";
  confidence: number; // 0-100
  description: string;
  timeframe: string;
  validation?: {
    wickToBodyRatio?: number;
    bodySize?: number;
    volumeRatio?: number;
    note?: string;
  };
}

export interface CompositePattern {
  candlestickPattern: DetectedPattern;
  chartPattern: ChartPattern | null;
  fusedConfidence: number; // Combined confidence when patterns align
  fusionBonus: number; // Bonus points from pattern alignment
  analysis: string; // How the patterns work together
}

/**
 * Detect bullish engulfing pattern
 */
function detectBullishEngulfing(bars: OHLCV[]): DetectedPattern | null {
  if (bars.length < 2) return null;
  
  const prev = bars[bars.length - 2];
  const current = bars[bars.length - 1];
  
  const prevBearish = prev.close < prev.open;
  const currentBullish = current.close > current.open;
  
  if (prevBearish && currentBullish && 
      current.open < prev.close && 
      current.close > prev.open) {
    
    const bodyRatio = (current.close - current.open) / (prev.open - prev.close);
    const confidence = Math.round(Math.min(100, 70 + bodyRatio * 10)); // Round to whole number
    const volumeRatio = current.volume / prev.volume;
    
    return {
      name: "Bullish Engulfing",
      type: "bullish",
      confidence,
      description: "Strong reversal signal - buyers overwhelmed sellers",
      timeframe: "2 bars",
      validation: {
        bodySize: Number(bodyRatio.toFixed(2)),
        volumeRatio: Number(volumeRatio.toFixed(2)),
        note: `Current bar body ${bodyRatio.toFixed(2)}× prev bar, volume ratio ${volumeRatio.toFixed(2)}× (valid engulfing ${volumeRatio > 1 ? '✓' : '⚠'})`
      }
    };
  }
  
  return null;
}

/**
 * Detect bearish engulfing pattern
 */
function detectBearishEngulfing(bars: OHLCV[]): DetectedPattern | null {
  if (bars.length < 2) return null;
  
  const prev = bars[bars.length - 2];
  const current = bars[bars.length - 1];
  
  const prevBullish = prev.close > prev.open;
  const currentBearish = current.close < current.open;
  
  if (prevBullish && currentBearish && 
      current.open > prev.close && 
      current.close < prev.open) {
    
    const bodyRatio = (current.open - current.close) / (prev.close - prev.open);
    const confidence = Math.round(Math.min(100, 70 + bodyRatio * 10)); // Round to whole number
    const volumeRatio = current.volume / prev.volume;
    
    return {
      name: "Bearish Engulfing",
      type: "bearish",
      confidence,
      description: "Strong reversal signal - sellers overwhelmed buyers",
      timeframe: "2 bars",
      validation: {
        bodySize: Number(bodyRatio.toFixed(2)),
        volumeRatio: Number(volumeRatio.toFixed(2)),
        note: `Current bar body ${bodyRatio.toFixed(2)}× prev bar, volume ratio ${volumeRatio.toFixed(2)}× (valid engulfing ${volumeRatio > 1 ? '✓' : '⚠'})`
      }
    };
  }
  
  return null;
}

/**
 * Detect hammer pattern (bullish reversal)
 */
function detectHammer(bars: OHLCV[]): DetectedPattern | null {
  if (bars.length < 1) return null;
  
  const bar = bars[bars.length - 1];
  const body = Math.abs(bar.close - bar.open);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;
  const upperWick = bar.high - Math.max(bar.open, bar.close);
  
  // Hammer criteria: long lower wick, small body, little to no upper wick
  if (lowerWick > body * 2 && upperWick < body * 0.5 && lowerWick > upperWick * 3) {
    const confidence = Math.round(Math.min(100, 60 + (lowerWick / body) * 5));
    const wickToBodyRatio = body > 0 ? lowerWick / body : 0;
    const bodyPercent = ((body / bar.close) * 100);
    
    return {
      name: "Hammer",
      type: "bullish",
      confidence,
      description: "Potential bullish reversal - buyers rejected lower prices",
      timeframe: "1 bar",
      validation: {
        wickToBodyRatio: Number(wickToBodyRatio.toFixed(2)),
        bodySize: Number(bodyPercent.toFixed(2)),
        note: `Lower wick ${wickToBodyRatio.toFixed(1)}× body size, close near high (valid hammer ✓)`
      }
    };
  }
  
  return null;
}

/**
 * Detect shooting star pattern (bearish reversal)
 */
function detectShootingStar(bars: OHLCV[]): DetectedPattern | null {
  if (bars.length < 1) return null;
  
  const bar = bars[bars.length - 1];
  const body = Math.abs(bar.close - bar.open);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;
  const upperWick = bar.high - Math.max(bar.open, bar.close);
  
  // Shooting star criteria: long upper wick, small body, little to no lower wick
  if (upperWick > body * 2 && lowerWick < body * 0.5 && upperWick > lowerWick * 3) {
    const confidence = Math.round(Math.min(100, 60 + (upperWick / body) * 5));
    const wickToBodyRatio = body > 0 ? upperWick / body : 0;
    const bodyPercent = ((body / bar.close) * 100);
    
    return {
      name: "Shooting Star",
      type: "bearish",
      confidence,
      description: "Potential bearish reversal - sellers rejected higher prices",
      timeframe: "1 bar",
      validation: {
        wickToBodyRatio: Number(wickToBodyRatio.toFixed(2)),
        bodySize: Number(bodyPercent.toFixed(2)),
        note: `Upper wick ${wickToBodyRatio.toFixed(1)}× body size, close near low (valid shooting star ✓)`
      }
    };
  }
  
  return null;
}

/**
 * Detect higher highs and higher lows (uptrend)
 */
function detectUptrend(bars: OHLCV[]): DetectedPattern | null {
  if (bars.length < 10) return null;
  
  const recent = bars.slice(-10);
  let higherHighs = 0;
  let higherLows = 0;
  
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].high > recent[i - 1].high) higherHighs++;
    if (recent[i].low > recent[i - 1].low) higherLows++;
  }
  
  if (higherHighs >= 6 && higherLows >= 6) {
    const confidence = Math.min(100, 50 + (higherHighs + higherLows));
    
    return {
      name: "Uptrend",
      type: "bullish",
      confidence,
      description: "Consistent higher highs and higher lows",
      timeframe: "10 bars"
    };
  }
  
  return null;
}

/**
 * Detect lower highs and lower lows (downtrend)
 */
function detectDowntrend(bars: OHLCV[]): DetectedPattern | null {
  if (bars.length < 10) return null;
  
  const recent = bars.slice(-10);
  let lowerHighs = 0;
  let lowerLows = 0;
  
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].high < recent[i - 1].high) lowerHighs++;
    if (recent[i].low < recent[i - 1].low) lowerLows++;
  }
  
  if (lowerHighs >= 6 && lowerLows >= 6) {
    const confidence = Math.min(100, 50 + (lowerHighs + lowerLows));
    
    return {
      name: "Downtrend",
      type: "bearish",
      confidence,
      description: "Consistent lower highs and lower lows",
      timeframe: "10 bars"
    };
  }
  
  return null;
}

/**
 * Detect consolidation/range
 */
function detectConsolidation(bars: OHLCV[]): DetectedPattern | null {
  if (bars.length < 20) return null;
  
  const recent = bars.slice(-20);
  const highs = recent.map(b => b.high);
  const lows = recent.map(b => b.low);
  
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const range = maxHigh - minLow;
  const avgPrice = (maxHigh + minLow) / 2;
  
  const rangePercent = (range / avgPrice) * 100;
  
  // If price is moving within a tight range (< 5%)
  if (rangePercent < 5) {
    const confidence = Math.min(100, 80 - rangePercent * 10);
    
    return {
      name: "Consolidation",
      type: "neutral",
      confidence,
      description: `Trading in a tight ${rangePercent.toFixed(1)}% range - potential breakout setup`,
      timeframe: "20 bars"
    };
  }
  
  return null;
}

/**
 * Detect volume breakout
 */
function detectVolumeBreakout(bars: OHLCV[]): DetectedPattern | null {
  if (bars.length < 20) return null;
  
  const recent = bars.slice(-20);
  const volumes = recent.map(b => b.volume);
  const avgVolume = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
  const currentVolume = volumes[volumes.length - 1];
  
  if (currentVolume > avgVolume * 2) {
    const currentBar = bars[bars.length - 1];
    const isBullish = currentBar.close > currentBar.open;
    
    const volumeRatio = currentVolume / avgVolume;
    const confidence = Math.min(100, 60 + volumeRatio * 10);
    
    return {
      name: "Volume Breakout",
      type: isBullish ? "bullish" : "bearish",
      confidence,
      description: `${volumeRatio.toFixed(1)}x average volume - strong institutional interest`,
      timeframe: "Current bar"
    };
  }
  
  return null;
}

/**
 * Main pattern detection function
 */
export function detectPatterns(bars: OHLCV[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  
  // Run all pattern detectors
  const detectors = [
    detectBullishEngulfing,
    detectBearishEngulfing,
    detectHammer,
    detectShootingStar,
    detectUptrend,
    detectDowntrend,
    detectConsolidation,
    detectVolumeBreakout
  ];
  
  for (const detector of detectors) {
    const pattern = detector(bars);
    if (pattern) {
      patterns.push(pattern);
    }
  }
  
  // Sort by confidence (highest first)
  return patterns.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get the primary pattern (highest confidence)
 */
export function getPrimaryPattern(bars: OHLCV[]): DetectedPattern {
  const patterns = detectPatterns(bars);
  
  if (patterns.length > 0) {
    return patterns[0];
  }
  
  // Default to neutral if no patterns detected
  return {
    name: "No Clear Pattern",
    type: "neutral",
    confidence: 50,
    description: "No distinct technical pattern identified",
    timeframe: "N/A"
  };
}

/**
 * Get composite pattern (chart + candlestick fusion)
 * This combines market structure (chart pattern) with timing (candlestick pattern)
 */
export function getCompositePattern(bars: OHLCV[]): CompositePattern {
  const candlestickPattern = getPrimaryPattern(bars);
  const chartPattern = detectChartPatterns(bars);
  
  let fusionBonus = 0;
  let analysis = "";
  
  if (chartPattern) {
    // Check if patterns align (same direction)
    const patternsAlign = candlestickPattern.type === chartPattern.type;
    
    if (patternsAlign && chartPattern.type !== "neutral") {
      // Strong alignment bonus
      fusionBonus = 15;
      
      if (chartPattern.type === "bullish") {
        analysis = `Strong bullish setup: ${chartPattern.name} provides structural support (${chartPattern.confidence}% confidence) while ${candlestickPattern.name} confirms entry timing. `;
        
        if (chartPattern.breakoutStatus === "confirmed") {
          fusionBonus += 10;
          analysis += "Breakout is confirmed with volume. ";
        } else if (chartPattern.breakoutStatus === "pending") {
          analysis += "Breakout is pending - price approaching resistance. ";
        }
        
      } else {
        analysis = `Strong bearish setup: ${chartPattern.name} defines downside structure (${chartPattern.confidence}% confidence) while ${candlestickPattern.name} signals entry timing. `;
        
        if (chartPattern.breakoutStatus === "confirmed") {
          fusionBonus += 10;
          analysis += "Breakdown is confirmed with volume. ";
        } else if (chartPattern.breakoutStatus === "pending") {
          analysis += "Breakdown is pending - price approaching support. ";
        }
      }
      
      // Additional bonus for tight patterns near breakout
      if (chartPattern.metadata?.tightness && chartPattern.metadata.tightness > 70) {
        fusionBonus += 5;
        analysis += "Pattern is tight and coiled for move. ";
      }
      
    } else if (!patternsAlign && chartPattern.type !== "neutral" && candlestickPattern.type !== "neutral") {
      // Conflicting patterns - reduce confidence
      fusionBonus = -10;
      analysis = `Conflicting signals: ${chartPattern.name} (${chartPattern.type}) vs ${candlestickPattern.name} (${candlestickPattern.type}). Wait for clarity. `;
      
    } else {
      // Neutral case - one pattern is neutral
      analysis = chartPattern.type !== "neutral" 
        ? `${chartPattern.name} provides context but ${candlestickPattern.name} is neutral. `
        : `${candlestickPattern.name} detected but no clear chart pattern. `;
    }
  } else {
    // No chart pattern detected
    analysis = `${candlestickPattern.name} identified. No major chart pattern detected - focus on candlestick signal and short-term support/resistance. `;
  }
  
  // Calculate fused confidence (capped at 95% for realism)
  const fusedConfidence = chartPattern
    ? Math.min(95, Math.round((candlestickPattern.confidence + chartPattern.confidence) / 2 + fusionBonus))
    : Math.min(95, candlestickPattern.confidence);
  
  return {
    candlestickPattern,
    chartPattern,
    fusedConfidence,
    fusionBonus,
    analysis
  };
}

