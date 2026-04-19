/**
 * Technical Indicators Module
 * Calculates EMAs, RSI, MACD, Volume analysis, etc.
 */

interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  ema9: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  volumeZScore: number;
  atr: number;
  trend: "bullish" | "bearish" | "neutral"; // EMA alignment: 9>20>50>200 = bullish, 9<20<20<200 = bearish, else neutral
  alignment: "bullish" | "bearish" | "mixed"; // Same as trend (for clarity)
  longTermBias: "bullish" | "bearish"; // Based on price vs EMA200
  strength: number; // 0-100
  emaCompression: number; // Max % difference between EMA9, 20, 50 - indicates choppy/trending
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  if (data.length < period) {
    return [];
  }
  const multiplier = 2 / (period + 1);

  // Start with SMA for first value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  ema[period - 1] = sum / period;
  
  // Calculate EMA for remaining values
  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }
  
  return ema;
}

/**
 * Calculate Relative Strength Index
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // Calculate RSI using smoothed averages
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(prices: number[]): { value: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  const macdLine: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (ema12[i] !== undefined && ema26[i] !== undefined) {
      macdLine[i] = ema12[i] - ema26[i];
    }
  }
  
  const signalLine = calculateEMA(macdLine.filter(v => v !== undefined), 9);
  
  const currentMacd = macdLine[macdLine.length - 1] || 0;
  const currentSignal = signalLine[signalLine.length - 1] || 0;
  
  return {
    value: currentMacd,
    signal: currentSignal,
    histogram: currentMacd - currentSignal
  };
}

/**
 * Calculate Average True Range (ATR)
 */
