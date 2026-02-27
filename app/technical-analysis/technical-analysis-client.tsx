"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TechnicalAnalysisReport } from "@/lib/technical-analysis";
import IndicatorExplanationModal, { IndicatorSection } from "@/app/components/indicator-explanation-modal";

interface ExtendedReport extends TechnicalAnalysisReport {
  marketData: {
    name: string;
    exchange?: string;
    marketCap?: number;
    lastBarDate: string;
    dataAgeDays: number;
    barsAnalyzed: number;
  };
  aiEnhanced?: {
    signalStrength: {
      overall: number;
      grade: string;
      direction: string;
      reasoning: string[];
      breakdown: {
        trend: { score: number; signal: string };
        momentum: { score: number; signal: string };
        volume: { score: number; signal: string };
        volatility: { score: number; signal: string };
        pattern: { score: number; signal: string };
      };
    };
    structureAnalysis?: {
      classification: 'likely-pullback' | 'trend-reversal-risk' | 'consolidation' | 'breakout-attempt' | 'mixed';
      confidence: number;
      priorTrend: 'up' | 'down' | 'sideways';
      summary: string;
      pullbackSignals: string[];
      reversalSignals: string[];
      patternAnalysis: string;
      structureIntact: boolean;
    };
    priceProjections: {
      bullCase: { target: number | string; targetLow?: number; targetHigh?: number; probability: number; timeframe: string; reasoning: string };
      baseCase: { target: number | string; targetLow?: number; targetHigh?: number; probability: number; timeframe: string; reasoning: string };
      bearCase: { target: number | string; targetLow?: number; targetHigh?: number; probability: number; timeframe: string; reasoning: string };
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
  aiSummary?: {
    headline: string;
    technicalOutlook: string;
    keyInsights: string[];
    riskFactors: string[];
    tradingPlan: string;
    confidenceLevel: 'high' | 'medium' | 'low';
  };
  analysisMode?: 'ai-enhanced' | 'technical-only';
}

function Gauge({ 
  value, 
  min = 0, 
  max = 100, 
  colorScheme = 'default' 
}: { 
  value: number; 
  min?: number; 
  max?: number; 
  colorScheme?: 'default' | 'rsi' | 'signal' | 'momentum';
}) {
  const percentage = ((value - min) / (max - min)) * 100;
  
  let colorClass = '';
  if (colorScheme === 'rsi') {
    colorClass = value > 70 ? 'bg-red-500' : value > 50 ? 'bg-green-500' : value > 30 ? 'bg-yellow-500' : 'bg-green-500';
  } else if (colorScheme === 'signal') {
    colorClass = value >= 70 ? 'bg-emerald-500' : value >= 50 ? 'bg-blue-500' : value >= 30 ? 'bg-yellow-500' : 'bg-red-500';
  } else if (colorScheme === 'momentum') {
    colorClass = value > 0 ? 'bg-emerald-500' : 'bg-red-500';
  } else {
    colorClass = 'bg-blue-500';
  }
  
  return (
    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
      <div 
        className={`h-full ${colorClass} transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
    </div>
  );
}

function SignalBadge({ signal, size = 'md' }: { signal: string; size?: 'sm' | 'md' | 'lg' }) {
  const colorMap: Record<string, string> = {
    'overbought': 'bg-red-500/20 text-red-400 border-red-500/30',
    'bullish': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'neutral': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    'bearish': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'oversold': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'strong': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'moderate': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'weak': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'no-trend': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    'high': 'bg-red-500/20 text-red-400 border-red-500/30',
    'normal': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'low': 'bg-green-500/20 text-green-400 border-green-500/30',
    'expanding': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'contracting': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'rising': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'falling': 'bg-red-500/20 text-red-400 border-red-500/30',
    'flat': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  
  const classes = colorMap[signal.toLowerCase()] || colorMap['neutral'];
  const sizeClasses = size === 'lg' ? 'px-3 py-1 text-sm' : size === 'md' ? 'px-2.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs';
  
  return (
    <span className={`${classes} ${sizeClasses} border rounded-full font-medium capitalize whitespace-nowrap`}>
      {signal}
    </span>
  );
}

function DirectionIndicator({ direction, size = 'md' }: { direction: 'bullish' | 'bearish' | 'neutral'; size?: 'sm' | 'md' | 'lg' }) {
  const colors = {
    bullish: 'bg-emerald-500 text-white',
    bearish: 'bg-red-500 text-white',
    neutral: 'bg-slate-500 text-white'
  };
  
  const sizes = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-base',
    lg: 'w-10 h-10 text-xl'
  };
  
  const icons = {
    bullish: '↑',
    bearish: '↓',
    neutral: '→'
  };
  
  return (
    <div className={`${colors[direction]} ${sizes[size]} rounded-full flex items-center justify-center font-bold`}>
      {icons[direction]}
    </div>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const colorMap: Record<string, string> = {
    'A+': 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/30',
    'A': 'bg-gradient-to-r from-emerald-600 to-green-500 text-white shadow-green-500/30',
    'B': 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-blue-500/30',
    'C': 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-yellow-500/30',
    'D': 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-orange-500/30',
    'F': 'bg-gradient-to-r from-red-600 to-red-800 text-white shadow-red-500/30',
  };
  
  return (
    <div className={`${colorMap[grade] || colorMap['C']} px-4 py-2 rounded-lg text-2xl font-black shadow-lg`}>
      {grade}
    </div>
  );
}

function IndicatorRow({ label, value, signal, valueColor, onHelpClick }: { 
  label: string; 
  value: string | number; 
  signal?: string;
  valueColor?: string;
  onHelpClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-slate-300">{label}</span>
        {onHelpClick && (
          <button
            onClick={onHelpClick}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 hover:text-blue-100 transition-all"
            title={`Learn about ${label}`}
          >
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-mono text-base ${valueColor || 'text-white'}`}>
          {typeof value === 'number' ? value.toFixed(2) : value}
        </span>
        {signal && <SignalBadge signal={signal} />}
      </div>
    </div>
  );
}

export default function TechnicalAnalysisClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("1day");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ExtendedReport | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  
  const [indicatorModalOpen, setIndicatorModalOpen] = useState(false);
  const [indicatorSection, setIndicatorSection] = useState<IndicatorSection>('all');
  
  const [isAiEvaluating, setIsAiEvaluating] = useState(false);
  const [aiError, setAiError] = useState("");
  
  const openIndicatorHelp = (section: IndicatorSection) => {
    setIndicatorSection(section);
    setIndicatorModalOpen(true);
  };

  useEffect(() => {
    const urlSymbol = searchParams.get('symbol');
    if (urlSymbol) {
      setSymbol(urlSymbol.toUpperCase());
      setTimeout(() => {
        handleAnalyzeWithSymbol(urlSymbol.toUpperCase());
      }, 100);
    }
  }, [searchParams]);
  
  const handleSaveReport = async () => {
    if (!report) return;
    
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    
    const signalDirection = report.aiEnhanced?.signalStrength?.direction || report.signalStrength.direction;
    const signalGrade = report.aiEnhanced?.signalStrength?.grade || report.signalStrength.grade;
    const strategy = report.aiEnhanced?.recommendation?.strategy || report.recommendation.strategy;
    const recDirection = report.aiEnhanced?.recommendation?.action?.toLowerCase() || report.recommendation.direction;
    
    try {
      const response = await fetch("/api/reports/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "technical-analysis",
          title: `${report.symbol} Technical Analysis`,
          description: `${signalDirection.toUpperCase()} signal (${signalGrade}) - ${strategy}`,
          parameters: {
            symbol: report.symbol,
            timeframe: report.timeframe,
            analyzedAt: report.timestamp,
            aiEnhanced: !!report.aiEnhanced,
          },
          reportData: report,
          tags: [
            "technical-analysis",
            report.symbol,
            signalDirection,
            recDirection,
            report.timeframe,
            ...(report.aiEnhanced ? ["ai-enhanced"] : []),
          ],
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to save report");
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyzeWithSymbol = async (symbolToAnalyze: string) => {
    if (!symbolToAnalyze.trim()) {
      setError("Please enter a ticker symbol");
      return;
    }

    setIsLoading(true);
    setError("");
    setReport(null);
    setAiError("");

    try {
      const response = await fetch("/api/technical-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: symbolToAnalyze.toUpperCase(), timeframe })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Analysis failed");
      }

      setReport(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    await handleAnalyzeWithSymbol(symbol);
  };

  const handleAiEvaluate = async () => {
    if (!report) return;
    setIsAiEvaluating(true);
    setAiError("");
    
    try {
      const response = await fetch("/api/technical-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          symbol: report.symbol, 
          timeframe: report.timeframe,
          aiEvaluate: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "AI evaluation failed");
      }

      setReport(data);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setIsAiEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="text-4xl">📊</div>
        <div>
          <h1 className="text-3xl font-bold text-white">Technical Analysis</h1>
          <p className="text-blue-200 mt-1">
            Pure technical indicator and pattern analysis
          </p>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-blue-100 mb-2">
              Ticker Symbol
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL, TSLA, SPY"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-lg placeholder-blue-200/50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent uppercase font-mono"
              disabled={isLoading}
              onKeyPress={(e) => e.key === "Enter" && handleAnalyze()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-100 mb-2">
              Timeframe
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-lg focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              disabled={isLoading}
            >
              <option value="1day">Daily</option>
              <option value="1hour">1 Hour</option>
              <option value="15min">15 Min</option>
              <option value="5min">5 Min</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className="w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white text-lg font-semibold rounded-xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Analyzing...
                </span>
              ) : (
                "Analyze"
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
          <div className="inline-block w-16 h-16 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mb-4"></div>
          <p className="text-white text-xl">Analyzing {symbol}...</p>
          <p className="text-blue-200 mt-2">
            Calculating indicators, detecting patterns, analyzing structure...
          </p>
        </div>
      )}

      {/* ==================== REPORT ==================== */}
      {report && !isLoading && (
        <div className="space-y-6">
          
          {/* ==================== HEADER ==================== */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white">{report.symbol}</h2>
                  <span className="text-slate-400">{report.marketData.name}</span>
                  <span className="bg-slate-600/30 text-slate-300 px-2 py-0.5 text-xs rounded-full font-mono">{report.timeframe}</span>
                  {report.aiEnhanced && (
                    <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider border border-indigo-500/30">
                      AI Evaluated
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-3xl font-bold text-white">${report.currentPrice.toFixed(2)}</span>
                </div>
              </div>
              
              <div>
                <button
                  onClick={handleSaveReport}
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${
                    saveSuccess 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <span>✓</span>
                      Saved!
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      Save Report
                    </>
                  )}
                </button>
                {saveError && (
                  <p className="text-xs text-red-400 mt-1">{saveError}</p>
                )}
              </div>
            </div>
          </div>

          {/* ==================== TECHNICAL INDICATORS ==================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column: Momentum & Trend */}
            <div className="space-y-6">
              
              {/* Momentum Indicators */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">⚡</span> Momentum Indicators
                </h3>
                
                <div className="space-y-1 divide-y divide-white/10">
                  <IndicatorRow 
                    label="RSI (14)" 
                    value={report.indicators.momentum.rsi.toFixed(1)} 
                    signal={report.indicators.momentum.rsiSignal}
                    onHelpClick={() => openIndicatorHelp('rsi')}
                  />
                  <IndicatorRow 
                    label="Stochastic %K / %D" 
                    value={`${report.indicators.momentum.stochasticK.toFixed(1)} / ${report.indicators.momentum.stochasticD.toFixed(1)}`} 
                    signal={report.indicators.momentum.stochSignal}
                    onHelpClick={() => openIndicatorHelp('stochastic')}
                  />
                  <IndicatorRow 
                    label="MACD Line" 
                    value={report.indicators.momentum.macdLine.toFixed(4)} 
                    valueColor={report.indicators.momentum.macdHistogram > 0 ? 'text-emerald-400' : 'text-red-400'}
                    onHelpClick={() => openIndicatorHelp('macd')}
                  />
                  <IndicatorRow 
                    label="MACD Histogram" 
                    value={report.indicators.momentum.macdHistogram.toFixed(4)} 
                    valueColor={report.indicators.momentum.macdHistogram > 0 ? 'text-emerald-400' : 'text-red-400'}
                    onHelpClick={() => openIndicatorHelp('macd')}
                  />
                  <IndicatorRow 
                    label="Williams %R" 
                    value={report.indicators.momentum.williamsR.toFixed(1)} 
                    onHelpClick={() => openIndicatorHelp('williams-r')}
                  />
                  <IndicatorRow 
                    label="CCI" 
                    value={report.indicators.momentum.cci.toFixed(1)} 
                    valueColor={report.indicators.momentum.cci > 100 ? 'text-red-400' : report.indicators.momentum.cci < -100 ? 'text-emerald-400' : 'text-white'}
                    onHelpClick={() => openIndicatorHelp('cci')}
                  />
                  <IndicatorRow 
                    label="Money Flow Index" 
                    value={report.indicators.momentum.mfi.toFixed(1)} 
                    onHelpClick={() => openIndicatorHelp('mfi')}
                  />
                </div>
              </div>

              {/* Trend Analysis */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">📈</span> Trend Analysis
                </h3>
                
                <div className="space-y-1 divide-y divide-white/10">
                  <IndicatorRow 
                    label="ADX (Trend Strength)" 
                    value={report.indicators.trend.adx.toFixed(1)} 
                    signal={report.indicators.trend.trendStrength}
                    onHelpClick={() => openIndicatorHelp('adx')}
                  />
                  <IndicatorRow 
                    label="+DI (Buyers)" 
                    value={report.indicators.trend.plusDI.toFixed(1)} 
                    valueColor="text-emerald-400"
                    onHelpClick={() => openIndicatorHelp('di')}
                  />
                  <IndicatorRow 
                    label="-DI (Sellers)" 
                    value={report.indicators.trend.minusDI.toFixed(1)} 
                    valueColor="text-red-400"
                    onHelpClick={() => openIndicatorHelp('di')}
                  />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-slate-300">EMA Alignment</span>
                      <button
                        onClick={() => openIndicatorHelp('ema')}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 hover:text-blue-100 transition-all"
                        title="Learn about EMA Alignment"
                      >
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <SignalBadge signal={report.assessments.trend.emaAlignment} size="lg" />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-300">Price Location</span>
                    <span className="text-base text-white">{report.assessments.trend.priceLocation}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Volume, Volatility, Squeeze */}
            <div className="space-y-6">
              
              {/* Volume Analysis */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">📊</span> Volume Analysis
                </h3>
                
                <div className="space-y-1 divide-y divide-white/10">
                  <IndicatorRow 
                    label="Volume Z-Score" 
                    value={report.indicators.volume.zScore.toFixed(2)} 
                    signal={report.indicators.volume.volumeSignal}
                    valueColor={report.indicators.volume.zScore > 1 ? 'text-emerald-400' : report.indicators.volume.zScore < -1 ? 'text-red-400' : 'text-white'}
                    onHelpClick={() => openIndicatorHelp('volume-z')}
                  />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-slate-300">OBV Trend</span>
                      <button
                        onClick={() => openIndicatorHelp('obv')}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 hover:text-blue-100 transition-all"
                        title="Learn about OBV"
                      >
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <SignalBadge signal={report.indicators.volume.obvTrend} size="lg" />
                  </div>
                  <IndicatorRow 
                    label="Chaikin Money Flow" 
                    value={report.indicators.volume.cmf.toFixed(3)} 
                    valueColor={report.indicators.volume.cmf > 0 ? 'text-emerald-400' : 'text-red-400'}
                    onHelpClick={() => openIndicatorHelp('cmf')}
                  />
                </div>
              </div>

              {/* Volatility */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">📉</span> Volatility
                </h3>
                
                <div className="space-y-1 divide-y divide-white/10">
                  <IndicatorRow 
                    label="ATR (14)" 
                    value={`$${report.indicators.volatility.atr.toFixed(2)} (${report.indicators.volatility.atrPercent.toFixed(2)}%)`}
                    onHelpClick={() => openIndicatorHelp('atr')}
                  />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-slate-300">Volatility Regime</span>
                      <button
                        onClick={() => openIndicatorHelp('volatility')}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 hover:text-blue-100 transition-all"
                        title="Learn about Volatility Regime"
                      >
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <SignalBadge signal={report.assessments.volatility.regime} size="lg" />
                  </div>
                  <IndicatorRow 
                    label="Bollinger %B" 
                    value={`${(report.indicators.volatility.bollingerPercentB * 100).toFixed(1)}%`}
                    onHelpClick={() => openIndicatorHelp('bollinger')}
                  />
                  <IndicatorRow 
                    label="Bollinger Bandwidth" 
                    value={`${report.indicators.volatility.bollingerBandwidth.toFixed(2)}%`}
                    onHelpClick={() => openIndicatorHelp('bollinger')}
                  />
                  <IndicatorRow 
                    label="Historical Volatility" 
                    value={`${report.indicators.volatility.historicalVolatility.toFixed(1)}%`}
                    onHelpClick={() => openIndicatorHelp('volatility')}
                  />
                </div>
              </div>

              {/* TTM Squeeze */}
              <div className={`rounded-2xl p-6 border ${
                report.squeeze.isInSqueeze 
                  ? 'bg-orange-500/10 border-orange-500/30' 
                  : 'bg-white/10 border-white/20'
              }`}>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🔥</span> TTM Squeeze
                  <button
                    onClick={() => openIndicatorHelp('squeeze')}
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 hover:text-blue-100 transition-all ml-1"
                    title="Learn about TTM Squeeze"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                </h3>
                
                <div className="flex items-center justify-between mb-4">
                  <span className="text-base text-slate-300">Squeeze Status</span>
                  <div className={`px-4 py-2 rounded-lg text-base font-semibold ${
                    report.squeeze.isInSqueeze 
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                      : 'bg-slate-600/20 text-slate-400 border border-slate-500/30'
                  }`}>
                    {report.squeeze.isInSqueeze ? `ON — ${report.squeeze.squeezeDuration} bars` : 'OFF'}
                  </div>
                </div>
                
                {report.squeeze.isInSqueeze && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Momentum Direction</span>
                    <SignalBadge signal={report.squeeze.momentumDirection} size="lg" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ==================== MOVING AVERAGES ==================== */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-xl">🎗️</span> Moving Averages
              <button
                onClick={() => openIndicatorHelp('ema')}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 hover:text-blue-100 transition-all ml-1"
                title="Learn about Moving Averages"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </button>
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'EMA 9', value: report.indicators.movingAverages.ema9 },
                { label: 'EMA 20', value: report.indicators.movingAverages.ema20 },
                { label: 'EMA 50', value: report.indicators.movingAverages.ema50 },
                { label: 'EMA 200', value: report.indicators.movingAverages.ema200 },
              ].map((ema) => {
                const diff = ((report.currentPrice - ema.value) / ema.value) * 100;
                const isAbove = diff > 0;
                return (
                  <div key={ema.label} className="bg-white/5 rounded-xl p-4">
                    <div className="text-sm text-slate-400 mb-1">{ema.label}</div>
                    <div className="text-xl font-mono text-white">${ema.value.toFixed(2)}</div>
                    <div className={`text-sm mt-1 ${isAbove ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isAbove ? '↑' : '↓'} {Math.abs(diff).toFixed(2)}% {isAbove ? 'above' : 'below'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ==================== KEY LEVELS ==================== */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-xl">📍</span> Key Levels
            </h3>
            
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-base font-semibold text-cyan-400">⚡ Near-Term Trading Levels</h4>
                <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded">within 3x ATR</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-emerald-900/10 rounded-xl p-4 border border-emerald-500/20">
                  <div className="text-sm text-emerald-400 font-medium mb-2">Support</div>
                  <div className="space-y-2">
                    {report.levels.nearTerm?.support && report.levels.nearTerm.support.length > 0 ? (
                      report.levels.nearTerm.support.slice(0, 3).map((level, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-lg font-mono text-white">${level.price.toFixed(2)}</span>
                          <span className="text-xs text-slate-400">{level.touches} touches</span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-mono text-white">${report.levels.atrBased?.support1?.toFixed(2) || (report.currentPrice - report.indicators.volatility.atr).toFixed(2)}</span>
                          <span className="text-xs text-slate-500">1x ATR</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-mono text-white">${report.levels.atrBased?.support2?.toFixed(2) || (report.currentPrice - report.indicators.volatility.atr * 1.5).toFixed(2)}</span>
                          <span className="text-xs text-slate-500">1.5x ATR</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="bg-red-900/10 rounded-xl p-4 border border-red-500/20">
                  <div className="text-sm text-red-400 font-medium mb-2">Resistance</div>
                  <div className="space-y-2">
                    {report.levels.nearTerm?.resistance && report.levels.nearTerm.resistance.length > 0 ? (
                      report.levels.nearTerm.resistance.slice(0, 3).map((level, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-lg font-mono text-white">${level.price.toFixed(2)}</span>
                          <span className="text-xs text-slate-400">{level.touches} touches</span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-mono text-white">${report.levels.atrBased?.resistance1?.toFixed(2) || (report.currentPrice + report.indicators.volatility.atr).toFixed(2)}</span>
                          <span className="text-xs text-slate-500">1x ATR</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-mono text-white">${report.levels.atrBased?.resistance2?.toFixed(2) || (report.currentPrice + report.indicators.volatility.atr * 1.5).toFixed(2)}</span>
                          <span className="text-xs text-slate-500">1.5x ATR</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-6 pb-6 border-b border-white/10">
              <h4 className="text-base font-medium text-slate-300 mb-3">Pivot Points</h4>
              <div className="grid grid-cols-7 gap-2">
                {[
                  { label: 'S3', value: report.levels.pivotPoints.s3, color: 'bg-red-900/30' },
                  { label: 'S2', value: report.levels.pivotPoints.s2, color: 'bg-red-900/20' },
                  { label: 'S1', value: report.levels.pivotPoints.s1, color: 'bg-red-900/10' },
                  { label: 'PP', value: report.levels.pivotPoints.pp, color: 'bg-blue-900/30 border border-blue-500/30' },
                  { label: 'R1', value: report.levels.pivotPoints.r1, color: 'bg-emerald-900/10' },
                  { label: 'R2', value: report.levels.pivotPoints.r2, color: 'bg-emerald-900/20' },
                  { label: 'R3', value: report.levels.pivotPoints.r3, color: 'bg-emerald-900/30' },
                ].map((pivot) => (
                  <div key={pivot.label} className={`text-center p-3 rounded-lg ${pivot.color}`}>
                    <div className="text-xs text-slate-400">{pivot.label}</div>
                    <div className="text-sm font-mono text-white mt-1">${pivot.value.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
            
            {((report.levels.historical?.support && report.levels.historical.support.length > 0) || 
              (report.levels.historical?.resistance && report.levels.historical.resistance.length > 0)) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-base font-medium text-slate-500">📚 Historical Reference Levels</h4>
                  <span className="text-xs text-slate-600 bg-slate-800/30 px-2 py-0.5 rounded">distant - reference only</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
                  <div className="rounded-lg p-3 bg-slate-800/30">
                    <div className="text-xs text-slate-500 mb-2">Major Historical Support</div>
                    <div className="flex flex-wrap gap-2">
                      {report.levels.historical?.support && report.levels.historical.support.length > 0 ? (
                        report.levels.historical.support.slice(0, 4).map((level, i) => (
                          <span key={i} className="text-sm font-mono text-slate-400 bg-slate-700/30 px-2 py-1 rounded">
                            ${level.price.toFixed(2)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-600 italic">None</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="rounded-lg p-3 bg-slate-800/30">
                    <div className="text-xs text-slate-500 mb-2">Major Historical Resistance</div>
                    <div className="flex flex-wrap gap-2">
                      {report.levels.historical?.resistance && report.levels.historical.resistance.length > 0 ? (
                        report.levels.historical.resistance.slice(0, 4).map((level, i) => (
                          <span key={i} className="text-sm font-mono text-slate-400 bg-slate-700/30 px-2 py-1 rounded">
                            ${level.price.toFixed(2)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-600 italic">None</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ==================== PRICE ACTION & STRUCTURE ==================== */}
          {report.structureAnalysis && (() => {
            const classification = report.structureAnalysis?.classification as string;
            const confidence = report.structureAnalysis?.confidence || 0;
            const priorTrend = report.structureAnalysis?.priorTrendDirection || 'sideways';
            const summary = report.structureAnalysis?.summary || '';
            const pullbackSignals = report.structureAnalysis?.pullbackSignals || [];
            const reversalSignals = report.structureAnalysis?.reversalSignals || [];
            const structureIntact = report.structureAnalysis?.structureIntact ?? false;
            
            return (
            <div className={`backdrop-blur-lg rounded-2xl p-6 border ${
              classification === 'likely-pullback' 
                ? 'bg-gradient-to-br from-emerald-900/20 to-cyan-900/10 border-emerald-500/30' 
                : classification === 'trend-reversal-risk'
                ? 'bg-gradient-to-br from-red-900/20 to-orange-900/10 border-red-500/30'
                : 'bg-white/10 border-white/20'
            }`}>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-xl">📐</span> Price Action & Structure
              </h3>
              
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-xl font-bold text-lg ${
                    classification === 'likely-pullback' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : classification === 'trend-reversal-risk'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : classification === 'consolidation'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : classification === 'breakout-attempt'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {classification === 'likely-pullback' 
                      ? '✓ Likely Pullback' 
                      : classification === 'trend-reversal-risk'
                      ? '⚠️ Trend Reversal Risk'
                      : classification === 'consolidation'
                      ? '⏸️ Consolidation'
                      : classification === 'breakout-attempt'
                      ? '🚀 Breakout Attempt'
                      : '◐ Mixed / No Clear Edge'}
                  </div>
                  <div className="text-sm text-slate-400">
                    Prior Trend: <span className="font-medium text-white capitalize">{priorTrend}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{confidence}%</div>
                  <div className="text-xs text-slate-400">Confidence</div>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-white/5 mb-6">
                <p className="text-base text-slate-200 leading-relaxed">{summary}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-emerald-900/10 rounded-xl p-4 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-emerald-400 text-lg">✓</span>
                    <h4 className="text-sm font-semibold text-emerald-400">Pullback Confirmation Signals</h4>
                  </div>
                  <ul className="space-y-2">
                    {pullbackSignals.length > 0 ? (
                      pullbackSignals.map((signal, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <span>{signal}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-slate-500 italic">No pullback signals detected</li>
                    )}
                  </ul>
                </div>
                
                <div className="bg-red-900/10 rounded-xl p-4 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-red-400 text-lg">⚠</span>
                    <h4 className="text-sm font-semibold text-red-400">Trend Reversal Signals</h4>
                  </div>
                  <ul className="space-y-2">
                    {reversalSignals.length > 0 ? (
                      reversalSignals.map((signal, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>{signal}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-slate-500 italic">No reversal signals detected</li>
                    )}
                  </ul>
                </div>
              </div>
              
              {report.structureAnalysis?.detectedPatterns && report.structureAnalysis.detectedPatterns.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🕯️</span>
                    <h4 className="text-sm font-semibold text-slate-300">Detected Candlestick Patterns</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {report.structureAnalysis.detectedPatterns.map((pattern, i) => {
                      const isFailed = pattern.outcome === 'failed';
                      const isConfirmed = pattern.outcome === 'confirmed';
                      
                      let bgColor, borderColor, textColor, iconColor;
                      if (isFailed) {
                        bgColor = pattern.type === 'bearish' ? 'bg-emerald-900/20' : 'bg-red-900/20';
                        borderColor = pattern.type === 'bearish' ? 'border-emerald-500/30' : 'border-red-500/30';
                        textColor = pattern.type === 'bearish' ? 'text-emerald-300' : 'text-red-300';
                        iconColor = 'text-slate-400';
                      } else {
                        bgColor = pattern.type === 'bullish' ? 'bg-emerald-900/20' : pattern.type === 'bearish' ? 'bg-red-900/20' : 'bg-slate-700/30';
                        borderColor = pattern.type === 'bullish' ? 'border-emerald-500/30' : pattern.type === 'bearish' ? 'border-red-500/30' : 'border-slate-500/30';
                        textColor = pattern.type === 'bullish' ? 'text-emerald-300' : pattern.type === 'bearish' ? 'text-red-300' : 'text-slate-300';
                        iconColor = pattern.type === 'bullish' ? 'text-emerald-400' : pattern.type === 'bearish' ? 'text-red-400' : 'text-slate-400';
                      }
                      
                      return (
                        <div 
                          key={i} 
                          className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${bgColor} border ${borderColor} ${textColor}`}
                        >
                          <span className={`text-xs font-bold ${iconColor}`}>
                            {isFailed ? '✗' : isConfirmed ? '✓' : pattern.type === 'bullish' ? '▲' : pattern.type === 'bearish' ? '▼' : '◆'}
                          </span>
                          <div>
                            <div className="font-medium flex items-center gap-1">
                              {isFailed && <span className="text-xs text-slate-400 line-through">{pattern.name}</span>}
                              {isFailed && <span className="text-xs">FAILED</span>}
                              {!isFailed && pattern.name}
                              {isConfirmed && <span className="text-xs ml-1 opacity-70">✓</span>}
                            </div>
                            <div className="text-xs opacity-70">
                              {pattern.location} • {pattern.outcome !== 'active' ? pattern.outcomeDescription : `${pattern.confidence}%`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="mt-4 flex items-center gap-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${structureIntact ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                  <span className="text-sm text-slate-400">
                    Structure: <span className={`font-medium ${structureIntact ? 'text-emerald-400' : 'text-red-400'}`}>
                      {structureIntact ? 'Intact' : 'Broken'}
                    </span>
                  </span>
                </div>
                <div className="text-sm text-slate-500">|</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">
                    Classification: <span className={`font-medium ${
                      classification === 'likely-pullback' ? 'text-emerald-400' :
                      classification === 'trend-reversal-risk' ? 'text-red-400' : 
                      classification === 'breakout-attempt' ? 'text-orange-400' : 'text-yellow-400'
                    }`}>
                      {classification === 'likely-pullback' ? 'Pullback' :
                       classification === 'trend-reversal-risk' ? 'Reversal Risk' : 
                       classification === 'consolidation' ? 'Consolidation' :
                       classification === 'breakout-attempt' ? 'Breakout Attempt' : 'Mixed'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
            );
          })()}

          {/* ==================== EVALUATE BY AI BUTTON ==================== */}
          {!report.aiEnhanced && (
            <div className="flex flex-col items-center gap-4 py-6">
              <button
                onClick={handleAiEvaluate}
                disabled={isAiEvaluating}
                className="group relative px-10 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-lg font-semibold rounded-2xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAiEvaluating ? (
                  <span className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    AI is analyzing all indicators and patterns...
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <span className="text-2xl">🤖</span>
                    Evaluate by AI
                  </span>
                )}
              </button>
              <p className="text-slate-400 text-sm text-center max-w-md">
                AI will analyze all indicators, candlestick patterns, and price structure to provide a comprehensive trading assessment, projections, and strategy
              </p>
              {aiError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200 text-sm max-w-md text-center">
                  {aiError}
                </div>
              )}
            </div>
          )}

          {/* ==================== AI ANALYSIS SECTION ==================== */}
          {report.aiEnhanced && (() => {
            const aiSignal = report.aiEnhanced!.signalStrength;
            const aiRec = report.aiEnhanced!.recommendation;
            const aiBreakdown = report.aiEnhanced!.signalStrength.breakdown;
            
            const mergedRecommendation = {
              direction: aiRec.action.toLowerCase() as 'long' | 'short' | 'wait',
              strategy: aiRec.strategy,
              confidence: aiRec.confidence,
              entry: {
                type: aiRec.entry?.type || report.recommendation.entry.type,
                price: aiRec.entry?.price || report.recommendation.entry.price,
                conditions: aiRec.entry?.conditions || report.recommendation.entry.conditions,
              },
              stopLoss: {
                price: aiRec.stopLoss?.price || report.recommendation.stopLoss.price,
                riskPercent: aiRec.stopLoss?.riskPercent || report.recommendation.stopLoss.riskPercent,
                reason: aiRec.stopLoss?.reasoning || report.recommendation.stopLoss.reason,
              },
              targets: {
                t1: {
                  price: aiRec.targets?.t1?.price || report.recommendation.targets.t1.price,
                  rr: aiRec.targets?.t1?.rr || report.recommendation.targets.t1.rr,
                  probability: aiRec.targets?.t1?.probability || report.recommendation.targets.t1.probability,
                },
                t2: {
                  price: aiRec.targets?.t2?.price || report.recommendation.targets.t2.price,
                  rr: aiRec.targets?.t2?.rr || report.recommendation.targets.t2.rr,
                  probability: aiRec.targets?.t2?.probability || report.recommendation.targets.t2.probability,
                },
                t3: {
                  price: aiRec.targets?.t3?.price || report.recommendation.targets.t3.price,
                  rr: aiRec.targets?.t3?.rr || report.recommendation.targets.t3.rr,
                  probability: aiRec.targets?.t3?.probability || report.recommendation.targets.t3.probability,
                },
              },
              invalidation: aiRec.invalidation || report.recommendation.invalidation,
            };

            return (
            <>
              {/* AI Assessment Header */}
              <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/10 backdrop-blur-lg rounded-2xl p-6 border border-indigo-500/30">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                  <span className="text-xl">🤖</span> AI Evaluation
                  <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider border border-indigo-500/30">
                    {(report as any).aiModel || 'AI'}
                  </span>
                </h3>
                
                <div className="flex flex-col lg:flex-row lg:items-center gap-8">
                  <DirectionIndicator direction={aiSignal.direction as 'bullish' | 'bearish' | 'neutral'} size="lg" />
                  <div className="text-center">
                    <div className="text-sm text-slate-400 mb-1">Signal Grade</div>
                    <GradeBadge grade={aiSignal.grade} />
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-400 mb-1">Strength</div>
                    <div className="text-3xl font-bold text-white">{aiSignal.overall}</div>
                    <div className="text-sm text-slate-500">/ 100</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-400 mb-1">Confidence</div>
                    <div className={`text-xl font-semibold ${
                      mergedRecommendation.confidence >= 70 ? 'text-emerald-400' :
                      mergedRecommendation.confidence >= 50 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {mergedRecommendation.confidence >= 70 ? 'HIGH' : mergedRecommendation.confidence >= 50 ? 'MEDIUM' : 'LOW'}
                      <span className="text-sm ml-1 opacity-70">({mergedRecommendation.confidence}%)</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <SignalBadge signal={aiSignal.direction} size="lg" />
                  </div>
                </div>
                
                {aiSignal.reasoning && aiSignal.reasoning.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-indigo-500/20">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Reasoning</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                      {aiSignal.reasoning.map((reason, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className="text-indigo-400 mt-0.5">•</span>
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Signal Breakdown */}
              <div className="grid grid-cols-5 gap-4">
                {Object.entries(aiBreakdown).map(([key, data]) => {
                  const displayText = (data as any).assessment || (data as any).signal || '';
                  return (
                  <div key={key} className="bg-indigo-900/5 backdrop-blur-lg rounded-xl p-4 border border-indigo-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-300 capitalize">{key}</span>
                      <span className="text-xl font-bold text-white">{data.score}</span>
                    </div>
                    <Gauge value={data.score} colorScheme="signal" />
                    <div className="text-xs text-slate-400 mt-2 leading-relaxed">{displayText}</div>
                  </div>
                  );
                })}
              </div>

              {/* AI Structure Analysis */}
              {report.aiEnhanced!.structureAnalysis && (
                <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/10 backdrop-blur-lg rounded-2xl p-6 border border-indigo-500/30">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">📐</span> AI Structure Analysis
                  </h3>
                  <div className="p-4 rounded-xl bg-white/5 mb-4">
                    <p className="text-base text-slate-200 leading-relaxed">{report.aiEnhanced!.structureAnalysis.summary}</p>
                  </div>
                  {report.aiEnhanced!.structureAnalysis.patternAnalysis && (
                    <div className="p-4 rounded-xl bg-indigo-900/20 border border-indigo-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🕯️</span>
                        <h4 className="text-sm font-semibold text-indigo-400">AI Pattern Interpretation</h4>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{report.aiEnhanced!.structureAnalysis.patternAnalysis}</p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Price Projections */}
              {report.aiEnhanced!.priceProjections && (() => {
                const formatTarget = (target: number | string, targetLow?: number, targetHigh?: number): string => {
                  if (targetLow !== undefined && targetHigh !== undefined) {
                    return `$${targetLow.toFixed(2)} - $${targetHigh.toFixed(2)}`;
                  }
                  if (typeof target === 'string') {
                    return target.startsWith('$') ? target : `$${target}`;
                  }
                  return `$${target.toFixed(2)}`;
                };
                
                const proj = report.aiEnhanced!.priceProjections;
                
                return (
                <div className="bg-gradient-to-br from-indigo-900/10 to-purple-900/5 backdrop-blur-lg rounded-2xl p-6 border border-indigo-500/30">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">🎯</span> AI Price Projections
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`p-4 rounded-xl border ${
                      proj.mostLikely === 'bull' 
                        ? 'bg-emerald-500/20 border-emerald-500/50' 
                        : 'bg-emerald-900/10 border-emerald-500/20'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-emerald-400">📈 Bull Case</div>
                        {proj.mostLikely === 'bull' && (
                          <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded">Most Likely</span>
                        )}
                      </div>
                      <div className="text-xl font-mono text-white mb-1">
                        {formatTarget(proj.bullCase.target, (proj.bullCase as any).targetLow, (proj.bullCase as any).targetHigh)}
                      </div>
                      <div className="text-sm text-slate-400">{proj.bullCase.probability}% • {proj.bullCase.timeframe}</div>
                      <div className="text-xs text-slate-500 mt-2">{proj.bullCase.reasoning}</div>
                    </div>
                    
                    <div className={`p-4 rounded-xl border ${
                      proj.mostLikely === 'base' 
                        ? 'bg-blue-500/20 border-blue-500/50' 
                        : 'bg-blue-900/10 border-blue-500/20'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-blue-400">📊 Base Case</div>
                        {proj.mostLikely === 'base' && (
                          <span className="text-[10px] bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded">Most Likely</span>
                        )}
                      </div>
                      <div className="text-xl font-mono text-white mb-1">
                        {formatTarget(proj.baseCase.target, (proj.baseCase as any).targetLow, (proj.baseCase as any).targetHigh)}
                      </div>
                      <div className="text-sm text-slate-400">{proj.baseCase.probability}% • {proj.baseCase.timeframe}</div>
                      <div className="text-xs text-slate-500 mt-2">{proj.baseCase.reasoning}</div>
                    </div>
                    
                    <div className={`p-4 rounded-xl border ${
                      proj.mostLikely === 'bear' 
                        ? 'bg-red-500/20 border-red-500/50' 
                        : 'bg-red-900/10 border-red-500/20'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-red-400">📉 Bear Case</div>
                        {proj.mostLikely === 'bear' && (
                          <span className="text-[10px] bg-red-500/30 text-red-300 px-1.5 py-0.5 rounded">Most Likely</span>
                        )}
                      </div>
                      <div className="text-xl font-mono text-white mb-1">
                        {formatTarget(proj.bearCase.target, (proj.bearCase as any).targetLow, (proj.bearCase as any).targetHigh)}
                      </div>
                      <div className="text-sm text-slate-400">{proj.bearCase.probability}% • {proj.bearCase.timeframe}</div>
                      <div className="text-xs text-slate-500 mt-2">{proj.bearCase.reasoning}</div>
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* AI Strategy Recommendation */}
              <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 backdrop-blur-lg rounded-2xl p-6 border border-indigo-500/30">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🎲</span> AI Strategy Recommendation
                </h3>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className={`px-5 py-2 rounded-xl font-bold text-xl ${
                    mergedRecommendation.direction === 'long' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    mergedRecommendation.direction === 'short' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {mergedRecommendation.direction === 'wait' ? '⏳ WAIT' : mergedRecommendation.direction.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-lg text-white font-medium">{mergedRecommendation.strategy}</div>
                    <div className="text-sm text-slate-400">Confidence: {mergedRecommendation.confidence}%</div>
                  </div>
                </div>
                
                {mergedRecommendation.direction === 'wait' ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white/5">
                      <div className="text-sm font-medium text-slate-300 mb-3">Conditions to Watch</div>
                      <div className="space-y-2">
                        {mergedRecommendation.entry.conditions.map((condition, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-yellow-400 mt-0.5">→</span>
                            <span className="text-slate-300">{condition}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {(() => {
                      const t1 = mergedRecommendation.targets.t1.price;
                      const t3 = mergedRecommendation.targets.t3.price;
                      const cp = report.currentPrice;
                      let resistance: number, support: number;
                      
                      if (t1 > cp && t3 < cp) { resistance = t1; support = t3; }
                      else if (t3 > cp && t1 < cp) { resistance = t3; support = t1; }
                      else if (t1 > t3) { resistance = t1; support = t3; }
                      else { resistance = t3; support = t1; }
                      
                      return (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/20">
                          <div className="text-sm text-emerald-400 mb-1">Resistance (Bullish Breakout)</div>
                          <div className="text-xl font-mono text-white">${resistance.toFixed(2)}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/20">
                          <div className="text-sm text-red-400 mb-1">Support (Bearish Breakdown)</div>
                          <div className="text-xl font-mono text-white">${support.toFixed(2)}</div>
                        </div>
                      </div>
                      );
                    })()}
                    
                    <div className="p-3 rounded-lg bg-slate-800/50 text-sm text-slate-400">
                      <span className="font-medium text-yellow-400">Note:</span> No clear trading edge. 
                      Wait for price to break above resistance or below support with volume confirmation before taking a position.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="p-4 rounded-xl bg-white/5">
                        <div className="text-sm text-slate-400 mb-1">Entry ({mergedRecommendation.entry.type})</div>
                        <div className="text-2xl font-mono text-white">${mergedRecommendation.entry.price.toFixed(2)}</div>
                        {mergedRecommendation.entry.conditions.length > 0 && (
                          <div className="text-sm text-slate-400 mt-2">
                            {mergedRecommendation.entry.conditions[0]}
                          </div>
                        )}
                      </div>
                      <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/20">
                        <div className="text-sm text-red-400 mb-1">Stop Loss</div>
                        <div className="text-2xl font-mono text-red-400">${mergedRecommendation.stopLoss.price.toFixed(2)}</div>
                        <div className="text-sm text-slate-400 mt-2">
                          Risk: {mergedRecommendation.stopLoss.riskPercent.toFixed(1)}% • {mergedRecommendation.stopLoss.reason}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className={`text-base font-medium mb-3 ${
                        mergedRecommendation.direction === 'long' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {mergedRecommendation.direction === 'long' ? '📈 Long Targets' : '📉 Short Targets'}
                      </h4>
                      <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead>
                          <tr className="text-sm text-slate-500 border-b border-white/10">
                            <th className="text-left py-2 font-medium">Target</th>
                            <th className="text-right py-2 font-medium">Price</th>
                            <th className="text-right py-2 font-medium">From Entry</th>
                            <th className="text-right py-2 font-medium">From Current</th>
                            <th className="text-right py-2 font-medium">R:R</th>
                            <th className="text-right py-2 font-medium">Est. Prob</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {Object.entries(mergedRecommendation.targets).map(([key, target]) => {
                            const entryPrice = mergedRecommendation.entry.price;
                            const currentPrice = report.currentPrice;
                            const moveFromEntry = mergedRecommendation.direction === 'long' 
                              ? ((target.price - entryPrice) / entryPrice) * 100
                              : ((entryPrice - target.price) / entryPrice) * 100;
                            const moveFromCurrent = mergedRecommendation.direction === 'long'
                              ? ((target.price - currentPrice) / currentPrice) * 100
                              : ((currentPrice - target.price) / currentPrice) * 100;
                            
                            return (
                            <tr key={key} className="text-base">
                              <td className="py-3 text-slate-300 font-medium">{key.toUpperCase()}</td>
                              <td className={`py-3 text-right font-mono ${
                                mergedRecommendation.direction === 'long' ? 'text-emerald-400' : 'text-red-400'
                              }`}>${target.price.toFixed(2)}</td>
                              <td className="py-3 text-right text-slate-300">
                                <span className={moveFromEntry >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {moveFromEntry >= 0 ? '+' : ''}{moveFromEntry.toFixed(2)}%
                                </span>
                              </td>
                              <td className="py-3 text-right text-slate-300">
                                <span className={moveFromCurrent >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {moveFromCurrent >= 0 ? '+' : ''}{moveFromCurrent.toFixed(2)}%
                                </span>
                              </td>
                              <td className="py-3 text-right text-white font-semibold">{target.rr}:1</td>
                              <td className="py-3 text-right text-slate-400">~{target.probability}%</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                      <div className="mt-3 text-xs text-slate-500 flex flex-wrap items-center gap-4">
                        <span>• <span className="text-slate-400">From Entry:</span> % move from entry price (${mergedRecommendation.entry.price.toFixed(2)})</span>
                        <span>• <span className="text-slate-400">From Current:</span> % move from current price (${report.currentPrice.toFixed(2)})</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 rounded-lg bg-slate-800/50 text-sm text-slate-400">
                      <span className="font-medium text-slate-300">Invalidation:</span> {mergedRecommendation.invalidation}
                    </div>
                  </>
                )}
              </div>

              {/* AI Summary */}
              {report.aiSummary && (
                <div className="bg-gradient-to-r from-violet-900/30 to-indigo-900/20 backdrop-blur-lg rounded-2xl p-6 border border-violet-500/30">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">📋</span> AI Technical Summary
                  </h3>
                  
                  <div className="text-xl font-medium text-indigo-300 mb-4">
                    {report.aiSummary.headline}
                  </div>
                  
                  <p className="text-base text-slate-300 leading-relaxed mb-6">
                    {report.aiSummary.technicalOutlook}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="text-base font-medium text-emerald-400 mb-3">Key Insights</h4>
                      <ul className="space-y-2">
                        {report.aiSummary.keyInsights.map((insight, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                            <span className="text-emerald-400 mt-0.5">✓</span>
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="text-base font-medium text-red-400 mb-3">Risk Factors</h4>
                      <ul className="space-y-2">
                        {report.aiSummary.riskFactors.map((risk, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                            <span className="text-red-400 mt-0.5">⚠</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="text-base font-medium text-indigo-400 mb-3">Trading Plan</h4>
                      <p className="text-sm text-slate-300 leading-relaxed">{report.aiSummary.tradingPlan}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
            );
          })()}

          {/* Footer */}
          <div className="text-center text-slate-500 text-sm py-4">
            Analysis generated {new Date(report.timestamp).toLocaleString()} • 
            {report.marketData.barsAnalyzed} bars analyzed • 
            Data as of {new Date(report.marketData.lastBarDate).toLocaleDateString()}
            {report.aiEnhanced && <span className="ml-2">• AI Evaluated</span>}
          </div>
        </div>
      )}
      
      {/* Indicator Explanation Modal */}
      <IndicatorExplanationModal
        isOpen={indicatorModalOpen}
        onClose={() => setIndicatorModalOpen(false)}
        section={indicatorSection}
      />
    </div>
  );
}
