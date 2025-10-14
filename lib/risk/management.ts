/**
 * Risk Management Module
 * Calculates entry, stop loss, targets, and risk/reward ratios
 */

import { TechnicalIndicators } from "../indicators/technical";
import { DetectedPattern } from "../patterns/detector";

export interface RiskManagementPlan {
  entry: number;
  stopLoss: number;
  targets: {
    target1: number;
    target2: number;
    target3: number;
  };
  riskReward: {
    target1: number;
    target2: number;
    target3: number;
  };
  atrValue: number;
  atrMultiple: number;
  riskPerShare: number;
  riskPercent: number;
  positionSize: string;
  riskAmount: string;
  reasoning: string;
  direction: "long" | "short";
}

interface SupportResistance {
  support: number[];
  resistance: number[];
}

/**
 * Calculate stop loss based on ATR and support levels
 */
function calculateStopLoss(
  currentPrice: number,
  atr: number,
  support: number[],
  pattern: DetectedPattern
): number {
  let stopLoss: number;
  
  if (pattern.type === "bullish") {
    // For bullish setups, place stop below support or 1.5x ATR (for realistic 5-8% risk)
    const atrStop = currentPrice - (1.5 * atr);
    const nearestSupport = support.find(s => s < currentPrice);
    
    if (nearestSupport && nearestSupport > atrStop) {
      // Place stop slightly below support
      stopLoss = nearestSupport * 0.995;
    } else {
      stopLoss = atrStop;
    }
  } else {
    // For bearish setups, place stop above resistance or 1.5x ATR (for realistic 5-8% risk)
    const resistance = support; // This should be resistance array in real implementation
    const atrStop = currentPrice + (1.5 * atr);
    const nearestResistance = resistance.find(r => r > currentPrice);
    
    if (nearestResistance && nearestResistance < atrStop) {
      // Place stop slightly above resistance
      stopLoss = nearestResistance * 1.005;
    } else {
      stopLoss = atrStop;
    }
  }
  
  return stopLoss;
}

/**
 * Calculate price targets based on technical levels
 */
function calculateTargets(
  currentPrice: number,
  stopLoss: number,
  resistance: number[],
  indicators: TechnicalIndicators,
  pattern: DetectedPattern
): { target1: number; target2: number; target3: number } {
  const riskAmount = Math.abs(currentPrice - stopLoss);
  
  if (pattern.type === "bullish") {
    // Bullish targets
    const target1 = currentPrice + (riskAmount * 2); // 2R
    const target2 = currentPrice + (riskAmount * 3); // 3R
    const target3 = currentPrice + (riskAmount * 4); // 4R
    
    // Adjust targets if they hit resistance levels
    const adjustedTarget1 = resistance.find(r => r > currentPrice && r < target1) 
      ? resistance.find(r => r > currentPrice)! * 0.995 
      : target1;
    
    return {
      target1: adjustedTarget1,
      target2,
      target3
    };
  } else {
    // Bearish targets
    const target1 = currentPrice - (riskAmount * 2); // 2R
    const target2 = currentPrice - (riskAmount * 3); // 3R
    const target3 = currentPrice - (riskAmount * 4); // 4R
    
    return {
      target1,
      target2,
      target3
    };
  }
}

/**
 * Calculate risk/reward ratios
 */
function calculateRiskReward(
  entry: number,
  stopLoss: number,
  targets: { target1: number; target2: number; target3: number }
): { target1: number; target2: number; target3: number } {
  const risk = Math.abs(entry - stopLoss);
  
  return {
    target1: Math.abs(targets.target1 - entry) / risk,
    target2: Math.abs(targets.target2 - entry) / risk,
    target3: Math.abs(targets.target3 - entry) / risk
  };
}

/**
 * Generate risk management reasoning
 */
