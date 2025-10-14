/**
 * Pattern Fusion V2 - Two-Tier System
 * Handles Institutional (Valid/Tradeable) vs Candidate (Not Confirmed) patterns
 * Explicit weights, bonuses, penalties, and safeguards
 */

import {
  TwoTierPatternResult,
  InstitutionalPattern,
  CandidatePattern,
  getConfidenceLabel
} from './pattern-utils';
import { CandlestickPattern } from './candlestick-v2';

export interface CompositePattern {
  institutionalPattern: InstitutionalPattern | null;
  candidatePattern: CandidatePattern | null;
  candlestickPattern: CandlestickPattern;
  composite: number; // 0-95 (capped)
  compositeLabel: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  reasons: string[];
  weights: {
    chart: number;
    candle: number;
  };
  bonuses: {
    alignment?: number;
    breakoutState?: number;
    volume?: number;
  };
  penalties: {
    opposition?: number;
  };
  analysis: string;
}

/**
 * Fuse chart patterns (two-tier) with candlestick patterns
 * 
 * Institutional pattern exists:
 *   composite = 0.6 * chartScore + 0.4 * candleScore + bonuses - penalties
 * 
 * Candidate pattern only (no institutional):
 *   composite = candleScore, capped at 65
 *   reason: "Candidate structure detected (not institutional) - capped at 65 until confirmation"
 * 
 * Neither pattern:
 *   composite = candleScore, capped at 55
 *   reason: "No structure pattern - capped at 55 (wait for setup)"
 */
