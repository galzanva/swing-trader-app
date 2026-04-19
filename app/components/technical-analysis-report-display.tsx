'use client';

import { useState } from 'react';
import IndicatorExplanationModal, { IndicatorSection } from './indicator-explanation-modal';

interface TechnicalAnalysisReportData {
  symbol: string;
  timeframe: string;
  timestamp: string;
  currentPrice: number;
  signalStrength: {
    overall: number;
    grade: string;
    direction: 'bullish' | 'bearish' | 'neutral';
    confidence: string;
    breakdown: Record<string, { score: number; signal: string }>;
  };
  indicators: {
    movingAverages: Record<string, number>;
    momentum: {
      rsi: number;
      rsiSignal: string;
      stochasticK: number;
      stochasticD: number;
      macd: number;
      macdSignal: number;
      macdHistogram: number;
      williamsR: number;
      cci: number;
      mfi: number;
    };
    trend: {
      adx: number;
      trendStrength: string;
      plusDI: number;
      minusDI: number;
      trendDirection: string;
      emaAlignment: string;
      priceLocation: string;
    };
    volatility: {
      atr: number;
      atrPercent: number;
      volatilityRegime: string;
      bollingerPercentB: number;
      bollingerBandwidth: number;
      historicalVolatility: number;
    };
    volume: {
      zScore?: number;
      volumeZScore?: number;
      volumeSignal: string;
      obvTrend: string;
      cmf: number;
    };
  };
  recommendation: {
    strategy: string;
    direction: 'long' | 'short' | 'wait';
    confidence: number;
    entry: {
      type: string;
      price: number;
      conditions: string[];
    };
    stopLoss: {
      price: number;
      reason: string;
      riskPercent: number;
    };
    targets: {
      t1: { price: number; rr: number; probability: number };
      t2: { price: number; rr: number; probability: number };
      t3: { price: number; rr: number; probability: number };
    };
    invalidation: string;
  };
  structureAnalysis?: {
    classification: string;
    confidence: number;
    summary: string;
    priorTrendDirection: string;
    dominantBias: string;
    structureIntact: boolean;
    pullbackSignals: string[];
    reversalSignals: string[];
    detectedPatterns?: Array<{
      name: string;
      type: string;
      location: string;
      confidence: number;
      outcome?: string;
      outcomeDescription?: string;
    }>;
  };
  projections: {
    mostProbable: {
      direction: string;
      lowTarget: number;
      highTarget: number;
      probability: number;
      timeframeDays: { min: number; max: number };
    };
    upside: Array<{ label: string; price: number; probability: number; daysToTarget: number }>;
    downside: Array<{ label: string; price: number; probability: number; daysToTarget: number }>;
  };
  aiSummary?: {
    headline?: string;
    technicalOutlook?: string;
    keyInsights?: string[];
    riskFactors?: string[];
    tradingPlan?: string;
    confidenceLevel?: string;
  };
  aiEnhanced?: {
    signalStrength: {
      overall: number;
      grade: string;
      direction: string;
      reasoning: string[];
      breakdown: any;
    };
    priceProjections: {
      bullCase: { target: number; probability: number; timeframe: string; reasoning: string };
      baseCase: { target: number; probability: number; timeframe: string; reasoning: string };
      bearCase: { target: number; probability: number; timeframe: string; reasoning: string };
      mostLikely: string;
    };
    recommendation: {
      action: string;
      strategy: string;
      confidence: number;
      confidenceReasoning: string;
      entry: { type: string; price: number; conditions: string[] };
      stopLoss: { price: number; riskPercent: number; reasoning: string };
      targets: {
        t1: { price: number; rr: number; probability: number; reasoning: string };
        t2: { price: number; rr: number; probability: number; reasoning: string };
        t3: { price: number; rr: number; probability: number; reasoning: string };
      };
      invalidation: string;
      keyRisks: string[];
      keyOpportunities: string[];
    };
  };
  marketData?: {
    name: string;
    exchange?: string;
    lastBarDate: string;
    dataAgeDays: number;
    barsAnalyzed: number;
  };
}

interface TechnicalAnalysisReportDisplayProps {
  report: TechnicalAnalysisReportData;
}

