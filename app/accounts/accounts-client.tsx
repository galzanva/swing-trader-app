'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import DateRangeFilter, { DateRange, getDefaultAllTimeRange } from '@/app/components/date-range-filter';
import { firmDisplayName, inferFirmSlug, isPropAccountType, summarizeEvals } from '@/lib/prop-firms';

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

export interface LedgerEntry {
  id: string;
  firmSlug: string;
  type: 'eval_purchase' | 'payout';
  amount: number;
  date: string;
  notes: string | null;
  outcome: string | null;
  passedOn: string | null;
  daysToPass: number | null;
}

const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'margin', label: 'Margin' },
  { value: 'prop-eval', label: 'Prop eval' },
  { value: 'prop-funded', label: 'Prop funded' },
];

export const fmt = (n: number) => (n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`);
export const money = (n: number) => `$${Math.abs(n).toFixed(2)}`;
export const plColor = (n: number) => (n > 0 ? 'text-profit' : n < 0 ? 'text-loss' : 'text-text-secondary');
export const ymd = (iso: string) => iso.slice(0, 10);

export function shortDate(iso: string) {
  const [y, m, d] = ymd(iso).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function periodLabel(from: string | null, to: string | null) {
  if (!from) return '—';
  if (!to || from === to) return shortDate(from);
  return `${shortDate(from)} – ${shortDate(to)}`;
}

export function priceToPass(evalSpend: number, passed: number) {
  if (!passed) return null;
  return Math.round((evalSpend / passed) * 100) / 100;
}

export function formatRate(rate: number | null) {
  if (rate == null) return '—';
  const pct = Math.round(rate * 1000) / 10;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

function typeLabel(accountType: string) {
  return ACCOUNT_TYPES.find((t) => t.value === accountType)?.label || accountType;
}

function firmOf(b: BrokerAccount) {
  return b.firmSlug || inferFirmSlug(b.slug, b.accountType);
}

function hasTotals(b: BrokerAccount) {
  return b.stats.totalTrades > 0 || Math.abs(b.stats.totalPL) >= 0.005;
}

export default function AccountsClient() {
  const [brokers, setBrokers] = useState<BrokerAccount[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState('America/New_York');
  const [range, setRange] = useState<DateRange | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingBroker, setEditingBroker] = useState<BrokerAccount | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formType, setFormType] = useState('cash');
  const [formFirm, setFormFirm] = useState('');
  const [newFirmName, setNewFirmName] = useState('');

  useEffect(() => {
    fetch('/api/account/settings')
      .then((r) => r.json())
      .then((d) => {
        const tz = d.timezone || 'America/New_York';
        setTimezone(tz);
        setRange(getDefaultAllTimeRange(tz));
      })
      .catch(() => setRange(getDefaultAllTimeRange('America/New_York')));
  }, []);

  const fetchAll = useCallback(async (r: DateRange) => {
    try {
      const params = new URLSearchParams({ from: r.from, to: r.to });
      const res = await fetch(`/api/brokers?${params}`);
      const data = await res.json();
      if (data.success) {
        setBrokers(data.brokers);
        setLedger(data.ledger || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (range) void fetchAll(range);
  }, [range, fetchAll]);

  const ledgerByFirm = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    for (const e of ledger) {
      map.set(e.firmSlug, [...(map.get(e.firmSlug) || []), e]);
    }
    return map;
  }, [ledger]);

  const knownFirms = useMemo(() => {
    const slugs = new Set<string>();
    for (const e of ledger) slugs.add(e.firmSlug);
    for (const b of brokers) {
      const s = firmOf(b);
      if (s) slugs.add(s);
    }
    return [...slugs].sort();
  }, [ledger, brokers]);

  const rows = useMemo(() => {
    const visible = brokers.filter(hasTotals);
    const margin = visible.filter((b) => !isPropAccountType(b.accountType));
    const firmSummary = (slug: string | null) => summarizeEvals(slug ? (ledgerByFirm.get(slug) || []) : []);
    const evalAccounts = brokers.filter((b) => {
      if (b.accountType !== 'prop-eval') return false;
      const slug = firmOf(b);
      return hasTotals(b) || firmSummary(slug).evalCount > 0;
    });
    const funded = brokers.filter((b) => {
      if (b.accountType !== 'prop-funded') return false;
      const slug = firmOf(b);
      return hasTotals(b) || firmSummary(slug).payouts > 0;
    });
    const evalFirms = new Set(evalAccounts.map(firmOf).filter((s): s is string => Boolean(s)));
    const fundedFirms = new Set(funded.map(firmOf).filter((s): s is string => Boolean(s)));
    const evalOrphans = knownFirms
      .filter((slug) => !evalFirms.has(slug))
      .map((slug) => ({ slug, summary: summarizeEvals(ledgerByFirm.get(slug) || []) }))
      .filter(({ summary }) => summary.evalCount > 0);
    const payoutOrphans = knownFirms
      .filter((slug) => !fundedFirms.has(slug))
      .map((slug) => ({ slug, summary: summarizeEvals(ledgerByFirm.get(slug) || []) }))
      .filter(({ summary }) => summary.payouts > 0);
    return { margin, evalAccounts, funded, evalOrphans, payoutOrphans };
  }, [brokers, knownFirms, ledgerByFirm]);

  const firmGroups = useMemo(() => {
    const slugs = new Set<string>();
    for (const broker of [...rows.evalAccounts, ...rows.funded]) {
      const slug = firmOf(broker);
      if (slug) slugs.add(slug);
    }
    for (const orphan of rows.evalOrphans) slugs.add(orphan.slug);
    for (const orphan of rows.payoutOrphans) slugs.add(orphan.slug);
    return [...slugs].map((slug) => {
      const entries = ledgerByFirm.get(slug) || [];
      const summary = summarizeEvals(entries);
      const latest = entries.reduce((max, entry) => {
        const day = entry.date.slice(0, 10);
        return day > max ? day : max;
      }, '');
      const evalBrokers = rows.evalAccounts.filter((broker) => firmOf(broker) === slug);
      const fundedBrokers = rows.funded.filter((broker) => firmOf(broker) === slug);
      return { slug, summary, latest, evalBrokers, fundedBrokers, orphanEval: evalBrokers.length === 0 && summary.evalCount > 0, orphanPayout: fundedBrokers.length === 0 && summary.payouts > 0 };
    }).filter((group) => group.evalBrokers.length > 0 || group.fundedBrokers.length > 0 || group.summary.evalCount > 0 || group.summary.payouts > 0)
      .sort((a, b) => b.latest.localeCompare(a.latest) || firmDisplayName(a.slug).localeCompare(firmDisplayName(b.slug)));
  }, [rows, ledgerByFirm]);

  const cashPL = brokers
    .filter((b) => !isPropAccountType(b.accountType))
    .reduce((s, b) => s + b.stats.totalPL, 0);
  const allEval = summarizeEvals(ledger);
  const totalRealPL = cashPL + allEval.truePL;

  const openAddForm = () => {
    setEditingBroker(null);
    setFormName('');
    setFormSlug('');
    setFormType('cash');
    setFormFirm('');
    setNewFirmName('');
    setShowAccountForm(true);
  };

  const openEditForm = (broker: BrokerAccount) => {
    setEditingBroker(broker);
    setFormName(broker.name);
    setFormSlug(broker.slug);
    setFormType(broker.accountType);
    const firm = broker.firmSlug || inferFirmSlug(broker.slug, broker.accountType) || '';
    setFormFirm(firm);
    setNewFirmName('');
    setShowAccountForm(true);
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingBroker) {
      const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setFormSlug(slug);
    }
  };

  const resolvedFirm = () => {
    if (!isPropAccountType(formType)) return null;
    if (!formFirm || formFirm === '__new') {
      return newFirmName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    return formFirm;
  };

  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) return;
    const firm = resolvedFirm();
    if (isPropAccountType(formType) && !firm) {
      alert('Choose the prop firm, or name a new one. Eval and funded accounts connect by that firm.');
      return;
    }
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
          firmSlug: firm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAccountForm(false);
        if (range) fetchAll(range);
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch { alert('Network error'); }
    setSaving(false);
  };

  if (!range || loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-2 border-text-muted border-t-accent rounded-full animate-spin mx-auto" />
        <p className="text-text-muted text-base mt-4">Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-text-primary tracking-tight">Trading Accounts</h1>
          <p className="text-text-muted text-base mt-1.5">
            Totals are for {range.label}. Accounts with nothing in this range stay off the list.
          </p>
        </div>
        <DateRangeFilter value={range} onChange={setRange} timezone={timezone} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard label="Total" value={fmt(totalRealPL)} color={plColor(totalRealPL)} sub="Brokerage plus prop cash" />
        <SummaryCard label="Brokerages" value={fmt(cashPL)} color={plColor(cashPL)} sub="Cash and margin trade P/L" />
        <SummaryCard label="Eval spend" value={`-${money(allEval.evalSpend)}`} color="text-loss" sub={`${allEval.evalCount} purchase${allEval.evalCount === 1 ? '' : 's'}`} />
        <SummaryCard label="Payouts" value={money(allEval.payouts)} color="text-profit" sub="Cash received from prop firms" />
        <SummaryCard label="Prop firm P/L" value={fmt(allEval.truePL)} color={plColor(allEval.truePL)} sub="Payouts minus eval spend" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={openAddForm} className={btnAccent}>+ Add account</button>
      </div>

      {rows.margin.length === 0 && rows.evalAccounts.length === 0 && rows.funded.length === 0 && rows.evalOrphans.length === 0 && rows.payoutOrphans.length === 0 && (
        <p className="text-sm text-text-muted">No accounts with totals in this range.</p>
      )}

      {(rows.margin.length > 0) && (
        <AccountSection title="Cash and margin">
          <TradeTable
            rows={rows.margin.map((broker) => ({
              key: broker.id || broker.slug,
              href: broker.id ? `/accounts/${broker.id}` : `/accounts/${broker.slug}`,
              name: broker.name,
              meta: null,
              type: typeLabel(broker.accountType),
              stats: broker.stats,
              onEdit: broker.id ? () => openEditForm(broker) : undefined,
            }))}
          />
        </AccountSection>
      )}

      {firmGroups.length > 0 && (
        <AccountSection title="Prop firms" subtitle="Each block is one prop firm, newest activity first. Eval and funded accounts that use the same firm share its spend, payouts, and true P/L.">
          <PropFirmTable groups={firmGroups} onEdit={openEditForm} />
        </AccountSection>
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
            </Field>
            <Field label="Account Type">
              <select value={formType} onChange={(e) => {
                setFormType(e.target.value);
                if (isPropAccountType(e.target.value) && !formFirm) {
                  const inferred = inferFirmSlug(formSlug, e.target.value);
                  setFormFirm(inferred && knownFirms.includes(inferred) ? inferred : '__new');
                }
              }} className={inputClass}>
                {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            {isPropAccountType(formType) && (
              <Field label="Prop firm *">
                <select value={formFirm || '__new'} onChange={(e) => setFormFirm(e.target.value)} className={inputClass}>
                  {knownFirms.map((f) => <option key={f} value={f}>{firmDisplayName(f)}</option>)}
                  <option value="__new">New prop firm</option>
                </select>
                {formFirm === '__new' || !formFirm ? (
                  <input type="text" value={newFirmName} onChange={(e) => setNewFirmName(e.target.value)}
                    placeholder="Firm name, e.g. Apex"
                    className={`${inputClass} mt-2`} />
                ) : null}
                <FirmConnectNote firm={resolvedFirm()} brokers={brokers} editingId={editingBroker?.id || null} isNew={formFirm === '__new' || !formFirm} />
              </Field>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAccountForm(false)} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={saving} className={btnAccent}>{saving ? 'Saving...' : editingBroker ? 'Update' : 'Add Account'}</button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}

const emptyStats: BrokerStats = { totalTrades: 0, openTrades: 0, closedTrades: 0, wins: 0, losses: 0, totalPL: 0, winRate: 0 };

function AccountSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {subtitle && <p className="text-sm text-text-muted mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function FirmConnectNote({ firm, brokers, editingId, isNew }: { firm: string | null; brokers: BrokerAccount[]; editingId: string | null; isNew: boolean }) {
  if (!firm) {
    return <p className="text-xs text-text-muted mt-2">Name the firm. A later eval or funded account with this same firm joins its true P/L.</p>;
  }
  const mates = brokers.filter((b) => firmOf(b) === firm && b.id !== editingId);
  if (isNew && mates.length === 0) {
    return <p className="text-xs text-text-muted mt-2">New firm. Add the eval account and the funded account both under {firmDisplayName(firm)} and their spend and payouts combine.</p>;
  }
  if (mates.length === 0) {
    return <p className="text-xs text-text-muted mt-2">Joins {firmDisplayName(firm)}. No other account is on it yet.</p>;
  }
  return (
    <p className="text-xs text-text-muted mt-2">
      Joins {firmDisplayName(firm)}, with {mates.map((b) => b.name).join(' and ')}. Spend and payouts stay on this firm.
    </p>
  );
}

function NameCell({ href, name, meta }: { href: string; name: string; meta: string | null }) {
  return (
    <td className="px-4 py-3 align-middle">
      <Link href={href} className="font-semibold text-text-primary hover:text-accent">{name}</Link>
      {meta && <div className="text-xs text-text-muted mt-0.5">{meta}</div>}
    </td>
  );
}

function EditCell({ onEdit }: { onEdit?: () => void }) {
  return (
    <td className="px-4 py-3 text-right align-middle">
      {onEdit && (
        <button type="button" onClick={onEdit} className="text-sm text-text-muted hover:text-text-primary">Edit</button>
      )}
    </td>
  );
}

function ActivityCells({ stats }: { stats: BrokerStats }) {
  return (
    <>
      <td className="px-3 py-3 text-right tabular-nums text-text-secondary align-middle whitespace-nowrap">{stats.totalTrades || '—'}</td>
      <td className={`px-3 py-3 text-right tabular-nums align-middle whitespace-nowrap ${stats.closedTrades > 0 ? (stats.winRate >= 50 ? 'text-profit' : 'text-loss') : 'text-text-muted'}`}>
        {stats.closedTrades > 0 ? `${stats.winRate}%` : '—'}
      </td>
    </>
  );
}

function TradeCells({ stats }: { stats: BrokerStats }) {
  return (
    <>
      <ActivityCells stats={stats} />
      <td className={`px-3 py-3 text-right tabular-nums font-semibold align-middle whitespace-nowrap ${stats.totalTrades ? plColor(stats.totalPL) : 'text-text-muted'}`}>
        {stats.totalTrades ? fmt(stats.totalPL) : '—'}
      </td>
    </>
  );
}

function TradeTable({ rows }: {
  rows: {
    key: string;
    href: string;
    name: string;
    meta: string | null;
    type: string;
    stats: BrokerStats;
    onEdit?: () => void;
  }[];
}) {
  return (
    <div className="bg-surface-1 border border-border rounded-2xl overflow-x-auto">
      <table className="w-full text-sm table-fixed min-w-[760px]">
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[14%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
          <col className="w-[22%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
            <th className="px-4 py-3 font-medium">Account</th>
            <th className="px-3 py-3 font-medium">Type</th>
            <th className="px-3 py-3 font-medium text-right">Trades</th>
            <th className="px-3 py-3 font-medium text-right">Win rate</th>
            <th className="px-3 py-3 font-medium text-right">Trade P/L</th>
            <th className="px-4 py-3 font-medium text-right">Edit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border hover:bg-surface-2/60">
              <NameCell href={row.href} name={row.name} meta={row.meta} />
              <td className="px-3 py-3 text-text-secondary whitespace-nowrap">{row.type}</td>
              <TradeCells stats={row.stats} />
              <EditCell onEdit={row.onEdit} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type FirmGroup = {
  slug: string;
  summary: ReturnType<typeof summarizeEvals>;
  latest: string;
  evalBrokers: BrokerAccount[];
  fundedBrokers: BrokerAccount[];
  orphanEval: boolean;
  orphanPayout: boolean;
};

function PropFirmTable({ groups, onEdit }: { groups: FirmGroup[]; onEdit: (broker: BrokerAccount) => void }) {
  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const price = priceToPass(group.summary.evalSpend, group.summary.passed);
        const lines = firmLines(group, onEdit);
        return (
          <section key={group.slug} className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 bg-surface-2 border-b border-border flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-text-primary">{firmDisplayName(group.slug)}</h3>
                <p className="text-sm text-text-muted mt-1">
                  {group.summary.evalCount} eval{group.summary.evalCount === 1 ? '' : 's'}
                  <span className="mx-1.5">·</span>
                  Pass rate {formatRate(group.summary.passRate)}
                  <span className="mx-1.5">·</span>
                  {periodLabel(group.summary.periodFrom, group.summary.periodTo)}
                  <span className="mx-1.5">·</span>
                  Price to pass {price == null ? '—' : money(price)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-x-6 shrink-0">
                <FirmFigure label="Eval spend" value={`-${money(group.summary.evalSpend)}`} color="text-loss" />
                <FirmFigure label="Payouts" value={money(group.summary.payouts)} color="text-profit" />
                <FirmFigure label="True P/L" value={fmt(group.summary.truePL)} color={plColor(group.summary.truePL)} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed min-w-[640px]">
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-3 font-medium">Account</th>
                    <th className="px-3 py-3 font-medium">Type</th>
                    <th className="px-3 py-3 font-medium text-right">Trades</th>
                    <th className="px-3 py-3 font-medium text-right">Win rate</th>
                    <th className="px-4 py-3 font-medium text-right">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.key} className="border-t border-border hover:bg-surface-2/60">
                      <NameCell href={line.href} name={line.name} meta={null} />
                      <td className="px-3 py-3 text-text-secondary align-middle whitespace-nowrap">{line.kind}</td>
                      <ActivityCells stats={line.stats} />
                      <EditCell onEdit={line.onEdit} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FirmFigure({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-right min-w-[6.5rem]">
      <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">{label}</div>
      <div className={`text-base font-bold tabular-nums mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function firmLines(group: FirmGroup, onEdit: (broker: BrokerAccount) => void) {
  const lines: { key: string; href: string; name: string; kind: string; stats: BrokerStats; onEdit?: () => void }[] = [];
  const pushBroker = (broker: BrokerAccount, kind: string) => {
    lines.push({
      key: broker.id || broker.slug,
      href: broker.id ? `/accounts/${broker.id}` : `/accounts/${broker.slug}`,
      name: broker.name,
      kind,
      stats: broker.stats,
      onEdit: broker.id ? () => onEdit(broker) : undefined,
    });
  };
  for (const broker of group.evalBrokers) pushBroker(broker, 'Eval');
  if (group.orphanEval) {
    lines.push({
      key: `${group.slug}-eval-ledger`,
      href: `/accounts/firm/${group.slug}`,
      name: firmDisplayName(group.slug),
      kind: 'Eval',
      stats: emptyStats,
    });
  }
  for (const broker of group.fundedBrokers) pushBroker(broker, 'Funded');
  if (group.orphanPayout) {
    lines.push({
      key: `${group.slug}-payout-ledger`,
      href: `/accounts/firm/${group.slug}?view=payout`,
      name: firmDisplayName(group.slug),
      kind: 'Funded',
      stats: emptyStats,
    });
  }
  return lines;
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

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-bg border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
const btnGhost = 'px-4 py-2.5 bg-surface-2 text-text-secondary border border-border rounded-xl text-sm font-medium hover:bg-surface-3';
const btnAccent = 'px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover disabled:opacity-50';
