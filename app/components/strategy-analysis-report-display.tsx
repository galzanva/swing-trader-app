'use client';

import { useState } from 'react';
import SqueezeAnalysisCard from './squeeze-analysis-card';
import TradeCaseCard from './trade-case-card';

// Strategy Analysis Report interface (matching StrategyResponse from strategy-analyze-client.tsx)
interface StrategyEvaluation {
  symbol: string;
  timeframe: string;
  asOf: string;
  strategy: string;
  status: 'candidate' | 'ready' | 'no_trade' | 'blocked';
  plan: {
    direction: 'long' | 'short';
    trigger: {
      type: string;
      level: number;
      description: string;
    };
    entry: number;
    stop: number;
    targets: Array<{
      level: number;
      rr: number;
      label?: string;
    }>;
    invalidationRules: string[];
  } | null;
  quality: number;
  viability: number;
  rrFirst: number;
  historicalRecent?: {
    samples: number;
    hasMinSamples: boolean;
    winRate5d: number;
    winRate10d: number;
    winRate20d: number;
    avgPnL5d: number;
    avgPnL10d: number;
    avgPnL20d: number;
    firstTouchT1: number;
    firstTouchT2: number;
    firstTouchT3: number;
    firstTouchStop: number;
    avgDaysHeld: number;
    isWeakHistory: boolean;
    lastSignal?: {
      date: string;
      firstTouch: string;
      daysHeld: number;
      pnl10d: number;
    };
  };
  historical?: {
    hitRate: number;
    medianRet10d: number;
    evAfterCosts: number;
  };
  reasons: string[];
  blockReason?: string;
  metadata: Record<string, any>;
}

interface StrategyAnalysisReport {
  evaluation: StrategyEvaluation;
  mentor: {
    systemMessage: string;
    explanation: string;
    forTrade?: string[];
    againstTrade?: string[];
    aiGenerated?: boolean;
    aiModel?: string;
  };
  squeezeAnalysis?: {
    shortSqueeze: {
      potential: 'high' | 'moderate' | 'low' | 'none';
      score: number;
      daysToCover: number | null;
      shortFloat: number | null;
      shortVolumeZ: number | null;
      shortVolumeTrend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
      triggers: string[];
      warnings: string[];
    };
    ttmSqueeze: {
      current: {
        state: 'ON' | 'FIRE' | 'OFF';
        momentumDirection: 'bullish' | 'bearish' | 'neutral';
        momentumStrength: number;
        histogram: number;
      };
      squeezeDuration: number;
      fireConfirmed: boolean;
      potentialBreakout: 'bullish' | 'bearish' | 'neutral';
      triggers: string[];
      warnings: string[];
    };
    combinedScore: number;
    combinedPotential: 'extreme' | 'high' | 'moderate' | 'low' | 'none';
    alignment: boolean;
    recommendation: string;
    triggers: string[];
    warnings: string[];
  };
  summary: {
    risk: number;
    reward: number;
    rrRatio: number;
    positionSize: number;
  };
  context: {
    symbol: string;
    name: string;
    currentPrice: number;
    timeframe: string;
    dataAgeDays: number;
    lastBarDate: string;
    spyRegime: string;
    marketCap?: number;
    exchange?: string;
  };
  technical: {
    ema9: number;
    ema20: number;
    ema50: number;
    ema200: number;
    rsi14: number;
    atr: number;
    atrPct: number;
    volZ: number;
  };
  timestamp: string;
}

interface StrategyAnalysisReportDisplayProps {
  report: StrategyAnalysisReport;
}