export function fusePatterns(
  twoTierResult: TwoTierPatternResult,
  candlestickPattern: CandlestickPattern
): CompositePattern {
  const reasons: string[] = [];
  const bonuses: CompositePattern['bonuses'] = {};
  const penalties: CompositePattern['penalties'] = {};

  const { institutional, candidate } = twoTierResult;

  let composite = 0;
  let chartWeight = 0;
  let candleWeight = 1.0;
  let direction: 'bullish' | 'bearish' | 'neutral' = candlestickPattern.type;

  // CASE 1: Institutional pattern exists (tradeable structure)
  if (institutional) {
    chartWeight = 0.6;
    candleWeight = 0.4;
    direction = institutional.direction;

    const chartScore = institutional.confidence;
    const candleScore = candlestickPattern.confidence;

    composite = (chartWeight * chartScore) + (candleWeight * candleScore);
    reasons.push(`Base: ${(chartWeight * 100).toFixed(0)}% chart (${chartScore}) + ${(candleWeight * 100).toFixed(0)}% candle (${candleScore}) = ${composite.toFixed(0)}`);

    // ALIGNMENT BONUS: +15 when chart and candle match
    if (institutional.direction === candlestickPattern.type && institutional.direction !== 'neutral') {
      bonuses.alignment = 15;
      composite += 15;
      reasons.push(`+15 alignment: ${institutional.direction} chart + ${candlestickPattern.type} candle`);
    }

    // OPPOSITION PENALTY: -10 when candle opposes chart
    if (institutional.direction !== 'neutral' && candlestickPattern.type !== 'neutral' &&
        institutional.direction !== candlestickPattern.type) {
      penalties.opposition = 10;
      composite -= 10;
      reasons.push(`-10 opposition: ${institutional.direction} chart vs ${candlestickPattern.type} candle`);
    }

    // BREAKOUT STATE BONUS
    if (institutional.breakoutStatus === 'pending') {
      bonuses.breakoutState = 5;
      composite += 5;
      reasons.push('+5 breakout pending');
    } else if (institutional.breakoutStatus === 'confirmed') {
      bonuses.breakoutState = 15;
      composite += 15;
      reasons.push('+15 breakout confirmed');
    } else if (institutional.breakoutStatus === 'retest') {
      bonuses.breakoutState = 20;
      composite += 20;
      reasons.push('+20 breakout with retest (strongest)');
    }

    // VOLUME BONUS
    // Flags/Triangles: volZ ≥ 1.0 gets bonus
    if (['Bullish Flag', 'Bearish Flag', 'Ascending Triangle', 'Descending Triangle'].includes(institutional.name)) {
      if (institutional.volumeZScore >= 1.0) {
        bonuses.volume = 5;
        composite += 5;
        reasons.push(`+5 volume: Z-score ${institutional.volumeZScore.toFixed(2)} ≥ 1.0`);
      }
    }
    // Doubles: volZ ≥ 1.2 gets bonus
    else if (['Double Top', 'Double Bottom'].includes(institutional.name)) {
      if (institutional.volumeZScore >= 1.2) {
        bonuses.volume = 5;
        composite += 5;
        reasons.push(`+5 volume: Z-score ${institutional.volumeZScore.toFixed(2)} ≥ 1.2`);
      }
    }
  }
  // CASE 2: Candidate pattern only (not institutional)
  else if (candidate) {
    direction = candidate.direction;
    const candleScore = candlestickPattern.confidence;
    
    // Start with candle score (100% weight)
    composite = candleScore;
    reasons.push(`Base: 100% candle (${candleScore})`);
    
    // Cap at 65 for candidates
    const beforeCap = composite;
    composite = Math.min(65, composite);
    if (beforeCap > 65) {
      reasons.push(`→ Candidate cap: 65 (was ${beforeCap}, max 65 until institutional)`);
    } else {
      reasons.push(`→ Candidate cap: ${composite} (max 65 until institutional)`);
    }
    
    // Note: DO NOT add structure bonuses for candidates
    // Candidates lack institutional validation
  }
  // CASE 3: No structure pattern at all
  else {
    composite = candlestickPattern.confidence;
    
    // If just basic trend, cap at 55
    if (['Uptrend', 'Downtrend', 'Consolidation', 'No Pattern'].includes(candlestickPattern.name)) {
      composite = Math.min(55, composite);
      reasons.push('No structure pattern - capped at 55 (wait for setup)');
    }
  }

  // Cap at 95 for realism
  composite = Math.min(95, Math.max(0, composite));

  // Generate label
  const compositeLabel = getConfidenceLabel(composite);

  // Generate analysis narrative
  const analysis = generateFusionAnalysis(institutional, candidate, candlestickPattern, composite, bonuses, penalties);

  return {
    institutionalPattern: institutional,
    candidatePattern: candidate,
    candlestickPattern,
    composite: Math.round(composite),
    compositeLabel,
    direction,
    reasons,
    weights: {
      chart: chartWeight,
      candle: candleWeight
    },
    bonuses,
    penalties,
    analysis
  };
}

/**
 * Generate fusion analysis narrative
 */
