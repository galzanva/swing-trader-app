/**
 * QA Checklist for Trader Journey / legacy analysis reports
 * Validates all deterministic, rule-based standards for accuracy, transparency, and institutional-grade clarity
 */

export interface QAResult {
  passed: boolean;
  score: number; // 0-100
  issues: QAIssue[];
  warnings: QAWarning[];
  summary: string;
}

export interface QAIssue {
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  location?: string;
}

export interface QAWarning {
  category: string;
  message: string;
  suggestion?: string;
}

export interface AnalysisReportForQA {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  marketData: {
    lastBarDate: string;
    dataAgeDays: number;
  };
  pattern: {
    name: string;
    type: string;
    confidence: number;
  };
  chartPattern?: {
    name: string;
    type: string;
    confidence: number;
    confidenceLabel?: string;
  };
  patternV2?: {
    institutional?: {
      name: string;
      direction: string;
      confidence: number;
    };
    candidate?: {
      name: string;
      direction: string;
      confidence: number;
      unmetCriteria?: string[];
      nextSteps?: string[];
    };
  };
  score: {
    overall: number;
    rating: string;
    recommendation: string;
    breakdown: {
      technical: number;
      momentum: number;
      trend: number;
      pattern: number;
      volume: number;
    };
  };
  execution: {
    entry: {
      type: string;
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
    status: string;
    viabilityIndex?: number;
    viabilityLabel?: string;
    warnings: string[];
  };
  technical: {
    trend: string;
    trendStrength: number;
    volumeZScore: number;
    emaCompression: number;
    ema9: number;
    ema20: number;
    ema50: number;
    ema200: number;
  };
  riskManagement: {
    direction: string;
  };
  analysis: {
    mentorNotes: string;
  };
}

export function validateReport(report: AnalysisReportForQA): QAResult {
  const issues: QAIssue[] = [];
  const warnings: QAWarning[] = [];
  let score = 100;

  // ✅ 1. Section Consistency & Formatting
  validateSectionConsistency(report, issues, warnings);

  // ✅ 2. Pattern & Confidence Accuracy
  validatePatternAccuracy(report, issues, warnings);

  // ✅ 3. Execution Plan Integrity
  validateExecutionPlan(report, issues, warnings);

  // ✅ 4. Volume & Trend Logic
  validateVolumeAndTrend(report, issues, warnings);

  // ✅ 5. Composite Scoring
  validateCompositeScoring(report, issues, warnings);

  // ✅ 6. Mentor Notes Alignment
  validateMentorNotes(report, issues, warnings);

  // ✅ 7. Readability & Tone
  validateReadability(report, issues, warnings);

  // Calculate score based on issues
  issues.forEach(issue => {
    switch (issue.severity) {
      case 'critical':
        score -= 20;
        break;
      case 'high':
        score -= 10;
        break;
      case 'medium':
        score -= 5;
        break;
      case 'low':
        score -= 2;
        break;
    }
  });

  warnings.forEach(() => {
    score -= 1;
  });

  score = Math.max(0, score);
  const passed = score >= 80 && issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0;

  const summary = generateSummary(passed, score, issues, warnings);

  return {
    passed,
    score,
    issues,
    warnings,
    summary
  };
}

function validateSectionConsistency(report: AnalysisReportForQA, issues: QAIssue[], warnings: QAWarning[]): void {
  // Check grade letter matches composite score
  const expectedGrade = getExpectedGrade(report.score.overall);
  if (report.score.rating !== expectedGrade) {
    issues.push({
      category: 'Section Consistency',
      severity: 'critical',
      message: `Grade mismatch: Score ${report.score.overall} should be grade ${expectedGrade}, but got ${report.score.rating}`,
      location: 'Score section'
    });
  }

  // Check direction consistency
  const executionDirection = report.execution.entry.type.includes('down') ? 'short' : 'long';
  if (report.riskManagement.direction !== executionDirection && report.execution.status !== 'neutral') {
    issues.push({
      category: 'Section Consistency',
      severity: 'high',
      message: `Direction mismatch: Risk management shows ${report.riskManagement.direction} but execution shows ${executionDirection}`,
      location: 'Direction'
    });
  }
}

function validatePatternAccuracy(report: AnalysisReportForQA, issues: QAIssue[], warnings: QAWarning[]): void {
  // Check if candidate pattern has "Fails institutional criteria"
  if (report.patternV2?.candidate && !report.patternV2.institutional) {
    if (!report.patternV2.candidate.unmetCriteria || report.patternV2.candidate.unmetCriteria.length === 0) {
      issues.push({
        category: 'Pattern Accuracy',
        severity: 'high',
        message: 'Candidate pattern missing unmet criteria details',
        location: 'Pattern V2 section'
      });
    }

    if (!report.patternV2.candidate.nextSteps || report.patternV2.candidate.nextSteps.length === 0) {
      warnings.push({
        category: 'Pattern Accuracy',
        message: 'Candidate pattern missing "Next Steps" guidance'
      });
    }
  }

  // Check confidence values are capped at 95%
  if (report.pattern.confidence > 95) {
    issues.push({
      category: 'Pattern Accuracy',
      severity: 'medium',
      message: `Candlestick confidence ${report.pattern.confidence}% exceeds 95% cap`,
      location: 'Pattern section'
    });
  }

  if (report.chartPattern && report.chartPattern.confidence > 95) {
    issues.push({
      category: 'Pattern Accuracy',
      severity: 'medium',
      message: `Chart pattern confidence ${report.chartPattern.confidence}% exceeds 95% cap`,
      location: 'Chart pattern section'
    });
  }
}

function validateExecutionPlan(report: AnalysisReportForQA, issues: QAIssue[], warnings: QAWarning[]): void {
  // Check entry is not current price
  if (Math.abs(report.execution.entry.triggerPrice - report.currentPrice) < 0.01) {
    warnings.push({
      category: 'Execution Plan',
      message: 'Entry trigger equals current price - may not be using confirmation-based logic',
      suggestion: 'Ensure entry is based on breakout/breakdown confirmation, not current price'
    });
  }

  // Check percentages are shown
  if (report.execution.stopLoss.movePct === 0) {
    issues.push({
      category: 'Execution Plan',
      severity: 'medium',
      message: 'Stop loss percentage not calculated',
      location: 'Execution Plan - Stop Loss'
    });
  }

  report.execution.targets.forEach((target, idx) => {
    if (target.movePct === 0) {
      issues.push({
        category: 'Execution Plan',
        severity: 'medium',
        message: `Target ${idx + 1} percentage not calculated`,
        location: `Execution Plan - ${target.name}`
      });
    }
  });

  // Check Viability Index reflects volume impact
  if (report.execution.viabilityIndex) {
    const volZ = report.technical.volumeZScore;
    
    // If volume is very low, viability should be penalized
    if (volZ < -0.5 && report.execution.viabilityIndex > 1.5) {
      warnings.push({
        category: 'Execution Plan',
        message: `Viability Index ${report.execution.viabilityIndex} seems high for low volume (volZ ${volZ.toFixed(2)})`,
        suggestion: 'Expected volume penalty (×0.5) for volZ < -0.5'
      });
    }

    // Clamp check
    if (report.execution.viabilityIndex < 0.5 || report.execution.viabilityIndex > 2.5) {
      issues.push({
        category: 'Execution Plan',
        severity: 'medium',
        message: `Viability Index ${report.execution.viabilityIndex} outside 0.5-2.5 range`,
        location: 'Execution Plan - Viability Index'
      });
    }
  }

  // Check verdict is present for non-neutral setups
  if (report.execution.status !== 'neutral' && !report.execution.warnings.some(w => w.includes('Verdict'))) {
    warnings.push({
      category: 'Execution Plan',
      message: 'Institutional verdict may be missing from execution plan',
      suggestion: 'Add verdict section with institutional grade assessment'
    });
  }
}

function validateVolumeAndTrend(report: AnalysisReportForQA, issues: QAIssue[], warnings: QAWarning[]): void {
  // Check counter-trend labeling
  const isShort = report.riskManagement.direction === 'short';
  const isLong = report.riskManagement.direction === 'long';
  const priceAbove200 = report.currentPrice > report.technical.ema200;
  const priceBelow200 = report.currentPrice < report.technical.ema200;

  const isCounterTrend = (isShort && priceAbove200) || (isLong && priceBelow200);

  if (isCounterTrend) {
    // Should have counter-trend warning
    if (!report.execution.warnings.some(w => w.toLowerCase().includes('counter-trend'))) {
      warnings.push({
        category: 'Volume & Trend',
        message: 'Counter-trend setup missing explicit warning',
        suggestion: 'Add counter-trend warning to execution plan'
      });
    }
  }

  // Check volume requirements mentioned
  if (report.technical.volumeZScore < 0) {
    const hasVolumeWarning = report.execution.warnings.some(w => w.toLowerCase().includes('volume'));
    if (!hasVolumeWarning) {
      warnings.push({
        category: 'Volume & Trend',
        message: 'Low volume (volZ < 0) but no volume warning present',
        suggestion: 'Add "Need average+ volume on break" to warnings'
      });
    }
  }

  // Check EMA proximity calculation
  const emaValues = [report.technical.ema9, report.technical.ema20, report.technical.ema50];
  const maxEma = Math.max(...emaValues);
  const minEma = Math.min(...emaValues);
  const calculatedCompression = ((maxEma - minEma) / minEma) * 100;

  if (Math.abs(calculatedCompression - report.technical.emaCompression) > 0.5) {
    issues.push({
      category: 'Volume & Trend',
      severity: 'medium',
      message: `EMA compression mismatch: Calculated ${calculatedCompression.toFixed(2)}% vs reported ${report.technical.emaCompression.toFixed(2)}%`,
      location: 'Technical Indicators'
    });
  }
}

function validateCompositeScoring(report: AnalysisReportForQA, issues: QAIssue[], warnings: QAWarning[]): void {
  // Check candidate cap
  if (report.execution.status === 'candidate' && report.score.overall > 65) {
    issues.push({
      category: 'Composite Scoring',
      severity: 'critical',
      message: `Candidate setup has composite score ${report.score.overall} exceeding cap of 65`,
      location: 'Score section'
    });
  }

  // Validate sub-scores sum (approximate due to weighting)
  const hasChartPattern = !!report.chartPattern;
  const breakdown = report.score.breakdown;

  let expectedWeightedSum: number;
  if (hasChartPattern) {
    // With chart pattern: tech 25%, momentum 20%, trend 15%, pattern 25%, chart 10%, volume 5%
    expectedWeightedSum = 
      (breakdown.technical * 0.25) +
      (breakdown.momentum * 0.20) +
      (breakdown.trend * 0.15) +
      (breakdown.pattern * 0.25) +
      (breakdown.volume * 0.05);
    // Note: chart pattern score is separate, not in breakdown
  } else {
    // Without chart pattern: tech 30%, momentum 25%, trend 20%, pattern 15%, volume 10%
    expectedWeightedSum = 
      (breakdown.technical * 0.30) +
      (breakdown.momentum * 0.25) +
      (breakdown.trend * 0.20) +
      (breakdown.pattern * 0.15) +
      (breakdown.volume * 0.10);
  }

  // Allow 10 points tolerance due to caps and adjustments
  if (Math.abs(expectedWeightedSum - report.score.overall) > 10) {
    warnings.push({
      category: 'Composite Scoring',
      message: `Composite score ${report.score.overall} differs from weighted sum ${expectedWeightedSum.toFixed(0)} by more than tolerance`,
      suggestion: 'Verify weighting calculations and any caps applied'
    });
  }
}

function validateMentorNotes(report: AnalysisReportForQA, issues: QAIssue[], warnings: QAWarning[]): void {
  const mentorNotes = report.analysis.mentorNotes;

  // Check if mentor notes reference execution plan numbers
  const entryPrice = report.execution.entry.triggerPrice.toFixed(2);
  
  if (mentorNotes.includes('$') && !mentorNotes.includes(entryPrice)) {
    warnings.push({
      category: 'Mentor Notes',
      message: 'Mentor Notes may be using legacy entry prices instead of Execution Plan numbers',
      suggestion: `Ensure mentor notes reference entry at $${entryPrice}`
    });
  }

  // Check for conciseness (should be 3-5 bullets)
  const bulletCount = (mentorNotes.match(/•/g) || []).length;
  if (bulletCount > 8) {
    warnings.push({
      category: 'Mentor Notes',
      message: `Mentor Notes contains ${bulletCount} bullets - consider simplifying to 3-5 key points`,
      suggestion: 'Focus on structural context, volume interpretation, and confirmation guidance'
    });
  }

  // Check for contradictions with main report
  if (mentorNotes.toLowerCase().includes('bullish') && report.riskManagement.direction === 'short') {
    issues.push({
      category: 'Mentor Notes',
      severity: 'high',
      message: 'Mentor Notes mention "bullish" but setup is SHORT',
      location: 'Mentor Notes'
    });
  }

  if (mentorNotes.toLowerCase().includes('bearish') && report.riskManagement.direction === 'long') {
    issues.push({
      category: 'Mentor Notes',
      severity: 'high',
      message: 'Mentor Notes mention "bearish" but setup is LONG',
      location: 'Mentor Notes'
    });
  }
}

function validateReadability(report: AnalysisReportForQA, issues: QAIssue[], warnings: QAWarning[]): void {
  const mentorNotes = report.analysis.mentorNotes;

  // Check for speculative language
  const speculativeWords = ['may', 'might', 'could', 'possibly', 'potentially'];
  speculativeWords.forEach(word => {
    if (mentorNotes.toLowerCase().includes(word)) {
      warnings.push({
        category: 'Readability',
        message: `Mentor Notes contain speculative language: "${word}"`,
        suggestion: 'Use definitive language like "Wait for confirmation" instead of "May go down"'
      });
    }
  });

  // Check recommendation clarity
  if (report.score.recommendation === 'Watch' || report.score.recommendation === 'Pass') {
    // Should have clear guidance on what to watch for
    if (!mentorNotes.toLowerCase().includes('wait') && !mentorNotes.toLowerCase().includes('monitor')) {
      warnings.push({
        category: 'Readability',
        message: 'Watch/Pass recommendation missing clear guidance',
        suggestion: 'Add specific conditions to wait for or monitor'
      });
    }
  }
}

function getExpectedGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 76) return 'A';
  if (score >= 61) return 'B';
  if (score >= 41) return 'C';
  return 'D';
}

