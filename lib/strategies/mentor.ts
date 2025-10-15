/**
 * Mentor Prompt Generation - AI Trading Advisor
 * Version 1.1 - Generates mentor explanations following spec contract
 */

import { StrategyEvaluation, StrategyType } from './types';

// ===========================
// Mentor Prompt Contract
// ===========================

const SYSTEM_MESSAGE = `You are an objective swing-trading mentor. You never invent facts. You only use the JSON "Facts" provided. Explain setup, rules passed/failed, entry/stop/targets, risk/reward, and context (earnings/regime/liquidity). If RR_first < 1.5 or hard block applies, reply "No trade" and explain which rule blocked it.`;

// ===========================
// Mentor Explanation Generator
// ===========================

/**
 * Generate mentor explanation for a strategy evaluation
 */
export function generateMentorExplanation(
  evaluation: StrategyEvaluation
): string {
  if (evaluation.status === 'blocked') {
    return generateBlockedExplanation(evaluation);
  }
  
  if (evaluation.status === 'no_trade') {
    return generateNoTradeExplanation(evaluation);
  }
  
  // Valid trade setup
  const sections: string[] = [];
  
  // 1. Setup Summary
  sections.push(generateSetupSummary(evaluation));
  
  // 2. Why It Qualifies
  sections.push(generateQualificationSection(evaluation));
  
  // 3. Pattern Context
  const patternContext = generatePatternContext(evaluation);
  if (patternContext) {
    sections.push(patternContext);
  }
  
  // 4. Trade Plan
  sections.push(generateTradePlan(evaluation));
  
  // 5. Context & Risks
  sections.push(generateContextAndRisks(evaluation));
  
  // 6. Historical Context
  if (evaluation.historicalRecent || evaluation.historical) {
    sections.push(generateHistoricalContext(evaluation));
  }
  
  // 7. Contextual Cautions
  const contextualCautions = generateContextualCautions(evaluation);
  if (contextualCautions) {
    sections.push(contextualCautions);
  }
  
  // 8. Invalidation Rules
  sections.push(generateInvalidationRules(evaluation));
  
  return sections.join('\n\n');
}

// ===========================
// Section Generators
// ===========================

function generateBlockedExplanation(evaluation: StrategyEvaluation): string {
  return `**No Trade - Hard Block**

${evaluation.blockReason}

This ticker fails a mandatory safety filter and cannot be traded regardless of setup quality.`;
}

function generateNoTradeExplanation(evaluation: StrategyEvaluation): string {
  const reasons = evaluation.reasons.join('\n- ');
  const rrIssue = evaluation.rrFirst > 0 && evaluation.rrFirst < 1.5;
  
  // Add strategy evaluation summary if available
  let strategyBreakdown = '';
  if (evaluation.metadata?.strategyDetails) {
    strategyBreakdown = `\n\n**Strategy Evaluation Summary**\n\n`;
    strategyBreakdown += `Evaluated ${evaluation.metadata.totalEvaluated || 6} strategies:\n`;
    strategyBreakdown += `- Eligible: ${evaluation.metadata.eligibleFound || 0}\n`;
    strategyBreakdown += `- Passed R:R (≥1.5): ${evaluation.metadata.passedRR || 0}\n`;
  }
  
  return `**No Trade${rrIssue ? ' - Insufficient Risk/Reward' : ''}**

${rrIssue ? `First target R:R is ${evaluation.rrFirst.toFixed(2)} (minimum 1.5 required).\n\n` : ''}Reasons:
- ${reasons}${strategyBreakdown}

No actionable setup meets criteria at this time.`;
}

function generateSetupSummary(evaluation: StrategyEvaluation): string {
  const strategyName = getStrategyDisplayName(evaluation.strategy);
  const direction = evaluation.plan?.direction.toUpperCase() || 'N/A';
  const status = evaluation.status === 'ready' ? '✓ Ready to Trade' : '⚠ Candidate (awaiting confirmation)';
  
  // Add strategy evaluation counts
  let evaluationSummary = '';
  if (evaluation.metadata?.strategyDetails && evaluation.metadata.strategyDetails.length > 0) {
    evaluationSummary = `\n\n**Strategy Selection:** Best of ${evaluation.metadata.totalEvaluated || 6} evaluated (${evaluation.metadata.eligibleFound || 0} eligible, ${evaluation.metadata.passedRR || 0} passed R:R minimum)`;
  }
  
  // Add strongest caution if applicable
  const strongestCaution = generateStrongestCaution(evaluation);
  const cautionLine = strongestCaution ? `\n\n**⚠ ${strongestCaution}**` : '';
  
  // Add insufficient sample warning for READY status
  let insufficientSampleWarning = '';
  if (evaluation.status === 'ready' && evaluation.historicalRecent && !evaluation.historicalRecent.hasMinSamples) {
    insufficientSampleWarning = '\n\n**⚠ No historical precedent on this ticker—size down (0.5–1.0% risk) until data builds.**';
  }
  
  // Add volume confirmation warning
  let volumeWarning = '';
  const volZ = evaluation.metadata?.volZ;
  if (volZ !== undefined && volZ >= 0 && volZ < 0.3) {
    volumeWarning = '\n\n**⚠ Confirmation volume modest—avoid chasing.**';
  }
  
  return `**${strategyName} - ${direction}**
*${status}*

${evaluation.symbol} on ${evaluation.timeframe} timeframe as of ${evaluation.asOf}.

**Quality Score:** ${(evaluation.quality * 100).toFixed(0)}%
**Viability Score:** ${(evaluation.viability * 100).toFixed(0)}% (includes volume & regime multipliers)
**First Target R:R:** ${evaluation.rrFirst.toFixed(2)}${evaluationSummary}${cautionLine}${insufficientSampleWarning}${volumeWarning}`;
}

