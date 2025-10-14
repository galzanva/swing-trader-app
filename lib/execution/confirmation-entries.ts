/**
 * Confirmation Entry Logic
 * Replaces "current price" entries with rule-based confirmation triggers
 * Includes stop/target % moves and trade gating
 */

interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ExecutionPlan {
  entry: {
    type: "breakout" | "breakdown" | "retest" | "market";
    triggerPrice: number;
    note: string;
  };
  stopLoss: {
    price: number;
    movePct: number;
  };
  targets: Array<{
    name: string;
    price: number;
    movePct: number;
    rr: number;
  }>;
  status: "ready" | "candidate" | "missed" | "blocked" | "neutral";
  viabilityIndex?: number;
  viabilityLabel?: string;
  warnings: string[];
  patternTarget?: {
    price: number;
    movePct: number;
    confluence?: string;
  };
}

interface ConfirmationInputs {
  currentPrice: number;
  bars: OHLCV[];
  atr: number;
  direction: "bullish" | "bearish" | "neutral";
  chartPattern?: {
    name: string;
    breakoutLevel?: number;
    breakoutStatus: string;
    priceTarget?: number;
    keyLevels: {
      support: number[];
      resistance: number[];
    };
  };
  candlestickPattern: {
    name: string;
    type: "bullish" | "bearish" | "neutral";
    confirmationNeeded?: boolean;
  };
  isInstitutional: boolean;
  isCandidate: boolean;
  daysToEarnings?: number | null;
  avgDollarVolume?: number;
  ema200: number;
  volumeZScore: number;
}

const CONFIRMATION_BUFFER = 0.005; // 0.5%
const RETEST_BAND_ATR = 0.2; // ±0.2×ATR
const MISSED_THRESHOLD_ATR = 0.75; // 0.75×ATR
const ATR_STOP_MULTIPLE = 1.5; // 1.5×ATR
const MIN_LIQUIDITY = 1000000; // $1M

/**
 * Calculate confirmation entry with rule-based triggers
 */