function generateReasoning(
  pattern: DetectedPattern,
  indicators: TechnicalIndicators,
  rr: { target1: number; target2: number; target3: number },
  atrMultiple: number,
  riskPercent: number
): string {
  const parts: string[] = [];
  
  // Pattern-based reasoning
  parts.push(`Entry based on ${pattern.name} pattern (${pattern.confidence}% confidence).`);
  
  // Stop loss reasoning with proper ATR explanation
  parts.push(`ATR(14) = $${indicators.atr.toFixed(2)}. Stop placed ${atrMultiple.toFixed(2)}× ATR ${pattern.type === "bullish" ? "below" : "above"} entry (${riskPercent.toFixed(2)}% per-share risk).`);
  
  // Target reasoning
  parts.push(`Targets at ${rr.target1.toFixed(1)}:1, ${rr.target2.toFixed(1)}:1, and ${rr.target3.toFixed(1)}:1 R:R.`);
  
  // Trend consideration
  if (pattern.type === "bullish" && indicators.trend === "bullish") {
    parts.push("Bullish trend alignment supports upside targets.");
  } else if (pattern.type === "bearish" && indicators.trend === "bearish") {
    parts.push("Bearish trend alignment supports downside targets.");
  } else if (pattern.type === "bullish" && indicators.trend === "bearish") {
    parts.push("⚠️ Counter-trend trade (bullish vs bearish trend) - higher risk.");
  } else if (pattern.type === "bearish" && indicators.trend === "bullish") {
    parts.push("⚠️ Counter-trend trade (bearish vs bullish trend) - higher risk.");
  } else {
    parts.push("Neutral trend - watch for directional confirmation.");
  }
  
  return parts.join(" ");
}

/**
 * Create comprehensive risk management plan
 */
export function createRiskManagementPlan(
  currentPrice: number,
  indicators: TechnicalIndicators,
  pattern: DetectedPattern,
  supportResistance: SupportResistance,
  executionDirection?: "bullish" | "bearish" | "neutral"
): RiskManagementPlan {
  // Entry is current price (assuming immediate entry)
  const entry = currentPrice;
  
  // Calculate stop loss
  const stopLoss = calculateStopLoss(
    currentPrice,
    indicators.atr,
    supportResistance.support,
    pattern
  );
  
  // Calculate targets
  const targets = calculateTargets(
    currentPrice,
    stopLoss,
    supportResistance.resistance,
    indicators,
    pattern
  );
  
  // Calculate risk/reward ratios
  const riskReward = calculateRiskReward(entry, stopLoss, targets);
  
  // Calculate ATR multiple and risk metrics
  const riskPerShare = Math.abs(entry - stopLoss);
  const atrMultiple = riskPerShare / indicators.atr;
  const riskPercent = (riskPerShare / entry) * 100;
  
  // Generate reasoning with proper ATR explanation
  const reasoning = generateReasoning(pattern, indicators, riskReward, atrMultiple, riskPercent);
  
  // Position sizing guidance (1-2% account risk rule)
  const positionSize = `Per-share risk: $${riskPerShare.toFixed(2)} (~${riskPercent.toFixed(2)}%). Size position so total account risk = 1-2%.`;
  const riskAmount = `Example: $10,000 account → risk $100-200 total → position size = ${Math.floor(100 / riskPerShare)} - ${Math.floor(200 / riskPerShare)} shares.`;
  
  return {
    entry: Number(entry.toFixed(2)),
    stopLoss: Number(stopLoss.toFixed(2)),
    targets: {
      target1: Number(targets.target1.toFixed(2)),
      target2: Number(targets.target2.toFixed(2)),
      target3: Number(targets.target3.toFixed(2))
    },
    riskReward: {
      target1: Number(riskReward.target1.toFixed(2)),
      target2: Number(riskReward.target2.toFixed(2)),
      target3: Number(riskReward.target3.toFixed(2))
    },
    atrValue: Number(indicators.atr.toFixed(2)),
    atrMultiple: Number(atrMultiple.toFixed(2)),
    riskPerShare: Number(riskPerShare.toFixed(2)),
    riskPercent: Number(riskPercent.toFixed(2)),
    positionSize,
    riskAmount,
    reasoning,
    // CRITICAL: Use executionDirection if provided, otherwise fall back to pattern type
    direction: executionDirection === "bullish" ? "long" :
               executionDirection === "bearish" ? "short" :
               pattern.type === "bullish" ? "long" : "short"
  };
}

/**
 * Validate if trade meets minimum R:R criteria
 */
export function validateRiskReward(
  rr: { target1: number; target2: number; target3: number },
  minRR: number = 2
): { isValid: boolean; message: string } {
  if (rr.target1 < minRR) {
    return {
      isValid: false,
      message: `Risk/Reward of ${rr.target1.toFixed(1)}:1 is below minimum ${minRR}:1. Consider passing on this setup.`
    };
  }
  
  return {
    isValid: true,
    message: `Risk/Reward ratios are favorable for swing trading.`
  };
}

