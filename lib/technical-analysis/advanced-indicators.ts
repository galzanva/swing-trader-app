/**
 * Advanced Technical Indicators Module
 * Pure technical analysis calculations - no fundamentals, no news, no options
 * Professional-grade indicators for comprehensive market analysis
 */

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ==================== MOVING AVERAGES ====================

/**
 * Simple Moving Average
 */
export function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma[i] = sum / period;
  }
  return sma;
}

/**
 * Exponential Moving Average
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
 * Weighted Moving Average - more weight on recent prices
 */
export function calculateWMA(data: number[], period: number): number[] {
  const wma: number[] = [];
  const denominator = (period * (period + 1)) / 2;
  
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - period + 1 + j] * (j + 1);
    }
    wma[i] = sum / denominator;
  }
  return wma;
}

/**
 * Hull Moving Average - reduces lag significantly
 */
export function calculateHMA(data: number[], period: number): number[] {
  const halfPeriod = Math.floor(period / 2);
  const sqrtPeriod = Math.floor(Math.sqrt(period));
  
  const wmaHalf = calculateWMA(data, halfPeriod);
  const wmaFull = calculateWMA(data, period);
  
  // Create the raw HMA values: 2 * WMA(n/2) - WMA(n)
  const rawHma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (wmaHalf[i] !== undefined && wmaFull[i] !== undefined) {
      rawHma[i] = 2 * wmaHalf[i] - wmaFull[i];
    }
  }
  
  // Apply WMA(sqrt(n)) to the raw HMA
  const validRaw = rawHma.filter(v => v !== undefined);
  return calculateWMA(validRaw, sqrtPeriod);
}

// ==================== MOMENTUM INDICATORS ====================

/**
 * Relative Strength Index (RSI)
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  
  if (prices.length < period + 1) return rsi;
  
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
  
  // Calculate RSI for each point using smoothed averages
  for (let i = period; i < prices.length; i++) {
    if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    } else {
      const change = prices[i] - prices[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;
      
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }
  
  return rsi;
}

/**
 * Stochastic Oscillator (%K and %D)
 */
export function calculateStochastic(
  bars: OHLCV[],
  kPeriod: number = 14,
  dPeriod: number = 3,
  smooth: number = 3
): { k: number[]; d: number[] } {
  const rawK: number[] = [];
  
  // Calculate raw %K
  for (let i = kPeriod - 1; i < bars.length; i++) {
    const slice = bars.slice(i - kPeriod + 1, i + 1);
    const highestHigh = Math.max(...slice.map(b => b.high));
    const lowestLow = Math.min(...slice.map(b => b.low));
    const currentClose = bars[i].close;
    
    if (highestHigh === lowestLow) {
      rawK[i] = 50;
    } else {
      rawK[i] = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    }
  }
  
  // Smooth %K
  const k = calculateSMA(rawK.filter(v => v !== undefined), smooth);
  
  // Calculate %D (SMA of %K)
  const d = calculateSMA(k.filter(v => v !== undefined), dPeriod);
  
  // Pad arrays to align with original data
  const result = { k: new Array(bars.length).fill(undefined), d: new Array(bars.length).fill(undefined) };
  const kOffset = bars.length - k.length;
  const dOffset = bars.length - d.length;
  
  k.forEach((v, i) => { if (v !== undefined) result.k[i + kOffset] = v; });
  d.forEach((v, i) => { if (v !== undefined) result.d[i + dOffset] = v; });
  
  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);
  
  const macdLine: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (emaFast[i] !== undefined && emaSlow[i] !== undefined) {
      macdLine[i] = emaFast[i] - emaSlow[i];
    }
  }
  
  const validMacd = macdLine.filter(v => v !== undefined);
  const signalLine = calculateEMA(validMacd, signalPeriod);
  
  const histogram: number[] = [];
  const offset = macdLine.findIndex(v => v !== undefined);
  const signalOffset = signalPeriod - 1;
  
  for (let i = 0; i < prices.length; i++) {
    const macdIdx = i;
    const signalIdx = i - offset - signalOffset;
    
    if (macdLine[macdIdx] !== undefined && signalLine[signalIdx] !== undefined) {
      histogram[i] = macdLine[macdIdx] - signalLine[signalIdx];
    }
  }
  
  // Align signal line with original data
  const signal: number[] = new Array(prices.length).fill(undefined);
  signalLine.forEach((v, i) => {
    if (v !== undefined) {
      signal[i + offset + signalOffset] = v;
    }
  });
  
  return { macd: macdLine, signal, histogram };
}

