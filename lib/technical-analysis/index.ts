/**
 * Technical Analysis Module - Main Entry Point
 * Pure technical analysis engine - no fundamentals, no news, no options
 * Professional-grade indicator analysis with probability-based predictions
 */

export * from './advanced-indicators';
export * from './probability-engine';

import {
  OHLCV,
  calculateEMA,
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateStochastic,
  calculateADX,
  calculateWilliamsR,
  calculateCCI,
  calculateROC,
  calculateMFI,
  calculateATR,
  calculateBollingerBands,
  calculateKeltnerChannels,
  calculateHistoricalVolatility,
  calculateOBV,
  calculateVWAP,
  calculateVolumeZScore,
  calculateCMF,
  calculateADL,
  calculatePivotPoints,
  calculateFibonacciLevels,
  findSwingLevels,
  detectTTMSqueeze
} from './advanced-indicators';

import {
  assessMomentum,
  assessTrend,
  assessVolatility,
  calculatePriceProjections,
  calculateSignalStrength,
  generateStrategyRecommendation,
  analyzeStructure,
  detectMarketRegime,
  MomentumAssessment,
  TrendAssessment,
  VolatilityAssessment,
  PriceProjection,
  SignalStrength,
  StrategyRecommendation,
  StructureAnalysis
} from './probability-engine';

/**
 * Complete Technical Analysis Report
 */
export interface TechnicalAnalysisReport {
  symbol: string;
  timeframe: string;
  timestamp: string;
  currentPrice: number;
  
  // Core Indicators
  indicators: {
    // Moving Averages
    movingAverages: {
      ema9: number;
      ema20: number;
      ema50: number;
      ema200: number;
      sma20: number;
      sma50: number;
      sma200: number;
      priceVsEma20: number; // % above/below
      priceVsEma50: number;
      priceVsEma200: number;
    };
    
    // Momentum
    momentum: {
      rsi: number;
      rsiSignal: 'overbought' | 'bullish' | 'neutral' | 'bearish' | 'oversold';
      stochasticK: number;
      stochasticD: number;
      stochSignal: 'overbought' | 'bullish' | 'neutral' | 'bearish' | 'oversold';
      macdLine: number;
      macdSignal: number;
      macdHistogram: number;
      macdCrossover: 'bullish' | 'bearish' | 'none';
      williamsR: number;
      cci: number;
      roc: number;
      mfi: number;
    };
    
    // Trend
    trend: {
      adx: number;
      plusDI: number;
      minusDI: number;
      trendStrength: 'strong' | 'moderate' | 'weak' | 'no-trend';
      trendDirection: 'bullish' | 'bearish' | 'neutral';
    };
    
    // Volatility
    volatility: {
      atr: number;
      atrPercent: number;
      bollingerUpper: number;
      bollingerMiddle: number;
      bollingerLower: number;
      bollingerBandwidth: number;
      bollingerPercentB: number;
      keltnerUpper: number;
      keltnerMiddle: number;
      keltnerLower: number;
      historicalVolatility: number;
    };
    
    // Volume
    volume: {
      current: number;
      average20: number;
      zScore: number;
      obv: number;
      obvTrend: 'rising' | 'falling' | 'flat';
      cmf: number;
      volumeSignal: 'high' | 'normal' | 'low';
    };
  };
  
  // Key Levels
  levels: {
    pivotPoints: {
      pp: number;
      r1: number;
      r2: number;
      r3: number;
      s1: number;
      s2: number;
      s3: number;
    };
    fibonacci: {
      high: number;
      low: number;
      direction: 'up' | 'down';
      levels: { ratio: number; price: number; label: string }[];
    };
    supportResistance: {
      support: { price: number; touches: number; strength: number }[];
      resistance: { price: number; touches: number; strength: number }[];
    };
    // Categorized levels for display
    nearTerm: {
      support: { price: number; touches: number; strength: number }[];
      resistance: { price: number; touches: number; strength: number }[];
    };
    historical: {
      support: { price: number; touches: number; strength: number }[];
      resistance: { price: number; touches: number; strength: number }[];
    };
    atrBased: {
      support1: number;
      support2: number;
      support3: number;
      resistance1: number;
      resistance2: number;
      resistance3: number;
    };
  };
  
