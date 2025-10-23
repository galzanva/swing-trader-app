/**
 * Squeeze Indicators Module
 * 
 * Implements:
 * 1. Short Float Squeeze - Based on short interest, days to cover, short volume
 * 2. TTM Squeeze - Based on Bollinger Bands vs Keltner Channels (volatility compression)
 */

interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ShortInterestData {
  shortFloat?: number; // % of float shorted (0-100)
  daysToCover?: number; // Days to cover based on average volume
  shortVolume?: number; // Recent short volume
  shortVolumeRatio?: number; // Short volume / total volume
}

export interface ShortSqueezeAnalysis {
  potential: 'high' | 'moderate' | 'low' | 'none';
  score: number; // 0-100
  daysToCover: number | null;
  shortFloat: number | null; // %
  shortVolumeZ: number | null; // Z-score of short volume
  shortVolumeTrend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
  triggers: string[];
  warnings: string[];
}

export interface TTMSqueezeState {
  state: 'ON' | 'FIRE' | 'OFF'; // ON = squeeze active, FIRE = breakout, OFF = no squeeze
  duration: number; // Number of bars in squeeze
  momentumDirection: 'bullish' | 'bearish' | 'neutral';
  momentumStrength: number; // 0-100
  histogram: number; // Current MACD-style histogram value
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
  };
  keltner: {
    upper: number;
    middle: number;
    lower: number;
  };
}

export interface TTMSqueezeAnalysis {
  current: TTMSqueezeState;
  history: TTMSqueezeState[];
  squeezeDuration: number; // Consecutive bars in squeeze
  fireConfirmed: boolean; // Fire with momentum confirmation
  potentialBreakout: 'bullish' | 'bearish' | 'neutral';
  momentumDirection: 'bullish' | 'bearish' | 'neutral';
  momentumStrength: number; // 0-100 percentage
  histogram: number; // MACD histogram value
  triggers: string[];
  warnings: string[];
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: number; middle: number; lower: number } {
  const recentCloses = closes.slice(-period);
  const middle = recentCloses.reduce((sum, c) => sum + c, 0) / recentCloses.length;
  
  const variance = recentCloses.reduce((sum, c) => sum + Math.pow(c - middle, 2), 0) / recentCloses.length;
  const stdDev = Math.sqrt(variance);
  
  return {
    upper: middle + (stdDevMultiplier * stdDev),
    middle,
    lower: middle - (stdDevMultiplier * stdDev),
  };
}

/**
 * Calculate Keltner Channels
 */
export function calculateKeltnerChannels(
  ohlcv: OHLCV[],
  period: number = 20,
  atrMultiplier: number = 1.5
): { upper: number; middle: number; lower: number } {
  // Calculate EMA of closes for middle line
  const closes = ohlcv.map(bar => bar.close);
  const recentCloses = closes.slice(-period);
  const middle = recentCloses.reduce((sum, c) => sum + c, 0) / recentCloses.length;
  
  // Calculate ATR
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
  const atr = recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length;
  
  return {
    upper: middle + (atrMultiplier * atr),
    middle,
    lower: middle - (atrMultiplier * atr),
  };
}

/**
 * Calculate TTM Squeeze Momentum (MACD-style histogram)
 */
export function calculateSqueezeMomentum(
  ohlcv: OHLCV[],
  length: number = 20,
  mult: number = 2
): number[] {
  const momentum: number[] = [];
  
  for (let i = length; i < ohlcv.length; i++) {
    const slice = ohlcv.slice(i - length, i + 1);
    const closes = slice.map(bar => bar.close);
    const highs = slice.map(bar => bar.high);
    const lows = slice.map(bar => bar.low);
    
    // Calculate highest high and lowest low
    const highest = Math.max(...highs);
    const lowest = Math.min(...lows);
    const midpoint = (highest + lowest) / 2;
    
    // Calculate momentum as deviation from midpoint
    const close = closes[closes.length - 1];
    const mom = close - midpoint;
    momentum.push(mom);
  }
  
  return momentum;
}