/**
 * Average Directional Index (ADX) - Trend Strength
 * Uses Wilder's smoothing method for proper ADX calculation
 */
export function calculateADX(bars: OHLCV[], period: number = 14): { 
  adx: number[]; 
  plusDI: number[]; 
  minusDI: number[];
  trendStrength: 'strong' | 'moderate' | 'weak' | 'no-trend';
} {
  if (bars.length < period * 2) {
    return { 
      adx: [], 
      plusDI: [], 
      minusDI: [], 
      trendStrength: 'no-trend' 
    };
  }
  
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  
  // Calculate True Range and Directional Movement for each bar
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevHigh = bars[i - 1].high;
    const prevLow = bars[i - 1].low;
    const prevClose = bars[i - 1].close;
    
    // True Range
    tr.push(Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    ));
    
    // Directional Movement
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  
  // Calculate smoothed TR, +DM, -DM using Wilder's smoothing
  const smoothTR: number[] = [];
  const smoothPlusDM: number[] = [];
  const smoothMinusDM: number[] = [];
  
  // First smoothed value is simple sum
  let sumTR = 0, sumPlusDM = 0, sumMinusDM = 0;
  for (let i = 0; i < period; i++) {
    sumTR += tr[i];
    sumPlusDM += plusDM[i];
    sumMinusDM += minusDM[i];
  }
  smoothTR[period - 1] = sumTR;
  smoothPlusDM[period - 1] = sumPlusDM;
  smoothMinusDM[period - 1] = sumMinusDM;
  
  // Continue with Wilder's smoothing
  for (let i = period; i < tr.length; i++) {
    smoothTR[i] = smoothTR[i - 1] - (smoothTR[i - 1] / period) + tr[i];
    smoothPlusDM[i] = smoothPlusDM[i - 1] - (smoothPlusDM[i - 1] / period) + plusDM[i];
    smoothMinusDM[i] = smoothMinusDM[i - 1] - (smoothMinusDM[i - 1] / period) + minusDM[i];
  }
  
  // Calculate +DI, -DI, and DX
  const plusDI: number[] = new Array(bars.length).fill(undefined);
  const minusDI: number[] = new Array(bars.length).fill(undefined);
  const dx: number[] = [];
  
  for (let i = period - 1; i < smoothTR.length; i++) {
    if (smoothTR[i] && smoothTR[i] !== 0) {
      const pdi = (smoothPlusDM[i] / smoothTR[i]) * 100;
      const mdi = (smoothMinusDM[i] / smoothTR[i]) * 100;
      
      // Offset by 1 to align with original bars array
      plusDI[i + 1] = pdi;
      minusDI[i + 1] = mdi;
      
      const diSum = pdi + mdi;
      dx.push(diSum !== 0 ? (Math.abs(pdi - mdi) / diSum) * 100 : 0);
    }
  }
  
  // Calculate ADX using smoothed DX
  const adx: number[] = new Array(bars.length).fill(undefined);
  
  if (dx.length >= period) {
    // First ADX is simple average of first 'period' DX values
    let sumDX = 0;
    for (let i = 0; i < period; i++) {
      sumDX += dx[i];
    }
    let currentADX = sumDX / period;
    adx[period * 2] = currentADX;
    
    // Continue with Wilder's smoothing for subsequent ADX values
    for (let i = period; i < dx.length; i++) {
      currentADX = ((currentADX * (period - 1)) + dx[i]) / period;
      adx[period + i + 1] = currentADX;
    }
  }
  
  // Get current values (last valid)
  const currentADX = adx.filter(v => v !== undefined).pop() || 15;
  
  // Determine trend strength
  let trendStrength: 'strong' | 'moderate' | 'weak' | 'no-trend';
  
  if (currentADX >= 40) trendStrength = 'strong';
  else if (currentADX >= 25) trendStrength = 'moderate';
  else if (currentADX >= 15) trendStrength = 'weak';
  else trendStrength = 'no-trend';
  
  return { adx, plusDI, minusDI, trendStrength };
}

