/**
 * Probability Engine - Statistical Price Movement Predictions
 * Based purely on technical analysis, indicators, and historical patterns
 */

import { OHLCV, calculateATR, calculateRSI, calculateMACD, calculateADX, calculateStochastic, calculateBollingerBands } from './advanced-indicators';
import { scanRecentPatternsWithContext, PatternWithContext, CandlestickPattern } from '../patterns/candlestick-v2';

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

export interface StructureAnalysis {
  classification: 'likely-pullback' | 'trend-reversal-risk' | 'mixed';
  confidence: number; // 0-100
  summary: string; // 1-2 sentence trader-friendly explanation
  pullbackSignals: string[]; // Reasons supporting pullback thesis (structure + patterns)
  reversalSignals: string[]; // Reasons supporting reversal thesis (structure + patterns)
  dominantBias: 'pullback' | 'reversal' | 'neutral';
  priorTrendDirection: 'up' | 'down' | 'sideways';
  structureIntact: boolean;
  detectedPatterns: {
    name: string;
    type: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    location: string; // e.g., "at support (current)", "near EMA (3 bars ago)"
    outcome: 'active' | 'confirmed' | 'failed';
    outcomeDescription: string;
  }[];
}

/**
 * Analyze price action and structure to classify current move
 * as pullback, potential reversal, or mixed/unclear
 * Integrates candlestick pattern detection with structural analysis
 */
