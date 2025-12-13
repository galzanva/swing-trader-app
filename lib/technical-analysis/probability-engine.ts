/**
 * Probability Engine - Statistical Price Movement Predictions
 * Based purely on technical analysis, indicators, and historical patterns
 */

import { OHLCV, calculateATR, calculateRSI, calculateMACD, calculateADX, calculateStochastic, calculateBollingerBands } from './advanced-indicators';

export interface ProbabilityScenario {
  direction: 'up' | 'down';
  targetPrice: number;
  targetPercent: number;
  probability: number;
  daysToTarget: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  supportingIndicators: string[];
  conflictingIndicators: string[];
}

export interface MomentumAssessment {
  score: number; // -100 to +100 (negative = bearish, positive = bullish)
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  direction: 'bullish' | 'bearish' | 'neutral';
  divergences: {
    indicator: string;
    type: 'bullish' | 'bearish' | 'none';
    description: string;
  }[];
  keyFactors: string[];
}

export interface TrendAssessment {
  primary: {
    direction: 'uptrend' | 'downtrend' | 'sideways';
    strength: number; // 0-100
    duration: number; // bars
  };
  intermediate: {
    direction: 'uptrend' | 'downtrend' | 'sideways';
    strength: number;
  };
  shortTerm: {
    direction: 'uptrend' | 'downtrend' | 'sideways';
    strength: number;
  };
  emaAlignment: 'bullish' | 'bearish' | 'mixed';
  priceLocation: 'above-all-emas' | 'below-all-emas' | 'mixed';
}

export interface VolatilityAssessment {
  current: number; // Current ATR
  average: number; // Average ATR
  percentile: number; // Where current vol is vs history
  regime: 'high' | 'normal' | 'low' | 'expanding' | 'contracting';
  expectedDailyRange: { low: number; high: number };
  suggestion: string;
}

export interface PriceProjection {
  currentPrice: number;
  upside: {
    conservative: { price: number; percent: number; probability: number; days: number };
    moderate: { price: number; percent: number; probability: number; days: number };
    aggressive: { price: number; percent: number; probability: number; days: number };
  };
  downside: {
    conservative: { price: number; percent: number; probability: number; days: number };
    moderate: { price: number; percent: number; probability: number; days: number };
    aggressive: { price: number; percent: number; probability: number; days: number };
  };
  mostProbable: {
    direction: 'up' | 'down' | 'sideways';
    priceRange: { low: number; high: number };
    probability: number;
    timeframe: string;
  };
}

export interface SignalStrength {
  overall: number; // 0-100
  direction: 'bullish' | 'bearish' | 'neutral';
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    trend: { score: number; weight: number; signal: string };
    momentum: { score: number; weight: number; signal: string };
    volume: { score: number; weight: number; signal: string };
    volatility: { score: number; weight: number; signal: string };
    pattern: { score: number; weight: number; signal: string };
  };
}

export interface StrategyRecommendation {
  strategy: string;
  direction: 'long' | 'short' | 'wait';
  confidence: number;
  entry: {
    type: 'market' | 'limit' | 'breakout' | 'pullback';
    price: number;
    conditions: string[];
  };
  stopLoss: {
    price: number;
    reason: string;
    riskPercent: number;
  };
  targets: {
    t1: { price: number; rr: number; probability: number };
    t2: { price: number; rr: number; probability: number };
    t3: { price: number; rr: number; probability: number };
  };
  invalidation: string;
  notes: string[];
}

/**
 * Calculate momentum score from multiple indicators
 */
