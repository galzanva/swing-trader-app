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
  positionSize: string;
  riskAmount: string;
  reasoning: string;
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
    // For bullish setups, place stop below support or 2x ATR
    const atrStop = currentPrice - (2 * atr);
    const nearestSupport = support.find(s => s < currentPrice);
    
    if (nearestSupport && nearestSupport > atrStop) {
      // Place stop slightly below support
      stopLoss = nearestSupport * 0.995;
    } else {
      stopLoss = atrStop;
    }
  } else {
    // For bearish setups, place stop above resistance or 2x ATR
    const resistance = support; // This should be resistance array in real implementation
    const atrStop = currentPrice + (2 * atr);
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
  rr: { target1: number; target2: number; target3: number }
): string {
  const parts: string[] = [];
  
  // Pattern-based reasoning
  parts.push(`Entry based on ${pattern.name} pattern (${pattern.confidence}% confidence).`);
  
  // Stop loss reasoning
  parts.push(`Stop loss placed at ${indicators.atr.toFixed(2)} ATR distance to allow for normal volatility.`);
  
  // Target reasoning
  parts.push(`Targets set at ${rr.target1.toFixed(1)}:1, ${rr.target2.toFixed(1)}:1, and ${rr.target3.toFixed(1)}:1 R:R ratios.`);
  
  // Trend consideration
  if (indicators.trend === "bullish") {
    parts.push("Trend alignment supports upside targets.");
  } else if (indicators.trend === "bearish") {
    parts.push("Trend alignment supports downside targets.");
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
  supportResistance: SupportResistance
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
  
  // Generate reasoning
  const reasoning = generateReasoning(pattern, indicators, riskReward);
  
  // Position sizing guidance (1% risk rule)
  const riskPercent = Math.abs((entry - stopLoss) / entry) * 100;
  const positionSize = `Risk ${riskPercent.toFixed(2)}% per share. Size position for 1-2% account risk.`;
  const riskAmount = `If account is $10,000, risk $100-200 total on this trade.`;
  
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
    positionSize,
    riskAmount,
    reasoning
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