/**
 * Williams %R
 */
export function calculateWilliamsR(bars: OHLCV[], period: number = 14): number[] {
  const wr: number[] = [];
  
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    const highestHigh = Math.max(...slice.map(b => b.high));
    const lowestLow = Math.min(...slice.map(b => b.low));
    const close = bars[i].close;
    
    if (highestHigh === lowestLow) {
      wr[i] = -50;
    } else {
      wr[i] = ((highestHigh - close) / (highestHigh - lowestLow)) * -100;
    }
  }
  
  return wr;
}

/**
 * Commodity Channel Index (CCI)
 */
export function calculateCCI(bars: OHLCV[], period: number = 20): number[] {
  const cci: number[] = [];
  const typicalPrices = bars.map(b => (b.high + b.low + b.close) / 3);
  
  for (let i = period - 1; i < bars.length; i++) {
    const slice = typicalPrices.slice(i - period + 1, i + 1);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    const meanDeviation = slice.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;
    
    if (meanDeviation === 0) {
      cci[i] = 0;
    } else {
      cci[i] = (typicalPrices[i] - sma) / (0.015 * meanDeviation);
    }
  }
  
  return cci;
}

/**
 * Rate of Change (ROC)
 */
export function calculateROC(prices: number[], period: number = 12): number[] {
  const roc: number[] = [];
  
  for (let i = period; i < prices.length; i++) {
    const prevPrice = prices[i - period];
    if (prevPrice !== 0) {
      roc[i] = ((prices[i] - prevPrice) / prevPrice) * 100;
    }
  }
  
  return roc;
}

/**
 * Money Flow Index (MFI) - Volume-weighted RSI
 */
export function calculateMFI(bars: OHLCV[], period: number = 14): number[] {
  const mfi: number[] = [];
  const typicalPrices = bars.map(b => (b.high + b.low + b.close) / 3);
  const rawMoneyFlow = typicalPrices.map((tp, i) => tp * bars[i].volume);
  
  for (let i = period; i < bars.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;
    
    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) {
        positiveFlow += rawMoneyFlow[j];
      } else if (typicalPrices[j] < typicalPrices[j - 1]) {
        negativeFlow += rawMoneyFlow[j];
      }
    }
    
    if (negativeFlow === 0) {
      mfi[i] = 100;
    } else {
      const moneyRatio = positiveFlow / negativeFlow;
      mfi[i] = 100 - (100 / (1 + moneyRatio));
    }
  }
  
  return mfi;
}

// ==================== VOLATILITY INDICATORS ====================

/**
 * Average True Range (ATR)
 */