export function calculateConfirmationEntry(inputs: ConfirmationInputs): ExecutionPlan {
  const {
    currentPrice,
    bars,
    atr,
    direction,
    chartPattern,
    candlestickPattern,
    isInstitutional,
    isCandidate,
    daysToEarnings,
    avgDollarVolume,
    ema200,
    volumeZScore
  } = inputs;

  const warnings: string[] = [];
  let status: ExecutionPlan['status'] = 'neutral';

  // Check blockers first
  if (daysToEarnings !== null && daysToEarnings !== undefined && daysToEarnings <= 2) {
    status = 'blocked';
    warnings.push(`⛔ EARNINGS ALERT: Earnings in ${daysToEarnings} day${daysToEarnings === 1 ? '' : 's'}. Avoid new positions.`);
  }

  if (avgDollarVolume && avgDollarVolume < MIN_LIQUIDITY) {
    warnings.push(`⚠️ Low Liquidity: Avg volume $${(avgDollarVolume / 1000000).toFixed(1)}M < $1M. Cap at 70, use limit orders.`);
  }

  // Set initial status based on pattern type
  if (status !== 'blocked') {
    if (isInstitutional) {
      // Institutional pattern exists, but check volume for readiness
      if (volumeZScore >= 0) {
        status = 'ready'; // Adequate volume
      } else {
        status = 'candidate'; // Pattern valid but waiting for volume confirmation
        warnings.push(`Volume Pending: Institutional pattern detected but volZ = ${volumeZScore.toFixed(2)} (sub-average). Wait for volZ ≥ 0 on breakout.`);
      }
    } else if (isCandidate) {
      status = 'candidate';
    }
  }

  // Calculate trigger price based on direction
  let triggerPrice: number;
  let entryType: ExecutionPlan['entry']['type'];
  let entryNote: string;

  if (direction === 'bullish') {
    const { trigger, type, note } = calculateBullishEntry(
      currentPrice,
      bars,
      atr,
      chartPattern,
      candlestickPattern
    );
    triggerPrice = trigger;
    entryType = type;
    entryNote = note;

    // Check if missed
    if (currentPrice > triggerPrice + (MISSED_THRESHOLD_ATR * atr)) {
      status = 'missed';
      entryNote += ` Price extended ${((currentPrice - triggerPrice) / triggerPrice * 100).toFixed(1)}% beyond trigger. Wait for retest.`;
    }

    // Check for gap-through
    const lastBar = bars[bars.length - 1];
    if (lastBar.open > triggerPrice + atr) {
      entryType = 'retest';
      entryNote = `Gaped through trigger — avoid chasing, wait for retest near $${triggerPrice.toFixed(2)}.`;
    }

  } else if (direction === 'bearish') {
    const { trigger, type, note } = calculateBearishEntry(
      currentPrice,
      bars,
      atr,
      chartPattern,
      candlestickPattern
    );
    triggerPrice = trigger;
    entryType = type;
    entryNote = note;

    // Check if missed
    if (currentPrice < triggerPrice - (MISSED_THRESHOLD_ATR * atr)) {
      status = 'missed';
      entryNote += ` Price extended ${((triggerPrice - currentPrice) / triggerPrice * 100).toFixed(1)}% beyond trigger. Wait for retest.`;
    }

    // Check for gap-through
    const lastBar = bars[bars.length - 1];
    if (lastBar.open < triggerPrice - atr) {
      entryType = 'retest';
      entryNote = `Gaped through trigger — avoid chasing, wait for retest near $${triggerPrice.toFixed(2)}.`;
    }

  } else {
    // Neutral - use current price as fallback
    triggerPrice = currentPrice;
    entryType = 'market';
    entryNote = 'No directional bias - neutral setup.';
    status = 'neutral';
  }

  // Calculate stop loss
  const stopLoss = calculateStopLoss(
    triggerPrice,
    atr,
    direction,
    chartPattern
  );

  // Calculate targets
  const targets = calculateTargets(
    triggerPrice,
    stopLoss.price,
    direction
  );

  // Calculate pattern target if available
  let patternTarget: ExecutionPlan['patternTarget'] | undefined;
  if (chartPattern?.priceTarget) {
    let movePct = ((chartPattern.priceTarget - triggerPrice) / triggerPrice) * 100;
    
    // Clamp unrealistic percentage moves (unless penny stock < $1)
    if (triggerPrice >= 1.0) {
      movePct = Math.max(-200, Math.min(200, movePct)); // Clamp to ±200%
    }
    
    patternTarget = {
      price: chartPattern.priceTarget,
      movePct: Number(movePct.toFixed(1))
    };

    // Check for confluence with TP levels
    for (const tp of targets) {
      const diff = Math.abs(chartPattern.priceTarget - tp.price) / tp.price;
      if (diff < 0.10) { // Within 10%
        patternTarget.confluence = `Aligns with ${tp.name} (confluence)`;
        break;
      }
    }
  }

  // Calculate Position Viability Index
  const viability = calculateViabilityIndex(
    triggerPrice,
    stopLoss.price,
    targets[0].price, // TP1
    chartPattern,
    volumeZScore,
    direction === 'bullish' ? currentPrice > ema200 : currentPrice < ema200
  );

  // Add counter-trend warning
  if (direction === 'bullish' && currentPrice < ema200) {
    warnings.push('Counter-Trend: Price below 200 EMA. Consider half size and tighter stops.');
  } else if (direction === 'bearish' && currentPrice > ema200) {
    warnings.push('Counter-Trend: Price above 200 EMA. Consider half size and tighter stops.');
  }

  // Add volume warning
  if (volumeZScore < -0.5) {
    warnings.push(`Low Volume: Need average+ volume on break. Current volZ = ${volumeZScore.toFixed(2)} (sub-avg).`);
  }

  // Add volatility warning
  const atrPct = (atr / currentPrice) * 100;
  if (atrPct > 8) {
    warnings.push(`High Volatility: ATR ${atrPct.toFixed(1)}% of price. Consider wider stop or smaller size.`);
  }

  return {
    entry: {
      type: entryType,
      triggerPrice: Number(triggerPrice.toFixed(2)),
      note: entryNote
    },
    stopLoss,
    targets,
    status,
    viabilityIndex: viability.index,
    viabilityLabel: viability.label,
    warnings,
    patternTarget
  };
}

