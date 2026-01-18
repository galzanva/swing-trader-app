'use client';

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
      zScore?: number;          // Current: used by runTechnicalAnalysis
      volumeZScore?: number;    // Legacy: some saved reports may use this
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
    'overbought': 'bg-red-500/20 text-red-400',
    'bullish': 'bg-emerald-500/20 text-emerald-400',
    'neutral': 'bg-slate-500/20 text-slate-400',
    'bearish': 'bg-orange-500/20 text-orange-400',
    'oversold': 'bg-emerald-500/20 text-emerald-400',
    'strong': 'bg-emerald-500/20 text-emerald-400',
    'moderate': 'bg-blue-500/20 text-blue-400',
    'weak': 'bg-yellow-500/20 text-yellow-400',
    'no trend': 'bg-slate-500/20 text-slate-400',
    'high': 'bg-red-500/20 text-red-400',
    'normal': 'bg-blue-500/20 text-blue-400',
    'low': 'bg-green-500/20 text-green-400',
    'long': 'bg-emerald-500/20 text-emerald-400',
    'short': 'bg-red-500/20 text-red-400',
    'wait': 'bg-yellow-500/20 text-yellow-400',
    'mixed': 'bg-yellow-500/20 text-yellow-400',
    'above all emas': 'bg-emerald-500/20 text-emerald-400',
    'below all emas': 'bg-red-500/20 text-red-400',
    'expanding': 'bg-orange-500/20 text-orange-400',
    'contracting': 'bg-blue-500/20 text-blue-400',
    'rising': 'bg-emerald-500/20 text-emerald-400',
    'falling': 'bg-red-500/20 text-red-400',
    'flat': 'bg-slate-500/20 text-slate-400',
  };

  const classes = colorMap[signal?.toLowerCase()] || 'bg-slate-500/20 text-slate-400';

  return (
    <span className={`${classes} px-2 py-0.5 text-xs rounded-full font-medium capitalize`}>
      {signal}
    </span>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const colorMap: Record<string, string> = {
    'A+': 'bg-emerald-500 text-white',
    'A': 'bg-emerald-600 text-white',
    'B': 'bg-blue-500 text-white',
    'C': 'bg-yellow-500 text-white',
    'D': 'bg-orange-500 text-white',
    'F': 'bg-red-600 text-white',
  };

  return (
    <span className={`${colorMap[grade] || 'bg-slate-500 text-white'} px-3 py-1 rounded-lg text-lg font-bold`}>
      {grade}
    </span>
  );
}