export function calculateATR(bars: OHLCV[], period: number = 14): number[] {
  const tr: number[] = [];
  
  for (let i = 1; i < bars.length; i++) {
    tr[i] = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    );
  }
  
  // Use Wilder's smoothing for ATR
  const atr: number[] = [];
  const validTR = tr.filter(v => v !== undefined);
  
  if (validTR.length < period) return atr;
  
  // First ATR is simple average
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += validTR[i];
  }
  atr[period] = sum / period;
  
  // Subsequent values use Wilder's smoothing
  for (let i = period + 1; i < bars.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  
  return atr;
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: number[]; middle: number[]; lower: number[]; bandwidth: number[]; percentB: number[] } {
  const middle = calculateSMA(prices, period);
  const upper: number[] = [];
  const lower: number[] = [];
  const bandwidth: number[] = [];
  const percentB: number[] = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const sma = middle[i];
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    upper[i] = sma + stdDevMultiplier * stdDev;
    lower[i] = sma - stdDevMultiplier * stdDev;
    
    // Bandwidth: (Upper - Lower) / Middle
    bandwidth[i] = ((upper[i] - lower[i]) / sma) * 100;
    
    // %B: Where price is relative to bands (0 = lower, 1 = upper)
    if (upper[i] !== lower[i]) {
      percentB[i] = (prices[i] - lower[i]) / (upper[i] - lower[i]);
    } else {
      percentB[i] = 0.5;
    }
  }
  
  return { upper, middle, lower, bandwidth, percentB };
}

/**
 * Keltner Channels
 */
export function calculateKeltnerChannels(
  bars: OHLCV[],
  emaPeriod: number = 20,
  atrPeriod: number = 10,
  atrMultiplier: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const closes = bars.map(b => b.close);
  const middle = calculateEMA(closes, emaPeriod);
  const atr = calculateATR(bars, atrPeriod);
  
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < bars.length; i++) {
    if (middle[i] !== undefined && atr[i] !== undefined) {
      upper[i] = middle[i] + atrMultiplier * atr[i];
      lower[i] = middle[i] - atrMultiplier * atr[i];
    }
  }
  
  return { upper, middle, lower };
}

/**
 * Historical Volatility (Standard Deviation of Returns)
 */
export function calculateHistoricalVolatility(prices: number[], period: number = 20): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns[i] = Math.log(prices[i] / prices[i - 1]);
  }
  
  const hv: number[] = [];
  for (let i = period; i < returns.length; i++) {
    const slice = returns.slice(i - period + 1, i + 1).filter(r => r !== undefined);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / slice.length;
    // Annualize volatility (assuming daily data - 252 trading days)
    hv[i] = Math.sqrt(variance * 252) * 100;
  }
  
  return hv;
}

// ==================== VOLUME INDICATORS ====================

/**
 * On-Balance Volume (OBV)
 */
export function calculateOBV(bars: OHLCV[]): number[] {
  const obv: number[] = [0];
  
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].close > bars[i - 1].close) {
      obv[i] = obv[i - 1] + bars[i].volume;
    } else if (bars[i].close < bars[i - 1].close) {
      obv[i] = obv[i - 1] - bars[i].volume;
    } else {
      obv[i] = obv[i - 1];
    }
  }
  
  return obv;
}

/**
 * Volume Weighted Average Price (VWAP) - intraday
 */
export function calculateVWAP(bars: OHLCV[]): number[] {
  const vwap: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  
  for (let i = 0; i < bars.length; i++) {
    const typicalPrice = (bars[i].high + bars[i].low + bars[i].close) / 3;
    cumulativeTPV += typicalPrice * bars[i].volume;
    cumulativeVolume += bars[i].volume;
    
    vwap[i] = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice;
  }
  
  return vwap;
}

/**
 * Volume Rate of Change
 */
export function calculateVolumeROC(bars: OHLCV[], period: number = 14): number[] {
  const vroc: number[] = [];
  const volumes = bars.map(b => b.volume);
  
  for (let i = period; i < volumes.length; i++) {
    const prevVol = volumes[i - period];
    if (prevVol !== 0) {
      vroc[i] = ((volumes[i] - prevVol) / prevVol) * 100;
    }
  }
  
  return vroc;
}

/**
 * Accumulation/Distribution Line
 */
export function calculateADL(bars: OHLCV[]): number[] {
  const adl: number[] = [];
  let cumulative = 0;
  
  for (let i = 0; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const close = bars[i].close;
    const volume = bars[i].volume;
    
    // Money Flow Multiplier
    let mfm = 0;
    if (high !== low) {
      mfm = ((close - low) - (high - close)) / (high - low);
    }
    
    // Money Flow Volume
    const mfv = mfm * volume;
    
    cumulative += mfv;
    adl[i] = cumulative;
  }
  
  return adl;
}