  // Squeeze Detection
  squeeze: {
    isInSqueeze: boolean;
    squeezeDuration: number;
    momentum: number;
    momentumDirection: 'bullish' | 'bearish' | 'neutral';
    historyStates: ('on' | 'off' | 'fire')[];
  };
  
  // Assessments
  assessments: {
    momentum: MomentumAssessment;
    trend: TrendAssessment;
    volatility: VolatilityAssessment;
  };
  
  // Structure Analysis (pullback vs reversal)
  structureAnalysis: StructureAnalysis;
  
  // Projections
  projections: PriceProjection;
  
  // Signal Strength
  signalStrength: SignalStrength;
  
  // Strategy Recommendation
  recommendation: StrategyRecommendation;

  // Detected Regime (for AI context)
  detectedRegime: any;
  
  // AI Summary (to be filled by LLM)
  aiSummary?: {
    headline: string;
    technicalOutlook: string;
    keyInsights: string[];
    riskFactors: string[];
    tradingPlan: string;
    confidenceLevel: 'high' | 'medium' | 'low';
  };

  // AI-Enhanced structured data (replaces hardcoded logic)
  aiEnhanced?: {
    signalStrength: {
      overall: number;
      grade: string;
      direction: string;
      reasoning: string[];
      breakdown: any;
    };
    priceProjections: {
      bullCase: any;
      baseCase: any;
      bearCase: any;
      mostLikely: string;
    };
    recommendation: {
      action: string;
      strategy: string;
      confidence: number;
      confidenceReasoning: string;
      entry: any;
      stopLoss: any;
      targets: any;
      invalidation: string;
      keyRisks: string[];
      keyOpportunities: string[];
    };
  };
}

/**
 * Run complete technical analysis
 */
