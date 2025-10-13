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
          {/* Header Card */}
          <div className="bg-gradient-to-r from-slate-900/80 to-blue-900/80 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  {report.symbol} — {report.timeframe}
                  <span className={`ml-4 px-3 py-1 rounded-lg text-sm font-semibold border ${getPatternColor(report.pattern.type)}`}>
                    {report.pattern.name}
                  </span>
                </h2>
                <p className="text-blue-200">{report.name}</p>
                <p className="text-sm text-blue-300 mt-1">
                  Current Price: <span className="text-white font-semibold">${report.currentPrice.toFixed(2)}</span>
                  {report.marketData.exchange && <span className="ml-4">• {report.marketData.exchange}</span>}
                  {report.marketData.marketCap && (
                    <span className="ml-4">• Market Cap: ${(report.marketData.marketCap / 1e9).toFixed(2)}B</span>
                  )}
                </p>
              </div>

              <div className="text-right">
                <div className={`text-5xl font-bold ${getRatingColor(report.score.rating)}`}>
                  {report.score.rating}
                </div>
                <div className="text-white font-semibold mt-2">{report.score.overall}/100</div>
                <div className="text-blue-200 text-sm">{report.score.recommendation}</div>
              </div>
            </div>
          </div>

          {/* Risk Management */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">📊 Risk Management Plan</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-blue-200 text-sm mb-1">Entry</div>
                <div className="text-white font-bold text-lg">${report.riskManagement.entry}</div>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="text-red-200 text-sm mb-1">Stop Loss</div>
                <div className="text-red-400 font-bold text-lg">${report.riskManagement.stopLoss}</div>
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

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-blue-200 text-sm mb-2"><strong>Position Sizing:</strong> {report.riskManagement.positionSize}</p>
              <p className="text-blue-200 text-sm mb-2"><strong>Risk Amount:</strong> {report.riskManagement.riskAmount}</p>
              <p className="text-blue-200 text-sm"><strong>Reasoning:</strong> {report.riskManagement.reasoning}</p>
            </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          {/* Score Breakdown */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">⭐ Score Breakdown</h3>
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
              <h4 className="text-lg font-semibold text-teal-300 mb-2">Narrative</h4>
              <p className="text-blue-100 leading-relaxed">{report.analysis.narrative}</p>
            </div>

            <div className="mb-6">
              <h4 className="text-lg font-semibold text-teal-300 mb-2">Mentor Notes</h4>
              <div className="text-blue-100 whitespace-pre-line leading-relaxed">
                {report.analysis.mentorNotes}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {report.analysis.strengths.length > 0 && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <h4 className="text-green-300 font-semibold mb-2">✅ Strengths</h4>
                  <ul className="space-y-1">
                    {report.analysis.strengths.map((item, idx) => (
                      <li key={idx} className="text-green-200 text-sm">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {report.analysis.warnings.length > 0 && (
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <h4 className="text-yellow-300 font-semibold mb-2">⚠️ Warnings</h4>
                  <ul className="space-y-1">
                    {report.analysis.warnings.map((item, idx) => (
                      <li key={idx} className="text-yellow-200 text-sm">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {report.analysis.reasoning.length > 0 && (
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <h4 className="text-blue-300 font-semibold mb-2">🔍 Rules Fired</h4>
                  <ul className="space-y-1">
                    {report.analysis.reasoning.map((item, idx) => (
                      <li key={idx} className="text-blue-200 text-sm">• {item}</li>
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

