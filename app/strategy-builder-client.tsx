'use client';

/**
 * Strategy Builder Client Component
 * 
 * Allows users to create custom strategies from plain-English descriptions
 */

import { useState } from 'react';
import type { StrategyDsl } from '@/lib/strategy-builder/dsl-schema';
import { getEligibilityDescriptions } from '@/lib/strategy-builder/dsl-schema';
import StrategyConditionEditor from './components/strategy-condition-editor';
import StrategyHelpModal from './components/strategy-help-modal';
import HelpIcon from './components/help-icon';

interface StrategyBuilderClientProps {
  userId: string;
}

interface ParsedStrategy {
  dsl: StrategyDsl;
  followUp?: string;
  warnings?: string[];
}

export default function StrategyBuilderClient({ userId }: StrategyBuilderClientProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSection, setHelpSection] = useState<'trigger' | 'stop' | 'target' | 'price-distance' | 'expression' | 'patterns' | 'all'>('all');

  // Parse strategy from plain English
  const handleParse = async () => {
    if (!input.trim()) {
      setError('Please enter a strategy description');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/strategy-builder/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });

      const data = await response.json();

      if (data.success) {
        setParsed({
          dsl: data.dsl,
          followUp: data.followUp,
          warnings: data.warnings,
        });
      } else {
        setError(data.errors?.join('\n') || 'Failed to parse strategy');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Answer follow-up question
  const handleFollowUp = async (answer: string) => {
    if (!parsed || !parsed.followUp) return;

    setLoading(true);
    try {
      const response = await fetch('/api/strategy-builder/apply-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dsl: parsed.dsl, followUp: parsed.followUp, answer }),
      });

      const data = await response.json();

      if (data.success) {
        setParsed({ dsl: data.dsl, followUp: undefined });
      } else {
        setError(data.error || 'Failed to apply follow-up');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Save strategy
  const handleSave = async () => {
    if (!parsed) return;

    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch('/api/strategy-builder/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dsl: parsed.dsl,
          name: parsed.dsl.name,
          description: parsed.dsl.description,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSaved(true);
        setTimeout(() => {
          // Reset form after save
          setInput('');
          setParsed(null);
          setSaved(false);
        }, 2000);
      } else {
        setError(data.error || 'Failed to save strategy');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Update DSL field
  const updateDsl = (updates: Partial<StrategyDsl>) => {
    if (!parsed) return;
    setParsed({
      ...parsed,
      dsl: { ...parsed.dsl, ...updates },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-2xl font-bold text-white mb-2">Strategy Builder</h2>
        <p className="text-blue-200">
          Describe your trading strategy in plain English, and we'll convert it into a testable, executable strategy.
        </p>
      </div>

      {!parsed ? (
        // Input Phase
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <label className="block text-white font-medium mb-3">
            Describe Your Strategy
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Example: Go long on daily timeframe when price pulls back to EMA20 in an uptrend (EMA20 > EMA50 > EMA200). Enter when RSI crosses above 50 with volume confirmation. Stop loss at 1 ATR below entry. Target 1 at entry + 1.5×ATR, Target 2 at entry + 2.5×ATR."
            className="w-full h-48 bg-white/10 text-white placeholder-blue-300/50 rounded-lg px-4 py-3 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none resize-none"
            disabled={loading}
          />

          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleParse}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Parsing...' : 'Parse Strategy →'}
            </button>
          </div>
        </div>
      ) : (
        // Preview & Edit Phase
        <div className="space-y-6">
          {/* Follow-up Question */}
          {parsed.followUp && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 backdrop-blur-lg rounded-xl p-6">
              <h3 className="text-lg font-semibold text-yellow-200 mb-3">Quick Question</h3>
              <p className="text-white mb-4">{parsed.followUp}</p>
              <input
                type="text"
                placeholder="Your answer..."
                className="w-full bg-white/10 text-white placeholder-blue-300/50 rounded-lg px-4 py-2 border border-white/20 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/50 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    handleFollowUp(e.currentTarget.value);
                  }
                }}
                disabled={loading}
              />
            </div>
          )}

          {/* Strategy Preview */}
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Strategy Preview</h3>
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  parsed.dsl.direction === 'long' 
                    ? 'bg-green-500/20 text-green-300' 
                    : 'bg-red-500/20 text-red-300'
                }`}>
                  {parsed.dsl.direction.toUpperCase()}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300">
                  {parsed.dsl.timeframe}
                </span>
              </div>
            </div>

            {/* Name & Description */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-blue-200 text-sm font-medium mb-2">Strategy Name</label>
                <input
                  type="text"
                  value={parsed.dsl.name}
                  onChange={(e) => updateDsl({ name: e.target.value })}
                  className="w-full bg-white/10 text-white rounded-lg px-4 py-2 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-blue-200 text-sm font-medium mb-2">Description (optional)</label>
                <input
                  type="text"
                  value={parsed.dsl.description || ''}
                  onChange={(e) => updateDsl({ description: e.target.value })}
                  className="w-full bg-white/10 text-white rounded-lg px-4 py-2 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
                  placeholder="Brief description of when to use this strategy..."
                />
              </div>
            </div>

            {/* Warnings */}
            {parsed.warnings && parsed.warnings.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <h4 className="text-yellow-300 font-semibold mb-2">⚠️ Warnings</h4>
                <ul className="list-disc list-inside text-yellow-200 text-sm space-y-1">
                  {parsed.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Eligibility Summary */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-white mb-3">Eligibility Criteria Summary</h4>
              {getEligibilityDescriptions(parsed.dsl).length > 0 ? (
                <div className="space-y-2">
                  {getEligibilityDescriptions(parsed.dsl).map((desc, i) => (
                    <div key={i} className="flex items-start gap-2 bg-white/5 rounded-lg p-3 border border-white/10">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span className="text-white text-sm">{desc}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-200 text-sm">
                  No eligibility criteria defined. Strategy will match all stocks.
                </div>
              )}
            </div>

            {/* Advanced Condition Editor */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-white">Edit Conditions</h4>
                <span className="text-xs text-blue-300">Click sections to expand/collapse</span>
              </div>
              <StrategyConditionEditor 
                dsl={parsed.dsl} 
                onChange={updateDsl} 
              />
            </div>

            {/* Entry & Exit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-lg font-semibold text-white">Entry</h4>
                  <HelpIcon 
                    onClick={() => { setHelpSection('trigger'); setHelpOpen(true); }} 
                    tooltip="What can I use for trigger levels?"
                  />
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="text-sm font-medium text-blue-200 mb-1">Trigger</div>
                  <div className="text-white">{parsed.dsl.trigger.description}</div>
                  <div className="text-sm text-blue-300 mt-2">Level: {parsed.dsl.trigger.level}</div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-lg font-semibold text-white">Stop Loss</h4>
                  <HelpIcon 
                    onClick={() => { setHelpSection('stop'); setHelpOpen(true); }} 
                    tooltip="What can I use for stop loss?"
                  />
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="text-sm font-medium text-blue-200 mb-1">{parsed.dsl.stop.type}</div>
                  <div className="text-white">{parsed.dsl.stop.value}</div>
                </div>
              </div>
            </div>

            {/* Targets */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-lg font-semibold text-white">Targets</h4>
                <HelpIcon 
                  onClick={() => { setHelpSection('target'); setHelpOpen(true); }} 
                  tooltip="What can I use for profit targets?"
                />
              </div>
              <div className="space-y-2">
                {parsed.dsl.targets.map((target, i) => (
                  <div key={i} className="bg-white/5 rounded-lg p-4 border border-white/10 flex justify-between items-center">
                    <div>
                      <span className="text-blue-200 font-medium">{target.label || `T${i + 1}`}:</span>
                      <span className="text-white ml-2">{target.level}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Management */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-white mb-3">Risk Management</h4>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-sm text-blue-200 mb-1">Min R:R</div>
                    <div className="text-white font-semibold">{parsed.dsl.riskManagement?.minRR || 1.5}</div>
                  </div>
                  <div>
                    <div className="text-sm text-blue-200 mb-1">Max Position</div>
                    <div className="text-white font-semibold">{parsed.dsl.riskManagement?.maxPositionSize || 2}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-blue-200 mb-1">Earnings Buffer</div>
                    <div className="text-white font-semibold">{parsed.dsl.riskManagement?.earningsDaysBuffer || 3} days</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={loading || !!parsed.followUp || saved}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {saved ? '✓ Saved!' : loading ? 'Saving...' : 'Save Strategy'}
            </button>
            <button
              onClick={() => {
                setParsed(null);
                setError(null);
              }}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-all border border-white/20"
            >
              Cancel
            </button>
          </div>

          {saved && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
              <p className="text-green-200 font-medium">Strategy saved successfully! It will now be evaluated automatically.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-200">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Help Modal */}
      <StrategyHelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        section={helpSection}
      />
    </div>
  );
}
