/**
 * Chart Pattern Detection Module
 * Identifies market structure patterns like flags, triangles, wedges, double tops/bottoms
 */

interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartPattern {
  name: string;
  type: "bullish" | "bearish" | "neutral";
  confidence: number; // 0-95 (capped for realism)
  confidenceLabel: string; // "very high confidence", "high confidence", etc.
  description: string;
  breakoutStatus: "confirmed" | "pending" | "retest" | "none";
  priceTarget?: number;
  keyLevels: {
    resistance?: number[];
    support?: number[];
    breakoutLevel?: number;
  };
  volumeConfirmation: boolean;
  volumeZScore?: number; // Volume Z-score at breakout/current
  patternHeight?: number; // For calculating targets
  metadata?: {
    tightness?: number; // How compressed the pattern is (0-100)
    duration?: number; // Number of bars in pattern
    trendStrength?: number; // Strength of preceding trend
  };
}

/**
 * Detect bullish flag pattern
 * Requirements: Strong uptrend followed by consolidation in parallel downward channel
 */
export function detectBullishFlag(bars: OHLCV[]): ChartPattern | null {
  if (bars.length < 20) return null;

  const recent = bars.slice(-20);
  const poleStart = bars.slice(-40, -20);
  
  // Check for strong uptrend (pole) before consolidation
  const poleGain = (poleStart[poleStart.length - 1].close - poleStart[0].close) / poleStart[0].close;
  if (poleGain < 0.08) return null; // Need at least 8% gain for pole

  // Check for consolidation with downward drift
  const consolidationHighs = recent.map(b => b.high);
  const consolidationLows = recent.map(b => b.low);
  
  const upperTrend = calculateTrendSlope(consolidationHighs);
  const lowerTrend = calculateTrendSlope(consolidationLows);
  
  // Flag should have both lines sloping down slightly
  if (upperTrend > 0 || lowerTrend > 0) return null;
  
  // Check if lines are roughly parallel
  const parallel = Math.abs(upperTrend - lowerTrend) < 0.1;
  if (!parallel) return null;

  const currentPrice = recent[recent.length - 1].close;
  const upperChannel = Math.max(...consolidationHighs);
  const lowerChannel = Math.min(...consolidationLows);
  const flagHeight = upperChannel - lowerChannel;
  const poleHeight = poleStart[poleStart.length - 1].close - poleStart[0].close;
  
  // Check for volume decrease during consolidation
  const avgVolumeBeforeFlag = average(poleStart.map(b => b.volume));
  const avgVolumeDuringFlag = average(recent.map(b => b.volume));
  const volumeDecreased = avgVolumeDuringFlag < avgVolumeBeforeFlag * 0.8;

  // Check breakout status
  let breakoutStatus: ChartPattern["breakoutStatus"] = "pending";
  const recentVolume = recent[recent.length - 1].volume;
  
  if (currentPrice > upperChannel) {
    breakoutStatus = recentVolume > avgVolumeBeforeFlag ? "confirmed" : "pending";
  } else if (currentPrice > upperChannel * 0.995) {
    breakoutStatus = "retest";
  }

  const confidence = calculatePatternConfidence({
    trendStrength: poleGain * 100,
    volumeConfirmation: volumeDecreased,
    parallelLines: parallel,
    breakoutStatus,
    flagTightness: (flagHeight / poleHeight) * 100
  });

  // Calculate volume Z-score
  const allVolumes = [...poleStart.map(b => b.volume), ...recent.map(b => b.volume)];
  const volumeZScore = calculateVolumeZScore(recentVolume, allVolumes);

  // Price target: pole height added to breakout point
  const priceTarget = upperChannel + poleHeight;

  return {
    name: "Bullish Flag",
    type: "bullish",
    confidence: Math.round(confidence),
    confidenceLabel: getConfidenceLabel(confidence),
    description: "Strong upward move followed by tight consolidation, indicating continuation",
    breakoutStatus,
    priceTarget,
    keyLevels: {
      resistance: [upperChannel],
      support: [lowerChannel],
      breakoutLevel: upperChannel
    },
    volumeConfirmation: volumeDecreased,
    volumeZScore: Number(volumeZScore.toFixed(2)),
    patternHeight: poleHeight,
    metadata: {
      tightness: Math.round((1 - flagHeight / poleHeight) * 100),
      duration: recent.length,
      trendStrength: Math.round(poleGain * 100)
    }
  };
}

/**
 * Detect bearish flag pattern
 */
