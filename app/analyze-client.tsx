"use client";

import { useState } from "react";
import { AnalysisReport } from "./api/analyze/route";

export default function AnalyzeClient() {
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("1day");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<AnalysisReport | null>(null);

  const handleAnalyze = async () => {
    if (!symbol.trim()) {
      setError("Please enter a ticker symbol");
      return;
    }

    setIsLoading(true);
    setError("");
    setReport(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: symbol.toUpperCase(), timeframe })
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

  const getRatingColor = (rating: string) => {
    if (rating.startsWith("A")) return "text-green-400";
    if (rating.startsWith("B")) return "text-blue-400";
    if (rating.startsWith("C")) return "text-yellow-400";
    return "text-red-400";
  };

  const getPatternColor = (type: string) => {
    if (type === "bullish") return "text-green-400 bg-green-500/10 border-green-500/30";
    if (type === "bearish") return "text-red-400 bg-red-500/10 border-red-500/30";
    return "text-blue-400 bg-blue-500/10 border-blue-500/30";
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
        <h3 className="text-2xl font-bold text-white mb-4">Analyze a Ticker</h3>
        <p className="text-blue-200 mb-6">
          Enter a stock symbol to receive a comprehensive technical analysis with entry/exit points
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-blue-100 mb-2">
              Ticker Symbol
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL, TSLA, SPY"
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-200/50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent uppercase"
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
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              disabled={isLoading}
            >
              <option value="1day">Daily</option>
              <option value="1hour">1 Hour</option>
              <option value="15min">15 Min</option>
              <option value="5min">5 Min</option>
              <option value="1min">1 Min</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="mt-4 w-full md:w-auto px-8 py-3 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white font-semibold rounded-lg shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Analyzing..." : "Analyze"}
        </button>

        {error && (
          <div className="mt-4 p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
          <div className="inline-block w-16 h-16 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mb-4"></div>
          <p className="text-white text-lg">Analyzing {symbol}...</p>
          <p className="text-blue-200 text-sm mt-2">Fetching data, calculating indicators, detecting patterns...</p>
        </div>
      )}

      {/* Analysis Report */}
      {report && !isLoading && (
        <div className="space-y-6">
          {/* Data Freshness Warning */}
          {report.marketData.dataAgeDays > 7 && (
            <div className="bg-red-500/20 backdrop-blur-lg rounded-2xl p-6 border border-red-500/50">
              <div className="flex items-start gap-4">
                <div className="text-3xl">🛑</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-red-300 mb-2">Critical: Very Stale Data</h3>
                  <p className="text-red-100 mb-3">
                    This analysis is based on data from <strong>{new Date(report.marketData.lastBarDate).toLocaleDateString()}</strong> 
                    - that's <strong>{report.marketData.dataAgeDays} days ago</strong>!
                  </p>
                  <p className="text-red-100 mb-3">
                    <strong>⚠️ This stock may be delisted, suspended, or have no recent trading activity.</strong> Data this old is NOT suitable for trading decisions.
                  </p>
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mt-3">
                    <p className="text-red-200 font-semibold mb-2">DO NOT TRADE based on this analysis!</p>
                    <ul className="text-red-100 text-sm space-y-1">
                      <li>✓ Verify the stock is still actively trading</li>
                      <li>✓ Check if company was delisted or acquired</li>
                      <li>✓ Use TradingView or your broker for current status</li>
                      <li>✓ If trading, get current data before any decisions</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {report.marketData.dataAgeDays > 1 && report.marketData.dataAgeDays <= 7 && (
            <div className="bg-yellow-500/20 backdrop-blur-lg rounded-2xl p-6 border border-yellow-500/50">
              <div className="flex items-start gap-4">
                <div className="text-3xl">⚠️</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-yellow-300 mb-2">Data Freshness Note</h3>
                  <p className="text-yellow-100 mb-3">
                    This analysis uses data from <strong>{new Date(report.marketData.lastBarDate).toLocaleDateString()}</strong> 
                    ({report.marketData.dataAgeDays} day{report.marketData.dataAgeDays > 1 ? 's' : ''} ago). 
                    Price shown: ${report.currentPrice.toFixed(2)}
                  </p>
                  <p className="text-yellow-100 mb-3">
                    <strong>End-of-Day Data Timing:</strong> Polygon provides end-of-day data that typically becomes available 
                    2-4 hours after market close (around 6:00-8:00 PM ET) once settlement is complete. 
                    Weekend/holiday gaps are normal.
                  </p>
                  <p className="text-yellow-100 mb-3">
                    <strong>Free Tier Limitations:</strong> Polygon's free tier data may be marked as "DELAYED" and could be 
                    15 minutes to several days behind real-time, depending on the ticker. This is expected behavior for free API access.
                    For most recent data, Polygon typically updates after market close + settlement (6-8 PM ET).
                  </p>
                  <p className="text-yellow-100 mb-3">
                    <strong>⚠️ No new bar yet</strong> — Verify with latest intraday data before acting. The most recent daily candle may still be forming.
                  </p>
                  <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mt-3">
                    <p className="text-yellow-200 font-semibold mb-2">Before Trading:</p>
                    <ul className="text-yellow-100 text-sm space-y-1">
                      <li>✓ Verify current price hasn't gapped significantly</li>
                      <li>✓ Check for major news or earnings</li>
                      <li>✓ Confirm technical setup still valid</li>
                      <li>✓ Use TradingView or broker for current price</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header Card */}
          <div className="bg-gradient-to-r from-slate-900/80 to-blue-900/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  {report.symbol} — {report.timeframe}
                  <span className={`ml-4 px-3 py-1 rounded-lg text-sm font-semibold ${report.riskManagement.direction === 'long' ? 'bg-green-500/20 text-green-300 border border-green-500/50' : 'bg-red-500/20 text-red-300 border border-red-500/50'}`}>
                    {report.riskManagement.direction === 'long' ? '📈 LONG' : '📉 SHORT'} Setup
                  </span>
                  <span className="mx-2 text-blue-300">•</span>
                  <span className={`px-3 py-1 rounded-lg text-sm font-semibold border ${getPatternColor(report.pattern.type)}`}>
                    Candlestick: {report.pattern.name} ({report.pattern.confidence}%)
                  </span>
                </h2>
                <p className="text-blue-200">{report.name}</p>
                <p className="text-sm text-blue-300 mt-1">
                  Price (from data): <span className="text-white font-semibold">${report.currentPrice.toFixed(2)}</span>
                  {report.marketData.exchange && <span className="ml-4">• {report.marketData.exchange}</span>}
                  {report.marketData.marketCap && (
                    <span className="ml-4">• Market Cap: ${(report.marketData.marketCap / 1e9).toFixed(2)}B</span>
                  )}
                </p>
                <p className="text-xs text-blue-400 mt-1">
                  Last data: {new Date(report.marketData.lastBarDate).toLocaleDateString()} 
                  {report.marketData.dataAgeDays > 0 && (
                    <span className="text-yellow-400"> ({report.marketData.dataAgeDays} day{report.marketData.dataAgeDays > 1 ? 's' : ''} old)</span>
                  )}
                </p>
              </div>

              <div className="text-right">
                <div className={`text-5xl font-bold ${getRatingColor(report.score.rating)}`}>
                  {report.score.rating}
                </div>
                <div className="text-white font-semibold mt-2">{report.score.overall}/100</div>
                <div className="text-blue-200 text-sm mb-1">{report.score.recommendation}</div>
                <div className="text-blue-300 text-xs italic">
                  {report.score.overall >= 76 ? "High conviction setup" : 
                   report.score.overall >= 61 ? "Solid setup, watch confirmation" : 
                   report.score.overall >= 41 ? "Neutral - wait for confirmation" : 
                   "Low conviction - avoid"}
                </div>
              </div>
            </div>
          </div>

          {/* Chart Pattern & Pattern Fusion */}
          {report.chartPattern && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">📐 Chart Pattern Analysis</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <h4 className="text-purple-300 font-semibold mb-2">🏗️ Market Structure</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-blue-200 text-sm">Pattern:</span>
                      <span className={`font-semibold ${report.chartPattern.type === 'bullish' ? 'text-green-400' : report.chartPattern.type === 'bearish' ? 'text-red-400' : 'text-white'}`}>
                        {report.chartPattern.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-200 text-sm">Confidence:</span>
                      <span className="text-white font-semibold">{report.chartPattern.confidence}% ({report.chartPattern.confidenceLabel})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-200 text-sm">Breakout:</span>
                      <span className={`font-semibold ${report.chartPattern.breakoutStatus === 'confirmed' ? 'text-green-400' : report.chartPattern.breakoutStatus === 'pending' ? 'text-yellow-400' : 'text-blue-400'}`}>
                        {report.chartPattern.breakoutStatus}
                      </span>
                    </div>
                    {report.chartPattern.volumeZScore !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-blue-200 text-sm">Volume Z-Score:</span>
                        <span className={`font-semibold ${report.chartPattern.volumeZScore > 1 ? 'text-green-400' : report.chartPattern.volumeZScore < -1 ? 'text-red-400' : 'text-white'}`}>
                          {report.chartPattern.volumeZScore > 0 ? '+' : ''}{report.chartPattern.volumeZScore}
                        </span>
                      </div>
                    )}
                    {report.chartPattern.priceTarget && (
                      <div className="flex justify-between">
                        <span className="text-blue-200 text-sm">Price Target:</span>
                        <span className="text-white font-semibold">${report.chartPattern.priceTarget.toFixed(2)}</span>
                      </div>
                    )}
                    {report.chartPattern.metadata?.tightness && (
                      <div className="flex justify-between">
                        <span className="text-blue-200 text-sm">Tightness:</span>
                        <span className="text-white font-semibold">{report.chartPattern.metadata.tightness}%</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-teal-500/10 border border-teal-500/30">
                  <h4 className="text-teal-300 font-semibold mb-2">⚡ Entry Timing</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-blue-200 text-sm">Candlestick:</span>
                      <span className={`font-semibold ${report.pattern.type === 'bullish' ? 'text-green-400' : report.pattern.type === 'bearish' ? 'text-red-400' : 'text-white'}`}>
                        {report.pattern.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-200 text-sm">Confidence:</span>
                      <span className="text-white font-semibold">{report.pattern.confidence}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pattern Fusion Analysis */}
              <div className={`p-4 rounded-lg ${report.patternFusion.fusionBonus > 0 ? 'bg-green-500/10 border border-green-500/30' : report.patternFusion.fusionBonus < 0 ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-blue-500/10 border border-blue-500/30'}`}>
                <h4 className={`font-semibold mb-2 ${report.patternFusion.fusionBonus > 0 ? 'text-green-300' : report.patternFusion.fusionBonus < 0 ? 'text-yellow-300' : 'text-blue-300'}`}>
                  🎯 Composite Confidence: {report.patternFusion.fusedConfidence}/100
                  {report.patternFusion.fusionBonus > 0 && (
                    <span className="ml-2 text-sm">(Structure + Timing alignment)</span>
                  )}
                  {report.patternFusion.fusionBonus < 0 && (
                    <span className="ml-2 text-sm">(Conflicting signals)</span>
                  )}
                  {report.patternFusion.fusionBonus === 0 && (
                    <span className="ml-2 text-sm">(Single pattern signal)</span>
                  )}
                </h4>
                <p className={`text-sm ${report.patternFusion.fusionBonus > 0 ? 'text-green-200' : report.patternFusion.fusionBonus < 0 ? 'text-yellow-200' : 'text-blue-200'}`}>
                  {report.patternFusion.analysis}
                </p>
                {report.patternFusion.fusionBonus !== 0 && (
                  <p className={`text-xs mt-2 ${report.patternFusion.fusionBonus > 0 ? 'text-green-300' : 'text-yellow-300'}`}>
                    Fusion bonus: {report.patternFusion.fusionBonus > 0 ? '+' : ''}{report.patternFusion.fusionBonus} points
                  </p>
                )}
              </div>

              {/* Key Levels from Chart Pattern */}
              {(report.chartPattern.keyLevels.support?.length || report.chartPattern.keyLevels.resistance?.length) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {report.chartPattern.keyLevels.support && report.chartPattern.keyLevels.support.length > 0 && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="text-green-200 text-sm font-semibold mb-2">Pattern Support</div>
                      {report.chartPattern.keyLevels.support.map((level, idx) => (
                        <div key={idx} className="text-green-400 text-sm">${level.toFixed(2)}</div>
                      ))}
                    </div>
                  )}
                  {report.chartPattern.keyLevels.resistance && report.chartPattern.keyLevels.resistance.length > 0 && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                      <div className="text-red-200 text-sm font-semibold mb-2">Pattern Resistance</div>
                      {report.chartPattern.keyLevels.resistance.map((level, idx) => (
                        <div key={idx} className="text-red-400 text-sm">${level.toFixed(2)}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* No Chart Pattern Message */}
          {!report.chartPattern && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">📐 Chart Pattern Analysis</h3>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-blue-200 text-sm">
                  <strong>No major chart pattern detected.</strong> Analysis relies on candlestick pattern ({report.pattern.name}) and immediate support/resistance levels. 
                  Chart patterns like flags, triangles, and double tops/bottoms provide structural context - when present, they can significantly boost signal confidence.
                </p>
              </div>
            </div>
          )}

          {/* All Detected Chart Patterns */}
          {report.allChartPatterns && report.allChartPatterns.length > 0 && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">📊 All Detected Patterns ({report.allChartPatterns.length})</h3>
              <p className="text-blue-200 text-sm mb-4">
                Multiple chart patterns detected. The primary pattern is used for analysis, but all patterns are shown for context.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.allChartPatterns.map((pattern, idx) => (
                  <div 
                    key={idx}
                    className={`p-4 rounded-lg border ${
                      idx === 0 
                        ? 'bg-blue-500/20 border-blue-500/50' 
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    {idx === 0 && (
                      <div className="text-blue-300 text-xs font-semibold mb-2">PRIMARY PATTERN</div>
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <div className={`font-semibold ${
                        pattern.type === 'bullish' ? 'text-green-400' : 
                        pattern.type === 'bearish' ? 'text-red-400' : 'text-white'
                      }`}>
                        {pattern.name}
                      </div>
                      <div className="text-white text-sm font-bold">
                        {pattern.confidence}%
                      </div>
                    </div>
                    <div className="text-blue-300 text-xs mb-1">
                      {pattern.confidenceLabel}
                    </div>
                    <div className={`text-xs ${
                      pattern.breakoutStatus === 'confirmed' ? 'text-green-400' :
                      pattern.breakoutStatus === 'pending' ? 'text-yellow-400' : 'text-blue-400'
                    }`}>
                      Breakout: {pattern.breakoutStatus}
                    </div>
                  </div>
                ))}
              </div>
              {report.allChartPatterns.length > 1 && (
                <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-yellow-200 text-xs">
                    💡 <strong>Multiple Patterns:</strong> When multiple patterns are detected, the highest confidence pattern determines the analysis.
                    Other patterns can provide additional context about market structure.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Two-Tier Pattern System - Institutional (Tradeable) */}
          {report.patternV2?.institutional && (
            <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 backdrop-blur-lg rounded-2xl p-6 border-2 border-green-500/50 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">✅</span>
                <h3 className="text-xl font-bold text-white">
                  Institutional (Valid/Tradeable) — {report.patternV2.institutional.name}
                </h3>
              </div>
              <p className="text-green-200 text-sm mb-4 font-medium">
                Meets strict criteria. Tradeable structure.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-green-200 text-xs mb-1">Direction</div>
                  <div className="text-white font-bold text-lg capitalize">{report.patternV2.institutional.direction}</div>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-green-200 text-xs mb-1">Confidence</div>
                  <div className="text-white font-bold text-lg">{report.patternV2.institutional.confidence}% ({report.patternV2.institutional.confidenceLabel})</div>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-green-200 text-xs mb-1">Breakout Status</div>
                  <div className="text-white font-bold text-lg capitalize">{report.patternV2.institutional.breakoutStatus}</div>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-green-200 text-xs mb-1">Volume Z-Score</div>
                  <div className={`font-bold text-lg ${
                    report.patternV2.institutional.volumeZScore >= 1.0 ? 'text-green-400' : 
                    report.patternV2.institutional.volumeZScore >= 0.5 ? 'text-yellow-400' : 'text-white'
                  }`}>
                    {report.patternV2.institutional.volumeZScore.toFixed(2)}σ
                  </div>
                </div>
              </div>

              {/* Price Target */}
              {report.patternV2.institutional.priceTarget && (
                <div className="bg-white/10 rounded-lg p-3 mb-4">
                  <div className="text-green-200 text-xs mb-1">📍 Price Target</div>
                  <div className="text-white font-bold text-lg">${report.patternV2.institutional.priceTarget.toFixed(2)}</div>
                  <div className="text-green-300 text-sm mt-1">
                    {((report.patternV2.institutional.priceTarget / report.currentPrice - 1) * 100).toFixed(1)}% from current price
                  </div>
                </div>
              )}

              {/* Key Levels */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {report.patternV2.institutional.keyLevels.support.length > 0 && (
                  <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/30">
                    <div className="text-emerald-300 text-xs font-semibold mb-2">💚 Support Levels</div>
                    {report.patternV2.institutional.keyLevels.support.map((level, idx) => (
                      <div key={idx} className="text-white font-mono text-sm">${level.toFixed(2)}</div>
                    ))}
                  </div>
                )}
                {report.patternV2.institutional.keyLevels.resistance.length > 0 && (
                  <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30">
                    <div className="text-red-300 text-xs font-semibold mb-2">❤️ Resistance Levels</div>
                    {report.patternV2.institutional.keyLevels.resistance.map((level, idx) => (
                      <div key={idx} className="text-white font-mono text-sm">${level.toFixed(2)}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top 3 Reasons (numeric facts) */}
              <div className="bg-white/10 rounded-lg p-4">
                <h4 className="text-green-300 font-semibold mb-2">✔️ Validation Criteria</h4>
                <ul className="space-y-1">
                  {report.patternV2.institutional.reasons.map((reason, idx) => (
                    <li key={idx} className="text-white text-sm">• {reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Two-Tier Pattern System - Candidate (Not Confirmed) */}
          {report.patternV2?.candidate && (
            <div className="bg-gradient-to-br from-orange-900/40 to-amber-900/40 backdrop-blur-lg rounded-2xl p-6 border-2 border-orange-500/50 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">⚠️</span>
                <h3 className="text-xl font-bold text-white">
                  Candidate (Not Confirmed) — {report.patternV2.candidate.name}
                </h3>
              </div>
              <p className="text-orange-200 text-sm mb-4 font-medium">
                Fails institutional criteria. For learning; monitor for confirmation.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-orange-200 text-xs mb-1">Direction</div>
                  <div className="text-white font-bold text-lg capitalize">{report.patternV2.candidate.direction}</div>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-orange-200 text-xs mb-1">Confidence (Capped at 80)</div>
                  <div className="text-white font-bold text-lg">{report.patternV2.candidate.confidence}% ({report.patternV2.candidate.confidenceLabel})</div>
                </div>
              </div>

              {/* Met Criteria */}
              {report.patternV2.candidate.metCriteria.length > 0 && (
                <div className="bg-green-500/10 rounded-lg p-4 mb-4 border border-green-500/30">
                  <h4 className="text-green-300 font-semibold mb-2">✅ Met Criteria</h4>
                  <ul className="space-y-1">
                    {report.patternV2.candidate.metCriteria.map((criterion, idx) => (
                      <li key={idx} className="text-green-100 text-sm">• {criterion}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Unmet Criteria (what's missing for institutional) */}
              {report.patternV2.candidate.unmetCriteria.length > 0 && (
                <div className="bg-red-500/10 rounded-lg p-4 mb-4 border border-red-500/30">
                  <h4 className="text-red-300 font-semibold mb-2">❌ Unmet Criteria (for Institutional Grade)</h4>
                  <ul className="space-y-1">
                    {report.patternV2.candidate.unmetCriteria.map((criterion, idx) => (
                      <li key={idx} className="text-red-100 text-sm">• {criterion}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Steps (what confirmations are needed) */}
              {report.patternV2.candidate.nextSteps.length > 0 && (
                <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
                  <h4 className="text-blue-300 font-semibold mb-2">🎯 Next Steps (Confirmations Needed)</h4>
                  <ul className="space-y-1">
                    {report.patternV2.candidate.nextSteps.map((step, idx) => (
                      <li key={idx} className="text-blue-100 text-sm">• {step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* No Chart Pattern Detected */}
          {report.patternV2 && !report.patternV2.institutional && !report.patternV2.candidate && (
            <div className="bg-gray-800/40 backdrop-blur-lg rounded-2xl p-6 border border-gray-600/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">ℹ️</span>
                <h3 className="text-xl font-bold text-white">No Institutional or Candidate Chart Pattern Detected</h3>
              </div>
              <p className="text-gray-300 text-sm">
                No major chart pattern (flags, triangles, double tops/bottoms) meets detection criteria. Analysis is based on candlestick pattern and technical indicators only.
              </p>
            </div>
          )}

          {/* V2 Pattern Detection - Explainability */}
          {report.patternV2 && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">🔍 Pattern Detection V2 - Explainability</h3>
              <p className="text-blue-200 text-sm mb-4">
                Deterministic pattern analysis with full transparency. All confidence scores computed by explicit rules.
              </p>
              
              {/* Composite Reasons */}
              {report.patternV2.compositeReasons && report.patternV2.compositeReasons.length > 0 && (
                <div className="mb-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <h4 className="text-teal-300 font-semibold mb-2">🎯 Composite Score Breakdown</h4>
                  <ul className="space-y-1">
                    {report.patternV2.compositeReasons.map((reason, idx) => (
                      <li key={idx} className="text-blue-100 text-sm">• {reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Chart Pattern Reasons */}
              {report.patternV2.chartPatternReasons && report.patternV2.chartPatternReasons.length > 0 && (
                <div className="mb-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <h4 className="text-green-300 font-semibold mb-2">📐 Chart Pattern Facts</h4>
                  <ul className="space-y-1">
                    {report.patternV2.chartPatternReasons.map((reason, idx) => (
                      <li key={idx} className="text-green-100 text-sm">• {reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Chart Pattern Metadata */}
              {report.patternV2.chartPatternMetadata && (
                <div className="mb-4 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <h4 className="text-purple-300 font-semibold mb-3">📊 Chart Pattern Metrics</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {report.patternV2.chartPatternMetadata.totalTouches !== undefined && (
                      <div>
                        <div className="text-purple-200 text-xs">Total Touches</div>
                        <div className="text-white font-bold">{report.patternV2.chartPatternMetadata.totalTouches}</div>
                      </div>
                    )}
                    {report.patternV2.chartPatternMetadata.widthPct !== undefined && (
                      <div>
                        <div className="text-purple-200 text-xs">Width %</div>
                        <div className="text-white font-bold">{report.patternV2.chartPatternMetadata.widthPct}%</div>
                      </div>
                    )}
                    {report.patternV2.chartPatternMetadata.widthATR !== undefined && (
                      <div>
                        <div className="text-purple-200 text-xs">Width (ATR)</div>
                        <div className="text-white font-bold">{report.patternV2.chartPatternMetadata.widthATR.toFixed(2)}×</div>
                      </div>
                    )}
                    {report.patternV2.chartPatternMetadata.r2Upper !== undefined && (
                      <div>
                        <div className="text-purple-200 text-xs">R² Upper</div>
                        <div className="text-white font-bold">{report.patternV2.chartPatternMetadata.r2Upper.toFixed(2)}</div>
                      </div>
                    )}
                    {report.patternV2.chartPatternMetadata.r2Lower !== undefined && (
                      <div>
                        <div className="text-purple-200 text-xs">R² Lower</div>
                        <div className="text-white font-bold">{report.patternV2.chartPatternMetadata.r2Lower.toFixed(2)}</div>
                      </div>
                    )}
                    {report.patternV2.chartPatternMetadata.breakoutVolZ !== undefined && (
                      <div>
                        <div className="text-purple-200 text-xs">Breakout VolZ</div>
                        <div className={`font-bold ${
                          report.patternV2.chartPatternMetadata.breakoutVolZ > 1 ? 'text-green-400' : 
                          report.patternV2.chartPatternMetadata.breakoutVolZ < -1 ? 'text-red-400' : 'text-white'
                        }`}>
                          {report.patternV2.chartPatternMetadata.breakoutVolZ.toFixed(1)}σ
                        </div>
                      </div>
                    )}
                    {report.patternV2.chartPatternMetadata.symmetryPct !== undefined && (
                      <div>
                        <div className="text-purple-200 text-xs">Symmetry</div>
                        <div className="text-white font-bold">{report.patternV2.chartPatternMetadata.symmetryPct.toFixed(1)}%</div>
                      </div>
                    )}
                    {report.patternV2.chartPatternMetadata.heightATR !== undefined && (
                      <div>
                        <div className="text-purple-200 text-xs">Height (ATR)</div>
                        <div className="text-white font-bold">{report.patternV2.chartPatternMetadata.heightATR.toFixed(2)}×</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Candlestick Facts */}
              {report.patternV2.candlestickFacts && Object.keys(report.patternV2.candlestickFacts).length > 0 && (
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <h4 className="text-yellow-300 font-semibold mb-3">🕯️ Candlestick Facts</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {report.patternV2.candlestickFacts.bodyPct !== undefined && (
                      <div>
                        <div className="text-yellow-200 text-xs">Body %</div>
                        <div className="text-white font-bold">{report.patternV2.candlestickFacts.bodyPct.toFixed(1)}%</div>
                      </div>
                    )}
                    {report.patternV2.candlestickFacts.wickTopPct !== undefined && (
                      <div>
                        <div className="text-yellow-200 text-xs">Top Wick %</div>
                        <div className="text-white font-bold">{report.patternV2.candlestickFacts.wickTopPct.toFixed(1)}%</div>
                      </div>
                    )}
                    {report.patternV2.candlestickFacts.wickBotPct !== undefined && (
                      <div>
                        <div className="text-yellow-200 text-xs">Bottom Wick %</div>
                        <div className="text-white font-bold">{report.patternV2.candlestickFacts.wickBotPct.toFixed(1)}%</div>
                      </div>
                    )}
                    {report.patternV2.candlestickFacts.engulfPct !== undefined && (
                      <div>
                        <div className="text-yellow-200 text-xs">Engulfment %</div>
                        <div className="text-white font-bold">{report.patternV2.candlestickFacts.engulfPct.toFixed(0)}%</div>
                      </div>
                    )}
                    {report.patternV2.candlestickFacts.volRatio !== undefined && (
                      <div>
                        <div className="text-yellow-200 text-xs">Vol Ratio</div>
                        <div className="text-white font-bold">{report.patternV2.candlestickFacts.volRatio.toFixed(2)}×</div>
                      </div>
                    )}
                    {report.patternV2.candlestickFacts.volZ !== undefined && (
                      <div>
                        <div className="text-yellow-200 text-xs">Vol Z-Score</div>
                        <div className={`font-bold ${
                          report.patternV2.candlestickFacts.volZ > 1 ? 'text-green-400' : 
                          report.patternV2.candlestickFacts.volZ < -1 ? 'text-red-400' : 'text-white'
                        }`}>
                          {report.patternV2.candlestickFacts.volZ.toFixed(1)}σ
                        </div>
                      </div>
                    )}
                    {report.patternV2.candlestickFacts.closeLocationPct !== undefined && (
                      <div>
                        <div className="text-yellow-200 text-xs">Close Location</div>
                        <div className="text-white font-bold">{report.patternV2.candlestickFacts.closeLocationPct.toFixed(0)}%</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="mt-4 p-3 rounded-lg bg-teal-500/10 border border-teal-500/30">
                <p className="text-teal-200 text-xs">
                  💡 <strong>Deterministic Analysis:</strong> All scores and confidences are computed using explicit rules. 
                  No black-box algorithms - every number is verifiable and explainable.
                </p>
              </div>
            </div>
          )}

          {/* Risk Management */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">📊 Risk Management Plan</h3>
            
            {/* ATR Info Box */}
            <div className="mb-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <div className="text-purple-200 text-sm">
                <strong>ATR(14):</strong> ${report.riskManagement.atrValue} • 
                <strong className="ml-2">Stop Distance:</strong> {report.riskManagement.atrMultiple}× ATR • 
                <strong className="ml-2">Risk/Share:</strong> ${report.riskManagement.riskPerShare} ({report.riskManagement.riskPercent.toFixed(2)}%)
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-blue-200 text-sm mb-1">Entry</div>
                <div className="text-white font-bold text-lg">${report.riskManagement.entry}</div>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="text-red-200 text-sm mb-1">Stop Loss</div>
                <div className="text-red-400 font-bold text-lg">${report.riskManagement.stopLoss}</div>
                <div className="text-red-300 text-xs">
                  ${Math.abs(report.riskManagement.stopLoss - report.riskManagement.entry).toFixed(2)} ({report.riskManagement.riskPercent.toFixed(2)}%) {report.riskManagement.direction === 'long' ? 'below' : 'above'} entry
                </div>
              </div>
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="text-green-200 text-sm mb-1">Target 1</div>
                <div className="text-green-400 font-bold text-lg">${report.riskManagement.targets.target1}</div>
                <div className="text-green-300 text-xs">{report.riskManagement.riskReward.target1.toFixed(1)}:1 R:R</div>
              </div>
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="text-green-200 text-sm mb-1">Target 2</div>
                <div className="text-green-400 font-bold text-lg">${report.riskManagement.targets.target2}</div>
                <div className="text-green-300 text-xs">{report.riskManagement.riskReward.target2.toFixed(1)}:1 R:R</div>
              </div>
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="text-green-200 text-sm mb-1">Target 3</div>
                <div className="text-green-400 font-bold text-lg">${report.riskManagement.targets.target3}</div>
                <div className="text-green-300 text-xs">{report.riskManagement.riskReward.target3.toFixed(1)}:1 R:R</div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-3">
              <p className="text-blue-200 text-sm mb-2"><strong>📊 Position Sizing:</strong> {report.riskManagement.positionSize}</p>
              <p className="text-blue-200 text-sm mb-2"><strong>💰 Risk Amount:</strong> {report.riskManagement.riskAmount}</p>
              <p className="text-blue-200 text-sm"><strong>📝 Reasoning:</strong> {report.riskManagement.reasoning}</p>
            </div>
            
            {/* Pattern Validation */}
            {report.pattern.validation && (
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 mb-3">
                <p className="text-purple-200 text-sm">
                  <strong>Pattern Validation:</strong> {report.pattern.validation.note}
                </p>
              </div>
            )}
            
            {/* Low Volume Warning */}
            {report.technical.volumeZScore < 0 && report.pattern.name.includes("Engulfing") && (
              <div className="p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/50">
                <p className="text-yellow-200 text-sm">
                  ⚠️ <strong>Caution:</strong> {report.pattern.name} pattern on below-average volume (z-score: {report.technical.volumeZScore.toFixed(2)}). 
                  Engulfing patterns work best with strong volume confirmation. Consider waiting for better setup or reducing position size.
                </p>
              </div>
            )}

            {!report.riskManagement.isValid && (
              <div className="mt-4 p-4 rounded-lg bg-yellow-500/20 border border-yellow-500/50 text-yellow-200">
                ⚠️ {report.riskManagement.validationMessage}
              </div>
            )}
          </div>

          {/* Technical Indicators */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">📈 Technical Indicators</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-blue-200 text-sm mb-1">EMA 9</div>
                <div className="text-white font-semibold">${report.technical.ema9.toFixed(2)}</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-blue-200 text-sm mb-1">EMA 20</div>
                <div className="text-white font-semibold">${report.technical.ema20.toFixed(2)}</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-blue-200 text-sm mb-1">EMA 50</div>
                <div className="text-white font-semibold">${report.technical.ema50.toFixed(2)}</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-blue-200 text-sm mb-1">EMA 200</div>
                <div className="text-white font-semibold">${report.technical.ema200.toFixed(2)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-blue-200 text-sm mb-1">RSI</div>
                <div className={`font-semibold ${report.technical.rsi > 70 ? 'text-red-400' : report.technical.rsi < 30 ? 'text-green-400' : 'text-white'}`}>
                  {report.technical.rsi.toFixed(1)}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-blue-200 text-sm mb-1">MACD</div>
                <div className="text-white font-semibold text-xs">
                  {report.technical.macd.value.toFixed(2)} / {report.technical.macd.signal.toFixed(2)}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-blue-200 text-sm mb-1">Volume Z-Score</div>
                <div className={`font-semibold ${report.technical.volumeZScore > 1 ? 'text-green-400' : 'text-white'}`}>
                  {report.technical.volumeZScore.toFixed(2)}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-blue-200 text-sm mb-1">Trend</div>
                <div className={`font-semibold capitalize ${report.technical.trend === 'bullish' ? 'text-green-400' : report.technical.trend === 'bearish' ? 'text-red-400' : 'text-white'}`}>
                  {report.technical.trend} ({report.technical.trendStrength})
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {report.technical.supportLevels.length > 0 && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="text-green-200 text-sm font-semibold mb-2">Support Levels</div>
                  {report.technical.supportLevels.map((level, idx) => (
                    <div key={idx} className="text-green-400">${level.toFixed(2)}</div>
                  ))}
                </div>
              )}
              {report.technical.resistanceLevels.length > 0 && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="text-red-200 text-sm font-semibold mb-2">Resistance Levels</div>
                  {report.technical.resistanceLevels.map((level, idx) => (
                    <div key={idx} className="text-red-400">${level.toFixed(2)}</div>
                  ))}
                </div>
              )}
            </div>
            
            {/* EMA Compression Insight */}
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-3">
              <p className="text-blue-200 text-sm">
                <strong>📊 EMA Proximity:</strong> The 9, 20, and 50 EMAs are compressed within {report.technical.emaCompression.toFixed(2)}%
                {report.technical.emaCompression < 2 ? " — expect expansion (breakout or chop)." : 
                 report.technical.emaCompression < 5 ? " — moderate spacing, trend forming." : 
                 " — wide spacing, strong trending environment."}
              </p>
            </div>
            
            {/* Trend vs Bias Clarity */}
            {(() => {
              const isShortBias = report.riskManagement.direction === 'short';
              const isLongBias = report.riskManagement.direction === 'long';
              const priceBelow20 = report.currentPrice < report.technical.ema20;
              const priceBelow50 = report.currentPrice < report.technical.ema50;
              const priceAbove20 = report.currentPrice > report.technical.ema20;
              const priceAbove50 = report.currentPrice > report.technical.ema50;
              const priceAbove200 = report.technical.ema9 > report.technical.ema200;
              const priceBelow200 = report.technical.ema9 < report.technical.ema200;
              const trendNeutral = report.technical.trend === "neutral";
              
              // Countertrend setup (short in uptrend or long in downtrend)
              if ((isShortBias && priceAbove200) || (isLongBias && priceBelow200)) {
                return (
                  <div className="p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/50">
                    <p className="text-yellow-200 text-sm">
                      ⚠️ <strong>Countertrend Setup:</strong> This is a {report.riskManagement.direction} setup against the longer-term{' '}
                      {priceAbove200 ? 'uptrend' : 'downtrend'} (price {priceAbove200 ? 'above' : 'below'} 200 EMA). 
                      Countertrend trades have lower probability. Use tighter stops and smaller position sizes.
                    </p>
                  </div>
                );
              }
              
              // Conflicting trend classification (e.g., "neutral trend" but clear directional bias)
              if (trendNeutral && isShortBias && priceBelow20 && priceBelow50) {
                return (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <p className="text-blue-200 text-sm">
                      📊 <strong>Trend Classification:</strong> Short bias despite neutral trend score — price below 20/50 EMA cluster signals near-term weakness. 
                      The 200 EMA context creates the "neutral" label, but the setup favors downside based on recent price action.
                    </p>
                  </div>
                );
              }
              
              if (trendNeutral && isLongBias && priceAbove20 && priceAbove50) {
                return (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <p className="text-blue-200 text-sm">
                      📊 <strong>Trend Classification:</strong> Long bias despite neutral trend score — price above 20/50 EMA cluster signals near-term strength. 
                      The 200 EMA context creates the "neutral" label, but the setup favors upside based on recent price action.
                    </p>
                  </div>
                );
              }
              
              return null;
            })()}
            
            {/* Earnings Proximity */}
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-blue-200 text-sm">
                <strong>Earnings Proximity:</strong> Earnings calendar integration coming soon. Before trading, verify earnings date using your broker or a financial calendar.
                Avoid trading 1-2 days before earnings (high volatility risk).
              </p>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">⭐ Score Breakdown</h3>
            
            {/* Score Explanation Card */}
            <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30">
              <p className="text-blue-100 text-sm mb-3">
                <strong>How the {report.score.overall}/100 ({report.score.rating}) score is calculated:</strong>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-blue-200">
                {report.chartPattern ? (
                  <>
                    <div>• Technical ({report.score.breakdown.technical}/100): EMA alignment & trend strength - 25% weight</div>
                    <div>• Momentum ({report.score.breakdown.momentum}/100): RSI & MACD signals - 20% weight</div>
                    <div>• Trend ({report.score.breakdown.trend}/100): Directional strength - 15% weight</div>
                    <div>• Pattern Fusion ({report.score.breakdown.pattern}/100): Structure + timing combo - 25% weight</div>
                    <div>• Chart Pattern: {report.chartPattern.confidence}% ({report.chartPattern.confidenceLabel}) - 10% weight</div>
                    <div>• Volume ({report.score.breakdown.volume}/100): Confirmation strength - 5% weight</div>
                  </>
                ) : (
                  <>
                    <div>• Technical ({report.score.breakdown.technical}/100): EMA alignment & trend - 30% weight</div>
                    <div>• Momentum ({report.score.breakdown.momentum}/100): RSI & MACD signals - 25% weight</div>
                    <div>• Trend ({report.score.breakdown.trend}/100): Directional strength - 20% weight</div>
                    <div>• Pattern ({report.score.breakdown.pattern}/100): Candlestick signal - 15% weight</div>
                    <div>• Volume ({report.score.breakdown.volume}/100): Confirmation strength - 10% weight</div>
                  </>
                )}
              </div>
              <p className="text-blue-300 text-xs mt-3 italic">
                Grade: 90+=A+, 76-89=A, 61-75=B, 41-60=C, 0-40=D. All confidences capped at 95% for realism.
              </p>
            </div>

            {/* Pattern Score Adjustment Explanation */}
            {Math.abs(report.score.breakdown.pattern - report.pattern.confidence) > 5 && (
              <div className="mb-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <p className="text-purple-200 text-sm">
                  <strong>Pattern Score Adjusted:</strong> Original confidence {report.pattern.confidence}%, 
                  adjusted to {report.score.breakdown.pattern}/100 due to 
                  {report.technical.volumeZScore < 0 ? " low volume" : " volume confirmation"}
                  {report.technical.trend === "neutral" ? " and neutral trend" : ""}.
                  {(report.pattern.name.includes("Engulfing") || report.pattern.name.includes("Breakout")) && 
                    " (These patterns require strong volume confirmation)"}
                </p>
              </div>
            )}
            
            <div className="space-y-3">
              {Object.entries(report.score.breakdown).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-blue-200 capitalize">{key}</span>
                    <span className="text-white font-semibold">{value}/100</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-teal-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${value}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Analysis */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">🤖 AI Analysis</h3>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-teal-300 mb-2">📖 Narrative</h4>
              <p className="text-blue-100 leading-relaxed">
                {report.analysis.narrative}
                {report.score.overall < 75 && (
                  <span className="block mt-2 text-blue-300 italic text-sm">
                    💡 Traders may prefer to wait for a clearer pattern or higher confirmation before entering for better risk/reward.
                  </span>
                )}
              </p>
            </div>

            <div className="mb-6">
              <h4 className="text-lg font-semibold text-teal-300 mb-2">💡 Mentor Notes</h4>
              <div className="text-blue-100 whitespace-pre-line leading-relaxed">
                {report.analysis.mentorNotes}
                {((report.riskManagement.direction === 'short' && report.technical.ema9 > report.technical.ema200) ||
                  (report.riskManagement.direction === 'long' && report.technical.ema9 < report.technical.ema200)) && (
                  <p className="mt-3 text-yellow-200 text-sm">
                    ⚠️ Because this trade goes against the long-term trend (price {report.technical.ema9 > report.technical.ema200 ? 'above' : 'below'} 200 EMA), 
                    confirmation of {report.riskManagement.direction === 'long' ? 'breakout' : 'breakdown'} is essential before full sizing.
                  </p>
                )}
                <p className="mt-4 text-teal-200 italic text-sm border-t border-teal-500/30 pt-3">
                  🎯 Remember — strong swing setups need structure (pattern), not just momentum. Patience pays.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {report.analysis.strengths.length > 0 && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <h4 className="text-green-300 font-semibold mb-2">✅ Strengths</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {report.analysis.strengths.map((item, idx) => (
                      <li key={idx} className="text-green-200 text-sm">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {report.analysis.warnings.length > 0 && (
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <h4 className="text-yellow-300 font-semibold mb-2">⚠️ Risk Factors</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {report.analysis.warnings.map((item, idx) => (
                      <li key={idx} className="text-yellow-200 text-sm">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {report.analysis.reasoning.length > 0 && (
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <h4 className="text-blue-300 font-semibold mb-2">🔍 Rules Triggered</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {report.analysis.reasoning.map((item, idx) => (
                      <li key={idx} className="text-blue-200 text-sm">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Timestamp */}
          <div className="text-center text-blue-300 text-sm">
            Analysis generated at {new Date(report.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

