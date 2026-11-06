'use client';

import { useEffect, useState } from 'react';

type Bucket = { days: number; totalPL: number; avgPL: number; ifFollowedPL: number };
type Limits = {
  dayStop: number | null;
  lossStreak: number | null;
  maxContracts: number | null;
  riskPerTrade: number | null;
  bannedRoots: string[];
};
type Report = {
  playbook: { id: string; name: string; strategyCount: number; tickers: string | null } | null;
  followed: Bucket;
  missed: Bucket;
  recent: { date: string; followed: boolean; pnl: number; ifFollowed: number | null; note: string | null }[];
  limits: Limits | null;
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
  return parts.join(', ');
}

export default function PlaybookDiscipline({ playbookId }: { playbookId?: string | null }) {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    const q = playbookId ? `?playbookId=${encodeURIComponent(playbookId)}` : '';
    void fetch(`/api/playbook-analytics${q}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setReport(d); })
      .catch(() => {});
  }, [playbookId]);

  if (!report?.playbook) return null;
  const { followed, missed, recent, playbook, limits } = report;
  const showIf = Boolean(limits) && missed.days > 0;
  const gap = missed.ifFollowedPL - missed.totalPL;
  if (!followed.days && !missed.days) {
    return (
      <div className="bg-surface-1 border border-border rounded-2xl p-6 text-sm text-text-muted">
        <span className="font-semibold text-text-primary">{playbook.name}</span> has no daily check-ins yet.
      </div>
    );
  }

  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-text-primary">Playbook · {playbook.name}</h3>
        <p className="text-xs text-text-muted mt-1">
          A day counts as followed only when every rule is checked. P/L is every trade that day
          {playbook.tickers ? ` on ${playbook.tickers}` : playbook.strategyCount ? ' in the attached strategies' : ''}.
        </p>
        {showIf && limits && (
          <p className="text-xs text-text-muted mt-1">
            If followed replays a missed day in time order with {limitsLine(limits)}. It is an estimate from the journal, not a fill.
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
      {recent.length > 0 && (
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
              {recent.map((row) => (
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
    </div>
  );
}
