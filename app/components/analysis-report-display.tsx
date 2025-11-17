'use client';

import { useState } from 'react';
import { AnalysisReport } from '../api/analyze/route';
import HelpIcon from './help-icon';
import PatternExplanationHelpModal from './pattern-explanation-help-modal';

// Normalize pattern names for consistent tone
function normalizePatternName(name: string): string {
  switch (name.toLowerCase()) {
    case 'uptrend':
      return 'Bullish Continuation';
    case 'downtrend':
      return 'Bearish Continuation';
    default:
      return name;
  }
}

interface AnalysisReportDisplayProps {
  report: AnalysisReport;
}

export default function AnalysisReportDisplay({ report }: AnalysisReportDisplayProps) {
  const [patternHelpOpen, setPatternHelpOpen] = useState(false);

  // Calculate data freshness
  const lastBarDate = new Date(report.marketData.lastBarDate);
  const now = new Date();
  const hoursSinceUpdate = (now.getTime() - lastBarDate.getTime()) / (1000 * 60 * 60);
  const dataFreshnessLabel =
    hoursSinceUpdate < 1
      ? 'Real-time'
      : hoursSinceUpdate < 24
      ? `${Math.round(hoursSinceUpdate)}h old`
      : `${report.marketData.dataAgeDays}d old`;
  const dataFreshnessColor =
    hoursSinceUpdate < 24 ? 'text-green-300' : hoursSinceUpdate < 72 ? 'text-yellow-300' : 'text-orange-300';

  // Normalized pattern name for display
  const displayPatternName = normalizePatternName(report.pattern.name);

  return (
    <>
      {/* Pattern Help Modal */}
      {patternHelpOpen && <PatternExplanationHelpModal isOpen={patternHelpOpen} onClose={() => setPatternHelpOpen(false)} />}

      {/* Report Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold text-white">{report.symbol}</h1>
                <span className="text-2xl">
                  {report.executionDirection === 'bullish' ? '📈' : report.executionDirection === 'bearish' ? '📉' : '➡️'}
                </span>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm font-medium border border-blue-500/30">
                  {report.timeframe.toUpperCase()}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium border ${
                    report.score.rating === 'A+' || report.score.rating === 'A'
                      ? 'bg-green-500/20 text-green-300 border-green-500/30'
                      : report.score.rating === 'B'
                      ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                      : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                  }`}
                >
                  {report.score.rating}
                </span>
              </div>

              <h2 className="text-xl text-blue-200 mb-3">{report.name}</h2>

              {/* Industry/Sector */}
              {report.fundamentals?.profile && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {report.fundamentals.profile.sector && (
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full border border-purple-500/30">
                      {report.fundamentals.profile.sector}
                    </span>
                  )}
                  {report.fundamentals.profile.industry && (
                    <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded-full border border-indigo-500/30">
                      {report.fundamentals.profile.industry}
                    </span>
                  )}
                </div>
              )}

              <div className="text-3xl font-bold text-white mb-2">${report.currentPrice.toFixed(2)}</div>

              {report.marketData.marketCap && (
                <div className="text-sm text-blue-300">
                  • {report.marketData.exchange}
                  <span className="ml-2">
                    • Market Cap: $
                    {report.marketData.marketCap >= 1e9
                      ? `${(report.marketData.marketCap / 1e9).toFixed(2)}B`
                      : `${(report.marketData.marketCap / 1e6).toFixed(2)}M`}
                  </span>
                </div>
              )}

              <p className="text-sm text-blue-300 mt-1">
                Last data: {lastBarDate.toLocaleDateString()} ({dataFreshnessLabel})
                {report.timeframe !== '1day' && (
                  <span className="ml-2 text-yellow-300">(15-min delayed, bar may be forming)</span>
                )}
              </p>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-2">
              <div
                className={`text-5xl font-black ${
                  report.score.overall >= 90
                    ? 'text-green-400'
                    : report.score.overall >= 76
                    ? 'text-green-300'
                    : report.score.overall >= 61
                    ? 'text-yellow-300'
                    : 'text-orange-300'
                }`}
              >
                {report.score.rating}
              </div>
              <div className="text-3xl font-bold text-white">{report.score.overall}/100</div>
              <div className="text-lg text-blue-200 font-medium">
                {report.score.recommendation}
              </div>
              <div className="text-sm text-blue-300">
                {report.execution.status === 'ready' && '✅ Ready'}
                {report.execution.status === 'candidate' && '🟡 Candidate'}
                {report.execution.status === 'missed' && '⏰ Entry Missed'}
                {report.execution.status === 'blocked' && '🚫 Blocked'}
                {report.execution.status === 'neutral' && '➡️ Neutral'}
              </div>
              
              {/* AI Rating Adjustment Badge */}
              {report.score.ratingAdjustment && (
                <div className="mt-3 p-2 bg-purple-500/20 border border-purple-400/40 rounded-lg">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-purple-300 text-xs font-semibold">🤖 AI Adjusted</span>
                  </div>
                  <div className="text-xs text-purple-200">
                    <span className="line-through opacity-60">{report.score.ratingAdjustment.originalRating} {report.score.ratingAdjustment.originalScore}</span>
                    <span className="mx-1">→</span>
                    <span className="font-semibold">{report.score.ratingAdjustment.adjustedRating} {report.score.ratingAdjustment.adjustedScore}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* AI Rating Adjustment Explanation (if adjusted) */}
        {report.score.ratingAdjustment && (
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 backdrop-blur-lg rounded-xl p-6 border border-purple-500/30">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🤖</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-purple-300 mb-2">AI Rating Adjustment</h3>
                <p className="text-purple-100 text-sm mb-3">
                  {report.score.ratingAdjustment.reason}
                </p>
                <div className="flex items-center gap-4 text-xs flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-300">Technical Score:</span>
                    <span className="px-2 py-1 bg-white/10 rounded text-white font-semibold">
                      {report.score.ratingAdjustment.originalRating} {report.score.ratingAdjustment.originalScore}/100
                    </span>
                  </div>
                  <div className="text-purple-300">→</div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-300">Final Score:</span>
                    <span className="px-2 py-1 bg-purple-500/30 border border-purple-400/50 rounded text-purple-100 font-bold">
                      {report.score.ratingAdjustment.adjustedRating} {report.score.ratingAdjustment.adjustedScore}/100
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pattern Summary */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-4">
            {report.executionDirection === 'bullish' ? '📈' : report.executionDirection === 'bearish' ? '📉' : '➡️'}{' '}
            {report.executionDirection.toUpperCase()} Setup
          </h3>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-blue-300 font-medium min-w-[140px]">•Candlestick:</span>
              <span className="text-white">
                {displayPatternName} ({report.pattern.confidence}%)
              </span>
            </div>

            {report.chartPattern && (
              <div className="flex items-start gap-2">
                <span className="text-blue-300 font-medium min-w-[140px]">•Chart Pattern:</span>
                <span className="text-white">
                  {report.chartPattern.name} ({report.chartPattern.confidence}%, {report.chartPattern.confidenceLabel})
                </span>
              </div>
            )}

            <div className="flex items-start gap-2">
              <span className="text-blue-300 font-medium min-w-[140px]">Price (from data):</span>
              <span className="text-white">${report.currentPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Pattern Fusion Analysis */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-4">🎯 Composite Confidence: {report.score.overall}/100</h3>
          <p className="text-blue-200 leading-relaxed mb-4">{report.patternFusion.analysis}</p>

          {report.hasConflict && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-200">
                ⚠️ <strong>Pattern Conflict Detected:</strong> Chart pattern direction differs from candlestick signal.
                Entry uses chart pattern direction (higher confidence).
              </p>
            </div>
          )}
        </div>

        {/* Chart Pattern Analysis */}
        {report.chartPattern && (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">📐 Chart Pattern Analysis</h3>

            <div className="mb-6">
              <h4 className="text-lg font-bold text-white mb-3">🏗️ Market Structure</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-blue-300 font-medium min-w-[140px]">Pattern:</span>
                  <span className="text-white">{report.chartPattern.name}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-300 font-medium min-w-[140px]">Confidence:</span>
                  <span className="text-white">
                    {report.chartPattern.confidence}% ({report.chartPattern.confidenceLabel})
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-300 font-medium min-w-[140px]">Breakout:</span>
                  <span className="text-white">{report.chartPattern.breakoutStatus}</span>
                </div>
                {report.chartPattern.volumeZScore !== undefined && (
                  <div className="flex items-start gap-2">
                    <span className="text-blue-300 font-medium min-w-[140px]">Volume Z-Score:</span>
                    <span className="text-white">
                      {report.chartPattern.volumeZScore > 0 ? '+' : ''}
                      {report.chartPattern.volumeZScore.toFixed(2)}σ
                    </span>
                  </div>
                )}
                {report.chartPattern.priceTarget && (
                  <div className="flex items-start gap-2">
                    <span className="text-blue-300 font-medium min-w-[140px]">Price Target:</span>
                    <span className="text-white">
                      ${report.chartPattern.priceTarget.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Pattern Levels */}
            {(report.chartPattern.keyLevels.support?.length || report.chartPattern.keyLevels.resistance?.length) && (
              <div>
                <h4 className="text-lg font-bold text-white mb-3">📍 Key Levels</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.chartPattern.keyLevels.support && report.chartPattern.keyLevels.support.length > 0 && (
                    <div>
                      <div className="text-green-300 font-medium mb-2">💚 Support Levels</div>
                      <div className="space-y-1">
                        {report.chartPattern.keyLevels.support.map((level, i) => (
                          <div key={i} className="text-white">
                            ${level.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {report.chartPattern.keyLevels.resistance && report.chartPattern.keyLevels.resistance.length > 0 && (
                    <div>
                      <div className="text-red-300 font-medium mb-2">❤️ Resistance Levels</div>
                      <div className="space-y-1">
                        {report.chartPattern.keyLevels.resistance.map((level, i) => (
                          <div key={i} className="text-white">
                            ${level.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* All Detected Patterns */}
        {report.allChartPatterns && report.allChartPatterns.length > 1 && (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">📊 All Detected Patterns ({report.allChartPatterns.length})</h3>
            <p className="text-blue-200 text-sm mb-4">
              Multiple chart patterns detected. The primary pattern is used for analysis, but all patterns are shown for context.
            </p>

            <div className="space-y-3">
              {report.allChartPatterns.map((pattern, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-lg border ${
                    i === 0
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {i === 0 && (
                          <span className="px-2 py-1 bg-blue-500/30 text-blue-200 text-xs rounded-full border border-blue-500/40">
                            PRIMARY PATTERN
                          </span>
                        )}
                        <span className="text-white font-bold">{pattern.name}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-blue-300">Direction: </span>
                          <span className="text-white">{pattern.type}</span>
                        </div>
                        <div>
                          <span className="text-blue-300">Confidence: </span>
                          <span className="text-white">
                            {pattern.confidence}% ({pattern.confidenceLabel})
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-300">Breakout Status: </span>
                          <span className="text-white">{pattern.breakoutStatus}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pattern Detection V2 - Explainability */}
        {report.patternV2 && (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">🔍 Pattern Detection V2 - Explainability</h3>
              <button
                onClick={() => setPatternHelpOpen(true)}
                className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg transition-all border border-blue-500/30 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Learn More
              </button>
            </div>
            <p className="text-blue-200 text-sm mb-4">
              Deterministic pattern analysis with full transparency. All confidence scores computed by explicit rules.
            </p>

            {/* Composite Score Breakdown */}
            {report.patternV2.compositeReasons && (
              <div className="mb-6">
                <h4 className="text-lg font-bold text-white mb-3">🎯 Composite Score Breakdown</h4>
                <ul className="space-y-1">
                  {report.patternV2.compositeReasons.map((reason, i) => (
                    <li key={i} className="text-blue-200">
                      • {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Chart Pattern Facts */}
            {report.patternV2.chartPatternReasons && report.patternV2.chartPatternReasons.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-bold text-white mb-3">📐 Chart Pattern Facts</h4>
                <ul className="space-y-1">
                  {report.patternV2.chartPatternReasons.map((reason, i) => (
                    <li key={i} className="text-blue-200">
                      • {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Chart Pattern Metrics */}
            {report.patternV2.chartPatternMetadata && (
              <div className="mb-6">
                <h4 className="text-lg font-bold text-white mb-3">📊 Chart Pattern Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {report.patternV2.chartPatternMetadata.totalTouches !== undefined && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="text-blue-300 text-xs mb-1">Total Touches</div>
                      <div className="text-white font-bold text-lg">
                        {report.patternV2.chartPatternMetadata.totalTouches}
                      </div>
                    </div>
                  )}
                  {report.patternV2.chartPatternMetadata.symmetryPct !== undefined && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="text-blue-300 text-xs mb-1">Symmetry</div>
                      <div className="text-white font-bold text-lg">
                        {report.patternV2.chartPatternMetadata.symmetryPct.toFixed(1)}%
                      </div>
                    </div>
                  )}
                  {report.patternV2.chartPatternMetadata.heightATR !== undefined && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="text-blue-300 text-xs mb-1">Height (ATR)</div>
                      <div className="text-white font-bold text-lg">
                        {report.patternV2.chartPatternMetadata.heightATR.toFixed(2)}×
                      </div>
                    </div>
                  )}
                  {report.patternV2.chartPatternMetadata.breakoutVolZ !== undefined && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="text-blue-300 text-xs mb-1">Breakout VolZ</div>
                      <div className="text-white font-bold text-lg">
                        {report.patternV2.chartPatternMetadata.breakoutVolZ.toFixed(1)}σ
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-blue-200 text-sm">
                💡 <strong>Deterministic Analysis:</strong> All scores and confidences are computed using explicit rules.
                No black-box algorithms - every number is verifiable and explainable.
              </p>
            </div>
          </div>
        )}

        {/* Execution Plan */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-4">🎯 Execution Plan</h3>

          <div className="mb-4">
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-lg ${
                report.execution.status === 'ready'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : report.execution.status === 'candidate'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
              }`}
            >
              {report.execution.status === 'ready' && '✅ READY'}
              {report.execution.status === 'candidate' && '🟡 CANDIDATE'}
              {report.execution.status === 'missed' && '⏰ MISSED'}
              {report.execution.status === 'blocked' && '🚫 BLOCKED'}
              {report.execution.status === 'neutral' && '➡️ NEUTRAL'}
              {report.patternSource === 'institutional' && ' (Institutional)'}
              {report.patternSource === 'candidate' && ' (Candidate)'}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-lg font-bold text-white mb-2">
                {report.executionDirection === 'bullish' ? '📈 Breakout' : '📉 Breakdown'} Entry
              </h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-blue-300 font-medium min-w-[140px]">Entry Price:</span>
                  <span className="text-white font-bold text-xl">
                    ${report.execution.entry.triggerPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-300 font-medium min-w-[140px]">Entry Type:</span>
                  <span className="text-white capitalize">{report.execution.entry.type}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-300 font-medium min-w-[140px]">Note:</span>
                  <span className="text-white">{report.execution.entry.note}</span>
                </div>
                {report.execution.viabilityIndex !== undefined && (
                  <div className="flex items-start gap-2">
                    <span className="text-blue-300 font-medium min-w-[140px]">Viability Index:</span>
                    <span className="text-white">
                      {report.execution.viabilityIndex.toFixed(2)} ({report.execution.viabilityLabel})
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-lg font-bold text-white mb-2">Stop Loss</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-red-300 font-medium min-w-[140px]">Price:</span>
                  <span className="text-white font-bold">${report.execution.stopLoss.price.toFixed(2)}</span>
                  <span className="text-red-300">
                    {report.execution.stopLoss.movePct > 0 ? '+' : ''}
                    {report.execution.stopLoss.movePct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-bold text-white mb-2">Targets</h4>
              <div className="space-y-2">
                {report.execution.targets.map((target, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-green-300 font-medium min-w-[140px]">{target.name}:</span>
                    <span className="text-white font-bold">${target.price.toFixed(2)}</span>
                    <span className="text-green-300">
                      {target.movePct > 0 ? '+' : ''}
                      {target.movePct.toFixed(1)}%
                    </span>
                    <span className="text-blue-300">• {target.rr.toFixed(1)}:1 R:R</span>
                  </div>
                ))}
              </div>
            </div>

            {report.execution.patternTarget && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-blue-300 font-medium">📏 Pattern Target:</span>
                  <span className="text-white font-bold">${report.execution.patternTarget.price.toFixed(2)}</span>
                  <span className="text-blue-300">
                    ({report.execution.patternTarget.movePct.toFixed(1)}%)
                  </span>
                  {report.execution.patternTarget.confluence && (
                    <span className="text-yellow-300">• {report.execution.patternTarget.confluence}</span>
                  )}
                </div>
              </div>
            )}

            {report.execution.warnings.length > 0 && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="space-y-1">
                  {report.execution.warnings.map((warning, i) => (
                    <div key={i} className="text-yellow-200">
                      ⚠️ {warning}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-blue-200 text-sm">
                <strong>Risk/Reward Summary:</strong>{' '}
                {report.execution.stopLoss.movePct > 0 ? '+' : ''}
                {Math.abs(report.execution.stopLoss.movePct).toFixed(1)}% risk for{' '}
                {report.execution.targets.map((t) => t.movePct.toFixed(1) + '%').join(' / ')} reward (
                {report.execution.targets.map((t) => t.rr.toFixed(1)).join('–')}×).
              </p>
            </div>

            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <p className="text-purple-200 text-sm">
                💡 <strong>Confirmation-Based Entry:</strong> This system uses rule-based triggers instead of "entry at
                current price." Wait for confirmation (breakout/breakdown) before entering. All % moves and R:R calculated
                from trigger price.
              </p>
            </div>
          </div>
        </div>

        {/* Technical Indicators */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-4">📈 Technical Indicators</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-lg font-bold text-white mb-3">Moving Averages</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-blue-300">EMA 9:</span>
                  <span className="text-white font-medium">${report.technical.ema9.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300">EMA 20:</span>
                  <span className="text-white font-medium">${report.technical.ema20.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300">EMA 50:</span>
                  <span className="text-white font-medium">${report.technical.ema50.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300">EMA 200:</span>
                  <span className="text-white font-medium">${report.technical.ema200.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-blue-300 text-sm">
                  📊 EMA Proximity: The 9, 20, and 50 EMAs span{' '}
                  {(
                    (Math.abs(report.technical.ema50 - report.technical.ema9) / report.currentPrice) *
                    100
                  ).toFixed(1)}
                  % — {report.technical.emaCompression < 3 ? 'tight squeeze' : 'moderate spread'},{' '}
                  {report.technical.emaCompression < 3 ? 'breakout imminent' : 'trend forming'}.
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-bold text-white mb-3">Momentum & Volume</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-blue-300">RSI:</span>
                  <span
                    className={`font-medium ${
                      report.technical.rsi > 70
                        ? 'text-red-300'
                        : report.technical.rsi < 30
                        ? 'text-green-300'
                        : 'text-white'
                    }`}
                  >
                    {report.technical.rsi.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300">MACD:</span>
                  <span className="text-white font-medium">
                    {report.technical.macd.value.toFixed(2)} / {report.technical.macd.signal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300">Volume Z-Score:</span>
                  <span className="text-white font-medium">
                    {report.technical.volumeZScore > 0 ? '+' : ''}
                    {report.technical.volumeZScore.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="text-lg font-bold text-white mb-3">Trend</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-blue-300">Direction:</span>
                    <span
                      className={`font-medium ${
                        report.technical.trend === 'bullish'
                          ? 'text-green-300'
                          : report.technical.trend === 'bearish'
                          ? 'text-red-300'
                          : 'text-yellow-300'
                      }`}
                    >
                      {report.technical.trend} ({report.technical.trendStrength})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Support/Resistance */}
          {(report.technical.supportLevels.length > 0 || report.technical.resistanceLevels.length > 0) && (
            <div className="mt-6">
              <h4 className="text-lg font-bold text-white mb-3">Key Levels</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.technical.supportLevels.length > 0 && (
                  <div>
                    <div className="text-green-300 font-medium mb-2">Support Levels</div>
                    <div className="space-y-1">
                      {report.technical.supportLevels.map((level, i) => (
                        <div key={i} className="text-white">
                          ${level.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {report.technical.resistanceLevels.length > 0 && (
                  <div>
                    <div className="text-red-300 font-medium mb-2">Resistance Levels</div>
                    <div className="space-y-1">
                      {report.technical.resistanceLevels.map((level, i) => (
                        <div key={i} className="text-white">
                          ${level.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Countertrend Warning */}
          {((report.executionDirection === 'bullish' && report.currentPrice < report.technical.ema200) ||
            (report.executionDirection === 'bearish' && report.currentPrice > report.technical.ema200)) && (
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-200">
                ⚠️ <strong>Countertrend Setup:</strong> This is a{' '}
                {report.executionDirection === 'bullish' ? 'long' : 'short'} setup against the longer-term{' '}
                {report.currentPrice > report.technical.ema200 ? 'uptrend' : 'downtrend'} (price{' '}
                {report.currentPrice > report.technical.ema200 ? 'above' : 'below'} 200 EMA). Countertrend trades have
                lower probability. Use tighter stops and smaller position sizes.
              </p>
            </div>
          )}

          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <p className="text-purple-200 text-sm">
              <strong>Earnings Proximity:</strong> Earnings calendar integration coming soon. Before trading, verify
              earnings date using your broker or a financial calendar. Avoid trading 1-2 days before earnings (high
              volatility risk).
            </p>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-4">⭐ Score Breakdown</h3>
          <p className="text-blue-200 mb-4">How the {report.score.overall}/100 ({report.score.rating}) score is calculated:</p>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-32 text-blue-300">Technical ({report.score.breakdown.technical}/100):</div>
              <div className="flex-1 bg-white/10 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-400 h-full flex items-center justify-end pr-3 text-white text-sm font-bold"
                  style={{ width: `${report.score.breakdown.technical}%` }}
                >
                  {report.score.breakdown.technical}
                </div>
              </div>
              <div className="w-24 text-sm text-blue-300 text-right">25% weight</div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-32 text-blue-300">Momentum ({report.score.breakdown.momentum}/100):</div>
              <div className="flex-1 bg-white/10 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-400 h-full flex items-center justify-end pr-3 text-white text-sm font-bold"
                  style={{ width: `${report.score.breakdown.momentum}%` }}
                >
                  {report.score.breakdown.momentum}
                </div>
              </div>
              <div className="w-24 text-sm text-blue-300 text-right">20% weight</div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-32 text-blue-300">Trend ({report.score.breakdown.trend}/100):</div>
              <div className="flex-1 bg-white/10 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-yellow-500 to-yellow-400 h-full flex items-center justify-end pr-3 text-white text-sm font-bold"
                  style={{ width: `${report.score.breakdown.trend}%` }}
                >
                  {report.score.breakdown.trend}
                </div>
              </div>
              <div className="w-24 text-sm text-blue-300 text-right">15% weight</div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-32 text-blue-300">Pattern Fusion ({report.score.breakdown.pattern}/100):</div>
              <div className="flex-1 bg-white/10 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-purple-400 h-full flex items-center justify-end pr-3 text-white text-sm font-bold"
                  style={{ width: `${report.score.breakdown.pattern}%` }}
                >
                  {report.score.breakdown.pattern}
                </div>
              </div>
              <div className="w-24 text-sm text-blue-300 text-right">25% weight</div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-32 text-blue-300">Volume ({report.score.breakdown.volume}/100):</div>
              <div className="flex-1 bg-white/10 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-red-500 to-red-400 h-full flex items-center justify-end pr-3 text-white text-sm font-bold"
                  style={{ width: `${report.score.breakdown.volume}%` }}
                >
                  {report.score.breakdown.volume}
                </div>
              </div>
              <div className="w-24 text-sm text-blue-300 text-right">5% weight</div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-200 text-sm">
              <strong>Composite {report.score.overall}</strong> = Σ(weighted factors × weights)
              <br />
              <strong>Grade:</strong> 90+=A+, 76-89=A, 61-75=B, 41-60=C, 0-40=D.
              <br />
              All confidences capped at 95% for realism.
            </p>
          </div>

          {report.patternSource === 'candidate' && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-200 text-sm">
                <strong>Pattern Score Adjusted:</strong> Original confidence{' '}
                {report.pattern.confidence}%, adjusted to {report.score.breakdown.pattern}/100 due to
                candidate pattern cap (max 65 until institutional criteria met).
              </p>
            </div>
          )}
        </div>

        {/* Squeeze Analysis */}
        {report.squeezeAnalysis && (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">📊 Squeeze Analysis</h3>

            <div className="space-y-6">
              {/* Combined Score */}
              <div>
                <h4 className="text-lg font-bold text-white mb-3">Combined Squeeze Dynamics</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <div className="text-blue-300 text-sm mb-1">Combined Score</div>
                    <div className="text-white font-bold text-2xl">{report.squeezeAnalysis.combined.score}/100</div>
                    <div className="text-blue-200 text-sm mt-1 capitalize">{report.squeezeAnalysis.combined.potential} potential</div>
                  </div>

                  <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <div className="text-blue-300 text-sm mb-1">Short Float</div>
                    <div className="text-white font-bold text-2xl">
                      {report.squeezeAnalysis.shortSqueeze.shortFloat
                        ? `${report.squeezeAnalysis.shortSqueeze.shortFloat.toFixed(1)}%`
                        : 'N/A'}
                    </div>
                    <div className="text-blue-200 text-sm mt-1">
                      {report.squeezeAnalysis.shortSqueeze.shortVolumeTrend}
                    </div>
                  </div>

                  <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <div className="text-blue-300 text-sm mb-1">TTM Squeeze</div>
                    <div
                      className={`font-bold text-2xl ${
                        report.squeezeAnalysis.ttmSqueeze.state === 'FIRE'
                          ? 'text-red-400'
                          : report.squeezeAnalysis.ttmSqueeze.state === 'ON'
                          ? 'text-yellow-400'
                          : 'text-gray-400'
                      }`}
                    >
                      {report.squeezeAnalysis.ttmSqueeze.state}
                    </div>
                    <div className="text-blue-200 text-sm mt-1">
                      {report.squeezeAnalysis.ttmSqueeze.state === 'ON' &&
                        `${report.squeezeAnalysis.ttmSqueeze.duration} bars`}
                      {report.squeezeAnalysis.ttmSqueeze.state === 'FIRE' && 'Breakout!'}
                      {report.squeezeAnalysis.ttmSqueeze.state === 'OFF' && 'No squeeze'}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-200">{report.squeezeAnalysis.combined.recommendation}</p>
                </div>

                {report.squeezeAnalysis.combined.triggers.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-green-300 font-medium">Bullish Triggers:</div>
                    {report.squeezeAnalysis.combined.triggers.map((trigger, i) => (
                      <div key={i} className="text-green-200 text-sm">
                        ✓ {trigger}
                      </div>
                    ))}
                  </div>
                )}

                {report.squeezeAnalysis.combined.warnings.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-yellow-300 font-medium">Warnings:</div>
                    {report.squeezeAnalysis.combined.warnings.map((warning, i) => (
                      <div key={i} className="text-yellow-200 text-sm">
                        ⚠️ {warning}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Options Insight */}
        {report.optionsInsight && (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">📊 Options Flow & Smart Money Sentiment</h3>
            
            {/* Main Message */}
            <div className={`p-4 rounded-lg mb-4 border ${
              report.optionsInsight.sentiment === 'bullish' && report.optionsInsight.confidence === 'high' ? 'bg-green-500/20 border-green-500/30' :
              report.optionsInsight.sentiment === 'bullish' ? 'bg-green-500/10 border-green-500/20' :
              report.optionsInsight.sentiment === 'bearish' && report.optionsInsight.confidence === 'high' ? 'bg-red-500/20 border-red-500/30' :
              report.optionsInsight.sentiment === 'bearish' ? 'bg-red-500/10 border-red-500/20' :
              report.optionsInsight.sentiment === 'mixed' ? 'bg-yellow-500/10 border-yellow-500/20' :
              'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-start gap-3">
                <div className="text-3xl">
                  {report.optionsInsight.sentiment === 'bullish' && report.optionsInsight.confidence === 'high' ? '🚀' :
                   report.optionsInsight.sentiment === 'bullish' ? '📈' :
                   report.optionsInsight.sentiment === 'bearish' && report.optionsInsight.confidence === 'high' ? '🔻' :
                   report.optionsInsight.sentiment === 'bearish' ? '📉' :
                   report.optionsInsight.sentiment === 'mixed' ? '⚠️' :
                   '➖'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                      report.optionsInsight.sentiment === 'bullish' ? 'bg-green-500/30 text-green-200' :
                      report.optionsInsight.sentiment === 'bearish' ? 'bg-red-500/30 text-red-200' :
                      report.optionsInsight.sentiment === 'mixed' ? 'bg-yellow-500/30 text-yellow-200' :
                      'bg-white/20 text-white'
                    }`}>
                      {report.optionsInsight.sentiment}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      report.optionsInsight.confidence === 'high' ? 'bg-white/20 text-blue-200' :
                      report.optionsInsight.confidence === 'medium' ? 'bg-white/10 text-blue-300' :
                      'bg-white/5 text-gray-300'
                    }`}>
                      {report.optionsInsight.confidence} confidence
                    </span>
                  </div>
                  <p className="text-white text-base leading-relaxed">{report.optionsInsight.message}</p>
                </div>
              </div>
            </div>

            {/* Data Type Indicator for Basic Accounts */}
            {report.optionsInsight.topCallStrikes.length > 0 && 
             report.optionsInsight.topCallStrikes.every(s => s.volume === 0 && s.oi === 0) && (
              <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="text-sm text-blue-200">
                  <span className="font-semibold">📊 Basic Account Mode:</span> Live volume and open interest data not available with your current plan. 
                  Analysis is based on available option contracts (contract count) rather than actual trading volume. 
                  The sentiment is still valid but with lower confidence compared to live data.
                </div>
              </div>
            )}

            {/* Call/Put Activity Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-green-200 text-sm mb-1">
                  {report.optionsInsight.topCallStrikes.every(s => s.volume === 0) ? 'Call Contracts' : 'Call Volume'}
                </div>
                <div className="text-2xl font-bold text-white">
                  {report.optionsInsight.totalCallVolume.toLocaleString()}
                </div>
                <div className="text-xs text-green-300 mt-1">Near ATM ${report.optionsInsight.atmStrike.toFixed(2)}</div>
              </div>

              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-red-200 text-sm mb-1">
                  {report.optionsInsight.topPutStrikes.every(s => s.volume === 0) ? 'Put Contracts' : 'Put Volume'}
                </div>
                <div className="text-2xl font-bold text-white">
                  {report.optionsInsight.totalPutVolume.toLocaleString()}
                </div>
                <div className="text-xs text-red-300 mt-1">Near ATM ${report.optionsInsight.atmStrike.toFixed(2)}</div>
              </div>

              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-blue-200 text-sm mb-1">Call/Put Ratio</div>
                <div className="text-2xl font-bold text-white">
                  {report.optionsInsight.callPutRatio > 999 ? '999+' : report.optionsInsight.callPutRatio.toFixed(2)}
                </div>
                <div className="text-xs text-blue-300 mt-1">
                  {report.optionsInsight.callPutRatio > 2 ? 'Heavily call-skewed' :
                   report.optionsInsight.callPutRatio > 1.5 ? 'Moderately bullish' :
                   report.optionsInsight.callPutRatio > 0.7 ? 'Balanced' :
                   report.optionsInsight.callPutRatio > 0.5 ? 'Moderately bearish' :
                   'Heavily put-skewed'}
                </div>
              </div>
            </div>

            {/* IV Trend & Expirations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                <div className="text-blue-200 text-sm mb-1">Implied Volatility Trend</div>
                <div className="flex items-center gap-2">
                  <span className="text-white text-lg font-semibold uppercase">{report.optionsInsight.ivTrend}</span>
                  <span className="text-xs text-blue-300">
                    {report.optionsInsight.ivTrend === 'rising' ? '(Increased uncertainty)' :
                     report.optionsInsight.ivTrend === 'falling' ? '(Calmer markets)' :
                     '(Stable volatility)'}
                  </span>
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                <div className="text-blue-200 text-sm mb-1">Nearest Expirations</div>
                <div className="text-white text-sm">
                  {report.optionsInsight.expirations.join(', ')}
                </div>
              </div>
            </div>

            {/* Top Strikes */}
            {(report.optionsInsight.topCallStrikes.length > 0 || report.optionsInsight.topPutStrikes.length > 0) && (() => {
              // Check if we have volume data
              const hasVolumeData = report.optionsInsight.topCallStrikes.some(s => s.volume > 0) || 
                                   report.optionsInsight.topPutStrikes.some(s => s.volume > 0);
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.optionsInsight.topCallStrikes.length > 0 && (
                    <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                      <div className="text-green-200 text-sm font-semibold mb-1">
                        🔥 {hasVolumeData ? 'Top Call Strikes by Volume' : 'Nearest Call Strikes'}
                      </div>
                      {!hasVolumeData && (
                        <div className="text-xs text-blue-300 mb-3">Closest to current price (ATM)</div>
                      )}
                      <div className="space-y-2">
                        {report.optionsInsight.topCallStrikes.map((strike, idx) => (
                          <div key={idx} className={hasVolumeData ? "flex justify-between text-sm" : "text-sm"}>
                            <span className="text-white font-mono">${strike.strike.toFixed(2)}</span>
                            {hasVolumeData && (
                              <span className="text-green-300">{strike.volume} vol / {strike.oi} OI</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.optionsInsight.topPutStrikes.length > 0 && (
                    <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                      <div className="text-red-200 text-sm font-semibold mb-1">
                        🔥 {hasVolumeData ? 'Top Put Strikes by Volume' : 'Nearest Put Strikes'}
                      </div>
                      {!hasVolumeData && (
                        <div className="text-xs text-blue-300 mb-3">Closest to current price (ATM)</div>
                      )}
                      <div className="space-y-2">
                        {report.optionsInsight.topPutStrikes.map((strike, idx) => (
                          <div key={idx} className={hasVolumeData ? "flex justify-between text-sm" : "text-sm"}>
                            <span className="text-white font-mono">${strike.strike.toFixed(2)}</span>
                            {hasVolumeData && (
                              <span className="text-red-300">{strike.volume} vol / {strike.oi} OI</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Fundamentals */}
        {report.fundamentals && (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">📊 Comprehensive Fundamentals</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-blue-300 text-sm mb-1">Quality Score</div>
                <div className="text-white font-bold text-2xl">{report.fundamentals.qualityScore}/100</div>
                <div className="text-blue-200 text-sm mt-1 capitalize">{report.fundamentals.quality.grade}</div>
              </div>

              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-blue-300 text-sm mb-1">Viability Score</div>
                <div className="text-white font-bold text-2xl">{report.fundamentals.viabilityScore}/100</div>
                <div className="text-blue-200 text-sm mt-1 capitalize">{report.fundamentals.viability.valuation}</div>
              </div>

              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-blue-300 text-sm mb-1">Risk Score</div>
                <div className="text-white font-bold text-2xl">{report.fundamentals.riskScore}/100</div>
                <div className="text-blue-200 text-sm mt-1 capitalize">{report.fundamentals.risk.level}</div>
              </div>
            </div>

            {/* Company Profile */}
            {report.fundamentals.profile && (
              <div className="mb-6">
                <h4 className="text-lg font-bold text-white mb-3">Company Profile</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.fundamentals.profile.sector && (
                    <div>
                      <div className="text-blue-300 text-sm">Sector</div>
                      <div className="text-white">{report.fundamentals.profile.sector}</div>
                    </div>
                  )}
                  {report.fundamentals.profile.industry && (
                    <div>
                      <div className="text-blue-300 text-sm">Industry</div>
                      <div className="text-white">{report.fundamentals.profile.industry}</div>
                    </div>
                  )}
                  {report.fundamentals.profile.marketCap && (
                    <div>
                      <div className="text-blue-300 text-sm">Market Cap</div>
                      <div className="text-white">
                        $
                        {report.fundamentals.profile.marketCap >= 1e9
                          ? `${(report.fundamentals.profile.marketCap / 1e9).toFixed(2)}B`
                          : `${(report.fundamentals.profile.marketCap / 1e6).toFixed(2)}M`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Detailed Metrics */}
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-bold text-white mb-3">Quality Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {report.fundamentals.quality.roe !== null && report.fundamentals.quality.roe !== undefined && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="text-blue-300 text-xs mb-1">ROE</div>
                      <div className="text-white font-bold">{report.fundamentals.quality.roe.toFixed(1)}%</div>
                    </div>
                  )}
                  {report.fundamentals.quality.roa !== null && report.fundamentals.quality.roa !== undefined && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="text-blue-300 text-xs mb-1">ROA</div>
                      <div className="text-white font-bold">{report.fundamentals.quality.roa.toFixed(1)}%</div>
                    </div>
                  )}
                  {report.fundamentals.quality.operatingMargin !== null && report.fundamentals.quality.operatingMargin !== undefined && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="text-blue-300 text-xs mb-1">Op. Margin</div>
                      <div className="text-white font-bold">{report.fundamentals.quality.operatingMargin.toFixed(1)}%</div>
                    </div>
                  )}
                  {report.fundamentals.quality.fcfMargin !== null && report.fundamentals.quality.fcfMargin !== undefined && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="text-blue-300 text-xs mb-1">FCF Margin</div>
                      <div className="text-white font-bold">{report.fundamentals.quality.fcfMargin.toFixed(1)}%</div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-lg font-bold text-white mb-3">Valuation Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {report.fundamentals.viability.pe !== null && report.fundamentals.viability.pe !== undefined && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="text-blue-300 text-xs mb-1">P/E</div>
                      <div className="text-white font-bold">{report.fundamentals.viability.pe.toFixed(1)}</div>
                    </div>
                  )}
                  {report.fundamentals.viability.pb !== null && report.fundamentals.viability.pb !== undefined && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="text-blue-300 text-xs mb-1">P/B</div>
                      <div className="text-white font-bold">{report.fundamentals.viability.pb.toFixed(2)}</div>
                    </div>
                  )}
                  {report.fundamentals.viability.revenueGrowth !== null && report.fundamentals.viability.revenueGrowth !== undefined && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="text-blue-300 text-xs mb-1">Rev. Growth</div>
                      <div className="text-white font-bold">
                        {report.fundamentals.viability.revenueGrowth > 0 ? '+' : ''}
                        {report.fundamentals.viability.revenueGrowth.toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-lg font-bold text-white mb-3">Risk Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {report.fundamentals.risk.debtToEbitda !== null && report.fundamentals.risk.debtToEbitda !== undefined && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="text-blue-300 text-xs mb-1">Debt/EBITDA</div>
                      <div className="text-white font-bold">{report.fundamentals.risk.debtToEbitda.toFixed(1)}×</div>
                    </div>
                  )}
                  {report.fundamentals.risk.currentRatio !== null && report.fundamentals.risk.currentRatio !== undefined && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="text-blue-300 text-xs mb-1">Current Ratio</div>
                      <div className="text-white font-bold">{report.fundamentals.risk.currentRatio.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {report.fundamentals.risk.earningsRisk && report.fundamentals.risk.daysToEarnings !== null && (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-200">
                  ⚠️ <strong>Earnings Upcoming:</strong> {report.fundamentals.risk.daysToEarnings} days until earnings.
                  High volatility expected.
                </p>
              </div>
            )}

            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-blue-200 text-sm">
                <strong>Summary:</strong> {report.fundamentals.quality.summary} {report.fundamentals.viability.summary}{' '}
                {report.fundamentals.risk.summary}
              </p>
            </div>
          </div>
        )}

        {/* Recent News */}
        {report.newsSummary && report.news && report.news.length > 0 && (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">📰 Recent News</h3>

            <div className="mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-blue-300 font-medium">Overall Sentiment:</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-bold ${
                    report.newsSummary.overallSentiment === 'bullish'
                      ? 'bg-green-500/20 text-green-300'
                      : report.newsSummary.overallSentiment === 'bearish'
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-gray-500/20 text-gray-300'
                  }`}
                >
                  {report.newsSummary.overallSentiment.toUpperCase()}
                </span>
                <span className="text-white">
                  ({report.newsSummary.sentimentScore > 0 ? '+' : ''}
                  {report.newsSummary.sentimentScore.toFixed(0)})
                </span>
              </div>
              <p className="text-blue-200 text-sm">{report.newsSummary.summary}</p>
              {report.newsSummary.keyThemes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {report.newsSummary.keyThemes.map((theme, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                      {theme}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {report.news.map((article, i) => (
                <div key={i} className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="text-white font-bold flex-1">{article.title}</h4>
                    {article.sentiment && (
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          article.sentiment === 'positive'
                            ? 'bg-green-500/20 text-green-300'
                            : article.sentiment === 'negative'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-gray-500/20 text-gray-300'
                        }`}
                      >
                        {article.sentiment}
                      </span>
                    )}
                  </div>
                  {article.description && <p className="text-blue-200 text-sm mb-2">{article.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-blue-300">
                    {article.publisher && <span>{article.publisher}</span>}
                    <span>{new Date(article.published_utc).toLocaleString()}</span>
                    <a
                      href={article.article_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Read more →
                    </a>
                  </div>
                  {article.sentiment_reasoning && (
                    <div className="mt-2 p-2 bg-white/5 rounded text-xs text-blue-200">
                      <strong>Reasoning:</strong> {article.sentiment_reasoning}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Analysis (at the bottom) */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-4">🤖 Comprehensive AI Analysis</h3>

          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-bold text-white mb-3">📖 Executive Summary</h4>
              <p className="text-blue-200 leading-relaxed">{report.analysis.narrative}</p>
            </div>

            <div>
              <h4 className="text-lg font-bold text-white mb-3">💡 Professional Trader Analysis</h4>
              <div className="text-blue-200 leading-relaxed whitespace-pre-line">{report.analysis.mentorNotes}</div>
            </div>

            <div>
              <h4 className="text-lg font-bold text-white mb-3">✅ Bullish Factors</h4>
              <ul className="space-y-2">
                {report.analysis.strengths.map((strength, i) => (
                  <li key={i} className="text-green-200 flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold text-white mb-3">⚠️ Bearish Factors</h4>
              <ul className="space-y-2">
                {report.analysis.warnings.map((warning, i) => (
                  <li key={i} className="text-yellow-200 flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">⚠</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold text-white mb-3">🔍 Key Drivers</h4>
              <ul className="space-y-2">
                {report.analysis.reasoning.map((reason, i) => (
                  <li key={i} className="text-blue-200 flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <p className="text-purple-200 text-sm">
              🎯 <strong>Remember</strong> — strong swing setups need structure (pattern), not just momentum. Patience pays.
            </p>
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-center text-sm text-blue-300">
          <p>Report generated: {new Date(report.timestamp).toLocaleString()}</p>
        </div>
      </div>
    </>
  );
}

