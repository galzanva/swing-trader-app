'use client';

/**
 * Strategy Builder Help & Documentation Modal
 * 
 * Comprehensive guide for valid entries, expressions, and examples
 */

import { useState, useEffect } from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  section?: 'trigger' | 'stop' | 'target' | 'price-distance' | 'expression' | 'patterns' | 'all';
}

export default function StrategyHelpModal({ isOpen, onClose, section = 'all' }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState(section);

  // Update activeTab when section prop changes or drawer opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(section);
    }
  }, [isOpen, section]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-[101] w-full sm:max-w-2xl bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl flex flex-col animate-slide-in sm:border-l border-white/10">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-6 border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Strategy Builder Reference</h2>
            <p className="text-blue-200 text-sm">Complete guide to expressions, levels, and valid syntax</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pt-4 pb-2 border-b border-white/10 overflow-x-auto shrink-0 bg-slate-900/50">
          {[
            { id: 'trigger', label: 'Trigger Levels' },
            { id: 'stop', label: 'Stop Loss' },
            { id: 'target', label: 'Targets' },
            { id: 'price-distance', label: 'Price Distance' },
            { id: 'expression', label: 'Expressions' },
            { id: 'patterns', label: 'Patterns' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-purple-600/30 text-white border-t-2 border-purple-500'
                  : 'text-blue-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'trigger' && <TriggerLevelHelp />}
          {activeTab === 'stop' && <StopLossHelp />}
          {activeTab === 'target' && <TargetLevelHelp />}
          {activeTab === 'price-distance' && <PriceDistanceHelp />}
          {activeTab === 'expression' && <ExpressionSyntaxHelp />}
          {activeTab === 'patterns' && <PatternVariablesHelp />}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-900/50 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all shadow-lg"
          >
            Got it!
          </button>
        </div>
      </div>
    </>
  );
}

// Trigger Level Help Section
function TriggerLevelHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white mb-3">📍 Trigger Level Reference</h3>
        <p className="text-blue-200 mb-4">
          The trigger level defines the price point where you want to enter the trade. You can use fixed levels, 
          indicators, pattern-derived levels, or dynamic expressions.
        </p>
      </div>

      <HelpCard title="Available Indicators">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>ema20</code> — Exponential Moving Average 20</li>
          <li><code>ema50</code> — Exponential Moving Average 50</li>
          <li><code>ema200</code> — Exponential Moving Average 200</li>
          <li><code>vwap</code> — Volume Weighted Average Price (intraday only)</li>
          <li><code>close</code> or <code>entry</code> — Current close price</li>
          <li><code>high</code>, <code>low</code>, <code>open</code> — Current bar's OHLC</li>
        </ul>
      </HelpCard>

      <HelpCard title="Pattern-Derived Levels (Optional)">
        <p className="text-sm text-blue-200 mb-3">
          These levels are only available if the corresponding pattern is detected. If not detected, 
          the strategy will skip the stock (or mark it as not eligible).
        </p>
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>double_bottom_support</code> — Support level from Double Bottom pattern</li>
          <li><code>double_bottom_neckline</code> — Resistance/neckline from Double Bottom</li>
          <li><code>double_top_resistance</code> — Resistance from Double Top pattern</li>
          <li><code>ascending_triangle_resistance</code> — Flat resistance in Ascending Triangle</li>
          <li><code>primary_support</code> — Strongest support from any detected pattern</li>
          <li><code>primary_resistance</code> — Strongest resistance from any detected pattern</li>
        </ul>
        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-xs text-yellow-200">
            ⚠️ <strong>Note:</strong> Pattern-based levels are rare! Only use them if you want to wait for specific chart patterns. 
            For broader scans, use EMAs, VWAP, or simple expressions.
          </p>
        </div>
      </HelpCard>

      <HelpCard title="Dynamic Expressions">
        <ul className="space-y-3 text-sm text-white/90">
          <li><code>ema50+1*ATR</code> — 1 ATR above EMA50</li>
          <li><code>ema20-0.5*ATR</code> — 0.5 ATR below EMA20</li>
          <li><code>close+2%</code> — 2% above current price</li>
          <li><code>vwap-1%</code> — 1% below VWAP</li>
          <li><code>(ema20+ema50)/2</code> — Midpoint between EMA20 and EMA50</li>
        </ul>
      </HelpCard>

      <HelpCard title="Examples">
        <div className="space-y-3">
          <Example
            value="ema20"
            desc="Enter when price touches or crosses above EMA20"
          />
          <Example
            value="ema50-1*ATR"
            desc="Enter at 1 ATR below EMA50 (pullback entry)"
          />
          <Example
            value="vwap"
            desc="Enter when price crosses VWAP (intraday strategies)"
          />
          <Example
            value="close"
            desc="Enter at market price (immediate entry)"
          />
          <Example
            value="primary_support"
            desc="Enter at the strongest support level from detected patterns (RARE!)"
          />
        </div>
      </HelpCard>
    </div>
  );
}

