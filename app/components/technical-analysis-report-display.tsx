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
      volumeZScore: number;
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

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{report.symbol}</h2>
              {report.marketData?.name && (
                <span className="text-slate-400">{report.marketData.name}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-3xl font-bold text-white">${report.currentPrice?.toFixed(2)}</span>
              <SignalBadge signal={report.signalStrength?.direction} />
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">Grade</div>
              <GradeBadge grade={report.signalStrength?.grade} />
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">Strength</div>
              <div className="text-2xl font-bold text-white">{report.signalStrength?.overall}/100</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">Direction</div>
              <SignalBadge signal={report.recommendation?.direction} />
            </div>
          </div>
        </div>
      </div>
      
      {/* Signal Breakdown */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(report.signalStrength?.breakdown || {}).map(([key, data]: [string, any]) => (
          <div key={key} className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-300 capitalize">{key}</span>
              <span className="text-xl font-bold text-white">{data.score}</span>
            </div>
            <SignalBadge signal={data.signal} />
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
                <span className="text-white font-mono">{report.indicators?.volume?.volumeZScore?.toFixed(2)}</span>
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
                      className={`p-3 rounded-lg border ${
                        isFailed ? 'bg-slate-800/30 border-slate-700/50' :
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
                Dominant Bias: <span className={`font-medium capitalize ${
                  report.structureAnalysis.dominantBias === 'pullback' ? 'text-emerald-400' :
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
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">🎲 Strategy Recommendation</h3>
        <div className="flex items-center gap-4 mb-4">
          <SignalBadge signal={report.recommendation?.direction} />
          <span className="text-white font-medium">{report.recommendation?.strategy}</span>
          <span className="text-slate-400">Confidence: {report.recommendation?.confidence}%</span>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Entry ({report.recommendation?.entry?.type})</div>
            <div className="text-xl font-bold text-white">${report.recommendation?.entry?.price?.toFixed(2)}</div>
            <ul className="mt-2 space-y-1">
              {report.recommendation?.entry?.conditions?.map((c, i) => (
                <li key={i} className="text-xs text-slate-400">{c}</li>
              ))}
            </ul>
          </div>
          
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Stop Loss</div>
            <div className="text-xl font-bold text-red-400">${report.recommendation?.stopLoss?.price?.toFixed(2)}</div>
            <div className="text-sm text-slate-400 mt-1">
              Risk: {report.recommendation?.stopLoss?.riskPercent?.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500 mt-1">{report.recommendation?.stopLoss?.reason}</div>
          </div>
          
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Targets</div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">T1</span>
                <span className="text-emerald-400">${report.recommendation?.targets?.t1?.price?.toFixed(2)} ({report.recommendation?.targets?.t1?.rr}:1)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">T2</span>
                <span className="text-emerald-400">${report.recommendation?.targets?.t2?.price?.toFixed(2)} ({report.recommendation?.targets?.t2?.rr}:1)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">T3</span>
                <span className="text-emerald-400">${report.recommendation?.targets?.t3?.price?.toFixed(2)} ({report.recommendation?.targets?.t3?.rr}:1)</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <span className="text-sm text-red-300">{report.recommendation?.invalidation}</span>
        </div>
      </div>
      
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

