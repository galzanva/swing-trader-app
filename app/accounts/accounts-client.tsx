'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { firmDisplayName, inferFirmSlug, isPropAccountType } from '@/lib/prop-firms';

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
  firmSlug: string | null;
  isActive: boolean;
  createdAt: string | null;
  stats: BrokerStats;
}

interface FirmSummary {
  firmSlug: string;
  name: string;
  evalCount: number;
  evalSpend: number;
  payouts: number;
  truePL: number;
  tradePL: number;
  trades: number;
  accounts: string[];
}

interface LedgerEntry {
  id: string;
  firmSlug: string;
  type: 'eval_purchase' | 'payout';
  amount: number;
  date: string;
  notes: string | null;
}

const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'margin', label: 'Margin' },
  { value: 'prop-eval', label: 'Prop Firm (Evaluation)' },
  { value: 'prop-funded', label: 'Prop Firm (Funded)' },
];

const fmt = (n: number) => (n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`);
const money = (n: number) => `$${Math.abs(n).toFixed(2)}`;
const plColor = (n: number) => (n > 0 ? 'text-profit' : n < 0 ? 'text-loss' : 'text-text-secondary');
const ymd = (iso: string) => iso.slice(0, 10);

export default function AccountsClient() {
  const [brokers, setBrokers] = useState<BrokerAccount[]>([]);
  const [firms, setFirms] = useState<FirmSummary[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingBroker, setEditingBroker] = useState<BrokerAccount | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formType, setFormType] = useState('cash');
  const [formFirm, setFormFirm] = useState('');

  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerType, setLedgerType] = useState<'eval_purchase' | 'payout'>('eval_purchase');
  const [ledgerFirm, setLedgerFirm] = useState('');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerDate, setLedgerDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ledgerNotes, setLedgerNotes] = useState('');
  const [ledgerSaving, setLedgerSaving] = useState(false);
  const [expandedFirm, setExpandedFirm] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/brokers');
      const data = await res.json();
      if (data.success) {
        setBrokers(data.brokers);
        setFirms(data.firms || []);
        setLedger(data.ledger || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const cashAccounts = useMemo(
    () => brokers.filter((b) => !isPropAccountType(b.accountType)),
    [brokers],
  );
  const propAccounts = useMemo(
    () => brokers.filter((b) => isPropAccountType(b.accountType)),
    [brokers],
  );

  const knownFirms = useMemo(() => {
    const slugs = new Set<string>();
    for (const f of firms) slugs.add(f.firmSlug);
    for (const b of propAccounts) {
      const s = b.firmSlug || inferFirmSlug(b.slug, b.accountType);
      if (s) slugs.add(s);
    }
    return [...slugs].sort();
  }, [firms, propAccounts]);

  const cashPL = cashAccounts.reduce((s, b) => s + b.stats.totalPL, 0);
  const propTruePL = firms.reduce((s, f) => s + f.truePL, 0);
  const propTradePL = firms.reduce((s, f) => s + f.tradePL, 0);
  const totalEvalSpend = firms.reduce((s, f) => s + f.evalSpend, 0);
  const totalPayouts = firms.reduce((s, f) => s + f.payouts, 0);
  const totalRealPL = cashPL + propTruePL;

  const openAddForm = () => {
    setEditingBroker(null);
    setFormName('');
    setFormSlug('');
    setFormType('cash');
    setFormFirm('');
    setShowAccountForm(true);
  };

  const openEditForm = (broker: BrokerAccount) => {
    setEditingBroker(broker);
    setFormName(broker.name);
    setFormSlug(broker.slug);
    setFormType(broker.accountType);
    setFormFirm(broker.firmSlug || inferFirmSlug(broker.slug, broker.accountType) || '');
    setShowAccountForm(true);
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingBroker) {
      const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setFormSlug(slug);
      if (isPropAccountType(formType)) setFormFirm(inferFirmSlug(slug, formType) || formFirm);
    }
  };

  const handleSubmitAccount = async (e: React.FormEvent) => {
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
          firmSlug: isPropAccountType(formType) ? (formFirm || inferFirmSlug(formSlug, formType)) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAccountForm(false);
        fetchAll();
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch { alert('Network error'); }
    setSaving(false);
  };

  const openLedger = (type: 'eval_purchase' | 'payout', firmSlug?: string) => {
    setLedgerType(type);
    setLedgerFirm(firmSlug || knownFirms[0] || 'topstep');
    setLedgerAmount('');
    setLedgerDate(new Date().toISOString().slice(0, 10));
    setLedgerNotes('');
    setLedgerOpen(true);
  };

  const handleSubmitLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    setLedgerSaving(true);
    try {
      const res = await fetch('/api/prop-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmSlug: ledgerFirm,
          type: ledgerType,
          amount: Number(ledgerAmount),
          date: ledgerDate,
          notes: ledgerNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLedgerOpen(false);
        fetchAll();
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch { alert('Network error'); }
    setLedgerSaving(false);
  };

  const deleteLedger = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await fetch(`/api/prop-ledger?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    fetchAll();
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-text-primary tracking-tight">Trading Accounts</h1>
          <p className="text-text-muted text-base mt-1.5">
            Trade P/L stays on each book. Prop firms also show what you actually paid and got paid.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openLedger('eval_purchase')}
            className="px-4 py-2.5 bg-surface-2 border border-border text-text-primary rounded-xl text-base font-semibold hover:bg-surface-3">
            Log eval purchase
          </button>
          <button onClick={() => openLedger('payout')}
            className="px-4 py-2.5 bg-surface-2 border border-border text-text-primary rounded-xl text-base font-semibold hover:bg-surface-3">
            Log payout
          </button>
          <button onClick={openAddForm}
            className="px-5 py-2.5 bg-accent text-white rounded-xl text-base font-semibold hover:bg-accent-hover">
            + Add Account
          </button>
        </div>
      </div>

      <div className="bg-surface-1 border border-border rounded-2xl p-6 lg:p-7">
        <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">Total P/L</div>
        <div className={`text-4xl font-bold tabular-nums mt-1 ${plColor(totalRealPL)}`}>{fmt(totalRealPL)}</div>
        <p className="text-sm text-text-muted mt-2">
          Cash/margin {fmt(cashPL)} + prop true P/L {fmt(propTruePL)}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Real brokerage P/L" value={fmt(cashPL)} color={plColor(cashPL)} sub="Cash / margin trade P/L" />
        <SummaryCard label="Prop true P/L" value={fmt(propTruePL)} color={plColor(propTruePL)} sub="Payouts minus eval spend" />
        <SummaryCard label="Eval spend" value={`-${money(totalEvalSpend)}`} color="text-loss" sub="Paid to buy / reset evals" />
        <SummaryCard label="Payouts received" value={money(totalPayouts)} color="text-profit" sub={`Sim trade P/L ${fmt(propTradePL)}`} />
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-text-primary">Cash &amp; margin</h2>
        {cashAccounts.length === 0 ? (
          <div className="bg-surface-1 border border-border rounded-2xl p-10 text-center text-text-muted">
            No cash or margin accounts yet.
          </div>
        ) : (
          <AccountGrid brokers={cashAccounts} onEdit={openEditForm} />
        )}
      </section>

      {firms.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary">Prop firms</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {firms.map((firm) => {
              const firmLedger = ledger.filter((e) => e.firmSlug === firm.firmSlug);
              const firmBrokers = brokers.filter((b) => (b.firmSlug || inferFirmSlug(b.slug, b.accountType)) === firm.firmSlug);
              const open = expandedFirm === firm.firmSlug;
              return (
                <div key={firm.firmSlug} className="bg-surface-1 border border-border rounded-2xl p-6 lg:p-7">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-text-primary">{firm.name}</h3>
                      <p className="text-sm text-text-muted mt-1">
                        {firm.evalCount} eval{firm.evalCount !== 1 ? 's' : ''} bought · {firmBrokers.length} journal account{firmBrokers.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openLedger('eval_purchase', firm.firmSlug)}
                        className="px-3 py-1.5 text-sm rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text-primary">
                        + Eval
                      </button>
                      <button onClick={() => openLedger('payout', firm.firmSlug)}
                        className="px-3 py-1.5 text-sm rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text-primary">
                        + Payout
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <div className="text-xs text-text-muted uppercase tracking-wider">True P/L</div>
                      <div className={`text-2xl font-bold tabular-nums ${plColor(firm.truePL)}`}>{fmt(firm.truePL)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-muted uppercase tracking-wider">Trade P/L (sim)</div>
                      <div className={`text-2xl font-bold tabular-nums ${plColor(firm.tradePL)}`}>{fmt(firm.tradePL)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-muted uppercase tracking-wider">Paid for evals</div>
                      <div className="text-lg font-semibold tabular-nums text-loss">-{money(firm.evalSpend)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-muted uppercase tracking-wider">Payouts</div>
                      <div className="text-lg font-semibold tabular-nums text-profit">{money(firm.payouts)}</div>
                    </div>
                  </div>

                  {firmBrokers.length > 0 && (
                    <div className="text-sm text-text-muted mb-3">
                      Linked: {firmBrokers.map((b) => b.name).join(', ')}
                    </div>
                  )}

                  <button onClick={() => setExpandedFirm(open ? null : firm.firmSlug)}
                    className="text-sm text-accent hover:underline">
                    {open ? 'Hide cash log' : `Show cash log (${firmLedger.length})`}
                  </button>

                  {open && (
                    <div className="mt-3 border-t border-border pt-3 space-y-2">
                      {firmLedger.length === 0 && (
                        <p className="text-sm text-text-muted">No eval purchases or payouts logged yet.</p>
                      )}
                      {firmLedger.map((e) => (
                        <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
                          <div>
                            <span className="text-text-muted tabular-nums mr-2">{ymd(e.date)}</span>
                            <span className="text-text-secondary">
                              {e.type === 'eval_purchase' ? 'Eval purchase' : 'Payout'}
                            </span>
                            {e.notes && <span className="text-text-muted"> · {e.notes}</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`tabular-nums font-semibold ${e.type === 'payout' ? 'text-profit' : 'text-loss'}`}>
                              {e.type === 'payout' ? '+' : '-'}{money(e.amount)}
                            </span>
                            <button onClick={() => deleteLedger(e.id)} className="text-text-muted hover:text-loss">×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {propAccounts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary">Prop journal books</h2>
          <p className="text-sm text-text-muted -mt-2">Sim / combine P/L from trades — not cash out of pocket.</p>
          <AccountGrid brokers={propAccounts} onEdit={openEditForm} />
        </section>
      )}

      {showAccountForm && (
        <Modal title={editingBroker ? 'Edit Account' : 'Add Account'} onClose={() => setShowAccountForm(false)}>
          <form onSubmit={handleSubmitAccount} className="space-y-5">
            <Field label="Account Name *">
              <input type="text" value={formName} onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. TopStep (Eval)"
                className={inputClass} required />
            </Field>
            <Field label="Slug (identifier)">
              <input type="text" value={formSlug} onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                className={`${inputClass} font-mono`} required />
              <p className="text-xs text-text-muted mt-1.5">Used internally to link trades to this account</p>
            </Field>
            <Field label="Account Type">
              <select value={formType} onChange={(e) => {
                setFormType(e.target.value);
                if (isPropAccountType(e.target.value) && !formFirm) {
                  setFormFirm(inferFirmSlug(formSlug, e.target.value) || '');
                }
              }} className={inputClass}>
                {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            {isPropAccountType(formType) && (
              <Field label="Prop firm">
                <input type="text" value={formFirm} onChange={(e) => setFormFirm(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="topstep"
                  list="firm-slugs"
                  className={`${inputClass} font-mono`} />
                <datalist id="firm-slugs">
                  {knownFirms.map((f) => <option key={f} value={f}>{firmDisplayName(f)}</option>)}
                </datalist>
                <p className="text-xs text-text-muted mt-1.5">
                  Eval and funded books that share this slug roll into one true P/L (e.g. topstep).
                </p>
              </Field>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAccountForm(false)} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={saving} className={btnAccent}>
                {saving ? 'Saving...' : editingBroker ? 'Update' : 'Add Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {ledgerOpen && (
        <Modal title={ledgerType === 'eval_purchase' ? 'Log eval purchase' : 'Log payout'} onClose={() => setLedgerOpen(false)}>
          <form onSubmit={handleSubmitLedger} className="space-y-5">
            <Field label="Prop firm">
              <input type="text" value={ledgerFirm} onChange={(e) => setLedgerFirm(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                list="ledger-firms" className={`${inputClass} font-mono`} required />
              <datalist id="ledger-firms">
                {knownFirms.map((f) => <option key={f} value={f}>{firmDisplayName(f)}</option>)}
              </datalist>
            </Field>
            <Field label="Amount (USD) *">
              <input type="number" min="0" step="0.01" value={ledgerAmount} onChange={(e) => setLedgerAmount(e.target.value)}
                placeholder={ledgerType === 'eval_purchase' ? '149.00' : '2500.00'}
                className={inputClass} required />
            </Field>
            <Field label="Date">
              <input type="date" value={ledgerDate} onChange={(e) => setLedgerDate(e.target.value)} className={inputClass} required />
            </Field>
            <Field label="Notes">
              <input type="text" value={ledgerNotes} onChange={(e) => setLedgerNotes(e.target.value)}
                placeholder={ledgerType === 'eval_purchase' ? '50K combine, account #5' : 'First payout'}
                className={inputClass} />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setLedgerOpen(false)} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={ledgerSaving} className={btnAccent}>
                {ledgerSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, sub }: { label: string; value: string; color: string; sub: string }) {
  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-5">
      <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${color}`}>{value}</div>
      <div className="text-sm text-text-muted mt-1">{sub}</div>
    </div>
  );
}

function AccountGrid({ brokers, onEdit }: { brokers: BrokerAccount[]; onEdit: (b: BrokerAccount) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6">
      {brokers.map((broker) => (
        <div key={broker.slug} className="bg-surface-1 border border-border rounded-2xl p-6 lg:p-7 hover:border-accent/30 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-text-primary">{broker.name}</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-md bg-surface-3 text-text-muted uppercase">
                  {ACCOUNT_TYPES.find((t) => t.value === broker.accountType)?.label || broker.accountType}
                </span>
                {broker.firmSlug && (
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-md bg-accent/10 text-accent">
                    {firmDisplayName(broker.firmSlug)}
                  </span>
                )}
              </div>
            </div>
            {broker.id && (
              <button onClick={() => onEdit(broker)}
                className="text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-surface-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-text-muted font-medium">Trade P/L</span>
              <span className={`text-2xl font-bold tabular-nums ${plColor(broker.stats.totalPL)}`}>{fmt(broker.stats.totalPL)}</span>
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
          </div>
        </div>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-bg border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-5 border-b border-border">
            <h2 className="text-xl font-bold text-text-primary">{title}</h2>
          </div>
          <div className="px-6 py-6">{children}</div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-text-secondary mb-2">{label}</label>
      {children}
    </div>
  );
}

const inputClass = 'w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';
const btnGhost = 'px-5 py-2.5 bg-surface-2 text-text-secondary border border-border rounded-xl text-base font-medium hover:bg-surface-3';
const btnAccent = 'px-5 py-2.5 bg-accent text-white rounded-xl text-base font-semibold hover:bg-accent-hover disabled:opacity-50';