export default function StrategyAnalysisReportDisplay({ report }: StrategyAnalysisReportDisplayProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'text-green-600 bg-green-100';
      case 'candidate': return 'text-yellow-600 bg-yellow-100';
      case 'no_trade': return 'text-blue-200 bg-gray-100';
      case 'blocked': return 'text-red-600 bg-red-100';
      default: return 'text-blue-200 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return '✅';
      case 'candidate': return '⚠️';
      case 'no_trade': return '❌';
      case 'blocked': return '🚫';
      default: return '❓';
    }
  };

  const formatStrategyName = (strategy: string) => {
    return strategy
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {report.context.symbol} - {report.context.name}
            </h2>
            <p className="text-blue-200">
              ${report.context.currentPrice.toFixed(2)} • {report.context.timeframe} • {report.context.spyRegime} regime
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(report.evaluation.status)}`}>
              {getStatusIcon(report.evaluation.status)} {report.evaluation.status.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-blue-200">Strategy</div>
            <div className="text-lg font-semibold text-white">
              {report.evaluation.metadata?.isUserStrategy 
                ? (report.evaluation.metadata?.strategyName || 'Custom Strategy')
                : formatStrategyName(report.evaluation.strategy)}
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-blue-200">Quality</div>
            <div className="text-lg font-semibold text-white">
              {(report.evaluation.quality * 100).toFixed(0)}%
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-blue-200">Viability</div>
            <div className="text-lg font-semibold text-white">
              {(report.evaluation.viability * 100).toFixed(0)}%
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-blue-200">R:R (First)</div>
            <div className="text-lg font-semibold text-white">
              {report.evaluation.rrFirst.toFixed(2)}:1
            </div>
          </div>
        </div>
      </div>

      {/* Trade Plan & Trade Case - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trade Plan */}
        {report.evaluation.plan && (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl p-6 border border-white/10">
            <h3 className="text-xl font-semibold text-white mb-4">Trade Plan</h3>
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-medium text-white mb-3">Entry & Risk</h4>
                <div className="space-y-2">
                  {(() => {
                    const plan = report.evaluation.plan!;
                    const entry = plan.entry;
                    const stop = plan.stop;
                    const current = report.context.currentPrice;
                    const dir = plan.direction;
                    const formatPct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
                    const entryOffset = (entry - current) / current;
                    const stopPct = (stop - entry) / entry;
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-blue-200">Direction:</span>
                          <span className={`font-medium ${dir === 'long' ? 'text-green-600' : 'text-red-600'}`}>
                            {dir.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-200">Entry:</span>
                          <span className="font-medium text-white">${entry.toFixed(2)} • {formatPct(entryOffset)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-200">Stop Loss:</span>
                          <span className="font-medium text-white">${stop.toFixed(2)} • {formatPct(stopPct)}</span>
                        </div>
                      </>
                    );
                  })()}
                  <div className="flex justify-between">
                    <span className="text-blue-200">Risk per Share:</span>
                    <span className="font-medium text-white">${report.summary.risk.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Position Size:</span>
                    <span className="font-medium text-white">{report.summary.positionSize.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-lg font-medium text-white mb-3">Targets</h4>
                <div className="space-y-2">
                  {(() => {
                    const plan = report.evaluation.plan!;
                    const entry = plan.entry;
                    const formatPct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
                    return plan.targets.map((target, index) => {
                      const targetPct = plan.direction === 'long' ? (target.level - entry) / entry : (entry - target.level) / entry;
                      return (
                        <div key={index} className="flex justify-between">
                          <span className="text-blue-200">
                            {target.label || `T${index + 1}`}:
                          </span>
                          <span className="font-medium text-white">
                            ${target.level.toFixed(2)} (R:R {target.rr.toFixed(2)}) • {formatPct(targetPct)}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trade Case (FOR/AGAINST) */}
        {report.mentor && (report.mentor.forTrade || report.mentor.againstTrade) && (
          <TradeCaseCard 
            forTrade={report.mentor.forTrade}
            againstTrade={report.mentor.againstTrade}
          />
        )}
      </div>

      {/* Squeeze Analysis */}
      {report.squeezeAnalysis && (
        <SqueezeAnalysisCard squeezeAnalysis={report.squeezeAnalysis} />
      )}

      {/* Technical Indicators */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl border border-white/10 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Technical Indicators</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-sm text-blue-200">EMA 9</div>
            <div className="text-lg font-semibold text-white">${report.technical.ema9.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-blue-200">EMA 20</div>
            <div className="text-lg font-semibold text-white">${report.technical.ema20.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-blue-200">EMA 50</div>
            <div className="text-lg font-semibold text-white">${report.technical.ema50.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-blue-200">EMA 200</div>
            <div className="text-lg font-semibold text-white">${report.technical.ema200.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-blue-200">RSI 14</div>
            <div className="text-lg font-semibold text-white">{report.technical.rsi14.toFixed(1)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-blue-200">ATR</div>
            <div className="text-lg font-semibold text-white">${report.technical.atr.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-blue-200">ATR %</div>
            <div className="text-lg font-semibold text-white">{report.technical.atrPct.toFixed(2)}%</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-blue-200">Volume Z</div>
            <div className="text-lg font-semibold text-white">{report.technical.volZ.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Historical Context */}
      {report.evaluation.historicalRecent && (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl border border-white/10 p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Historical Backtest Performance</h3>
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-medium text-white mb-3">
                Backtested on Last 200 Bars ({report.context.symbol})
              </h4>
              <p className="text-sm text-blue-200 mb-4">
                Real historical occurrences of this pattern on {report.context.symbol}
              </p>
              
              {/* Sample Count & Quality Warning */}
              <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-blue-200">Total Signals:</span>
                  <span className={`font-semibold ${report.evaluation.historicalRecent.hasMinSamples ? 'text-green-300' : 'text-amber-300'}`}>
                    {report.evaluation.historicalRecent.samples} {!report.evaluation.historicalRecent.hasMinSamples && '(< 10)'}
                  </span>
                </div>
                {report.evaluation.historicalRecent.isWeakHistory && (
                  <div className="mt-2 text-sm text-amber-300 flex items-start gap-2">
                    <span>⚠</span>
                    <span>Weak historical performance detected (win rate &lt; 20% or negative avg P&L)</span>
                  </div>
                )}
                {!report.evaluation.historicalRecent.hasMinSamples && (
                  <div className="mt-2 text-sm text-amber-300 flex items-start gap-2">
                    <span>⚠</span>
                    <span>Limited sample size - statistics may not be reliable</span>
                  </div>
                )}
              </div>

              {/* Multi-Horizon Win Rates */}
              <div className="mb-4">
                <h5 className="text-md font-medium text-white mb-3">Multi-Horizon Win Rates</h5>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-blue-200 text-sm mb-1">5 Days</div>
                    <div className="text-xl font-bold text-white">
                      {(report.evaluation.historicalRecent.winRate5d * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-blue-200 text-sm mb-1">10 Days</div>
                    <div className="text-xl font-bold text-white">
                      {(report.evaluation.historicalRecent.winRate10d * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-blue-200 text-sm mb-1">20 Days</div>
                    <div className="text-xl font-bold text-white">
                      {(report.evaluation.historicalRecent.winRate20d * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Horizon Average P&L */}
              <div className="mb-4">
                <h5 className="text-md font-medium text-white mb-3">Multi-Horizon Avg P&L</h5>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-blue-200 text-sm mb-1">5 Days</div>
                    <div className={`text-xl font-bold ${report.evaluation.historicalRecent.avgPnL5d >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {(report.evaluation.historicalRecent.avgPnL5d * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-blue-200 text-sm mb-1">10 Days</div>
                    <div className={`text-xl font-bold ${report.evaluation.historicalRecent.avgPnL10d >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {(report.evaluation.historicalRecent.avgPnL10d * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-blue-200 text-sm mb-1">20 Days</div>
                    <div className={`text-xl font-bold ${report.evaluation.historicalRecent.avgPnL20d >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {(report.evaluation.historicalRecent.avgPnL20d * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* First-Touch Distribution */}
              <div className="mb-4">
                <h5 className="text-md font-medium text-white mb-3">First-Touch Outcome Distribution</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-blue-200 text-sm mb-1">T1 First</div>
                    <div className="text-lg font-bold text-white">{report.evaluation.historicalRecent.firstTouchT1}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-blue-200 text-sm mb-1">T2 First</div>
                    <div className="text-lg font-bold text-white">{report.evaluation.historicalRecent.firstTouchT2}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-blue-200 text-sm mb-1">T3 First</div>
                    <div className="text-lg font-bold text-white">{report.evaluation.historicalRecent.firstTouchT3}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-blue-200 text-sm mb-1">Stop First</div>
                    <div className="text-lg font-bold text-red-300">{report.evaluation.historicalRecent.firstTouchStop}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-blue-200">
                  Average days held: <span className="font-semibold text-white">{report.evaluation.historicalRecent.avgDaysHeld.toFixed(1)}</span>
                </div>
              </div>

              {/* Last Signal */}
              {report.evaluation.historicalRecent.lastSignal && (
                <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-sm text-blue-200 mb-1">Most Recent Signal:</div>
                  <div className="text-white">
                    {report.evaluation.historicalRecent.lastSignal.date} → {report.evaluation.historicalRecent.lastSignal.firstTouch} first 
                    ({report.evaluation.historicalRecent.lastSignal.daysHeld}d held, 10d P&L: 
                    <span className={report.evaluation.historicalRecent.lastSignal.pnl10d >= 0 ? 'text-green-300' : 'text-red-300'}>
                      {' '}{(report.evaluation.historicalRecent.lastSignal.pnl10d * 100).toFixed(2)}%
                    </span>)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Strategy Evaluation Summary */}
      {report.evaluation.metadata?.strategyDetails && report.evaluation.metadata.strategyDetails.length > 0 && (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl border border-white/10 p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Strategy Evaluation Summary</h3>
          <div className="mb-4 text-blue-100">
            Evaluated <span className="font-semibold text-white">{report.evaluation.metadata.totalEvaluated || 6}</span> strategies • 
            <span className="font-semibold text-teal-300"> {report.evaluation.metadata.eligibleFound || 0}</span> eligible • 
            <span className="font-semibold text-green-300"> {report.evaluation.metadata.passedRR || 0}</span> passed R:R minimum
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {report.evaluation.metadata.strategyDetails.map((detail: any, index: number) => (
              <div key={index} className={`p-4 rounded-lg border ${
                detail.strategy === report.evaluation.strategy 
                  ? 'bg-teal-500/20 border-teal-500/50' 
                  : 'bg-white/5 border-white/10'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-white">
                    {formatStrategyName(detail.strategy)}
                  </div>
                  {detail.strategy === report.evaluation.strategy && (
                    <span className="text-xs bg-teal-500 text-white px-2 py-1 rounded">SELECTED</span>
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-200">Quality:</span>
                    <span className="text-white">{(detail.quality * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Viability:</span>
                    <span className="text-white">{(detail.viability * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">R:R:</span>
                    <span className="text-white">{detail.rrFirst.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Mentor Analysis */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">🤖 AI Mentor Analysis</h3>
          {report.mentor.aiGenerated && (
            <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs font-medium text-purple-300">
              {report.mentor.aiModel || 'AI'} Powered
            </span>
          )}
        </div>
        <div className="space-y-6">
          {report.mentor.explanation.split('\n\n').map((section, index) => {
            if (!section.trim()) return null;
            
            const isHeader = section.match(/^\*\*(.*?)\*\*$/);
            if (isHeader) {
              return (
                <div key={index} className="border-b border-white/20 pb-2">
                  <h4 className="text-lg font-semibold text-teal-300">
                    {isHeader[1]}
                  </h4>
                </div>
              );
            }
            
            const lines = section.split('\n');
            const hasBullets = lines.some(line => line.trim().startsWith('•') || line.trim().startsWith('-'));
            
            if (hasBullets) {
              return (
                <div key={index} className="space-y-2">
                  {lines.map((line, lineIndex) => {
                    if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                      return (
                        <div key={lineIndex} className="flex items-start">
                          <span className="text-teal-400 mr-3 mt-1">•</span>
                          <span className="text-blue-100 leading-relaxed">
                            {line.replace(/^[•-]\s*/, '')}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <p key={lineIndex} className="text-white leading-relaxed">
                        {line}
                      </p>
                    );
                  })}
                </div>
              );
            }
            
            return (
              <div key={index} className="space-y-3">
                {lines.map((line, lineIndex) => (
                  <p key={lineIndex} className="text-blue-100 leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Reasons */}
      {report.evaluation.reasons.length > 0 && (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl border border-white/10 p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Analysis Reasons</h3>
          <ul className="space-y-2">
            {report.evaluation.reasons.map((reason, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span className="text-white">{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Block Reason */}
      {report.evaluation.blockReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-red-800 mb-2">Trade Blocked</h3>
          <p className="text-red-700">{report.evaluation.blockReason}</p>
        </div>
      )}
    </div>
  );
}