/**
 * Calculate bullish entry trigger
 */
function calculateBullishEntry(
  currentPrice: number,
  bars: OHLCV[],
  atr: number,
  chartPattern?: ConfirmationInputs['chartPattern'],
  candlestickPattern?: ConfirmationInputs['candlestickPattern']
): { trigger: number; type: ExecutionPlan['entry']['type']; note: string } {
  
  // Use chart pattern breakout level if available
  if (chartPattern?.breakoutLevel) {
    const trigger = chartPattern.breakoutLevel * (1 + CONFIRMATION_BUFFER);
    const note = `Wait for confirmation breakout above $${trigger.toFixed(2)} (+0.5% above ${chartPattern.name} resistance).`;
    
    // Check if already broken out
    if (currentPrice > trigger && bars[bars.length - 1].close > trigger) {
      return {
        trigger,
        type: 'market',
        note: `Breakout already confirmed (closed above $${trigger.toFixed(2)}). Entry at market or wait for retest.`
      };
    }
    
    // Check for retest opportunity
    if (chartPattern.breakoutStatus === 'confirmed' && 
        Math.abs(currentPrice - chartPattern.breakoutLevel) < (RETEST_BAND_ATR * atr)) {
      return {
        trigger: chartPattern.breakoutLevel,
        type: 'retest',
        note: `Prefer retest entry near $${chartPattern.breakoutLevel.toFixed(2)} ± ${(RETEST_BAND_ATR * atr).toFixed(2)} if support holds.`
      };
    }
    
    return { trigger, type: 'breakout', note };
  }

  // Candlestick-only logic
  const recentHigh = Math.max(...bars.slice(-5).map(b => b.high));
  const lastBar = bars[bars.length - 1];

  // Inside Bar logic
  if (candlestickPattern?.name === 'Inside Bar' && bars.length >= 2) {
    const motherBar = bars[bars.length - 2];
    const trigger = motherBar.high * (1 + CONFIRMATION_BUFFER);
    return {
      trigger,
      type: 'breakout',
      note: `Wait for breakout above mother bar high $${trigger.toFixed(2)} (+0.5% confirmation).`
    };
  }

  // Hammer logic
  if (candlestickPattern?.name === 'Hammer') {
    const trigger = lastBar.high * (1 + CONFIRMATION_BUFFER);
    return {
      trigger,
      type: 'breakout',
      note: `Wait for breakout above hammer high $${trigger.toFixed(2)} (+0.5% confirmation).`
    };
  }

  // Default: prior high
  const trigger = recentHigh * (1 + CONFIRMATION_BUFFER);
  return {
    trigger,
    type: 'breakout',
    note: `Wait for breakout above recent high $${trigger.toFixed(2)} (+0.5% confirmation).`
  };
}

/**
 * Calculate bearish entry trigger
 */