/**
 * Chaikin Money Flow
 */
export function calculateCMF(bars: OHLCV[], period: number = 21): number[] {
  const cmf: number[] = [];
  
  for (let i = period - 1; i < bars.length; i++) {
    let sumMFV = 0;
    let sumVolume = 0;
    
    for (let j = i - period + 1; j <= i; j++) {
      const high = bars[j].high;
      const low = bars[j].low;
      const close = bars[j].close;
      const volume = bars[j].volume;
      
      let mfm = 0;
      if (high !== low) {
        mfm = ((close - low) - (high - close)) / (high - low);
      }
      
      sumMFV += mfm * volume;
      sumVolume += volume;
    }
    
    cmf[i] = sumVolume > 0 ? sumMFV / sumVolume : 0;
  }
  
  return cmf;
}

/**
 * Volume Z-Score
 */
export function calculateVolumeZScore(bars: OHLCV[], period: number = 20): number[] {
  const volumes = bars.map(b => b.volume);
  const zScore: number[] = [];
  
  for (let i = period - 1; i < volumes.length; i++) {
    const slice = volumes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    zScore[i] = stdDev > 0 ? (volumes[i] - mean) / stdDev : 0;
  }
  
  return zScore;
}

// ==================== SUPPORT/RESISTANCE ====================

/**
 * Pivot Points (Standard)
 */
export function calculatePivotPoints(bars: OHLCV[]): {
  pp: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
} {
  // Use the most recent completed bar
  const bar = bars[bars.length - 2] || bars[bars.length - 1];
  const high = bar.high;
  const low = bar.low;
  const close = bar.close;
  
  const pp = (high + low + close) / 3;
  
  return {
    pp,
    r1: 2 * pp - low,
    r2: pp + (high - low),
    r3: high + 2 * (pp - low),
    s1: 2 * pp - high,
    s2: pp - (high - low),
    s3: low - 2 * (high - pp)
  };
}

/**
 * Fibonacci Retracement Levels
 */
export function calculateFibonacciLevels(
  bars: OHLCV[],
  lookback: number = 50
): {
  high: number;
  low: number;
  levels: { ratio: number; price: number; label: string }[];
  direction: 'up' | 'down';
} {
  const slice = bars.slice(-lookback);
  const highIdx = slice.reduce((maxIdx, bar, i, arr) => bar.high > arr[maxIdx].high ? i : maxIdx, 0);
  const lowIdx = slice.reduce((minIdx, bar, i, arr) => bar.low < arr[minIdx].low ? i : minIdx, 0);
  
  const high = slice[highIdx].high;
  const low = slice[lowIdx].low;
  const range = high - low;
  
  // Determine if we're retracing up or down
  const direction: 'up' | 'down' = highIdx > lowIdx ? 'up' : 'down';
  
  const fibRatios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const labels = ['0%', '23.6%', '38.2%', '50%', '61.8%', '78.6%', '100%'];
  
  const levels = fibRatios.map((ratio, i) => ({
    ratio,
    price: direction === 'up' 
      ? high - range * ratio 
      : low + range * ratio,
    label: labels[i]
  }));
  
  return { high, low, levels, direction };
}

/**
 * Dynamic Support/Resistance from Swing Points
 */