/**
 * Detect TTM Squeeze state for each bar
 */
export function detectTTMSqueeze(
  ohlcv: OHLCV[],
  bbPeriod: number = 20,
  bbStdDev: number = 2,
  kcPeriod: number = 20,
  kcAtrMult: number = 1.5
): TTMSqueezeState[] {
  const states: TTMSqueezeState[] = [];
  const closes = ohlcv.map(bar => bar.close);
  const momentum = calculateSqueezeMomentum(ohlcv);
  
  let momentumIndex = 0;
  
  for (let i = Math.max(bbPeriod, kcPeriod); i < ohlcv.length; i++) {
    const sliceData = ohlcv.slice(0, i + 1);
    const sliceCloses = closes.slice(0, i + 1);
    
    const bb = calculateBollingerBands(sliceCloses, bbPeriod, bbStdDev);
    const kc = calculateKeltnerChannels(sliceData, kcPeriod, kcAtrMult);
    
    // Squeeze is ON when Bollinger Bands are inside Keltner Channels
    const squeezeOn = bb.lower > kc.lower && bb.upper < kc.upper;
    
    // Get momentum value
    const mom = momentum[momentumIndex] || 0;
    momentumIndex++;
    
    // Determine momentum direction and strength
    let momentumDirection: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (mom > 0) momentumDirection = 'bullish';
    else if (mom < 0) momentumDirection = 'bearish';
    
    const momentumStrength = Math.min(100, Math.abs(mom) * 10);
    
    // Determine state
    let state: 'ON' | 'FIRE' | 'OFF';
    if (squeezeOn) {
      state = 'ON';
    } else if (i > 0 && states[states.length - 1]?.state === 'ON') {
      // Just fired out of squeeze
      state = 'FIRE';
    } else {
      state = 'OFF';
    }
    
    states.push({
      state,
      duration: 0, // Will be calculated later
      momentumDirection,
      momentumStrength,
      histogram: mom,
      bollinger: bb,
      keltner: kc,
    });
  }
  
  // Calculate squeeze duration for each bar
  let currentDuration = 0;
  for (let i = states.length - 1; i >= 0; i--) {
    if (states[i].state === 'ON') {
      currentDuration++;
      states[i].duration = currentDuration;
    } else {
      currentDuration = 0;
      states[i].duration = 0;
    }
  }
  
  // Reverse duration count (we want it from start of squeeze)
  let squeezeCount = 0;
  for (let i = 0; i < states.length; i++) {
    if (states[i].state === 'ON') {
      squeezeCount++;
      states[i].duration = squeezeCount;
    } else {
      squeezeCount = 0;
    }
  }
  
  return states;
}

/**
 * Analyze TTM Squeeze for trading signals
 */
