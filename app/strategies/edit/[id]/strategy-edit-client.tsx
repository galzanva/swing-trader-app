'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { StrategyDsl } from '@/lib/strategy-builder/dsl-schema';

interface StrategyEditClientProps {
  strategyId: string;
  userId: string;
}

export default function StrategyEditClient({ strategyId, userId }: StrategyEditClientProps) {
  const router = useRouter();
  const [strategy, setStrategy] = useState<any>(null);
  const [dsl, setDsl] = useState<StrategyDsl | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchStrategy();
  }, [strategyId]);

  const fetchStrategy = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/strategy-builder/list');
      const data = await response.json();
      
      if (data.success) {
        const found = data.strategies.find((s: any) => s.id === strategyId);
        if (found) {
          setStrategy(found);
          setDsl(found.dsl);
        } else {
          setError('Strategy not found');
        }
      } else {
        setError('Failed to load strategy');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const updateDsl = (updates: Partial<StrategyDsl>) => {
    if (!dsl) return;
    setDsl({ ...dsl, ...updates });
  };

  const updateEligibility = (updates: any) => {
    if (!dsl) return;
    setDsl({
      ...dsl,
      eligibility: {
        ...dsl.eligibility,
        ...updates,
      },
    });
  };

  const updateTarget = (index: number, updates: any) => {
    if (!dsl) return;
    const newTargets = [...dsl.targets];
    newTargets[index] = { ...newTargets[index], ...updates };
    setDsl({ ...dsl, targets: newTargets });
  };

  const saveStrategy = async () => {
    if (!dsl) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/strategy-builder/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId,
          name: dsl.name,
          description: dsl.description,
          dsl,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Strategy updated successfully!' });
        setTimeout(() => router.push('/strategies/manage'), 1500);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update strategy' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-blue-200">Loading strategy...</div>
      </div>
    );
  }

  if (error || !dsl) {
    return (
      <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
        <p className="text-red-200">{error || 'Strategy not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-2xl font-bold text-white mb-2">Edit Strategy</h2>
        <p className="text-blue-200">
          Modify your trading strategy parameters
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-lg p-4 ${
          message.type === 'success'
            ? 'bg-green-500/20 border border-green-500/50 text-green-200'
            : 'bg-red-500/20 border border-red-500/50 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Strategy Form */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Strategy Details</h3>
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              dsl.direction === 'long' 
                ? 'bg-green-500/20 text-green-300' 
                : 'bg-red-500/20 text-red-300'
            }`}>
              {dsl.direction.toUpperCase()}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300">
              {dsl.timeframe}
            </span>
          </div>
        </div>

        {/* Name & Description */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">Strategy Name</label>
            <input
              type="text"
              value={dsl.name}
              onChange={(e) => updateDsl({ name: e.target.value })}
              className="w-full bg-white/10 text-white rounded-lg px-4 py-2 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">Description (optional)</label>
            <input
              type="text"
              value={dsl.description || ''}
              onChange={(e) => updateDsl({ description: e.target.value })}
              className="w-full bg-white/10 text-white rounded-lg px-4 py-2 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
              placeholder="Brief description..."
            />
          </div>
        </div>

        {/* Direction & Timeframe */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">Direction</label>
            <select
              value={dsl.direction}
              onChange={(e) => updateDsl({ direction: e.target.value as 'long' | 'short' })}
              className="w-full bg-white/10 text-white rounded-lg px-4 py-2 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">Timeframe</label>
            <select
              value={dsl.timeframe}
              onChange={(e) => updateDsl({ timeframe: e.target.value as any })}
              className="w-full bg-white/10 text-white rounded-lg px-4 py-2 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
            >
              <option value="1min">1 Minute</option>
              <option value="5min">5 Minutes</option>
              <option value="15min">15 Minutes</option>
              <option value="1hour">1 Hour</option>
              <option value="1day">Daily</option>
            </select>
          </div>
        </div>

        {/* Entry & Stop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Entry</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-blue-200 text-sm mb-1">Trigger Level</label>
                <input
                  type="text"
                  value={dsl.trigger.level}
                  onChange={(e) => setDsl({ 
                    ...dsl, 
                    trigger: { ...dsl.trigger, level: e.target.value } 
                  })}
                  className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20 focus:border-purple-500 focus:outline-none font-mono"
                  placeholder="e.g., ema20, entry+1*ATR"
                />
              </div>
              <div>
                <label className="block text-blue-200 text-sm mb-1">Description</label>
                <input
                  type="text"
                  value={dsl.trigger.description}
                  onChange={(e) => setDsl({ 
                    ...dsl, 
                    trigger: { ...dsl.trigger, description: e.target.value } 
                  })}
                  className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Stop Loss</h4>
            <div>
              <label className="block text-blue-200 text-sm mb-1">Stop Level</label>
              <input
                type="text"
                value={dsl.stop.value}
                onChange={(e) => setDsl({ 
                  ...dsl, 
                  stop: { ...dsl.stop, value: e.target.value } 
                })}
                className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20 focus:border-purple-500 focus:outline-none font-mono"
                placeholder="e.g., entry-1*ATR"
              />
            </div>
          </div>
        </div>

        {/* Targets */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-white mb-3">Targets</h4>
          <div className="space-y-2">
            {dsl.targets.map((target, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={target.label || `T${i + 1}`}
                  onChange={(e) => updateTarget(i, { label: e.target.value })}
                  className="w-24 bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20 focus:border-purple-500 focus:outline-none"
                  placeholder="Label"
                />
                <input
                  type="text"
                  value={target.level}
                  onChange={(e) => updateTarget(i, { level: e.target.value })}
                  className="flex-1 bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20 focus:border-purple-500 focus:outline-none font-mono"
                  placeholder="e.g., entry+1.5*ATR"
                />
              </div>
            ))}
          </div>
        </div>

        {/* RSI Range (if exists) */}
        {dsl.eligibility?.rsiRange && (
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-white mb-3">RSI Range</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-blue-200 text-sm mb-1">Min</label>
                <input
                  type="number"
                  value={dsl.eligibility.rsiRange.min}
                  onChange={(e) => updateEligibility({
                    rsiRange: { ...dsl.eligibility!.rsiRange!, min: Number(e.target.value) }
                  })}
                  className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20 focus:border-purple-500 focus:outline-none"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-blue-200 text-sm mb-1">Max</label>
                <input
                  type="number"
                  value={dsl.eligibility.rsiRange.max}
                  onChange={(e) => updateEligibility({
                    rsiRange: { ...dsl.eligibility!.rsiRange!, max: Number(e.target.value) }
                  })}
                  className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20 focus:border-purple-500 focus:outline-none"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>
        )}

        {/* Multi-Bar Condition (if exists) */}
        {dsl.eligibility?.multiBarCondition && (
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              Multi-Bar Pullback Condition
              <span className="text-xs font-normal text-blue-300">(e.g., "2+ red candles above EMA50")</span>
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-blue-200 text-sm mb-1">Bar Count</label>
                <input
                  type="number"
                  value={dsl.eligibility.multiBarCondition.count}
                  onChange={(e) => updateEligibility({
                    multiBarCondition: { ...dsl.eligibility!.multiBarCondition!, count: Number(e.target.value) }
                  })}
                  className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20 focus:border-purple-500 focus:outline-none"
                  min="1"
                  max="10"
                />
              </div>
              <div>
                <label className="block text-blue-200 text-sm mb-1">Direction</label>
                <select
                  value={dsl.eligibility.multiBarCondition.direction || 'any'}
                  onChange={(e) => updateEligibility({
                    multiBarCondition: { ...dsl.eligibility!.multiBarCondition!, direction: e.target.value as 'up' | 'down' | 'any' }
                  })}
                  className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20 focus:border-purple-500 focus:outline-none"
                >
                  <option value="any">Any</option>
                  <option value="up">Up (Bullish)</option>
                  <option value="down">Down (Bearish)</option>
                </select>
              </div>
              <div>
                <label className="block text-blue-200 text-sm mb-1">Min Level (Above)</label>
                <input
                  type="text"
                  value={dsl.eligibility.multiBarCondition.minLevel || ''}
                  onChange={(e) => updateEligibility({
                    multiBarCondition: { ...dsl.eligibility!.multiBarCondition!, minLevel: e.target.value }
                  })}
                  className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20 focus:border-purple-500 focus:outline-none font-mono"
                  placeholder="e.g., ema50"
                />
              </div>
              <div>
                <label className="block text-blue-200 text-sm mb-1">Max Level (Below)</label>
                <input
                  type="text"
                  value={dsl.eligibility.multiBarCondition.maxLevel || ''}
                  onChange={(e) => updateEligibility({
                    multiBarCondition: { ...dsl.eligibility!.multiBarCondition!, maxLevel: e.target.value }
                  })}
                  className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20 focus:border-purple-500 focus:outline-none font-mono"
                  placeholder="e.g., ema20"
                />
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-200">
                <strong>Example:</strong> Count=2, Direction=Down, MinLevel=ema50 → 
                <span className="ml-1 text-white">"2 consecutive red candles staying above EMA50"</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={saveStrategy}
          disabled={saving}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 shadow-lg"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={() => router.push('/strategies/manage')}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-all border border-white/20"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
