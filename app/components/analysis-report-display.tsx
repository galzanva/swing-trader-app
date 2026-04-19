'use client';

import { useState } from 'react';
import type { AnalysisReport } from '@/lib/types/analysis-report';
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
    bullish: 'bg-profit/10 text-profit border-profit/30',
    bearish: 'bg-loss/10 text-loss border-loss/30',
    neutral: 'bg-surface-3 text-text-secondary border-border'
  };
  
  return (
    <span className={`rounded-full font-semibold uppercase border ${sizeClasses[size]} ${colorClasses[signal as keyof typeof colorClasses] || colorClasses.neutral}`}>
      {signal}
    </span>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const colorClass = 
    grade === 'A+' || grade === 'A' ? 'text-profit' :
    grade === 'B' ? 'text-text-secondary' :
    'text-loss';
  
  return <div className={`text-4xl font-black ${colorClass}`}>{grade}</div>;
}

function DirectionIndicator({ direction, size = 'md' }: { direction: 'bullish' | 'bearish' | 'neutral'; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-lg',
    md: 'w-12 h-12 text-2xl',
    lg: 'w-16 h-16 text-3xl'
  };
  
  const colors = {
    bullish: 'bg-profit/10 border-profit/40 text-profit',
    bearish: 'bg-loss/10 border-loss/40 text-loss',
    neutral: 'bg-surface-3 border-border text-text-muted'
  };
  
  const icons = {
    bullish: '↑',
    bearish: '↓',
    neutral: '→'
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
      if (value >= 70) return 'bg-profit';
      if (value >= 50) return 'bg-text-secondary';
      return 'bg-loss';
    }
    return 'bg-accent';
  };
  
  return (
    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${getColor()}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function MetricCard({ label, value, subtext, highlight }: { label: string; value: string | number; subtext?: string; highlight?: 'positive' | 'negative' | 'neutral' }) {
  const highlightColors = {
    positive: 'bg-profit/10 border-profit/30',
    negative: 'bg-loss/10 border-loss/30',
    neutral: 'bg-surface-2 border-border'
  };
  
  return (
    <div className={`p-4 rounded-xl border ${highlightColors[highlight || 'neutral']}`}>
      <div className="text-text-muted text-sm mb-1">{label}</div>
      <div className="text-text-primary font-bold text-xl">{value}</div>
      {subtext && <div className="text-text-muted text-xs mt-1">{subtext}</div>}
    </div>
  );
}

function SectionHeader({ title, badge }: { icon?: string; title: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
        {title}
      </h3>
      {badge && (
        <span className="bg-surface-3 text-text-secondary px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider border border-border">
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
        <div className="rounded-2xl p-6 border bg-surface-1 border-border">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            {/* Left: Symbol & Price */}
            <div className="flex items-start gap-4">
              <DirectionIndicator direction={report.executionDirection} size="lg" />
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold text-text-primary">{report.symbol}</h2>
                  <span className="text-text-muted">{report.name}</span>
                  <span className="bg-surface-3 text-text-secondary px-2 py-0.5 text-xs rounded-full border border-border">
                    {report.timeframe.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-3xl font-bold text-text-primary">${report.currentPrice.toFixed(2)}</span>
                  <SignalBadge signal={report.executionDirection} size="lg" />
                </div>
                {/* Sector/Industry + Data freshness on same line */}
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  {report.fundamentals?.profile?.sector && (
                    <span className="px-2 py-0.5 bg-surface-3 text-text-secondary rounded-full border border-border">
                      {report.fundamentals.profile.sector}
                    </span>
                  )}
                  {report.fundamentals?.profile?.industry && (
                    <span className="px-2 py-0.5 bg-surface-3 text-text-secondary rounded-full border border-border">
                      {report.fundamentals.profile.industry}
                    </span>
                  )}
                  {report.marketData.marketCap && (
                    <span className="text-text-muted">
                      ${report.marketData.marketCap >= 1e9 ? `${(report.marketData.marketCap / 1e9).toFixed(1)}B` : `${(report.marketData.marketCap / 1e6).toFixed(0)}M`}
                    </span>
                  )}
                  <span className="text-text-muted">•</span>
                  <span className="text-text-muted">
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
                  <div className="text-2xl font-bold text-text-primary">{report.score.overall}<span className="text-text-muted text-lg">/100</span></div>
                  <div className="text-xs text-text-muted">Score</div>
                </div>
              </div>
              
              {/* Status */}
              <div className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                report.execution.status === 'ready' ? 'bg-profit/10 text-profit border border-profit/30' :
                report.execution.status === 'candidate' ? 'bg-surface-3 text-text-secondary border border-border' :
                'bg-surface-3 text-text-muted border border-border'
              }`}>
                {report.execution.status === 'ready' && 'Ready'}
                {report.execution.status === 'candidate' && 'Candidate'}
                {report.execution.status === 'missed' && 'Missed'}
                {report.execution.status === 'blocked' && 'Blocked'}
                {report.execution.status === 'neutral' && 'Neutral'}
              </div>
            </div>
          </div>
        </div>

        {/* AI Rating Adjustment Banner */}
        {report.score.ratingAdjustment && (
          <div className="bg-surface-1 rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-text-secondary font-semibold text-sm mb-1">AI Rating Adjustment</div>
                <p className="text-text-secondary text-sm">{report.score.ratingAdjustment.reason}</p>
              </div>
              <div className="text-right text-sm">
                <span className="text-text-muted line-through">{report.score.ratingAdjustment.originalRating} {report.score.ratingAdjustment.originalScore}</span>
                <span className="mx-2 text-text-secondary">→</span>
                <span className="text-text-primary font-bold">{report.score.ratingAdjustment.adjustedRating} {report.score.ratingAdjustment.adjustedScore}</span>
              </div>
            </div>
          </div>
        )}

        {/* Signal Breakdown Bar */}
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(signalBreakdown).map(([key, data]) => (
            <div key={key} className="bg-surface-1 rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-secondary capitalize">{data.label}</span>
                <span className="text-xl font-bold text-text-primary">{data.score}</span>
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
            <div className="bg-surface-1 rounded-2xl p-6 border border-border">
              <SectionHeader title="Moving Averages" />
              <div className="space-y-3">
                {[
                  { label: 'EMA 9', value: report.technical.ema9, diff: ((report.currentPrice - report.technical.ema9) / report.technical.ema9) * 100 },
                  { label: 'EMA 20', value: report.technical.ema20, diff: ((report.currentPrice - report.technical.ema20) / report.technical.ema20) * 100 },
                  { label: 'EMA 50', value: report.technical.ema50, diff: ((report.currentPrice - report.technical.ema50) / report.technical.ema50) * 100 },
                  { label: 'EMA 200', value: report.technical.ema200, diff: ((report.currentPrice - report.technical.ema200) / report.technical.ema200) * 100 },
                ].map((ema) => (
                  <div key={ema.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-text-secondary">{ema.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-text-primary font-medium">${ema.value.toFixed(2)}</span>
                      <span className={`text-sm ${ema.diff >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {ema.diff >= 0 ? '↑' : '↓'} {Math.abs(ema.diff).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-surface-2 rounded-lg">
                <div className="text-sm text-text-secondary">
                  <span className="text-text-muted">EMA Spread:</span>{' '}
                  {((Math.abs(report.technical.ema50 - report.technical.ema9) / report.currentPrice) * 100).toFixed(1)}%
                  <span className="ml-2 text-text-muted">
                    ({report.technical.emaCompression < 3 ? 'Tight squeeze' : 'Moderate spread'})
                  </span>
                </div>
              </div>
            </div>

            {/* Trend Analysis */}
            <div className="bg-surface-1 rounded-2xl p-6 border border-border">
              <SectionHeader title="Trend Analysis" />
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
                <div className="mt-4 p-3 bg-loss/10 border border-loss/30 rounded-lg">
                  <p className="text-loss text-sm">
                    <strong>Countertrend:</strong> Price {report.currentPrice > report.technical.ema200 ? 'above' : 'below'} 200 EMA. Higher risk.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Momentum & Volume */}
          <div className="space-y-6">
            
            {/* Momentum Indicators */}
            <div className="bg-surface-1 rounded-2xl p-6 border border-border">
              <SectionHeader title="Momentum" />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">RSI (14)</span>
                  <span className={`font-bold ${
                    report.technical.rsi > 70 ? 'text-loss' :
                    report.technical.rsi < 30 ? 'text-profit' :
                    'text-text-primary'
                  }`}>
                    {report.technical.rsi.toFixed(1)}
                    <span className="ml-2 text-xs font-normal text-text-muted">
                      {report.technical.rsi > 70 ? 'Overbought' : report.technical.rsi < 30 ? 'Oversold' : 'Neutral'}
                    </span>
                  </span>
                </div>
                <Gauge value={report.technical.rsi} colorScheme="signal" />
                
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="bg-surface-2 p-3 rounded-lg">
                    <div className="text-xs text-text-muted mb-1">MACD</div>
                    <div className={`font-bold ${report.technical.macd.histogram > 0 ? 'text-profit' : 'text-loss'}`}>
                      {report.technical.macd.value.toFixed(3)}
                    </div>
                    <div className="text-xs text-text-muted">Hist: {report.technical.macd.histogram.toFixed(3)}</div>
                  </div>
                  <div className="bg-surface-2 p-3 rounded-lg">
                    <div className="text-xs text-text-muted mb-1">Volume Z-Score</div>
                    <div className={`font-bold ${
                      report.technical.volumeZScore > 1 ? 'text-profit' :
                      report.technical.volumeZScore < -1 ? 'text-loss' :
                      'text-text-primary'
                    }`}>
                      {report.technical.volumeZScore > 0 ? '+' : ''}{report.technical.volumeZScore.toFixed(2)}σ
                    </div>
                    <div className="text-xs text-text-muted">
                      {report.technical.volumeZScore > 1 ? 'High' : report.technical.volumeZScore < -1 ? 'Low' : 'Normal'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Levels */}
            <div className="bg-surface-1 rounded-2xl p-6 border border-border">
              <SectionHeader title="Key Levels" />
              <div className="grid grid-cols-2 gap-4">
                {report.technical.supportLevels.length > 0 && (
                  <div>
                    <div className="text-profit font-medium text-sm mb-2">Support</div>
                    <div className="space-y-1">
                      {report.technical.supportLevels.slice(0, 3).map((level, i) => (
                        <div key={i} className="text-text-primary text-sm">${level.toFixed(2)}</div>
                      ))}
                    </div>
                  </div>
                )}
                {report.technical.resistanceLevels.length > 0 && (
                  <div>
                    <div className="text-loss font-medium text-sm mb-2">Resistance</div>
                    <div className="space-y-1">
                      {report.technical.resistanceLevels.slice(0, 3).map((level, i) => (
                        <div key={i} className="text-text-primary text-sm">${level.toFixed(2)}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ==================== SECTION 3: Pattern Analysis ==================== */}
        <div className="bg-surface-1 rounded-2xl p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Pattern Analysis" />
            <button
              onClick={() => setPatternHelpOpen(true)}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-text-secondary rounded-lg transition-all border border-border text-sm"
            >
              Learn More
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Candlestick Pattern */}
            <div className="bg-surface-2 rounded-xl p-4 border border-border">
              <div className="text-text-muted text-sm mb-2">Candlestick Pattern</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-bold text-lg">{report.pattern.name}</div>
                  <div className="text-text-muted text-sm capitalize">{report.pattern.type}</div>
                </div>
                <div className={`text-2xl font-bold ${
                  report.pattern.confidence >= 70 ? 'text-profit' :
                  report.pattern.confidence >= 50 ? 'text-text-secondary' :
                  'text-text-muted'
                }`}>
                  {report.pattern.confidence}%
                </div>
              </div>
            </div>

            {/* Chart Pattern */}
            {report.chartPattern ? (
              <div className="bg-surface-2 rounded-xl p-4 border border-border">
                <div className="text-text-muted text-sm mb-2">Chart Pattern</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-text-primary font-bold text-lg">{report.chartPattern.name}</div>
                    <div className="text-text-muted text-sm">{report.chartPattern.breakoutStatus}</div>
                  </div>
                  <div className={`text-2xl font-bold ${
                    report.chartPattern.confidence >= 70 ? 'text-profit' :
                    report.chartPattern.confidence >= 50 ? 'text-text-secondary' :
                    'text-text-muted'
                  }`}>
                    {report.chartPattern.confidence}%
                  </div>
                </div>
                {report.chartPattern.priceTarget && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <span className="text-text-muted text-sm">Target: </span>
                    <span className="text-profit font-bold">${report.chartPattern.priceTarget.toFixed(2)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-surface-2 rounded-xl p-4 border border-border">
                <div className="text-text-muted text-sm mb-2">Chart Pattern</div>
                <div className="text-text-muted">No institutional pattern detected</div>
                {report.patternV2?.candidate && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="text-text-secondary text-sm">Candidate: {report.patternV2.candidate.name}</div>
                    <div className="text-text-muted text-xs mt-1">
                      {report.patternV2.candidate.unmetCriteria.length} criteria needed
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pattern Fusion */}
          <div className="mt-4 p-4 bg-surface-2 rounded-xl border border-border">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-text-muted text-sm">Composite Confidence:</span>
                <span className="ml-2 text-text-primary font-bold text-xl">{report.score.overall}/100</span>
              </div>
              {report.patternFusion.fusionBonus !== 0 && (
                <span className={`text-sm ${report.patternFusion.fusionBonus > 0 ? 'text-profit' : 'text-loss'}`}>
                  {report.patternFusion.fusionBonus > 0 ? '+' : ''}{report.patternFusion.fusionBonus} fusion bonus
                </span>
              )}
            </div>
            <p className="text-text-secondary text-sm mt-2">{report.patternFusion.analysis}</p>
          </div>

          {report.hasConflict && (
            <div className="mt-4 p-3 bg-loss/10 border border-loss/30 rounded-lg">
              <p className="text-loss text-sm">
                <strong>Pattern Conflict:</strong> Chart pattern direction differs from candlestick signal.
              </p>
            </div>
          )}
        </div>

        {/* ==================== SECTION 4: Execution Plan ==================== */}
        <div className="bg-surface-1 rounded-2xl p-6 border border-border">
          <SectionHeader title="Execution Plan" />

          <div className="mb-4">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-lg ${
              report.execution.status === 'ready'
                ? 'bg-profit/10 text-profit border border-profit/30'
                : report.execution.status === 'candidate'
                ? 'bg-surface-3 text-text-secondary border border-border'
                : 'bg-surface-3 text-text-muted border border-border'
            }`}>
              {report.execution.status === 'ready' && 'READY'}
              {report.execution.status === 'candidate' && 'CANDIDATE'}
              {report.execution.status === 'missed' && 'MISSED'}
              {report.execution.status === 'blocked' && 'BLOCKED'}
              {report.execution.status === 'neutral' && 'NEUTRAL'}
              <span className="text-sm opacity-70 capitalize">({report.patternSource})</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Entry */}
            <div className="bg-surface-2 rounded-xl p-4 border border-border">
              <div className="text-text-muted text-sm mb-1">
                {report.executionDirection === 'bullish' ? 'Breakout' : 'Breakdown'} Entry
              </div>
              <div className="text-text-primary font-bold text-2xl">${report.execution.entry.triggerPrice.toFixed(2)}</div>
              <div className="text-text-muted text-xs mt-1 capitalize">{report.execution.entry.type}</div>
              <div className="text-text-secondary text-xs mt-2">{report.execution.entry.note}</div>
            </div>

            {/* Stop Loss */}
            <div className="bg-loss/10 rounded-xl p-4 border border-loss/20">
              <div className="text-loss text-sm mb-1">Stop Loss</div>
              <div className="text-text-primary font-bold text-2xl">${report.execution.stopLoss.price.toFixed(2)}</div>
              <div className="text-loss text-sm mt-1">
                {report.execution.stopLoss.movePct.toFixed(1)}%
              </div>
            </div>

            {/* Targets Summary */}
            <div className="bg-profit/10 rounded-xl p-4 border border-profit/20">
              <div className="text-profit text-sm mb-1">Targets</div>
              <div className="space-y-1">
                {report.execution.targets.slice(0, 3).map((target, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-text-primary">${target.price.toFixed(2)}</span>
                    <span className="text-profit">{target.rr.toFixed(1)}:1</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* R:R Summary */}
          <div className="mt-4 p-3 bg-surface-2 border border-border rounded-lg">
            <p className="text-text-secondary text-sm">
              <strong>Risk/Reward:</strong>{' '}
              {Math.abs(report.execution.stopLoss.movePct).toFixed(1)}% risk for{' '}
              {report.execution.targets.map((t) => t.movePct.toFixed(1) + '%').join(' / ')} reward
              ({report.execution.targets.map((t) => t.rr.toFixed(1)).join('–')}× R:R)
            </p>
          </div>

          {report.execution.warnings.length > 0 && (
            <div className="mt-4 p-3 bg-loss/10 border border-loss/30 rounded-lg">
              {report.execution.warnings.map((warning, i) => (
                <div key={i} className="text-loss text-sm">{warning}</div>
              ))}
            </div>
          )}
        </div>

        {/* ==================== SECTION 5: Squeeze Analysis ==================== */}
        {report.squeezeAnalysis && (
          <div className="bg-surface-1 rounded-2xl p-6 border border-border">
            <SectionHeader title="Squeeze Analysis" />

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
                  ? 'bg-loss/10 border-loss/30'
                  : report.squeezeAnalysis.ttmSqueeze.state === 'ON'
                  ? 'bg-surface-3 border-border'
                  : 'bg-surface-2 border-border'
              }`}>
                <div className="text-text-muted text-sm mb-1">TTM Squeeze</div>
                <div className={`font-bold text-xl ${
                  report.squeezeAnalysis.ttmSqueeze.state === 'FIRE' ? 'text-loss' :
                  report.squeezeAnalysis.ttmSqueeze.state === 'ON' ? 'text-text-secondary' :
                  'text-text-muted'
                }`}>
                  {report.squeezeAnalysis.ttmSqueeze.state}
                </div>
                <div className="text-text-muted text-xs mt-1">
                  {report.squeezeAnalysis.ttmSqueeze.state === 'ON' && `${report.squeezeAnalysis.ttmSqueeze.duration} bars`}
                  {report.squeezeAnalysis.ttmSqueeze.state === 'FIRE' && 'Breakout!'}
                  {report.squeezeAnalysis.ttmSqueeze.state === 'OFF' && 'No squeeze'}
                </div>
              </div>
            </div>

            <div className="p-3 bg-surface-2 border border-border rounded-lg">
              <p className="text-text-secondary text-sm">{report.squeezeAnalysis.combined.recommendation}</p>
            </div>
          </div>
        )}

        {/* ==================== SECTION 6: Fundamentals (Lightweight for Swing Trading) ==================== */}
        {report.fundamentals && (
          <div className="bg-surface-1 rounded-2xl p-6 border border-border">
            <SectionHeader title="Fundamentals Snapshot" badge="Swing Focus" />

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
                <div className="bg-surface-2 p-3 rounded-lg">
                  <div className="text-text-muted text-xs mb-1">P/E Ratio</div>
                  <div className="text-text-primary font-bold">{report.fundamentals.viability.pe.toFixed(1)}</div>
                </div>
              )}
              {report.fundamentals.quality.roe !== null && report.fundamentals.quality.roe !== undefined && (
                <div className="bg-surface-2 p-3 rounded-lg">
                  <div className="text-text-muted text-xs mb-1">ROE</div>
                  <div className="text-text-primary font-bold">{report.fundamentals.quality.roe.toFixed(1)}%</div>
                </div>
              )}
              {report.fundamentals.viability.revenueGrowth !== null && report.fundamentals.viability.revenueGrowth !== undefined && (
                <div className="bg-surface-2 p-3 rounded-lg">
                  <div className="text-text-muted text-xs mb-1">Rev Growth</div>
                  <div className={`font-bold ${report.fundamentals.viability.revenueGrowth >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {report.fundamentals.viability.revenueGrowth > 0 ? '+' : ''}{report.fundamentals.viability.revenueGrowth.toFixed(1)}%
                  </div>
                </div>
              )}
              {report.fundamentals.risk.currentRatio !== null && report.fundamentals.risk.currentRatio !== undefined && (
                <div className="bg-surface-2 p-3 rounded-lg">
                  <div className="text-text-muted text-xs mb-1">Current Ratio</div>
                  <div className="text-text-primary font-bold">{report.fundamentals.risk.currentRatio.toFixed(2)}</div>
                </div>
              )}
            </div>

            {report.fundamentals.risk.earningsRisk && report.fundamentals.risk.daysToEarnings !== null && (
              <div className="mt-4 p-3 bg-loss/10 border border-loss/30 rounded-lg">
                <p className="text-loss text-sm">
                  <strong>Earnings in {report.fundamentals.risk.daysToEarnings} days</strong> — High volatility expected
                </p>
              </div>
            )}
          </div>
        )}

        {/* ==================== SECTION 7: News & Sentiment ==================== */}
        {report.newsSummary && report.news && report.news.length > 0 && (
          <div className="bg-surface-1 rounded-2xl p-6 border border-border">
            <SectionHeader title="News Sentiment" />

            {/* Sentiment Summary */}
            <div className="flex items-center gap-4 mb-4 p-4 bg-surface-2 rounded-xl">
              <span className={`px-4 py-2 rounded-lg font-bold ${
                report.newsSummary.overallSentiment === 'bullish'
                  ? 'bg-profit/10 text-profit border border-profit/30'
                  : report.newsSummary.overallSentiment === 'bearish'
                  ? 'bg-loss/10 text-loss border border-loss/30'
                  : 'bg-surface-3 text-text-secondary border border-border'
              }`}>
                {report.newsSummary.overallSentiment.toUpperCase()}
              </span>
              <span className="text-text-primary font-bold text-xl">
                {report.newsSummary.sentimentScore > 0 ? '+' : ''}{report.newsSummary.sentimentScore.toFixed(0)}
              </span>
              <span className="text-text-muted text-sm flex-1">{report.newsSummary.summary}</span>
            </div>

            {/* News Items */}
            <div className="space-y-3">
              {report.news.slice(0, 3).map((article, i) => (
                <div key={i} className="p-3 bg-surface-2 rounded-lg border border-border">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="text-text-primary font-medium text-sm mb-1 line-clamp-2">{article.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        {article.publisher && <span>{article.publisher}</span>}
                        <span>{new Date(article.published_utc).toLocaleDateString()}</span>
                        <a href={article.article_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">
                          Read →
                        </a>
                      </div>
                    </div>
                    {article.sentiment && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        article.sentiment === 'positive'
                          ? 'bg-profit/10 text-profit'
                          : article.sentiment === 'negative'
                          ? 'bg-loss/10 text-loss'
                          : 'bg-surface-3 text-text-secondary'
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
        <div className="bg-surface-1 rounded-2xl p-6 border border-border">
          <SectionHeader title="AI Analysis" badge="AI" />

          <div className="mb-6">
            <p className="text-text-secondary leading-relaxed">{report.analysis.narrative}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bullish Factors */}
            <div>
              <h4 className="text-profit font-semibold mb-3">Bullish Factors</h4>
              <ul className="space-y-2">
                {report.analysis.strengths.slice(0, 4).map((strength, i) => (
                  <li key={i} className="text-profit text-sm flex items-start gap-2">
                    <span className="text-profit mt-0.5">✓</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bearish Factors */}
            <div>
              <h4 className="text-loss font-semibold mb-3">Bearish Factors</h4>
              <ul className="space-y-2">
                {report.analysis.warnings.slice(0, 4).map((warning, i) => (
                  <li key={i} className="text-loss text-sm flex items-start gap-2">
                    <span className="text-loss mt-0.5">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Professional Notes */}
          <div className="mt-6 p-4 bg-surface-2 rounded-xl border border-border">
            <h4 className="text-text-primary font-semibold mb-2">Professional Trader Notes</h4>
            <div className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
              {report.analysis.mentorNotes}
            </div>
          </div>
        </div>

        {/* ==================== Footer ==================== */}
        <div className="text-center text-sm text-text-muted">
          <p>Report generated: {new Date(report.timestamp).toLocaleString()}</p>
          <p className="mt-1 text-xs">Legacy saved report • Technical + fundamentals + sentiment</p>
        </div>
      </div>
    </>
  );
}