function calculateBearishEntry(
  currentPrice: number,
  bars: OHLCV[],
  atr: number,
  chartPattern?: ConfirmationInputs['chartPattern'],
  candlestickPattern?: ConfirmationInputs['candlestickPattern']
): { trigger: number; type: ExecutionPlan['entry']['type']; note: string } {
  
  // Use chart pattern breakout level (neckline) if available
  if (chartPattern?.breakoutLevel) {
    const trigger = chartPattern.breakoutLevel * (1 - CONFIRMATION_BUFFER);
    const note = `Wait for confirmed breakdown below $${trigger.toFixed(2)} (−0.5% below ${chartPattern.name} neckline) and ⩾ average volume.`;
    
    // Check if already broken down
    if (currentPrice < trigger && bars[bars.length - 1].close < trigger) {
      return {
        trigger,
        type: 'market',
        note: `Breakdown already confirmed (closed below $${trigger.toFixed(2)}). Entry at market or wait for retest.`
      };
    }
    
    // Check for retest opportunity
    if (chartPattern.breakoutStatus === 'confirmed' && 
        Math.abs(currentPrice - chartPattern.breakoutLevel) < (RETEST_BAND_ATR * atr)) {
      return {
        trigger: chartPattern.breakoutLevel,
        type: 'retest',
        note: `Prefer retest entry near $${chartPattern.breakoutLevel.toFixed(2)} ± ${(RETEST_BAND_ATR * atr).toFixed(2)} if rejection occurs.`
      };
    }
    
    return { trigger, type: 'breakdown', note };
  }

  // Candlestick-only logic
  const recentLow = Math.min(...bars.slice(-5).map(b => b.low));
  const lastBar = bars[bars.length - 1];

  // Inside Bar logic
  if (candlestickPattern?.name === 'Inside Bar' && bars.length >= 2) {
    const motherBar = bars[bars.length - 2];
    const trigger = motherBar.low * (1 - CONFIRMATION_BUFFER);
    return {
      trigger,
      type: 'breakdown',
      note: `Wait for breakdown below mother bar low $${trigger.toFixed(2)} (−0.5% confirmation).`
    };
  }

  // Shooting Star logic
  if (candlestickPattern?.name === 'Shooting Star') {
    const trigger = lastBar.low * (1 - CONFIRMATION_BUFFER);
    return {
      trigger,
      type: 'breakdown',
      note: `Wait for breakdown below shooting star low $${trigger.toFixed(2)} (−0.5% confirmation).`
    };
  }

  // Default: prior low
  const trigger = recentLow * (1 - CONFIRMATION_BUFFER);
  return {
    trigger,
    type: 'breakdown',
    note: `Wait for breakdown below recent low $${trigger.toFixed(2)} (−0.5% confirmation).`
  };
}

/**
 * Calculate stop loss with structural logic
 */
function calculateStopLoss(
  entry: number,
  atr: number,
  direction: "bullish" | "bearish" | "neutral",
  chartPattern?: ConfirmationInputs['chartPattern']
): { price: number; movePct: number } {
  
  let stopPrice: number;

  if (direction === 'bullish') {
    // Try structural stop first
    if (chartPattern?.keyLevels?.support && chartPattern.keyLevels.support.length > 0) {
      const nearestSupport = chartPattern.keyLevels.support[0];
      const structuralStop = nearestSupport - (0.3 * atr);
      
      // Use structural if tighter but logical
      if (structuralStop > entry - (2.0 * atr) && structuralStop < entry) {
        stopPrice = structuralStop;
      } else {
        stopPrice = entry - (ATR_STOP_MULTIPLE * atr);
      }
    } else {
      stopPrice = entry - (ATR_STOP_MULTIPLE * atr);
    }
  } else if (direction === 'bearish') {
    // Try structural stop first
    if (chartPattern?.keyLevels?.resistance && chartPattern.keyLevels.resistance.length > 0) {
      const nearestResistance = chartPattern.keyLevels.resistance[0];
      const structuralStop = nearestResistance + (0.3 * atr);
      
      // Use structural if tighter but logical
      if (structuralStop < entry + (2.0 * atr) && structuralStop > entry) {
        stopPrice = structuralStop;
      } else {
        stopPrice = entry + (ATR_STOP_MULTIPLE * atr);
      }
    } else {
      stopPrice = entry + (ATR_STOP_MULTIPLE * atr);
    }
  } else {
    // Neutral - use ATR stop
    stopPrice = entry - (ATR_STOP_MULTIPLE * atr);
  }

  let movePct = ((stopPrice - entry) / entry) * 100;
  
  // Clamp unrealistic percentage moves (unless penny stock < $1)
  if (entry >= 1.0) {
    movePct = Math.max(-200, Math.min(200, movePct)); // Clamp to ±200%
  }

  return {
    price: Number(stopPrice.toFixed(2)),
    movePct: Number(movePct.toFixed(1))
  };
}

