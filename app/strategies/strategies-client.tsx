'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  tradeType: string;
  criteria: CriteriaData | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { trades: number };
}

interface CriteriaData {
  entry_rules: string[];
  exit_rules: string[];
  indicators: string[];
  timeframes: string[];
}

const EMPTY_CRITERIA: CriteriaData = {
  entry_rules: [],
  exit_rules: [],
  indicators: [],
  timeframes: [],
};

export default function StrategiesClient() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tradeType, setTradeType] = useState<'intraday' | 'swing' | 'both'>('intraday');
  const [entryRules, setEntryRules] = useState('');
  const [exitRules, setExitRules] = useState('');
  const [indicators, setIndicators] = useState('');
  const [timeframes, setTimeframes] = useState('');

  const fetchStrategies = useCallback(async () => {
    try {
      const res = await fetch('/api/strategies');
      const data = await res.json();
      if (data.success) setStrategies(data.strategies);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStrategies(); }, [fetchStrategies]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setTradeType('intraday');
    setEntryRules('');
    setExitRules('');
    setIndicators('');
    setTimeframes('');
    setEditingId(null);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (s: Strategy) => {
    setEditingId(s.id);
    setName(s.name);
    setDescription(s.description || '');
    setTradeType(s.tradeType as 'intraday' | 'swing' | 'both');
    const c = (s.criteria as CriteriaData | null) || EMPTY_CRITERIA;
    setEntryRules(c.entry_rules.join('\n'));
    setExitRules(c.exit_rules.join('\n'));
    setIndicators(c.indicators.join(', '));
    setTimeframes(c.timeframes.join(', '));
    setShowForm(true);
    setError('');
  };

  const splitLines = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean);
  const splitCommas = (s: string) => s.split(',').map(l => l.trim()).filter(Boolean);

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');

    const criteria: CriteriaData = {
      entry_rules: splitLines(entryRules),
      exit_rules: splitLines(exitRules),
      indicators: splitCommas(indicators),
      timeframes: splitCommas(timeframes),
    };

    const payload = { name: name.trim(), description, tradeType, criteria };

    try {
      const url = editingId ? `/api/strategies/${editingId}` : '/api/strategies';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); setSaving(false); return; }
      setShowForm(false);
      resetForm();
      fetchStrategies();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  const handleDelete = async (id: string, tradeName: string) => {
    if (!confirm(`Delete strategy "${tradeName}"? Trades using it will be unlinked but not deleted.`)) return;
    try {
      const res = await fetch(`/api/strategies/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchStrategies();
      else alert(data.error || 'Failed to delete');
    } catch { alert('Network error'); }
  };

  const handleToggleActive = async (s: Strategy) => {
    try {
      await fetch(`/api/strategies/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      fetchStrategies();
    } catch { /* */ }
  };

  const tradeTypeBadge = (t: string) => {
    const cls = t === 'intraday'
      ? 'bg-amber-500/20 text-amber-300'
      : t === 'swing'
        ? 'bg-blue-500/20 text-blue-300'
        : 'bg-purple-500/20 text-purple-300';
    const label = t === 'intraday' ? 'DAY' : t === 'swing' ? 'SWING' : 'BOTH';
    return <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${cls}`}>{label}</span>;
  };

  return (
    <main className="max-w-4xl mx-auto px-4 pt-24 pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-blue-50 mb-1">Trading Strategies</h1>
          <p className="text-blue-300/70 text-sm">
            Define your strategies with entry/exit rules and criteria. Assign them to trades for better analysis.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg text-sm transition-colors"
        >
          + New Strategy
        </button>
      </div>

      {/* Strategy Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-white mb-4">
              {editingId ? 'Edit Strategy' : 'New Strategy'}
            </h2>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 mb-4">{error}</div>
            )}

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Name *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Gap & Go, VWAP Bounce"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-blue-300/40 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief overview of what this strategy does and when to use it"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-blue-300/40 focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              {/* Trade Type */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Trade Type</label>
                <div className="flex gap-2">
                  {(['intraday', 'swing', 'both'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTradeType(t)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        tradeType === t
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-700 text-blue-200 hover:bg-slate-600'
                      }`}
                    >
                      {t === 'intraday' ? 'Day Trade' : t === 'swing' ? 'Swing' : 'Both'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Entry Rules */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">
                  Entry Rules <span className="text-blue-400/50 font-normal">(one per line)</span>
                </label>
                <textarea
                  value={entryRules}
                  onChange={e => setEntryRules(e.target.value)}
                  placeholder={"Stock gaps up 5%+ premarket\nVolume > 2x avg in first 5 min\nPrice holds above VWAP"}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-blue-300/40 focus:outline-none focus:border-teal-500 resize-none text-sm"
                />
              </div>

              {/* Exit Rules */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">
                  Exit Rules <span className="text-blue-400/50 font-normal">(one per line)</span>
                </label>
                <textarea
                  value={exitRules}
                  onChange={e => setExitRules(e.target.value)}
                  placeholder={"Take profit at 2R\nStop loss at -1R\nTrailing stop if up 1R+"}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-blue-300/40 focus:outline-none focus:border-teal-500 resize-none text-sm"
                />
              </div>

              {/* Indicators */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">
                  Indicators <span className="text-blue-400/50 font-normal">(comma separated)</span>
                </label>
                <input
                  value={indicators}
                  onChange={e => setIndicators(e.target.value)}
                  placeholder="VWAP, EMA 9, EMA 20, RSI, Volume"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-blue-300/40 focus:outline-none focus:border-teal-500 text-sm"
                />
              </div>

              {/* Timeframes */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">
                  Timeframes <span className="text-blue-400/50 font-normal">(comma separated)</span>
                </label>
                <input
                  value={timeframes}
                  onChange={e => setTimeframes(e.target.value)}
                  placeholder="1m, 5m, 15m, daily"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-blue-300/40 focus:outline-none focus:border-teal-500 text-sm"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-blue-200 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
              >
                {saving ? 'Saving...' : editingId ? 'Update Strategy' : 'Create Strategy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strategies List */}
      {loading ? (
        <div className="text-center text-blue-200 py-12">Loading strategies...</div>
      ) : strategies.length === 0 ? (
        <div className="bg-slate-800/40 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-blue-200 mb-1">No strategies yet</p>
          <p className="text-blue-300/50 text-sm mb-4">Create your first strategy to start tagging your trades.</p>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg text-sm transition-colors"
          >
            + New Strategy
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {strategies.map(s => {
            const criteria = (s.criteria as CriteriaData | null) || EMPTY_CRITERIA;
            return (
              <div
                key={s.id}
                className={`bg-slate-800/40 border rounded-xl p-5 transition-colors ${
                  s.isActive ? 'border-white/10' : 'border-white/5 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-base font-semibold text-white">{s.name}</h3>
                      {tradeTypeBadge(s.tradeType)}
                      {!s.isActive && (
                        <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-600/50 text-slate-400">
                          INACTIVE
                        </span>
                      )}
                      <span className="text-xs text-blue-400/50">
                        {s._count.trades} trade{s._count.trades !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {s.description && (
                      <p className="text-sm text-blue-200/70 mb-2">{s.description}</p>
                    )}

                    {/* Criteria summary */}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                      {criteria.entry_rules.length > 0 && (
                        <div>
                          <span className="text-green-400/70 font-medium">Entry: </span>
                          <span className="text-blue-200/60">{criteria.entry_rules.join(' · ')}</span>
                        </div>
                      )}
                      {criteria.exit_rules.length > 0 && (
                        <div>
                          <span className="text-red-400/70 font-medium">Exit: </span>
                          <span className="text-blue-200/60">{criteria.exit_rules.join(' · ')}</span>
                        </div>
                      )}
                      {criteria.indicators.length > 0 && (
                        <div>
                          <span className="text-amber-400/70 font-medium">Indicators: </span>
                          <span className="text-blue-200/60">{criteria.indicators.join(', ')}</span>
                        </div>
                      )}
                      {criteria.timeframes.length > 0 && (
                        <div>
                          <span className="text-purple-400/70 font-medium">TF: </span>
                          <span className="text-blue-200/60">{criteria.timeframes.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleActive(s)}
                      title={s.isActive ? 'Deactivate' : 'Activate'}
                      className={`p-1.5 rounded-lg text-xs transition-colors ${
                        s.isActive
                          ? 'text-green-400 hover:bg-green-500/10'
                          : 'text-slate-500 hover:bg-slate-600/30'
                      }`}
                    >
                      {s.isActive ? '●' : '○'}
                    </button>
                    <button
                      onClick={() => openEdit(s)}
                      className="px-2.5 py-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg text-xs transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="px-2.5 py-1.5 text-red-400 hover:bg-red-500/10 rounded-lg text-xs transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Link back */}
      <div className="mt-8 text-center">
        <Link href="/journal" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
          ← Back to Trading Journal
        </Link>
      </div>
    </main>
  );
}
