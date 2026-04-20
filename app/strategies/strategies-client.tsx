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

  const closeFormDrawer = () => {
    setShowForm(false);
    resetForm();
  };

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowForm(false);
        resetForm();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [showForm]);

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
      ? 'bg-surface-3 text-text-secondary'
      : t === 'swing'
        ? 'bg-accent/10 text-accent'
        : 'bg-surface-3 text-text-primary';
    const label = t === 'intraday' ? 'DAY' : t === 'swing' ? 'SWING' : 'BOTH';
    return <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${cls}`}>{label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Trading Strategies</h1>
          <p className="text-text-muted text-sm">
            Define your strategies with entry/exit rules and criteria. Assign them to trades for better analysis.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg text-sm transition-colors"
        >
          + New Strategy
        </button>
      </div>

      {/* Strategy Form Drawer */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[70] transition-opacity" aria-hidden onClick={closeFormDrawer} />
          <div className="fixed inset-0 z-[71] flex justify-end pointer-events-none">
            <aside
              className="pointer-events-auto h-full w-full sm:max-w-3xl xl:max-w-[56rem] bg-surface-1 shadow-2xl flex flex-col animate-slide-in sm:border-l border-border"
              role="dialog"
              aria-modal="true"
              aria-labelledby="strategy-form-title"
            >
            <div className="shrink-0 border-b border-border bg-surface-2 px-6 lg:px-8 py-5 flex items-center justify-between gap-4">
              <h2 id="strategy-form-title" className="text-2xl font-bold text-text-primary">
                {editingId ? 'Edit Strategy' : 'New Strategy'}
              </h2>
              <button
                type="button"
                onClick={closeFormDrawer}
                className="shrink-0 text-text-muted hover:text-text-primary p-2 rounded-lg hover:bg-surface-3 transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
              {error && (
                <div className="bg-loss/10 border border-loss/30 rounded-xl p-4 text-base text-loss mb-6">{error}</div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Name *</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Gap & Go, VWAP Bounce"
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brief overview of what this strategy does and when to use it"
                    rows={3}
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Trade Type</label>
                  <div className="flex flex-wrap gap-2">
                    {(['intraday', 'swing', 'both'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTradeType(t)}
                        className={`px-4 py-2.5 rounded-xl text-base font-medium transition-colors ${
                          tradeType === t
                            ? 'bg-accent text-white'
                            : 'bg-surface-2 text-text-secondary border border-border hover:bg-surface-3'
                        }`}
                      >
                        {t === 'intraday' ? 'Day Trade' : t === 'swing' ? 'Swing' : 'Both'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">
                    Entry Rules <span className="text-text-muted font-normal">(one per line)</span>
                  </label>
                  <textarea
                    value={entryRules}
                    onChange={e => setEntryRules(e.target.value)}
                    placeholder={"Stock gaps up 5%+ premarket\nVolume > 2x avg in first 5 min\nPrice holds above VWAP"}
                    rows={4}
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">
                    Exit Rules <span className="text-text-muted font-normal">(one per line)</span>
                  </label>
                  <textarea
                    value={exitRules}
                    onChange={e => setExitRules(e.target.value)}
                    placeholder={"Take profit at 2R\nStop loss at -1R\nTrailing stop if up 1R+"}
                    rows={4}
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">
                    Indicators <span className="text-text-muted font-normal">(comma separated)</span>
                  </label>
                  <input
                    value={indicators}
                    onChange={e => setIndicators(e.target.value)}
                    placeholder="VWAP, EMA 9, EMA 20, RSI, Volume"
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">
                    Timeframes <span className="text-text-muted font-normal">(comma separated)</span>
                  </label>
                  <input
                    value={timeframes}
                    onChange={e => setTimeframes(e.target.value)}
                    placeholder="1m, 5m, 15m, daily"
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-border bg-surface-2 px-6 lg:px-8 py-5 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={closeFormDrawer}
                className="px-6 py-3 bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 rounded-xl text-base font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold rounded-xl text-base transition-colors"
              >
                {saving ? 'Saving...' : editingId ? 'Update Strategy' : 'Create Strategy'}
              </button>
            </div>
          </aside>
          </div>
        </>
      )}

      {/* Strategies List */}
      {loading ? (
        <div className="text-center text-text-secondary py-12">Loading strategies...</div>
      ) : strategies.length === 0 ? (
        <div className="bg-surface-1 border border-border rounded-xl p-12 text-center">
          <p className="text-text-secondary mb-1">No strategies yet</p>
          <p className="text-text-muted text-sm mb-4">Create your first strategy to start tagging your trades.</p>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg text-sm transition-colors"
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
                className={`bg-surface-1 border rounded-xl p-5 transition-colors ${
                  s.isActive ? 'border-border' : 'border-border opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-base font-semibold text-text-primary">{s.name}</h3>
                      {tradeTypeBadge(s.tradeType)}
                      {!s.isActive && (
                        <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-surface-3 text-text-muted">
                          INACTIVE
                        </span>
                      )}
                      <span className="text-xs text-text-muted">
                        {s._count.trades} trade{s._count.trades !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {s.description && (
                      <p className="text-sm text-text-secondary mb-2">{s.description}</p>
                    )}

                    {/* Criteria summary */}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                      {criteria.entry_rules.length > 0 && (
                        <div>
                          <span className="text-profit font-medium">Entry: </span>
                          <span className="text-text-muted">{criteria.entry_rules.join(' · ')}</span>
                        </div>
                      )}
                      {criteria.exit_rules.length > 0 && (
                        <div>
                          <span className="text-loss font-medium">Exit: </span>
                          <span className="text-text-muted">{criteria.exit_rules.join(' · ')}</span>
                        </div>
                      )}
                      {criteria.indicators.length > 0 && (
                        <div>
                          <span className="text-accent font-medium">Indicators: </span>
                          <span className="text-text-muted">{criteria.indicators.join(', ')}</span>
                        </div>
                      )}
                      {criteria.timeframes.length > 0 && (
                        <div>
                          <span className="text-text-secondary font-medium">TF: </span>
                          <span className="text-text-muted">{criteria.timeframes.join(', ')}</span>
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
                          ? 'text-profit hover:bg-profit/10'
                          : 'text-text-muted hover:bg-surface-2'
                      }`}
                    >
                      {s.isActive ? '●' : '○'}
                    </button>
                    <button
                      onClick={() => openEdit(s)}
                      className="px-2.5 py-1.5 text-accent hover:bg-accent/10 rounded-lg text-xs transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="px-2.5 py-1.5 text-loss hover:bg-loss/10 rounded-lg text-xs transition-colors"
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
        <Link href="/journal" className="text-sm text-accent hover:text-accent-hover transition-colors">
          Back to Trading Journal
        </Link>
      </div>
    </div>
  );
}