function generateSummary(passed: boolean, score: number, issues: QAIssue[], warnings: QAWarning[]): string {
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;

  let summary = `QA Score: ${score}/100 - ${passed ? '✅ PASSED' : '❌ FAILED'}\n\n`;

  if (passed) {
    summary += 'Report meets institutional-grade standards.\n';
  } else {
    summary += 'Report requires fixes before approval.\n';
  }

  if (criticalCount > 0) {
    summary += `\n🔴 Critical Issues: ${criticalCount}`;
  }
  if (highCount > 0) {
    summary += `\n🟠 High Priority: ${highCount}`;
  }
  if (mediumCount > 0) {
    summary += `\n🟡 Medium Priority: ${mediumCount}`;
  }
  if (lowCount > 0) {
    summary += `\n🔵 Low Priority: ${lowCount}`;
  }
  if (warnings.length > 0) {
    summary += `\n⚠️  Warnings: ${warnings.length}`;
  }

  if (issues.length === 0 && warnings.length === 0) {
    summary += '\n\n🎉 Perfect score! All checks passed.';
  }

  return summary;
}

export function formatQAReport(result: QAResult): string {
  let report = `\n${'='.repeat(70)}\n`;
  report += `TRADER JOURNEY QA REPORT\n`;
  report += `${'='.repeat(70)}\n\n`;

  report += result.summary + '\n\n';

  if (result.issues.length > 0) {
    report += `${'─'.repeat(70)}\n`;
    report += `ISSUES (${result.issues.length})\n`;
    report += `${'─'.repeat(70)}\n\n`;

    result.issues.forEach((issue, idx) => {
      const icon = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🔵'
      }[issue.severity];

      report += `${idx + 1}. ${icon} [${issue.severity.toUpperCase()}] ${issue.category}\n`;
      report += `   ${issue.message}\n`;
      if (issue.location) {
        report += `   Location: ${issue.location}\n`;
      }
      report += '\n';
    });
  }

  if (result.warnings.length > 0) {
    report += `${'─'.repeat(70)}\n`;
    report += `WARNINGS (${result.warnings.length})\n`;
    report += `${'─'.repeat(70)}\n\n`;

    result.warnings.forEach((warning, idx) => {
      report += `${idx + 1}. ⚠️  ${warning.category}\n`;
      report += `   ${warning.message}\n`;
      if (warning.suggestion) {
        report += `   💡 Suggestion: ${warning.suggestion}\n`;
      }
      report += '\n';
    });
  }

  report += `${'='.repeat(70)}\n`;

  return report;
}

