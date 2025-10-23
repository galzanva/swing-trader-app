'use client';

/**
 * Comprehensive Condition Editor Component
 * 
 * Allows editing of complex multi-condition strategies with:
 * - Multiple EMA rules
 * - RSI/ATR ranges
 * - Volume rules
 * - Price distances
 * - Candle/chart patterns
 * - Multi-bar conditions
 */

import { useState } from 'react';
import type { StrategyDsl, EmaRule, VolumeRule, PriceDistance, CandlePattern, ChartPattern, MultiBarCondition, SqueezeDynamics } from '@/lib/strategy-builder/dsl-schema';
import HelpIcon from './help-icon';
import StrategyHelpModal from './strategy-help-modal';

interface ConditionEditorProps {
  dsl: StrategyDsl;
  onChange: (updates: Partial<StrategyDsl>) => void;
}

export default function StrategyConditionEditor({ dsl, onChange }: ConditionEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['ema']));
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSection, setHelpSection] = useState<'trigger' | 'stop' | 'target' | 'price-distance' | 'expression' | 'patterns' | 'all'>('all');

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const updateEligibility = (updates: any) => {
    onChange({
      eligibility: {
        ...dsl.eligibility,
        ...updates,
      },
    });
  };

  // EMA Rules Management
  const addEmaRule = () => {
    const emaRules = dsl.eligibility?.emaRules || [];
    updateEligibility({
      emaRules: [...emaRules, { ema1: 20, operator: '>', ema2: 50 }],
    });
  };

  const updateEmaRule = (index: number, updates: Partial<EmaRule>) => {
    const emaRules = [...(dsl.eligibility?.emaRules || [])];
    emaRules[index] = { ...emaRules[index], ...updates };
    updateEligibility({ emaRules });
  };

  const removeEmaRule = (index: number) => {
    const emaRules = [...(dsl.eligibility?.emaRules || [])];
    emaRules.splice(index, 1);
    updateEligibility({ emaRules });
  };

  // Volume Rules Management
  const addVolumeRule = () => {
    const volumeRules = dsl.eligibility?.volumeRules || [];
    updateEligibility({
      volumeRules: [...volumeRules, { type: 'z-score', threshold: 1, operator: '>=' }],
    });
  };

  const updateVolumeRule = (index: number, updates: Partial<VolumeRule>) => {
    const volumeRules = [...(dsl.eligibility?.volumeRules || [])];
    volumeRules[index] = { ...volumeRules[index], ...updates };
    updateEligibility({ volumeRules });
  };

  const removeVolumeRule = (index: number) => {
    const volumeRules = [...(dsl.eligibility?.volumeRules || [])];
    volumeRules.splice(index, 1);
    updateEligibility({ volumeRules });
  };

  // Price Distance Management
  const addPriceDistance = () => {
    const priceDistances = dsl.eligibility?.priceDistances || [];
    updateEligibility({
      priceDistances: [...priceDistances, { fromLevel: 'ema50', maxDistance: 1.5, unit: 'atr' }],
    });
  };

  const updatePriceDistance = (index: number, updates: Partial<PriceDistance>) => {
    const priceDistances = [...(dsl.eligibility?.priceDistances || [])];
    priceDistances[index] = { ...priceDistances[index], ...updates };
    updateEligibility({ priceDistances });
  };

  const removePriceDistance = (index: number) => {
    const priceDistances = [...(dsl.eligibility?.priceDistances || [])];
    priceDistances.splice(index, 1);
    updateEligibility({ priceDistances });
  };

  // Candle Pattern Management
  const addCandlePattern = () => {
    const candlePatterns = dsl.eligibility?.candlePatterns || [];
    updateEligibility({
      candlePatterns: [...candlePatterns, { name: 'bullish_engulfing' }],
    });
  };

  const updateCandlePattern = (index: number, updates: Partial<CandlePattern>) => {
    const candlePatterns = [...(dsl.eligibility?.candlePatterns || [])];
    candlePatterns[index] = { ...candlePatterns[index], ...updates };
    updateEligibility({ candlePatterns });
  };

  const removeCandlePattern = (index: number) => {
    const candlePatterns = [...(dsl.eligibility?.candlePatterns || [])];
    candlePatterns.splice(index, 1);
    updateEligibility({ candlePatterns });
  };

  // Multi-Bar Condition Management
  const addMultiBarCondition = () => {
    const multiBarConditions = dsl.eligibility?.multiBarConditions || [];
    updateEligibility({
      multiBarConditions: [...multiBarConditions, { count: 2, direction: 'any', checkLows: true, checkHighs: true }],
    });
  };

  const updateMultiBarCondition = (index: number, updates: Partial<MultiBarCondition>) => {
    const multiBarConditions = [...(dsl.eligibility?.multiBarConditions || [])];
    multiBarConditions[index] = { ...multiBarConditions[index], ...updates };
    updateEligibility({ multiBarConditions });
  };

  const removeMultiBarCondition = (index: number) => {
    const multiBarConditions = [...(dsl.eligibility?.multiBarConditions || [])];
    multiBarConditions.splice(index, 1);
    updateEligibility({ multiBarConditions });
  };

  const emaRules = dsl.eligibility?.emaRules || [];
  const volumeRules = dsl.eligibility?.volumeRules || [];
  const priceDistances = dsl.eligibility?.priceDistances || [];
  const candlePatterns = dsl.eligibility?.candlePatterns || [];
  const multiBarConditions = dsl.eligibility?.multiBarConditions || [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-3">Eligibility Conditions</h3>
      <p className="text-sm text-blue-200 mb-4">
        All conditions must pass for a stock to qualify. Add multiple conditions for more sophisticated strategies.
      </p>

      {/* EMA Rules Section */}
      <Section
        title="EMA Trend Rules"
        count={emaRules.length}
        expanded={expandedSections.has('ema')}
        onToggle={() => toggleSection('ema')}
        onAdd={addEmaRule}
      >
        {emaRules.map((rule, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <span className="text-blue-200 text-sm">EMA</span>
            <input
              type="number"
              value={rule.ema1}
              onChange={(e) => updateEmaRule(idx, { ema1: Number(e.target.value) })}
              className="w-16 bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
              min="1"
              max="200"
            />
            <select
              value={rule.operator}
              onChange={(e) => updateEmaRule(idx, { operator: e.target.value as any })}
              className="bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
            >
              <option value=">">{'>'}</option>
              <option value="<">{'<'}</option>
              <option value=">=">{'>='}</option>
              <option value="<=">{'<='}</option>
              <option value="==">{'=='}</option>
            </select>
            <span className="text-blue-200 text-sm">EMA</span>
            <input
              type="number"
              value={rule.ema2}
              onChange={(e) => updateEmaRule(idx, { ema2: Number(e.target.value) })}
              className="w-16 bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
              min="1"
              max="200"
            />
            <button
              onClick={() => removeEmaRule(idx)}
              className="ml-auto text-red-400 hover:text-red-300 text-sm"
            >
              Remove
            </button>
          </div>
        ))}
      </Section>

      {/* RSI Range Section */}
      <Section
        title="RSI Range"
        count={dsl.eligibility?.rsiRange ? 1 : 0}
        expanded={expandedSections.has('rsi')}
        onToggle={() => toggleSection('rsi')}
        onAdd={() => updateEligibility({ rsiRange: { period: 14, min: 30, max: 70 } })}
        onRemove={dsl.eligibility?.rsiRange ? () => updateEligibility({ rsiRange: undefined }) : undefined}
      >
        {dsl.eligibility?.rsiRange && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-200 text-xs mb-1">Min</label>
              <input
                type="number"
                value={dsl.eligibility.rsiRange.min}
                onChange={(e) => updateEligibility({
                  rsiRange: { ...dsl.eligibility!.rsiRange!, min: Number(e.target.value) }
                })}
                className="w-full bg-white/10 text-white rounded px-3 py-2 text-sm border border-white/20"
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="block text-blue-200 text-xs mb-1">Max</label>
              <input
                type="number"
                value={dsl.eligibility.rsiRange.max}
                onChange={(e) => updateEligibility({
                  rsiRange: { ...dsl.eligibility!.rsiRange!, max: Number(e.target.value) }
                })}
                className="w-full bg-white/10 text-white rounded px-3 py-2 text-sm border border-white/20"
                min="0"
                max="100"
              />
            </div>
          </div>
        )}
      </Section>

      {/* Volume Rules Section */}
      <Section
        title="Volume Rules"
        count={volumeRules.length}
        expanded={expandedSections.has('volume')}
        onToggle={() => toggleSection('volume')}
        onAdd={addVolumeRule}
      >
        {volumeRules.map((rule, idx) => (
          <div key={idx} className="grid grid-cols-4 gap-2 items-center">
            <select
              value={rule.type}
              onChange={(e) => updateVolumeRule(idx, { type: e.target.value as any })}
              className="bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
            >
              <option value="z-score">Z-Score</option>
              <option value="relative">Relative</option>
              <option value="absolute">Absolute</option>
            </select>
            <select
              value={rule.operator}
              onChange={(e) => updateVolumeRule(idx, { operator: e.target.value as any })}
              className="bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
            >
              <option value=">=">{'>='}</option>
              <option value=">">{'>'}</option>
              <option value="<=">{'<='}</option>
              <option value="<">{'<'}</option>
            </select>
            <input
              type="number"
              value={rule.threshold}
              onChange={(e) => updateVolumeRule(idx, { threshold: Number(e.target.value) })}
              className="bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
              step="0.1"
            />
            <button
              onClick={() => removeVolumeRule(idx)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Remove
            </button>
          </div>
        ))}
      </Section>

      {/* Price Distance Section */}
      <Section
        title="Price Distance Rules"
        count={priceDistances.length}
        expanded={expandedSections.has('priceDistance')}
        onToggle={() => toggleSection('priceDistance')}
        onAdd={addPriceDistance}
        helpAction={() => { setHelpSection('price-distance'); setHelpOpen(true); }}
      >
        {priceDistances.map((pd, idx) => (
          <div key={idx} className="grid grid-cols-4 gap-2 items-center">
            <input
              type="text"
              value={pd.fromLevel}
              onChange={(e) => updatePriceDistance(idx, { fromLevel: e.target.value })}
              className="bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20 font-mono"
              placeholder="ema50"
            />
            <span className="text-blue-200 text-xs">within</span>
            <div className="flex gap-1">
              <input
                type="number"
                value={pd.maxDistance}
                onChange={(e) => updatePriceDistance(idx, { maxDistance: Number(e.target.value) })}
                className="w-20 bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
                step="0.1"
              />
              <select
                value={pd.unit}
                onChange={(e) => updatePriceDistance(idx, { unit: e.target.value as any })}
                className="bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
              >
                <option value="atr">ATR</option>
                <option value="pct">%</option>
              </select>
            </div>
            <button
              onClick={() => removePriceDistance(idx)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Remove
            </button>
          </div>
        ))}
      </Section>

      {/* Candle Patterns Section */}
      <Section
        title="Candle Patterns"
        count={candlePatterns.length}
        expanded={expandedSections.has('candle')}
        onToggle={() => toggleSection('candle')}
        onAdd={addCandlePattern}
      >
        {candlePatterns.map((pattern, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <select
              value={pattern.name}
              onChange={(e) => updateCandlePattern(idx, { name: e.target.value as any })}
              className="flex-1 bg-white/10 text-white rounded px-3 py-2 text-sm border border-white/20"
            >
              <option value="bullish_engulfing">Bullish Engulfing</option>
              <option value="bearish_engulfing">Bearish Engulfing</option>
              <option value="hammer">Hammer</option>
              <option value="shooting_star">Shooting Star</option>
              <option value="doji">Doji</option>
              <option value="any_bullish">Any Bullish</option>
              <option value="any_bearish">Any Bearish</option>
            </select>
            <button
              onClick={() => removeCandlePattern(idx)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Remove
            </button>
          </div>
        ))}
      </Section>

      {/* Multi-Bar Conditions Section */}
      <Section
        title="Multi-Bar Conditions"
        count={multiBarConditions.length}
        expanded={expandedSections.has('multiBar')}
        onToggle={() => toggleSection('multiBar')}
        onAdd={addMultiBarCondition}
      >
        {multiBarConditions.map((condition, idx) => (
          <div key={idx} className="space-y-2 p-3 bg-white/5 rounded border border-white/10">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-blue-200 text-xs mb-1">Bar Count</label>
                <input
                  type="number"
                  value={condition.count}
                  onChange={(e) => updateMultiBarCondition(idx, { count: Number(e.target.value) })}
                  className="w-full bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
                  min="1"
                  max="10"
                />
              </div>
              <div>
                <label className="block text-blue-200 text-xs mb-1">Direction</label>
                <select
                  value={condition.direction || 'any'}
                  onChange={(e) => updateMultiBarCondition(idx, { direction: e.target.value as any })}
                  className="w-full bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
                >
                  <option value="any">Any</option>
                  <option value="up">Up (Bullish)</option>
                  <option value="down">Down (Bearish)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-blue-200 text-xs mb-1">Min Level (Above)</label>
                <input
                  type="text"
                  value={condition.minLevel || ''}
                  onChange={(e) => updateMultiBarCondition(idx, { minLevel: e.target.value })}
                  className="w-full bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20 font-mono"
                  placeholder="e.g., ema50"
                />
              </div>
              <div>
                <label className="block text-blue-200 text-xs mb-1">Max Level (Below)</label>
                <input
                  type="text"
                  value={condition.maxLevel || ''}
                  onChange={(e) => updateMultiBarCondition(idx, { maxLevel: e.target.value })}
                  className="w-full bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20 font-mono"
                  placeholder="e.g., ema20"
                />
              </div>
            </div>
            <button
              onClick={() => removeMultiBarCondition(idx)}
              className="text-red-400 hover:text-red-300 text-sm w-full"
            >
              Remove Condition
            </button>
          </div>
        ))}
      </Section>

      {/* Squeeze Dynamics Section (Short Float + TTM Squeeze) */}
      <Section
        title="🔥 Squeeze Dynamics"
        count={dsl.eligibility?.squeezeDynamics ? 1 : 0}
        expanded={expandedSections.has('squeeze')}
        onToggle={() => toggleSection('squeeze')}
        onAdd={() => updateEligibility({
          squeezeDynamics: {
            minDaysToCover: 5,
            minShortFloat: 15,
            ttmSqueezeState: 'any',
            minSqueezeDuration: 5,
            shortVolumeTrend: 'any',
            requireBothSqueezes: false,
          }
        })}
        helpText="Short Float Squeeze & TTM Squeeze filters"
      >
        {dsl.eligibility?.squeezeDynamics && (
          <div className="space-y-4">
            {/* Short Float Squeeze Criteria */}
            <div className="border-l-2 border-blue-500 pl-4">
              <h5 className="text-sm font-semibold text-blue-200 mb-3">Short Float Squeeze</h5>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-blue-200 text-xs mb-1">
                    Min Days to Cover
                    <span className="ml-1 text-blue-400 cursor-help" title="Higher DTC = more squeeze potential">ⓘ</span>
                  </label>
                  <input
                    type="number"
                    value={dsl.eligibility.squeezeDynamics.minDaysToCover || 0}
                    onChange={(e) => updateEligibility({
                      squeezeDynamics: { ...dsl.eligibility.squeezeDynamics, minDaysToCover: Number(e.target.value) || undefined }
                    })}
                    className="w-full bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
                    min="0"
                    max="50"
                    step="0.5"
                    placeholder="0 = any"
                  />
                </div>
                <div>
                  <label className="block text-blue-200 text-xs mb-1">
                    Min Short Float %
                    <span className="ml-1 text-blue-400 cursor-help" title="% of float shorted">ⓘ</span>
                  </label>
                  <input
                    type="number"
                    value={dsl.eligibility.squeezeDynamics.minShortFloat || 0}
                    onChange={(e) => updateEligibility({
                      squeezeDynamics: { ...dsl.eligibility.squeezeDynamics, minShortFloat: Number(e.target.value) || undefined }
                    })}
                    className="w-full bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="0 = any"
                  />
                </div>
              </div>
            </div>

            {/* TTM Squeeze Criteria */}
            <div className="border-l-2 border-purple-500 pl-4">
              <h5 className="text-sm font-semibold text-purple-200 mb-3">TTM Squeeze</h5>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-blue-200 text-xs mb-1">
                    Squeeze State
                    <span className="ml-1 text-blue-400 cursor-help" title="Volatility compression state">ⓘ</span>
                  </label>
                  <select
                    value={dsl.eligibility.squeezeDynamics.ttmSqueezeState || 'any'}
                    onChange={(e) => updateEligibility({
                      squeezeDynamics: { ...dsl.eligibility.squeezeDynamics, ttmSqueezeState: e.target.value as any }
                    })}
                    className="w-full bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
                  >
                    <option value="any">Any</option>
                    <option value="FIRE">🔥 FIRE (Breakout!)</option>
                    <option value="ON">⚡ ON (Building)</option>
                    <option value="OFF">OFF (No Squeeze)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-blue-200 text-xs mb-1">
                    Min Squeeze Duration (bars)
                    <span className="ml-1 text-blue-400 cursor-help" title="Min bars in squeeze">ⓘ</span>
                  </label>
                  <input
                    type="number"
                    value={dsl.eligibility.squeezeDynamics.minSqueezeDuration || 5}
                    onChange={(e) => updateEligibility({
                      squeezeDynamics: { ...dsl.eligibility.squeezeDynamics, minSqueezeDuration: Number(e.target.value) }
                    })}
                    className="w-full bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
                    min="0"
                    max="50"
                  />
                </div>
              </div>
            </div>

            {/* Combined Criteria */}
            <div className="border-l-2 border-green-500 pl-4">
              <h5 className="text-sm font-semibold text-green-200 mb-3">Combined Filters & Weighting</h5>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-blue-200 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dsl.eligibility.squeezeDynamics.requireBothSqueezes || false}
                    onChange={(e) => updateEligibility({
                      squeezeDynamics: { ...dsl.eligibility.squeezeDynamics, requireBothSqueezes: e.target.checked }
                    })}
                    className="rounded border-white/20"
                  />
                  Require both short squeeze AND TTM squeeze aligned
                </label>
                
                <div>
                  <label className="block text-blue-200 text-xs mb-1">
                    Min Combined Score (0-100)
                    <span className="ml-1 text-blue-400 cursor-help" title="Minimum weighted average of both squeeze scores">ⓘ</span>
                  </label>
                  <input
                    type="number"
                    value={dsl.eligibility.squeezeDynamics.minCombinedScore || ''}
                    onChange={(e) => updateEligibility({
                      squeezeDynamics: { ...dsl.eligibility.squeezeDynamics, minCombinedScore: Number(e.target.value) || undefined }
                    })}
                    className="w-full bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
                    min="0"
                    max="100"
                    placeholder="Optional"
                  />
                </div>

                {/* Squeeze Score Weighting */}
                <div className="pt-2 border-t border-green-500/30">
                  <div className="text-xs text-green-200 mb-2 font-medium">Score Weighting (How much each squeeze matters)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-blue-200 text-xs mb-1">
                        Short Squeeze Weight
                        <span className="ml-1 text-blue-400 cursor-help" title="0.0 = ignore, 1.0 = only short squeeze">ⓘ</span>
                      </label>
                      <input
                        type="number"
                        value={dsl.eligibility.squeezeDynamics.shortSqueezeWeight ?? 0.6}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateEligibility({
                            squeezeDynamics: { 
                              ...dsl.eligibility.squeezeDynamics, 
                              shortSqueezeWeight: val,
                              ttmSqueezeWeight: 1 - val // Auto-adjust TTM to keep sum = 1
                            }
                          });
                        }}
                        className="w-full bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
                        min="0"
                        max="1"
                        step="0.1"
                      />
                      <div className="text-xs text-blue-300 mt-1">{((dsl.eligibility.squeezeDynamics.shortSqueezeWeight ?? 0.6) * 100).toFixed(0)}%</div>
                    </div>
                    <div>
                      <label className="block text-blue-200 text-xs mb-1">
                        TTM Squeeze Weight
                        <span className="ml-1 text-blue-400 cursor-help" title="0.0 = ignore, 1.0 = only TTM squeeze">ⓘ</span>
                      </label>
                      <input
                        type="number"
                        value={dsl.eligibility.squeezeDynamics.ttmSqueezeWeight ?? 0.4}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateEligibility({
                            squeezeDynamics: { 
                              ...dsl.eligibility.squeezeDynamics, 
                              ttmSqueezeWeight: val,
                              shortSqueezeWeight: 1 - val // Auto-adjust Short to keep sum = 1
                            }
                          });
                        }}
                        className="w-full bg-white/10 text-white rounded px-2 py-1 text-sm border border-white/20"
                        min="0"
                        max="1"
                        step="0.1"
                      />
                      <div className="text-xs text-blue-300 mt-1">{((dsl.eligibility.squeezeDynamics.ttmSqueezeWeight ?? 0.4) * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    💡 Default: 60% Short Squeeze + 40% TTM Squeeze. Adjust based on strategy focus.
                  </div>
                </div>
              </div>
            </div>

            {/* Remove Button */}
            <button
              onClick={() => updateEligibility({ squeezeDynamics: undefined })}
              className="text-red-400 hover:text-red-300 text-sm w-full"
            >
              Remove Squeeze Filters
            </button>
          </div>
        )}
      </Section>

      {/* Help Modal */}
      <StrategyHelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        section={helpSection}
      />
    </div>
  );
}

