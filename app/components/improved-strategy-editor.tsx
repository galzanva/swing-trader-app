'use client';

/**
 * Improved Strategy Editor with Dropdowns and Visual Guidance
 * 
 * Features:
 * - Dropdowns for all options (no more typing field names)
 * - Pre-built templates
 * - Visual condition builder
 * - Clear help text
 */

import { useState } from 'react';
import type { StrategyDsl, EmaRule, VolumeRule, PriceDistance, CandlePattern, ChartPattern } from '@/lib/strategy-builder/dsl-schema';

interface ImprovedStrategyEditorProps {
  dsl: StrategyDsl;
  onChange: (updates: Partial<StrategyDsl>) => void;
}

// Available price levels for dropdowns
const PRICE_LEVELS = [
  { value: 'ema9', label: 'EMA 9', category: 'Moving Averages' },
  { value: 'ema20', label: 'EMA 20', category: 'Moving Averages' },
  { value: 'ema50', label: 'EMA 50', category: 'Moving Averages' },
  { value: 'ema200', label: 'EMA 200', category: 'Moving Averages' },
  { value: 'high', label: 'Bar High', category: 'Price Action' },
  { value: 'low', label: 'Bar Low', category: 'Price Action' },
  { value: 'close', label: 'Close Price', category: 'Price Action' },
  { value: 'price', label: 'Current Price', category: 'Price Action' },
  { value: 'primary_support', label: 'Primary Support', category: 'Pattern Levels' },
  { value: 'primary_resistance', label: 'Primary Resistance', category: 'Pattern Levels' },
  { value: 'double_bottom_support', label: 'Double Bottom Support', category: 'Pattern Levels' },
  { value: 'double_bottom_neckline', label: 'Double Bottom Neckline', category: 'Pattern Levels' },
  { value: 'double_top_resistance', label: 'Double Top Resistance', category: 'Pattern Levels' },
  { value: 'double_top_neckline', label: 'Double Top Neckline', category: 'Pattern Levels' },
  { value: 'ascending_triangle_resistance', label: 'Ascending Triangle Resistance', category: 'Pattern Levels' },
  { value: 'descending_triangle_support', label: 'Descending Triangle Support', category: 'Pattern Levels' },
  { value: 'bullish_flag_resistance', label: 'Bullish Flag Resistance', category: 'Pattern Levels' },
  { value: 'bearish_flag_support', label: 'Bearish Flag Support', category: 'Pattern Levels' },
  { value: 'breakout_level', label: 'Breakout Level', category: 'Pattern Levels' },
];

// Group levels by category for optgroup display
const GROUPED_LEVELS = PRICE_LEVELS.reduce((acc, level) => {
  if (!acc[level.category]) acc[level.category] = [];
  acc[level.category].push(level);
  return acc;
}, {} as Record<string, typeof PRICE_LEVELS>);

const CANDLE_PATTERNS = [
  { value: 'bullish_engulfing', label: '🟢 Bullish Engulfing' },
  { value: 'bearish_engulfing', label: '🔴 Bearish Engulfing' },
  { value: 'hammer', label: '🔨 Hammer (Bullish Reversal)' },
  { value: 'shooting_star', label: '⭐ Shooting Star (Bearish Reversal)' },
  { value: 'doji', label: '➕ Doji (Indecision)' },
  { value: 'any_bullish', label: '✅ Any Bullish Pattern' },
  { value: 'any_bearish', label: '❌ Any Bearish Pattern' },
];

const CHART_PATTERNS = [
  { value: 'double_bottom', label: 'Double Bottom (Bullish)' },
  { value: 'double_top', label: 'Double Top (Bearish)' },
  { value: 'triangle', label: 'Triangle (Consolidation)' },
  { value: 'flag', label: 'Flag (Continuation)' },
  { value: 'head_shoulders', label: 'Head & Shoulders' },
  { value: 'wedge', label: 'Wedge' },
];