/**
 * Calculate targets with R:R ratios
 */
function calculateTargets(
  entry: number,
  stop: number,
  direction: "bullish" | "bearish" | "neutral"
): ExecutionPlan['targets'] {
  
  const risk = Math.abs(entry - stop);
  const targets: ExecutionPlan['targets'] = [];

  const rrRatios = [2.0, 3.0, 4.0];
  const names = ['Target 1', 'Target 2', 'Target 3'];

  for (let i = 0; i < rrRatios.length; i++) {
    let targetPrice: number;
    
    if (direction === 'bullish') {
      targetPrice = entry + (rrRatios[i] * risk);
    } else {
      targetPrice = entry - (rrRatios[i] * risk);
    }

    // Sanity check: clamp negative targets to 0 (unless penny stock < $1)
    if (targetPrice < 0 && entry >= 1.0) {
      targetPrice = 0;
    }

    let movePct = ((targetPrice - entry) / entry) * 100;
    
    // Clamp unrealistic percentage moves (unless penny stock < $1)
    if (entry >= 1.0) {
      movePct = Math.max(-200, Math.min(200, movePct)); // Clamp to ±200%
    }

    targets.push({
      name: names[i],
      price: Number(targetPrice.toFixed(2)),
      movePct: Number(movePct.toFixed(1)),
      rr: rrRatios[i]
    });
  }

  return targets;
}

/**
 * Calculate Position Viability Index
 */
function calculateViabilityIndex(
  entry: number,
  stop: number,
  target1: number,
  chartPattern: ConfirmationInputs['chartPattern'] | undefined,
  volumeZScore: number,
  trendAligned: boolean
): { index: number; label: string } {
  
  const riskPct = Math.abs(entry - stop) / entry;
  const rewardPct = Math.abs(target1 - entry) / entry;
  
  let confirmationStrength = 0;

  if (chartPattern?.breakoutStatus === 'confirmed') {
    confirmationStrength += 0.3;
  } else if (chartPattern?.breakoutStatus === 'retest') {
    confirmationStrength += 0.2;
  }

  // Volume multiplier for Viability Index (standardized)
  let volumeMultiplier = 1.0;
  if (volumeZScore < -0.5) {
    volumeMultiplier = 0.5; // Penalty for significantly below-average volume
  } else if (volumeZScore > 1.2) {
    volumeMultiplier = 1.25; // Bonus for strong volume
  } else {
    volumeMultiplier = 1.0; // Neutral for -0.5 ≤ volZ ≤ +1.2
  }

  // Trend alignment factor
  let trendFactor = 1.0;
  if (trendAligned) {
    trendFactor = 1.0; // Aligned with trend
  } else {
    // Counter-trend penalty (multiplicative only, no negative signs)
    trendFactor = 0.8; // Multiplicative penalty (as per spec)
  }

  const pvi = (rewardPct / riskPct) * volumeMultiplier * trendFactor;
  const index = Number(Math.max(0.5, Math.min(3.0, pvi)).toFixed(2)); // Clamp 0.5-3.0

  let label: string;
  if (index >= 2.0) {
    label = 'Very Good';
  } else if (index >= 1.2) {
    label = 'Adequate';
  } else {
    label = 'Weak';
  }

  return { index, label };
}