// Reusable Section Component
interface SectionProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onRemove?: () => void;
  helpAction?: () => void;
  helpText?: string;
  children: React.ReactNode;
}

function Section({ title, count, expanded, onToggle, onAdd, onRemove, helpAction, children }: SectionProps) {
  return (
    <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5" onClick={onToggle}>
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-blue-300 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-white font-medium">{title}</span>
          {count > 0 && (
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-xs">
              {count}
            </span>
          )}
          {helpAction && (
            <span onClick={(e) => { e.stopPropagation(); helpAction(); }}>
              <HelpIcon onClick={() => {}} tooltip="Click for help & examples" />
            </span>
          )}
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {count === 0 && (
            <button
              onClick={onAdd}
              className="px-3 py-1 bg-green-600/20 text-green-300 rounded text-xs hover:bg-green-600/30"
            >
              + Add
            </button>
          )}
          {count > 0 && (
            <button
              onClick={onAdd}
              className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded text-xs hover:bg-blue-600/30"
            >
              + Add Another
            </button>
          )}
          {onRemove && count > 0 && (
            <button
              onClick={onRemove}
              className="px-3 py-1 bg-red-600/20 text-red-300 rounded text-xs hover:bg-red-600/30"
            >
              Remove All
            </button>
          )}
        </div>
      </div>
      {expanded && count > 0 && (
        <div className="p-4 space-y-3 border-t border-white/10">
          {children}
        </div>
      )}
    </div>
  );
}

