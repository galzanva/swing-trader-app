'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { StrategyDsl } from '@/lib/strategy-builder/dsl-schema';

interface UserStrategy {
  id: string;
  name: string;
  description: string | null;
  dsl: StrategyDsl;
  direction: string;
  timeframe: string;
  isActive: boolean;
  priority: number;
  useCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StrategiesManageClientProps {
  userId: string;
}

export default function StrategiesManageClient({ userId }: StrategiesManageClientProps) {
  const [strategies, setStrategies] = useState<UserStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStrategies();
  }, []);

  const fetchStrategies = async () => {
    setLoading(true);
    try {
      // Fetch ALL strategies (including inactive ones)
      const response = await fetch('/api/strategy-builder/list?activeOnly=false');
      const data = await response.json();
      
      if (data.success) {
        setStrategies(data.strategies);
      } else {
        setError(data.error || 'Failed to fetch strategies');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (strategyId: string) => {
    try {
      const response = await fetch('/api/strategy-builder/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId }),
      });

      if (response.ok) {
        await fetchStrategies();
      }
    } catch (err) {
      console.error('Failed to toggle strategy:', err);
    }
  };

  const deleteStrategy = async (strategyId: string) => {
    if (!confirm('Are you sure you want to delete this strategy?')) {
      return;
    }

    try {
      const response = await fetch(`/api/strategy-builder/delete?id=${strategyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchStrategies();
      }
    } catch (err) {
      console.error('Failed to delete strategy:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-blue-200">Loading strategies...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
        <p className="text-red-200">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Manage Strategies</h1>
          <p className="text-blue-200">
            {strategies.length} custom {strategies.length === 1 ? 'strategy' : 'strategies'}
          </p>
        </div>
        <Link
          href="/strategies/builder"
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all shadow-lg"
        >
          + New Strategy
        </Link>
      </div>

      {/* Strategies List */}
      {strategies.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-12 border border-white/10 text-center">
          <div className="text-6xl mb-4">🛠️</div>
          <h3 className="text-xl font-bold text-white mb-2">No Strategies Yet</h3>
          <p className="text-blue-200 mb-6">
            Create your first custom trading strategy to get started
          </p>
          <Link
            href="/strategies/builder"
            className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all shadow-lg"
          >
            Build Your First Strategy
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              className={`bg-white/5 backdrop-blur-lg rounded-xl p-6 border transition-all ${
                strategy.isActive
                  ? 'border-white/10 hover:border-white/20'
                  : 'border-gray-500/30 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-xl font-bold text-white">{strategy.name}</h3>
                    {strategy.priority < 0 && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        ⚙️ System
                      </span>
                    )}
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      strategy.direction === 'long'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}>
                      {strategy.direction.toUpperCase()}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300">
                      {strategy.timeframe}
                    </span>
                    {strategy.isActive ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300">
                        ● Active
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-300">
                        ○ Inactive
                      </span>
                    )}
                  </div>
                  {strategy.description && (
                    <p className="text-blue-200 text-sm mb-2">{strategy.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-blue-300">
                    <span>Used: {strategy.useCount} times</span>
                    <span>•</span>
                    <span>Created: {new Date(strategy.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Link
                    href={`/strategies/edit/${strategy.id}`}
                    className="px-4 py-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-lg text-sm font-medium transition-all"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => toggleActive(strategy.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      strategy.isActive
                        ? 'bg-gray-500/20 text-gray-300 hover:bg-gray-500/30'
                        : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                    }`}
                  >
                    {strategy.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => deleteStrategy(strategy.id)}
                    className="px-4 py-2 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-lg text-sm font-medium transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Strategy Details (Collapsed) */}
              <details className="mt-4">
                <summary className="cursor-pointer text-blue-300 hover:text-blue-200 text-sm font-medium">
                  View Details →
                </summary>
                <div className="mt-4 space-y-4">
                  {/* Entry & Exit */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-blue-200 mb-1">Entry</div>
                      <div className="text-white font-mono">{strategy.dsl.trigger.level}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-blue-200 mb-1">Stop Loss</div>
                      <div className="text-white font-mono">{strategy.dsl.stop.value}</div>
                    </div>
                    {strategy.dsl.targets.map((target, i) => (
                      <div key={i} className="bg-white/5 rounded-lg p-3">
                        <div className="text-blue-200 mb-1">{target.label || `Target ${i + 1}`}</div>
                        <div className="text-white font-mono">{target.level}</div>
                      </div>
                    ))}
                  </div>

                  {/* Eligibility Conditions */}
                  {strategy.dsl.eligibility && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <h5 className="text-white font-semibold mb-3">Eligibility Conditions</h5>
                      <div className="space-y-2 text-sm">
                        {strategy.dsl.eligibility.emaRules?.map((rule, i) => (
                          <div key={i} className="text-blue-100">
                            • EMA{rule.ema1} {rule.operator} EMA{rule.ema2}
                          </div>
                        ))}
                        {strategy.dsl.eligibility.rsiRange && (
                          <div className="text-blue-100">
                            • RSI between {strategy.dsl.eligibility.rsiRange.min} and {strategy.dsl.eligibility.rsiRange.max}
                          </div>
                        )}
                        {strategy.dsl.eligibility.volumeRule && (
                          <div className="text-blue-100">
                            • Volume {strategy.dsl.eligibility.volumeRule.operator} {strategy.dsl.eligibility.volumeRule.threshold} ({strategy.dsl.eligibility.volumeRule.type})
                          </div>
                        )}
                        {strategy.dsl.eligibility.candlePattern && (
                          <div className="text-blue-100">
                            • Candle pattern: {strategy.dsl.eligibility.candlePattern.name.replace(/_/g, ' ')}
                          </div>
                        )}
                        {strategy.dsl.eligibility.multiBarCondition && (
                          <div className="text-blue-100 bg-purple-500/10 border border-purple-500/30 rounded p-2">
                            <strong className="text-purple-300">Multi-Bar Pullback:</strong>
                            <div className="ml-4 mt-1 space-y-1">
                              <div>• Count: {strategy.dsl.eligibility.multiBarCondition.count} bars</div>
                              {strategy.dsl.eligibility.multiBarCondition.direction !== 'any' && (
                                <div>• Direction: {strategy.dsl.eligibility.multiBarCondition.direction === 'down' ? 'Bearish (red)' : 'Bullish (green)'}</div>
                              )}
                              {strategy.dsl.eligibility.multiBarCondition.minLevel && (
                                <div>• Must stay above: <span className="font-mono">{strategy.dsl.eligibility.multiBarCondition.minLevel}</span></div>
                              )}
                              {strategy.dsl.eligibility.multiBarCondition.maxLevel && (
                                <div>• Must stay below: <span className="font-mono">{strategy.dsl.eligibility.multiBarCondition.maxLevel}</span></div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
