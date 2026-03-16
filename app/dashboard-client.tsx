"use client";

import { signOut } from "next-auth/react";
import { Session } from "next-auth";
import { useState } from "react";
import AnalyzeClient from "./analyze-client";

interface DashboardClientProps {
  session: Session;
}

export default function DashboardClient({ session }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"scanner" | "analysis">("analysis");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center shadow-lg shadow-teal-500/50">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Swing Advisor</h1>
                <p className="text-xs text-blue-300">AI Trading Intelligence</p>
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">{session.user?.name || "User"}</p>
                <p className="text-xs text-blue-300">{session.user?.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Welcome back, {session.user?.name?.split(" ")[0] || "Trader"}! 👋
          </h2>
          <p className="text-blue-200">
            Your AI-powered swing trading assistant is ready to find the best setups
          </p>
        </div>

        {/* Mode Selector */}
        <div className="mb-8">
          <div className="inline-flex rounded-xl bg-white/10 p-1 backdrop-blur-lg border border-white/20">
            <button
              onClick={() => setActiveTab("scanner")}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === "scanner"
                  ? "bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-lg shadow-teal-500/30"
                  : "text-blue-200 hover:text-white"
              }`}
            >
              📊 Market Scanner
            </button>
            <button
              onClick={() => setActiveTab("analysis")}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === "analysis"
                  ? "bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-lg shadow-teal-500/30"
                  : "text-blue-200 hover:text-white"
              }`}
            >
              🔍 Deep Analysis
            </button>
          </div>
        </div>

        {/* Scanner Mode */}
        {activeTab === "scanner" && (
          <div className="space-y-6">
            {/* Scanner Card */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-2xl">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Market Scanner</h3>
                  <p className="text-blue-200">
                    Scan the market for the best swing trading setups based on your criteria
                  </p>
                </div>
                <div className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-sm font-medium border border-teal-500/30">
                  Coming Soon
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-2xl mb-2">🎯</div>
                  <h4 className="text-white font-semibold mb-1">Pattern Detection</h4>
                  <p className="text-sm text-blue-200">
                    Find bullish and bearish patterns across multiple timeframes
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-2xl mb-2">📈</div>
                  <h4 className="text-white font-semibold mb-1">Technical Analysis</h4>
                  <p className="text-sm text-blue-200">
                    Deterministic calculations with AI-powered explanations
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-2xl mb-2">💎</div>
                  <h4 className="text-white font-semibold mb-1">Best Setups</h4>
                  <p className="text-sm text-blue-200">
                    Ranked by R:R ratio, probability, and technical strength
                  </p>
                </div>
              </div>

              {/* Coming Soon Notice */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-teal-500/10 to-blue-500/10 border border-teal-500/30">
                <p className="text-teal-200 text-sm">
                  🚀 The market scanner is under development. Soon you'll be able to scan thousands of stocks
                  to find the perfect swing trading opportunities with entry/exit points and risk management plans.
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <p className="text-blue-200 text-sm mb-1">Scans Today</p>
                <p className="text-3xl font-bold text-white">0</p>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <p className="text-blue-200 text-sm mb-1">Saved Presets</p>
                <p className="text-3xl font-bold text-white">0</p>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <p className="text-blue-200 text-sm mb-1">Favorites</p>
                <p className="text-3xl font-bold text-white">0</p>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <p className="text-blue-200 text-sm mb-1">Your Plan</p>
                <p className="text-3xl font-bold text-white">Free</p>
              </div>
            </div>
          </div>
        )}

        {/* Deep Analysis Mode */}
        {activeTab === "analysis" && <AnalyzeClient />}

        {/* Principles Section */}
        <div className="mt-8 bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-4">Our Principles</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="text-teal-300 font-semibold mb-2">✨ Transparency</h4>
              <p className="text-sm text-blue-200">
                We show you the rules that fired, not black box predictions. Every recommendation is backed by clear logic.
              </p>
            </div>
            <div>
              <h4 className="text-teal-300 font-semibold mb-2">📐 Facts-Only</h4>
              <p className="text-sm text-blue-200">
                Deterministic technical calculations form the foundation. AI explains the results, never invents them.
              </p>
            </div>
            <div>
              <h4 className="text-teal-300 font-semibold mb-2">🔄 Fresh Data</h4>
              <p className="text-sm text-blue-200">
                Real-time market data via vendor APIs. Verify everything on your favorite charting platform.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-blue-200/50 text-sm">
            © 2025 Swing Advisor. Built with transparency and precision. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

