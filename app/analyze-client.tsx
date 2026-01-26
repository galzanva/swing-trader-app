"use client";

import { useState } from "react";
import { AnalysisReport } from "./api/analyze/route";
import AnalysisReportDisplay from "./components/analysis-report-display";

export default function AnalyzeClient() {
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("1day");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleAnalyze = async () => {
    if (!symbol.trim()) {
      setError("Please enter a ticker symbol");
      return;
    }

    setIsLoading(true);
    setError("");
    setReport(null);
    setSaveSuccess(false);
    setSaveError("");

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

  const handleSaveReport = async () => {
    if (!report) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      const title = `${symbol.toUpperCase()} Deep Analysis - ${timeframe}`;
      const description = `Deep analysis for ${symbol.toUpperCase()} on ${timeframe} timeframe. Score: ${report.score.overall}/100 (${report.score.rating}). ${report.executionDirection.charAt(0).toUpperCase() + report.executionDirection.slice(1)} setup.`;

      const response = await fetch("/api/reports/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "deep-analysis",
          title,
          description,
          parameters: {
            symbol: symbol.toUpperCase(),
            timeframe,
          },
          reportData: report,
          cachedData: {
            technical: report.technical,
            fundamentals: report.fundamentals,
            timestamp: new Date().toISOString(),
          },
          tags: [symbol.toUpperCase(), timeframe, "deep-analysis", report.executionDirection],
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
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Deep Analysis</h2>
            <p className="text-slate-300 text-sm mt-1">
              Comprehensive technical + fundamental + sentiment analysis
            </p>
          </div>
          <span className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 px-3 py-1 text-xs rounded-full font-semibold uppercase tracking-wider border border-purple-500/30">
            Pro Analysis
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Ticker Symbol
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL, TSLA, SPY"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase"
              disabled={isLoading}
              onKeyPress={(e) => e.key === "Enter" && handleAnalyze()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Timeframe
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={isLoading}
            >
              <option value="1day">Daily</option>
              <option value="1hour">1 Hour</option>
              <option value="15min">15 Min</option>
              <option value="5min">5 Min</option>
              <option value="1min">1 Min</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !symbol.trim()}
              className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </span>
              ) : (
                "Analyze"
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20">
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-indigo-500/20 rounded-full"></div>
              <div className="absolute top-0 left-0 w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-white text-lg font-semibold mt-6">Analyzing {symbol}...</p>
            <div className="mt-4 space-y-2 text-center">
              <p className="text-slate-400 text-sm">📊 Fetching market data...</p>
              <p className="text-slate-400 text-sm">🔍 Detecting patterns...</p>
              <p className="text-slate-400 text-sm">📈 Computing indicators...</p>
              <p className="text-slate-400 text-sm">🤖 Running AI analysis...</p>
              <p className="text-slate-400 text-sm">📰 Gathering sentiment...</p>
            </div>
            <p className="text-slate-500 text-xs mt-6">This may take 10-30 seconds for a comprehensive analysis</p>
          </div>
        </div>
      )}

      {/* Analysis Report */}
      {report && !isLoading && (
        <div className="space-y-6">
          {/* Data Freshness Warning */}
          {report.marketData.dataAgeDays > 7 && (
            <div className="bg-amber-500/20 backdrop-blur-lg rounded-xl p-4 border border-amber-500/40">
              <div className="flex items-start gap-3">
                <span className="text-amber-400 text-xl">⚠️</span>
                <div>
                  <p className="text-amber-200 font-semibold">Data Freshness Warning</p>
                  <p className="text-amber-300 text-sm mt-1">
                    Market data is {report.marketData.dataAgeDays} days old. Analysis may not reflect current market conditions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Use the AnalysisReportDisplay component */}
          <AnalysisReportDisplay report={report} />

          {/* Save Report Section */}
          <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 backdrop-blur-lg rounded-2xl p-6 border border-indigo-500/30">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">💾 Save This Analysis</h3>
                <p className="text-slate-300 text-sm">
                  Save to your account for future reference or to rerun with latest data
                </p>
              </div>
              <button
                onClick={handleSaveReport}
                disabled={isSaving}
                className={`px-6 py-3 font-semibold rounded-xl transition-all flex items-center gap-2 ${
                  saveSuccess
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Saved!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Report
                  </>
                )}
              </button>
            </div>

            {/* Success/Error Messages */}
            {saveSuccess && (
              <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-lg">
                <p className="text-emerald-300 text-sm flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span><strong>Success!</strong> Report saved. View it in <a href="/reports" className="underline hover:text-emerald-200">Saved Reports</a>.</span>
                </p>
              </div>
            )}
            {saveError && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg">
                <p className="text-red-300 text-sm flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span><strong>Error:</strong> {saveError}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