export function runTechnicalAnalysis(
  bars: OHLCV[],
  symbol: string,
  timeframe: string
): TechnicalAnalysisReport {
  const closes = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);
  const currentPrice = closes[closes.length - 1];
  
  // =====================
  // Calculate all indicators
  // =====================
  
  // Moving Averages
  const ema9Array = calculateEMA(closes, 9);
  const ema20Array = calculateEMA(closes, 20);
  const ema50Array = calculateEMA(closes, 50);
  const ema200Array = calculateEMA(closes, 200);
  const sma20Array = calculateSMA(closes, 20);
  const sma50Array = calculateSMA(closes, 50);
  const sma200Array = calculateSMA(closes, 200);
  
  const ema9 = ema9Array[ema9Array.length - 1] || currentPrice;
  const ema20 = ema20Array[ema20Array.length - 1] || currentPrice;
  const ema50 = ema50Array[ema50Array.length - 1] || currentPrice;
  const ema200 = ema200Array[ema200Array.length - 1] || currentPrice;
  const sma20 = sma20Array[sma20Array.length - 1] || currentPrice;
  const sma50 = sma50Array[sma50Array.length - 1] || currentPrice;
  const sma200 = sma200Array[sma200Array.length - 1] || currentPrice;
  
  // Momentum Indicators
  const rsiArray = calculateRSI(closes);
  const rsi = rsiArray[rsiArray.length - 1] || 50;
  const rsiSignal: 'overbought' | 'bullish' | 'neutral' | 'bearish' | 'oversold' = 
    rsi > 70 ? 'overbought' : rsi > 55 ? 'bullish' : rsi > 45 ? 'neutral' : rsi > 30 ? 'bearish' : 'oversold';
  
  const stoch = calculateStochastic(bars);
  const stochasticK = stoch.k[stoch.k.length - 1] || 50;
  const stochasticD = stoch.d[stoch.d.length - 1] || 50;
  const stochSignal: 'overbought' | 'bullish' | 'neutral' | 'bearish' | 'oversold' = 
    stochasticK > 80 ? 'overbought' : stochasticK > 50 ? 'bullish' : stochasticK > 20 ? 'neutral' : stochasticK > 0 ? 'bearish' : 'oversold';
  
  const macd = calculateMACD(closes);
  const macdLine = macd.macd[macd.macd.length - 1] || 0;
  const macdSignal = macd.signal[macd.signal.length - 1] || 0;
  const macdHistogram = macd.histogram[macd.histogram.length - 1] || 0;
  const prevHistogram = macd.histogram[macd.histogram.length - 2] || 0;
  const macdCrossover: 'bullish' | 'bearish' | 'none' = 
    macdHistogram > 0 && prevHistogram <= 0 ? 'bullish' :
    macdHistogram < 0 && prevHistogram >= 0 ? 'bearish' : 'none';
  
  const williamsRArray = calculateWilliamsR(bars);
  const williamsR = williamsRArray[williamsRArray.length - 1] || -50;
  
  const cciArray = calculateCCI(bars);
  const cci = cciArray[cciArray.length - 1] || 0;
  
  const rocArray = calculateROC(closes);
  const roc = rocArray[rocArray.length - 1] || 0;
  
  const mfiArray = calculateMFI(bars);
  const mfi = mfiArray[mfiArray.length - 1] || 50;
  
  // Trend Indicators
  const adxData = calculateADX(bars);
  const adx = adxData.adx[adxData.adx.length - 1] || 0;
  const plusDI = adxData.plusDI[adxData.plusDI.length - 1] || 0;
  const minusDI = adxData.minusDI[adxData.minusDI.length - 1] || 0;
  const trendDirection: 'bullish' | 'bearish' | 'neutral' = 
    plusDI > minusDI + 5 ? 'bullish' : minusDI > plusDI + 5 ? 'bearish' : 'neutral';
  
  // Volatility Indicators
  const atrArray = calculateATR(bars);
  const atr = atrArray[atrArray.length - 1] || 0;
  const atrPercent = (atr / currentPrice) * 100;
  
  const bb = calculateBollingerBands(closes);
  const bollingerUpper = bb.upper[bb.upper.length - 1] || currentPrice;
  const bollingerMiddle = bb.middle[bb.middle.length - 1] || currentPrice;
  const bollingerLower = bb.lower[bb.lower.length - 1] || currentPrice;
  const bollingerBandwidth = bb.bandwidth[bb.bandwidth.length - 1] || 0;
  const bollingerPercentB = bb.percentB[bb.percentB.length - 1] || 0.5;
  
  const kc = calculateKeltnerChannels(bars);
  const keltnerUpper = kc.upper[kc.upper.length - 1] || currentPrice;
  const keltnerMiddle = kc.middle[kc.middle.length - 1] || currentPrice;
  const keltnerLower = kc.lower[kc.lower.length - 1] || currentPrice;
  
  const hvArray = calculateHistoricalVolatility(closes);
  const historicalVolatility = hvArray[hvArray.length - 1] || 0;
  
  // Volume Indicators
  const currentVolume = volumes[volumes.length - 1];
  const avg20Volume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const volZScoreArray = calculateVolumeZScore(bars);
  const volZScore = volZScoreArray[volZScoreArray.length - 1] || 0;
  
  const obvArray = calculateOBV(bars);
  const obv = obvArray[obvArray.length - 1] || 0;
  const obvPrev = obvArray[obvArray.length - 6] || 0;
  const obvTrend: 'rising' | 'falling' | 'flat' = 
    obv > obvPrev * 1.02 ? 'rising' : obv < obvPrev * 0.98 ? 'falling' : 'flat';
  
  const cmfArray = calculateCMF(bars);
  const cmf = cmfArray[cmfArray.length - 1] || 0;
  
  const volumeSignal: 'high' | 'normal' | 'low' = 
    volZScore > 1.5 ? 'high' : volZScore < -1 ? 'low' : 'normal';
  
  // =====================
  // Key Levels
  // =====================
  
  const pivotPoints = calculatePivotPoints(bars);
  const fibonacci = calculateFibonacciLevels(bars);
  const supportResistance = findSwingLevels(bars);
  
  // Categorize support/resistance into near-term (actionable) vs historical (reference)
  const maxNearTermDistance = atr * 3; // Levels within 3x ATR are considered near-term
  
  const nearTermSupport = supportResistance.support.filter(
    s => currentPrice - s.price <= maxNearTermDistance && s.price < currentPrice
  );
  const nearTermResistance = supportResistance.resistance.filter(
    r => r.price - currentPrice <= maxNearTermDistance && r.price > currentPrice
  );
  const historicalSupport = supportResistance.support.filter(
    s => currentPrice - s.price > maxNearTermDistance
  );
  const historicalResistance = supportResistance.resistance.filter(
    r => r.price - currentPrice > maxNearTermDistance
  );
  
  // Add ATR-based dynamic levels for trading
  const atrBasedLevels = {
    support1: Number((currentPrice - atr).toFixed(2)),
    support2: Number((currentPrice - atr * 1.5).toFixed(2)),
    support3: Number((currentPrice - atr * 2).toFixed(2)),
    resistance1: Number((currentPrice + atr).toFixed(2)),
    resistance2: Number((currentPrice + atr * 1.5).toFixed(2)),
    resistance3: Number((currentPrice + atr * 2).toFixed(2))
  };
  
  // =====================
  // Squeeze Detection
  // =====================
  
  const squeeze = detectTTMSqueeze(bars);
  
  // =====================
  // Assessments
  // =====================
  
  const momentumAssessment = assessMomentum(bars);
  const trendAssessment = assessTrend(bars);
  const volatilityAssessment = assessVolatility(bars);
  
  // =====================
  // Structure Analysis (Pullback vs Reversal) - Calculate FIRST
  // =====================
  
  const structureAnalysis = analyzeStructure(
    bars,
    momentumAssessment,
    trendAssessment,
    volatilityAssessment,
    nearTermSupport,
    nearTermResistance
  );
  
  // =====================
  // Projections & Signals
  // =====================
  
  // =====================
  // Projections & Signals
  // =====================
  
  const projections = calculatePriceProjections(bars, momentumAssessment, trendAssessment, volatilityAssessment);
  
  // FIXED: Pass ADX and volume flow data for proper signal weighting
  const signalStrength = calculateSignalStrength(
    bars, 
    momentumAssessment, 
    trendAssessment, 
    volatilityAssessment,
    { adx, plusDI, minusDI },  // ADX data for trend strength scaling
    { obvTrend, cmf }          // Volume flow for conviction adjustment
  );
  
  // Generate recommendation with structure context, oscillator data, ADX, squeeze, and volume flow for regime classification
  const recommendation = generateStrategyRecommendation(
    bars, 
    momentumAssessment, 
    trendAssessment, 
    volatilityAssessment, 
    signalStrength,
    supportResistance,
    // Pass structure context for strategy alignment
    {
      classification: structureAnalysis.classification,
      priorTrendDirection: structureAnalysis.priorTrendDirection,
      dominantBias: structureAnalysis.dominantBias
    },
    // Pass oscillator values for overbought/oversold and squeeze detection
    {
      stochK: stochasticK,
      mfi: mfi,
      historicalVolatility: historicalVolatility,
      bollingerBandwidth: bollingerBandwidth,
      bollingerB: bollingerPercentB * 100
    },
    // ADX value for regime-first classification
    adx,
    // TTM Squeeze data for compression regime detection
    {
      isInSqueeze: squeeze.isInSqueeze,
      squeezeDuration: squeeze.squeezeDuration,
      momentum: squeeze.momentum,
      momentumDirection: squeeze.momentumDirection
    },
    // Volume flow data for confirmation
    {
      obvTrend: obvTrend,
      cmf: cmf,
      volumeZScore: volZScore
    }
  );

  // =====================
  // Market Regime Detection
  // =====================
  
  const detectedRegime = detectMarketRegime(
    adx,
    trendAssessment.emaAlignment,
    structureAnalysis.priorTrendDirection,
    structureAnalysis.classification,
    volatilityAssessment.regime,
    bollingerBandwidth,
    atrPercent,
    squeeze.isInSqueeze,
    squeeze.momentumDirection,
    stochasticK,
    rsi,
    cmf,
    obvTrend,
    volZScore,
    nearTermResistance.length > 0 && Math.abs(nearTermResistance[0].price - currentPrice) < atr,
    nearTermSupport.length > 0 && Math.abs(currentPrice - nearTermSupport[0].price) < atr,
    false, // brokeSwingHigh - simplified for now
    false  // brokeSwingLow - simplified for now
  );
  
  // =====================
  // Compile Report
  // =====================
  
  return {
    symbol,
    timeframe,
    timestamp: new Date().toISOString(),
    currentPrice,
    
    indicators: {
      movingAverages: {
        ema9,
        ema20,
        ema50,
        ema200,
        sma20,
        sma50,
        sma200,
        priceVsEma20: ((currentPrice - ema20) / ema20) * 100,
        priceVsEma50: ((currentPrice - ema50) / ema50) * 100,
        priceVsEma200: ((currentPrice - ema200) / ema200) * 100
      },
      momentum: {
        rsi,
        rsiSignal,
        stochasticK,
        stochasticD,
        stochSignal,
        macdLine,
        macdSignal,
        macdHistogram,
        macdCrossover,
        williamsR,
        cci,
        roc,
        mfi
      },
      trend: {
        adx,
        plusDI,
        minusDI,
        trendStrength: adxData.trendStrength,
        trendDirection
      },
      volatility: {
        atr,
        atrPercent,
        bollingerUpper,
        bollingerMiddle,
        bollingerLower,
        bollingerBandwidth,
        bollingerPercentB,
        keltnerUpper,
        keltnerMiddle,
        keltnerLower,
        historicalVolatility
      },
      volume: {
        current: currentVolume,
        average20: avg20Volume,
        zScore: volZScore,
        obv,
        obvTrend,
        cmf,
        volumeSignal
      }
    },
    
    levels: {
      pivotPoints,
      fibonacci,
      supportResistance,
      // Categorized levels for clearer display
      nearTerm: {
        support: nearTermSupport,
        resistance: nearTermResistance
      },
      historical: {
        support: historicalSupport,
        resistance: historicalResistance
      },
      atrBased: atrBasedLevels
    },
    
    squeeze,
    
    assessments: {
      momentum: momentumAssessment,
      trend: trendAssessment,
      volatility: volatilityAssessment
    },
    
    structureAnalysis,
    
    projections,
    signalStrength,
    recommendation,
    detectedRegime
  };
}