export default function TechnicalAnalysisReportDisplay({ report }: TechnicalAnalysisReportDisplayProps) {
  if (!report) return null;

  // Prioritize AI-enhanced data if available
  const signalStrength = report.aiEnhanced?.signalStrength || report.signalStrength;
  const recommendation = report.aiEnhanced?.recommendation || report.recommendation;
  const isAiEnhanced = !!report.aiEnhanced;

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className={`rounded-xl p-6 border ${isAiEnhanced ? 'bg-indigo-900/10 border-indigo-500/30' : 'bg-white/5 border-white/10'} backdrop-blur-lg`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{report.symbol}</h2>
              {report.marketData?.name && (
                <span className="text-slate-400">{report.marketData.name}</span>
              )}
              {isAiEnhanced && (
                <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider border border-indigo-500/30">
                  AI Enhanced
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-3xl font-bold text-white">${report.currentPrice?.toFixed(2)}</span>
              <SignalBadge signal={signalStrength?.direction} />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">Grade</div>
              <GradeBadge grade={signalStrength?.grade} />
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">Strength</div>
              <div className="text-2xl font-bold text-white">{signalStrength?.overall}/100</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">Direction</div>
              <SignalBadge signal={(recommendation as any)?.action || (recommendation as any)?.direction} />
            </div>
          </div>
        </div>

        {/* AI Reasoning for Signal Strength */}
        {isAiEnhanced && report.aiEnhanced?.signalStrength.reasoning && (
          <div className="mt-6 pt-6 border-t border-indigo-500/20">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">AI Analysis Reasoning</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              {report.aiEnhanced.signalStrength.reasoning.map((reason, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-indigo-400 mt-1">•</span>
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
          <div key={key} className={`rounded-xl p-4 border backdrop-blur-lg ${isAiEnhanced ? 'bg-indigo-900/5 border-indigo-500/20' : 'bg-white/5 border-white/10'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-300 capitalize">{key}</span>
              <span className="text-xl font-bold text-white">{data.score}</span>
            </div>
            <div className="text-xs text-slate-400 mb-1">
              {data.signal || (data as any).assessment}
            </div>
          </div>
        ))}
      </div>

      {/* Key Indicators Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Momentum */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">⚡ Momentum</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-300">RSI (14)</span>
              <span className="text-white font-mono">{report.indicators?.momentum?.rsi?.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Stochastic %K / %D</span>
              <span className="text-white font-mono">
                {report.indicators?.momentum?.stochasticK?.toFixed(1)} / {report.indicators?.momentum?.stochasticD?.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">MACD Histogram</span>
              <span className={`font-mono ${(report.indicators?.momentum?.macdHistogram || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {report.indicators?.momentum?.macdHistogram?.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">MFI</span>
              <span className="text-white font-mono">{report.indicators?.momentum?.mfi?.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Trend */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">📈 Trend</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">ADX</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono">{report.indicators?.trend?.adx?.toFixed(1)}</span>
                <SignalBadge signal={report.indicators?.trend?.trendStrength || 'neutral'} />
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">+DI / -DI</span>
              <span className="text-white font-mono">
                {report.indicators?.trend?.plusDI?.toFixed(1)} / {report.indicators?.trend?.minusDI?.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">EMA Alignment</span>
              <SignalBadge signal={report.indicators?.trend?.emaAlignment || 'mixed'} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Price Location</span>
              <SignalBadge signal={report.indicators?.trend?.priceLocation?.replace(/-/g, ' ') || 'mixed'} />
            </div>
          </div>
        </div>

        {/* Volatility */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">📉 Volatility</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-300">ATR (14)</span>
              <span className="text-white font-mono">
                ${report.indicators?.volatility?.atr?.toFixed(2)} ({report.indicators?.volatility?.atrPercent?.toFixed(2)}%)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Volatility Regime</span>
              <SignalBadge signal={report.indicators?.volatility?.volatilityRegime || 'normal'} />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Bollinger %B</span>
              <span className="text-white font-mono">{(report.indicators?.volatility?.bollingerPercentB * 100)?.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Historical Vol</span>
              <span className="text-white font-mono">{report.indicators?.volatility?.historicalVolatility?.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Volume */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">📊 Volume</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Volume Z-Score</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono">{(report.indicators?.volume?.zScore ?? report.indicators?.volume?.volumeZScore)?.toFixed(2)}</span>
                <SignalBadge signal={report.indicators?.volume?.volumeSignal || 'normal'} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">OBV Trend</span>
              <SignalBadge signal={report.indicators?.volume?.obvTrend || 'flat'} />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Chaikin Money Flow</span>
              <span className={`font-mono ${(report.indicators?.volume?.cmf || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {report.indicators?.volume?.cmf?.toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Structure Analysis */}
      {report.structureAnalysis && (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">📐 Price Action & Structure</h3>

          {/* Classification Badge */}
          <div className="flex items-center gap-4 mb-4">
            <SignalBadge signal={report.structureAnalysis.classification?.replace(/-/g, ' ')} />
            <span className="text-slate-300">
              Prior Trend: <span className="text-white font-medium capitalize">{report.structureAnalysis.priorTrendDirection}</span>
            </span>
            <span className="text-slate-300">
              Confidence: <span className="text-white font-medium">{report.structureAnalysis.confidence}%</span>
            </span>
          </div>

          {/* Summary */}
          <p className="text-slate-300 mb-4 leading-relaxed">{report.structureAnalysis.summary}</p>

          {/* Pullback & Reversal Signals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {report.structureAnalysis.pullbackSignals && report.structureAnalysis.pullbackSignals.length > 0 && (
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-sm font-medium text-emerald-400 mb-3">✓ Pullback Confirmation Signals</h4>
                <ul className="space-y-2">
                  {report.structureAnalysis.pullbackSignals.map((signal, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.structureAnalysis.reversalSignals && report.structureAnalysis.reversalSignals.length > 0 && (
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-sm font-medium text-orange-400 mb-3">⚠ Trend Reversal Signals</h4>
                <ul className="space-y-2">
                  {report.structureAnalysis.reversalSignals.map((signal, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className="text-orange-400 mt-0.5">•</span>
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Detected Candlestick Patterns */}
          {report.structureAnalysis.detectedPatterns && report.structureAnalysis.detectedPatterns.length > 0 && (
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-400 mb-3">🕯️ Detected Candlestick Patterns</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.structureAnalysis.detectedPatterns.map((pattern, i) => {
                  const isFailed = pattern.outcome === 'failed';
                  const isConfirmed = pattern.outcome === 'confirmed';
                  const iconColor =
                    isFailed ? 'text-slate-500' :
                      isConfirmed && pattern.type === 'bullish' ? 'text-emerald-400' :
                        isConfirmed && pattern.type === 'bearish' ? 'text-red-400' :
                          pattern.type === 'bullish' ? 'text-emerald-300' :
                            pattern.type === 'bearish' ? 'text-red-300' : 'text-slate-400';

                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${isFailed ? 'bg-slate-800/30 border-slate-700/50' :
                        isConfirmed && pattern.type === 'bullish' ? 'bg-emerald-500/10 border-emerald-500/30' :
                          isConfirmed && pattern.type === 'bearish' ? 'bg-red-500/10 border-red-500/30' :
                            pattern.type === 'bullish' ? 'bg-emerald-500/5 border-emerald-500/20' :
                              pattern.type === 'bearish' ? 'bg-red-500/5 border-red-500/20' :
                                'bg-white/5 border-white/10'
                        } flex items-start gap-2`}
                    >
                      <span className={`text-xs font-bold ${iconColor} flex-shrink-0`}>
                        {isFailed ? '✗' : isConfirmed ? '✓' : pattern.type === 'bullish' ? '▲' : pattern.type === 'bearish' ? '▼' : '◆'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm flex items-center gap-1 flex-wrap">
                          {isFailed && <span className="text-slate-400 line-through">{pattern.name}</span>}
                          {isFailed && <span className="text-xs text-slate-500">FAILED</span>}
                          {!isFailed && <span className={iconColor}>{pattern.name}</span>}
                          {isConfirmed && <span className="text-xs opacity-70">✓</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
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
          <div className="mt-4 flex items-center gap-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${report.structureAnalysis.structureIntact ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
              <span className="text-sm text-slate-400">
                Structure: <span className={`font-medium ${report.structureAnalysis.structureIntact ? 'text-emerald-400' : 'text-red-400'}`}>
                  {report.structureAnalysis.structureIntact ? 'Intact' : 'Broken'}
                </span>
              </span>
            </div>
            <div className="text-sm text-slate-500">|</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">
                Dominant Bias: <span className={`font-medium capitalize ${report.structureAnalysis.dominantBias === 'pullback' ? 'text-emerald-400' :
                  report.structureAnalysis.dominantBias === 'reversal' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                  {report.structureAnalysis.dominantBias}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Recommendation */}
      <div className={`rounded-xl p-5 border backdrop-blur-lg ${isAiEnhanced ? 'bg-indigo-900/5 border-indigo-500/20' : 'bg-white/5 border-white/10'}`}>
        <h3 className="text-lg font-semibold text-white mb-4">🎲 Strategy Recommendation</h3>
        <div className="flex items-center gap-4 mb-4">
          <SignalBadge signal={(recommendation as any)?.action || (recommendation as any)?.direction} />
          <span className="text-white font-medium">{recommendation?.strategy}</span>
          <span className="text-slate-400">Confidence: {recommendation?.confidence}%</span>
        </div>

        {isAiEnhanced && report.aiEnhanced?.recommendation.confidenceReasoning && (
          <p className="text-sm text-indigo-300 mb-4 italic">
            "{report.aiEnhanced.recommendation.confidenceReasoning}"
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Entry ({recommendation?.entry?.type})</div>
            <div className="text-xl font-bold text-white">${recommendation?.entry?.price?.toFixed(2)}</div>
            <ul className="mt-2 space-y-1">
              {recommendation?.entry?.conditions?.map((c: string, i: number) => (
                <li key={i} className="text-xs text-slate-400">{c}</li>
              ))}
            </ul>
          </div>

          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Stop Loss</div>
            <div className="text-xl font-bold text-red-400">${recommendation?.stopLoss?.price?.toFixed(2)}</div>
            <div className="text-sm text-slate-400 mt-1">
              Risk: {recommendation?.stopLoss?.riskPercent?.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {(recommendation?.stopLoss as any)?.reasoning || (recommendation?.stopLoss as any)?.reason}
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Targets</div>
            <div className="space-y-1">
              {['t1', 't2', 't3'].map((tKey) => {
                const target = (recommendation?.targets as any)?.[tKey];
                if (!target) return null;
                
                // Calculate R:R correctly from entry, stop, and target
                const entryPrice = recommendation?.entry?.price || 0;
                const stopPrice = recommendation?.stopLoss?.price || 0;
                const targetPrice = target.price || 0;
                const risk = Math.abs(entryPrice - stopPrice);
                const reward = Math.abs(targetPrice - entryPrice);
                const calculatedRR = risk > 0 ? (reward / risk).toFixed(1) : target.rr;
                
                // Calculate % moves
                const pctFromEntry = entryPrice > 0 ? ((targetPrice - entryPrice) / entryPrice * 100).toFixed(1) : '0';
                const pctFromCurrent = report.currentPrice > 0 ? ((targetPrice - report.currentPrice) / report.currentPrice * 100).toFixed(1) : '0';
                
                return (
                  <div key={tKey} className="flex flex-col mb-2 last:mb-0">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300 uppercase">{tKey}</span>
                      <span className="text-emerald-400 font-bold">${targetPrice?.toFixed(2)} ({calculatedRR}:1)</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                      <span>From Entry: {pctFromEntry}%</span>
                      <span>From Current: {pctFromCurrent}%</span>
                    </div>
                    {target.reasoning && (
                      <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                        {target.reasoning} ({target.probability}%)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <span className="text-sm text-red-300">{recommendation?.invalidation}</span>
        </div>

        {isAiEnhanced && report.aiEnhanced?.recommendation.keyRisks && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
              <h4 className="text-xs font-bold text-red-400 uppercase mb-2">Key Risks</h4>
              <ul className="space-y-1">
                {report.aiEnhanced.recommendation.keyRisks.map((risk, i) => (
                  <li key={i} className="text-xs text-slate-400 flex items-start gap-1">
                    <span className="text-red-400">•</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
              <h4 className="text-xs font-bold text-emerald-400 uppercase mb-2">Key Opportunities</h4>
              <ul className="space-y-1">
                {report.aiEnhanced.recommendation.keyOpportunities.map((opp, i) => (
                  <li key={i} className="text-xs text-slate-400 flex items-start gap-1">
                    <span className="text-emerald-400">•</span>
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
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">🎯 AI Price Projections</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'bullCase', label: 'Bull Case', color: 'text-emerald-400', border: 'border-emerald-500/30' },
              { key: 'baseCase', label: 'Base Case', color: 'text-blue-400', border: 'border-blue-500/30' },
              { key: 'bearCase', label: 'Bear Case', color: 'text-red-400', border: 'border-red-500/30' }
            ].map((item) => {
              const projection = (report.aiEnhanced?.priceProjections as any)[item.key];
              const isMostLikely = report.aiEnhanced?.priceProjections.mostLikely === item.key.replace('Case', '');

              return (
                <div key={item.key} className={`p-4 rounded-lg border bg-white/5 ${isMostLikely ? item.border : 'border-white/5'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm font-bold uppercase ${item.color}`}>{item.label}</span>
                    {isMostLikely && (
                      <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">
                        Most Likely
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {typeof projection.target === 'string' 
                      ? (projection.target.startsWith('$') ? projection.target : `$${projection.target}`)
                      : `$${projection.target.toFixed(2)}`}
                  </div>
                  <div className="flex justify-between text-xs mb-3">
                    <span className="text-slate-400">Prob: {projection.probability}%</span>
                    <span className="text-slate-400">Time: {projection.timeframe}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed italic">
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
        <div className="bg-gradient-to-r from-violet-900/20 to-indigo-900/10 backdrop-blur-lg rounded-xl p-6 border border-violet-500/20">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <span>AI Technical Summary</span>
          </h3>

          {/* Headline */}
          {report.aiSummary.headline && (
            <div className="text-xl font-medium text-indigo-300 mb-4">
              {report.aiSummary.headline}
            </div>
          )}

          {/* Technical Outlook */}
          {report.aiSummary.technicalOutlook && (
            <p className="text-base text-slate-300 leading-relaxed mb-6">
              {report.aiSummary.technicalOutlook}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Key Insights */}
            {report.aiSummary.keyInsights && report.aiSummary.keyInsights.length > 0 && (
              <div>
                <h4 className="text-base font-medium text-emerald-400 mb-3">Key Insights</h4>
                <ul className="space-y-2">
                  {report.aiSummary.keyInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
                      <span className="text-emerald-400 mt-0.5">✓</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risk Factors */}
            {report.aiSummary.riskFactors && report.aiSummary.riskFactors.length > 0 && (
              <div>
                <h4 className="text-base font-medium text-red-400 mb-3">Risk Factors</h4>
                <ul className="space-y-2">
                  {report.aiSummary.riskFactors.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
                      <span className="text-red-400 mt-0.5">⚠</span>
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Trading Plan */}
            {report.aiSummary.tradingPlan && (
              <div>
                <h4 className="text-base font-medium text-indigo-400 mb-3">Trading Plan</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{report.aiSummary.tradingPlan}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="text-center text-sm text-slate-500">
        <p>
          Analyzed: {new Date(report.timestamp).toLocaleString()} |
          Timeframe: {report.timeframe} |
          Bars: {report.marketData?.barsAnalyzed}
        </p>
      </div>
    </div>
  );
}