function generateQualificationSection(evaluation: StrategyEvaluation): string {
  const reasons = evaluation.reasons.map(r => `- ${r}`).join('\n');
  
  return `**Why This Setup Qualifies**

${reasons}

${evaluation.status === 'candidate' ? '\n*Note: Awaiting multi-bar confirmation before entry.*' : ''}`;
}

function generatePatternContext(evaluation: StrategyEvaluation): string | null {
  const patternContexts = evaluation.metadata?.patternContexts;
  if (!patternContexts) return null;
  
  const detectedPatterns: string[] = [];
  
  // Check each pattern type
  if (patternContexts.triangle) {
    const ctx = patternContexts.triangle;
    detectedPatterns.push(`${ctx.name} (${ctx.status}) - ${ctx.direction} ${ctx.type}`);
  }
  
  if (patternContexts.flag) {
    const ctx = patternContexts.flag;
    detectedPatterns.push(`${ctx.name} (${ctx.status}) - ${ctx.direction} ${ctx.type}`);
  }
  
  if (patternContexts.doubleTop) {
    const ctx = patternContexts.doubleTop;
    detectedPatterns.push(`${ctx.name} (${ctx.status}) - ${ctx.direction} ${ctx.type}`);
  }
  
  if (patternContexts.doubleBottom) {
    const ctx = patternContexts.doubleBottom;
    detectedPatterns.push(`${ctx.name} (${ctx.status}) - ${ctx.direction} ${ctx.type}`);
  }
  
  if (detectedPatterns.length === 0) return null;
  
  let context = `**Detected Chart Patterns**\n\n`;
  context += detectedPatterns.map(pattern => `- ${pattern}`).join('\n');
  
  // Add key levels if available
  const keyLevels: string[] = [];
  if (patternContexts.triangle?.resistance) {
    keyLevels.push(`Triangle Resistance: ${patternContexts.triangle.resistance.toFixed(2)}`);
  }
  if (patternContexts.flag?.resistance) {
    keyLevels.push(`Flag Resistance: ${patternContexts.flag.resistance.toFixed(2)}`);
  }
  if (patternContexts.doubleTop?.resistance) {
    keyLevels.push(`Double Top: ${patternContexts.doubleTop.resistance.toFixed(2)}`);
  }
  
  if (keyLevels.length > 0) {
    context += `\n\n**Key Levels:**\n${keyLevels.map(level => `- ${level}`).join('\n')}`;
  }
  
  return context;
}

function generateTradePlan(evaluation: StrategyEvaluation): string {
  if (!evaluation.plan) {
    return '**Trade Plan:** Not available';
  }
  
  const { trigger, entry, stop, targets, direction } = evaluation.plan;
  
  const risk = direction === 'long' ? entry - stop : stop - entry;
  const riskPct = (risk / entry * 100).toFixed(2);
  
  const targetsText = targets.map((t, i) => 
    `  T${i + 1}: $${t.level.toFixed(2)} (R:R ${t.rr.toFixed(2)}) ${t.label || ''}`
  ).join('\n');
  
  return `**Trade Plan**

**Trigger:** ${trigger.description}
**Entry:** $${entry.toFixed(2)}
**Stop Loss:** $${stop.toFixed(2)} (${riskPct}% risk)

**Targets:**
${targetsText}

**Position Sizing Guidance:** 
Risk ${riskPct}% of entry price per share. Scale position to maintain 1-2% account risk.`;
}