/**
 * Generate AI summary prompt for the technical analysis
 */
export function generateAISummaryPrompt(report: TechnicalAnalysisReport): string {
  const { indicators, assessments, projections, signalStrength, recommendation, levels, squeeze, structureAnalysis } = report;
  const isWait = recommendation.direction === 'wait';
  
  return `You are a professional technical analyst. Analyze this PURELY TECHNICAL data and provide a concise, CONSISTENT, actionable summary.

SYMBOL: ${report.symbol}
TIMEFRAME: ${report.timeframe}
CURRENT PRICE: $${report.currentPrice.toFixed(2)}

=== RECOMMENDATION CONTEXT ===
${isWait ? `⚠️ IMPORTANT: The system recommends WAIT/NO TRADE. Your summary MUST reflect this - do NOT suggest entry points or trade directions. Focus on what conditions would need to change for a trade.` : `Direction: ${recommendation.direction.toUpperCase()} trade recommended with ${recommendation.confidence}% confidence.`}

=== SIGNAL STRENGTH ===
Overall: ${signalStrength.overall}/100 (Grade: ${signalStrength.grade})
Direction Bias: ${signalStrength.direction}
Breakdown:
- Trend: ${signalStrength.breakdown.trend.score}/100 - ${signalStrength.breakdown.trend.signal}
- Momentum: ${signalStrength.breakdown.momentum.score}/100 - ${signalStrength.breakdown.momentum.signal}
- Volume: ${signalStrength.breakdown.volume.score}/100 - ${signalStrength.breakdown.volume.signal}
- Volatility: ${signalStrength.breakdown.volatility.score}/100 - ${signalStrength.breakdown.volatility.signal}
- Pattern: ${signalStrength.breakdown.pattern.score}/100 - ${signalStrength.breakdown.pattern.signal}

=== KEY INDICATORS ===
RSI: ${indicators.momentum.rsi.toFixed(1)} (${indicators.momentum.rsiSignal})
MACD Line: ${indicators.momentum.macdLine.toFixed(4)}
MACD Histogram: ${indicators.momentum.macdHistogram.toFixed(4)} (${indicators.momentum.macdCrossover} crossover)
Stochastic: %K=${indicators.momentum.stochasticK.toFixed(1)}, %D=${indicators.momentum.stochasticD.toFixed(1)} (${indicators.momentum.stochSignal})
ADX: ${indicators.trend.adx.toFixed(1)} (${indicators.trend.adx < 20 ? 'weak/no trend' : indicators.trend.adx < 40 ? 'moderate trend' : 'strong trend'})
Volume Z-Score: ${indicators.volume.zScore.toFixed(2)} (${indicators.volume.volumeSignal})

=== EMA ALIGNMENT ===
EMA9: $${indicators.movingAverages.ema9.toFixed(2)}
EMA20: $${indicators.movingAverages.ema20.toFixed(2)} (${indicators.movingAverages.priceVsEma20 > 0 ? 'above' : 'below'} by ${Math.abs(indicators.movingAverages.priceVsEma20).toFixed(1)}%)
EMA50: $${indicators.movingAverages.ema50.toFixed(2)} (${indicators.movingAverages.priceVsEma50 > 0 ? 'above' : 'below'} by ${Math.abs(indicators.movingAverages.priceVsEma50).toFixed(1)}%)
EMA200: $${indicators.movingAverages.ema200.toFixed(2)} (${indicators.movingAverages.priceVsEma200 > 0 ? 'above' : 'below'} by ${Math.abs(indicators.movingAverages.priceVsEma200).toFixed(1)}%)
Alignment: ${assessments.trend.emaAlignment}
Price Location: ${assessments.trend.priceLocation}

=== VOLATILITY ===
ATR: $${indicators.volatility.atr.toFixed(2)} (${indicators.volatility.atrPercent.toFixed(1)}%)
Bollinger %B: ${(indicators.volatility.bollingerPercentB * 100).toFixed(1)}%
Regime: ${assessments.volatility.regime}
Historical Volatility: ${indicators.volatility.historicalVolatility.toFixed(1)}%

=== SQUEEZE ===
TTM Squeeze Active: ${squeeze.isInSqueeze ? 'YES' : 'NO'}
${squeeze.isInSqueeze ? `Duration: ${squeeze.squeezeDuration} bars` : ''}
Momentum Direction: ${squeeze.momentumDirection}

=== KEY LEVELS ===
Support: ${levels.supportResistance.support.slice(0, 3).map(s => `$${s.price.toFixed(2)} (${s.touches} touches)`).join(', ') || 'None detected'}
Resistance: ${levels.supportResistance.resistance.slice(0, 3).map(r => `$${r.price.toFixed(2)} (${r.touches} touches)`).join(', ') || 'None detected'}
Pivot Point: $${levels.pivotPoints.pp.toFixed(2)}

=== MOMENTUM ASSESSMENT ===
Score: ${assessments.momentum.score}/100
Strength: ${assessments.momentum.strength}
Direction: ${assessments.momentum.direction}
Key Factors: ${assessments.momentum.keyFactors.join(', ')}
${assessments.momentum.divergences.length > 0 ? `⚠️ Divergences: ${assessments.momentum.divergences.map(d => d.description).join('; ')}` : ''}

=== PRICE ACTION & STRUCTURE ===
Classification: ${structureAnalysis.classification.toUpperCase().replace('-', ' ')}
Confidence: ${structureAnalysis.confidence}%
Prior Trend: ${structureAnalysis.priorTrendDirection}
Structure Intact: ${structureAnalysis.structureIntact ? 'YES' : 'NO'}
Pullback Signals: ${structureAnalysis.pullbackSignals.length > 0 ? structureAnalysis.pullbackSignals.join('; ') : 'None'}
Reversal Signals: ${structureAnalysis.reversalSignals.length > 0 ? structureAnalysis.reversalSignals.join('; ') : 'None'}
Summary: ${structureAnalysis.summary}

=== PRICE PROJECTIONS ===
Most Probable: ${projections.mostProbable.direction.toUpperCase()} to $${projections.mostProbable.priceRange.low.toFixed(2)}-$${projections.mostProbable.priceRange.high.toFixed(2)} (${projections.mostProbable.probability}% probability, ${projections.mostProbable.timeframe})

=== STRATEGY RECOMMENDATION ===
Strategy: ${recommendation.strategy}
Direction: ${recommendation.direction.toUpperCase()}
Confidence: ${recommendation.confidence}%
${!isWait ? `Entry: ${recommendation.entry.type} @ $${recommendation.entry.price.toFixed(2)}
Stop Loss: $${recommendation.stopLoss.price.toFixed(2)} (${recommendation.stopLoss.riskPercent.toFixed(1)}% risk)
Targets: T1=$${recommendation.targets.t1.price.toFixed(2)} (${recommendation.targets.t1.rr}:1), T2=$${recommendation.targets.t2.price.toFixed(2)} (${recommendation.targets.t2.rr}:1), T3=$${recommendation.targets.t3.price.toFixed(2)} (${recommendation.targets.t3.rr}:1)` : `Key Levels to Watch:
- Resistance: $${recommendation.targets.t1.price.toFixed(2)} (bullish breakout trigger)
- Support: $${recommendation.targets.t3.price.toFixed(2)} (bearish breakdown trigger)`}
Notes: ${recommendation.notes.join('; ')}

Provide your response in EXACTLY this JSON format:
{
  "headline": "One-line summary (max 100 chars) - ${isWait ? 'MUST reflect NO TRADE/WAIT stance' : 'reflect the recommended direction'}",
  "technicalOutlook": "2-3 sentences based ONLY on indicators above. ${isWait ? 'Explain WHY there is no clear edge and what would need to change.' : 'Support the directional trade recommendation.'}",
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3", "Insight 4"],
  "riskFactors": ["Risk 1", "Risk 2", "Risk 3"],
  "tradingPlan": "${isWait ? 'Describe conditions to watch for a valid trade setup - do NOT suggest immediate entry' : 'Clear trading plan with entry, stop, and targets matching the data above'}",
  "confidenceLevel": "${isWait 
    ? 'low' 
    : (indicators.volume.obvTrend === 'falling' 
        ? (signalStrength.overall >= 55 ? 'medium' : 'low') 
        : signalStrength.overall >= 70 
          ? 'high' 
          : signalStrength.overall >= 55 
            ? 'medium' 
            : 'low')}"
}

CRITICAL RULES:
1. Your summary MUST be CONSISTENT with the recommendation direction (${recommendation.direction.toUpperCase()})
2. ${isWait ? 'Do NOT suggest any specific entry points - the recommendation is to WAIT' : 'Entry/stop/target prices must MATCH the data above exactly'}
3. Do NOT contradict the ADX reading (${indicators.trend.adx.toFixed(1)}) - ${indicators.trend.adx < 20 ? 'this indicates weak/no trend' : indicators.trend.adx < 40 ? 'this indicates moderate trend' : 'this indicates strong trend'}
4. Use the STRUCTURE ANALYSIS (${structureAnalysis.classification}) to contextualize: ${structureAnalysis.classification === 'likely-pullback' ? 'frame as healthy correction in ongoing trend' : structureAnalysis.classification === 'trend-reversal-risk' ? 'warn about potential trend change' : 'acknowledge mixed signals'}
5. Focus ONLY on technical factors - no fundamentals, no news
6. Use ACTUAL numbers from the data provided
7. Probability estimates should be expressed as ranges (e.g., "~60-65%"), not precise values`;
}