// Stop Loss Help Section
function StopLossHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white mb-3">🛑 Stop Loss Level Reference</h3>
        <p className="text-blue-200 mb-4">
          Define where to exit if the trade moves against you. Supports ATR-based stops, 
          fixed percentage, swing points, or pattern-based levels.
        </p>
      </div>

      <HelpCard title="ATR-Based Stops (Most Common)">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>entry-1*ATR</code> — 1 ATR below entry (for longs)</li>
          <li><code>entry-1.5*ATR</code> — 1.5 ATR below entry</li>
          <li><code>entry-2*ATR</code> — 2 ATR below entry (wider stop)</li>
          <li><code>entry+1*ATR</code> — 1 ATR above entry (for shorts)</li>
        </ul>
      </HelpCard>

      <HelpCard title="Percentage-Based Stops">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>entry-2%</code> — 2% below entry</li>
          <li><code>entry-5%</code> — 5% below entry</li>
          <li><code>close-3%</code> — 3% below current price</li>
        </ul>
      </HelpCard>

      <HelpCard title="Indicator-Based Stops">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>ema50</code> — Stop at EMA50 level</li>
          <li><code>ema20-0.5*ATR</code> — Half ATR below EMA20</li>
          <li><code>vwap</code> — Stop at VWAP</li>
        </ul>
      </HelpCard>

      <HelpCard title="Pattern-Based Stops (When Pattern Detected)">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>double_bottom_support-0.5*ATR</code> — Below double bottom support</li>
          <li><code>primary_support-1*ATR</code> — Below primary support level</li>
          <li><code>ascending_triangle_support</code> — At triangle support line</li>
        </ul>
        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-xs text-yellow-200">
            ⚠️ Pattern-based stops require the pattern to be detected first. Consider using EMAs or ATR-based stops for more consistent results.
          </p>
        </div>
      </HelpCard>

      <HelpCard title="Examples">
        <div className="space-y-3">
          <Example
            value="entry-1.5*ATR"
            desc="Standard stop: 1.5 times ATR below entry price (most common)"
          />
          <Example
            value="entry-2%"
            desc="Fixed 2% stop loss below entry"
          />
          <Example
            value="ema50-0.5*ATR"
            desc="Stop just below EMA50 with a buffer"
          />
          <Example
            value="low"
            desc="Stop at the current bar's low (tight stop)"
          />
        </div>
      </HelpCard>
    </div>
  );
}

// Target Level Help Section
function TargetLevelHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white mb-3">🎯 Target Level Reference</h3>
        <p className="text-blue-200 mb-4">
          Define one or more profit targets. Most strategies use ATR-based targets for dynamic risk-reward ratios.
        </p>
      </div>

      <HelpCard title="ATR-Based Targets (Recommended)">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>entry+1*ATR</code> — 1 ATR profit (1:1 R:R if stop is 1 ATR)</li>
          <li><code>entry+1.5*ATR</code> — 1.5 ATR profit (1.5:1 R:R)</li>
          <li><code>entry+2*ATR</code> — 2 ATR profit (2:1 R:R)</li>
          <li><code>entry+3*ATR</code> — 3 ATR profit (3:1 R:R)</li>
        </ul>
      </HelpCard>

      <HelpCard title="Percentage-Based Targets">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>entry+5%</code> — 5% profit target</li>
          <li><code>entry+10%</code> — 10% profit target</li>
          <li><code>close+3%</code> — 3% above current price</li>
        </ul>
      </HelpCard>

      <HelpCard title="Indicator-Based Targets">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>ema200</code> — Exit at EMA200</li>
          <li><code>ema50+1*ATR</code> — 1 ATR above EMA50</li>
          <li><code>vwap+2%</code> — 2% above VWAP</li>
        </ul>
      </HelpCard>

      <HelpCard title="Pattern-Based Targets">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>double_bottom_target</code> — Calculated target from double bottom</li>
          <li><code>pattern_target</code> — Generic pattern projection target</li>
          <li><code>ascending_triangle_target</code> — Triangle breakout target</li>
        </ul>
      </HelpCard>

      <HelpCard title="Multiple Targets Example">
        <div className="space-y-3">
          <Example
            value="entry+1.5*ATR (T1)"
            desc="First target at 1.5 ATR, exit 50% position"
          />
          <Example
            value="entry+2.5*ATR (T2)"
            desc="Second target at 2.5 ATR, exit another 25%"
          />
          <Example
            value="entry+4*ATR (T3)"
            desc="Runner target at 4 ATR, exit remaining position"
          />
        </div>
      </HelpCard>
    </div>
  );
}

