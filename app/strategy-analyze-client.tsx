"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import SqueezeAnalysisCard from "./components/squeeze-analysis-card";
import TradeCaseCard from "./components/trade-case-card";

// Types for the new strategy system
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

interface StrategyResponse {
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
    // Flat structure (not nested under "combined")
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

export default function StrategyAnalyzeClient() {
  const searchParams = useSearchParams();
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("1day");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<StrategyResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Auto-fill symbol from URL parameter and trigger analysis
  useEffect(() => {
    const urlSymbol = searchParams.get('symbol');
    if (urlSymbol) {
      setSymbol(urlSymbol.toUpperCase());
      // Auto-trigger analysis after a short delay to allow state to update
      setTimeout(() => {
        handleAnalyzeWithSymbol(urlSymbol.toUpperCase());
      }, 100);
    }
  }, [searchParams]);

  const handleAnalyzeWithSymbol = async (symbolToAnalyze: string) => {
    if (!symbolToAnalyze.trim()) {
      setError("Please enter a ticker symbol");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);
    setSaveSuccess(false);
    setSaveError("");

    try {
      const response = await fetch("/api/strategy-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbolToAnalyze.toUpperCase(),
          timeframe,
          recordHistory: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Strategy analysis failed");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    await handleAnalyzeWithSymbol(symbol);
  };

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

  const handleSaveReport = async () => {
    if (!result) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      // Get the strategy name from evaluation
      const strategyName = result.evaluation.metadata?.isUserStrategy
        ? (result.evaluation.metadata?.strategyName || 'Custom Strategy')
        : formatStrategyName(result.evaluation.strategy);

      const title = `${symbol.toUpperCase()} Strategy Analysis - ${timeframe}`;
      const description = `Strategy analysis for ${symbol.toUpperCase()} on ${timeframe} timeframe. Strategy: ${strategyName}. Generated on ${new Date().toLocaleDateString()}`;

      // Build tags array, excluding 'user_defined' for user-created strategies
      const tags = [
        symbol.toUpperCase(),
        timeframe,
        "strategy-analysis",
      ];

      // Add strategy name as tag only if it's not 'user_defined'
      if (result.evaluation.strategy !== 'user_defined') {
        tags.push(result.evaluation.strategy);
      } else if (result.evaluation.metadata?.strategyName) {
        // For user-defined strategies, add the custom strategy name instead
        tags.push(result.evaluation.metadata.strategyName);
      }

      const response = await fetch("/api/reports/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "strategy-analysis",
          title,
          description,
          parameters: {
            symbol: symbol.toUpperCase(),
            timeframe,
          },
          reportData: result,
          cachedData: {
            // Store cacheable data for optimization
            squeezeAnalysis: result.squeezeAnalysis,
            timestamp: new Date().toISOString(),
          },
          tags,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save report");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          AI Strategy Analysis v1.1
        </h1>
        <p className="text-blue-200">
          Advanced swing trading strategy evaluation with 6 specific strategies,
          multi-bar confirmations, and historical performance context.
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-6 mb-6 border border-white/20">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="symbol" className="block text-sm font-medium text-blue-200 mb-2">
              Ticker Symbol
            </label>
            <input
              type="text"
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL, TSLA, MSFT"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={isLoading}
            />
          </div>
          <div className="sm:w-48">
            <label htmlFor="timeframe" className="block text-sm font-medium text-blue-200 mb-2">
              Timeframe
            </label>
            <select
              id="timeframe"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={isLoading}
            >
              <option value="1day">Daily</option>
              <option value="1hour">Hourly</option>
              <option value="15min">15 Min</option>
              <option value="5min">5 Min</option>
              <option value="1min">1 Min</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !symbol.trim()}
              className="px-6 py-2 bg-gradient-to-r from-teal-500 to-blue-500 text-white rounded-lg hover:from-teal-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/30 transition-all"
            >
              {isLoading ? "Analyzing..." : "Analyze Strategy"}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Analysis Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {result.context.symbol} - {result.context.name}
                </h2>
                <p className="text-blue-200">
                  ${result.context.currentPrice.toFixed(2)} • {result.context.timeframe} • {result.context.spyRegime} regime
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveReport}
                  disabled={isSaving}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      Save Report
                    </>
                  )}
                </button>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(result.evaluation.status)}`}>
                  {getStatusIcon(result.evaluation.status)} {result.evaluation.status.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Save Success/Error Messages */}
            {saveSuccess && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-800 text-sm">
                  <span>✅</span>
                  <span>Report saved successfully! View it in the <a href="/reports" className="underline font-medium">Reports</a> section.</span>
                </div>
              </div>
            )}
            {saveError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-800 text-sm">
                  <span>❌</span>
                  <span>Failed to save: {saveError}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/10 rounded-lg p-4 border border-white/10">
                <div className="text-sm text-blue-200">Strategy</div>
                <div className="text-lg font-semibold text-white">
                  {result.evaluation.metadata?.isUserStrategy
                    ? (result.evaluation.metadata?.strategyName || 'Custom Strategy')
                    : formatStrategyName(result.evaluation.strategy)}
                </div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 border border-white/10">
                <div className="text-sm text-blue-200">Quality</div>
                <div className="text-lg font-semibold text-white">
                  {(result.evaluation.quality * 100).toFixed(0)}%
                </div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 border border-white/10">
                <div className="text-sm text-blue-200">Viability</div>
                <div className="text-lg font-semibold text-white">
                  {(result.evaluation.viability * 100).toFixed(0)}%
                </div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 border border-white/10">
                <div className="text-sm text-blue-200">R:R (First)</div>
                <div className="text-lg font-semibold text-white">
                  {result.evaluation.rrFirst.toFixed(2)}:1
                </div>
              </div>
            </div>
          </div>

          {/* Trade Plan & Trade Case - Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trade Plan */}
            {result.evaluation.plan && (
              <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl p-6 border border-white/10">
                <h3 className="text-xl font-semibold text-white mb-4">Trade Plan</h3>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-medium text-white mb-3">Entry & Risk</h4>
                    <div className="space-y-2">
                      {(() => {
                        const plan = result.evaluation.plan!;
                        const entry = plan.entry;
                        const stop = plan.stop;
                        const current = result.context.currentPrice;
                        const dir = plan.direction;
                        const formatPct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
                        const entryOffset = (entry - current) / current; // entry vs current
                        const stopPct = (stop - entry) / entry; // signed for both long/short
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
                        <span className="font-medium text-white">${result.summary.risk.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-200">Position Size:</span>
                        <span className="font-medium text-white">{result.summary.positionSize.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-white mb-3">Targets</h4>
                    <div className="space-y-2">
                      {(() => {
                        const plan = result.evaluation.plan!;
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
            {result.mentor && (result.mentor.forTrade || result.mentor.againstTrade) && (
              <TradeCaseCard
                forTrade={result.mentor.forTrade}
                againstTrade={result.mentor.againstTrade}
              />
            )}
          </div>

          {/* Squeeze Analysis */}
          {result.squeezeAnalysis && (
            <SqueezeAnalysisCard squeezeAnalysis={result.squeezeAnalysis} />
          )}

          {/* Technical Indicators */}
          <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl border border-white/10 p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Technical Indicators</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-sm text-blue-200">EMA 9</div>
                <div className="text-lg font-semibold text-white">${result.technical.ema9.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-blue-200">EMA 20</div>
                <div className="text-lg font-semibold text-white">${result.technical.ema20.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-blue-200">EMA 50</div>
                <div className="text-lg font-semibold text-white">${result.technical.ema50.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-blue-200">EMA 200</div>
                <div className="text-lg font-semibold text-white">${result.technical.ema200.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-blue-200">RSI 14</div>
                <div className="text-lg font-semibold text-white">{result.technical.rsi14.toFixed(1)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-blue-200">ATR</div>
                <div className="text-lg font-semibold text-white">${result.technical.atr.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-blue-200">ATR %</div>
                <div className="text-lg font-semibold text-white">{result.technical.atrPct.toFixed(2)}%</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-blue-200">Volume Z</div>
                <div className="text-lg font-semibold text-white">{result.technical.volZ.toFixed(2)}</div>
              </div>
            </div>
          </div>



          {/* Strategy Evaluation Summary */}
          {result.evaluation.metadata?.strategyDetails && result.evaluation.metadata.strategyDetails.length > 0 && (
            <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl border border-white/10 p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Strategy Evaluation Summary</h3>
              <div className="mb-4 text-blue-100">
                Evaluated <span className="font-semibold text-white">{result.evaluation.metadata.totalEvaluated || 6}</span> strategies •
                <span className="font-semibold text-teal-300"> {result.evaluation.metadata.eligibleFound || 0}</span> eligible •
                <span className="font-semibold text-green-300"> {result.evaluation.metadata.passedRR || 0}</span> passed R:R minimum
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.evaluation.metadata.strategyDetails.map((detail: any, index: number) => (
                  <div key={index} className={`p-4 rounded-lg border ${detail.strategy === result.evaluation.strategy
                    ? 'bg-teal-500/20 border-teal-500/50'
                    : 'bg-white/5 border-white/10'
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-white">
                        {formatStrategyName(detail.strategy)}
                      </div>
                      {detail.strategy === result.evaluation.strategy && (
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
              {result.mentor.aiGenerated && (
                <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs font-medium text-purple-300">
                  {result.mentor.aiModel || 'AI'} Powered
                </span>
              )}
            </div>
            <div className="space-y-6">
              {result.mentor.explanation.split('\n\n').map((section, index) => {
                // Skip empty sections
                if (!section.trim()) return null;

                // Check if it's a header (starts with ** and ends with **)
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

                // Check if it's a bullet point section
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

                // Regular paragraph
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
          {result.evaluation.reasons.length > 0 && (
            <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl border border-white/10 p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Analysis Reasons</h3>
              <ul className="space-y-2">
                {result.evaluation.reasons.map((reason, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span className="text-white">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Block Reason */}
          {result.evaluation.blockReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-red-800 mb-2">Trade Blocked</h3>
              <p className="text-red-700">{result.evaluation.blockReason}</p>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl border border-white/10 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-200">Analyzing strategy patterns and market conditions...</p>
        </div>
      )}
    </div>
  );
}