export function detectBearishFlag(bars: OHLCV[]): ChartPattern | null {
  if (bars.length < 20) return null;

  const recent = bars.slice(-20);
  const poleStart = bars.slice(-40, -20);
  
  // Check for strong downtrend (pole) before consolidation
  const poleDrop = (poleStart[0].close - poleStart[poleStart.length - 1].close) / poleStart[0].close;
  if (poleDrop < 0.08) return null; // Need at least 8% drop for pole

  // Check for consolidation with upward drift
  const consolidationHighs = recent.map(b => b.high);
  const consolidationLows = recent.map(b => b.low);
  
  const upperTrend = calculateTrendSlope(consolidationHighs);
  const lowerTrend = calculateTrendSlope(consolidationLows);
  
  // Flag should have both lines sloping up slightly
  if (upperTrend < 0 || lowerTrend < 0) return null;
  
  // Check if lines are roughly parallel
  const parallel = Math.abs(upperTrend - lowerTrend) < 0.1;
  if (!parallel) return null;

  const currentPrice = recent[recent.length - 1].close;
  const upperChannel = Math.max(...consolidationHighs);
  const lowerChannel = Math.min(...consolidationLows);
  const flagHeight = upperChannel - lowerChannel;
  const poleHeight = poleStart[0].close - poleStart[poleStart.length - 1].close;
  
  // Check for volume decrease during consolidation
  const avgVolumeBeforeFlag = average(poleStart.map(b => b.volume));
  const avgVolumeDuringFlag = average(recent.map(b => b.volume));
  const volumeDecreased = avgVolumeDuringFlag < avgVolumeBeforeFlag * 0.8;

  // Check breakout status
  let breakoutStatus: ChartPattern["breakoutStatus"] = "pending";
  const recentVolume = recent[recent.length - 1].volume;
  
  if (currentPrice < lowerChannel) {
    breakoutStatus = recentVolume > avgVolumeBeforeFlag ? "confirmed" : "pending";
  } else if (currentPrice < lowerChannel * 1.005) {
    breakoutStatus = "retest";
  }

  const confidence = calculatePatternConfidence({
    trendStrength: poleDrop * 100,
    volumeConfirmation: volumeDecreased,
    parallelLines: parallel,
    breakoutStatus,
    flagTightness: (flagHeight / poleHeight) * 100
  });

  // Calculate volume Z-score
  const allVolumes = [...poleStart.map(b => b.volume), ...recent.map(b => b.volume)];
  const volumeZScore = calculateVolumeZScore(recentVolume, allVolumes);

  // Price target: pole height subtracted from breakout point
  const priceTarget = lowerChannel - poleHeight;

  return {
    name: "Bearish Flag",
    type: "bearish",
    confidence: Math.round(confidence),
    confidenceLabel: getConfidenceLabel(confidence),
    description: "Strong downward move followed by tight consolidation, indicating continuation",
    breakoutStatus,
    priceTarget,
    keyLevels: {
      resistance: [upperChannel],
      support: [lowerChannel],
      breakoutLevel: lowerChannel
    },
    volumeConfirmation: volumeDecreased,
    volumeZScore: Number(volumeZScore.toFixed(2)),
    patternHeight: poleHeight,
    metadata: {
      tightness: Math.round((1 - flagHeight / poleHeight) * 100),
      duration: recent.length,
      trendStrength: Math.round(poleDrop * 100)
    }
  };
}

/**
 * Detect ascending triangle (bullish)
 */