export function assessMomentum(bars: OHLCV[]): MomentumAssessment {
  const closes = bars.map(b => b.close);
  
  // Calculate indicators
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const stoch = calculateStochastic(bars);
  const adx = calculateADX(bars);
  
  const currentRSI = rsi[rsi.length - 1] || 50;
  const currentMACD = macd.histogram[macd.histogram.length - 1] || 0;
  const prevMACD = macd.histogram[macd.histogram.length - 2] || 0;
  const currentStochK = stoch.k[stoch.k.length - 1] || 50;
  const currentADX = adx.adx[adx.adx.length - 1] || 0;
  const plusDI = adx.plusDI[adx.plusDI.length - 1] || 0;
  const minusDI = adx.minusDI[adx.minusDI.length - 1] || 0;
  
  // Calculate momentum score (-100 to +100)
  let score = 0;
  const keyFactors: string[] = [];
  const divergences: { indicator: string; type: 'bullish' | 'bearish' | 'none'; description: string }[] = [];
  
  // RSI contribution (-25 to +25)
  if (currentRSI > 70) {
    score -= 15;
    keyFactors.push(`RSI overbought (${currentRSI.toFixed(1)})`);
  } else if (currentRSI > 60) {
    score += 15;
    keyFactors.push(`RSI bullish (${currentRSI.toFixed(1)})`);
  } else if (currentRSI < 30) {
    score += 15; // Oversold can be bullish for reversal
    keyFactors.push(`RSI oversold (${currentRSI.toFixed(1)})`);
  } else if (currentRSI < 40) {
    score -= 15;
    keyFactors.push(`RSI bearish (${currentRSI.toFixed(1)})`);
  } else {
    keyFactors.push(`RSI neutral (${currentRSI.toFixed(1)})`);
  }
  
  // MACD contribution (-30 to +30)
  if (currentMACD > 0 && currentMACD > prevMACD) {
    score += 25;
    keyFactors.push('MACD bullish and rising');
  } else if (currentMACD > 0) {
    score += 10;
    keyFactors.push('MACD positive');
  } else if (currentMACD < 0 && currentMACD < prevMACD) {
    score -= 25;
    keyFactors.push('MACD bearish and falling');
  } else if (currentMACD < 0) {
    score -= 10;
    keyFactors.push('MACD negative');
  }
  
  // Stochastic contribution (-20 to +20)
  if (currentStochK > 80) {
    score -= 10;
    keyFactors.push(`Stochastic overbought (${currentStochK.toFixed(1)})`);
  } else if (currentStochK > 50) {
    score += 15;
    keyFactors.push(`Stochastic bullish (${currentStochK.toFixed(1)})`);
  } else if (currentStochK < 20) {
    score += 10;
    keyFactors.push(`Stochastic oversold (${currentStochK.toFixed(1)})`);
  } else {
    score -= 15;
    keyFactors.push(`Stochastic bearish (${currentStochK.toFixed(1)})`);
  }
  
  // ADX/DMI contribution (-25 to +25)
  if (currentADX > 25) {
    if (plusDI > minusDI) {
      score += 20;
      keyFactors.push(`Strong uptrend (ADX: ${currentADX.toFixed(1)}, +DI > -DI)`);
    } else {
      score -= 20;
      keyFactors.push(`Strong downtrend (ADX: ${currentADX.toFixed(1)}, -DI > +DI)`);
    }
  } else {
    keyFactors.push(`Weak trend (ADX: ${currentADX.toFixed(1)})`);
  }
  
  // Check for divergences (simplified)
  const priceHigh = Math.max(...bars.slice(-10).map(b => b.high));
  const priceLow = Math.min(...bars.slice(-10).map(b => b.low));
  const rsiRecent = rsi.slice(-10).filter(v => v !== undefined);
  const rsiHigh = Math.max(...rsiRecent);
  const rsiLow = Math.min(...rsiRecent);
  
  const currentPrice = closes[closes.length - 1];
  if (currentPrice >= priceHigh * 0.98 && currentRSI < rsiHigh * 0.95) {
    divergences.push({
      indicator: 'RSI',
      type: 'bearish',
      description: 'Price making new highs but RSI is not - potential bearish divergence'
    });
    score -= 10;
  }
  if (currentPrice <= priceLow * 1.02 && currentRSI > rsiLow * 1.05) {
    divergences.push({
      indicator: 'RSI',
      type: 'bullish',
      description: 'Price making new lows but RSI is not - potential bullish divergence'
    });
    score += 10;
  }
  
  // Clamp score
  score = Math.max(-100, Math.min(100, score));
  
  // Determine strength and direction
  let strength: 'strong' | 'moderate' | 'weak' | 'none';
  let direction: 'bullish' | 'bearish' | 'neutral';
  
  if (Math.abs(score) >= 50) strength = 'strong';
  else if (Math.abs(score) >= 30) strength = 'moderate';
  else if (Math.abs(score) >= 15) strength = 'weak';
  else strength = 'none';
  
  if (score >= 15) direction = 'bullish';
  else if (score <= -15) direction = 'bearish';
  else direction = 'neutral';
  
  return { score, strength, direction, divergences, keyFactors };
}