function generateContextAndRisks(evaluation: StrategyEvaluation): string {
  const metadata = evaluation.metadata || {};
  const confirmation = metadata.confirmation;
  
  let context = `**Market Context & Risk Factors**\n\n`;
  
  // Confirmation status
  if (confirmation) {
    context += `**Confirmation Status:**\n`;
    context += `- Bars required: ${confirmation.barsRequired}\n`;
    context += `- Conditions: ${confirmation.conditions.join('; ')}\n`;
    context += `- Satisfied: ${confirmation.satisfied ? '✓ Yes' : '✗ Not yet'}\n\n`;
  }
  
  // General risks
  context += `**Key Risks:**\n`;
  context += `- Volatility: Monitor ATR expansion that could invalidate setup\n`;
  context += `- Volume: Ensure breakout/breakdown has volume confirmation\n`;
  context += `- Regime: Market regime shifts can reduce viability\n`;
  
  return context;
}

function generateHistoricalContext(evaluation: StrategyEvaluation): string {
  const recent = evaluation.historicalRecent;
  const analog = evaluation.historical;
  
  let context = `**Historical Backtest Performance**\n\n`;
  
  // Data freshness info
  if (recent?.dataLastRefreshedAt) {
    const ageHours = recent.dataAgeHours;
    const ageText = ageHours < 1 ? `${Math.round(ageHours * 60)}m ago` : 
                   ageHours < 24 ? `${Math.round(ageHours)}h ago` : 
                   `${Math.round(ageHours / 24)}d ago`;
    
    context += `**Data Freshness:** Last updated ${ageText}\n\n`;
  }
  
  if (recent && recent.samples > 0) {
    context += `**Backtested (last 12 months / ≤252 bars) (${recent.samples} signals found):**\n`;
    
    // Last signal info
    if (recent.lastSignalNote) {
      context += `**${recent.lastSignalNote}**\n\n`;
    }
    
    // Handle insufficient samples
    if (!recent.hasMinSamples) {
      context += `⚠ **Insufficient sample—do not rely on stats**\n\n`;
    } else {
      // Quality warnings for sufficient samples
      if (recent.isWeakHistory) {
        context += `⚠ **Weak Historical Performance:** This pattern has underperformed on ${evaluation.symbol} (win rate < 20% or negative avg P&L)\n`;
      }
      
      // Multi-horizon win rates (only show if sufficient samples)
      context += `\n**Win Rates:**\n`;
      context += `- 5-day: ${(recent.winRate5d * 100).toFixed(1)}%\n`;
      context += `- 10-day: ${(recent.winRate10d * 100).toFixed(1)}%\n`;
      context += `- 20-day: ${(recent.winRate20d * 100).toFixed(1)}%\n`;
      
      // Multi-horizon average P&L (only show if sufficient samples)
      context += `\n**Average P&L:**\n`;
      context += `- 5-day: ${(recent.avgPnL5d * 100).toFixed(2)}%\n`;
      context += `- 10-day: ${(recent.avgPnL10d * 100).toFixed(2)}%\n`;
      context += `- 20-day: ${(recent.avgPnL20d * 100).toFixed(2)}%\n`;
      
      // First-touch distribution (only show if sufficient samples)
      context += `\n**First-Touch Outcomes:**\n`;
      context += `- T1 first: ${recent.firstTouchT1} (${((recent.firstTouchT1 / recent.samples) * 100).toFixed(1)}%)\n`;
      context += `- T2 first: ${recent.firstTouchT2} (${((recent.firstTouchT2 / recent.samples) * 100).toFixed(1)}%)\n`;
      context += `- T3 first: ${recent.firstTouchT3} (${((recent.firstTouchT3 / recent.samples) * 100).toFixed(1)}%)\n`;
      context += `- Stop first: ${recent.firstTouchStop} (${((recent.firstTouchStop / recent.samples) * 100).toFixed(1)}%)\n`;
      context += `- Avg hold time: ${recent.avgDaysHeld.toFixed(1)} days\n`;
      
      if (recent.lastSignal) {
        context += `\n**Most Recent Signal:**\n`;
        context += `- Date: ${recent.lastSignal.date}\n`;
        context += `- First Touch: ${recent.lastSignal.firstTouch}\n`;
        context += `- Days Held: ${recent.lastSignal.daysHeld}\n`;
        context += `- 10-day P&L: ${(recent.lastSignal.pnl10d * 100).toFixed(2)}%\n`;
      }
    }
  } else {
    context += `**Backtested (last 12 months / ≤252 bars):** No historical occurrences found (pattern is new on this ticker)\n`;
    context += `⚠ **No Historical Precedent:** Exercise extra caution - no past data to validate this setup\n`;
  }
  
  // Note: Global analog data removed (would require cross-ticker backtesting)
  
  return context;
}

/**
 * Generate contextual cautions based on historical data and current setup
 */