export function detectAscendingTriangle(bars: OHLCV[]): ChartPattern | null {
  if (bars.length < 15) return null;

  const recent = bars.slice(-15);
  const highs = recent.map(b => b.high);
  const lows = recent.map(b => b.low);

  // Ascending triangle: flat resistance, rising support
  const highsStdDev = standardDeviation(highs);
  const resistanceFlat = highsStdDev < (average(highs) * 0.02); // Less than 2% variation
  
  const lowsSlope = calculateTrendSlope(lows);
  const supportRising = lowsSlope > 0.05; // Support trending up

  if (!resistanceFlat || !supportRising) return null;

  const currentPrice = recent[recent.length - 1].close;
  const resistance = Math.max(...highs);
  const currentSupport = lows[lows.length - 1];
  const triangleHeight = resistance - Math.min(...lows);

  // Volume should decrease as pattern develops
  const volumes = recent.map(b => b.volume);
  const volumeSlope = calculateTrendSlope(volumes);
  const volumeDecreasing = volumeSlope < -0.05;

  // Check breakout
  let breakoutStatus: ChartPattern["breakoutStatus"] = "pending";
  const recentVolume = recent[recent.length - 1].volume;
  const avgVolume = average(volumes);
  
  if (currentPrice > resistance) {
    breakoutStatus = recentVolume > avgVolume * 1.5 ? "confirmed" : "pending";
  } else if (currentPrice > resistance * 0.98) {
    breakoutStatus = "retest";
  }

  const tightness = ((currentPrice - currentSupport) / triangleHeight) * 100;
  
  const confidence = calculatePatternConfidence({
    trendStrength: 70, // Triangles are continuation patterns
    volumeConfirmation: volumeDecreasing,
    parallelLines: true,
    breakoutStatus,
    flagTightness: 100 - tightness
  });

  // Calculate volume Z-score
  const volumeZScore = calculateVolumeZScore(recentVolume, volumes);
  
  const priceTarget = resistance + triangleHeight;

  return {
    name: "Ascending Triangle",
    type: "bullish",
    confidence: Math.round(confidence),
    confidenceLabel: getConfidenceLabel(confidence),
    description: "Flat resistance with rising support, bullish continuation pattern",
    breakoutStatus,
    priceTarget,
    keyLevels: {
      resistance: [resistance],
      support: [currentSupport],
      breakoutLevel: resistance
    },
    volumeConfirmation: volumeDecreasing,
    volumeZScore: Number(volumeZScore.toFixed(2)),
    patternHeight: triangleHeight,
    metadata: {
      tightness: Math.round(100 - tightness),
      duration: recent.length,
      trendStrength: 70
    }
  };
}

/**
 * Detect descending triangle (bearish)
 */
export function detectDescendingTriangle(bars: OHLCV[]): ChartPattern | null {
  if (bars.length < 15) return null;

  const recent = bars.slice(-15);
  const highs = recent.map(b => b.high);
  const lows = recent.map(b => b.low);

  // Descending triangle: falling resistance, flat support
  const lowsStdDev = standardDeviation(lows);
  const supportFlat = lowsStdDev < (average(lows) * 0.02); // Less than 2% variation
  
  const highsSlope = calculateTrendSlope(highs);
  const resistanceFalling = highsSlope < -0.05; // Resistance trending down

  if (!supportFlat || !resistanceFalling) return null;

  const currentPrice = recent[recent.length - 1].close;
  const support = Math.min(...lows);
  const currentResistance = highs[highs.length - 1];
  const triangleHeight = Math.max(...highs) - support;

  // Volume should decrease as pattern develops
  const volumes = recent.map(b => b.volume);
  const volumeSlope = calculateTrendSlope(volumes);
  const volumeDecreasing = volumeSlope < -0.05;

  // Check breakout
  let breakoutStatus: ChartPattern["breakoutStatus"] = "pending";
  const recentVolume = recent[recent.length - 1].volume;
  const avgVolume = average(volumes);
  
  if (currentPrice < support) {
    breakoutStatus = recentVolume > avgVolume * 1.5 ? "confirmed" : "pending";
  } else if (currentPrice < support * 1.02) {
    breakoutStatus = "retest";
  }

  const tightness = ((currentResistance - currentPrice) / triangleHeight) * 100;
  
  const confidence = calculatePatternConfidence({
    trendStrength: 70,
    volumeConfirmation: volumeDecreasing,
    parallelLines: true,
    breakoutStatus,
    flagTightness: 100 - tightness
  });

  // Calculate volume Z-score
  const volumeZScore = calculateVolumeZScore(recentVolume, volumes);
  
  const priceTarget = support - triangleHeight;

  return {
    name: "Descending Triangle",
    type: "bearish",
    confidence: Math.round(confidence),
    confidenceLabel: getConfidenceLabel(confidence),
    description: "Falling resistance with flat support, bearish continuation pattern",
    breakoutStatus,
    priceTarget,
    keyLevels: {
      resistance: [currentResistance],
      support: [support],
      breakoutLevel: support
    },
    volumeConfirmation: volumeDecreasing,
    volumeZScore: Number(volumeZScore.toFixed(2)),
    patternHeight: triangleHeight,
    metadata: {
      tightness: Math.round(100 - tightness),
      duration: recent.length,
      trendStrength: 70
    }
  };
}

/**
 * Detect double top (bearish reversal)
 */