/**
 * Assess trend on multiple timeframes
 */
export function assessTrend(bars: OHLCV[]): TrendAssessment {
  const closes = bars.map(b => b.close);
  const currentPrice = closes[closes.length - 1];
  
  // Calculate EMAs
  const ema9 = closes.slice(-9).reduce((a, b) => a + b, 0) / 9;
  const ema20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
  const ema50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);
  const ema200 = closes.slice(-200).reduce((a, b) => a + b, 0) / Math.min(200, closes.length);
  
  // EMA alignment
  const bullishAlignment = ema9 > ema20 && ema20 > ema50 && ema50 > ema200;
  const bearishAlignment = ema9 < ema20 && ema20 < ema50 && ema50 < ema200;
  const emaAlignment: 'bullish' | 'bearish' | 'mixed' = 
    bullishAlignment ? 'bullish' : bearishAlignment ? 'bearish' : 'mixed';
  
  // Price location
  const aboveAll = currentPrice > ema9 && currentPrice > ema20 && currentPrice > ema50 && currentPrice > ema200;
  const belowAll = currentPrice < ema9 && currentPrice < ema20 && currentPrice < ema50 && currentPrice < ema200;
  const priceLocation: 'above-all-emas' | 'below-all-emas' | 'mixed' = 
    aboveAll ? 'above-all-emas' : belowAll ? 'below-all-emas' : 'mixed';
  
  // Primary trend (long-term: 200 bars)
  const primarySlice = bars.slice(-Math.min(200, bars.length));
  const primaryFirst = primarySlice[0].close;
  const primaryLast = primarySlice[primarySlice.length - 1].close;
  const primaryChange = ((primaryLast - primaryFirst) / primaryFirst) * 100;
  
  const primaryDirection: 'uptrend' | 'downtrend' | 'sideways' = 
    primaryChange > 5 ? 'uptrend' : primaryChange < -5 ? 'downtrend' : 'sideways';
  const primaryStrength = Math.min(100, Math.abs(primaryChange) * 2);
  
  // Intermediate trend (50 bars)
  const intSlice = bars.slice(-Math.min(50, bars.length));
  const intFirst = intSlice[0].close;
  const intLast = intSlice[intSlice.length - 1].close;
  const intChange = ((intLast - intFirst) / intFirst) * 100;
  
  const intDirection: 'uptrend' | 'downtrend' | 'sideways' = 
    intChange > 3 ? 'uptrend' : intChange < -3 ? 'downtrend' : 'sideways';
  const intStrength = Math.min(100, Math.abs(intChange) * 5);
  
  // Short-term trend (20 bars)
  const shortSlice = bars.slice(-Math.min(20, bars.length));
  const shortFirst = shortSlice[0].close;
  const shortLast = shortSlice[shortSlice.length - 1].close;
  const shortChange = ((shortLast - shortFirst) / shortFirst) * 100;
  
  const shortDirection: 'uptrend' | 'downtrend' | 'sideways' = 
    shortChange > 2 ? 'uptrend' : shortChange < -2 ? 'downtrend' : 'sideways';
  const shortStrength = Math.min(100, Math.abs(shortChange) * 10);
  
  // Count trend duration
  let duration = 0;
  for (let i = bars.length - 2; i >= 0; i--) {
    if (primaryDirection === 'uptrend' && bars[i].close < bars[i + 1].close) {
      duration++;
    } else if (primaryDirection === 'downtrend' && bars[i].close > bars[i + 1].close) {
      duration++;
    } else if (primaryDirection === 'sideways') {
      duration++;
    } else {
      break;
    }
  }
  
  return {
    primary: { direction: primaryDirection, strength: primaryStrength, duration },
    intermediate: { direction: intDirection, strength: intStrength },
    shortTerm: { direction: shortDirection, strength: shortStrength },
    emaAlignment,
    priceLocation
  };
}