export function analyzeStructure(
  bars: OHLCV[],
  momentum: MomentumAssessment,
  trend: TrendAssessment,
  volatility: VolatilityAssessment,
  nearTermSupport: { price: number; touches: number; strength: number }[],
  nearTermResistance: { price: number; touches: number; strength: number }[]
): StructureAnalysis {
  if (bars.length < 20) {
    return {
      classification: 'mixed',
      confidence: 0,
      summary: 'Insufficient data for structure analysis',
      pullbackSignals: [],
      reversalSignals: [],
      dominantBias: 'neutral',
      priorTrendDirection: 'sideways',
      structureIntact: false,
      detectedPatterns: []
    };
  }

  const currentPrice = bars[bars.length - 1].close;
  const atr = volatility.current;
  
  // Get recent bars for analysis (last 20 bars)
  const recentBars = bars.slice(-20);
  const last5Bars = bars.slice(-5);
  
  // Calculate EMAs for reference
  const closes = bars.map(b => b.close);
  const ema9 = calculateEMAValue(closes, 9);
  const ema20 = calculateEMAValue(closes, 20);
  const ema50 = calculateEMAValue(closes, 50);
  
  // Find swing highs and lows in recent bars
  const swingPoints = findSwingPoints(bars.slice(-50));
  const recentSwingHigh = swingPoints.highs[0] || { price: currentPrice + atr * 2, index: 0 };
  const recentSwingLow = swingPoints.lows[0] || { price: currentPrice - atr * 2, index: 0 };
  
  // Determine prior trend direction
  let priorTrendDirection: 'up' | 'down' | 'sideways';
  if (trend.primary.direction === 'uptrend') {
    priorTrendDirection = 'up';
  } else if (trend.primary.direction === 'downtrend') {
    priorTrendDirection = 'down';
  } else {
    priorTrendDirection = 'sideways';
  }
  
  // ==========================================
  // CANDLESTICK PATTERN DETECTION
  // ==========================================
  const supportPrices = nearTermSupport.map(s => s.price);
  const resistancePrices = nearTermResistance.map(r => r.price);
  const emaLevels = [ema9, ema20, ema50];
  
  // Scan last 10 bars for candlestick patterns near key levels
  const detectedPatternsRaw = scanRecentPatternsWithContext(
    bars,
    10,
    supportPrices,
    resistancePrices,
    emaLevels
  );
  
  // Convert patterns to the output format with location context and outcome
  const detectedPatterns: StructureAnalysis['detectedPatterns'] = detectedPatternsRaw.map(p => {
    // Build location with both level context AND bar position
    const barPosition = p.barIndex === 0 ? 'current' : `${p.barIndex} bars ago`;
    
    let levelContext = '';
    if (p.nearSupport && p.nearResistance) {
      levelContext = 'at key level';
    } else if (p.nearSupport) {
      levelContext = 'at support';
    } else if (p.nearResistance) {
      levelContext = 'at resistance';
    } else if (p.nearEMA) {
      levelContext = 'near EMA';
    }
    
    // Combine: "near EMA (current)" or "at support (2 bars ago)"
    const location = levelContext 
      ? `${levelContext} (${barPosition})`
      : barPosition;
    
    return {
      name: p.pattern.name,
      type: p.pattern.type,
      confidence: p.pattern.confidence,
      location,
      outcome: p.outcome,
      outcomeDescription: p.outcomeDescription
    };
  });
  
  // ==========================================
  // SIGNAL ARRAYS (declare both early so patterns can add to either)
  // ==========================================
  const pullbackSignals: string[] = [];
  let pullbackScore = 0;
  const reversalSignals: string[] = [];
  let reversalScore = 0;
  
  // 1. Trend still intact (ADX shows trend, EMAs aligned)
  const adxData = calculateADX(bars);
  const currentADX = adxData.adx.filter(v => v !== undefined).pop() || 15;
  const plusDI = adxData.plusDI.filter(v => v !== undefined).pop() || 20;
  const minusDI = adxData.minusDI.filter(v => v !== undefined).pop() || 20;
  
  if (currentADX >= 20) {
    if (priorTrendDirection === 'up' && plusDI > minusDI) {
      pullbackSignals.push('Uptrend intact: ADX ' + currentADX.toFixed(0) + ' with +DI > -DI');
      pullbackScore += 15;
    } else if (priorTrendDirection === 'down' && minusDI > plusDI) {
      pullbackSignals.push('Downtrend intact: ADX ' + currentADX.toFixed(0) + ' with -DI > +DI');
      pullbackScore += 15;
    }
  }
  
  // 2. Higher highs / higher lows (uptrend) or lower highs / lower lows (downtrend)
  const higherLows = checkHigherLows(recentBars);
  const lowerHighs = checkLowerHighs(recentBars);
  
  if (priorTrendDirection === 'up' && higherLows) {
    pullbackSignals.push('Higher lows intact above support - uptrend structure holding');
    pullbackScore += 20;
  } else if (priorTrendDirection === 'down' && lowerHighs) {
    pullbackSignals.push('Lower highs below resistance - downtrend structure holding');
    pullbackScore += 20;
  }
  
  // 3. Small or wick-heavy candles (indecision, not conviction selling/buying)
  const recentCandleAnalysis = analyzeCandleCharacter(last5Bars, atr);
  if (recentCandleAnalysis.smallBodies) {
    pullbackSignals.push('Small candle bodies show weak counter-trend pressure');
    pullbackScore += 10;
  }
  if (recentCandleAnalysis.longWicks) {
    pullbackSignals.push('Long wicks indicate price rejection at extremes');
    pullbackScore += 10;
  }
  
  // 4. Normal or lower volume on the dip/rally
  const volumeAnalysis = analyzeVolumePattern(bars);
  if (volumeAnalysis.decliningOnCounter) {
    pullbackSignals.push('Volume declining on pullback (healthy correction)');
    pullbackScore += 15;
  }
  
  // 5. EMA position analysis - be precise about above/below
  // Calculate actual percentages for accuracy
  const pctFromEma20 = ((currentPrice - ema20) / ema20) * 100;
  const pctFromEma50 = ((currentPrice - ema50) / ema50) * 100;
  
  // Thresholds: "above" means actually above (positive %), "near" means within 1%
  const aboveEMA20 = pctFromEma20 > 0;
  const aboveEMA50 = pctFromEma50 > 0;
  const nearEMA20 = Math.abs(pctFromEma20) <= 1.0; // Within 1%
  const nearEMA50 = Math.abs(pctFromEma50) <= 1.5; // Within 1.5%
  const belowEMA20 = pctFromEma20 < -1.0; // More than 1% below
  const belowEMA50 = pctFromEma50 < -1.5; // More than 1.5% below
  
  if (priorTrendDirection === 'up') {
    // In uptrend, price above EMAs is bullish confirmation
    if (aboveEMA20) {
      pullbackSignals.push('Price above 20 EMA ($' + ema20.toFixed(2) + ')');
      pullbackScore += 15;
    } else if (nearEMA20 && !belowEMA20) {
      pullbackSignals.push('Price testing 20 EMA ($' + ema20.toFixed(2) + ') - watching for bounce');
      pullbackScore += 8;
    }
    
    if (aboveEMA50) {
      pullbackSignals.push('Price above 50 EMA ($' + ema50.toFixed(2) + ')');
      pullbackScore += 10;
    } else if (nearEMA50 && !belowEMA50) {
      pullbackSignals.push('Price near 50 EMA ($' + ema50.toFixed(2) + ') - key support test');
      pullbackScore += 5;
    }
  } else if (priorTrendDirection === 'down') {
    // In downtrend, price below EMAs is bearish confirmation
    if (!aboveEMA20 && belowEMA20) {
      pullbackSignals.push('Price below 20 EMA ($' + ema20.toFixed(2) + ')');
      pullbackScore += 15;
    } else if (nearEMA20) {
      pullbackSignals.push('Price testing 20 EMA ($' + ema20.toFixed(2) + ') - watching for rejection');
      pullbackScore += 8;
    }
    
    if (!aboveEMA50 && belowEMA50) {
      pullbackSignals.push('Price below 50 EMA ($' + ema50.toFixed(2) + ')');
      pullbackScore += 10;
    } else if (nearEMA50) {
      pullbackSignals.push('Price near 50 EMA ($' + ema50.toFixed(2) + ') - key resistance test');
      pullbackScore += 5;
    }
  }
  
  // 6. RSI not extreme / showing divergence
  const rsiArray = calculateRSI(closes, 14);
  const currentRSI = rsiArray[rsiArray.length - 1] || 50;
  if (priorTrendDirection === 'up' && currentRSI >= 35 && currentRSI <= 55) {
    pullbackSignals.push('RSI (' + currentRSI.toFixed(0) + ') in healthy pullback zone');
    pullbackScore += 10;
  } else if (priorTrendDirection === 'down' && currentRSI >= 45 && currentRSI <= 65) {
    pullbackSignals.push('RSI (' + currentRSI.toFixed(0) + ') in healthy rally zone');
    pullbackScore += 10;
  }
  
  // 7. CANDLESTICK PATTERNS - with OUTCOME awareness
  // Track which pattern names we've already processed to avoid duplicates
  const processedPatternsPullback = new Set<string>();
  const processedPatternsReversal = new Set<string>();
  
  for (const p of detectedPatternsRaw) {
    const locationDesc = p.nearSupport ? 'at support' : p.nearResistance ? 'at resistance' : p.nearEMA ? 'near EMA' : '';
    const barsAgo = p.barIndex === 0 ? '' : ` (${p.barIndex} bars ago)`;
    const patternKey = `${p.pattern.name}-${p.pattern.type}`;
    
    // ===== BULLISH patterns in UPTREND =====
    if (priorTrendDirection === 'up' && p.pattern.type === 'bullish') {
      if (p.outcome === 'confirmed' && !processedPatternsPullback.has(patternKey)) {
        // Confirmed bullish pattern = strong pullback confirmation
        const signal = `✓ ${p.pattern.name} ${locationDesc}${barsAgo} confirmed - buyers in control`;
        pullbackSignals.push(signal);
        pullbackScore += 25;
        processedPatternsPullback.add(patternKey);
      } else if (p.outcome === 'active' && p.barIndex <= 2 && (p.nearSupport || p.nearEMA) && !processedPatternsPullback.has(patternKey)) {
        // ONLY recent active patterns (<=2 bars) count as developing
        const signal = `✓ ${p.pattern.name} ${locationDesc} (${p.barIndex === 0 ? 'current' : p.barIndex + ' bars ago'})`;
        pullbackSignals.push(signal);
        pullbackScore += p.pattern.confidence >= 60 ? 15 : 10;
        processedPatternsPullback.add(patternKey);
      } else if (p.outcome === 'failed' && !processedPatternsReversal.has(patternKey)) {
        // FAILED bullish pattern in uptrend = BEARISH warning! Bulls tried and lost
        const signal = `⚠️ Failed ${p.pattern.name}${barsAgo} - bulls rejected, selling pressure`;
        reversalSignals.push(signal);
        reversalScore += 15;
        processedPatternsReversal.add(patternKey);
      }
    }
    
    // ===== BEARISH patterns in UPTREND - key for reversal/confirmation =====
    if (priorTrendDirection === 'up' && p.pattern.type === 'bearish') {
      if (p.outcome === 'failed' && !processedPatternsPullback.has(patternKey)) {
        // FAILED bearish pattern = BULLISH confirmation! Bears tried and lost
        const signal = `✓ Failed ${p.pattern.name}${barsAgo} - bears rejected, bulls in control`;
        pullbackSignals.push(signal);
        pullbackScore += 20;
        processedPatternsPullback.add(patternKey);
      }
      // Active or confirmed bearish patterns handled in reversal section below
    }
    
    // ===== BEARISH patterns in DOWNTREND =====
    if (priorTrendDirection === 'down' && p.pattern.type === 'bearish') {
      if (p.outcome === 'confirmed' && !processedPatternsPullback.has(patternKey)) {
        const signal = `✓ ${p.pattern.name} ${locationDesc}${barsAgo} confirmed - sellers in control`;
        pullbackSignals.push(signal);
        pullbackScore += 25;
        processedPatternsPullback.add(patternKey);
      } else if (p.outcome === 'active' && p.barIndex <= 2 && (p.nearResistance || p.nearEMA) && !processedPatternsPullback.has(patternKey)) {
        const signal = `✓ ${p.pattern.name} ${locationDesc} (${p.barIndex === 0 ? 'current' : p.barIndex + ' bars ago'})`;
        pullbackSignals.push(signal);
        pullbackScore += p.pattern.confidence >= 60 ? 15 : 10;
        processedPatternsPullback.add(patternKey);
      } else if (p.outcome === 'failed' && !processedPatternsReversal.has(patternKey)) {
        // FAILED bearish pattern in downtrend = BULLISH warning
        const signal = `⚠️ Failed ${p.pattern.name}${barsAgo} - sellers rejected, buying pressure`;
        reversalSignals.push(signal);
        reversalScore += 15;
        processedPatternsReversal.add(patternKey);
      }
    }
    
    // ===== BULLISH patterns in DOWNTREND - key for reversal/confirmation =====
    if (priorTrendDirection === 'down' && p.pattern.type === 'bullish') {
      if (p.outcome === 'failed' && !processedPatternsPullback.has(patternKey)) {
        // FAILED bullish pattern = BEARISH confirmation! Bulls tried and lost
        const signal = `✓ Failed ${p.pattern.name}${barsAgo} - bulls rejected, bears in control`;
        pullbackSignals.push(signal);
        pullbackScore += 20;
        processedPatternsPullback.add(patternKey);
      }
    }
  }
  
  // ==========================================
  // REVERSAL SIGNALS (structure breaking) - continued
  // ==========================================
  
  // 1. Break of prior swing high/low
  if (priorTrendDirection === 'up' && currentPrice < recentSwingLow.price) {
    reversalSignals.push('⚠️ Broke prior swing low ($' + recentSwingLow.price.toFixed(2) + ') - structure break');
    reversalScore += 25;
  } else if (priorTrendDirection === 'down' && currentPrice > recentSwingHigh.price) {
    reversalSignals.push('⚠️ Broke prior swing high ($' + recentSwingHigh.price.toFixed(2) + ') - structure break');
    reversalScore += 25;
  }
  
  // 2. Large wide-range candles through support/resistance
  if (recentCandleAnalysis.wideRangeBars) {
    reversalSignals.push('Wide-range candles indicate strong conviction');
    reversalScore += 15;
  }
  
  // Check for key level breaks
  const nearestSupport = nearTermSupport[0]?.price || currentPrice - atr * 2;
  const nearestResistance = nearTermResistance[0]?.price || currentPrice + atr * 2;
  
  if (priorTrendDirection === 'up' && currentPrice < nearestSupport) {
    reversalSignals.push('⚠️ Closed below support ($' + nearestSupport.toFixed(2) + ')');
    reversalScore += 20;
  } else if (priorTrendDirection === 'down' && currentPrice > nearestResistance) {
    reversalSignals.push('⚠️ Closed above resistance ($' + nearestResistance.toFixed(2) + ')');
    reversalScore += 20;
  }
  
  // 3. Elevated volume on the counter-trend move
  if (volumeAnalysis.elevatedOnCounter) {
    reversalSignals.push('⚠️ Elevated volume on counter-trend (distribution)');
    reversalScore += 20;
  }
  
  // 4. Closes below/above key EMAs - use the already calculated percentages
  // Only flag as reversal warning if clearly below (not just touching)
  if (priorTrendDirection === 'up') {
    // In uptrend, being significantly below EMAs is a warning
    if (belowEMA20 && belowEMA50) {
      // Clearly below both - strong warning
      reversalSignals.push('⚠️ Price below both 20 EMA (' + pctFromEma20.toFixed(1) + '%) and 50 EMA (' + pctFromEma50.toFixed(1) + '%)');
      reversalScore += 20;
    } else if (belowEMA50 && !aboveEMA20) {
      // Below 50 EMA and not clearly above 20 EMA
      reversalSignals.push('⚠️ Price below 50 EMA (' + pctFromEma50.toFixed(1) + '%)');
      reversalScore += 12;
    } else if (belowEMA20 && nearEMA50) {
      // Below 20 EMA, testing 50 EMA
      reversalSignals.push('⚠️ Price below 20 EMA, testing 50 EMA support');
      reversalScore += 10;
    }
  } else if (priorTrendDirection === 'down') {
    // In downtrend, being significantly above EMAs is a warning
    const aboveThreshold20 = pctFromEma20 > 1.0;
    const aboveThreshold50 = pctFromEma50 > 1.5;
    
    if (aboveThreshold20 && aboveThreshold50) {
      reversalSignals.push('⚠️ Price above both 20 EMA (+'+ pctFromEma20.toFixed(1) + '%) and 50 EMA (+' + pctFromEma50.toFixed(1) + '%)');
      reversalScore += 20;
    } else if (aboveThreshold50 && aboveEMA20) {
      reversalSignals.push('⚠️ Price above 50 EMA (+' + pctFromEma50.toFixed(1) + '%)');
      reversalScore += 12;
    } else if (aboveThreshold20 && nearEMA50) {
      reversalSignals.push('⚠️ Price above 20 EMA, testing 50 EMA resistance');
      reversalScore += 10;
    }
  }
  
  // 5. Momentum flipping (MACD cross, Stoch cross)
  const macd = calculateMACD(closes);
  const currentHist = macd.histogram[macd.histogram.length - 1] || 0;
  const prevHist = macd.histogram[macd.histogram.length - 2] || 0;
  
  if (priorTrendDirection === 'up' && currentHist < 0 && prevHist > 0) {
    reversalSignals.push('MACD histogram crossed below zero - momentum shift');
    reversalScore += 10;
  } else if (priorTrendDirection === 'down' && currentHist > 0 && prevHist < 0) {
    reversalSignals.push('MACD histogram crossed above zero - momentum shift');
    reversalScore += 10;
  }
  
  // 6. RSI extreme readings
  if (priorTrendDirection === 'up' && currentRSI < 30) {
    reversalSignals.push('⚠️ RSI (' + currentRSI.toFixed(0) + ') deeply oversold - panic selling');
    reversalScore += 10;
  } else if (priorTrendDirection === 'down' && currentRSI > 70) {
    reversalSignals.push('⚠️ RSI (' + currentRSI.toFixed(0) + ') deeply overbought');
    reversalScore += 10;
  }
  
  // 7. OBV divergence / CMF showing distribution
  if (volumeAnalysis.obvDiverging) {
    reversalSignals.push('OBV diverging from price - hidden weakness');
    reversalScore += 10;
  }
  
  // 8. CANDLESTICK PATTERNS - REVERSAL SIGNALS with OUTCOME awareness
  for (const p of detectedPatternsRaw) {
    const locationDesc = p.nearSupport ? 'at support' : p.nearResistance ? 'at resistance' : p.nearEMA ? 'near EMA' : '';
    const barsAgo = p.barIndex === 0 ? '' : ` (${p.barIndex} bars ago)`;
    
    // Skip patterns that have already been handled as pullback confirmations
    // (e.g., failed bearish patterns in uptrend = bullish, already added above)
    
    // ===== BEARISH patterns in UPTREND - potential reversal signals =====
    if (priorTrendDirection === 'up' && p.pattern.type === 'bearish') {
      // Only flag as reversal risk if pattern is ACTIVE or CONFIRMED
      // FAILED patterns were already handled as bullish confirmation above
      if (p.outcome === 'confirmed') {
        // Confirmed bearish pattern in uptrend = serious reversal warning
        const signal = `⚠️ ${p.pattern.name}${barsAgo} CONFIRMED - reversal in progress`;
        if (!reversalSignals.some(s => s.includes(p.pattern.name))) {
          reversalSignals.push(signal);
          reversalScore += 25;
        }
      } else if (p.outcome === 'active' && p.barIndex <= 2) {
        // Active bearish pattern (recent) = watch for confirmation
        const signal = `⚠️ ${p.pattern.name} ${locationDesc} (watch for follow-through)`;
        if (!reversalSignals.some(s => s.includes(p.pattern.name))) {
          reversalSignals.push(signal);
          reversalScore += p.pattern.confidence >= 70 ? 15 : 10;
        }
      }
      // Note: p.outcome === 'failed' is handled in pullback section as bullish confirmation
    }
    
    // ===== BULLISH patterns in DOWNTREND - potential reversal signals =====
    if (priorTrendDirection === 'down' && p.pattern.type === 'bullish') {
      if (p.outcome === 'confirmed') {
        const signal = `⚠️ ${p.pattern.name}${barsAgo} CONFIRMED - reversal in progress`;
        if (!reversalSignals.some(s => s.includes(p.pattern.name))) {
          reversalSignals.push(signal);
          reversalScore += 25;
        }
      } else if (p.outcome === 'active' && p.barIndex <= 2) {
        const signal = `⚠️ ${p.pattern.name} ${locationDesc} (watch for follow-through)`;
        if (!reversalSignals.some(s => s.includes(p.pattern.name))) {
          reversalSignals.push(signal);
          reversalScore += p.pattern.confidence >= 70 ? 15 : 10;
        }
      }
    }
    
    // Also check for patterns breaking key levels
    const isBreakingSupport = nearTermSupport.length > 0 && currentPrice <= nearTermSupport[0].price;
    const isBreakingResistance = nearTermResistance.length > 0 && currentPrice >= nearTermResistance[0].price;
    
    if (priorTrendDirection === 'up' && p.pattern.type === 'bearish' && isBreakingSupport && p.outcome !== 'failed') {
      const signal = `⚠️ ${p.pattern.name} breaking support - high reversal risk`;
      if (!reversalSignals.some(s => s.includes('breaking support'))) {
        reversalSignals.push(signal);
        reversalScore += 20;
      }
    }
    
    if (priorTrendDirection === 'down' && p.pattern.type === 'bullish' && isBreakingResistance && p.outcome !== 'failed') {
      const signal = `⚠️ ${p.pattern.name} breaking resistance - high reversal risk`;
      if (!reversalSignals.some(s => s.includes('breaking resistance'))) {
        reversalSignals.push(signal);
        reversalScore += 20;
      }
    }
  }
  
  // ==========================================
  // CLASSIFICATION
  // ==========================================
  
  // Determine dominant bias and classification
  let classification: 'likely-pullback' | 'trend-reversal-risk' | 'mixed';
  let dominantBias: 'pullback' | 'reversal' | 'neutral';
  let confidence: number;
  let structureIntact: boolean;
  
  const pullbackStrength = Math.min(100, pullbackScore);
  const reversalStrength = Math.min(100, reversalScore);
  const netScore = pullbackStrength - reversalStrength;
  
  if (netScore >= 25 && pullbackStrength >= 40) {
    classification = 'likely-pullback';
    dominantBias = 'pullback';
    confidence = Math.min(85, 50 + netScore / 2);
    structureIntact = true;
  } else if (netScore <= -20 && reversalStrength >= 35) {
    classification = 'trend-reversal-risk';
    dominantBias = 'reversal';
    confidence = Math.min(85, 50 + Math.abs(netScore) / 2);
    structureIntact = false;
  } else {
    classification = 'mixed';
    dominantBias = 'neutral';
    confidence = Math.max(20, 50 - Math.abs(netScore) / 2);
    structureIntact = pullbackStrength > reversalStrength;
  }
  
  // Generate summary with CORRECT pattern context
  // Find a pattern that SUPPORTS the thesis (not failed, correct type, preferably recent)
  let summary: string;
  let patternContext = '';
  
  // Find the best supporting pattern based on thesis
  let supportingPattern: typeof detectedPatterns[0] | null = null;
  let warningPattern: typeof detectedPatterns[0] | null = null;
  
  for (const p of detectedPatterns) {
    // Skip failed patterns from being used as "supporting" evidence
    if (p.outcome === 'failed') {
      // A failed pattern of the OPPOSITE type could be supporting
      // e.g., failed bearish in uptrend = bullish confirmation
      if (priorTrendDirection === 'up' && p.type === 'bearish' && !supportingPattern) {
        supportingPattern = { ...p, name: `Failed ${p.name}` };
      } else if (priorTrendDirection === 'down' && p.type === 'bullish' && !supportingPattern) {
        supportingPattern = { ...p, name: `Failed ${p.name}` };
      }
      // Failed pattern of same type as trend = warning
      else if (priorTrendDirection === 'up' && p.type === 'bullish' && !warningPattern) {
        warningPattern = p;
      } else if (priorTrendDirection === 'down' && p.type === 'bearish' && !warningPattern) {
        warningPattern = p;
      }
      continue;
    }
    
    // For pullback classification in uptrend, bullish patterns support
    if (classification === 'likely-pullback' && priorTrendDirection === 'up') {
      if (p.type === 'bullish' && (p.outcome === 'confirmed' || p.outcome === 'active') && !supportingPattern) {
        supportingPattern = p;
      } else if (p.type === 'bearish' && p.outcome === 'active' && !warningPattern) {
        warningPattern = p;
      }
    }
    // For pullback classification in downtrend, bearish patterns support
    else if (classification === 'likely-pullback' && priorTrendDirection === 'down') {
      if (p.type === 'bearish' && (p.outcome === 'confirmed' || p.outcome === 'active') && !supportingPattern) {
        supportingPattern = p;
      } else if (p.type === 'bullish' && p.outcome === 'active' && !warningPattern) {
        warningPattern = p;
      }
    }
    // For reversal classification, opposite patterns support
    else if (classification === 'trend-reversal-risk') {
      if (priorTrendDirection === 'up' && p.type === 'bearish' && (p.outcome === 'confirmed' || p.outcome === 'active') && !supportingPattern) {
        supportingPattern = p;
      } else if (priorTrendDirection === 'down' && p.type === 'bullish' && (p.outcome === 'confirmed' || p.outcome === 'active') && !supportingPattern) {
        supportingPattern = p;
      }
    }
  }
  
  // Build pattern context based on what we found
  if (supportingPattern) {
    const outcomeNote = supportingPattern.outcome === 'confirmed' ? ' (confirmed)' : '';
    patternContext = ` ${supportingPattern.name} ${supportingPattern.location}${outcomeNote} supports this view.`;
  } else if (warningPattern) {
    if (warningPattern.outcome === 'failed') {
      patternContext = ` Note: ${warningPattern.name} ${warningPattern.location} failed - watch for follow-through.`;
    } else {
      patternContext = ` Caution: ${warningPattern.name} ${warningPattern.location} suggests caution.`;
    }
  }
  
  if (classification === 'likely-pullback') {
    if (priorTrendDirection === 'up') {
      summary = `Healthy pullback in uptrend. Structure intact with higher lows holding.${patternContext}`;
    } else if (priorTrendDirection === 'down') {
      summary = `Normal bounce in downtrend. Lower highs intact, resistance likely to hold.${patternContext}`;
    } else {
      summary = `Correction within range. Price action suggests the recent trend is intact.${patternContext}`;
    }
  } else if (classification === 'trend-reversal-risk') {
    if (priorTrendDirection === 'up') {
      summary = `Potential trend reversal. Multiple signals suggest the uptrend may be breaking down.${patternContext}`;
    } else if (priorTrendDirection === 'down') {
      summary = `Possible trend reversal forming. Downtrend structure showing cracks.${patternContext}`;
    } else {
      summary = `Structure breakout developing. Directional move may be starting.${patternContext}`;
    }
  } else {
    summary = `Mixed signals - no clear edge. ${pullbackSignals.length} pullback vs ${reversalSignals.length} reversal signals.${patternContext}`;
  }
  
  return {
    classification,
    confidence: Math.round(confidence),
    summary,
    pullbackSignals: pullbackSignals.slice(0, 5),
    reversalSignals: reversalSignals.slice(0, 5),
    dominantBias,
    priorTrendDirection,
    structureIntact,
    detectedPatterns
  };
}