function SignalBadge({ signal }: { signal: string }) {
  const colorMap: Record<string, string> = {
    'overbought': 'bg-loss/10 text-loss',
    'bullish': 'bg-profit/10 text-profit',
    'neutral': 'bg-surface-3 text-text-muted',
    'bearish': 'bg-loss/10 text-loss',
    'oversold': 'bg-profit/10 text-profit',
    'strong': 'bg-profit/10 text-profit',
    'moderate': 'bg-surface-3 text-text-secondary',
    'weak': 'bg-surface-3 text-text-secondary',
    'no trend': 'bg-surface-3 text-text-muted',
    'high': 'bg-loss/10 text-loss',
    'normal': 'bg-surface-3 text-text-secondary',
    'low': 'bg-profit/10 text-profit',
    'long': 'bg-profit/10 text-profit',
    'short': 'bg-loss/10 text-loss',
    'wait': 'bg-surface-3 text-text-secondary',
    'mixed': 'bg-surface-3 text-text-secondary',
    'above all emas': 'bg-profit/10 text-profit',
    'below all emas': 'bg-loss/10 text-loss',
    'expanding': 'bg-loss/10 text-loss',
    'contracting': 'bg-surface-3 text-text-secondary',
    'rising': 'bg-profit/10 text-profit',
    'falling': 'bg-loss/10 text-loss',
    'flat': 'bg-surface-3 text-text-muted',
  };

  const classes = colorMap[signal?.toLowerCase()] || 'bg-surface-3 text-text-muted';

  return (
    <span className={`${classes} px-2 py-0.5 text-xs rounded-full font-medium capitalize`}>
      {signal}
    </span>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const colorMap: Record<string, string> = {
    'A+': 'bg-profit text-white',
    'A': 'bg-profit text-white',
    'B': 'bg-accent text-white',
    'C': 'bg-text-secondary text-white',
    'D': 'bg-loss text-white',
    'F': 'bg-loss text-white',
  };

  return (
    <span className={`${colorMap[grade] || 'bg-surface-3 text-text-primary'} px-3 py-1 rounded-lg text-lg font-bold`}>
      {grade}
    </span>
  );
}

export default function TechnicalAnalysisReportDisplay({ report }: TechnicalAnalysisReportDisplayProps) {
  const [indicatorModalOpen, setIndicatorModalOpen] = useState(false);
  const [indicatorSection, setIndicatorSection] = useState<IndicatorSection>('all');
  
  const openIndicatorHelp = (section: IndicatorSection) => {
    setIndicatorSection(section);
    setIndicatorModalOpen(true);
  };

  if (!report) return null;

  const signalStrength = report.aiEnhanced?.signalStrength || report.signalStrength;
  const recommendation = report.aiEnhanced?.recommendation || report.recommendation;
  const isAiEnhanced = !!report.aiEnhanced;

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className={`rounded-xl p-6 border ${isAiEnhanced ? 'bg-surface-1 border-accent/30' : 'bg-surface-1 border-border'}`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-text-primary">{report.symbol}</h2>
              {report.marketData?.name && (
                <span className="text-text-muted">{report.marketData.name}</span>
              )}
              {isAiEnhanced && (
                <span className="bg-accent/20 text-accent px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider border border-accent/30">
                  AI Enhanced
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-3xl font-bold text-text-primary">${report.currentPrice?.toFixed(2)}</span>
              <SignalBadge signal={signalStrength?.direction} />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-sm text-text-muted mb-1">Grade</div>
              <GradeBadge grade={signalStrength?.grade} />
            </div>
            <div className="text-center">
              <div className="text-sm text-text-muted mb-1">Strength</div>
              <div className="text-2xl font-bold text-text-primary">{signalStrength?.overall}/100</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-text-muted mb-1">Direction</div>
              <SignalBadge signal={(recommendation as any)?.action || (recommendation as any)?.direction} />
            </div>
          </div>
        </div>

        {/* AI Reasoning for Signal Strength */}
        {isAiEnhanced && report.aiEnhanced?.signalStrength.reasoning && (
          <div className="mt-6 pt-6 border-t border-border">
            <h4 className="text-xs font-bold text-accent uppercase tracking-widest mb-3">AI Analysis Reasoning</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              {report.aiEnhanced.signalStrength.reasoning.map((reason, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="text-accent mt-1">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Signal Breakdown */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(signalStrength?.breakdown || {}).map(([key, data]: [string, any]) => (
          <div key={key} className={`rounded-xl p-4 border ${isAiEnhanced ? 'bg-surface-1 border-accent/20' : 'bg-surface-1 border-border'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-secondary capitalize">{key}</span>
              <span className="text-xl font-bold text-text-primary">{data.score}</span>
            </div>
            <div className="text-xs text-text-muted mb-1">
              {data.signal || (data as any).assessment}
            </div>
          </div>
        ))}
      </div>

      {/* Key Indicators Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Momentum */}
        <div className="bg-surface-1 rounded-xl p-5 border border-border">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Momentum</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <button onClick={() => openIndicatorHelp('rsi')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                RSI (14) <span className="text-accent text-xs">i</span>
              </button>
              <span className="text-text-primary font-mono">{report.indicators?.momentum?.rsi?.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <button onClick={() => openIndicatorHelp('stochastic')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                Stochastic %K / %D <span className="text-accent text-xs">i</span>
              </button>
              <span className="text-text-primary font-mono">
                {report.indicators?.momentum?.stochasticK?.toFixed(1)} / {report.indicators?.momentum?.stochasticD?.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <button onClick={() => openIndicatorHelp('macd')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                MACD Histogram <span className="text-accent text-xs">i</span>
              </button>
              <span className={`font-mono ${(report.indicators?.momentum?.macdHistogram || 0) > 0 ? 'text-profit' : 'text-loss'}`}>
                {report.indicators?.momentum?.macdHistogram?.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between">
              <button onClick={() => openIndicatorHelp('mfi')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                MFI <span className="text-accent text-xs">i</span>
              </button>
              <span className="text-text-primary font-mono">{report.indicators?.momentum?.mfi?.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Trend */}
        <div className="bg-surface-1 rounded-xl p-5 border border-border">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Trend</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <button onClick={() => openIndicatorHelp('adx')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                ADX <span className="text-accent text-xs">i</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-text-primary font-mono">{report.indicators?.trend?.adx?.toFixed(1)}</span>
                <SignalBadge signal={report.indicators?.trend?.trendStrength || 'neutral'} />
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={() => openIndicatorHelp('di')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                +DI / -DI <span className="text-accent text-xs">i</span>
              </button>
              <span className="text-text-primary font-mono">
                {report.indicators?.trend?.plusDI?.toFixed(1)} / {report.indicators?.trend?.minusDI?.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <button onClick={() => openIndicatorHelp('ema')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                EMA Alignment <span className="text-accent text-xs">i</span>
              </button>
              <SignalBadge signal={report.indicators?.trend?.emaAlignment || 'mixed'} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Price Location</span>
              <SignalBadge signal={report.indicators?.trend?.priceLocation?.replace(/-/g, ' ') || 'mixed'} />
            </div>
          </div>
        </div>

        {/* Volatility */}
        <div className="bg-surface-1 rounded-xl p-5 border border-border">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Volatility</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <button onClick={() => openIndicatorHelp('atr')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                ATR (14) <span className="text-accent text-xs">i</span>
              </button>
              <span className="text-text-primary font-mono">
                ${report.indicators?.volatility?.atr?.toFixed(2)} ({report.indicators?.volatility?.atrPercent?.toFixed(2)}%)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <button onClick={() => openIndicatorHelp('volatility')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                Volatility Regime <span className="text-accent text-xs">i</span>
              </button>
              <SignalBadge signal={report.indicators?.volatility?.volatilityRegime || 'normal'} />
            </div>
            <div className="flex justify-between">
              <button onClick={() => openIndicatorHelp('bollinger')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                Bollinger %B <span className="text-accent text-xs">i</span>
              </button>
              <span className="text-text-primary font-mono">{(report.indicators?.volatility?.bollingerPercentB * 100)?.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <button onClick={() => openIndicatorHelp('volatility')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                Historical Vol <span className="text-accent text-xs">i</span>
              </button>
              <span className="text-text-primary font-mono">{report.indicators?.volatility?.historicalVolatility?.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Volume */}
        <div className="bg-surface-1 rounded-xl p-5 border border-border">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Volume</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <button onClick={() => openIndicatorHelp('volume-z')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                Volume Z-Score <span className="text-accent text-xs">i</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-text-primary font-mono">{(report.indicators?.volume?.zScore ?? report.indicators?.volume?.volumeZScore)?.toFixed(2)}</span>
                <SignalBadge signal={report.indicators?.volume?.volumeSignal || 'normal'} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <button onClick={() => openIndicatorHelp('obv')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                OBV Trend <span className="text-accent text-xs">i</span>
              </button>
              <SignalBadge signal={report.indicators?.volume?.obvTrend || 'flat'} />
            </div>
            <div className="flex justify-between">
              <button onClick={() => openIndicatorHelp('cmf')} className="text-text-secondary hover:text-accent flex items-center gap-1 transition-colors">
                Chaikin Money Flow <span className="text-accent text-xs">i</span>
              </button>
              <span className={`font-mono ${(report.indicators?.volume?.cmf || 0) > 0 ? 'text-profit' : 'text-loss'}`}>
                {report.indicators?.volume?.cmf?.toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Structure Analysis */}
      {report.structureAnalysis && (
        <div className="bg-surface-1 rounded-xl p-5 border border-border">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Price Action & Structure</h3>

          {/* Classification Badge */}
          <div className="flex items-center gap-4 mb-4">
            <SignalBadge signal={report.structureAnalysis.classification?.replace(/-/g, ' ')} />
            <span className="text-text-secondary">
              Prior Trend: <span className="text-text-primary font-medium capitalize">{report.structureAnalysis.priorTrendDirection}</span>
            </span>
            <span className="text-text-secondary">
              Confidence: <span className="text-text-primary font-medium">{report.structureAnalysis.confidence}%</span>
            </span>
          </div>

          {/* Summary */}
          <p className="text-text-secondary mb-4 leading-relaxed">{report.structureAnalysis.summary}</p>

          {/* Pullback & Reversal Signals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {report.structureAnalysis.pullbackSignals && report.structureAnalysis.pullbackSignals.length > 0 && (
              <div className="bg-surface-2 rounded-lg p-4">
                <h4 className="text-sm font-medium text-profit mb-3">Pullback Confirmation Signals</h4>
                <ul className="space-y-2">
                  {report.structureAnalysis.pullbackSignals.map((signal, i) => (
                    <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                      <span className="text-profit mt-0.5">•</span>
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.structureAnalysis.reversalSignals && report.structureAnalysis.reversalSignals.length > 0 && (
              <div className="bg-surface-2 rounded-lg p-4">
                <h4 className="text-sm font-medium text-loss mb-3">Trend Reversal Signals</h4>
                <ul className="space-y-2">
                  {report.structureAnalysis.reversalSignals.map((signal, i) => (
                    <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                      <span className="text-loss mt-0.5">•</span>
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Detected Candlestick Patterns */}
          {report.structureAnalysis.detectedPatterns && report.structureAnalysis.detectedPatterns.length > 0 && (
            <div className="bg-surface-2 rounded-lg p-4">
              <h4 className="text-sm font-medium text-text-secondary mb-3">Detected Candlestick Patterns</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.structureAnalysis.detectedPatterns.map((pattern, i) => {
                  const isFailed = pattern.outcome === 'failed';
                  const isConfirmed = pattern.outcome === 'confirmed';
                  const iconColor =
                    isFailed ? 'text-text-muted' :
                      isConfirmed && pattern.type === 'bullish' ? 'text-profit' :
                        isConfirmed && pattern.type === 'bearish' ? 'text-loss' :
                          pattern.type === 'bullish' ? 'text-profit' :
                            pattern.type === 'bearish' ? 'text-loss' : 'text-text-muted';

                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${isFailed ? 'bg-surface-3 border-border' :
                        isConfirmed && pattern.type === 'bullish' ? 'bg-profit/10 border-profit/30' :
                          isConfirmed && pattern.type === 'bearish' ? 'bg-loss/10 border-loss/30' :
                            pattern.type === 'bullish' ? 'bg-profit/5 border-profit/20' :
                              pattern.type === 'bearish' ? 'bg-loss/5 border-loss/20' :
                                'bg-surface-2 border-border'
                        } flex items-start gap-2`}
                    >
                      <span className={`text-xs font-bold ${iconColor} flex-shrink-0`}>
                        {isFailed ? '✗' : isConfirmed ? '✓' : pattern.type === 'bullish' ? '▲' : pattern.type === 'bearish' ? '▼' : '◆'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm flex items-center gap-1 flex-wrap">
                          {isFailed && <span className="text-text-muted line-through">{pattern.name}</span>}
                          {isFailed && <span className="text-xs text-text-muted">FAILED</span>}
                          {!isFailed && <span className={iconColor}>{pattern.name}</span>}
                          {isConfirmed && <span className="text-xs opacity-70">✓</span>}
                        </div>
                        <div className="text-xs text-text-muted mt-1">
                          {pattern.location} • {pattern.outcome !== 'active' ? pattern.outcomeDescription : `${pattern.confidence}%`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Structure Status Footer */}
          <div className="mt-4 flex items-center gap-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${report.structureAnalysis.structureIntact ? 'bg-profit' : 'bg-loss'}`}></span>
              <span className="text-sm text-text-muted">
                Structure: <span className={`font-medium ${report.structureAnalysis.structureIntact ? 'text-profit' : 'text-loss'}`}>
                  {report.structureAnalysis.structureIntact ? 'Intact' : 'Broken'}
                </span>
              </span>
            </div>
            <div className="text-sm text-text-muted">|</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">
                Dominant Bias: <span className={`font-medium capitalize ${report.structureAnalysis.dominantBias === 'pullback' ? 'text-profit' :
                  report.structureAnalysis.dominantBias === 'reversal' ? 'text-loss' : 'text-text-secondary'
                  }`}>
                  {report.structureAnalysis.dominantBias}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Recommendation */}
      <div className={`rounded-xl p-5 border ${isAiEnhanced ? 'bg-surface-1 border-accent/20' : 'bg-surface-1 border-border'}`}>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Strategy Recommendation</h3>
        <div className="flex items-center gap-4 mb-4">
          <SignalBadge signal={(recommendation as any)?.action || (recommendation as any)?.direction} />
          <span className="text-text-primary font-medium">{recommendation?.strategy}</span>
          <span className="text-text-muted">Confidence: {recommendation?.confidence}%</span>
        </div>

        {isAiEnhanced && report.aiEnhanced?.recommendation.confidenceReasoning && (
          <p className="text-sm text-accent mb-4 italic">
            "{report.aiEnhanced.recommendation.confidenceReasoning}"
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-surface-2 rounded-lg p-4">
            <div className="text-sm text-text-muted mb-1">Entry ({recommendation?.entry?.type})</div>
            <div className="text-xl font-bold text-text-primary">${recommendation?.entry?.price?.toFixed(2)}</div>
            <ul className="mt-2 space-y-1">
              {recommendation?.entry?.conditions?.map((c: string, i: number) => (
                <li key={i} className="text-xs text-text-muted">{c}</li>
              ))}
            </ul>
          </div>

          <div className="bg-surface-2 rounded-lg p-4">
            <div className="text-sm text-text-muted mb-1">Stop Loss</div>
            <div className="text-xl font-bold text-loss">${recommendation?.stopLoss?.price?.toFixed(2)}</div>
            <div className="text-sm text-text-muted mt-1">
              Risk: {recommendation?.stopLoss?.riskPercent?.toFixed(1)}%
            </div>
            <div className="text-xs text-text-muted mt-1">
              {(recommendation?.stopLoss as any)?.reasoning || (recommendation?.stopLoss as any)?.reason}
            </div>
          </div>

          <div className="bg-surface-2 rounded-lg p-4">
            <div className="text-sm text-text-muted mb-1">Targets</div>
            <div className="space-y-1">
              {['t1', 't2', 't3'].map((tKey) => {
                const target = (recommendation?.targets as any)?.[tKey];
                if (!target) return null;
                
                const entryPrice = recommendation?.entry?.price || 0;
                const stopPrice = recommendation?.stopLoss?.price || 0;
                const targetPrice = target.price || 0;
                const risk = Math.abs(entryPrice - stopPrice);
                const reward = Math.abs(targetPrice - entryPrice);
                const calculatedRR = risk > 0 ? (reward / risk).toFixed(1) : target.rr;
                
                const pctFromEntry = entryPrice > 0 ? ((targetPrice - entryPrice) / entryPrice * 100).toFixed(1) : '0';
                const pctFromCurrent = report.currentPrice > 0 ? ((targetPrice - report.currentPrice) / report.currentPrice * 100).toFixed(1) : '0';
                
                return (
                  <div key={tKey} className="flex flex-col mb-2 last:mb-0">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary uppercase">{tKey}</span>
                      <span className="text-profit font-bold">${targetPrice?.toFixed(2)} ({calculatedRR}:1)</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
                      <span>From Entry: {pctFromEntry}%</span>
                      <span>From Current: {pctFromCurrent}%</span>
                    </div>
                    {target.reasoning && (
                      <div className="text-[10px] text-text-muted leading-tight mt-0.5">
                        {target.reasoning} ({target.probability}%)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-loss/10 border border-loss/30 rounded-lg">
          <span className="text-sm text-loss">{recommendation?.invalidation}</span>
        </div>

        {isAiEnhanced && report.aiEnhanced?.recommendation.keyRisks && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-loss/5 border border-loss/20 rounded-lg p-3">
              <h4 className="text-xs font-bold text-loss uppercase mb-2">Key Risks</h4>
              <ul className="space-y-1">
                {report.aiEnhanced.recommendation.keyRisks.map((risk, i) => (
                  <li key={i} className="text-xs text-text-muted flex items-start gap-1">
                    <span className="text-loss">•</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-profit/5 border border-profit/20 rounded-lg p-3">
              <h4 className="text-xs font-bold text-profit uppercase mb-2">Key Opportunities</h4>
              <ul className="space-y-1">
                {report.aiEnhanced.recommendation.keyOpportunities.map((opp, i) => (
                  <li key={i} className="text-xs text-text-muted flex items-start gap-1">
                    <span className="text-profit">•</span>
                    {opp}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* AI Price Projections */}
      {isAiEnhanced && report.aiEnhanced?.priceProjections && (
        <div className="bg-surface-1 rounded-xl p-5 border border-border">
          <h3 className="text-lg font-semibold text-text-primary mb-4">AI Price Projections</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'bullCase', label: 'Bull Case', color: 'text-profit', border: 'border-profit/30' },
              { key: 'baseCase', label: 'Base Case', color: 'text-accent', border: 'border-accent/30' },
              { key: 'bearCase', label: 'Bear Case', color: 'text-loss', border: 'border-loss/30' }
            ].map((item) => {
              const projection = (report.aiEnhanced?.priceProjections as any)[item.key];
              const isMostLikely = report.aiEnhanced?.priceProjections.mostLikely === item.key.replace('Case', '');

              return (
                <div key={item.key} className={`p-4 rounded-lg border bg-surface-2 ${isMostLikely ? item.border : 'border-border'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm font-bold uppercase ${item.color}`}>{item.label}</span>
                    {isMostLikely && (
                      <span className="bg-accent text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">
                        Most Likely
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-text-primary mb-1">
                    {typeof projection.target === 'string' 
                      ? (projection.target.startsWith('$') ? projection.target : `$${projection.target}`)
                      : `$${projection.target.toFixed(2)}`}
                  </div>
                  <div className="flex justify-between text-xs mb-3">
                    <span className="text-text-muted">Prob: {projection.probability}%</span>
                    <span className="text-text-muted">Time: {projection.timeframe}</span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed italic">
                    "{projection.reasoning}"
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Summary */}
      {report.aiSummary && (
        <div className="bg-surface-1 rounded-xl p-6 border border-border">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span>AI Technical Summary</span>
          </h3>

          {/* Headline */}
          {report.aiSummary.headline && (
            <div className="text-xl font-medium text-accent mb-4">
              {report.aiSummary.headline}
            </div>
          )}

          {/* Technical Outlook */}
          {report.aiSummary.technicalOutlook && (
            <p className="text-base text-text-secondary leading-relaxed mb-6">
              {report.aiSummary.technicalOutlook}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Key Insights */}
            {report.aiSummary.keyInsights && report.aiSummary.keyInsights.length > 0 && (
              <div>
                <h4 className="text-base font-medium text-profit mb-3">Key Insights</h4>
                <ul className="space-y-2">
                  {report.aiSummary.keyInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary leading-relaxed">
                      <span className="text-profit mt-0.5">✓</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risk Factors */}
            {report.aiSummary.riskFactors && report.aiSummary.riskFactors.length > 0 && (
              <div>
                <h4 className="text-base font-medium text-loss mb-3">Risk Factors</h4>
                <ul className="space-y-2">
                  {report.aiSummary.riskFactors.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary leading-relaxed">
                      <span className="text-loss mt-0.5">•</span>
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Trading Plan */}
            {report.aiSummary.tradingPlan && (
              <div>
                <h4 className="text-base font-medium text-accent mb-3">Trading Plan</h4>
                <p className="text-sm text-text-secondary leading-relaxed">{report.aiSummary.tradingPlan}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="text-center text-sm text-text-muted">
        <p>
          Analyzed: {new Date(report.timestamp).toLocaleString()} |
          Timeframe: {report.timeframe} |
          Bars: {report.marketData?.barsAnalyzed}
        </p>
      </div>
      
      {/* Indicator Explanation Modal */}
      <IndicatorExplanationModal
        isOpen={indicatorModalOpen}
        onClose={() => setIndicatorModalOpen(false)}
        section={indicatorSection}
      />
    </div>
  );
}