/**
 * Assess volatility regime
 */
export function assessVolatility(bars: OHLCV[]): VolatilityAssessment {
  const atrArray = calculateATR(bars, 14);
  const currentATR = atrArray[atrArray.length - 1] || 0;
  const currentPrice = bars[bars.length - 1].close;
  
  // Calculate average ATR over longer period
  const validATR = atrArray.filter(v => v !== undefined);
  const avgATR = validATR.reduce((a, b) => a + b, 0) / validATR.length;
  
  // Calculate ATR percentile
  const sortedATR = [...validATR].sort((a, b) => a - b);
  const percentile = (sortedATR.findIndex(v => v >= currentATR) / sortedATR.length) * 100;
  
  // Recent ATR trend
  const recentATR = validATR.slice(-5);
  const atrChanging = recentATR.length >= 2 
    ? ((recentATR[recentATR.length - 1] - recentATR[0]) / recentATR[0]) * 100
    : 0;
  
  // Determine regime
  let regime: 'high' | 'normal' | 'low' | 'expanding' | 'contracting';
  if (atrChanging > 15) {
    regime = 'expanding';
  } else if (atrChanging < -15) {
    regime = 'contracting';
  } else if (currentATR > avgATR * 1.3) {
    regime = 'high';
  } else if (currentATR < avgATR * 0.7) {
    regime = 'low';
  } else {
    regime = 'normal';
  }
  
  // Expected daily range
  const expectedDailyRange = {
    low: currentPrice - currentATR,
    high: currentPrice + currentATR
  };
  
  // Suggestion based on regime
  let suggestion: string;
  switch (regime) {
    case 'high':
      suggestion = 'Wide stops recommended. Consider reduced position size.';
      break;
    case 'low':
      suggestion = 'Low volatility - potential breakout setup. Watch for squeeze.';
      break;
    case 'expanding':
      suggestion = 'Volatility increasing - momentum trade opportunity.';
      break;
    case 'contracting':
      suggestion = 'Volatility decreasing - consolidation phase. Wait for breakout.';
      break;
    default:
      suggestion = 'Normal volatility conditions.';
  }
  
  return {
    current: currentATR,
    average: avgATR,
    percentile,
    regime,
    expectedDailyRange,
    suggestion
  };
}

/**
 * Calculate price projections based on technical analysis
 */