// Price Distance Help Section
function PriceDistanceHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white mb-3">📏 Price Distance Rules</h3>
        <p className="text-blue-200 mb-4">
          Price distance rules ensure the stock is within a specific range from a key level. 
          This is useful for pullback strategies.
        </p>
      </div>

      <HelpCard title="Format: From Level + Max Distance + Unit">
        <div className="bg-slate-800/50 p-4 rounded-lg border border-white/10 mb-4">
          <p className="text-sm text-white/80 mb-2">Structure:</p>
          <code className="text-blue-300 text-sm">fromLevel: "ema50"</code><br />
          <code className="text-blue-300 text-sm">maxDistance: 1.5</code><br />
          <code className="text-blue-300 text-sm">unit: "atr" | "%"</code>
        </div>
      </HelpCard>

      <HelpCard title="Valid 'From Level' Values">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>ema20</code>, <code>ema50</code>, <code>ema200</code> — Moving averages</li>
          <li><code>vwap</code> — Volume-weighted average price</li>
          <li><code>close</code> — Current close price</li>
          <li><code>high</code>, <code>low</code> — Current bar extremes</li>
          <li><code>double_bottom_support</code> — Pattern-derived support (if detected)</li>
          <li><code>primary_support</code>, <code>primary_resistance</code> — Strongest pattern levels</li>
        </ul>
      </HelpCard>

      <HelpCard title="Examples">
        <div className="space-y-3">
          <Example
            value="From: ema50, Max: 1.5, Unit: ATR"
            desc="Price must be within 1.5 ATR of EMA50 (pullback filter)"
          />
          <Example
            value="From: ema20, Max: 2, Unit: %"
            desc="Price must be within 2% of EMA20"
          />
          <Example
            value="From: vwap, Max: 1, Unit: ATR"
            desc="Price must be within 1 ATR of VWAP"
          />
          <Example
            value="From: double_bottom_support, Max: 0.5, Unit: ATR"
            desc="Price must be near double bottom support (only if pattern detected)"
          />
        </div>
      </HelpCard>

      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-sm text-blue-200">
          💡 <strong>Tip:</strong> Price distance rules are cumulative with all other eligibility criteria. 
          Remove pattern-based distances if you want broader scan results.
        </p>
      </div>
    </div>
  );
}

// Expression Syntax Help Section
function ExpressionSyntaxHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white mb-3">🧮 Expression Syntax Guide</h3>
        <p className="text-blue-200 mb-4">
          Expressions allow you to calculate dynamic price levels using math operations.
        </p>
      </div>

      <HelpCard title="Supported Operators">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>+</code> — Addition (e.g., <code>entry+1*ATR</code>)</li>
          <li><code>-</code> — Subtraction (e.g., <code>entry-2%</code>)</li>
          <li><code>*</code> — Multiplication (e.g., <code>2*ATR</code>)</li>
          <li><code>/</code> — Division (e.g., <code>(ema20+ema50)/2</code>)</li>
          <li><code>( )</code> — Grouping for order of operations</li>
        </ul>
      </HelpCard>

      <HelpCard title="Available Variables">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-white font-semibold mb-2 text-sm">Price & Bars</h4>
            <ul className="space-y-1 text-sm text-white/90">
              <li><code>entry</code> or <code>close</code></li>
              <li><code>high</code>, <code>low</code>, <code>open</code></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-2 text-sm">Indicators</h4>
            <ul className="space-y-1 text-sm text-white/90">
              <li><code>ema20</code>, <code>ema50</code>, <code>ema200</code></li>
              <li><code>ATR</code> (always uppercase)</li>
              <li><code>vwap</code> (intraday)</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-2 text-sm">Percentage</h4>
            <ul className="space-y-1 text-sm text-white/90">
              <li><code>%</code> — Percentage of base value</li>
              <li>Example: <code>entry+5%</code></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-2 text-sm">Patterns</h4>
            <ul className="space-y-1 text-sm text-white/90">
              <li><code>double_bottom_support</code></li>
              <li><code>primary_support</code></li>
              <li><code>pattern_target</code></li>
            </ul>
          </div>
        </div>
      </HelpCard>

      <HelpCard title="Expression Examples">
        <div className="space-y-3">
          <Example
            value="entry+1.5*ATR"
            desc="Entry price plus 1.5 times ATR"
          />
          <Example
            value="ema50-2%"
            desc="2% below EMA50"
          />
          <Example
            value="(ema20+ema50)/2"
            desc="Midpoint between two EMAs"
          />
          <Example
            value="vwap+0.5*ATR"
            desc="Half ATR above VWAP"
          />
          <Example
            value="double_bottom_support+1*ATR"
            desc="1 ATR above pattern support (if detected)"
          />
          <Example
            value="close+10%"
            desc="10% above current price"
          />
        </div>
      </HelpCard>

      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <p className="text-sm text-purple-200 mb-2">
          ⚡ <strong>Pro Tips:</strong>
        </p>
        <ul className="text-sm text-purple-200 space-y-1 list-disc list-inside">
          <li>ATR must be uppercase: <code>ATR</code> not <code>atr</code></li>
          <li>Use parentheses for complex calculations: <code>(a+b)/2</code></li>
          <li>Percentages are relative to the base: <code>ema50+5%</code> = EMA50 × 1.05</li>
          <li>Pattern variables only work when pattern is detected</li>
        </ul>
      </div>
    </div>
  );
}

