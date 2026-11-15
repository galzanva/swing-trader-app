'use client';

import { useEffect, useState } from 'react';
import DateRangeFilter, { DateRange, getDefaultAllTimeRange } from '@/app/components/date-range-filter';

type Bucket = { days: number; totalPL: number; avgPL: number; ifFollowedPL: number };
type Limits = {
  dayStop: number | null;
  lossStreak: number | null;
  maxContracts: number | null;
  riskPerTrade: number | null;
  bannedRoots: string[];
  openWindow: { maxTrades: number; minutes: number } | null;
};
type Row = { date: string; followed: boolean; pnl: number; ifFollowed: number | null; note: string | null };
type Report = {
  playbook: { id: string; name: string; strategyCount: number; tickers: string | null } | null;
  followed: Bucket;
  missed: Bucket;
  recent: Row[];
  limits: Limits | null;
  totalDays: number;
};

function money(n: number) {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function limitsLine(l: Limits) {
  const parts: string[] = [];
  if (l.dayStop) parts.push(`day stop -$${l.dayStop}`);
  if (l.lossStreak) parts.push(`stop after ${l.lossStreak} losses in a row`);
  if (l.maxContracts) parts.push(`max ${l.maxContracts} contracts`);
  if (l.riskPerTrade) parts.push(`loss capped at $${l.riskPerTrade} a trade`);
  if (l.bannedRoots.length) parts.push(`no ${l.bannedRoots.join('/')} trades`);
  if (l.openWindow) {
    const n = l.openWindow.maxTrades;
    parts.push(`at most ${n} trade${n === 1 ? '' : 's'} in the first ${l.openWindow.minutes} minutes after 9:30`);
  }
  return parts.join(', ');
}

export default function PlaybookDiscipline({
  playbookId,
  from,
  to,
  pageSize = 10,
  paginate = true,
  showRange = false,
}: {
  playbookId?: string | null;
  from?: string;
  to?: string;
  pageSize?: number;
  paginate?: boolean;
  showRange?: boolean;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [page, setPage] = useState(0);
  const [timezone, setTimezone] = useState('America/New_York');
  const [range, setRange] = useState<DateRange | null>(null);

  useEffect(() => {
    if (!showRange) return;
    let cancel = false;
    fetch('/api/account/settings')
      .then((r) => r.json())
      .then((d) => {
        if (cancel) return;
        const tz = d.timezone || 'America/New_York';
        setTimezone(tz);
        setRange(getDefaultAllTimeRange(tz));
      })
      .catch(() => {
        if (!cancel) setRange(getDefaultAllTimeRange('America/New_York'));
      });
    return () => { cancel = true; };
  }, [showRange]);

  const fromQ = showRange ? range?.from : from;
  const toQ = showRange ? range?.to : to;
  const ready = !showRange || Boolean(range);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams();
    if (playbookId) params.set('playbookId', playbookId);
    if (fromQ) params.set('from', fromQ);
    if (toQ) params.set('to', toQ);
    const q = params.toString();
    let cancel = false;
    void fetch(`/api/playbook-analytics${q ? `?${q}` : ''}`)
      .then((r) => r.json())
      .then((d) => { if (!cancel && d.success) setReport(d); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [playbookId, fromQ, toQ, ready]);

  useEffect(() => { setPage(0); }, [playbookId, fromQ, toQ]);

  if (showRange && !range) return null;
  if (!report?.playbook) return null;
  const { followed, missed, recent, playbook, limits, totalDays } = report;
  const showIf = Boolean(limits) && missed.days > 0;
  const gap = missed.ifFollowedPL - missed.totalPL;
  const pageCount = Math.max(1, Math.ceil(recent.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = paginate
    ? recent.slice(safePage * pageSize, safePage * pageSize + pageSize)
    : recent.slice(0, pageSize);
  const rangeLabel = showRange ? range?.label : null;

  if (!totalDays) {
    return (
      <div className="bg-surface-1 border border-border rounded-2xl p-6 text-sm text-text-muted">
        <span className="font-semibold text-text-primary">{playbook.name}</span> has no daily check-ins yet.
      </div>
    );
  }

  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-6 space-y-4">
      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-text-primary">Playbook · {playbook.name}</h3>
          {showRange && range && (
            <DateRangeFilter value={range} onChange={setRange} timezone={timezone} />
          )}
        </div>
        <p className="text-xs text-text-muted">
          A day counts as followed only when every rule is checked. P/L is every trade that day
          {playbook.tickers ? ` on ${playbook.tickers}` : playbook.strategyCount ? ' in the attached strategies' : ''}.
          {rangeLabel ? ` Totals are for ${rangeLabel}.` : fromQ && toQ ? ' Totals follow the dates selected above.' : ''}
        </p>
        {showIf && limits && (
          <p className="text-xs text-text-muted">
            If followed replays a missed day in entry order and applies only the rules that were not checked.
            Checked rules stay as traded. Replay can use {limitsLine(limits)}. It is an estimate from the journal, not a fill.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">Followed</div>
          <div className="text-lg font-semibold text-profit mt-1">{followed.days} day{followed.days === 1 ? '' : 's'}</div>
          <div className="text-sm text-text-secondary">{money(followed.totalPL)} total · {money(followed.avgPL)} avg</div>
        </div>
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">Missed a rule</div>
          <div className="text-lg font-semibold text-loss mt-1">{missed.days} day{missed.days === 1 ? '' : 's'}</div>
          <div className="text-sm text-text-secondary">{money(missed.totalPL)} total · {money(missed.avgPL)} avg</div>
          {showIf && (
            <div className="text-sm text-text-secondary mt-1">
              If followed: <span className={missed.ifFollowedPL >= 0 ? 'text-profit' : 'text-loss'}>{money(missed.ifFollowedPL)}</span>
              {Math.abs(gap) >= 0.01 && (
                <span className={gap > 0 ? 'text-profit' : 'text-loss'}> ({money(gap)} {gap > 0 ? 'better' : 'worse'})</span>
              )}
            </div>
          )}
        </div>
      </div>
      {recent.length === 0 && (
        <p className="text-sm text-text-muted">No check-ins in this range.</p>
      )}
      {visible.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-text-muted">
                <th className="py-1 pr-3">Date</th>
                <th className="py-1 pr-3">Rules</th>
                <th className="py-1 text-right">P/L</th>
                {showIf && <th className="py-1 pl-3 text-right">If followed</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.date} className="border-t border-border">
                  <td className="py-1.5 pr-3 text-text-secondary">{row.date}</td>
                  <td className={`py-1.5 pr-3 ${row.followed ? 'text-profit' : 'text-loss'}`}>
                    {row.followed ? 'Followed' : 'Missed'}
                  </td>
                  <td className={`py-1.5 text-right tabular-nums ${row.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {money(row.pnl)}
                  </td>
                  {showIf && (
                    <td className={`py-1.5 pl-3 text-right tabular-nums ${row.ifFollowed == null ? 'text-text-muted' : row.ifFollowed >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {row.ifFollowed == null ? '—' : money(row.ifFollowed)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {paginate && recent.length > pageSize && (
        <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
          <span>{safePage * pageSize + 1}–{Math.min(recent.length, (safePage + 1) * pageSize)} of {recent.length}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              className="px-3 py-1 rounded-lg border border-border hover:bg-surface-2 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
              className="px-3 py-1 rounded-lg border border-border hover:bg-surface-2 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {!paginate && recent.length > pageSize && (
        <p className="text-xs text-text-muted">
          Showing the {pageSize} most recent days in this range. Totals include every check-in in the range.
        </p>
      )}
    </div>
  );
}