export function calculatePriceProjections(
  bars: OHLCV[],
  momentum: MomentumAssessment,
  trend: TrendAssessment,
  volatility: VolatilityAssessment
): PriceProjection {
  const currentPrice = bars[bars.length - 1].close;
  const atr = volatility.current;
  
  // Base probability adjustments based on momentum and trend
  let bullishBias = 50;
  bullishBias += momentum.score * 0.3; // ±30 from momentum
  
  if (trend.emaAlignment === 'bullish') bullishBias += 10;
  else if (trend.emaAlignment === 'bearish') bullishBias -= 10;
  
  if (trend.primary.direction === 'uptrend') bullishBias += 5;
  else if (trend.primary.direction === 'downtrend') bullishBias -= 5;
  
  bullishBias = Math.max(10, Math.min(90, bullishBias));
  const bearishBias = 100 - bullishBias;
  
  // Calculate targets based on ATR multiples and probability decay
  const upside = {
    conservative: {
      price: Number((currentPrice + atr * 1).toFixed(2)),
      percent: Number(((atr * 1) / currentPrice * 100).toFixed(2)),
      probability: Math.min(85, bullishBias + 15),
      days: Math.ceil(3 + Math.random() * 2)
    },
    moderate: {
      price: Number((currentPrice + atr * 2).toFixed(2)),
      percent: Number(((atr * 2) / currentPrice * 100).toFixed(2)),
      probability: Math.min(70, bullishBias + 5),
      days: Math.ceil(7 + Math.random() * 5)
    },
    aggressive: {
      price: Number((currentPrice + atr * 3).toFixed(2)),
      percent: Number(((atr * 3) / currentPrice * 100).toFixed(2)),
      probability: Math.max(20, bullishBias - 15),
      days: Math.ceil(14 + Math.random() * 7)
    }
  };
  
  const downside = {
    conservative: {
      price: Number((currentPrice - atr * 1).toFixed(2)),
      percent: Number(((atr * 1) / currentPrice * 100).toFixed(2)),
      probability: Math.min(85, bearishBias + 15),
      days: Math.ceil(3 + Math.random() * 2)
    },
    moderate: {
      price: Number((currentPrice - atr * 2).toFixed(2)),
      percent: Number(((atr * 2) / currentPrice * 100).toFixed(2)),
      probability: Math.min(70, bearishBias + 5),
      days: Math.ceil(7 + Math.random() * 5)
    },
    aggressive: {
      price: Number((currentPrice - atr * 3).toFixed(2)),
      percent: Number(((atr * 3) / currentPrice * 100).toFixed(2)),
      probability: Math.max(20, bearishBias - 15),
      days: Math.ceil(14 + Math.random() * 7)
    }
  };
  
  // Most probable scenario
  let mostProbable: PriceProjection['mostProbable'];
  if (bullishBias >= 60) {
    mostProbable = {
      direction: 'up',
      priceRange: { low: currentPrice, high: upside.moderate.price },
      probability: bullishBias,
      timeframe: `${upside.moderate.days}-${upside.moderate.days + 5} days`
    };
  } else if (bearishBias >= 60) {
    mostProbable = {
      direction: 'down',
      priceRange: { low: downside.moderate.price, high: currentPrice },
      probability: bearishBias,
      timeframe: `${downside.moderate.days}-${downside.moderate.days + 5} days`
    };
  } else {
    mostProbable = {
      direction: 'sideways',
      priceRange: { 
        low: currentPrice - atr * 0.75, 
        high: currentPrice + atr * 0.75 
      },
      probability: 60,
      timeframe: '5-10 days'
    };
  }
  
  return {
    currentPrice,
    upside,
    downside,
    mostProbable
  };
}

/**
 * Calculate overall signal strength
 */
