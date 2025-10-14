/**
 * Chart Pattern Detection V2 - Two-Tier System
 * Institutional (Valid/Tradeable) vs Candidate (Not Confirmed)
 * All rules are explicit, deterministic, and fact-based
 */

import {
  OHLCV,
  InstitutionalPattern,
  CandidatePattern,
  TwoTierPatternResult,
  calculateATR,
  getConfidenceLabel,
  calculateVolumeZScore,
  linearRegression,
  countTouches,
  findPeaks,
  findTroughs,
  areSlopesParallel,
  calculateWidthPercent,
  checkBreakoutStatus
} from './pattern-utils';

/**
 * DOUBLE TOP - Two-Tier Detection
 * Window: 30-50 bars within last ~300
 */
export function detectDoubleTop(bars: OHLCV[], atr: number): TwoTierPatternResult {
  if (bars.length < 30) return { institutional: null, candidate: null };

  const window = bars.slice(-50); // Last 50 bars
  const highs = window.map(b => b.high);
  const closes = window.map(b => b.close);
  const currentPrice = closes[closes.length - 1];
  const volZ = calculateVolumeZScore(window);

  // Find peaks
  const peakIndices = findPeaks(highs, 3);
  if (peakIndices.length < 2) return { institutional: null, candidate: null };

  // Get the two highest peaks
  const sortedPeaks = peakIndices
    .map(idx => ({ idx, value: highs[idx] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .sort((a, b) => a.idx - b.idx); // Sort by time

  const peak1 = sortedPeaks[0];
  const peak2 = sortedPeaks[1];
  
  const peak1Price = peak1.value;
  const peak2Price = peak2.value;
  const avgPeakPrice = (peak1Price + peak2Price) / 2;
  const symmetryPct = Math.abs(peak1Price - peak2Price) / peak1Price * 100;
  const separationBars = peak2.idx - peak1.idx;

  // Find neckline (lowest low between peaks)
  const betweenPeaks = highs.slice(peak1.idx, peak2.idx + 1);
  const neckline = Math.min(...betweenPeaks);
  const heightATR = (avgPeakPrice - neckline) / atr;
  const heightPct = (avgPeakPrice - neckline) / avgPeakPrice * 100;

  // Count all touches to peak levels and neckline
  const touchThreshold = atr * 0.3;
  let totalTouches = 0;
  for (const high of highs) {
    if (Math.abs(high - avgPeakPrice) <= touchThreshold) totalTouches++;
    if (Math.abs(high - neckline) <= touchThreshold) totalTouches++;
  }

  // Breakout status
  const breakoutPrice = neckline;
  const breakoutStatus = checkBreakoutStatus(currentPrice, breakoutPrice, 'bearish', volZ, atr, window);

  // INSTITUTIONAL GATES
  const instSymmetry = symmetryPct <= 2.0;
  const instSeparation = separationBars >= 10;
  const instHeight = heightATR >= 1.0;
  const instTouches = totalTouches >= 5;
  const instBreakout = breakoutStatus === 'confirmed' && volZ >= 1.2;

  let institutional: InstitutionalPattern | null = null;

  if (instSymmetry && instSeparation && instHeight && instTouches) {
    // Calculate confidence
    let confidence = 50;
    if (symmetryPct <= 1.0) confidence += 15;
    else if (symmetryPct <= 1.5) confidence += 10;
    if (heightATR >= 1.5) confidence += 10;
    else if (heightATR >= 1.2) confidence += 5;
    if (totalTouches >= 7) confidence += 10;
    else if (totalTouches >= 6) confidence += 5;
    if (breakoutStatus === 'retest') confidence += 20;
    else if (breakoutStatus === 'confirmed') confidence += 15;
    else if (breakoutStatus === 'pending') confidence += 5;

    const cappedConfidence = Math.min(95, confidence);

    // Price target
    const targetMove = avgPeakPrice - neckline;
    const priceTarget = neckline - targetMove;

    const reasons: string[] = [
      `Symmetry ${symmetryPct.toFixed(1)}% (≤2.0% required)`,
      `Separation ${separationBars} bars (≥10 required)`,
      `Height ${heightATR.toFixed(2)}× ATR (≥1.0 required)`,
      `${totalTouches} total touches (≥5 required)`,
      `Breakout: ${breakoutStatus}, volZ ${volZ.toFixed(2)}`
    ];

    institutional = {
      name: 'Double Top',
      type: 'reversal',
      direction: 'bearish',
      confidence: Math.round(cappedConfidence),
      confidenceLabel: getConfidenceLabel(cappedConfidence),
      breakoutStatus,
      priceTarget,
      keyLevels: {
        support: [neckline],
        resistance: [peak1Price, peak2Price]
      },
      volumeZScore: volZ,
      reasons: reasons.slice(0, 3),
      metadata: {
        symmetryPct: Number(symmetryPct.toFixed(2)),
        separationBars,
        heightATR: Number(heightATR.toFixed(2)),
        heightPct: Number(heightPct.toFixed(2)),
        totalTouches,
        peak1Price: Number(peak1Price.toFixed(2)),
        peak2Price: Number(peak2Price.toFixed(2)),
        neckline: Number(neckline.toFixed(2)),
        breakoutVolZ: Number(volZ.toFixed(2))
      }
    };
  }

  // CANDIDATE GATES (relaxed)
  const candSymmetry = symmetryPct <= 3.5;
  const candSeparation = separationBars >= 6;
  const candHeight = heightATR >= 0.8;
  const candTouches = totalTouches >= 4;

  let candidate: CandidatePattern | null = null;

  if (!institutional && (candSymmetry || candSeparation || candHeight || candTouches)) {
    // Only create candidate if some criteria are met but not institutional
    const metCriteria: string[] = [];
    const unmetCriteria: string[] = [];
    const nextSteps: string[] = [];

    if (candSymmetry) metCriteria.push(`Symmetry ${symmetryPct.toFixed(1)}% within candidate range`);
    else unmetCriteria.push(`Symmetry ${symmetryPct.toFixed(1)}% exceeds 3.5% threshold`);

    if (candSeparation) metCriteria.push(`Separation ${separationBars} bars ≥ 6 (candidate minimum)`);
    else unmetCriteria.push(`Separation ${separationBars} bars < 6 (need ${6 - separationBars} more)`);

    if (candHeight) metCriteria.push(`Height ${heightATR.toFixed(2)}× ATR ≥ 0.8 (candidate minimum)`);
    else unmetCriteria.push(`Height ${heightATR.toFixed(2)}× ATR < 0.8 (need ${(0.8 - heightATR).toFixed(2)} more)`);

    if (candTouches) metCriteria.push(`${totalTouches} touches ≥ 4 (candidate minimum)`);
    else unmetCriteria.push(`${totalTouches} touches < 4 (need ${4 - totalTouches} more)`);

    // Add institutional requirements to unmet
    if (!instSymmetry) {
      unmetCriteria.push(`Institutional: Symmetry ${symmetryPct.toFixed(1)}% > 2.0% (need ≤2.0%)`);
      nextSteps.push('Wait for clearer peak alignment (symmetry ≤2.0%)');
    }
    if (!instSeparation) {
      unmetCriteria.push(`Institutional: Separation ${separationBars} bars < 10 (need ${10 - separationBars} more)`);
      nextSteps.push(`Wait ${10 - separationBars} more bars for institutional separation`);
    }
    if (!instHeight) {
      unmetCriteria.push(`Institutional: Height ${heightATR.toFixed(2)}× ATR < 1.0 (need ${(1.0 - heightATR).toFixed(2)} more)`);
      nextSteps.push('Need larger pattern height (≥1.0× ATR) for institutional grade');
    }
    if (!instTouches) {
      unmetCriteria.push(`Institutional: ${totalTouches} touches < 5 (need ${5 - totalTouches} more)`);
      nextSteps.push('Monitor for additional touches to peak/neckline levels');
    }
    if (breakoutStatus === 'none') {
      nextSteps.push('Watch for neckline breakdown with volume confirmation (volZ ≥1.2)');
    }

    // Confidence capped at 80 for candidates
    let confidence = 30;
    if (candSymmetry) confidence += 15;
    if (candSeparation) confidence += 15;
    if (candHeight) confidence += 15;
    if (candTouches) confidence += 15;
    const cappedConfidence = Math.min(80, confidence);

    candidate = {
      name: 'Double Top',
      type: 'reversal',
      direction: 'bearish',
      confidence: Math.round(cappedConfidence),
      confidenceLabel: getConfidenceLabel(cappedConfidence),
      metCriteria,
      unmetCriteria,
      nextSteps,
      metadata: {
        symmetryPct: Number(symmetryPct.toFixed(2)),
        separationBars,
        heightATR: Number(heightATR.toFixed(2)),
        totalTouches,
        status: 'candidate'
      }
    };
  }

  return { institutional, candidate };
}

/**
 * DOUBLE BOTTOM - Two-Tier Detection
 */
export function detectDoubleBottom(bars: OHLCV[], atr: number): TwoTierPatternResult {
  if (bars.length < 30) return { institutional: null, candidate: null };

  const window = bars.slice(-50);
  const lows = window.map(b => b.low);
  const closes = window.map(b => b.close);
  const currentPrice = closes[closes.length - 1];
  const volZ = calculateVolumeZScore(window);

  const troughIndices = findTroughs(lows, 3);
  if (troughIndices.length < 2) return { institutional: null, candidate: null };

  const sortedTroughs = troughIndices
    .map(idx => ({ idx, value: lows[idx] }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 2)
    .sort((a, b) => a.idx - b.idx);

  const trough1 = sortedTroughs[0];
  const trough2 = sortedTroughs[1];
  
  const trough1Price = trough1.value;
  const trough2Price = trough2.value;
  const avgTroughPrice = (trough1Price + trough2Price) / 2;
  const symmetryPct = Math.abs(trough1Price - trough2Price) / trough1Price * 100;
  const separationBars = trough2.idx - trough1.idx;

  const betweenTroughs = lows.slice(trough1.idx, trough2.idx + 1);
  const neckline = Math.max(...betweenTroughs);
  const heightATR = (neckline - avgTroughPrice) / atr;
  const heightPct = (neckline - avgTroughPrice) / avgTroughPrice * 100;

  const touchThreshold = atr * 0.3;
  let totalTouches = 0;
  for (const low of lows) {
    if (Math.abs(low - avgTroughPrice) <= touchThreshold) totalTouches++;
    if (Math.abs(low - neckline) <= touchThreshold) totalTouches++;
  }

  const breakoutStatus = checkBreakoutStatus(currentPrice, neckline, 'bullish', volZ, atr, window);

  // INSTITUTIONAL GATES
  const instSymmetry = symmetryPct <= 2.0;
  const instSeparation = separationBars >= 10;
  const instHeight = heightATR >= 1.0;
  const instTouches = totalTouches >= 5;

  let institutional: InstitutionalPattern | null = null;

  if (instSymmetry && instSeparation && instHeight && instTouches) {
    let confidence = 50;
    if (symmetryPct <= 1.0) confidence += 15;
    else if (symmetryPct <= 1.5) confidence += 10;
    if (heightATR >= 1.5) confidence += 10;
    else if (heightATR >= 1.2) confidence += 5;
    if (totalTouches >= 7) confidence += 10;
    else if (totalTouches >= 6) confidence += 5;
    if (breakoutStatus === 'retest') confidence += 20;
    else if (breakoutStatus === 'confirmed') confidence += 15;
    else if (breakoutStatus === 'pending') confidence += 5;

    const cappedConfidence = Math.min(95, confidence);
    const targetMove = neckline - avgTroughPrice;
    const priceTarget = neckline + targetMove;

    const reasons: string[] = [
      `Symmetry ${symmetryPct.toFixed(1)}% (≤2.0% required)`,
      `Separation ${separationBars} bars (≥10 required)`,
      `Height ${heightATR.toFixed(2)}× ATR (≥1.0 required)`,
      `${totalTouches} total touches (≥5 required)`,
      `Breakout: ${breakoutStatus}, volZ ${volZ.toFixed(2)}`
    ];

    institutional = {
      name: 'Double Bottom',
      type: 'reversal',
      direction: 'bullish',
      confidence: Math.round(cappedConfidence),
      confidenceLabel: getConfidenceLabel(cappedConfidence),
      breakoutStatus,
      priceTarget,
      keyLevels: {
        support: [trough1Price, trough2Price],
        resistance: [neckline]
      },
      volumeZScore: volZ,
      reasons: reasons.slice(0, 3),
      metadata: {
        symmetryPct: Number(symmetryPct.toFixed(2)),
        separationBars,
        heightATR: Number(heightATR.toFixed(2)),
        heightPct: Number(heightPct.toFixed(2)),
        totalTouches
      }
    };
  }

  // CANDIDATE GATES
  const candSymmetry = symmetryPct <= 3.5;
  const candSeparation = separationBars >= 6;
  const candHeight = heightATR >= 0.8;
  const candTouches = totalTouches >= 4;

  let candidate: CandidatePattern | null = null;

  if (!institutional && (candSymmetry || candSeparation || candHeight || candTouches)) {
    const metCriteria: string[] = [];
    const unmetCriteria: string[] = [];
    const nextSteps: string[] = [];

    if (candSymmetry) metCriteria.push(`Symmetry ${symmetryPct.toFixed(1)}%`);
    if (candSeparation) metCriteria.push(`Separation ${separationBars} bars`);
    if (candHeight) metCriteria.push(`Height ${heightATR.toFixed(2)}× ATR`);
    if (candTouches) metCriteria.push(`${totalTouches} touches`);

    if (!instSymmetry) unmetCriteria.push(`Symmetry ${symmetryPct.toFixed(1)}% > 2.0%`);
    if (!instSeparation) unmetCriteria.push(`Separation ${separationBars} < 10 bars`);
    if (!instHeight) unmetCriteria.push(`Height ${heightATR.toFixed(2)}× ATR < 1.0`);
    if (!instTouches) unmetCriteria.push(`${totalTouches} touches < 5`);

    if (!instSymmetry) nextSteps.push('Wait for clearer trough alignment');
    if (!instSeparation) nextSteps.push(`Need ${10 - separationBars} more bars`);
    if (breakoutStatus === 'none') nextSteps.push('Watch for neckline breakout with volume');

    let confidence = 30;
    if (candSymmetry) confidence += 15;
    if (candSeparation) confidence += 15;
    if (candHeight) confidence += 15;
    if (candTouches) confidence += 15;

    candidate = {
      name: 'Double Bottom',
      type: 'reversal',
      direction: 'bullish',
      confidence: Math.min(80, Math.round(confidence)),
      confidenceLabel: getConfidenceLabel(Math.min(80, confidence)),
      metCriteria,
      unmetCriteria,
      nextSteps,
      metadata: { symmetryPct: Number(symmetryPct.toFixed(2)), separationBars, heightATR: Number(heightATR.toFixed(2)), totalTouches }
    };
  }

  return { institutional, candidate };
}

/**
 * BULLISH FLAG - Two-Tier Detection
 */
export function detectBullishFlag(bars: OHLCV[], atr: number): TwoTierPatternResult {
  if (bars.length < 45) return { institutional: null, candidate: null };

  const poleStart = bars.slice(-40, -20);
  const consolidation = bars.slice(-20);
  
  const poleGain = (poleStart[poleStart.length - 1].close - poleStart[0].close) / poleStart[0].close * 100;
  const duration = consolidation.length;

  if (duration < 5 || duration > 25) return { institutional: null, candidate: null };

  const highs = consolidation.map(b => b.high);
  const lows = consolidation.map(b => b.low);
  const avgPrice = consolidation.reduce((sum, b) => sum + b.close, 0) / consolidation.length;

  const upperReg = linearRegression(highs);
  const lowerReg = linearRegression(lows);

  const touchThreshold = atr * 0.3;
  const touchesUpper = countTouches(highs, upperReg.slope, upperReg.intercept, touchThreshold);
  const touchesLower = countTouches(lows, lowerReg.slope, lowerReg.intercept, touchThreshold);
  const totalTouches = touchesUpper + touchesLower;

  const slopeUpperPct = (upperReg.slope / avgPrice) * 100;
  const slopeLowerPct = (lowerReg.slope / avgPrice) * 100;

  const upperChannel = Math.max(...highs);
  const lowerChannel = Math.min(...lows);
  const widthPct = calculateWidthPercent(upperChannel, lowerChannel, avgPrice);
  const widthATR = (upperChannel - lowerChannel) / atr;

  const parallelDelta = Math.abs(slopeUpperPct - slopeLowerPct);

  const poleVol = poleStart.map(b => b.volume);
  const consVol = consolidation.map(b => b.volume);
  const avgPoleVol = poleVol.reduce((sum, v) => sum + v, 0) / poleVol.length;
  const avgConsVol = consVol.reduce((sum, v) => sum + v, 0) / consVol.length;
  const volDeclining = avgConsVol < avgPoleVol * 0.8;

  const currentPrice = consolidation[consolidation.length - 1].close;
  const volZ = calculateVolumeZScore(consolidation);
  const breakoutStatus = checkBreakoutStatus(currentPrice, upperChannel, 'bullish', volZ, atr, consolidation);

  // INSTITUTIONAL GATES
  const instPole = poleGain >= 8.0;
  const instSlopes = slopeUpperPct < 0 && slopeLowerPct < 0;
  const instParallel = parallelDelta <= 0.15;
  const instWidth = widthPct <= 3.0 || widthATR <= 1.0;
  const instVolume = volDeclining;
  const instBreakout = breakoutStatus === 'confirmed' || breakoutStatus === 'retest';

  let institutional: InstitutionalPattern | null = null;

  if (instPole && instSlopes && instParallel && instWidth && instVolume && totalTouches >= 5) {
    let confidence = 50;
    if (poleGain >= 12) confidence += 15;
    else if (poleGain >= 10) confidence += 10;
    if (widthPct <= 2.0 || widthATR <= 0.8) confidence += 10;
    if (totalTouches >= 7) confidence += 10;
    if (breakoutStatus === 'retest') confidence += 20;
    else if (breakoutStatus === 'confirmed') confidence += 15;
    else if (breakoutStatus === 'pending') confidence += 5;

    const cappedConfidence = Math.min(95, confidence);
    const poleHeight = poleStart[poleStart.length - 1].close - poleStart[0].close;
    const priceTarget = upperChannel + poleHeight;

    const reasons: string[] = [
      `Pole: ${poleGain.toFixed(1)}% gain (≥8% required)`,
      `Width: ${widthPct.toFixed(1)}% / ${widthATR.toFixed(2)}× ATR (≤3% or ≤1×ATR)`,
      `Parallel: ${parallelDelta.toFixed(2)}%/bar (≤0.15% required)`,
      `${totalTouches} touches, declining volume`,
      `Breakout: ${breakoutStatus}, volZ ${volZ.toFixed(2)}`
    ];

    institutional = {
      name: 'Bullish Flag',
      type: 'continuation',
      direction: 'bullish',
      confidence: Math.round(cappedConfidence),
      confidenceLabel: getConfidenceLabel(cappedConfidence),
      breakoutStatus,
      priceTarget,
      keyLevels: {
        support: [lowerChannel],
        resistance: [upperChannel]
      },
      volumeZScore: volZ,
      reasons: reasons.slice(0, 3),
      metadata: {
        poleGain: Number(poleGain.toFixed(2)),
        widthPct: Number(widthPct.toFixed(2)),
        widthATR: Number(widthATR.toFixed(2)),
        parallelDelta: Number(parallelDelta.toFixed(3)),
        totalTouches,
        volDeclining
      }
    };
  }

  // CANDIDATE GATES
  const candPole = poleGain >= 6.0;
  const candParallel = parallelDelta <= 0.22;
  const candWidth = widthPct <= 4.0 || widthATR <= 1.3;

  let candidate: CandidatePattern | null = null;

  if (!institutional && candPole && totalTouches >= 4) {
    const metCriteria: string[] = [];
    const unmetCriteria: string[] = [];
    const nextSteps: string[] = [];

    if (candPole) metCriteria.push(`Pole ${poleGain.toFixed(1)}% ≥ 6%`);
    if (candWidth) metCriteria.push(`Width ${widthPct.toFixed(1)}% / ${widthATR.toFixed(2)}× ATR acceptable`);
    if (totalTouches >= 4) metCriteria.push(`${totalTouches} touches ≥ 4`);

    if (!instPole) unmetCriteria.push(`Pole ${poleGain.toFixed(1)}% < 8%`);
    if (!instSlopes) unmetCriteria.push(`Slopes not both negative`);
    if (!instParallel) unmetCriteria.push(`Parallel delta ${parallelDelta.toFixed(2)}% > 0.15%`);
    if (!instWidth) unmetCriteria.push(`Width exceeds institutional limits`);
    if (!instVolume) unmetCriteria.push(`Volume not declining sufficiently`);

    if (!instPole) nextSteps.push('Wait for stronger pole (≥8%)');
    if (!instWidth) nextSteps.push('Wait for tighter consolidation');
    if (breakoutStatus === 'none') nextSteps.push('Watch for breakout with volZ ≥1.0');

    let confidence = 30;
    if (candPole) confidence += 20;
    if (candWidth) confidence += 15;
    if (candParallel) confidence += 10;

    candidate = {
      name: 'Bullish Flag',
      type: 'continuation',
      direction: 'bullish',
      confidence: Math.min(80, Math.round(confidence)),
      confidenceLabel: getConfidenceLabel(Math.min(80, confidence)),
      metCriteria,
      unmetCriteria,
      nextSteps,
      metadata: { poleGain: Number(poleGain.toFixed(2)), widthPct: Number(widthPct.toFixed(2)), totalTouches }
    };
  }

  return { institutional, candidate };
}

/**
 * BEARISH FLAG - Two-Tier Detection
 */
export function detectBearishFlag(bars: OHLCV[], atr: number): TwoTierPatternResult {
  if (bars.length < 45) return { institutional: null, candidate: null };

  const poleStart = bars.slice(-40, -20);
  const consolidation = bars.slice(-20);
  
  const poleDrop = (poleStart[0].close - poleStart[poleStart.length - 1].close) / poleStart[0].close * 100;
  const duration = consolidation.length;

  if (duration < 5 || duration > 25) return { institutional: null, candidate: null };

  const highs = consolidation.map(b => b.high);
  const lows = consolidation.map(b => b.low);
  const avgPrice = consolidation.reduce((sum, b) => sum + b.close, 0) / consolidation.length;

  const upperReg = linearRegression(highs);
  const lowerReg = linearRegression(lows);

  const touchThreshold = atr * 0.3;
  const touchesUpper = countTouches(highs, upperReg.slope, upperReg.intercept, touchThreshold);
  const touchesLower = countTouches(lows, lowerReg.slope, lowerReg.intercept, touchThreshold);
  const totalTouches = touchesUpper + touchesLower;

  const slopeUpperPct = (upperReg.slope / avgPrice) * 100;
  const slopeLowerPct = (lowerReg.slope / avgPrice) * 100;

  const upperChannel = Math.max(...highs);
  const lowerChannel = Math.min(...lows);
  const widthPct = calculateWidthPercent(upperChannel, lowerChannel, avgPrice);
  const widthATR = (upperChannel - lowerChannel) / atr;

  const parallelDelta = Math.abs(slopeUpperPct - slopeLowerPct);

  const poleVol = poleStart.map(b => b.volume);
  const consVol = consolidation.map(b => b.volume);
  const avgPoleVol = poleVol.reduce((sum, v) => sum + v, 0) / poleVol.length;
  const avgConsVol = consVol.reduce((sum, v) => sum + v, 0) / consVol.length;
  const volDeclining = avgConsVol < avgPoleVol * 0.8;

  const currentPrice = consolidation[consolidation.length - 1].close;
  const volZ = calculateVolumeZScore(consolidation);
  const breakoutStatus = checkBreakoutStatus(currentPrice, lowerChannel, 'bearish', volZ, atr, consolidation);

  // INSTITUTIONAL GATES
  const instPole = poleDrop >= 8.0;
  const instSlopes = slopeUpperPct > 0 && slopeLowerPct > 0;
  const instParallel = parallelDelta <= 0.15;
  const instWidth = widthPct <= 3.0 || widthATR <= 1.0;
  const instVolume = volDeclining;

  let institutional: InstitutionalPattern | null = null;

  if (instPole && instSlopes && instParallel && instWidth && instVolume && totalTouches >= 5) {
    let confidence = 50;
    if (poleDrop >= 12) confidence += 15;
    else if (poleDrop >= 10) confidence += 10;
    if (widthPct <= 2.0 || widthATR <= 0.8) confidence += 10;
    if (totalTouches >= 7) confidence += 10;
    if (breakoutStatus === 'retest') confidence += 20;
    else if (breakoutStatus === 'confirmed') confidence += 15;

    const cappedConfidence = Math.min(95, confidence);
    const poleHeight = poleStart[0].close - poleStart[poleStart.length - 1].close;
    const priceTarget = lowerChannel - poleHeight;

    const reasons: string[] = [
      `Pole: ${poleDrop.toFixed(1)}% drop (≥8% required)`,
      `Width: ${widthPct.toFixed(1)}% / ${widthATR.toFixed(2)}× ATR`,
      `Parallel: ${parallelDelta.toFixed(2)}%/bar`,
      `${totalTouches} touches, declining volume`,
      `Breakout: ${breakoutStatus}, volZ ${volZ.toFixed(2)}`
    ];

    institutional = {
      name: 'Bearish Flag',
      type: 'continuation',
      direction: 'bearish',
      confidence: Math.round(cappedConfidence),
      confidenceLabel: getConfidenceLabel(cappedConfidence),
      breakoutStatus,
      priceTarget,
      keyLevels: {
        support: [lowerChannel],
        resistance: [upperChannel]
      },
      volumeZScore: volZ,
      reasons: reasons.slice(0, 3),
      metadata: {
        poleDrop: Number(poleDrop.toFixed(2)),
        widthPct: Number(widthPct.toFixed(2)),
        widthATR: Number(widthATR.toFixed(2)),
        totalTouches
      }
    };
  }

  // CANDIDATE
  const candPole = poleDrop >= 6.0;
  const candParallel = parallelDelta <= 0.22;
  const candWidth = widthPct <= 4.0 || widthATR <= 1.3;

  let candidate: CandidatePattern | null = null;

  if (!institutional && candPole && totalTouches >= 4) {
    const metCriteria: string[] = [];
    const unmetCriteria: string[] = [];
    const nextSteps: string[] = [];

    if (candPole) metCriteria.push(`Pole ${poleDrop.toFixed(1)}% ≥ 6%`);
    if (candWidth) metCriteria.push(`Width acceptable`);

    if (!instPole) unmetCriteria.push(`Pole ${poleDrop.toFixed(1)}% < 8%`);
    if (!instSlopes) unmetCriteria.push(`Slopes not both positive`);
    if (!instParallel) unmetCriteria.push(`Parallel delta ${parallelDelta.toFixed(2)}% > 0.15%`);

    if (!instPole) nextSteps.push('Wait for stronger pole (≥8%)');
    if (breakoutStatus === 'none') nextSteps.push('Watch for breakdown with volume');

    candidate = {
      name: 'Bearish Flag',
      type: 'continuation',
      direction: 'bearish',
      confidence: Math.min(80, 65),
      confidenceLabel: getConfidenceLabel(65),
      metCriteria,
      unmetCriteria,
      nextSteps,
      metadata: { poleDrop: Number(poleDrop.toFixed(2)), totalTouches }
    };
  }

  return { institutional, candidate };
}

/**
 * ASCENDING TRIANGLE - Two-Tier Detection
 */
export function detectAscendingTriangle(bars: OHLCV[], atr: number): TwoTierPatternResult {
  if (bars.length < 20) return { institutional: null, candidate: null };

  const window = bars.slice(-80);
  if (window.length < 20) return { institutional: null, candidate: null };

  const highs = window.map(b => b.high);
  const lows = window.map(b => b.low);
  const avgPrice = window.reduce((sum, b) => sum + b.close, 0) / window.length;

  const upperReg = linearRegression(highs);
  const lowerReg = linearRegression(lows);

  const touchThreshold = atr * 0.3;
  const touchesUpper = countTouches(highs, upperReg.slope, upperReg.intercept, touchThreshold);
  const touchesLower = countTouches(lows, lowerReg.slope, lowerReg.intercept, touchThreshold);
  const totalTouches = touchesUpper + touchesLower;

  const slopeUpperPct = Math.abs((upperReg.slope / avgPrice) * 100);
  const slopeLowerPct = (lowerReg.slope / avgPrice) * 100;

  const upperLevel = Math.max(...highs);
  const lowerLevel = Math.min(...lows);
  const widthPct = calculateWidthPercent(upperLevel, lowerLevel, avgPrice);
  const widthATR = (upperLevel - lowerLevel) / atr;

  const currentPrice = window[window.length - 1].close;
  const volZ = calculateVolumeZScore(window);
  const breakoutStatus = checkBreakoutStatus(currentPrice, upperLevel, 'bullish', volZ, atr, window);

  // INSTITUTIONAL GATES
  const instFlatUpper = slopeUpperPct <= 0.10 && upperReg.r2 >= 0.70;
  const instRisingLower = slopeLowerPct >= 0.05;
  const instTouches = touchesUpper >= 2 && touchesLower >= 2 && totalTouches >= 5;
  const instWidth = widthPct <= 3.0 || widthATR <= 1.0;

  let institutional: InstitutionalPattern | null = null;

  if (instFlatUpper && instRisingLower && instTouches && instWidth) {
    let confidence = 50;
    if (upperReg.r2 >= 0.80) confidence += 10;
    if (totalTouches >= 7) confidence += 10;
    if (widthPct <= 2.0 || widthATR <= 0.8) confidence += 10;
    if (breakoutStatus === 'retest') confidence += 20;
    else if (breakoutStatus === 'confirmed') confidence += 15;

    const cappedConfidence = Math.min(95, confidence);
    const triangleHeight = upperLevel - lowerLevel;
    const priceTarget = upperLevel + triangleHeight;

    const reasons: string[] = [
      `Flat upper: slope ${slopeUpperPct.toFixed(2)}%/bar, R² ${upperReg.r2.toFixed(2)}`,
      `Rising lower: slope ${slopeLowerPct.toFixed(2)}%/bar`,
      `${totalTouches} touches (${touchesUpper} upper, ${touchesLower} lower)`,
      `Width: ${widthPct.toFixed(1)}% / ${widthATR.toFixed(2)}× ATR`,
      `Breakout: ${breakoutStatus}, volZ ${volZ.toFixed(2)}`
    ];

    institutional = {
      name: 'Ascending Triangle',
      type: 'continuation',
      direction: 'bullish',
      confidence: Math.round(cappedConfidence),
      confidenceLabel: getConfidenceLabel(cappedConfidence),
      breakoutStatus,
      priceTarget,
      keyLevels: {
        support: [lowerLevel],
        resistance: [upperLevel]
      },
      volumeZScore: volZ,
      reasons: reasons.slice(0, 3),
      metadata: {
        slopeUpperPct: Number(slopeUpperPct.toFixed(3)),
        slopeLowerPct: Number(slopeLowerPct.toFixed(3)),
        r2Upper: Number(upperReg.r2.toFixed(2)),
        totalTouches,
        widthPct: Number(widthPct.toFixed(2)),
        widthATR: Number(widthATR.toFixed(2))
      }
    };
  }

  // CANDIDATE
  const candFlatUpper = slopeUpperPct <= 0.15 && upperReg.r2 >= 0.60;
  const candRisingLower = slopeLowerPct >= 0.03;
  const candWidth = widthPct <= 4.0 || widthATR <= 1.3;

  let candidate: CandidatePattern | null = null;

  if (!institutional && candFlatUpper && candRisingLower && totalTouches >= 4) {
    const metCriteria: string[] = [];
    const unmetCriteria: string[] = [];
    const nextSteps: string[] = [];

    if (candFlatUpper) metCriteria.push(`Upper slope ${slopeUpperPct.toFixed(2)}%/bar ≤ 0.15%`);
    if (candRisingLower) metCriteria.push(`Lower rising ${slopeLowerPct.toFixed(2)}%/bar`);

    if (!instFlatUpper) unmetCriteria.push(`Upper slope/R² doesn't meet institutional (≤0.10%, R²≥0.70)`);
    if (!instRisingLower) unmetCriteria.push(`Lower slope < 0.05%/bar`);
    if (!instTouches) unmetCriteria.push(`Touches insufficient for institutional`);

    nextSteps.push('Wait for breakout above resistance with volZ ≥1.0');

    candidate = {
      name: 'Ascending Triangle',
      type: 'continuation',
      direction: 'bullish',
      confidence: Math.min(80, 70),
      confidenceLabel: getConfidenceLabel(70),
      metCriteria,
      unmetCriteria,
      nextSteps,
      metadata: { slopeUpperPct: Number(slopeUpperPct.toFixed(3)), slopeLowerPct: Number(slopeLowerPct.toFixed(3)), totalTouches }
    };
  }

  return { institutional, candidate };
}

/**
 * DESCENDING TRIANGLE - Two-Tier Detection
 */
export function detectDescendingTriangle(bars: OHLCV[], atr: number): TwoTierPatternResult {
  if (bars.length < 20) return { institutional: null, candidate: null };

  const window = bars.slice(-80);
  if (window.length < 20) return { institutional: null, candidate: null };

  const highs = window.map(b => b.high);
  const lows = window.map(b => b.low);
  const avgPrice = window.reduce((sum, b) => sum + b.close, 0) / window.length;

  const upperReg = linearRegression(highs);
  const lowerReg = linearRegression(lows);

  const touchThreshold = atr * 0.3;
  const touchesUpper = countTouches(highs, upperReg.slope, upperReg.intercept, touchThreshold);
  const touchesLower = countTouches(lows, lowerReg.slope, lowerReg.intercept, touchThreshold);
  const totalTouches = touchesUpper + touchesLower;

  const slopeLowerPct = Math.abs((lowerReg.slope / avgPrice) * 100);
  const slopeUpperPct = (upperReg.slope / avgPrice) * 100;

  const upperLevel = Math.max(...highs);
  const lowerLevel = Math.min(...lows);
  const widthPct = calculateWidthPercent(upperLevel, lowerLevel, avgPrice);
  const widthATR = (upperLevel - lowerLevel) / atr;

  const currentPrice = window[window.length - 1].close;
  const volZ = calculateVolumeZScore(window);
  const breakoutStatus = checkBreakoutStatus(currentPrice, lowerLevel, 'bearish', volZ, atr, window);

  // INSTITUTIONAL
  const instFlatLower = slopeLowerPct <= 0.10 && lowerReg.r2 >= 0.70;
  const instFallingUpper = slopeUpperPct <= -0.05;
  const instTouches = touchesUpper >= 2 && touchesLower >= 2 && totalTouches >= 5;
  const instWidth = widthPct <= 3.0 || widthATR <= 1.0;

  let institutional: InstitutionalPattern | null = null;

  if (instFlatLower && instFallingUpper && instTouches && instWidth) {
    let confidence = 50;
    if (lowerReg.r2 >= 0.80) confidence += 10;
    if (totalTouches >= 7) confidence += 10;
    if (widthPct <= 2.0 || widthATR <= 0.8) confidence += 10;
    if (breakoutStatus === 'retest') confidence += 20;
    else if (breakoutStatus === 'confirmed') confidence += 15;

    const cappedConfidence = Math.min(95, confidence);
    const triangleHeight = upperLevel - lowerLevel;
    const priceTarget = lowerLevel - triangleHeight;

    const reasons: string[] = [
      `Flat lower: slope ${slopeLowerPct.toFixed(2)}%/bar, R² ${lowerReg.r2.toFixed(2)}`,
      `Falling upper: slope ${slopeUpperPct.toFixed(2)}%/bar`,
      `${totalTouches} touches`,
      `Width: ${widthPct.toFixed(1)}% / ${widthATR.toFixed(2)}× ATR`,
      `Breakout: ${breakoutStatus}, volZ ${volZ.toFixed(2)}`
    ];

    institutional = {
      name: 'Descending Triangle',
      type: 'continuation',
      direction: 'bearish',
      confidence: Math.round(cappedConfidence),
      confidenceLabel: getConfidenceLabel(cappedConfidence),
      breakoutStatus,
      priceTarget,
      keyLevels: {
        support: [lowerLevel],
        resistance: [upperLevel]
      },
      volumeZScore: volZ,
      reasons: reasons.slice(0, 3),
      metadata: {
        slopeLowerPct: Number(slopeLowerPct.toFixed(3)),
        slopeUpperPct: Number(slopeUpperPct.toFixed(3)),
        r2Lower: Number(lowerReg.r2.toFixed(2)),
        totalTouches,
        widthPct: Number(widthPct.toFixed(2)),
        widthATR: Number(widthATR.toFixed(2))
      }
    };
  }

  // CANDIDATE
  const candFlatLower = slopeLowerPct <= 0.15 && lowerReg.r2 >= 0.60;
  const candFallingUpper = slopeUpperPct <= -0.03;
  const candWidth = widthPct <= 4.0 || widthATR <= 1.3;

  let candidate: CandidatePattern | null = null;

  if (!institutional && candFlatLower && candFallingUpper && totalTouches >= 4) {
    const metCriteria: string[] = [];
    const unmetCriteria: string[] = [];
    const nextSteps: string[] = [];

    if (candFlatLower) metCriteria.push(`Lower flat ${slopeLowerPct.toFixed(2)}%/bar`);
    if (candFallingUpper) metCriteria.push(`Upper falling ${slopeUpperPct.toFixed(2)}%/bar`);

    if (!instFlatLower) unmetCriteria.push(`Lower doesn't meet institutional flatness`);
    if (!instFallingUpper) unmetCriteria.push(`Upper slope > -0.05%/bar`);

    nextSteps.push('Watch for breakdown with volume');

    candidate = {
      name: 'Descending Triangle',
      type: 'continuation',
      direction: 'bearish',
      confidence: Math.min(80, 70),
      confidenceLabel: getConfidenceLabel(70),
      metCriteria,
      unmetCriteria,
      nextSteps,
      metadata: { slopeLowerPct: Number(slopeLowerPct.toFixed(3)), slopeUpperPct: Number(slopeUpperPct.toFixed(3)), totalTouches }
    };
  }

  return { institutional, candidate };
}

/**
 * Master detector - scans for all chart patterns
 */
export function detectAllChartPatterns(bars: OHLCV[], atr: number): TwoTierPatternResult[] {
  const results: TwoTierPatternResult[] = [];

  results.push(detectDoubleTop(bars, atr));
  results.push(detectDoubleBottom(bars, atr));
  results.push(detectBullishFlag(bars, atr));
  results.push(detectBearishFlag(bars, atr));
  results.push(detectAscendingTriangle(bars, atr));
  results.push(detectDescendingTriangle(bars, atr));

  return results.filter(r => r.institutional !== null || r.candidate !== null);
}
