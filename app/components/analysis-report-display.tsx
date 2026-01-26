'use client';

import { useState } from 'react';
import { AnalysisReport } from '../api/analyze/route';
import HelpIcon from './help-icon';
import PatternExplanationHelpModal from './pattern-explanation-help-modal';

// ============================================
// HELPER COMPONENTS (matching technical-analysis style)
// ============================================

function SignalBadge({ signal, size = 'md' }: { signal: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };
  
  const colorClasses = {
    bullish: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    bearish: 'bg-red-500/20 text-red-400 border-red-500/30',
    neutral: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  };
  
  return (
    <span className={`rounded-full font-semibold uppercase border ${sizeClasses[size]} ${colorClasses[signal as keyof typeof colorClasses] || colorClasses.neutral}`}>
      {signal}
    </span>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const colorClass = 
    grade === 'A+' || grade === 'A' ? 'text-emerald-400' :
    grade === 'B' ? 'text-yellow-400' :
    'text-orange-400';
  
  return <div className={`text-4xl font-black ${colorClass}`}>{grade}</div>;
}

function DirectionIndicator({ direction, size = 'md' }: { direction: 'bullish' | 'bearish' | 'neutral'; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-lg',
    md: 'w-12 h-12 text-2xl',
    lg: 'w-16 h-16 text-3xl'
  };
  
  const colors = {
    bullish: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
    bearish: 'bg-red-500/20 border-red-500/40 text-red-400',
    neutral: 'bg-slate-500/20 border-slate-500/40 text-slate-400'
  };
  
  const icons = {
    bullish: '📈',
    bearish: '📉',
    neutral: '➡️'
  };
  
  return (
    <div className={`rounded-xl flex items-center justify-center border ${sizeClasses[size]} ${colors[direction]}`}>
      {icons[direction]}
    </div>
  );
}

function Gauge({ value, colorScheme = 'default' }: { value: number; colorScheme?: 'default' | 'signal' }) {
  const getColor = () => {
    if (colorScheme === 'signal') {
      if (value >= 70) return 'bg-emerald-500';
      if (value >= 50) return 'bg-yellow-500';
      return 'bg-red-500';
    }
    return 'bg-blue-500';
  };
  
  return (
    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${getColor()}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function MetricCard({ label, value, subtext, highlight }: { label: string; value: string | number; subtext?: string; highlight?: 'positive' | 'negative' | 'neutral' }) {
  const highlightColors = {
    positive: 'bg-emerald-500/10 border-emerald-500/30',
    negative: 'bg-red-500/10 border-red-500/30',
    neutral: 'bg-white/5 border-white/10'
  };
  
  return (
    <div className={`p-4 rounded-xl border ${highlightColors[highlight || 'neutral']}`}>
      <div className="text-slate-400 text-sm mb-1">{label}</div>
      <div className="text-white font-bold text-xl">{value}</div>
      {subtext && <div className="text-slate-400 text-xs mt-1">{subtext}</div>}
    </div>
  );
}

function SectionHeader({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        {title}
      </h3>
      {badge && (
        <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider border border-indigo-500/30">
          {badge}
        </span>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

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
    hoursSinceUpdate < 1 ? 'Real-time' :
    hoursSinceUpdate < 24 ? `${Math.round(hoursSinceUpdate)}h old` :
    `${report.marketData.dataAgeDays}d old`;

  // Derive signal breakdown scores for display
  const signalBreakdown = {
    technical: { score: report.score.breakdown.technical, label: 'Technical' },
    momentum: { score: report.score.breakdown.momentum, label: 'Momentum' },
    trend: { score: report.score.breakdown.trend, label: 'Trend' },
    pattern: { score: report.score.breakdown.pattern, label: 'Pattern' },
    volume: { score: report.score.breakdown.volume, label: 'Volume' },
  };

  return (
    <>
      {/* Pattern Help Modal */}
      {patternHelpOpen && <PatternExplanationHelpModal isOpen={patternHelpOpen} onClose={() => setPatternHelpOpen(false)} />}

      <div className="space-y-6">
        
        {/* ==================== SECTION 1: Summary Header ==================== */}
        <div className="backdrop-blur-lg rounded-2xl p-6 border bg-white/10 border-white/20">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            {/* Left: Symbol & Price */}
            <div className="flex items-start gap-4">
              <DirectionIndicator direction={report.executionDirection} size="lg" />
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold text-white">{report.symbol}</h2>
                  <span className="text-slate-400">{report.name}</span>
                  <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 text-xs rounded-full border border-blue-500/30">
                    {report.timeframe.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-3xl font-bold text-white">${report.currentPrice.toFixed(2)}</span>
                  <SignalBadge signal={report.executionDirection} size="lg" />
                </div>
                {/* Sector/Industry + Data freshness on same line */}
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  {report.fundamentals?.profile?.sector && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">
                      {report.fundamentals.profile.sector}
                    </span>
                  )}
                  {report.fundamentals?.profile?.industry && (
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                      {report.fundamentals.profile.industry}
                    </span>
                  )}
                  {report.marketData.marketCap && (
                    <span className="text-slate-500">
                      ${report.marketData.marketCap >= 1e9 ? `${(report.marketData.marketCap / 1e9).toFixed(1)}B` : `${(report.marketData.marketCap / 1e6).toFixed(0)}M`}
                    </span>
                  )}
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-500">
                    Data: {lastBarDate.toLocaleDateString()} ({dataFreshnessLabel})
                  </span>
                </div>
              </div>
            </div>
            
            {/* Right: Grade + Score + Status */}
            <div className="flex items-center gap-6">
              {/* Grade & Score together */}
              <div className="flex items-center gap-4">
                <GradeBadge grade={report.score.rating} />
                <div>
                  <div className="text-2xl font-bold text-white">{report.score.overall}<span className="text-slate-500 text-lg">/100</span></div>
                  <div className="text-xs text-slate-400">Score</div>
                </div>
              </div>
              
              {/* Status */}
              <div className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                report.execution.status === 'ready' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                report.execution.status === 'candidate' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                'bg-slate-500/20 text-slate-400 border border-slate-500/30'
              }`}>
                {report.execution.status === 'ready' && '✅ Ready'}
                {report.execution.status === 'candidate' && '🟡 Candidate'}
                {report.execution.status === 'missed' && '⏰ Missed'}
                {report.execution.status === 'blocked' && '🚫 Blocked'}
                {report.execution.status === 'neutral' && '➡️ Neutral'}
              </div>
            </div>
          </div>
        </div>

        {/* AI Rating Adjustment Banner */}
        {report.score.ratingAdjustment && (
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 backdrop-blur-lg rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤖</span>
              <div className="flex-1">
                <div className="text-purple-300 font-semibold text-sm mb-1">AI Rating Adjustment</div>
                <p className="text-purple-200 text-sm">{report.score.ratingAdjustment.reason}</p>
              </div>
              <div className="text-right text-sm">
                <span className="text-slate-400 line-through">{report.score.ratingAdjustment.originalRating} {report.score.ratingAdjustment.originalScore}</span>
                <span className="mx-2 text-purple-300">→</span>
                <span className="text-purple-200 font-bold">{report.score.ratingAdjustment.adjustedRating} {report.score.ratingAdjustment.adjustedScore}</span>
              </div>
            </div>
          </div>
        )}

        {/* Signal Breakdown Bar */}
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(signalBreakdown).map(([key, data]) => (
            <div key={key} className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-300 capitalize">{data.label}</span>
                <span className="text-xl font-bold text-white">{data.score}</span>
              </div>
              <Gauge value={data.score} colorScheme="signal" />
            </div>
          ))}
        </div>

        {/* ==================== SECTION 2: Core Technical Analysis ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column: Trend & Moving Averages */}
          <div className="space-y-6">
            
            {/* Moving Averages */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <SectionHeader icon="🎗️" title="Moving Averages" />
              <div className="space-y-3">
                {[
                  { label: 'EMA 9', value: report.technical.ema9, diff: ((report.currentPrice - report.technical.ema9) / report.technical.ema9) * 100 },
                  { label: 'EMA 20', value: report.technical.ema20, diff: ((report.currentPrice - report.technical.ema20) / report.technical.ema20) * 100 },
                  { label: 'EMA 50', value: report.technical.ema50, diff: ((report.currentPrice - report.technical.ema50) / report.technical.ema50) * 100 },
                  { label: 'EMA 200', value: report.technical.ema200, diff: ((report.currentPrice - report.technical.ema200) / report.technical.ema200) * 100 },
                ].map((ema) => (
                  <div key={ema.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <span className="text-slate-300">{ema.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium">${ema.value.toFixed(2)}</span>
                      <span className={`text-sm ${ema.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {ema.diff >= 0 ? '↑' : '↓'} {Math.abs(ema.diff).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-white/5 rounded-lg">
                <div className="text-sm text-slate-300">
                  <span className="text-slate-400">EMA Spread:</span>{' '}
                  {((Math.abs(report.technical.ema50 - report.technical.ema9) / report.currentPrice) * 100).toFixed(1)}%
                  <span className="ml-2 text-slate-400">
                    ({report.technical.emaCompression < 3 ? '🔥 Tight squeeze' : 'Moderate spread'})
                  </span>
                </div>
              </div>
            </div>

            {/* Trend Analysis */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <SectionHeader icon="📈" title="Trend Analysis" />
              <div className="grid grid-cols-2 gap-4">
                <MetricCard 
                  label="Direction" 
                  value={report.technical.trend.charAt(0).toUpperCase() + report.technical.trend.slice(1)}
                  highlight={report.technical.trend === 'bullish' ? 'positive' : report.technical.trend === 'bearish' ? 'negative' : 'neutral'}
                />
                <MetricCard 
                  label="Strength" 
                  value={`${report.technical.trendStrength}/100`}
                  highlight={report.technical.trendStrength >= 70 ? 'positive' : report.technical.trendStrength >= 50 ? 'neutral' : 'negative'}
                />
              </div>
              
              {/* Countertrend Warning */}
              {((report.executionDirection === 'bullish' && report.currentPrice < report.technical.ema200) ||
                (report.executionDirection === 'bearish' && report.currentPrice > report.technical.ema200)) && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-200 text-sm">
                    ⚠️ <strong>Countertrend:</strong> Price {report.currentPrice > report.technical.ema200 ? 'above' : 'below'} 200 EMA. Higher risk.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Momentum & Volume */}
          <div className="space-y-6">
            
            {/* Momentum Indicators */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <SectionHeader icon="⚡" title="Momentum" />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">RSI (14)</span>
                  <span className={`font-bold ${
                    report.technical.rsi > 70 ? 'text-red-400' :
                    report.technical.rsi < 30 ? 'text-emerald-400' :
                    'text-white'
                  }`}>
                    {report.technical.rsi.toFixed(1)}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {report.technical.rsi > 70 ? 'Overbought' : report.technical.rsi < 30 ? 'Oversold' : 'Neutral'}
                    </span>
                  </span>
                </div>
                <Gauge value={report.technical.rsi} colorScheme="signal" />
                
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="bg-white/5 p-3 rounded-lg">
                    <div className="text-xs text-slate-400 mb-1">MACD</div>
                    <div className={`font-bold ${report.technical.macd.histogram > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {report.technical.macd.value.toFixed(3)}
                    </div>
                    <div className="text-xs text-slate-400">Hist: {report.technical.macd.histogram.toFixed(3)}</div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-lg">
                    <div className="text-xs text-slate-400 mb-1">Volume Z-Score</div>
                    <div className={`font-bold ${
                      report.technical.volumeZScore > 1 ? 'text-emerald-400' :
                      report.technical.volumeZScore < -1 ? 'text-red-400' :
                      'text-white'
                    }`}>
                      {report.technical.volumeZScore > 0 ? '+' : ''}{report.technical.volumeZScore.toFixed(2)}σ
                    </div>
                    <div className="text-xs text-slate-400">
                      {report.technical.volumeZScore > 1 ? 'High' : report.technical.volumeZScore < -1 ? 'Low' : 'Normal'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Levels */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <SectionHeader icon="📍" title="Key Levels" />
              <div className="grid grid-cols-2 gap-4">
                {report.technical.supportLevels.length > 0 && (
                  <div>
                    <div className="text-emerald-400 font-medium text-sm mb-2">Support</div>
                    <div className="space-y-1">
                      {report.technical.supportLevels.slice(0, 3).map((level, i) => (
                        <div key={i} className="text-white text-sm">${level.toFixed(2)}</div>
                      ))}
                    </div>
                  </div>
                )}
                {report.technical.resistanceLevels.length > 0 && (
                  <div>
                    <div className="text-red-400 font-medium text-sm mb-2">Resistance</div>
                    <div className="space-y-1">
                      {report.technical.resistanceLevels.slice(0, 3).map((level, i) => (
                        <div key={i} className="text-white text-sm">${level.toFixed(2)}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ==================== SECTION 3: Pattern Analysis ==================== */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader icon="🔍" title="Pattern Analysis" />
            <button
              onClick={() => setPatternHelpOpen(true)}
              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg transition-all border border-blue-500/30 text-sm"
            >
              Learn More
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Candlestick Pattern */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-slate-400 text-sm mb-2">Candlestick Pattern</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-bold text-lg">{report.pattern.name}</div>
                  <div className="text-slate-400 text-sm capitalize">{report.pattern.type}</div>
                </div>
                <div className={`text-2xl font-bold ${
                  report.pattern.confidence >= 70 ? 'text-emerald-400' :
                  report.pattern.confidence >= 50 ? 'text-yellow-400' :
                  'text-slate-400'
                }`}>
                  {report.pattern.confidence}%
                </div>
              </div>
            </div>

            {/* Chart Pattern */}
            {report.chartPattern ? (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="text-slate-400 text-sm mb-2">Chart Pattern</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-bold text-lg">{report.chartPattern.name}</div>
                    <div className="text-slate-400 text-sm">{report.chartPattern.breakoutStatus}</div>
                  </div>
                  <div className={`text-2xl font-bold ${
                    report.chartPattern.confidence >= 70 ? 'text-emerald-400' :
                    report.chartPattern.confidence >= 50 ? 'text-yellow-400' :
                    'text-slate-400'
                  }`}>
                    {report.chartPattern.confidence}%
                  </div>
                </div>
                {report.chartPattern.priceTarget && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <span className="text-slate-400 text-sm">Target: </span>
                    <span className="text-emerald-400 font-bold">${report.chartPattern.priceTarget.toFixed(2)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="text-slate-400 text-sm mb-2">Chart Pattern</div>
                <div className="text-slate-500">No institutional pattern detected</div>
                {report.patternV2?.candidate && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="text-yellow-400 text-sm">Candidate: {report.patternV2.candidate.name}</div>
                    <div className="text-slate-400 text-xs mt-1">
                      {report.patternV2.candidate.unmetCriteria.length} criteria needed
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pattern Fusion */}
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-sm">Composite Confidence:</span>
                <span className="ml-2 text-white font-bold text-xl">{report.score.overall}/100</span>
              </div>
              {report.patternFusion.fusionBonus !== 0 && (
                <span className={`text-sm ${report.patternFusion.fusionBonus > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {report.patternFusion.fusionBonus > 0 ? '+' : ''}{report.patternFusion.fusionBonus} fusion bonus
                </span>
              )}
            </div>
            <p className="text-blue-200 text-sm mt-2">{report.patternFusion.analysis}</p>
          </div>

          {report.hasConflict && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-200 text-sm">
                ⚠️ <strong>Pattern Conflict:</strong> Chart pattern direction differs from candlestick signal.
              </p>
            </div>
          )}
        </div>

        {/* ==================== SECTION 4: Execution Plan ==================== */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <SectionHeader icon="🎯" title="Execution Plan" />

          <div className="mb-4">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-lg ${
              report.execution.status === 'ready'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : report.execution.status === 'candidate'
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
            }`}>
              {report.execution.status === 'ready' && '✅ READY'}
              {report.execution.status === 'candidate' && '🟡 CANDIDATE'}
              {report.execution.status === 'missed' && '⏰ MISSED'}
              {report.execution.status === 'blocked' && '🚫 BLOCKED'}
              {report.execution.status === 'neutral' && '➡️ NEUTRAL'}
              <span className="text-sm opacity-70 capitalize">({report.patternSource})</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Entry */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-slate-400 text-sm mb-1">
                {report.executionDirection === 'bullish' ? '📈 Breakout' : '📉 Breakdown'} Entry
              </div>
              <div className="text-white font-bold text-2xl">${report.execution.entry.triggerPrice.toFixed(2)}</div>
              <div className="text-slate-400 text-xs mt-1 capitalize">{report.execution.entry.type}</div>
              <div className="text-slate-300 text-xs mt-2">{report.execution.entry.note}</div>
            </div>

            {/* Stop Loss */}
            <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
              <div className="text-red-300 text-sm mb-1">🛑 Stop Loss</div>
              <div className="text-white font-bold text-2xl">${report.execution.stopLoss.price.toFixed(2)}</div>
              <div className="text-red-300 text-sm mt-1">
                {report.execution.stopLoss.movePct.toFixed(1)}%
              </div>
            </div>

            {/* Targets Summary */}
            <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
              <div className="text-emerald-300 text-sm mb-1">🎯 Targets</div>
              <div className="space-y-1">
                {report.execution.targets.slice(0, 3).map((target, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-white">${target.price.toFixed(2)}</span>
                    <span className="text-emerald-300">{target.rr.toFixed(1)}:1</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* R:R Summary */}
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-200 text-sm">
              <strong>Risk/Reward:</strong>{' '}
              {Math.abs(report.execution.stopLoss.movePct).toFixed(1)}% risk for{' '}
              {report.execution.targets.map((t) => t.movePct.toFixed(1) + '%').join(' / ')} reward
              ({report.execution.targets.map((t) => t.rr.toFixed(1)).join('–')}× R:R)
            </p>
          </div>

          {report.execution.warnings.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              {report.execution.warnings.map((warning, i) => (
                <div key={i} className="text-yellow-200 text-sm">⚠️ {warning}</div>
              ))}
            </div>
          )}
        </div>

        {/* ==================== SECTION 5: Squeeze Analysis ==================== */}
        {report.squeezeAnalysis && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <SectionHeader icon="🔥" title="Squeeze Analysis" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <MetricCard
                label="Combined Score"
                value={`${report.squeezeAnalysis.combined.score}/100`}
                subtext={report.squeezeAnalysis.combined.potential}
                highlight={report.squeezeAnalysis.combined.score >= 70 ? 'positive' : report.squeezeAnalysis.combined.score >= 40 ? 'neutral' : 'negative'}
              />
              <MetricCard
                label="Short Float"
                value={report.squeezeAnalysis.shortSqueeze.shortFloat 
                  ? `${report.squeezeAnalysis.shortSqueeze.shortFloat.toFixed(1)}%`
                  : 'N/A'}
                subtext={report.squeezeAnalysis.shortSqueeze.shortVolumeTrend}
              />
              <div className={`p-4 rounded-xl border ${
                report.squeezeAnalysis.ttmSqueeze.state === 'FIRE'
                  ? 'bg-red-500/10 border-red-500/30'
                  : report.squeezeAnalysis.ttmSqueeze.state === 'ON'
                  ? 'bg-yellow-500/10 border-yellow-500/30'
                  : 'bg-white/5 border-white/10'
              }`}>
                <div className="text-slate-400 text-sm mb-1">TTM Squeeze</div>
                <div className={`font-bold text-xl ${
                  report.squeezeAnalysis.ttmSqueeze.state === 'FIRE' ? 'text-red-400' :
                  report.squeezeAnalysis.ttmSqueeze.state === 'ON' ? 'text-yellow-400' :
                  'text-slate-400'
                }`}>
                  {report.squeezeAnalysis.ttmSqueeze.state}
                </div>
                <div className="text-slate-400 text-xs mt-1">
                  {report.squeezeAnalysis.ttmSqueeze.state === 'ON' && `${report.squeezeAnalysis.ttmSqueeze.duration} bars`}
                  {report.squeezeAnalysis.ttmSqueeze.state === 'FIRE' && 'Breakout!'}
                  {report.squeezeAnalysis.ttmSqueeze.state === 'OFF' && 'No squeeze'}
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-blue-200 text-sm">{report.squeezeAnalysis.combined.recommendation}</p>
            </div>
          </div>
        )}

        {/* ==================== SECTION 6: Fundamentals (Lightweight for Swing Trading) ==================== */}
        {report.fundamentals && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <SectionHeader icon="📊" title="Fundamentals Snapshot" badge="Swing Focus" />

            <div className="grid grid-cols-3 gap-4 mb-4">
              <MetricCard
                label="Quality"
                value={report.fundamentals.qualityScore}
                subtext={report.fundamentals.quality.grade}
                highlight={report.fundamentals.qualityScore >= 70 ? 'positive' : report.fundamentals.qualityScore >= 50 ? 'neutral' : 'negative'}
              />
              <MetricCard
                label="Viability"
                value={report.fundamentals.viabilityScore}
                subtext={report.fundamentals.viability.valuation}
                highlight={report.fundamentals.viabilityScore >= 70 ? 'positive' : report.fundamentals.viabilityScore >= 50 ? 'neutral' : 'negative'}
              />
              <MetricCard
                label="Risk"
                value={report.fundamentals.riskScore}
                subtext={report.fundamentals.risk.level}
                highlight={report.fundamentals.riskScore <= 30 ? 'positive' : report.fundamentals.riskScore <= 50 ? 'neutral' : 'negative'}
              />
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {report.fundamentals.viability.pe !== null && report.fundamentals.viability.pe !== undefined && (
                <div className="bg-white/5 p-3 rounded-lg">
                  <div className="text-slate-400 text-xs mb-1">P/E Ratio</div>
                  <div className="text-white font-bold">{report.fundamentals.viability.pe.toFixed(1)}</div>
                </div>
              )}
              {report.fundamentals.quality.roe !== null && report.fundamentals.quality.roe !== undefined && (
                <div className="bg-white/5 p-3 rounded-lg">
                  <div className="text-slate-400 text-xs mb-1">ROE</div>
                  <div className="text-white font-bold">{report.fundamentals.quality.roe.toFixed(1)}%</div>
                </div>
              )}
              {report.fundamentals.viability.revenueGrowth !== null && report.fundamentals.viability.revenueGrowth !== undefined && (
                <div className="bg-white/5 p-3 rounded-lg">
                  <div className="text-slate-400 text-xs mb-1">Rev Growth</div>
                  <div className={`font-bold ${report.fundamentals.viability.revenueGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {report.fundamentals.viability.revenueGrowth > 0 ? '+' : ''}{report.fundamentals.viability.revenueGrowth.toFixed(1)}%
                  </div>
                </div>
              )}
              {report.fundamentals.risk.currentRatio !== null && report.fundamentals.risk.currentRatio !== undefined && (
                <div className="bg-white/5 p-3 rounded-lg">
                  <div className="text-slate-400 text-xs mb-1">Current Ratio</div>
                  <div className="text-white font-bold">{report.fundamentals.risk.currentRatio.toFixed(2)}</div>
                </div>
              )}
            </div>

            {report.fundamentals.risk.earningsRisk && report.fundamentals.risk.daysToEarnings !== null && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-200 text-sm">
                  ⚠️ <strong>Earnings in {report.fundamentals.risk.daysToEarnings} days</strong> — High volatility expected
                </p>
              </div>
            )}
          </div>
        )}

        {/* ==================== SECTION 7: News & Sentiment ==================== */}
        {report.newsSummary && report.news && report.news.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <SectionHeader icon="📰" title="News Sentiment" />

            {/* Sentiment Summary */}
            <div className="flex items-center gap-4 mb-4 p-4 bg-white/5 rounded-xl">
              <span className={`px-4 py-2 rounded-lg font-bold ${
                report.newsSummary.overallSentiment === 'bullish'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : report.newsSummary.overallSentiment === 'bearish'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
              }`}>
                {report.newsSummary.overallSentiment.toUpperCase()}
              </span>
              <span className="text-white font-bold text-xl">
                {report.newsSummary.sentimentScore > 0 ? '+' : ''}{report.newsSummary.sentimentScore.toFixed(0)}
              </span>
              <span className="text-slate-400 text-sm flex-1">{report.newsSummary.summary}</span>
            </div>

            {/* News Items */}
            <div className="space-y-3">
              {report.news.slice(0, 3).map((article, i) => (
                <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="text-white font-medium text-sm mb-1 line-clamp-2">{article.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {article.publisher && <span>{article.publisher}</span>}
                        <span>{new Date(article.published_utc).toLocaleDateString()}</span>
                        <a href={article.article_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                          Read →
                        </a>
                      </div>
                    </div>
                    {article.sentiment && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        article.sentiment === 'positive'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : article.sentiment === 'negative'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-slate-500/20 text-slate-300'
                      }`}>
                        {article.sentiment}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== SECTION 8: AI Analysis Summary ==================== */}
        <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 backdrop-blur-lg rounded-2xl p-6 border border-purple-500/20">
          <SectionHeader icon="🤖" title="AI Analysis" badge="AI" />

          <div className="mb-6">
            <p className="text-purple-100 leading-relaxed">{report.analysis.narrative}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bullish Factors */}
            <div>
              <h4 className="text-emerald-400 font-semibold mb-3">✅ Bullish Factors</h4>
              <ul className="space-y-2">
                {report.analysis.strengths.slice(0, 4).map((strength, i) => (
                  <li key={i} className="text-emerald-200 text-sm flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bearish Factors */}
            <div>
              <h4 className="text-red-400 font-semibold mb-3">⚠️ Bearish Factors</h4>
              <ul className="space-y-2">
                {report.analysis.warnings.slice(0, 4).map((warning, i) => (
                  <li key={i} className="text-yellow-200 text-sm flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">⚠</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Professional Notes */}
          <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <h4 className="text-white font-semibold mb-2">💡 Professional Trader Notes</h4>
            <div className="text-purple-200 text-sm leading-relaxed whitespace-pre-line">
              {report.analysis.mentorNotes}
            </div>
          </div>
        </div>

        {/* ==================== Footer ==================== */}
        <div className="text-center text-sm text-slate-400">
          <p>Report generated: {new Date(report.timestamp).toLocaleString()}</p>
          <p className="mt-1 text-xs">Deep Analysis • Technical + Fundamentals + Sentiment</p>
        </div>
      </div>
    </>
  );
}