// ==========================================
// HELPER FUNCTIONS FOR STRUCTURE ANALYSIS
// ==========================================

function calculateEMAValue(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;
  
  const multiplier = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

function findSwingPoints(bars: OHLCV[]): { 
  highs: { price: number; index: number }[]; 
  lows: { price: number; index: number }[] 
} {
  const highs: { price: number; index: number }[] = [];
  const lows: { price: number; index: number }[] = [];
  
  for (let i = 2; i < bars.length - 2; i++) {
    // Swing high: higher than 2 bars on each side
    if (bars[i].high > bars[i-1].high && bars[i].high > bars[i-2].high &&
        bars[i].high > bars[i+1].high && bars[i].high > bars[i+2].high) {
      highs.push({ price: bars[i].high, index: i });
    }
    
    // Swing low: lower than 2 bars on each side
    if (bars[i].low < bars[i-1].low && bars[i].low < bars[i-2].low &&
        bars[i].low < bars[i+1].low && bars[i].low < bars[i+2].low) {
      lows.push({ price: bars[i].low, index: i });
    }
  }
  
  // Sort by recency (most recent first)
  highs.sort((a, b) => b.index - a.index);
  lows.sort((a, b) => b.index - a.index);
  
  return { highs, lows };
}

function checkHigherLows(bars: OHLCV[]): boolean {
  const lows = bars.map(b => b.low);
  let higherLowCount = 0;
  
  for (let i = 5; i < lows.length; i += 5) {
    const prevMin = Math.min(...lows.slice(Math.max(0, i - 5), i));
    const currMin = Math.min(...lows.slice(i, Math.min(lows.length, i + 5)));
    if (currMin > prevMin * 0.99) higherLowCount++;
  }
  
  return higherLowCount >= 2;
}

function checkLowerHighs(bars: OHLCV[]): boolean {
  const highs = bars.map(b => b.high);
  let lowerHighCount = 0;
  
  for (let i = 5; i < highs.length; i += 5) {
    const prevMax = Math.max(...highs.slice(Math.max(0, i - 5), i));
    const currMax = Math.max(...highs.slice(i, Math.min(highs.length, i + 5)));
    if (currMax < prevMax * 1.01) lowerHighCount++;
  }
  
  return lowerHighCount >= 2;
}

function analyzeCandleCharacter(bars: OHLCV[], atr: number): {
  smallBodies: boolean;
  longWicks: boolean;
  wideRangeBars: boolean;
} {
  let smallBodyCount = 0;
  let longWickCount = 0;
  let wideRangeCount = 0;
  
  for (const bar of bars) {
    const body = Math.abs(bar.close - bar.open);
    const range = bar.high - bar.low;
    const upperWick = bar.high - Math.max(bar.open, bar.close);
    const lowerWick = Math.min(bar.open, bar.close) - bar.low;
    const totalWicks = upperWick + lowerWick;
    
    // Small body (less than 30% of ATR)
    if (body < atr * 0.3) smallBodyCount++;
    
    // Long wicks (wicks > body)
    if (totalWicks > body * 1.5) longWickCount++;
    
    // Wide range bar (range > 1.5x ATR)
    if (range > atr * 1.5) wideRangeCount++;
  }
  
  return {
    smallBodies: smallBodyCount >= Math.ceil(bars.length * 0.5),
    longWicks: longWickCount >= Math.ceil(bars.length * 0.4),
    wideRangeBars: wideRangeCount >= 2
  };
}

function analyzeVolumePattern(bars: OHLCV[]): {
  decliningOnCounter: boolean;
  elevatedOnCounter: boolean;
  obvDiverging: boolean;
} {
  if (bars.length < 20) {
    return { decliningOnCounter: false, elevatedOnCounter: false, obvDiverging: false };
  }
  
  const recentBars = bars.slice(-10);
  const priorBars = bars.slice(-20, -10);
  
  // Calculate average volumes
  const recentAvgVol = recentBars.reduce((sum, b) => sum + b.volume, 0) / recentBars.length;
  const priorAvgVol = priorBars.reduce((sum, b) => sum + b.volume, 0) / priorBars.length;
  
  // Determine if recent move is counter-trend
  const recentClose = recentBars[recentBars.length - 1].close;
  const priorClose = priorBars[priorBars.length - 1].close;
  const priorTrend = priorClose > priorBars[0].close ? 'up' : 'down';
  const recentMove = recentClose > priorClose ? 'up' : 'down';
  const isCounterTrend = priorTrend !== recentMove;
  
  // Volume declining on counter-trend = healthy pullback
  const decliningOnCounter = isCounterTrend && recentAvgVol < priorAvgVol * 0.85;
  
  // Volume elevated on counter-trend = potential reversal
  const elevatedOnCounter = isCounterTrend && recentAvgVol > priorAvgVol * 1.3;
  
  // OBV divergence check
  let obv = 0;
  const obvArray: number[] = [];
  for (const bar of bars.slice(-30)) {
    if (bar.close > bar.open) {
      obv += bar.volume;
    } else if (bar.close < bar.open) {
      obv -= bar.volume;
    }
    obvArray.push(obv);
  }
  
  const priceUp = bars[bars.length - 1].close > bars[bars.length - 10].close;
  const obvUp = obvArray[obvArray.length - 1] > obvArray[obvArray.length - 10];
  const obvDiverging = priceUp !== obvUp;
  
  return { decliningOnCounter, elevatedOnCounter, obvDiverging };
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
  
  // Find RELEVANT key levels (within 3x ATR of current price)
  // This prevents using distant historical levels as entry/exit points
  const maxDistanceForRelevance = atr * 3;
  
  const relevantSupports = supportResistance.support.filter(
    s => currentPrice - s.price <= maxDistanceForRelevance && s.price < currentPrice
  );
  const relevantResistances = supportResistance.resistance.filter(
    r => r.price - currentPrice <= maxDistanceForRelevance && r.price > currentPrice
  );
  
  // Use relevant levels or ATR-based defaults
  const nearestRelevantSupport = relevantSupports[0]?.price || currentPrice - atr * 1.5;
  const nearestRelevantResistance = relevantResistances[0]?.price || currentPrice + atr * 1.5;
  
  // For reference, also get the absolute nearest levels (for wait scenarios)
  const absoluteNearestSupport = supportResistance.support[0]?.price || currentPrice - atr * 2;
  const absoluteNearestResistance = supportResistance.resistance[0]?.price || currentPrice + atr * 2;
  
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
  
  // Entry calculation - USE REALISTIC LEVELS RELATIVE TO CURRENT PRICE
  let entryType: 'market' | 'limit' | 'breakout' | 'pullback';
  let entryPrice: number;
  const conditions: string[] = [];
  
  if (direction === 'long') {
    if (strategy.includes('Breakout')) {
      entryType = 'breakout';
      // Use relevant resistance or ATR-based level
      const breakoutLevel = nearestRelevantResistance;
      entryPrice = Number((breakoutLevel + atr * 0.05).toFixed(2));
      conditions.push(`Break above $${breakoutLevel.toFixed(2)}`);
      conditions.push('Requires volume confirmation (Z-score > 1)');
    } else if (strategy.includes('Pullback')) {
      entryType = 'pullback';
      // Pullback entry should be 0.5-1.5 ATR below current price, NOT at distant support
      const pullbackLevel = currentPrice - atr * 0.75;
      entryPrice = Number(pullbackLevel.toFixed(2));
      conditions.push(`Wait for pullback to $${pullbackLevel.toFixed(2)} zone`);
      conditions.push('Enter on bullish reversal candle');
    } else {
      // Trend Following - market entry
      entryType = 'market';
      entryPrice = currentPrice;
      conditions.push('Enter at market with momentum confirmation');
    }
  } else if (direction === 'short') {
    if (strategy.includes('Breakdown')) {
      entryType = 'breakout';
      // Use relevant support or ATR-based level
      const breakdownLevel = nearestRelevantSupport;
      entryPrice = Number((breakdownLevel - atr * 0.05).toFixed(2));
      conditions.push(`Break below $${breakdownLevel.toFixed(2)}`);
      conditions.push('Requires volume confirmation (Z-score > 1)');
    } else if (strategy.includes('Rally')) {
      entryType = 'pullback';
      // Rally entry should be 0.5-1.5 ATR above current price, NOT at distant resistance
      const rallyLevel = currentPrice + atr * 0.75;
      entryPrice = Number(rallyLevel.toFixed(2));
      conditions.push(`Wait for rally to $${rallyLevel.toFixed(2)} zone`);
      conditions.push('Enter on bearish reversal candle');
    } else {
      // Trend Following - market entry
      entryType = 'market';
      entryPrice = currentPrice;
      conditions.push('Enter at market with momentum confirmation');
    }
  } else {
    // Wait scenario - show what would trigger a trade
    entryType = 'breakout';
    entryPrice = currentPrice; // Placeholder
    conditions.push(`LONG: Break above $${nearestRelevantResistance.toFixed(2)} with volume`);
    conditions.push(`SHORT: Break below $${nearestRelevantSupport.toFixed(2)} with volume`);
  }
  
  // Stop loss calculation - use ATR-based stops for realistic risk management
  let stopPrice: number;
  let stopReason: string;
  
  if (direction === 'long') {
    // Stop 1.5x ATR below entry price
    stopPrice = entryPrice - atr * 1.5;
    
    // If there's a relevant support level nearby, use it as a reference
    if (relevantSupports.length > 0 && nearestRelevantSupport < entryPrice) {
      // Place stop just below the relevant support level
      const supportBasedStop = nearestRelevantSupport - atr * 0.2;
      // Use the tighter of the two stops (but not too tight)
      if (supportBasedStop > entryPrice - atr * 2 && supportBasedStop < stopPrice) {
        stopPrice = supportBasedStop;
      }
    }
    
    stopReason = `${atr.toFixed(2)} ATR below entry`;
  } else if (direction === 'short') {
    // Stop 1.5x ATR above entry price
    stopPrice = entryPrice + atr * 1.5;
    
    // If there's a relevant resistance level nearby, use it as a reference
    if (relevantResistances.length > 0 && nearestRelevantResistance > entryPrice) {
      // Place stop just above the relevant resistance level
      const resistanceBasedStop = nearestRelevantResistance + atr * 0.2;
      // Use the tighter of the two stops (but not too tight)
      if (resistanceBasedStop < entryPrice + atr * 2 && resistanceBasedStop > stopPrice) {
        stopPrice = resistanceBasedStop;
      }
    }
    
    stopReason = `${atr.toFixed(2)} ATR above entry`;
  } else {
    // Wait scenario - show relevant support level for reference
    stopPrice = nearestRelevantSupport;
    stopReason = 'No trade - reference level only';
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
    // Wait scenario - show relevant key levels for reference
    targets = {
      t1: {
        price: Number(nearestRelevantResistance.toFixed(2)),
        rr: 0,
        probability: 0
      },
      t2: {
        price: Number((nearestRelevantResistance + atr).toFixed(2)),
        rr: 0,
        probability: 0
      },
      t3: {
        price: Number(nearestRelevantSupport.toFixed(2)),
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
    notes.push(`Trading range: $${nearestRelevantSupport.toFixed(2)} - $${nearestRelevantResistance.toFixed(2)}`);
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

