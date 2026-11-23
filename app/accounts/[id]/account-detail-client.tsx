'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DateRangeFilter, { DateRange, getDefaultAllTimeRange } from '@/app/components/date-range-filter';
import { calendarDays, firmDisplayName, inferFirmSlug, summarizeEvals } from '@/lib/prop-firms';
import { fmt, formatRate, money, periodLabel, plColor, priceToPass, shortDate, ymd, type LedgerEntry } from '../accounts-client';

interface BrokerStats {
  totalTrades: number;
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
  stats: BrokerStats;
}

export default function AccountDetailClient({
  accountId,
  firmSlug: firmOnly,
  view,
}: {
  accountId?: string;
  firmSlug?: string;
  view?: 'eval' | 'payout';
}) {
  const router = useRouter();
  const [brokers, setBrokers] = useState<BrokerAccount[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [timezone, setTimezone] = useState('America/New_York');
  const [range, setRange] = useState<DateRange | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<'passed' | 'failed' | 'ongoing'>('ongoing');
  const [passedOn, setPassedOn] = useState('');
  const [saving, setSaving] = useState(false);

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

  const load = useCallback(async (r: DateRange) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: r.from, to: r.to });
      const res = await fetch(`/api/brokers?${params}`);
      const data = await res.json();
      if (!data.success) {
        setMissing(true);
        return;
      }
      const nextBrokers: BrokerAccount[] = data.brokers || [];
      const nextLedger: LedgerEntry[] = data.ledger || [];
      setBrokers(nextBrokers);
      setLedger(nextLedger);
      if (firmOnly) {
        const hit = nextLedger.some((e) => e.firmSlug === firmOnly)
          || nextBrokers.some((b) => (b.firmSlug || inferFirmSlug(b.slug, b.accountType)) === firmOnly);
        if (!hit) {
          const all = await fetch('/api/brokers').then((response) => response.json());
          const still = (all.ledger || []).some((e: LedgerEntry) => e.firmSlug === firmOnly)
            || (all.brokers || []).some((b: BrokerAccount) => (b.firmSlug || inferFirmSlug(b.slug, b.accountType)) === firmOnly);
          setMissing(!still);
        } else {
          setMissing(false);
        }
        return;
      }
      const hit = nextBrokers.some((b) => b.id === accountId || b.slug === accountId);
      setMissing(!hit);
    } catch {
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [accountId, firmOnly]);

  useEffect(() => {
    if (range) void load(range);
  }, [range, load]);

  const broker = firmOnly
    ? null
    : brokers.find((b) => b.id === accountId) || brokers.find((b) => b.slug === accountId) || null;

  useEffect(() => {
    if (broker?.id && accountId && broker.id !== accountId) {
      router.replace(`/accounts/${broker.id}`);
    }
  }, [broker, accountId, router]);

  const firmSlug = firmOnly || (broker ? (broker.firmSlug || inferFirmSlug(broker.slug, broker.accountType)) : null);
  const kind: 'cash' | 'eval' | 'payout' = firmOnly
    ? (view === 'payout' ? 'payout' : 'eval')
    : broker?.accountType === 'prop-eval'
      ? 'eval'
      : broker?.accountType === 'prop-funded'
        ? 'payout'
        : 'cash';

  const entries = useMemo(() => {
    if (!firmSlug || kind === 'cash') return [];
    return ledger.filter((e) => e.firmSlug === firmSlug && e.type === (kind === 'eval' ? 'eval_purchase' : 'payout'));
  }, [ledger, firmSlug, kind]);
  const evalSummary = summarizeEvals(kind === 'eval' && firmSlug ? ledger.filter((e) => e.firmSlug === firmSlug && e.type === 'eval_purchase') : []);
  const firmBooks = summarizeEvals(firmSlug ? ledger.filter((e) => e.firmSlug === firmSlug) : []);
  const passPrice = priceToPass(evalSummary.evalSpend, evalSummary.passed);
  const payoutTotal = entries.reduce((sum, e) => sum + (e.type === 'payout' ? e.amount : 0), 0);
  const sibling = firmSlug
    ? brokers.find((b) => b.id !== broker?.id && (b.firmSlug || inferFirmSlug(b.slug, b.accountType)) === firmSlug && b.accountType === (kind === 'eval' ? 'prop-funded' : 'prop-eval'))
    : null;

  const saveOutcome = async (entry: LedgerEntry, next: 'passed' | 'failed' | 'ongoing', passedOnValue: string | null) => {
    const res = await fetch('/api/prop-ledger', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: entry.id,
        outcome: next,
        passedOn: next === 'passed' ? passedOnValue : null,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || 'Could not update');
      return;
    }
    if (range) void load(range);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await fetch(`/api/prop-ledger?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (range) void load(range);
  };

  const closeLog = () => {
    setFormOpen(false);
    setAmount('');
    setNotes('');
    setOutcome('ongoing');
    setPassedOn('');
  };

  const submitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmSlug) return;
    setSaving(true);
    try {
      const res = await fetch('/api/prop-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmSlug,
          type: kind === 'eval' ? 'eval_purchase' : 'payout',
          amount: Number(amount),
          date,
          notes: notes.trim() || null,
          outcome: kind === 'eval' ? outcome : null,
          passedOn: kind === 'eval' && outcome === 'passed' ? passedOn : null,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Could not save');
        return;
      }
      closeLog();
      if (range) void load(range);
    } catch {
      alert('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (!range || loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-2 border-text-muted border-t-accent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (missing || (!broker && !firmOnly)) {
    return (
      <div className="space-y-4">
        <Link href="/accounts" className="text-sm text-accent hover:underline">← Accounts</Link>
        <p className="text-text-secondary">That account is not on this book.</p>
      </div>
    );
  }

  const title = broker?.name || firmDisplayName(firmSlug || '');
  const typeLabel = kind === 'eval' ? 'Prop eval' : kind === 'payout' ? 'Prop funded' : broker?.accountType === 'margin' ? 'Margin' : 'Cash';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/accounts" className="text-sm text-accent hover:underline">← Accounts</Link>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight mt-2">{title}</h1>
          <p className="text-text-muted text-sm mt-1">
            {typeLabel}{firmSlug ? ` · ${firmDisplayName(firmSlug)}` : ''} · {range.label}
          </p>
        </div>
        <DateRangeFilter value={range} onChange={setRange} timezone={timezone} />
      </div>

      {broker && kind === 'cash' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Trade P/L" value={fmt(broker.stats.totalPL)} color={plColor(broker.stats.totalPL)} />
          <Stat label="Win rate" value={broker.stats.closedTrades ? `${broker.stats.winRate}%` : '—'} color={broker.stats.closedTrades ? (broker.stats.winRate >= 50 ? 'text-profit' : 'text-loss') : 'text-text-secondary'} />
          <Stat label="Trades" value={String(broker.stats.totalTrades)} color="text-text-primary" />
          <Stat label="Wins / losses" value={`${broker.stats.wins} / ${broker.stats.losses}`} color="text-text-primary" />
        </div>
      )}

      {kind !== 'cash' && firmSlug && sibling?.id && (
        <Link href={`/accounts/${sibling.id}`} className="text-sm text-accent hover:underline -mt-4 inline-block">
          {sibling.accountType === 'prop-funded' ? `${firmDisplayName(firmSlug)} funded account` : `${firmDisplayName(firmSlug)} eval account`}
        </Link>
      )}

      {kind === 'eval' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Pass rate" value={formatRate(evalSummary.passRate)} color="text-text-primary" sub={passRateSub(evalSummary)} />
          <Stat label="Price to pass" value={passPrice == null ? '—' : money(passPrice)} color="text-text-primary" sub="Eval spend divided by passes" />
          <Stat label="Eval spend" value={`-${money(firmBooks.evalSpend)}`} color="text-loss" sub={periodLabel(evalSummary.periodFrom, evalSummary.periodTo)} />
          <Stat label="True P/L" value={fmt(firmBooks.truePL)} color={plColor(firmBooks.truePL)} sub={`Payouts ${money(firmBooks.payouts)}`} />
          {broker && <Stat label="Trades" value={String(broker.stats.totalTrades)} color="text-text-primary" />}
          {broker && <Stat label="Win rate" value={broker.stats.closedTrades ? `${broker.stats.winRate}%` : '—'} color={broker.stats.closedTrades ? (broker.stats.winRate >= 50 ? 'text-profit' : 'text-loss') : 'text-text-secondary'} />}
          {broker && <Stat label="Wins / losses" value={`${broker.stats.wins} / ${broker.stats.losses}`} color="text-text-primary" />}
        </div>
      )}

      {kind === 'payout' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Payouts" value={money(payoutTotal)} color="text-profit" sub={`${entries.length} payout${entries.length === 1 ? '' : 's'} in this range`} />
          <Stat label="Eval spend" value={`-${money(firmBooks.evalSpend)}`} color="text-loss" sub="Same firm" />
          <Stat label="True P/L" value={fmt(firmBooks.truePL)} color={plColor(firmBooks.truePL)} sub="Payouts minus eval spend" />
          {broker && <Stat label="Trades" value={String(broker.stats.totalTrades)} color="text-text-primary" />}
          {broker && <Stat label="Win rate" value={broker.stats.closedTrades ? `${broker.stats.winRate}%` : '—'} color={broker.stats.closedTrades ? (broker.stats.winRate >= 50 ? 'text-profit' : 'text-loss') : 'text-text-secondary'} />}
          {broker && <Stat label="Wins / losses" value={`${broker.stats.wins} / ${broker.stats.losses}`} color="text-text-primary" />}
        </div>
      )}

      {kind !== 'cash' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" onClick={() => setFormOpen((open) => !open)} className="px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover">
              {kind === 'eval' ? 'Log eval' : 'Log payout'}
            </button>
          </div>
          {formOpen && (
            <form onSubmit={submitLog} className="bg-surface-1 border border-border rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="text-sm text-text-secondary">
                Amount
                <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputClass} />
              </label>
              <label className="text-sm text-text-secondary">
                Date
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
              </label>
              {kind === 'eval' && (
                <label className="text-sm text-text-secondary">
                  Result
                  <select value={outcome} onChange={(e) => setOutcome(e.target.value as 'passed' | 'failed' | 'ongoing')} className={inputClass}>
                    <option value="ongoing">Ongoing</option>
                    <option value="failed">Failed</option>
                    <option value="passed">Passed</option>
                  </select>
                </label>
              )}
              {kind === 'eval' && outcome === 'passed' && (
                <label className="text-sm text-text-secondary">
                  Passed on
                  <input type="date" value={passedOn} min={date} onChange={(e) => setPassedOn(e.target.value)} required className={inputClass} />
                  {passedOn && calendarDays(date, passedOn) != null && (
                    <span className="block mt-1 text-xs text-text-muted">{calendarDays(date, passedOn)} days from the start date</span>
                  )}
                </label>
              )}
              <label className="text-sm text-text-secondary sm:col-span-2">
                Notes
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
              </label>
              <div className="flex items-end gap-2">
                <button type="submit" disabled={saving} className="px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={closeLog} disabled={saving} className="px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-text-secondary hover:bg-surface-2 disabled:opacity-50">
                  Cancel
                </button>
              </div>
            </form>
          )}
          <div className="bg-surface-1 border border-border rounded-2xl overflow-x-auto">
            <table className={`w-full text-sm table-fixed ${kind === 'eval' ? 'min-w-[920px]' : 'min-w-[640px]'}`}>
              <colgroup>
                <col className="w-[14%]" />
                <col />
                {kind === 'eval' && <col className="w-[12%]" />}
                {kind === 'eval' && <col className="w-[16%]" />}
                {kind === 'eval' && <col className="w-[10%]" />}
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Date</th>
                  <th className="px-3 py-3 font-medium">Notes</th>
                  {kind === 'eval' && <th className="px-3 py-3 font-medium">Result</th>}
                  {kind === 'eval' && <th className="px-3 py-3 font-medium whitespace-nowrap">Passed on</th>}
                  {kind === 'eval' && <th className="px-3 py-3 font-medium text-right">Days</th>}
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={kind === 'eval' ? 6 : 3} className="px-4 py-8 text-center text-text-muted">
                      {kind === 'eval' ? 'No eval purchases in this range.' : 'No payouts in this range.'}
                    </td>
                  </tr>
                )}
                {entries.map((entry) => (
                  <LogRow key={entry.id} entry={entry} onSave={saveOutcome} onDelete={() => remove(entry.id)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LogRow({
  entry, onSave, onDelete,
}: {
  entry: LedgerEntry;
  onSave: (entry: LedgerEntry, outcome: 'passed' | 'failed' | 'ongoing', passedOn: string | null) => void;
  onDelete: () => void;
}) {
  const [outcome, setOutcome] = useState(storedOutcome(entry.outcome));
  const [passedOn, setPassedOn] = useState(entry.passedOn ? ymd(entry.passedOn) : '');
  useEffect(() => {
    setOutcome(storedOutcome(entry.outcome));
    setPassedOn(entry.passedOn ? ymd(entry.passedOn) : '');
  }, [entry.outcome, entry.passedOn]);

  const isEval = entry.type === 'eval_purchase';
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 text-text-secondary whitespace-nowrap tabular-nums align-middle">{shortDate(ymd(entry.date))}</td>
      <td className="px-3 py-3 text-text-muted align-middle truncate" title={entry.notes || undefined}>{entry.notes || '—'}</td>
      {isEval && (
        <td className="px-3 py-3 align-middle">
          <select
            value={entry.outcome ? outcome : ''}
            onChange={(e) => {
              const next = e.target.value as 'passed' | 'failed' | 'ongoing';
              setOutcome(next);
              if (next !== 'passed') onSave(entry, next, null);
              else if (passedOn) onSave(entry, next, passedOn);
            }}
            className={`w-full bg-surface-2 border border-border rounded-lg px-2 py-1 text-sm ${outcomeColor(entry.outcome)}`}
          >
            {!entry.outcome && <option value="">Unmarked</option>}
            <option value="ongoing">Ongoing</option>
            <option value="failed">Failed</option>
            <option value="passed">Passed</option>
          </select>
        </td>
      )}
      {isEval && (
        <td className="px-3 py-3 align-middle">
          {entry.outcome === 'passed' || outcome === 'passed' ? (
            <input
              type="date"
              value={passedOn}
              min={ymd(entry.date)}
              onChange={(e) => {
                setPassedOn(e.target.value);
                if (e.target.value) onSave(entry, 'passed', e.target.value);
              }}
              className="w-full bg-surface-2 border border-border rounded-lg px-2 py-1 text-sm tabular-nums text-text-primary"
            />
          ) : (
            <span className="text-text-muted">—</span>
          )}
        </td>
      )}
      {isEval && (
        <td className="px-3 py-3 text-right text-text-secondary tabular-nums align-middle whitespace-nowrap">
          {outcome === 'passed' ? (passedOn ? `${calendarDays(ymd(entry.date), passedOn) ?? '—'} days` : entry.daysToPass != null ? `${entry.daysToPass} days` : '—') : '—'}
        </td>
      )}
      <td className="px-4 py-3 text-right whitespace-nowrap align-middle">
        <span className={`tabular-nums font-semibold ${entry.type === 'payout' ? 'text-profit' : 'text-loss'}`}>
          {entry.type === 'payout' ? '+' : '-'}{money(entry.amount)}
        </span>
        <button type="button" onClick={onDelete} className="ml-3 text-text-muted hover:text-loss">×</button>
      </td>
    </tr>
  );
}

function storedOutcome(value: string | null): 'passed' | 'failed' | 'ongoing' {
  if (value === 'passed' || value === 'ongoing') return value;
  return 'failed';
}

function outcomeColor(value: string | null) {
  if (value === 'passed') return 'text-profit';
  if (value === 'failed') return 'text-loss';
  if (value === 'ongoing') return 'text-accent';
  return 'text-text-secondary';
}

function passRateSub(summary: { evalCount: number; passed: number; failed: number; ongoing: number }) {
  if (!summary.evalCount) return 'No evals in this range';
  const finished = summary.passed + summary.failed;
  if (!finished) return `${summary.ongoing} ongoing`;
  if (summary.ongoing) return `${summary.passed} of ${finished} finished, ${summary.ongoing} ongoing`;
  return `${summary.passed} of ${finished} passed`;
}

function Stat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-5">
      <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">{label}</div>
      <div className={`text-xl font-bold tabular-nums mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-sm text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

const inputClass = 'mt-1 w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent';