export function analyzeTTMSqueeze(
  ohlcv: OHLCV[],
  minSqueezeDuration: number = 5
): TTMSqueezeAnalysis {
  const states = detectTTMSqueeze(ohlcv);
  const current = states[states.length - 1];
  const previous = states[states.length - 2];
  
  if (!current) {
    return {
      current: {
        state: 'OFF',
        duration: 0,
        momentumDirection: 'neutral',
        momentumStrength: 0,
        histogram: 0,
        bollinger: { upper: 0, middle: 0, lower: 0 },
        keltner: { upper: 0, middle: 0, lower: 0 },
      },
      history: [],
      squeezeDuration: 0,
      fireConfirmed: false,
      potentialBreakout: 'neutral',
      momentumDirection: 'neutral',
      momentumStrength: 0,
      histogram: 0,
      triggers: [],
      warnings: [],
    };
  }
  
  // Calculate consecutive squeeze duration
  let squeezeDuration = 0;
  for (let i = states.length - 1; i >= 0; i--) {
    if (states[i].state === 'ON') {
      squeezeDuration++;
    } else {
      break;
    }
  }
  
  const triggers: string[] = [];
  const warnings: string[] = [];
  
  // Check for FIRE condition with confirmation
  let fireConfirmed = false;
  let potentialBreakout: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  
  if (current.state === 'FIRE') {
    triggers.push('TTM Squeeze just FIRED - breakout in progress');
    
    // Check momentum direction for confirmation
    if (current.momentumDirection === 'bullish' && current.histogram > 0) {
      fireConfirmed = true;
      potentialBreakout = 'bullish';
      triggers.push('Bullish momentum confirmed (histogram > 0)');
    } else if (current.momentumDirection === 'bearish' && current.histogram < 0) {
      fireConfirmed = true;
      potentialBreakout = 'bearish';
      triggers.push('Bearish momentum confirmed (histogram < 0)');
    } else {
      warnings.push('Squeeze fired but momentum direction unclear');
    }
  } else if (current.state === 'ON') {
    if (squeezeDuration >= minSqueezeDuration) {
      triggers.push(`Squeeze active for ${squeezeDuration} bars - pressure building`);
      
      // Predict direction based on momentum
      if (current.histogram > 0) {
        potentialBreakout = 'bullish';
        triggers.push('Momentum trending bullish during squeeze');
      } else if (current.histogram < 0) {
        potentialBreakout = 'bearish';
        triggers.push('Momentum trending bearish during squeeze');
      }
    } else {
      warnings.push(`Squeeze just started (${squeezeDuration} bars) - wait for confirmation`);
    }
  } else {
    // OFF state
    if (previous && previous.state === 'FIRE') {
      warnings.push('Squeeze fired recently - monitor for continuation or reversal');
    }
  }
  
  return {
    current,
    history: states.slice(-20), // Last 20 bars
    squeezeDuration,
    fireConfirmed,
    potentialBreakout,
    momentumDirection: current.momentumDirection,
    momentumStrength: current.momentumStrength,
    histogram: current.histogram,
    triggers,
    warnings,
  };
}

/**
 * Calculate short volume Z-score
 */
export function calculateShortVolumeZScore(
  shortVolumes: number[],
  period: number = 20
): number {
  if (shortVolumes.length < period) return 0;
  
  const recent = shortVolumes.slice(-period);
  const avg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
  const variance = recent.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / recent.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  
  const current = shortVolumes[shortVolumes.length - 1];
  return (current - avg) / stdDev;
}

/**
 * Analyze Short Squeeze Potential
 */
