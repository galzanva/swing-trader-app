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
    colorClass = value > 70 ? 'bg-loss' : value > 50 ? 'bg-profit' : value > 30 ? 'bg-yellow-500' : 'bg-profit';
  } else if (colorScheme === 'signal') {
    colorClass = value >= 70 ? 'bg-profit' : value >= 50 ? 'bg-accent' : value >= 30 ? 'bg-yellow-500' : 'bg-loss';
  } else if (colorScheme === 'momentum') {
    colorClass = value > 0 ? 'bg-profit' : 'bg-loss';
  } else {
    colorClass = 'bg-accent';
  }
  
  return (
    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
      <div 
        className={`h-full ${colorClass} transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
    </div>
  );
}

function SignalBadge({ signal, size = 'md' }: { signal: string; size?: 'sm' | 'md' | 'lg' }) {
  const colorMap: Record<string, string> = {
    'overbought': 'bg-loss/10 text-loss',
    'bullish': 'bg-profit/10 text-profit',
    'neutral': 'bg-surface-3 text-text-secondary',
    'bearish': 'bg-loss/10 text-loss',
    'oversold': 'bg-profit/10 text-profit',
    'strong': 'bg-profit/10 text-profit',
    'moderate': 'bg-accent/10 text-accent',
    'weak': 'bg-yellow-500/10 text-yellow-500',
    'no-trend': 'bg-surface-3 text-text-secondary',
    'high': 'bg-loss/10 text-loss',
    'normal': 'bg-accent/10 text-accent',
    'low': 'bg-profit/10 text-profit',
    'expanding': 'bg-loss/10 text-loss',
    'contracting': 'bg-accent/10 text-accent',
    'rising': 'bg-profit/10 text-profit',
    'falling': 'bg-loss/10 text-loss',
    'flat': 'bg-surface-3 text-text-secondary',
  };
  
  const classes = colorMap[signal.toLowerCase()] || colorMap['neutral'];
  const sizeClasses = size === 'lg' ? 'px-3 py-1 text-sm' : size === 'md' ? 'px-2.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs';
  
  return (
    <span className={`${classes} ${sizeClasses} rounded-full font-medium capitalize whitespace-nowrap`}>
      {signal}
    </span>
  );
}

function DirectionIndicator({ direction, size = 'md' }: { direction: 'bullish' | 'bearish' | 'neutral'; size?: 'sm' | 'md' | 'lg' }) {
  const colors = {
    bullish: 'bg-profit text-white',
    bearish: 'bg-loss text-white',
    neutral: 'bg-surface-4 text-text-secondary'
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
    'A+': 'bg-profit/10 text-profit',
    'A': 'bg-profit/10 text-profit',
    'B': 'bg-accent/10 text-accent',
    'C': 'bg-yellow-500/10 text-yellow-500',
    'D': 'bg-loss/10 text-loss',
    'F': 'bg-loss/10 text-loss',
  };
  
  return (
    <div className={`${colorMap[grade] || colorMap['C']} px-4 py-2 rounded-lg text-2xl font-black`}>
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
        <span className="text-sm text-text-secondary">{label}</span>
        {onHelpClick && (
          <button
            onClick={onHelpClick}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-3 hover:bg-surface-4 text-text-muted hover:text-text-secondary transition-all"
            title={`Learn about ${label}`}
          >
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-mono text-base ${valueColor || 'text-text-primary'}`}>
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
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Technical Analysis</h1>
        <p className="text-text-secondary mt-1">
          Pure technical indicator and pattern analysis
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-surface-1 rounded-xl p-6 border border-border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Ticker Symbol
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL, TSLA, SPY"
              className="w-full px-4 py-3 rounded-lg bg-surface-2 border border-border text-text-primary text-lg placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent uppercase font-mono"
              disabled={isLoading}
              onKeyPress={(e) => e.key === "Enter" && handleAnalyze()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Timeframe
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-surface-2 border border-border text-text-primary text-lg focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              disabled={isLoading}
            >
              <option value="1day">Daily (Swing)</option>
              <option value="1hour">1 Hour (Day)</option>
              <option value="15min">15 Min (Day)</option>
              <option value="5min">5 Min (Day)</option>
              <option value="1min">1 Min (Scalp)</option>
            </select>
          </div>

          <div>
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className="w-full px-6 py-3 bg-accent hover:bg-accent-hover text-white text-lg font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="mt-4 p-4 rounded-lg bg-loss/10 border border-loss/30 text-loss">
            {error}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-surface-1 rounded-xl p-12 border border-border text-center">
          <div className="inline-block w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mb-4"></div>
          <p className="text-text-primary text-xl">Analyzing {symbol}...</p>
          <p className="text-text-secondary mt-2">
            Calculating indicators, detecting patterns, analyzing structure...
          </p>
        </div>
      )}

      {/* ==================== REPORT ==================== */}
      {report && !isLoading && (
        <div className="space-y-6">
          
          {/* ==================== HEADER ==================== */}
          <div className="bg-surface-1 rounded-xl p-6 border border-border">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-text-primary">{report.symbol}</h2>
                  <span className="text-text-muted">{report.marketData.name}</span>
                  <span className="bg-surface-3 text-text-secondary px-2 py-0.5 text-xs rounded-full font-mono">{report.timeframe}</span>
                  {report.aiEnhanced && (
                    <span className="bg-accent/10 text-accent px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider">
                      AI Evaluated
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-3xl font-bold text-text-primary">${report.currentPrice.toFixed(2)}</span>
                </div>
              </div>
              
              <div>
                <button
                  onClick={handleSaveReport}
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    saveSuccess 
                      ? 'bg-profit/10 text-profit'
                      : 'bg-surface-2 hover:bg-surface-3 text-text-secondary border border-border hover:border-border-hover'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-text-muted border-t-text-primary rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <span>✓</span>
                      Saved!
                    </>
                  ) : (
                    "Save Report"
                  )}
                </button>
                {saveError && (
                  <p className="text-xs text-loss mt-1">{saveError}</p>
                )}
              </div>
            </div>
          </div>

          {/* ==================== TECHNICAL INDICATORS ==================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column: Momentum & Trend */}
            <div className="space-y-6">
              
              {/* Momentum Indicators */}
              <div className="bg-surface-1 rounded-xl p-6 border border-border">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  Momentum Indicators
                </h3>
                
                <div className="space-y-1 divide-y divide-border">
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
                    valueColor={report.indicators.momentum.macdHistogram > 0 ? 'text-profit' : 'text-loss'}
                    onHelpClick={() => openIndicatorHelp('macd')}
                  />
                  <IndicatorRow 
                    label="MACD Histogram" 
                    value={report.indicators.momentum.macdHistogram.toFixed(4)} 
                    valueColor={report.indicators.momentum.macdHistogram > 0 ? 'text-profit' : 'text-loss'}
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
                    valueColor={report.indicators.momentum.cci > 100 ? 'text-loss' : report.indicators.momentum.cci < -100 ? 'text-profit' : 'text-text-primary'}
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
              <div className="bg-surface-1 rounded-xl p-6 border border-border">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  Trend Analysis
                </h3>
                
                <div className="space-y-1 divide-y divide-border">
                  <IndicatorRow 
                    label="ADX (Trend Strength)" 
                    value={report.indicators.trend.adx.toFixed(1)} 
                    signal={report.indicators.trend.trendStrength}
                    onHelpClick={() => openIndicatorHelp('adx')}
                  />
                  <IndicatorRow 
                    label="+DI (Buyers)" 
                    value={report.indicators.trend.plusDI.toFixed(1)} 
                    valueColor="text-profit"
                    onHelpClick={() => openIndicatorHelp('di')}
                  />
                  <IndicatorRow 
                    label="-DI (Sellers)" 
                    value={report.indicators.trend.minusDI.toFixed(1)} 
                    valueColor="text-loss"
                    onHelpClick={() => openIndicatorHelp('di')}
                  />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-text-secondary">EMA Alignment</span>
                      <button
                        onClick={() => openIndicatorHelp('ema')}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-3 hover:bg-surface-4 text-text-muted hover:text-text-secondary transition-all"
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
                    <span className="text-sm text-text-secondary">Price Location</span>
                    <span className="text-base text-text-primary">{report.assessments.trend.priceLocation}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Volume, Volatility, Squeeze */}
            <div className="space-y-6">
              
              {/* Volume Analysis */}
              <div className="bg-surface-1 rounded-xl p-6 border border-border">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  Volume Analysis
                </h3>
                
                <div className="space-y-1 divide-y divide-border">
                  <IndicatorRow 
                    label="Volume Z-Score" 
                    value={report.indicators.volume.zScore.toFixed(2)} 
                    signal={report.indicators.volume.volumeSignal}
                    valueColor={report.indicators.volume.zScore > 1 ? 'text-profit' : report.indicators.volume.zScore < -1 ? 'text-loss' : 'text-text-primary'}
                    onHelpClick={() => openIndicatorHelp('volume-z')}
                  />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-text-secondary">OBV Trend</span>
                      <button
                        onClick={() => openIndicatorHelp('obv')}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-3 hover:bg-surface-4 text-text-muted hover:text-text-secondary transition-all"
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
                    valueColor={report.indicators.volume.cmf > 0 ? 'text-profit' : 'text-loss'}
                    onHelpClick={() => openIndicatorHelp('cmf')}
                  />
                </div>
              </div>

              {/* Volatility */}
              <div className="bg-surface-1 rounded-xl p-6 border border-border">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  Volatility
                </h3>
                
                <div className="space-y-1 divide-y divide-border">
                  <IndicatorRow 
                    label="ATR (14)" 
                    value={`$${report.indicators.volatility.atr.toFixed(2)} (${report.indicators.volatility.atrPercent.toFixed(2)}%)`}
                    onHelpClick={() => openIndicatorHelp('atr')}
                  />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-text-secondary">Volatility Regime</span>
                      <button
                        onClick={() => openIndicatorHelp('volatility')}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-3 hover:bg-surface-4 text-text-muted hover:text-text-secondary transition-all"
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
              <div className={`rounded-xl p-6 border ${
                report.squeeze.isInSqueeze 
                  ? 'bg-loss/10 border-loss/30' 
                  : 'bg-surface-1 border-border'
              }`}>
                <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  TTM Squeeze
                  <button
                    onClick={() => openIndicatorHelp('squeeze')}
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface-3 hover:bg-surface-4 text-text-muted hover:text-text-secondary transition-all ml-1"
                    title="Learn about TTM Squeeze"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                </h3>
                
                <div className="flex items-center justify-between mb-4">
                  <span className="text-base text-text-secondary">Squeeze Status</span>
                  <div className={`px-4 py-2 rounded-lg text-base font-semibold ${
                    report.squeeze.isInSqueeze 
                      ? 'bg-loss/10 text-loss' 
                      : 'bg-surface-3 text-text-secondary'
                  }`}>
                    {report.squeeze.isInSqueeze ? `ON — ${report.squeeze.squeezeDuration} bars` : 'OFF'}
                  </div>
                </div>
                
                {report.squeeze.isInSqueeze && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">Momentum Direction</span>
                    <SignalBadge signal={report.squeeze.momentumDirection} size="lg" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ==================== MOVING AVERAGES ==================== */}
          <div className="bg-surface-1 rounded-xl p-6 border border-border">
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              Moving Averages
              <button
                onClick={() => openIndicatorHelp('ema')}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface-3 hover:bg-surface-4 text-text-muted hover:text-text-secondary transition-all ml-1"
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
                  <div key={ema.label} className="bg-surface-2 rounded-xl p-4">
                    <div className="text-sm text-text-muted mb-1">{ema.label}</div>
                    <div className="text-xl font-mono text-text-primary">${ema.value.toFixed(2)}</div>
                    <div className={`text-sm mt-1 ${isAbove ? 'text-profit' : 'text-loss'}`}>
                      {isAbove ? '↑' : '↓'} {Math.abs(diff).toFixed(2)}% {isAbove ? 'above' : 'below'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ==================== KEY LEVELS ==================== */}
          <div className="bg-surface-1 rounded-xl p-6 border border-border">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Key Levels
            </h3>
            
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-base font-semibold text-accent">Near-Term Trading Levels</h4>
                <span className="text-xs text-text-muted bg-surface-3 px-2 py-0.5 rounded">within 3x ATR</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-profit/5 rounded-xl p-4 border border-profit/20">
                  <div className="text-sm text-profit font-medium mb-2">Support</div>
                  <div className="space-y-2">
                    {report.levels.nearTerm?.support && report.levels.nearTerm.support.length > 0 ? (
                      report.levels.nearTerm.support.slice(0, 3).map((level, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-lg font-mono text-text-primary">${level.price.toFixed(2)}</span>
                          <span className="text-xs text-text-muted">{level.touches} touches</span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-mono text-text-primary">${report.levels.atrBased?.support1?.toFixed(2) || (report.currentPrice - report.indicators.volatility.atr).toFixed(2)}</span>
                          <span className="text-xs text-text-muted">1x ATR</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-mono text-text-primary">${report.levels.atrBased?.support2?.toFixed(2) || (report.currentPrice - report.indicators.volatility.atr * 1.5).toFixed(2)}</span>
                          <span className="text-xs text-text-muted">1.5x ATR</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="bg-loss/5 rounded-xl p-4 border border-loss/20">
                  <div className="text-sm text-loss font-medium mb-2">Resistance</div>
                  <div className="space-y-2">
                    {report.levels.nearTerm?.resistance && report.levels.nearTerm.resistance.length > 0 ? (
                      report.levels.nearTerm.resistance.slice(0, 3).map((level, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-lg font-mono text-text-primary">${level.price.toFixed(2)}</span>
                          <span className="text-xs text-text-muted">{level.touches} touches</span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-mono text-text-primary">${report.levels.atrBased?.resistance1?.toFixed(2) || (report.currentPrice + report.indicators.volatility.atr).toFixed(2)}</span>
                          <span className="text-xs text-text-muted">1x ATR</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-mono text-text-primary">${report.levels.atrBased?.resistance2?.toFixed(2) || (report.currentPrice + report.indicators.volatility.atr * 1.5).toFixed(2)}</span>
                          <span className="text-xs text-text-muted">1.5x ATR</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-6 pb-6 border-b border-border">
              <h4 className="text-base font-medium text-text-secondary mb-3">Pivot Points</h4>
              <div className="grid grid-cols-7 gap-2">
                {[
                  { label: 'S3', value: report.levels.pivotPoints.s3, color: 'bg-loss/10' },
                  { label: 'S2', value: report.levels.pivotPoints.s2, color: 'bg-loss/5' },
                  { label: 'S1', value: report.levels.pivotPoints.s1, color: 'bg-loss/5' },
                  { label: 'PP', value: report.levels.pivotPoints.pp, color: 'bg-accent/10 border border-accent/30' },
                  { label: 'R1', value: report.levels.pivotPoints.r1, color: 'bg-profit/5' },
                  { label: 'R2', value: report.levels.pivotPoints.r2, color: 'bg-profit/5' },
                  { label: 'R3', value: report.levels.pivotPoints.r3, color: 'bg-profit/10' },
                ].map((pivot) => (
                  <div key={pivot.label} className={`text-center p-3 rounded-lg ${pivot.color}`}>
                    <div className="text-xs text-text-muted">{pivot.label}</div>
                    <div className="text-sm font-mono text-text-primary mt-1">${pivot.value.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
            
            {((report.levels.historical?.support && report.levels.historical.support.length > 0) || 
              (report.levels.historical?.resistance && report.levels.historical.resistance.length > 0)) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-base font-medium text-text-muted">Historical Reference Levels</h4>
                  <span className="text-xs text-text-muted bg-surface-3 px-2 py-0.5 rounded">distant - reference only</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
                  <div className="rounded-lg p-3 bg-surface-2">
                    <div className="text-xs text-text-muted mb-2">Major Historical Support</div>
                    <div className="flex flex-wrap gap-2">
                      {report.levels.historical?.support && report.levels.historical.support.length > 0 ? (
                        report.levels.historical.support.slice(0, 4).map((level, i) => (
                          <span key={i} className="text-sm font-mono text-text-secondary bg-surface-3 px-2 py-1 rounded">
                            ${level.price.toFixed(2)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-text-muted italic">None</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="rounded-lg p-3 bg-surface-2">
                    <div className="text-xs text-text-muted mb-2">Major Historical Resistance</div>
                    <div className="flex flex-wrap gap-2">
                      {report.levels.historical?.resistance && report.levels.historical.resistance.length > 0 ? (
                        report.levels.historical.resistance.slice(0, 4).map((level, i) => (
                          <span key={i} className="text-sm font-mono text-text-secondary bg-surface-3 px-2 py-1 rounded">
                            ${level.price.toFixed(2)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-text-muted italic">None</span>
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
            <div className={`rounded-xl p-6 border ${
              classification === 'likely-pullback' 
                ? 'bg-profit/5 border-profit/30' 
                : classification === 'trend-reversal-risk'
                ? 'bg-loss/5 border-loss/30'
                : 'bg-surface-1 border-border'
            }`}>
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Price Action & Structure
              </h3>
              
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-xl font-bold text-lg ${
                    classification === 'likely-pullback' 
                      ? 'bg-profit/10 text-profit' 
                      : classification === 'trend-reversal-risk'
                      ? 'bg-loss/10 text-loss'
                      : classification === 'consolidation'
                      ? 'bg-accent/10 text-accent'
                      : classification === 'breakout-attempt'
                      ? 'bg-yellow-500/10 text-yellow-500'
                      : 'bg-surface-3 text-text-secondary'
                  }`}>
                    {classification === 'likely-pullback' 
                      ? 'Likely Pullback' 
                      : classification === 'trend-reversal-risk'
                      ? 'Trend Reversal Risk'
                      : classification === 'consolidation'
                      ? 'Consolidation'
                      : classification === 'breakout-attempt'
                      ? 'Breakout Attempt'
                      : 'Mixed / No Clear Edge'}
                  </div>
                  <div className="text-sm text-text-muted">
                    Prior Trend: <span className="font-medium text-text-primary capitalize">{priorTrend}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-text-primary">{confidence}%</div>
                  <div className="text-xs text-text-muted">Confidence</div>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-surface-2 mb-6">
                <p className="text-base text-text-secondary leading-relaxed">{summary}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-profit/5 rounded-xl p-4 border border-profit/20">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-profit text-lg">✓</span>
                    <h4 className="text-sm font-semibold text-profit">Pullback Confirmation Signals</h4>
                  </div>
                  <ul className="space-y-2">
                    {pullbackSignals.length > 0 ? (
                      pullbackSignals.map((signal, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <span className="text-profit mt-0.5">•</span>
                          <span>{signal}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-text-muted italic">No pullback signals detected</li>
                    )}
                  </ul>
                </div>
                
                <div className="bg-loss/5 rounded-xl p-4 border border-loss/20">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-loss text-lg">!</span>
                    <h4 className="text-sm font-semibold text-loss">Trend Reversal Signals</h4>
                  </div>
                  <ul className="space-y-2">
                    {reversalSignals.length > 0 ? (
                      reversalSignals.map((signal, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <span className="text-loss mt-0.5">•</span>
                          <span>{signal}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-text-muted italic">No reversal signals detected</li>
                    )}
                  </ul>
                </div>
              </div>
              
              {report.structureAnalysis?.detectedPatterns && report.structureAnalysis.detectedPatterns.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-sm font-semibold text-text-secondary">Detected Candlestick Patterns</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {report.structureAnalysis.detectedPatterns.map((pattern, i) => {
                      const isFailed = pattern.outcome === 'failed';
                      const isConfirmed = pattern.outcome === 'confirmed';
                      
                      let bgColor, borderColor, textColor, iconColor;
                      if (isFailed) {
                        bgColor = pattern.type === 'bearish' ? 'bg-profit/5' : 'bg-loss/5';
                        borderColor = pattern.type === 'bearish' ? 'border-profit/20' : 'border-loss/20';
                        textColor = pattern.type === 'bearish' ? 'text-profit' : 'text-loss';
                        iconColor = 'text-text-muted';
                      } else {
                        bgColor = pattern.type === 'bullish' ? 'bg-profit/5' : pattern.type === 'bearish' ? 'bg-loss/5' : 'bg-surface-3';
                        borderColor = pattern.type === 'bullish' ? 'border-profit/20' : pattern.type === 'bearish' ? 'border-loss/20' : 'border-border';
                        textColor = pattern.type === 'bullish' ? 'text-profit' : pattern.type === 'bearish' ? 'text-loss' : 'text-text-secondary';
                        iconColor = pattern.type === 'bullish' ? 'text-profit' : pattern.type === 'bearish' ? 'text-loss' : 'text-text-muted';
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
                              {isFailed && <span className="text-xs text-text-muted line-through">{pattern.name}</span>}
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
              
              <div className="mt-4 flex items-center gap-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${structureIntact ? 'bg-profit' : 'bg-loss'}`}></span>
                  <span className="text-sm text-text-muted">
                    Structure: <span className={`font-medium ${structureIntact ? 'text-profit' : 'text-loss'}`}>
                      {structureIntact ? 'Intact' : 'Broken'}
                    </span>
                  </span>
                </div>
                <div className="text-sm text-text-muted">|</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-muted">
                    Classification: <span className={`font-medium ${
                      classification === 'likely-pullback' ? 'text-profit' :
                      classification === 'trend-reversal-risk' ? 'text-loss' : 
                      classification === 'breakout-attempt' ? 'text-yellow-500' : 'text-text-secondary'
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
                className="group relative px-10 py-4 bg-accent hover:bg-accent-hover text-white text-lg font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAiEvaluating ? (
                  <span className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    AI is analyzing all indicators and patterns...
                  </span>
                ) : (
                  "Evaluate by AI"
                )}
              </button>
              <p className="text-text-muted text-sm text-center max-w-md">
                AI will analyze all indicators, candlestick patterns, and price structure to provide a comprehensive trading assessment, projections, and strategy
              </p>
              {aiError && (
                <div className="p-3 rounded-lg bg-loss/10 border border-loss/30 text-loss text-sm max-w-md text-center">
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
              <div className="bg-surface-1 rounded-xl p-6 border border-border">
                <h3 className="text-lg font-semibold text-text-primary mb-6 flex items-center gap-2">
                  AI Evaluation
                  <span className="bg-accent/10 text-accent px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider">
                    {(report as any).aiModel || 'AI'}
                  </span>
                </h3>
                
                <div className="flex flex-wrap items-center gap-6 md:gap-8">
                  <div className="flex items-center gap-3">
                    <DirectionIndicator direction={aiSignal.direction as 'bullish' | 'bearish' | 'neutral'} size="lg" />
                    <SignalBadge signal={aiSignal.direction} size="lg" />
                  </div>
                  <div className="flex items-center gap-6 md:gap-8">
                    <div className="flex flex-col items-center min-w-[60px]">
                      <div className="text-xs text-text-muted mb-1">Signal Grade</div>
                      <GradeBadge grade={aiSignal.grade} />
                    </div>
                    <div className="flex flex-col items-center min-w-[60px]">
                      <div className="text-xs text-text-muted mb-1">Strength</div>
                      <div className="text-2xl font-bold text-text-primary">{aiSignal.overall}<span className="text-sm font-normal text-text-muted">/100</span></div>
                    </div>
                    <div className="flex flex-col items-center min-w-[80px]">
                      <div className="text-xs text-text-muted mb-1">Confidence</div>
                      <div className={`text-lg font-semibold ${
                        mergedRecommendation.confidence >= 70 ? 'text-profit' :
                        mergedRecommendation.confidence >= 50 ? 'text-yellow-500' : 'text-loss'
                      }`}>
                        {mergedRecommendation.confidence >= 70 ? 'HIGH' : mergedRecommendation.confidence >= 50 ? 'MEDIUM' : 'LOW'}
                        <span className="text-xs ml-1 opacity-70">({mergedRecommendation.confidence}%)</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {aiSignal.reasoning && aiSignal.reasoning.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-border">
                    <h4 className="text-xs font-bold text-accent uppercase tracking-widest mb-3">Reasoning</h4>
                    <div className="space-y-2">
                      {aiSignal.reasoning.map((reason, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <span className="text-accent shrink-0 mt-0.5">•</span>
                          <span className="leading-relaxed">{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Signal Breakdown */}
              {Object.keys(aiBreakdown || {}).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(aiBreakdown || {}).map(([key, data]) => {
                  const d = data as any;
                  const score = typeof d?.score === 'number' ? d.score : 50;
                  const displayText = d?.assessment || d?.signal || '';
                  return (
                  <div key={key} className="bg-surface-1 rounded-xl p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-text-secondary capitalize">{key}</span>
                      <span className="text-xl font-bold text-text-primary">{score}</span>
                    </div>
                    <Gauge value={score} colorScheme="signal" />
                    {displayText && <div className="text-xs text-text-muted mt-2 leading-relaxed line-clamp-3">{displayText}</div>}
                  </div>
                  );
                })}
              </div>
              )}

              {/* AI Structure Analysis */}
              {report.aiEnhanced!.structureAnalysis && (
                <div className="bg-surface-1 rounded-xl p-6 border border-border">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">
                    AI Structure Analysis
                  </h3>
                  <div className="p-4 rounded-xl bg-surface-2 mb-4">
                    <p className="text-base text-text-secondary leading-relaxed">{report.aiEnhanced!.structureAnalysis.summary}</p>
                  </div>
                  {report.aiEnhanced!.structureAnalysis.patternAnalysis && (
                    <div className="p-4 rounded-xl bg-surface-2 border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-accent">AI Pattern Interpretation</h4>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed">{report.aiEnhanced!.structureAnalysis.patternAnalysis}</p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Price Projections */}
              {report.aiEnhanced!.priceProjections && (() => {
                const formatTarget = (target: number | string, targetLow?: number, targetHigh?: number): string => {
                  if (targetLow !== undefined && targetHigh !== undefined && (targetLow > 0 || targetHigh > 0)) {
                    return `$${targetLow.toFixed(2)} - $${targetHigh.toFixed(2)}`;
                  }
                  if (typeof target === 'string' && target && target !== '0') {
                    return target.startsWith('$') ? target : `$${target}`;
                  }
                  const num = typeof target === 'number' ? target : parseFloat(String(target));
                  if (num > 0) return `$${num.toFixed(2)}`;
                  return '—';
                };
                
                const proj = report.aiEnhanced!.priceProjections;
                
                return (
                <div className="bg-surface-1 rounded-xl p-6 border border-border">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">
                    AI Price Projections
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`p-4 rounded-xl border ${
                      proj.mostLikely === 'bull' 
                        ? 'bg-profit/10 border-profit/50' 
                        : 'bg-profit/5 border-profit/20'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-profit">Bull Case</div>
                        {proj.mostLikely === 'bull' && (
                          <span className="text-[10px] bg-profit/20 text-profit px-1.5 py-0.5 rounded">Most Likely</span>
                        )}
                      </div>
                      <div className="text-xl font-mono text-text-primary mb-1">
                        {formatTarget(proj.bullCase.target, (proj.bullCase as any).targetLow, (proj.bullCase as any).targetHigh)}
                      </div>
                      <div className="text-sm text-text-muted">{proj.bullCase.probability}% • {proj.bullCase.timeframe}</div>
                      <div className="text-xs text-text-muted mt-2">{proj.bullCase.reasoning}</div>
                    </div>
                    
                    <div className={`p-4 rounded-xl border ${
                      proj.mostLikely === 'base' 
                        ? 'bg-accent/10 border-accent/50' 
                        : 'bg-accent/5 border-accent/20'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-accent">Base Case</div>
                        {proj.mostLikely === 'base' && (
                          <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">Most Likely</span>
                        )}
                      </div>
                      <div className="text-xl font-mono text-text-primary mb-1">
                        {formatTarget(proj.baseCase.target, (proj.baseCase as any).targetLow, (proj.baseCase as any).targetHigh)}
                      </div>
                      <div className="text-sm text-text-muted">{proj.baseCase.probability}% • {proj.baseCase.timeframe}</div>
                      <div className="text-xs text-text-muted mt-2">{proj.baseCase.reasoning}</div>
                    </div>
                    
                    <div className={`p-4 rounded-xl border ${
                      proj.mostLikely === 'bear' 
                        ? 'bg-loss/10 border-loss/50' 
                        : 'bg-loss/5 border-loss/20'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-loss">Bear Case</div>
                        {proj.mostLikely === 'bear' && (
                          <span className="text-[10px] bg-loss/20 text-loss px-1.5 py-0.5 rounded">Most Likely</span>
                        )}
                      </div>
                      <div className="text-xl font-mono text-text-primary mb-1">
                        {formatTarget(proj.bearCase.target, (proj.bearCase as any).targetLow, (proj.bearCase as any).targetHigh)}
                      </div>
                      <div className="text-sm text-text-muted">{proj.bearCase.probability}% • {proj.bearCase.timeframe}</div>
                      <div className="text-xs text-text-muted mt-2">{proj.bearCase.reasoning}</div>
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* AI Strategy Recommendation */}
              <div className="bg-surface-1 rounded-xl p-6 border border-border">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  AI Strategy Recommendation
                </h3>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className={`px-5 py-2 rounded-xl font-bold text-xl ${
                    mergedRecommendation.direction === 'long' ? 'bg-profit/10 text-profit' :
                    mergedRecommendation.direction === 'short' ? 'bg-loss/10 text-loss' :
                    'bg-yellow-500/10 text-yellow-500'
                  }`}>
                    {mergedRecommendation.direction === 'wait' ? 'WAIT' : mergedRecommendation.direction.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-lg text-text-primary font-medium">{mergedRecommendation.strategy}</div>
                    <div className="text-sm text-text-muted">Confidence: {mergedRecommendation.confidence}%</div>
                  </div>
                </div>
                
                {mergedRecommendation.direction === 'wait' ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-surface-2">
                      <div className="text-sm font-medium text-text-secondary mb-3">Conditions to Watch</div>
                      <div className="space-y-2">
                        {(mergedRecommendation.entry.conditions?.length ? mergedRecommendation.entry.conditions : [mergedRecommendation.invalidation || 'Wait for clearer setup with volume confirmation'].filter(Boolean)).map((condition, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-yellow-500 mt-0.5 shrink-0">→</span>
                            <span className="text-text-secondary">{condition}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {(() => {
                      const t1 = mergedRecommendation.targets?.t1?.price ?? 0;
                      const t3 = mergedRecommendation.targets?.t3?.price ?? 0;
                      const cp = report.currentPrice;
                      if (t1 <= 0 && t3 <= 0) {
                        return (
                          <div className="p-3 rounded-lg bg-surface-2 text-sm text-text-muted">
                            <span className="font-medium text-yellow-500">Note:</span> No clear trading edge. 
                            Wait for price to break above resistance or below support with volume confirmation before taking a position.
                          </div>
                        );
                      }
                      let resistance: number, support: number;
                      if (t1 > cp && t3 < cp) { resistance = t1; support = t3; }
                      else if (t3 > cp && t1 < cp) { resistance = t3; support = t1; }
                      else if (t1 > t3) { resistance = t1; support = t3; }
                      else { resistance = t3; support = t1; }
                      
                      return (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-profit/5 border border-profit/20">
                          <div className="text-sm text-profit mb-1">Resistance (Bullish Breakout)</div>
                          <div className="text-xl font-mono text-text-primary">${resistance.toFixed(2)}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-loss/5 border border-loss/20">
                          <div className="text-sm text-loss mb-1">Support (Bearish Breakdown)</div>
                          <div className="text-xl font-mono text-text-primary">${support.toFixed(2)}</div>
                        </div>
                      </div>
                      );
                    })()}
                    
                    <div className="p-3 rounded-lg bg-surface-2 text-sm text-text-muted">
                      <span className="font-medium text-yellow-500">Note:</span> No clear trading edge. 
                      Wait for price to break above resistance or below support with volume confirmation before taking a position.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="p-4 rounded-xl bg-surface-2">
                        <div className="text-sm text-text-muted mb-1">Entry ({mergedRecommendation.entry.type})</div>
                        <div className="text-2xl font-mono text-text-primary">${(mergedRecommendation.entry.price || report.currentPrice).toFixed(2)}</div>
                        {mergedRecommendation.entry.conditions?.length > 0 && (
                          <div className="text-sm text-text-muted mt-2">
                            {mergedRecommendation.entry.conditions[0]}
                          </div>
                        )}
                      </div>
                      <div className="p-4 rounded-xl bg-loss/5 border border-loss/20">
                        <div className="text-sm text-loss mb-1">Stop Loss</div>
                        <div className="text-2xl font-mono text-loss">${(mergedRecommendation.stopLoss.price || report.currentPrice * 0.93).toFixed(2)}</div>
                        <div className="text-sm text-text-muted mt-2">
                          Risk: {mergedRecommendation.stopLoss.riskPercent?.toFixed(1) || '—'}% • {mergedRecommendation.stopLoss.reason || 'No trade - reference level only'}
                        </div>
                      </div>
                    </div>
                    
                    {(() => {
                      const hasValidTargets = Object.values(mergedRecommendation.targets).some(t => t?.price > 0);
                      if (!hasValidTargets) {
                        return (
                          <div className="p-4 rounded-xl bg-surface-2 text-text-muted text-sm">
                            No price targets provided — WAIT recommendation. Reference: Entry ${(mergedRecommendation.entry.price || report.currentPrice).toFixed(2)}, Invalidation: {mergedRecommendation.invalidation || 'See conditions above'}
                          </div>
                        );
                      }
                      return (
                    <div>
                      <h4 className={`text-base font-medium mb-3 ${
                        mergedRecommendation.direction === 'long' ? 'text-profit' : 'text-loss'
                      }`}>
                        {mergedRecommendation.direction === 'long' ? 'Long Targets' : 'Short Targets'}
                      </h4>
                      <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead>
                          <tr className="text-sm text-text-muted border-b border-border">
                            <th className="text-left py-2 font-medium">Target</th>
                            <th className="text-right py-2 font-medium">Price</th>
                            <th className="text-right py-2 font-medium">From Entry</th>
                            <th className="text-right py-2 font-medium">From Current</th>
                            <th className="text-right py-2 font-medium">R:R</th>
                            <th className="text-right py-2 font-medium">Est. Prob</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {Object.entries(mergedRecommendation.targets)
                            .filter(([, t]) => t?.price > 0)
                            .map(([key, target]) => {
                            const entryPrice = mergedRecommendation.entry.price || report.currentPrice;
                            const currentPrice = report.currentPrice;
                            const moveFromEntry = mergedRecommendation.direction === 'long' 
                              ? ((target.price - entryPrice) / entryPrice) * 100
                              : ((entryPrice - target.price) / entryPrice) * 100;
                            const moveFromCurrent = mergedRecommendation.direction === 'long'
                              ? ((target.price - currentPrice) / currentPrice) * 100
                              : ((currentPrice - target.price) / currentPrice) * 100;
                            
                            return (
                            <tr key={key} className="text-base">
                              <td className="py-3 text-text-secondary font-medium">{key.toUpperCase()}</td>
                              <td className={`py-3 text-right font-mono ${
                                mergedRecommendation.direction === 'long' ? 'text-profit' : 'text-loss'
                              }`}>${target.price.toFixed(2)}</td>
                              <td className="py-3 text-right text-text-secondary">
                                <span className={moveFromEntry >= 0 ? 'text-profit' : 'text-loss'}>
                                  {moveFromEntry >= 0 ? '+' : ''}{moveFromEntry.toFixed(2)}%
                                </span>
                              </td>
                              <td className="py-3 text-right text-text-secondary">
                                <span className={moveFromCurrent >= 0 ? 'text-profit' : 'text-loss'}>
                                  {moveFromCurrent >= 0 ? '+' : ''}{moveFromCurrent.toFixed(2)}%
                                </span>
                              </td>
                              <td className="py-3 text-right text-text-primary font-semibold">{(target.rr || 0) > 0 ? `${target.rr}:1` : '—'}</td>
                              <td className="py-3 text-right text-text-muted">{(target.probability || 0) > 0 ? `~${target.probability}%` : '—'}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                      <div className="mt-3 text-xs text-text-muted flex flex-wrap items-center gap-4">
                        <span>• <span className="text-text-secondary">From Entry:</span> % move from entry price (${(mergedRecommendation.entry.price || report.currentPrice).toFixed(2)})</span>
                        <span>• <span className="text-text-secondary">From Current:</span> % move from current price (${report.currentPrice.toFixed(2)})</span>
                      </div>
                    </div>
                      );
                    })()}
                    
                    {mergedRecommendation.invalidation && (
                      <div className="mt-4 p-3 rounded-lg bg-surface-2 text-sm text-text-muted">
                        <span className="font-medium text-text-secondary">Invalidation:</span> {mergedRecommendation.invalidation}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* AI Summary */}
              {report.aiSummary && (
                <div className="bg-surface-1 rounded-xl p-6 border border-border">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">
                    AI Technical Summary
                  </h3>
                  
                  <div className="text-base font-medium text-accent mb-4 leading-relaxed">
                    {report.aiSummary.headline}
                  </div>
                  
                  {report.aiSummary.technicalOutlook && (
                    <p className="text-sm text-text-secondary leading-relaxed mb-6">
                      {report.aiSummary.technicalOutlook}
                    </p>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="text-base font-medium text-profit mb-3">Key Insights</h4>
                      {report.aiSummary.keyInsights?.length > 0 ? (
                        <ul className="space-y-2">
                          {report.aiSummary.keyInsights.map((insight, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                              <span className="text-profit mt-0.5 shrink-0">✓</span>
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-text-muted italic">See summary above</p>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="text-base font-medium text-loss mb-3">Risk Factors</h4>
                      {report.aiSummary.riskFactors?.length > 0 ? (
                        <ul className="space-y-2">
                          {report.aiSummary.riskFactors.map((risk, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                              <span className="text-loss mt-0.5 shrink-0">!</span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-text-muted italic">See summary above</p>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="text-base font-medium text-accent mb-3">Trading Plan</h4>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {report.aiSummary.tradingPlan || 'See recommendation section.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
            );
          })()}

          {/* Footer */}
          <div className="text-center text-text-muted text-sm py-4">
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