export function detectDoubleTop(bars: OHLCV[]): ChartPattern | null {
  if (bars.length < 30) return null;

  const recent = bars.slice(-30);
  const highs = recent.map(b => b.high);
  
  // Find two peaks
  const peaks = findPeaks(highs);
  if (peaks.length < 2) return null;

  const lastTwoPeaks = peaks.slice(-2);
  const peak1 = highs[lastTwoPeaks[0]];
  const peak2 = highs[lastTwoPeaks[1]];
  
  // Peaks should be roughly equal (within 2%)
  const peakDifference = Math.abs(peak1 - peak2) / peak1;
  if (peakDifference > 0.02) return null;

  // Find the valley (neckline) between peaks
  const valleyStart = lastTwoPeaks[0];
  const valleyEnd = lastTwoPeaks[1];
  const valley = Math.min(...recent.slice(valleyStart, valleyEnd).map(b => b.low));
  
  const currentPrice = recent[recent.length - 1].close;
  const patternHeight = ((peak1 + peak2) / 2) - valley;

  // Check if neckline is broken
  let breakoutStatus: ChartPattern["breakoutStatus"] = "pending";
  
  if (currentPrice < valley) {
    const recentVolume = recent[recent.length - 1].volume;
    const avgVolume = average(recent.map(b => b.volume));
    breakoutStatus = recentVolume > avgVolume * 1.2 ? "confirmed" : "pending";
  } else if (currentPrice < valley * 1.02) {
    breakoutStatus = "retest";
  }

  const confidence = calculatePatternConfidence({
    trendStrength: 75,
    volumeConfirmation: true,
    parallelLines: peakDifference < 0.01,
    breakoutStatus,
    flagTightness: 70
  });

  // Calculate volume Z-score
  const recentVolume = recent[recent.length - 1].volume;
  const allVolumes = recent.map(b => b.volume);
  const volumeZScore = calculateVolumeZScore(recentVolume, allVolumes);
  
  const priceTarget = valley - patternHeight;

  return {
    name: "Double Top",
    type: "bearish",
    confidence: Math.round(confidence),
    confidenceLabel: getConfidenceLabel(confidence),
    description: "Two peaks at similar levels followed by breakdown, bearish reversal",
    breakoutStatus,
    priceTarget,
    keyLevels: {
      resistance: [peak1, peak2],
      support: [valley],
      breakoutLevel: valley
    },
    volumeConfirmation: true,
    volumeZScore: Number(volumeZScore.toFixed(2)),
    patternHeight,
    metadata: {
      tightness: Math.round((1 - peakDifference) * 100),
      duration: lastTwoPeaks[1] - lastTwoPeaks[0],
      trendStrength: 75
    }
  };
}

/**
 * Detect double bottom (bullish reversal)
 */
export function detectDoubleBottom(bars: OHLCV[]): ChartPattern | null {
  if (bars.length < 30) return null;

  const recent = bars.slice(-30);
  const lows = recent.map(b => b.low);
  
  // Find two troughs
  const troughs = findTroughs(lows);
  if (troughs.length < 2) return null;

  const lastTwoTroughs = troughs.slice(-2);
  const trough1 = lows[lastTwoTroughs[0]];
  const trough2 = lows[lastTwoTroughs[1]];
  
  // Troughs should be roughly equal (within 2%)
  const troughDifference = Math.abs(trough1 - trough2) / trough1;
  if (troughDifference > 0.02) return null;

  // Find the peak (neckline) between troughs
  const peakStart = lastTwoTroughs[0];
  const peakEnd = lastTwoTroughs[1];
  const neckline = Math.max(...recent.slice(peakStart, peakEnd).map(b => b.high));
  
  const currentPrice = recent[recent.length - 1].close;
  const patternHeight = neckline - ((trough1 + trough2) / 2);

  // Check if neckline is broken
  let breakoutStatus: ChartPattern["breakoutStatus"] = "pending";
  
  if (currentPrice > neckline) {
    const recentVolume = recent[recent.length - 1].volume;
    const avgVolume = average(recent.map(b => b.volume));
    breakoutStatus = recentVolume > avgVolume * 1.2 ? "confirmed" : "pending";
  } else if (currentPrice > neckline * 0.98) {
    breakoutStatus = "retest";
  }

  const confidence = calculatePatternConfidence({
    trendStrength: 75,
    volumeConfirmation: true,
    parallelLines: troughDifference < 0.01,
    breakoutStatus,
    flagTightness: 70
  });

  // Calculate volume Z-score
  const recentVolume = recent[recent.length - 1].volume;
  const allVolumes = recent.map(b => b.volume);
  const volumeZScore = calculateVolumeZScore(recentVolume, allVolumes);
  
  const priceTarget = neckline + patternHeight;

  return {
    name: "Double Bottom",
    type: "bullish",
    confidence: Math.round(confidence),
    confidenceLabel: getConfidenceLabel(confidence),
    description: "Two troughs at similar levels followed by breakout, bullish reversal",
    breakoutStatus,
    priceTarget,
    keyLevels: {
      resistance: [neckline],
      support: [trough1, trough2],
      breakoutLevel: neckline
    },
    volumeConfirmation: true,
    volumeZScore: Number(volumeZScore.toFixed(2)),
    patternHeight,
    metadata: {
      tightness: Math.round((1 - troughDifference) * 100),
      duration: lastTwoTroughs[1] - lastTwoTroughs[0],
      trendStrength: 75
    }
  };
}

