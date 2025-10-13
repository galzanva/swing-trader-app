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
  trend: "bullish" | "bearish" | "neutral";
  strength: number; // 0-100
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
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
  
  // Calculate average
  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length;
}

/**
 * Calculate Volume Z-Score
 */
export function calculateVolumeZScore(volumes: number[], period: number = 20): number {
  const recentVolumes = volumes.slice(-period);
  const avg = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
  
  const variance = recentVolumes.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / recentVolumes.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  
  const currentVolume = volumes[volumes.length - 1];
  return (currentVolume - avg) / stdDev;
}

/**
 * Determine trend based on EMAs
 */
export function determineTrend(ema9: number, ema20: number, ema50: number, ema200: number): {
  trend: "bullish" | "bearish" | "neutral";
  strength: number;
} {
  const emaAlignment = [ema9, ema20, ema50, ema200];
  
  // Check if EMAs are in bullish alignment
  const bullishAlignment = emaAlignment.every((val, i) => 
    i === 0 || val > emaAlignment[i - 1]
  );
  
  // Check if EMAs are in bearish alignment
  const bearishAlignment = emaAlignment.every((val, i) => 
    i === 0 || val < emaAlignment[i - 1]
  );
  
  if (bullishAlignment) {
    const spread = ((ema9 - ema200) / ema200) * 100;
    return { trend: "bullish", strength: Math.min(100, 60 + Math.abs(spread) * 10) };
  } else if (bearishAlignment) {
    const spread = ((ema200 - ema9) / ema200) * 100;
    return { trend: "bearish", strength: Math.max(0, 40 - Math.abs(spread) * 10) };
  } else {
    // Partial alignment - determine bias
    // Check short-term trend (EMA9 vs EMA20)
    const shortTermBullish = ema9 > ema20;
    const shortTermBearish = ema9 < ema20;
    
    // Check mid-term trend (EMA20 vs EMA50)
    const midTermBullish = ema20 > ema50;
    const midTermBearish = ema20 < ema50;
    
    // Count bullish signals (0-2)
    const bullishCount = (shortTermBullish ? 1 : 0) + (midTermBullish ? 1 : 0);
    
    if (bullishCount === 2) {
      // Bullish bias but not perfect alignment
      return { trend: "neutral", strength: 60 };
    } else if (bullishCount === 0) {
      // Bearish bias but not perfect alignment
      return { trend: "neutral", strength: 40 };
    } else {
      // Mixed signals - truly neutral
      return { trend: "neutral", strength: 50 };
    }
  }
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
  
  // Determine trend
  const { trend, strength } = determineTrend(ema9, ema20, ema50, ema200);
  
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
    strength
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