export function generateContextualCautions(evaluation: StrategyEvaluation): string {
  const recent = evaluation.historicalRecent;
  const cautions: string[] = [];
  
  if (!recent || recent.samples === 0) {
    return '';
  }
  
  // Sample size caution
  if (recent.samples < 10) {
    cautions.push('Insufficient sample—do not rely on win rate');
  }
  
  // Stop-first dominance caution
  const stopFirstRatio = recent.firstTouchStop / recent.samples;
  if (stopFirstRatio >= 0.5) {
    cautions.push('Most historical trades hit stop first—treat as high-risk or scalp-only');
  }
  
  // Short holding period caution
  if (recent.avgDaysHeld <= 2) {
    cautions.push('Typically resolves within ~1–2 days—shorter holding horizon recommended');
  }
  
  // Volume confirmation requirement
  if (evaluation.metadata?.volZ !== undefined && evaluation.metadata.volZ < 0) {
    cautions.push('Confirmation must include a volume uptick (volZ ≥ 0)');
  }
  
  // Front-loaded edge detection
  if (recent.winRate5d >= recent.winRate10d && recent.winRate20d < recent.winRate10d) {
    cautions.push('Edge is front-loaded—favor quick exits');
  }
  
  // Minimum R:R caution
  if (evaluation.rrFirst <= 1.5) {
    cautions.push('Reward-to-risk at minimum—avoid chasing entry/size down');
  }
  
  // Good win rates but stop dominance
  if (recent.winRate10d >= 0.6 && stopFirstRatio >= 0.4) {
    cautions.push('Short-term pops often fade—protect profits early');
  }
  
  if (cautions.length === 0) {
    return '';
  }
  
  return `**Contextual Cautions:**\n${cautions.map(c => `- ${c}`).join('\n')}\n`;
}

/**
 * Generate strongest applicable caution for setup summary
 */
export function generateStrongestCaution(evaluation: StrategyEvaluation): string {
  const recent = evaluation.historicalRecent;
  
  if (!recent || recent.samples === 0) {
    return 'No historical precedent—maximum caution advised';
  }
  
  // Priority order: most critical first
  if (recent.samples < 10) {
    return 'Limited sample size—statistics unreliable';
  }
  
  const stopFirstRatio = recent.firstTouchStop / recent.samples;
  if (stopFirstRatio >= 0.5) {
    return 'High stop-first rate—scalp-only or avoid';
  }
  
  if (evaluation.rrFirst <= 1.5) {
    return 'Minimum R:R—avoid size increases';
  }
  
  if (recent.isWeakHistory) {
    return 'Weak historical performance—proceed with caution';
  }
  
  if (recent.avgDaysHeld <= 2) {
    return 'Quick resolution expected—shorter timeframes';
  }
  
  if (evaluation.metadata?.volZ !== undefined && evaluation.metadata.volZ < 0) {
    return 'Volume confirmation required';
  }
  
  return '';
}

function generateInvalidationRules(evaluation: StrategyEvaluation): string {
  if (!evaluation.plan) {
    return '';
  }
  
  const rules = evaluation.plan.invalidationRules.map(r => `- ${r}`).join('\n');
  
  return `**Exit & Invalidation Rules**

**Stop Loss:** $${evaluation.plan.stop.toFixed(2)} (hard stop, no exceptions)

**Pattern Invalidation (exit immediately):**
${rules}

**Profit Taking:**
- Take 1/3 position at T1, move stop to breakeven
- Take 1/3 at T2, trail remaining with 1×ATR
- Let final 1/3 run to T3 or trailing stop`;
}

// ===========================
// Helper Functions
// ===========================

function getStrategyDisplayName(strategy: StrategyType): string {
  const names: Record<StrategyType, string> = {
    triangle_breakout_long: 'Triangle Breakout',
    flag_breakout_long: 'Bull Flag Breakout',
    double_top_short: 'Double Top Breakdown',
    trend_pullback_long: 'Trend Pullback (Strict)',
    mean_reversion_short: 'Mean Reversion (Overbought Fade)',
    failed_breakout_short: 'Failed Breakout Reversal',
  };
  
  return names[strategy] || strategy;
}

// ===========================
// Full Mentor Output (JSON + Explanation)
// ===========================

/**
 * Generate complete mentor output with JSON facts and explanation
 */
export function generateFullMentorOutput(
  evaluation: StrategyEvaluation
): {
  facts: StrategyEvaluation;
  systemMessage: string;
  explanation: string;
} {
  return {
    facts: evaluation,
    systemMessage: SYSTEM_MESSAGE,
    explanation: generateMentorExplanation(evaluation),
  };
}

/**
 * Generate markdown report for a strategy evaluation
 */
export function generateMarkdownReport(evaluation: StrategyEvaluation): string {
  const explanation = generateMentorExplanation(evaluation);
  
  const report = `# ${evaluation.symbol} - ${getStrategyDisplayName(evaluation.strategy)}

${explanation}

---

## JSON Facts (Machine-Readable)

\`\`\`json
${JSON.stringify(evaluation, null, 2)}
\`\`\`
`;
  
  return report;
}