export function findSwingLevels(
  bars: OHLCV[],
  lookback: number = 5,
  minTouches: number = 2
): {
  support: { price: number; touches: number; strength: number }[];
  resistance: { price: number; touches: number; strength: number }[];
} {
  const currentPrice = bars[bars.length - 1].close;
  const atr = calculateATR(bars, 14);
  const currentATR = atr[atr.length - 1] || (bars[bars.length - 1].high - bars[bars.length - 1].low);
  const tolerance = currentATR * 0.3;
  
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  
  // Find swing points
  for (let i = lookback; i < bars.length - lookback; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;
    
    for (let j = 1; j <= lookback; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) {
        isSwingHigh = false;
      }
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) {
        isSwingLow = false;
      }
    }
    
    if (isSwingHigh) swingHighs.push(bars[i].high);
    if (isSwingLow) swingLows.push(bars[i].low);
  }
  
  // Cluster swing points into levels
  function clusterLevels(points: number[], tolerance: number): { price: number; touches: number }[] {
    const levels: { price: number; touches: number }[] = [];
    
    for (const point of points) {
      let found = false;
      for (const level of levels) {
        if (Math.abs(point - level.price) <= tolerance) {
          level.price = (level.price * level.touches + point) / (level.touches + 1);
          level.touches++;
          found = true;
          break;
        }
      }
      if (!found) {
        levels.push({ price: point, touches: 1 });
      }
    }
    
    return levels.filter(l => l.touches >= minTouches);
  }
  
  const resistanceLevels = clusterLevels(swingHighs, tolerance)
    .filter(l => l.price > currentPrice)
    .map(l => ({ ...l, strength: Math.min(100, l.touches * 25) }))
    .sort((a, b) => a.price - b.price);
  
  const supportLevels = clusterLevels(swingLows, tolerance)
    .filter(l => l.price < currentPrice)
    .map(l => ({ ...l, strength: Math.min(100, l.touches * 25) }))
    .sort((a, b) => b.price - a.price);
  
  return {
    support: supportLevels.slice(0, 5),
    resistance: resistanceLevels.slice(0, 5)
  };
}

// ==================== SQUEEZE DETECTION ====================

/**
 * TTM Squeeze Detection
 */
export function detectTTMSqueeze(
  bars: OHLCV[],
  bbPeriod: number = 20,
  bbStdDev: number = 2,
  kcPeriod: number = 20,
  kcAtrMult: number = 1.5
): {
  isInSqueeze: boolean;
  squeezeDuration: number;
  momentum: number;
  momentumDirection: 'bullish' | 'bearish' | 'neutral';
  historyStates: ('on' | 'off' | 'fire')[];
} {
  const closes = bars.map(b => b.close);
  const bb = calculateBollingerBands(closes, bbPeriod, bbStdDev);
  const kc = calculateKeltnerChannels(bars, kcPeriod, kcPeriod, kcAtrMult);
  
  const states: ('on' | 'off' | 'fire')[] = [];
  let squeezeDuration = 0;
  
  // Calculate squeeze states
  for (let i = 0; i < bars.length; i++) {
    if (bb.lower[i] !== undefined && kc.lower[i] !== undefined) {
      const squeezeOn = bb.lower[i] > kc.lower[i] && bb.upper[i] < kc.upper[i];
      
      if (squeezeOn) {
        states[i] = 'on';
      } else if (i > 0 && states[i - 1] === 'on') {
        states[i] = 'fire';
      } else {
        states[i] = 'off';
      }
    }
  }
  
  // Count consecutive squeeze bars
  for (let i = states.length - 1; i >= 0; i--) {
    if (states[i] === 'on') {
      squeezeDuration++;
    } else {
      break;
    }
  }
  
  // Calculate momentum (highest high - lowest low deviation from midpoint)
  const lookback = 20;
  const slice = bars.slice(-lookback);
  const highest = Math.max(...slice.map(b => b.high));
  const lowest = Math.min(...slice.map(b => b.low));
  const midpoint = (highest + lowest) / 2;
  const currentClose = bars[bars.length - 1].close;
  const momentum = currentClose - midpoint;
  
  const momentumDirection: 'bullish' | 'bearish' | 'neutral' = 
    momentum > 0 ? 'bullish' : momentum < 0 ? 'bearish' : 'neutral';
  
  return {
    isInSqueeze: states[states.length - 1] === 'on',
    squeezeDuration,
    momentum,
    momentumDirection,
    historyStates: states.slice(-20)
  };
}