export function calculateSignalStrength(
  bars: OHLCV[],
  momentum: MomentumAssessment,
  trend: TrendAssessment,
  volatility: VolatilityAssessment
): SignalStrength {
  // Trend score (0-100)
  let trendScore = 50;
  if (trend.emaAlignment === 'bullish') trendScore += 25;
  else if (trend.emaAlignment === 'bearish') trendScore += 25; // Strong bearish is still a signal
  else trendScore -= 10;
  
  if (trend.primary.direction !== 'sideways') trendScore += 15;
  if (trend.shortTerm.direction === trend.intermediate.direction) trendScore += 10;
  trendScore = Math.min(100, Math.max(0, trendScore));
  
  const trendSignal = trend.emaAlignment === 'bullish' ? 'Bullish alignment' :
                      trend.emaAlignment === 'bearish' ? 'Bearish alignment' : 'Mixed signals';
  
  // Momentum score (0-100)
  let momentumScore = 50 + momentum.score * 0.5;
  momentumScore = Math.min(100, Math.max(0, momentumScore));
  const momentumSignal = momentum.direction === 'bullish' ? `Bullish (${momentum.strength})` :
                         momentum.direction === 'bearish' ? `Bearish (${momentum.strength})` : 'Neutral';
  
  // Volume score (simplified - based on recent volume)
  const volumes = bars.slice(-20).map(b => b.volume);
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const volRatio = recentVol / avgVol;
  
  let volumeScore = 50;
  if (volRatio > 1.5) volumeScore = 80;
  else if (volRatio > 1.2) volumeScore = 65;
  else if (volRatio < 0.7) volumeScore = 35;
  const volumeSignal = volRatio > 1.2 ? 'Above average volume' : 
                       volRatio < 0.8 ? 'Below average volume' : 'Normal volume';
  
  // Volatility score
  let volatilityScore = 50;
  if (volatility.regime === 'expanding' || volatility.regime === 'low') volatilityScore = 70;
  else if (volatility.regime === 'contracting') volatilityScore = 60;
  else if (volatility.regime === 'high') volatilityScore = 40;
  const volatilitySignal = `${volatility.regime.charAt(0).toUpperCase() + volatility.regime.slice(1)} volatility`;
  
  // Pattern score (simplified - based on recent price action)
  const recentBars = bars.slice(-5);
  const bullishCandles = recentBars.filter(b => b.close > b.open).length;
  let patternScore = 50;
  if (bullishCandles >= 4) patternScore = 75;
  else if (bullishCandles >= 3) patternScore = 60;
  else if (bullishCandles <= 1) patternScore = 40;
  else if (bullishCandles === 0) patternScore = 25;
  const patternSignal = bullishCandles >= 3 ? 'Bullish price action' :
                        bullishCandles <= 2 ? 'Bearish price action' : 'Mixed price action';
  
  // Weights
  const weights = {
    trend: 0.30,
    momentum: 0.25,
    volume: 0.15,
    volatility: 0.15,
    pattern: 0.15
  };
  
  // Calculate overall score
  const overall = Math.round(
    trendScore * weights.trend +
    momentumScore * weights.momentum +
    volumeScore * weights.volume +
    volatilityScore * weights.volatility +
    patternScore * weights.pattern
  );
  
  // Determine direction
  let direction: 'bullish' | 'bearish' | 'neutral';
  if (momentum.direction === 'bullish' && trend.emaAlignment !== 'bearish') {
    direction = 'bullish';
  } else if (momentum.direction === 'bearish' && trend.emaAlignment !== 'bullish') {
    direction = 'bearish';
  } else {
    direction = 'neutral';
  }
  
  // Determine grade
  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  if (overall >= 85) grade = 'A+';
  else if (overall >= 75) grade = 'A';
  else if (overall >= 60) grade = 'B';
  else if (overall >= 45) grade = 'C';
  else if (overall >= 30) grade = 'D';
  else grade = 'F';
  
  return {
    overall,
    direction,
    grade,
    breakdown: {
      trend: { score: trendScore, weight: weights.trend, signal: trendSignal },
      momentum: { score: momentumScore, weight: weights.momentum, signal: momentumSignal },
      volume: { score: volumeScore, weight: weights.volume, signal: volumeSignal },
      volatility: { score: volatilityScore, weight: weights.volatility, signal: volatilitySignal },
      pattern: { score: patternScore, weight: weights.pattern, signal: patternSignal }
    }
  };
}

/**
 * Generate strategy recommendations based on technical analysis
 */