function generateFusionAnalysis(
  institutional: InstitutionalPattern | null,
  candidate: CandidatePattern | null,
  candle: CandlestickPattern,
  composite: number,
  bonuses: CompositePattern['bonuses'],
  penalties: CompositePattern['penalties']
): string {
  const parts: string[] = [];

  // INSTITUTIONAL PATTERN (Valid/Tradeable)
  if (institutional) {
    parts.push(`Valid (Institutional) — ${institutional.name} (${institutional.confidence}%, ${institutional.confidenceLabel}) meets strict criteria. Tradeable structure.`);
    
    // Structure + Timing alignment
    if (institutional.direction === candle.type && institutional.direction !== 'neutral') {
      parts.push(`${candle.name} confirms entry timing in ${institutional.direction} direction.`);
    } else if (penalties.opposition) {
      parts.push(`⚠️ Conflicting signals: ${institutional.name} (${institutional.direction}) vs ${candle.name} (${candle.type}). Wait for clarity.`);
    } else {
      parts.push(`${candle.name} provides neutral confirmation.`);
    }

    // Breakout status
    if (institutional.breakoutStatus === 'confirmed') {
      parts.push(`Breakout confirmed with volume Z-score ${institutional.volumeZScore.toFixed(2)}.`);
    } else if (institutional.breakoutStatus === 'retest') {
      parts.push(`Breakout confirmed and successfully retested — strongest signal type.`);
    } else if (institutional.breakoutStatus === 'pending') {
      parts.push(`Breakout pending — pattern forming but not confirmed yet.`);
    }

    // Final assessment
    if (composite >= 80) {
      parts.push(`Composite ${composite}/100 (${getConfidenceLabel(composite)}) — high conviction trade idea.`);
    } else if (composite >= 60) {
      parts.push(`Composite ${composite}/100 (${getConfidenceLabel(composite)}) — decent setup, monitor for confirmation.`);
    } else {
      parts.push(`Composite ${composite}/100 (${getConfidenceLabel(composite)}) — wait for better confirmation.`);
    }
  }
  // CANDIDATE PATTERN (Not Confirmed)
  else if (candidate) {
    // Build detailed candidate narrative
    parts.push(`A potential ${candidate.name} pattern is forming but has not yet met institutional-grade criteria.`);
    
    // What it has (met criteria)
    if (candidate.metCriteria.length > 0) {
      const metSummary = candidate.metCriteria.slice(0, 2).join(', '); // First 2 criteria
      parts.push(`Current structure shows ${metSummary}.`);
    }
    
    // What it's missing (unmet criteria with specifics)
    if (candidate.unmetCriteria.length > 0) {
      const primaryUnmet = candidate.unmetCriteria[0]; // Most important unmet criterion
      parts.push(`However, ${primaryUnmet.toLowerCase()}.`);
    }
    
    // What to monitor (next steps)
    if (candidate.nextSteps.length > 0) {
      const primaryStep = candidate.nextSteps[0];
      parts.push(`${primaryStep}.`);
    }
    
    // Candle timing
    parts.push(`${candle.name} provides potential timing signal, but pattern confirmation is needed before considering entry.`);
    
    // Final note
    parts.push(`Composite capped at 65 — this is a learning opportunity, not a trade signal. Pattern may qualify as institutional after confirmation.`);
  }
  // NO STRUCTURE PATTERN
  else {
    if (candle.confirmationNeeded) {
      parts.push(`${candle.name} detected but needs confirmation. No structural chart pattern present — wait for clearer setup before entry.`);
    } else {
      parts.push(`${candle.name} (${candle.confidence}%) provides entry timing but lacks structural chart pattern.`);
    }
    parts.push(`Composite ${composite}/100 reflects absence of setup context. Consider waiting for chart pattern formation.`);
  }

  return parts.join(' ');
}

/**
 * Check liquidity and apply safeguards
 */
export function applyLiquiditySafeguards(
  composite: CompositePattern,
  avgDollarVolume: number,
  minLiquidityThreshold: number = 1000000 // $1M default
): CompositePattern {
  if (avgDollarVolume < minLiquidityThreshold) {
    const cappedComposite = Math.min(70, composite.composite);
    composite.composite = cappedComposite;
    composite.compositeLabel = getConfidenceLabel(cappedComposite);
    composite.reasons.push(`Low liquidity ($${(avgDollarVolume / 1000000).toFixed(1)}M avg) - capped at 70`);
    composite.analysis += ` ⚠️ Low liquidity warning: average dollar volume below threshold.`;
  }
  
  return composite;
}

/**
 * Check earnings proximity and apply safeguards
 */
export function applyEarningsSafeguards(
  composite: CompositePattern,
  daysToEarnings: number | null,
  blockWindow: number = 3
): CompositePattern {
  if (daysToEarnings !== null && daysToEarnings <= blockWindow) {
    composite.reasons.push(`⛔ Earnings in ${daysToEarnings} days - high risk event`);
    composite.analysis += ` ⛔ EARNINGS ALERT: ${daysToEarnings} days to earnings - consider avoiding or reducing size.`;
    
    // Demote to watch
    if (daysToEarnings <= 1) {
      composite.composite = Math.min(40, composite.composite);
      composite.compositeLabel = "blocked - earnings too close";
    }
  } else if (daysToEarnings !== null) {
    composite.reasons.push(`Earnings in ${daysToEarnings} days`);
  }
  
  return composite;
}