export function analyzeShortSqueeze(
  shortInterest: ShortInterestData,
  volumeData?: number[]
): ShortSqueezeAnalysis {
  const triggers: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  let potential: 'high' | 'moderate' | 'low' | 'none' = 'none';
  
  const { shortFloat, daysToCover, shortVolume, shortVolumeRatio } = shortInterest;
  
  // Calculate short volume trend
  let shortVolumeZ: number | null = null;
  let shortVolumeTrend: 'increasing' | 'decreasing' | 'stable' | 'unknown' = 'unknown';
  
  if (volumeData && shortVolume !== undefined) {
    // Mock short volume history (in production, fetch from Polygon)
    const mockShortVolumes = volumeData.slice(-20).map(() => shortVolume);
    shortVolumeZ = calculateShortVolumeZScore(mockShortVolumes);
    
    if (shortVolumeZ > 1) {
      shortVolumeTrend = 'increasing';
      triggers.push(`Short volume elevated (Z-score: ${shortVolumeZ.toFixed(2)})`);
      score += 15;
    } else if (shortVolumeZ < -1) {
      shortVolumeTrend = 'decreasing';
    } else {
      shortVolumeTrend = 'stable';
    }
  }
  
  // Analyze Days to Cover (DTC)
  if (daysToCover !== null && daysToCover !== undefined) {
    if (daysToCover > 10) {
      triggers.push(`Very high days to cover (${daysToCover.toFixed(1)})`);
      score += 35;
      potential = 'high';
    } else if (daysToCover > 7) {
      triggers.push(`High days to cover (${daysToCover.toFixed(1)})`);
      score += 25;
      if (potential === 'none') potential = 'moderate';
    } else if (daysToCover > 4) {
      triggers.push(`Moderate days to cover (${daysToCover.toFixed(1)})`);
      score += 15;
      if (potential === 'none') potential = 'low';
    } else {
      warnings.push(`Low days to cover (${daysToCover.toFixed(1)}) - limited squeeze potential`);
      if (potential === 'none') potential = 'low';
    }
  }
  
  // Analyze Short Float %
  if (shortFloat !== null && shortFloat !== undefined) {
    if (shortFloat > 30) {
      triggers.push(`Extremely high short float (${shortFloat.toFixed(1)}%)`);
      score += 30;
      potential = 'high';
    } else if (shortFloat > 20) {
      triggers.push(`High short float (${shortFloat.toFixed(1)}%)`);
      score += 20;
      if (potential !== 'high') potential = 'moderate';
    } else if (shortFloat > 10) {
      triggers.push(`Moderate short float (${shortFloat.toFixed(1)}%)`);
      score += 10;
      if (potential === 'none') potential = 'low';
    } else {
      warnings.push(`Low short float (${shortFloat.toFixed(1)}%) - limited squeeze potential`);
    }
  }
  
  // Analyze Short Volume Ratio
  if (shortVolumeRatio !== undefined && shortVolumeRatio !== null) {
    if (shortVolumeRatio > 0.5) {
      triggers.push(`High short volume ratio (${(shortVolumeRatio * 100).toFixed(1)}%)`);
      score += 10;
    }
  }
  
  // Determine overall potential based on score
  if (score >= 60) {
    potential = 'high';
  } else if (score >= 35) {
    if (potential !== 'high') potential = 'moderate';
  } else if (score >= 10) {
    // Lower threshold: 10+ points = low potential (e.g., 10%+ short float or 4+ DTC)
    if (potential === 'none') potential = 'low';
  } else if (score < 10) {
    potential = 'none';
  }
  
  // Add warnings
  if (potential === 'none') {
    warnings.push('Short squeeze unlikely - insufficient short interest pressure');
  } else if (potential === 'low') {
    warnings.push('Moderate short interest - monitor for increasing pressure');
  }
  
  if (shortFloat === null && daysToCover === null) {
    warnings.push('Short interest data not available');
  }
  
  return {
    potential,
    score: Math.min(100, score),
    daysToCover: daysToCover ?? null,
    shortFloat: shortFloat ?? null,
    shortVolumeZ,
    shortVolumeTrend,
    triggers,
    warnings,
  };
}

/**
 * Combined Squeeze Analysis - Integrates both short squeeze and TTM squeeze
 */
export interface CombinedSqueezeAnalysis {
  shortSqueeze: ShortSqueezeAnalysis;
  ttmSqueeze: TTMSqueezeAnalysis;
  combinedScore: number; // 0-100 weighted composite
  combinedPotential: 'extreme' | 'high' | 'moderate' | 'low' | 'none';
  alignment: boolean; // Both squeezes pointing same direction
  recommendation: string;
  triggers: string[];
  warnings: string[];
  // NEW: Detailed scoring breakdown for transparency
  scoreBreakdown: {
    shortFloatPoints: number;
    daysToCoverPoints: number;
    shortVolumePoints: number;
    ttmStatePoints: number;
    ttmDurationBonus: number;
    momentumBonus: number;
    alignmentBonus: number;
    totalShortScore: number;
    totalTTMScore: number;
    shortWeight: number;
    ttmWeight: number;
  };
  // NEW: Conviction level for LLM reasoning
  conviction: 'very-high' | 'high' | 'moderate' | 'low' | 'minimal';
  // NEW: Action timing guidance
  actionTiming: 'immediate' | 'wait-for-fire' | 'monitor' | 'not-recommended';
  // NEW: Position sizing suggestion based on squeeze strength
  positionSizingGuidance: 'aggressive' | 'standard' | 'conservative' | 'minimal';
}