export function calculateATR(ohlcv: OHLCV[], period: number = 14): number {
  if (ohlcv.length < 2) return 0;

  const trueRanges: number[] = [];

  for (let i = 1; i < ohlcv.length; i++) {
    const high = ohlcv[i].high;
    const low = ohlcv[i].low;
    const prevClose = ohlcv[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  const recentTR = trueRanges.slice(-period);
  if (recentTR.length === 0) return 0;
  const avg = recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length;
  return Number.isFinite(avg) ? avg : 0;
}

/**
 * Calculate Volume Z-Score
 */
export function calculateVolumeZScore(volumes: number[], period: number = 20): number {
  if (!volumes.length) return 0;
  const recentVolumes = volumes.slice(-period);
  if (!recentVolumes.length) return 0;
  const avg = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
  
  const variance = recentVolumes.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / recentVolumes.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  
  const currentVolume = volumes[volumes.length - 1];
  return (currentVolume - avg) / stdDev;
}

/**
 * Determine trend based on EMAs
 * Source of Truth: Bullish if 9>20>50>200, Bearish if 9<20<50<200, else Mixed
 */
export function determineTrend(ema9: number, ema20: number, ema50: number, ema200: number, price: number): {
  trend: "bullish" | "bearish" | "neutral";
  alignment: "bullish" | "bearish" | "mixed";
  longTermBias: "bullish" | "bearish";
  strength: number;
  emaOrderingString: string; // Actual EMA ordering for display
} {
  // Check strict alignment: 9>20>50>200 for bullish, 9<20<50<200 for bearish
  const bullishAlignment = ema9 > ema20 && ema20 > ema50 && ema50 > ema200;
  const bearishAlignment = ema9 < ema20 && ema20 < ema50 && ema50 < ema200;
  
  // Determine alignment
  let alignment: "bullish" | "bearish" | "mixed";
  let trend: "bullish" | "bearish" | "neutral";
  let strength: number;
  
  if (bullishAlignment) {
    alignment = "bullish";
    trend = "bullish";
    const spread = ((ema9 - ema200) / ema200) * 100;
    strength = Math.min(100, 60 + Math.abs(spread) * 10);
  } else if (bearishAlignment) {
    alignment = "bearish";
    trend = "bearish";
    const spread = ((ema200 - ema9) / ema200) * 100;
    strength = Math.max(0, 40 - Math.abs(spread) * 10);
  } else {
    alignment = "mixed";
    trend = "neutral";
    // Determine bias for strength
    const shortTermBullish = ema9 > ema20;
    const midTermBullish = ema20 > ema50;
    const bullishCount = (shortTermBullish ? 1 : 0) + (midTermBullish ? 1 : 0);
    
    if (bullishCount === 2) {
      strength = 60; // Bullish bias
    } else if (bullishCount === 0) {
      strength = 40; // Bearish bias
    } else {
      strength = 50; // Truly neutral
    }
  }
  
  // Long-term bias: based on price vs EMA200
  const longTermBias: "bullish" | "bearish" = price > ema200 ? "bullish" : "bearish";
  
  // Generate EMA ordering string (actual ordering)
  const emas = [
    { name: '9', value: ema9 },
    { name: '20', value: ema20 },
    { name: '50', value: ema50 },
    { name: '200', value: ema200 }
  ].sort((a, b) => b.value - a.value); // Sort descending
  
  const emaOrderingString = emas.map(e => `EMA${e.name}`).join(' > ');
  
  return {
    trend,
    alignment,
    longTermBias,
    strength,
    emaOrderingString
  };
}

/**
 * Calculate all technical indicators
 */
export function calculateTechnicalIndicators(ohlcv: OHLCV[]): TechnicalIndicators {
  const closes = ohlcv.map(bar => bar.close);
  const volumes = ohlcv.map(bar => bar.volume);
  
  // Calculate EMAs
  const ema9Array = calculateEMA(closes, 9);
  const ema20Array = calculateEMA(closes, 20);
  const ema50Array = calculateEMA(closes, 50);
  const ema200Array = calculateEMA(closes, 200);
  
  const ema9 = ema9Array[ema9Array.length - 1] || closes[closes.length - 1];
  const ema20 = ema20Array[ema20Array.length - 1] || closes[closes.length - 1];
  const ema50 = ema50Array[ema50Array.length - 1] || closes[closes.length - 1];
  const ema200 = ema200Array[ema200Array.length - 1] || closes[closes.length - 1];
  
  // Calculate RSI
  const rsi = calculateRSI(closes);
  
  // Calculate MACD
  const macd = calculateMACD(closes);
  
  // Calculate Volume Z-Score
  const volumeZScore = calculateVolumeZScore(volumes);
  
  // Calculate ATR
  const atr = calculateATR(ohlcv);
  
  // Get current price
  const currentPrice = closes[closes.length - 1];
  
  // Determine trend (with alignment and long-term bias)
  const { trend, alignment, longTermBias, strength } = determineTrend(ema9, ema20, ema50, ema200, currentPrice);
  
  // Calculate EMA compression (max % difference between 9, 20, 50)
  // Lower values = choppy/compression, higher = trending
  const emas = [ema9, ema20, ema50];
  const minEma = Math.min(...emas);
  const maxEma = Math.max(...emas);
  const emaCompression = ((maxEma - minEma) / minEma) * 100;
  
  return {
    ema9,
    ema20,
    ema50,
    ema200,
    rsi,
    macd,
    volumeZScore,
    atr,
    trend,
    alignment,
    longTermBias,
    strength,
    emaCompression
  };
}

/**
 * Identify support and resistance levels
 * Support = swing lows BELOW current price
 * Resistance = swing highs ABOVE current price
 */
export function findSupportResistance(ohlcv: OHLCV[]): {
  support: number[];
  resistance: number[];
} {
  const currentPrice = ohlcv[ohlcv.length - 1].close;
  const highs = ohlcv.map(bar => bar.high);
  const lows = ohlcv.map(bar => bar.low);
  
  const allSupport: number[] = [];
  const allResistance: number[] = [];
  
  // Find swing highs and lows (simple pivot points)
  const lookback = 5;
  
  for (let i = lookback; i < ohlcv.length - lookback; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;
    
    for (let j = 1; j <= lookback; j++) {
      if (highs[i] <= highs[i - j] || highs[i] <= highs[i + j]) {
        isSwingHigh = false;
      }
      if (lows[i] >= lows[i - j] || lows[i] >= lows[i + j]) {
        isSwingLow = false;
      }
    }
    
    // Support = swing lows BELOW current price
    if (isSwingLow && lows[i] < currentPrice) {
      allSupport.push(lows[i]);
    }
    
    // Resistance = swing highs ABOVE current price
    if (isSwingHigh && highs[i] > currentPrice) {
      allResistance.push(highs[i]);
    }
  }
  
  // Return the 3 closest levels
  // For support: highest values (closest to price from below)
  // For resistance: lowest values (closest to price from above)
  return {
    support: allSupport.sort((a, b) => b - a).slice(0, 3), // Descending - closest first
    resistance: allResistance.sort((a, b) => a - b).slice(0, 3) // Ascending - closest first
  };
}