// Pattern Variables Help Section
function PatternVariablesHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white mb-3">📊 Pattern-Derived Variables</h3>
        <p className="text-blue-200 mb-4">
          These variables are extracted from detected chart patterns. They're only available if the pattern is found.
        </p>
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-4">
          <p className="text-sm text-yellow-200">
            ⚠️ <strong>Important:</strong> Pattern-based levels are <strong>RARE</strong>. Patterns have strict detection criteria 
            and may only appear in 1-5% of stocks. If you use pattern variables in your strategy, expect very few qualified results.
          </p>
        </div>
      </div>

      <HelpCard title="Double Bottom Variables">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>double_bottom_support</code> — The support level (low points)</li>
          <li><code>double_bottom_neckline</code> — The neckline (resistance between bottoms)</li>
          <li><code>double_bottom_target</code> — Calculated price target</li>
        </ul>
        <p className="text-xs text-blue-300 mt-3">Detection Window: Last 50 bars | Required: Symmetry ≤2%, Separation ≥10 bars</p>
      </HelpCard>

      <HelpCard title="Double Top Variables">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>double_top_resistance</code> — The resistance level (high points)</li>
          <li><code>double_top_neckline</code> — The neckline (support between tops)</li>
          <li><code>double_top_target</code> — Calculated price target</li>
        </ul>
      </HelpCard>

      <HelpCard title="Triangle Variables">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>ascending_triangle_resistance</code> — Flat resistance line</li>
          <li><code>ascending_triangle_support</code> — Rising support line</li>
          <li><code>ascending_triangle_target</code> — Breakout target</li>
          <li><code>descending_triangle_resistance</code> — Falling resistance line</li>
          <li><code>descending_triangle_support</code> — Flat support line</li>
          <li><code>descending_triangle_target</code> — Breakdown target</li>
        </ul>
        <p className="text-xs text-blue-300 mt-3">Detection Window: Last 80 bars</p>
      </HelpCard>

      <HelpCard title="Flag Pattern Variables">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>bullish_flag_support</code> — Lower channel line</li>
          <li><code>bullish_flag_resistance</code> — Upper channel line</li>
          <li><code>bullish_flag_target</code> — Breakout target (pole height projection)</li>
          <li><code>bearish_flag_support</code> — Lower channel line</li>
          <li><code>bearish_flag_resistance</code> — Upper channel line</li>
          <li><code>bearish_flag_target</code> — Breakdown target</li>
        </ul>
      </HelpCard>

      <HelpCard title="Generic Pattern Variables">
        <ul className="space-y-2 text-sm text-white/90">
          <li><code>primary_support</code> — Strongest support from highest-confidence pattern</li>
          <li><code>primary_resistance</code> — Strongest resistance from highest-confidence pattern</li>
          <li><code>breakout_level</code> — Key breakout/breakdown level</li>
          <li><code>pattern_target</code> — Generic pattern target projection</li>
        </ul>
      </HelpCard>

      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <h4 className="text-red-200 font-semibold mb-2">Why Am I Getting 0 Qualified Results?</h4>
        <p className="text-sm text-red-200 mb-3">
          If your strategy uses pattern variables (like <code>double_bottom_support</code>) and you're getting 0 results:
        </p>
        <ul className="text-sm text-red-200 space-y-1 list-disc list-inside">
          <li>The pattern detection window is limited (50-80 bars)</li>
          <li>Patterns require strict criteria: symmetry, separation, touches, volume</li>
          <li>Only 1-5% of stocks may have valid patterns at any given time</li>
        </ul>
        <p className="text-sm text-red-200 mt-3 font-semibold">
          ✅ Solution: Use EMA levels (<code>ema20</code>, <code>ema50</code>) or VWAP instead of pattern variables for broader scans.
        </p>
      </div>
    </div>
  );
}

// Helper Components
function HelpCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded-lg p-5 border border-white/10">
      <h4 className="text-white font-semibold mb-3">{title}</h4>
      {children}
    </div>
  );
}

function Example({ value, desc }: { value: string; desc: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-white/10">
      <code className="text-green-300 text-sm font-mono block mb-1">{value}</code>
      <p className="text-xs text-blue-200">{desc}</p>
    </div>
  );
}

