'use client';

import { useState, useEffect, useCallback } from 'react';

interface BrokerStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  totalPL: number;
  winRate: number;
}

interface BrokerAccount {
  id: string | null;
  slug: string;
  name: string;
  accountType: string;
  isActive: boolean;
  createdAt: string | null;
  stats: BrokerStats;
}

const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'margin', label: 'Margin' },
  { value: 'prop-eval', label: 'Prop Firm (Evaluation)' },
  { value: 'prop-funded', label: 'Prop Firm (Funded)' },
];

const fmt = (n: number) => n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
const plColor = (n: number) => n > 0 ? 'text-profit' : n < 0 ? 'text-loss' : 'text-text-secondary';

export default function AccountsClient() {
  const [brokers, setBrokers] = useState<BrokerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBroker, setEditingBroker] = useState<BrokerAccount | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formType, setFormType] = useState('cash');

  const fetchBrokers = useCallback(async () => {
    try {
      const res = await fetch('/api/brokers');
      const data = await res.json();
      if (data.success) setBrokers(data.brokers);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBrokers(); }, [fetchBrokers]);

  const openAddForm = () => {
    setEditingBroker(null);
    setFormName('');
    setFormSlug('');
    setFormType('cash');
    setShowForm(true);
  };

  const openEditForm = (broker: BrokerAccount) => {
    setEditingBroker(broker);
    setFormName(broker.name);
    setFormSlug(broker.slug);
    setFormType(broker.accountType);
    setShowForm(true);
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingBroker) {
      setFormSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/brokers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingBroker?.id || undefined,
          name: formName.trim(),
          slug: formSlug.trim(),
          accountType: formType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        fetchBrokers();
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch { alert('Network error'); }
    setSaving(false);
  };

  const totalPL = brokers.reduce((sum, b) => sum + b.stats.totalPL, 0);
  const totalTrades = brokers.reduce((sum, b) => sum + b.stats.totalTrades, 0);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-2 border-text-muted border-t-accent rounded-full animate-spin mx-auto" />
        <p className="text-text-muted text-base mt-4">Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 lg:space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-text-primary tracking-tight">Trading Accounts</h1>
          <p className="text-text-muted text-base mt-1.5">
            {totalTrades} total trades across {brokers.length} account{brokers.length !== 1 ? 's' : ''}
            {totalTrades > 0 && (
              <span className={`ml-2 font-semibold ${plColor(totalPL)}`}>{fmt(totalPL)} combined P/L</span>
            )}
          </p>
        </div>
        <button onClick={openAddForm}
          className="px-5 py-2.5 bg-accent text-white rounded-xl text-base font-semibold hover:bg-accent-hover transition-all">
          + Add Account
        </button>
      </div>

      {/* Broker Cards */}
      {brokers.length === 0 ? (
        <div className="bg-surface-1 border border-border rounded-2xl p-12 text-center">
          <p className="text-text-secondary text-lg">No accounts yet.</p>
          <p className="text-text-muted text-base mt-2">Add your broker accounts to track performance per account.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6">
          {brokers.map(broker => (
            <div key={broker.slug} className="bg-surface-1 border border-border rounded-2xl p-6 lg:p-7 hover:border-accent/30 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-text-primary">{broker.name}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-md bg-surface-3 text-text-muted uppercase">
                      {ACCOUNT_TYPES.find(t => t.value === broker.accountType)?.label || broker.accountType}
                    </span>
                    {!broker.isActive && (
                      <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-md bg-loss/10 text-loss">Inactive</span>
                    )}
                  </div>
                </div>
                <button onClick={() => openEditForm(broker)}
                  className="text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-surface-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                </button>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-text-muted font-medium">Total P/L</span>
                  <span className={`text-2xl font-bold tabular-nums ${plColor(broker.stats.totalPL)}`}>
                    {fmt(broker.stats.totalPL)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-text-muted font-medium">Win Rate</span>
                  <span className={`text-lg font-semibold tabular-nums ${broker.stats.winRate >= 50 ? 'text-profit' : broker.stats.closedTrades > 0 ? 'text-loss' : 'text-text-secondary'}`}>
                    {broker.stats.closedTrades > 0 ? `${broker.stats.winRate}%` : '—'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                  <div className="text-center">
                    <div className="text-lg font-bold text-text-primary tabular-nums">{broker.stats.totalTrades}</div>
                    <div className="text-xs text-text-muted">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-profit tabular-nums">{broker.stats.wins}</div>
                    <div className="text-xs text-text-muted">Wins</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-loss tabular-nums">{broker.stats.losses}</div>
                    <div className="text-xs text-text-muted">Losses</div>
                  </div>
                </div>
                {broker.stats.openTrades > 0 && (
                  <div className="text-sm text-text-muted text-center pt-1">
                    {broker.stats.openTrades} open position{broker.stats.openTrades !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowForm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-bg border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-border">
                <h2 className="text-xl font-bold text-text-primary">
                  {editingBroker ? 'Edit Account' : 'Add Account'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Account Name *</label>
                  <input type="text" value={formName} onChange={e => handleNameChange(e.target.value)}
                    placeholder="e.g. Webull, TradeThePool (Eval)"
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                    required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Slug (identifier)</label>
                  <input type="text" value={formSlug} onChange={e => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="e.g. webull, tradethepool-eval"
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base font-mono placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                    required />
                  <p className="text-xs text-text-muted mt-1.5">Used internally to link trades to this account</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Account Type</label>
                  <select value={formType} onChange={e => setFormType(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent">
                    {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-5 py-2.5 bg-surface-2 text-text-secondary border border-border rounded-xl text-base font-medium hover:bg-surface-3 transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="px-5 py-2.5 bg-accent text-white rounded-xl text-base font-semibold hover:bg-accent-hover transition-all disabled:opacity-50">
                    {saving ? 'Saving...' : editingBroker ? 'Update' : 'Add Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