export function generateStrategyRecommendation(
  bars: OHLCV[],
  momentum: MomentumAssessment,
  trend: TrendAssessment,
  volatility: VolatilityAssessment,
  signalStrength: SignalStrength,
  supportResistance: {
    support: { price: number; touches: number; strength: number }[];
    resistance: { price: number; touches: number; strength: number }[];
  }
): StrategyRecommendation {
  const currentPrice = bars[bars.length - 1].close;
  const atr = volatility.current;
  
  // Get key levels
  const nearestSupport = supportResistance.support[0]?.price || currentPrice - atr * 2;
  const nearestResistance = supportResistance.resistance[0]?.price || currentPrice + atr * 2;
  
  // Determine strategy and direction
  let strategy: string;
  let direction: 'long' | 'short' | 'wait';
  let confidence: number;
  
  // Stronger criteria for directional trades
  const strongBullish = signalStrength.direction === 'bullish' && 
                        signalStrength.overall >= 55 && 
                        (momentum.strength === 'strong' || momentum.strength === 'moderate');
  const strongBearish = signalStrength.direction === 'bearish' && 
                        signalStrength.overall >= 55 && 
                        (momentum.strength === 'strong' || momentum.strength === 'moderate');
  
  if (signalStrength.grade === 'F' || signalStrength.grade === 'D' || signalStrength.overall < 40) {
    strategy = 'No Trade - Weak Setup';
    direction = 'wait';
    confidence = signalStrength.overall;
  } else if (strongBullish) {
    if (trend.emaAlignment === 'bullish' && momentum.strength === 'strong') {
      strategy = 'Trend Following Long';
      confidence = Math.min(85, signalStrength.overall + 10);
    } else if (volatility.regime === 'low' || volatility.regime === 'contracting') {
      strategy = 'Breakout Long';
      confidence = signalStrength.overall;
    } else {
      strategy = 'Pullback Long';
      confidence = Math.max(40, signalStrength.overall - 10);
    }
    direction = 'long';
  } else if (strongBearish) {
    if (trend.emaAlignment === 'bearish' && momentum.strength === 'strong') {
      strategy = 'Trend Following Short';
      confidence = Math.min(85, signalStrength.overall + 10);
    } else if (volatility.regime === 'low' || volatility.regime === 'contracting') {
      strategy = 'Breakdown Short';
      confidence = signalStrength.overall;
    } else {
      strategy = 'Rally Short';
      confidence = Math.max(40, signalStrength.overall - 10);
    }
    direction = 'short';
  } else {
    // Neutral/mixed signals - recommend waiting
    strategy = 'No Clear Edge - Wait for Confirmation';
    direction = 'wait';
    confidence = Math.min(40, signalStrength.overall);
  }
  
  // Entry calculation
  let entryType: 'market' | 'limit' | 'breakout' | 'pullback';
  let entryPrice: number;
  const conditions: string[] = [];
  
  if (direction === 'long') {
    if (strategy.includes('Breakout')) {
      entryType = 'breakout';
      entryPrice = Number((nearestResistance + atr * 0.05).toFixed(2));
      conditions.push(`Break above resistance at $${nearestResistance.toFixed(2)}`);
      conditions.push('Requires volume confirmation (Z-score > 1)');
    } else if (strategy.includes('Pullback')) {
      entryType = 'pullback';
      entryPrice = Number((nearestSupport + atr * 0.1).toFixed(2));
      conditions.push(`Wait for pullback to $${nearestSupport.toFixed(2)} zone`);
      conditions.push('Enter on bullish reversal candle');
    } else {
      entryType = 'market';
      entryPrice = currentPrice;
      conditions.push('Enter at market with tight stop');
    }
  } else if (direction === 'short') {
    if (strategy.includes('Breakdown')) {
      entryType = 'breakout';
      entryPrice = Number((nearestSupport - atr * 0.05).toFixed(2));
      conditions.push(`Break below support at $${nearestSupport.toFixed(2)}`);
      conditions.push('Requires volume confirmation (Z-score > 1)');
    } else if (strategy.includes('Rally')) {
      entryType = 'pullback';
      entryPrice = Number((nearestResistance - atr * 0.1).toFixed(2));
      conditions.push(`Wait for rally to $${nearestResistance.toFixed(2)} zone`);
      conditions.push('Enter on bearish reversal candle');
    } else {
      entryType = 'market';
      entryPrice = currentPrice;
      conditions.push('Enter at market with tight stop');
    }
  } else {
    // Wait scenario - show what would trigger a trade
    entryType = 'breakout';
    entryPrice = currentPrice; // Placeholder
    conditions.push(`LONG: Break above $${nearestResistance.toFixed(2)} with volume`);
    conditions.push(`SHORT: Break below $${nearestSupport.toFixed(2)} with volume`);
  }
  
  // Stop loss calculation
  let stopPrice: number;
  let stopReason: string;
  
  if (direction === 'long') {
    // Stop below entry by 1.5x ATR or below nearest support
    stopPrice = Math.max(
      entryPrice - atr * 1.5,
      nearestSupport - atr * 0.2
    );
    // Ensure stop is below entry
    if (stopPrice >= entryPrice) {
      stopPrice = entryPrice - atr * 1.5;
    }
    stopReason = `Below support with ATR buffer`;
  } else if (direction === 'short') {
    // Stop above entry by 1.5x ATR or above nearest resistance
    stopPrice = Math.min(
      entryPrice + atr * 1.5,
      nearestResistance + atr * 0.2
    );
    // Ensure stop is above entry
    if (stopPrice <= entryPrice) {
      stopPrice = entryPrice + atr * 1.5;
    }
    stopReason = `Above resistance with ATR buffer`;
  } else {
    // Wait scenario - no real stop
    stopPrice = nearestSupport;
    stopReason = 'No trade - showing nearest support level';
  }
  
  const riskPercent = Math.abs((entryPrice - stopPrice) / entryPrice) * 100;
  
  // Target calculations - only for directional trades
  let targets: StrategyRecommendation['targets'];
  
  if (direction === 'long') {
    const riskAmount = entryPrice - stopPrice;
    targets = {
      t1: {
        price: Number((entryPrice + riskAmount * 1.5).toFixed(2)),
        rr: 1.5,
        probability: 65
      },
      t2: {
        price: Number((entryPrice + riskAmount * 2.5).toFixed(2)),
        rr: 2.5,
        probability: 45
      },
      t3: {
        price: Number((entryPrice + riskAmount * 4).toFixed(2)),
        rr: 4,
        probability: 25
      }
    };
  } else if (direction === 'short') {
    const riskAmount = stopPrice - entryPrice;
    targets = {
      t1: {
        price: Number((entryPrice - riskAmount * 1.5).toFixed(2)),
        rr: 1.5,
        probability: 65
      },
      t2: {
        price: Number((entryPrice - riskAmount * 2.5).toFixed(2)),
        rr: 2.5,
        probability: 45
      },
      t3: {
        price: Number((entryPrice - riskAmount * 4).toFixed(2)),
        rr: 4,
        probability: 25
      }
    };
  } else {
    // Wait scenario - show potential breakout targets for reference
    const breakoutRange = nearestResistance - nearestSupport;
    targets = {
      t1: {
        price: Number(nearestResistance.toFixed(2)),
        rr: 0,
        probability: 0
      },
      t2: {
        price: Number((nearestResistance + breakoutRange * 0.5).toFixed(2)),
        rr: 0,
        probability: 0
      },
      t3: {
        price: Number(nearestSupport.toFixed(2)),
        rr: 0,
        probability: 0
      }
    };
  }
  
  // Invalidation message
  let invalidation: string;
  if (direction === 'long') {
    invalidation = `Long trade invalidated if price closes below $${stopPrice.toFixed(2)}`;
  } else if (direction === 'short') {
    invalidation = `Short trade invalidated if price closes above $${stopPrice.toFixed(2)}`;
  } else {
    invalidation = 'Wait for clear directional breakout before taking a position';
  }
  
  // Notes
  const notes: string[] = [];
  notes.push(`Signal: ${signalStrength.grade} (${signalStrength.overall}/100)`);
  notes.push(`Momentum: ${momentum.direction} (${momentum.strength})`);
  notes.push(`Trend: ${trend.emaAlignment} EMAs`);
  notes.push(`Volatility: ${volatility.regime}`);
  
  if (direction === 'wait') {
    notes.push(`Range: $${nearestSupport.toFixed(2)} - $${nearestResistance.toFixed(2)}`);
    notes.push('Wait for breakout with volume confirmation');
  }
  
  if (momentum.divergences.length > 0) {
    notes.push(`⚠️ ${momentum.divergences[0].indicator} divergence detected`);
  }
  
  return {
    strategy,
    direction,
    confidence,
    entry: {
      type: entryType,
      price: Number(entryPrice.toFixed(2)),
      conditions
    },
    stopLoss: {
      price: Number(stopPrice.toFixed(2)),
      reason: stopReason,
      riskPercent: Number(riskPercent.toFixed(2))
    },
    targets,
    invalidation,
    notes
  };
}