export default function ImprovedStrategyEditor({ dsl, onChange }: ImprovedStrategyEditorProps) {
  const [activeTab, setActiveTab] = useState<'trend' | 'momentum' | 'patterns' | 'risk'>('trend');

  const updateEligibility = (updates: any) => {
    onChange({
      eligibility: {
        ...dsl.eligibility,
        ...updates,
      },
    });
  };

  // EMA Rules
  const emaRules = dsl.eligibility?.emaRules || [];
  const addEmaRule = () => {
    updateEligibility({
      emaRules: [...emaRules, { ema1: 20, operator: '>', ema2: 50 }],
    });
  };
  const updateEmaRule = (index: number, updates: Partial<EmaRule>) => {
    const newRules = [...emaRules];
    newRules[index] = { ...newRules[index], ...updates };
    updateEligibility({ emaRules: newRules });
  };
  const removeEmaRule = (index: number) => {
    const newRules = [...emaRules];
    newRules.splice(index, 1);
    updateEligibility({ emaRules: newRules });
  };

  // Price Distance Rules
  const priceDistances = dsl.eligibility?.priceDistances || [];
  const addPriceDistance = () => {
    updateEligibility({
      priceDistances: [...priceDistances, { fromLevel: 'ema50', maxDistance: 1.5, unit: 'atr' }],
    });
  };
  const updatePriceDistance = (index: number, updates: Partial<PriceDistance>) => {
    const newDistances = [...priceDistances];
    newDistances[index] = { ...newDistances[index], ...updates };
    updateEligibility({ priceDistances: newDistances });
  };
  const removePriceDistance = (index: number) => {
    const newDistances = [...priceDistances];
    newDistances.splice(index, 1);
    updateEligibility({ priceDistances: newDistances });
  };

  // Candle Patterns
  const candlePatterns = dsl.eligibility?.candlePatterns || [];
  const addCandlePattern = () => {
    updateEligibility({
      candlePatterns: [...candlePatterns, { name: 'bullish_engulfing' }],
    });
  };
  const updateCandlePattern = (index: number, updates: Partial<CandlePattern>) => {
    const newPatterns = [...candlePatterns];
    newPatterns[index] = { ...newPatterns[index], ...updates };
    updateEligibility({ candlePatterns: newPatterns });
  };
  const removeCandlePattern = (index: number) => {
    const newPatterns = [...candlePatterns];
    newPatterns.splice(index, 1);
    updateEligibility({ candlePatterns: newPatterns });
  };

  return (
    <div className="space-y-6">
      {/* Strategy Name & Description */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">📋 Strategy Details</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">
              Strategy Name *
            </label>
            <input
              type="text"
              value={dsl.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g., EMA Pullback with Confirmation"
              className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">
              Description (optional)
            </label>
            <textarea
              value={dsl.description || ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Describe what this strategy does and when to use it..."
              rows={2}
              className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">
                Direction *
              </label>
              <select
                value={dsl.direction}
                onChange={(e) => onChange({ direction: e.target.value as any })}
                className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="long">📈 Long (Buy)</option>
                <option value="short">📉 Short (Sell)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">
                Timeframe *
              </label>
              <select
                value={dsl.timeframe}
                onChange={(e) => onChange({ timeframe: e.target.value as any })}
                className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1min">1 Minute</option>
                <option value="5min">5 Minutes</option>
                <option value="15min">15 Minutes</option>
                <option value="1hour">1 Hour</option>
                <option value="1day">Daily</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs for Conditions */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('trend')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'trend'
                ? 'bg-blue-600/20 text-blue-300 border-b-2 border-blue-500'
                : 'text-blue-300 hover:text-white hover:bg-white/5'
            }`}
          >
            📈 Trend & EMAs
          </button>
          <button
            onClick={() => setActiveTab('momentum')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'momentum'
                ? 'bg-blue-600/20 text-blue-300 border-b-2 border-blue-500'
                : 'text-blue-300 hover:text-white hover:bg-white/5'
            }`}
          >
            ⚡ Momentum & RSI
          </button>
          <button
            onClick={() => setActiveTab('patterns')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'patterns'
                ? 'bg-blue-600/20 text-blue-300 border-b-2 border-blue-500'
                : 'text-blue-300 hover:text-white hover:bg-white/5'
            }`}
          >
            🎯 Patterns & Entry
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'risk'
                ? 'bg-blue-600/20 text-blue-300 border-b-2 border-blue-500'
                : 'text-blue-300 hover:text-white hover:bg-white/5'
            }`}
          >
            🛡️ Risk & Targets
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Trend & EMAs Tab */}
          {activeTab === 'trend' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-white">EMA Trend Rules</h4>
                  <p className="text-sm text-blue-300 mt-1">
                    Define which moving averages need to align (e.g., EMA 20 above EMA 50)
                  </p>
                </div>
                <button
                  onClick={addEmaRule}
                  className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded-lg border border-green-500/30 transition-all flex items-center gap-2"
                >
                  <span className="text-lg">+</span>
                  Add EMA Rule
                </button>
              </div>

              {emaRules.length === 0 && (
                <div className="text-center py-8 text-blue-300 border-2 border-dashed border-white/10 rounded-lg">
                  <p className="mb-2">No EMA rules yet</p>
                  <p className="text-xs">Click "Add EMA Rule" to require specific trend alignment</p>
                </div>
              )}

              {emaRules.map((rule, idx) => (
                <div key={idx} className="bg-slate-900/50 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-blue-200 text-sm font-medium">EMA</span>
                    
                    <input
                      type="number"
                      value={rule.ema1}
                      onChange={(e) => updateEmaRule(idx, { ema1: Number(e.target.value) })}
                      className="w-20 px-3 py-2 bg-white/10 text-white rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="200"
                    />
                    
                    <select
                      value={rule.operator}
                      onChange={(e) => updateEmaRule(idx, { operator: e.target.value as any })}
                      className="px-3 py-2 bg-white/10 text-white rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value=">">is above {'>'}</option>
                      <option value="<">is below {'<'}</option>
                      <option value=">=">is at or above {'>='}</option>
                      <option value="<=">is at or below {'<='}</option>
                    </select>
                    
                    <span className="text-blue-200 text-sm font-medium">EMA</span>
                    
                    <input
                      type="number"
                      value={rule.ema2}
                      onChange={(e) => updateEmaRule(idx, { ema2: Number(e.target.value) })}
                      className="w-20 px-3 py-2 bg-white/10 text-white rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="200"
                    />
                    
                    <button
                      onClick={() => removeEmaRule(idx)}
                      className="ml-auto px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg border border-red-500/30 transition-all"
                      title="Remove this rule"
                    >
                      🗑️
                    </button>
                  </div>
                  
                  {/* Human-readable description */}
                  <p className="text-xs text-blue-300 mt-2 ml-1">
                    ✓ Requires the {rule.ema1}-period EMA to be {rule.operator === '>' ? 'above' : rule.operator === '<' ? 'below' : rule.operator} the {rule.ema2}-period EMA
                  </p>
                </div>
              ))}

              {/* Pullback to Support Section */}
              <div className="border-t border-white/10 pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Pullback Rules (Optional)</h4>
                    <p className="text-sm text-blue-300 mt-1">
                      Wait for price to pull back to a support level before entering
                    </p>
                  </div>
                  <button
                    onClick={addPriceDistance}
                    className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded-lg border border-green-500/30 transition-all flex items-center gap-2"
                  >
                    <span className="text-lg">+</span>
                    Add Pullback Rule
                  </button>
                </div>

                {priceDistances.map((distance, idx) => (
                  <div key={idx} className="bg-slate-900/50 rounded-lg p-4 border border-white/10 mb-3">
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-blue-300 mb-1">
                            Pull back to:
                          </label>
                          <select
                            value={distance.fromLevel}
                            onChange={(e) => updatePriceDistance(idx, { fromLevel: e.target.value })}
                            className="w-full px-3 py-2 bg-white/10 text-white text-sm rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {Object.entries(GROUPED_LEVELS).map(([category, levels]) => (
                              <optgroup key={category} label={category}>
                                {levels.map(level => (
                                  <option key={level.value} value={level.value}>
                                    {level.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-blue-300 mb-1">
                            Within distance:
                          </label>
                          <input
                            type="number"
                            value={distance.maxDistance}
                            onChange={(e) => updatePriceDistance(idx, { maxDistance: Number(e.target.value) })}
                            step="0.1"
                            min="0.1"
                            className="w-full px-3 py-2 bg-white/10 text-white text-sm rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-blue-300 mb-1">
                            Unit:
                          </label>
                          <select
                            value={distance.unit}
                            onChange={(e) => updatePriceDistance(idx, { unit: e.target.value as 'atr' | 'pct' })}
                            className="w-full px-3 py-2 bg-white/10 text-white text-sm rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="atr">ATR (volatility)</option>
                            <option value="pct">% (percentage)</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-blue-300">
                          ✓ Price must be within {distance.maxDistance} {distance.unit.toUpperCase()} of{' '}
                          {PRICE_LEVELS.find(l => l.value === distance.fromLevel)?.label}
                        </p>
                        <button
                          onClick={() => removePriceDistance(idx)}
                          className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg border border-red-500/30 transition-all text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Momentum & RSI Tab */}
          {activeTab === 'momentum' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">RSI Range (Optional)</h4>
                <p className="text-sm text-blue-300 mb-4">
                  Filter for specific momentum conditions
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">
                      Minimum RSI
                    </label>
                    <input
                      type="number"
                      value={dsl.eligibility?.rsiRange?.min || 0}
                      onChange={(e) => updateEligibility({
                        rsiRange: {
                          period: 14,
                          min: Number(e.target.value),
                          max: dsl.eligibility?.rsiRange?.max || 100,
                        }
                      })}
                      min="0"
                      max="100"
                      className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-blue-300 mt-1">
                      0-30: Oversold | 30-50: Weak | 50-70: Strong | 70-100: Overbought
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">
                      Maximum RSI
                    </label>
                    <input
                      type="number"
                      value={dsl.eligibility?.rsiRange?.max || 100}
                      onChange={(e) => updateEligibility({
                        rsiRange: {
                          period: 14,
                          min: dsl.eligibility?.rsiRange?.min || 0,
                          max: Number(e.target.value),
                        }
                      })}
                      min="0"
                      max="100"
                      className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {(dsl.eligibility?.rsiRange?.min || 0) > 0 || (dsl.eligibility?.rsiRange?.max || 100) < 100 ? (
                  <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-blue-200">
                      ✓ RSI must be between {dsl.eligibility?.rsiRange?.min || 0} and {dsl.eligibility?.rsiRange?.max || 100}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-white/10 pt-6">
                <h4 className="text-lg font-semibold text-white mb-2">ATR Range (Optional)</h4>
                <p className="text-sm text-blue-300 mb-4">
                  Filter for specific volatility levels
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">
                      Minimum ATR %
                    </label>
                    <input
                      type="number"
                      value={dsl.eligibility?.atrRange?.minPct || 0}
                      onChange={(e) => updateEligibility({
                        atrRange: {
                          period: 14,
                          minPct: Number(e.target.value),
                          maxPct: dsl.eligibility?.atrRange?.maxPct || 100,
                        }
                      })}
                      min="0"
                      step="0.1"
                      className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-blue-300 mt-1">
                      0-2%: Low volatility | 2-4%: Moderate | 4%+: High volatility
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">
                      Maximum ATR %
                    </label>
                    <input
                      type="number"
                      value={dsl.eligibility?.atrRange?.maxPct || 100}
                      onChange={(e) => updateEligibility({
                        atrRange: {
                          period: 14,
                          minPct: dsl.eligibility?.atrRange?.minPct || 0,
                          maxPct: Number(e.target.value),
                        }
                      })}
                      min="0"
                      step="0.1"
                      className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Patterns & Entry Tab */}
          {activeTab === 'patterns' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Candle Patterns (Optional)</h4>
                    <p className="text-sm text-blue-300 mt-1">
                      Require specific candlestick patterns for confirmation
                    </p>
                  </div>
                  <button
                    onClick={addCandlePattern}
                    className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded-lg border border-green-500/30 transition-all flex items-center gap-2"
                  >
                    <span className="text-lg">+</span>
                    Add Pattern
                  </button>
                </div>

                {candlePatterns.map((pattern, idx) => (
                  <div key={idx} className="bg-slate-900/50 rounded-lg p-4 border border-white/10 mb-3">
                    <div className="flex items-center gap-3">
                      <select
                        value={pattern.name}
                        onChange={(e) => updateCandlePattern(idx, { name: e.target.value as any })}
                        className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {CANDLE_PATTERNS.map(cp => (
                          <option key={cp.value} value={cp.value}>
                            {cp.label}
                          </option>
                        ))}
                      </select>
                      
                      <button
                        onClick={() => removeCandlePattern(idx)}
                        className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg border border-red-500/30 transition-all"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 pt-6">
                <h4 className="text-lg font-semibold text-white mb-4">Trigger (Entry Point) *</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">
                      Trigger Type
                    </label>
                    <select
                      value={dsl.trigger.type}
                      onChange={(e) => onChange({
                        trigger: { ...dsl.trigger, type: e.target.value as any }
                      })}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="breakout">🚀 Breakout (Price breaks above/below a level)</option>
                      <option value="pullback">↩️ Pullback (Price returns to support)</option>
                      <option value="reversal">🔄 Reversal (Trend change)</option>
                      <option value="continuation">➡️ Continuation (Trend continues)</option>
                      <option value="custom">⚙️ Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">
                      Trigger Level
                    </label>
                    <select
                      value={dsl.trigger.level}
                      onChange={(e) => onChange({
                        trigger: { ...dsl.trigger, level: e.target.value }
                      })}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(GROUPED_LEVELS).map(([category, levels]) => (
                        <optgroup key={category} label={category}>
                          {levels.map(level => (
                            <option key={level.value} value={level.value}>
                              {level.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={dsl.trigger.description}
                    onChange={(e) => onChange({
                      trigger: { ...dsl.trigger, description: e.target.value }
                    })}
                    placeholder="e.g., When price breaks above the neckline with volume"
                    className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Risk & Targets Tab */}
          {activeTab === 'risk' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-white mb-4">Stop Loss *</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">
                      Stop Loss Type
                    </label>
                    <select
                      value={dsl.stop.type}
                      onChange={(e) => onChange({
                        stop: { ...dsl.stop, type: e.target.value as any }
                      })}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="atr">📏 ATR-Based (Volatility)</option>
                      <option value="swing">📊 Swing Low/High</option>
                      <option value="ema">📈 EMA Level</option>
                      <option value="fixed">💰 Fixed Price</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">
                      Stop Loss Value
                    </label>
                    <input
                      type="text"
                      value={dsl.stop.value}
                      onChange={(e) => onChange({
                        stop: { ...dsl.stop, value: e.target.value }
                      })}
                      placeholder="e.g., entry-1.5*ATR"
                      className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-blue-300 mt-1">
                      Examples: entry-1.5*ATR, ema50, low-0.5*ATR, 45.50
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Profit Targets *</h4>
                    <p className="text-sm text-blue-300 mt-1">
                      Define where to take profits (at least 1 target required)
                    </p>
                  </div>
                </div>

                {dsl.targets.map((target, idx) => (
                  <div key={idx} className="bg-slate-900/50 rounded-lg p-4 border border-white/10 mb-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-blue-300 mb-1">
                          Target Label
                        </label>
                        <input
                          type="text"
                          value={target.label || `T${idx + 1}`}
                          onChange={(e) => {
                            const newTargets = [...dsl.targets];
                            newTargets[idx] = { ...newTargets[idx], label: e.target.value };
                            onChange({ targets: newTargets });
                          }}
                          placeholder={`T${idx + 1}`}
                          className="w-full px-3 py-2 bg-white/10 text-white text-sm rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-blue-300 mb-1">
                          Price Level
                        </label>
                        <input
                          type="text"
                          value={target.level}
                          onChange={(e) => {
                            const newTargets = [...dsl.targets];
                            newTargets[idx] = { ...newTargets[idx], level: e.target.value };
                            onChange({ targets: newTargets });
                          }}
                          placeholder="entry+2*ATR"
                          className="w-full px-3 py-2 bg-white/10 text-white text-sm rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex items-end gap-2">
                        <input
                          type="number"
                          value={target.rr || ''}
                          onChange={(e) => {
                            const newTargets = [...dsl.targets];
                            newTargets[idx] = { ...newTargets[idx], rr: Number(e.target.value) || undefined };
                            onChange({ targets: newTargets });
                          }}
                          placeholder="R:R"
                          step="0.1"
                          className="flex-1 px-3 py-2 bg-white/10 text-white text-sm rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {dsl.targets.length > 1 && (
                          <button
                            onClick={() => {
                              const newTargets = [...dsl.targets];
                              newTargets.splice(idx, 1);
                              onChange({ targets: newTargets });
                            }}
                            className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg border border-red-500/30 transition-all"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {dsl.targets.length < 3 && (
                  <button
                    onClick={() => {
                      onChange({
                        targets: [...dsl.targets, { level: 'entry+2*ATR', label: `T${dsl.targets.length + 1}` }]
                      });
                    }}
                    className="w-full px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded-lg border border-green-500/30 transition-all"
                  >
                    + Add Target
                  </button>
                )}
              </div>

              <div className="border-t border-white/10 pt-6">
                <h4 className="text-lg font-semibold text-white mb-4">Risk Management</h4>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">
                      Minimum R:R Ratio
                    </label>
                    <input
                      type="number"
                      value={dsl.riskManagement?.minRR || 1.5}
                      onChange={(e) => onChange({
                        riskManagement: {
                          ...dsl.riskManagement,
                          minRR: Number(e.target.value),
                          maxPositionSize: dsl.riskManagement?.maxPositionSize || 2,
                          earningsDaysBuffer: dsl.riskManagement?.earningsDaysBuffer || 3,
                        }
                      })}
                      step="0.1"
                      min="1"
                      className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">
                      Max Position Size (%)
                    </label>
                    <input
                      type="number"
                      value={dsl.riskManagement?.maxPositionSize || 2}
                      onChange={(e) => onChange({
                        riskManagement: {
                          ...dsl.riskManagement,
                          minRR: dsl.riskManagement?.minRR || 1.5,
                          maxPositionSize: Number(e.target.value),
                          earningsDaysBuffer: dsl.riskManagement?.earningsDaysBuffer || 3,
                        }
                      })}
                      step="0.5"
                      min="0.5"
                      max="10"
                      className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">
                      Earnings Buffer (Days)
                    </label>
                    <input
                      type="number"
                      value={dsl.riskManagement?.earningsDaysBuffer || 3}
                      onChange={(e) => onChange({
                        riskManagement: {
                          ...dsl.riskManagement,
                          minRR: dsl.riskManagement?.minRR || 1.5,
                          maxPositionSize: dsl.riskManagement?.maxPositionSize || 2,
                          earningsDaysBuffer: Number(e.target.value),
                        }
                      })}
                      min="0"
                      max="7"
                      className="w-full px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-200">
                    ℹ️ Trades must have at least {dsl.riskManagement?.minRR || 1.5}:1 risk-to-reward ratio and position size will be capped at {dsl.riskManagement?.maxPositionSize || 2}% of your portfolio
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

