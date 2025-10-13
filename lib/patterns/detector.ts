/**
 * Pattern Detection Module
 * Identifies chart patterns for swing trading
 */

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
    
    return {
      name: "Bullish Engulfing",
      type: "bullish",
      confidence,
      description: "Strong reversal signal - buyers overwhelmed sellers",
      timeframe: "2 bars"
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
    
    return {
      name: "Bearish Engulfing",
      type: "bearish",
      confidence,
      description: "Strong reversal signal - sellers overwhelmed buyers",
      timeframe: "2 bars"
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
    
    return {
      name: "Hammer",
      type: "bullish",
      confidence,
      description: "Potential bullish reversal - buyers rejected lower prices",
      timeframe: "1 bar"
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
    
    return {
      name: "Shooting Star",
      type: "bearish",
      confidence,
      description: "Potential bearish reversal - sellers rejected higher prices",
      timeframe: "1 bar"
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