export function analyzeCombinedSqueeze(
  ohlcv: OHLCV[],
  shortInterest: ShortInterestData,
  minSqueezeDuration: number = 5,
  shortSqueezeWeight: number = 0.6, // How much short squeeze matters (0-1)
  ttmSqueezeWeight: number = 0.4    // How much TTM squeeze matters (0-1)
): CombinedSqueezeAnalysis {
  const shortSqueeze = analyzeShortSqueeze(shortInterest, ohlcv.map(bar => bar.volume));
  const ttmSqueeze = analyzeTTMSqueeze(ohlcv, minSqueezeDuration);
  
  const triggers: string[] = [];
  const warnings: string[] = [];
  
  // ========== DETAILED SCORING BREAKDOWN ==========
  
  // 1. Extract individual components from short squeeze score
  let shortFloatPoints = 0;
  let daysToCoverPoints = 0;
  let shortVolumePoints = 0;
  
  const { shortFloat, daysToCover, shortVolumeRatio } = shortInterest;
  const { shortVolumeZ } = shortSqueeze;
  
  // Short Float scoring (0-30 points)
  if (shortFloat !== null && shortFloat !== undefined) {
    if (shortFloat > 30) shortFloatPoints = 30;
    else if (shortFloat > 20) shortFloatPoints = 20;
    else if (shortFloat > 10) shortFloatPoints = 10;
  }
  
  // Days to Cover scoring (0-35 points)
  if (daysToCover !== null && daysToCover !== undefined) {
    if (daysToCover > 10) daysToCoverPoints = 35;
    else if (daysToCover > 7) daysToCoverPoints = 25;
    else if (daysToCover > 4) daysToCoverPoints = 15;
  }
  
  // Short Volume scoring (0-25 points)
  if (shortVolumeZ !== null && shortVolumeZ > 1) {
    shortVolumePoints = 15;
  }
  if (shortVolumeRatio !== undefined && shortVolumeRatio !== null && shortVolumeRatio > 0.5) {
    shortVolumePoints += 10;
  }
  
  const totalShortScore = shortSqueeze.score; // Use actual calculated score
  
  // 2. TTM Squeeze scoring with bonuses
  let ttmStatePoints = 0;
  let ttmDurationBonus = 0;
  let momentumBonus = 0;
  
  // Base TTM state points (0-60)
  if (ttmSqueeze.current.state === 'FIRE' && ttmSqueeze.fireConfirmed) {
    ttmStatePoints = 60;
  } else if (ttmSqueeze.current.state === 'ON' && ttmSqueeze.squeezeDuration >= minSqueezeDuration) {
    ttmStatePoints = 45;
  } else if (ttmSqueeze.current.state === 'ON') {
    ttmStatePoints = 25;
  }
  
  // Duration bonus (0-20 points) - longer squeezes = bigger potential moves
  if (ttmSqueeze.squeezeDuration >= 15) {
    ttmDurationBonus = 20;
  } else if (ttmSqueeze.squeezeDuration >= 10) {
    ttmDurationBonus = 15;
  } else if (ttmSqueeze.squeezeDuration >= 7) {
    ttmDurationBonus = 10;
  } else if (ttmSqueeze.squeezeDuration >= 5) {
    ttmDurationBonus = 5;
  }
  
  // Momentum bonus (0-20 points) - strong directional momentum
  const momentumStrength = ttmSqueeze.momentumStrength / 100; // 0-1
  if (ttmSqueeze.current.state === 'FIRE' || ttmSqueeze.current.state === 'ON') {
    if (ttmSqueeze.potentialBreakout !== 'neutral') {
      momentumBonus = Math.round(20 * momentumStrength);
    }
  }
  
  const totalTTMScore = ttmStatePoints + ttmDurationBonus + momentumBonus;
  
  // 3. Alignment bonus (0-15 points) - both squeezes working together
  const alignment = 
    (shortSqueeze.potential === 'high' || shortSqueeze.potential === 'moderate' || shortSqueeze.potential === 'low') &&
    (ttmSqueeze.current.state === 'FIRE' || ttmSqueeze.current.state === 'ON') &&
    (ttmSqueeze.potentialBreakout !== 'neutral');
  
  let alignmentBonus = 0;
  if (alignment) {
    if (shortSqueeze.potential === 'high' && ttmSqueeze.current.state === 'FIRE') {
      alignmentBonus = 15; // Maximum synergy
    } else if (shortSqueeze.potential === 'high' || ttmSqueeze.current.state === 'FIRE') {
      alignmentBonus = 10; // One strong signal
    } else {
      alignmentBonus = 5; // Both present but moderate
    }
  }
  
  // 4. Calculate weighted combined score (using user-provided or default weights)
  const combinedScore = Math.min(100, Math.round(
    (totalShortScore * shortSqueezeWeight) + (totalTTMScore * ttmSqueezeWeight) + alignmentBonus
  ));
  
  // 5. Determine combined potential
  let combinedPotential: 'extreme' | 'high' | 'moderate' | 'low' | 'none';
  if (combinedScore >= 80) {
    combinedPotential = 'extreme';
  } else if (combinedScore >= 60) {
    combinedPotential = 'high';
  } else if (combinedScore >= 35) {
    combinedPotential = 'moderate';
  } else if (combinedScore >= 15) {
    combinedPotential = 'low';
  } else {
    combinedPotential = 'none';
  }
  
  // 6. Determine conviction level (for LLM reasoning)
  let conviction: 'very-high' | 'high' | 'moderate' | 'low' | 'minimal';
  if (combinedScore >= 75 && alignment) {
    conviction = 'very-high';
  } else if (combinedScore >= 60) {
    conviction = 'high';
  } else if (combinedScore >= 40) {
    conviction = 'moderate';
  } else if (combinedScore >= 20) {
    conviction = 'low';
  } else {
    conviction = 'minimal';
  }
  
  // 7. Determine action timing
  let actionTiming: 'immediate' | 'wait-for-fire' | 'monitor' | 'not-recommended';
  if (ttmSqueeze.fireConfirmed && combinedScore >= 70) {
    actionTiming = 'immediate';
  } else if (ttmSqueeze.current.state === 'ON' && combinedScore >= 50) {
    actionTiming = 'wait-for-fire';
  } else if (combinedScore >= 30) {
    actionTiming = 'monitor';
  } else {
    actionTiming = 'not-recommended';
  }
  
  // 8. Position sizing guidance based on squeeze strength
  let positionSizingGuidance: 'aggressive' | 'standard' | 'conservative' | 'minimal';
  if (combinedScore >= 80 && ttmSqueeze.fireConfirmed) {
    positionSizingGuidance = 'aggressive'; // 1.5-2% risk
  } else if (combinedScore >= 60) {
    positionSizingGuidance = 'standard'; // 1% risk
  } else if (combinedScore >= 35) {
    positionSizingGuidance = 'conservative'; // 0.5% risk
  } else {
    positionSizingGuidance = 'minimal'; // 0.25% risk or skip
  }
  
  // 9. Generate enhanced recommendation
  let recommendation = '';
  
  if (combinedScore >= 80 && alignment && ttmSqueeze.fireConfirmed) {
    const direction = ttmSqueeze.potentialBreakout;
    recommendation = `⚡ EXTREME SETUP (${combinedScore}/100): Both squeezes FIRING with ${direction} momentum! ` +
      `Short Float ${shortFloat?.toFixed(1) || 'N/A'}%, DTC ${daysToCover?.toFixed(1) || 'N/A'}, ` +
      `${ttmSqueeze.squeezeDuration}-bar squeeze just broke. Enter ${direction === 'bullish' ? 'LONG' : 'SHORT'} on breakout candle with 1.5-2% risk.`;
    triggers.push(`⚡ EXTREME: Combined score ${combinedScore}/100 - Both squeezes aligned with FIRE confirmation`);
  } else if (combinedScore >= 70 && ttmSqueeze.fireConfirmed) {
    const direction = ttmSqueeze.potentialBreakout;
    recommendation = `🔥 STRONG SETUP (${combinedScore}/100): TTM squeeze FIRED after ${ttmSqueeze.squeezeDuration} bars! ` +
      `Short interest ${shortSqueeze.potential.toUpperCase()} (${shortFloat?.toFixed(1) || 'N/A'}% float, ${daysToCover?.toFixed(1) || 'N/A'} DTC). ` +
      `Consider ${direction === 'bullish' ? 'long' : 'short'} entry above/below EMA20 with standard 1% risk.`;
  } else if (combinedScore >= 50 && ttmSqueeze.current.state === 'ON') {
    const direction = ttmSqueeze.potentialBreakout;
    recommendation = `📊 BUILDING SETUP (${combinedScore}/100): ${ttmSqueeze.squeezeDuration}-bar TTM squeeze building with ` +
      `${shortSqueeze.potential.toUpperCase()} short interest (${shortFloat?.toFixed(1) || 'N/A'}% float). ` +
      `${direction !== 'neutral' ? `${direction.toUpperCase()} momentum forming.` : 'Neutral momentum.'} ` +
      `Wait for squeeze FIRE before entry. Conservative 0.5% risk.`;
  } else if (combinedScore >= 30) {
    recommendation = `👀 MONITOR (${combinedScore}/100): ${shortSqueeze.potential === 'none' ? 'TTM squeeze present' : `Short interest ${shortSqueeze.potential}`} ` +
      `with ${ttmSqueeze.current.state === 'ON' ? `${ttmSqueeze.squeezeDuration}-bar compression` : 'no active TTM squeeze'}. ` +
      `Not a primary squeeze play. Use standard strategy rules. Minimal 0.25% risk.`;
  } else {
    recommendation = `❌ NO SQUEEZE (${combinedScore}/100): Minimal squeeze pressure. ` +
      `Short Float ${shortFloat?.toFixed(1) || 'N/A'}%, TTM ${ttmSqueeze.current.state}. ` +
      `Standard strategy analysis only - squeeze not a factor.`;
  }
  
  // Combine triggers
  triggers.push(...shortSqueeze.triggers, ...ttmSqueeze.triggers);
  warnings.push(...shortSqueeze.warnings, ...ttmSqueeze.warnings);
  
  // Add score-based trigger
  if (combinedScore >= 60) {
    triggers.push(`High combined squeeze score: ${combinedScore}/100`);
  } else if (combinedScore >= 35) {
    triggers.push(`Moderate combined squeeze score: ${combinedScore}/100`);
  }
  
  return {
    shortSqueeze,
    ttmSqueeze,
    combinedScore,
    combinedPotential,
    alignment,
    recommendation,
    triggers,
    warnings,
    scoreBreakdown: {
      shortFloatPoints,
      daysToCoverPoints,
      shortVolumePoints,
      ttmStatePoints,
      ttmDurationBonus,
      momentumBonus,
      alignmentBonus,
      totalShortScore,
      totalTTMScore,
      shortWeight: shortSqueezeWeight,
      ttmWeight: ttmSqueezeWeight,
    },
    conviction,
    actionTiming,
    positionSizingGuidance,
  };
}