/**
 * Detect all chart patterns and return the most confident one
 */
export function detectChartPatterns(bars: OHLCV[]): ChartPattern | null {
  const patterns: (ChartPattern | null)[] = [
    detectBullishFlag(bars),
    detectBearishFlag(bars),
    detectAscendingTriangle(bars),
    detectDescendingTriangle(bars),
    detectDoubleTop(bars),
    detectDoubleBottom(bars)
  ];

  const validPatterns = patterns.filter((p): p is ChartPattern => p !== null);
  
  if (validPatterns.length === 0) return null;

  // Return the pattern with highest confidence
  return validPatterns.reduce((prev, current) => 
    current.confidence > prev.confidence ? current : prev
  );
}

// ============= Helper Functions =============

function calculateTrendSlope(values: number[]): number {
  if (values.length < 2) return 0;
  
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = average(values);
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  
  return denominator === 0 ? 0 : numerator / denominator;
}

function average(values: number[]): number {
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateVolumeZScore(currentVolume: number, volumes: number[]): number {
  const mean = average(volumes);
  const stdDev = standardDeviation(volumes);
  return stdDev === 0 ? 0 : (currentVolume - mean) / stdDev;
}

function standardDeviation(values: number[]): number {
  const avg = average(values);
  const squareDiffs = values.map(val => (val - avg) ** 2);
  return Math.sqrt(average(squareDiffs));
}

function findPeaks(values: number[]): number[] {
  const peaks: number[] = [];
  const lookback = 3;
  
  for (let i = lookback; i < values.length - lookback; i++) {
    let isPeak = true;
    for (let j = 1; j <= lookback; j++) {
      if (values[i] <= values[i - j] || values[i] <= values[i + j]) {
        isPeak = false;
        break;
      }
    }
    if (isPeak) peaks.push(i);
  }
  
  return peaks;
}

function findTroughs(values: number[]): number[] {
  const troughs: number[] = [];
  const lookback = 3;
  
  for (let i = lookback; i < values.length - lookback; i++) {
    let isTrough = true;
    for (let j = 1; j <= lookback; j++) {
      if (values[i] >= values[i - j] || values[i] >= values[i + j]) {
        isTrough = false;
        break;
      }
    }
    if (isTrough) troughs.push(i);
  }
  
  return troughs;
}

function calculatePatternConfidence(params: {
  trendStrength: number;
  volumeConfirmation: boolean;
  parallelLines: boolean;
  breakoutStatus: string;
  flagTightness: number;
}): number {
  let confidence = 50; // Base confidence
  
  // Trend strength (0-25 points)
  confidence += Math.min(25, params.trendStrength / 4);
  
  // Volume confirmation (15 points)
  if (params.volumeConfirmation) confidence += 15;
  
  // Parallel lines / pattern formation (10 points)
  if (params.parallelLines) confidence += 10;
  
  // Breakout status (0-20 points)
  if (params.breakoutStatus === "confirmed") confidence += 20;
  else if (params.breakoutStatus === "retest") confidence += 10;
  else if (params.breakoutStatus === "pending") confidence += 5;
  
  // Flag tightness (0-10 points) - tighter is better
  confidence += Math.min(10, params.flagTightness / 10);
  
  // Cap at 95% to maintain realism (nothing is 100% certain in markets)
  return Math.min(95, Math.max(0, confidence));
}

/**
 * Get qualitative confidence description
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 90) return "very high confidence";
  if (confidence >= 75) return "high confidence";
  if (confidence >= 60) return "moderate confidence";
  if (confidence >= 45) return "low confidence";
  return "very low confidence";
}

