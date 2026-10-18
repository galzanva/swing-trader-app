'use client';

import { useEffect, useState } from 'react';

type Bucket = { days: number; totalPL: number; avgPL: number };
type Report = {
  playbook: { id: string; name: string; strategyCount: number; tickers: string | null } | null;
  followed: Bucket;
  missed: Bucket;
  recent: { date: string; followed: boolean; pnl: number; note: string | null }[];
};

function money(n: number) {
  const sign = n > 0 ? '+' : '';
  return `${sign}$${n.toFixed(2)}`;
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
  const { followed, missed, recent, playbook } = report;
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
          A day counts as followed only when every rule is checked. P/L is that day’s trades
          {playbook.strategyCount ? ' in the attached strategies' : ''}
          {playbook.tickers ? ` (${playbook.tickers})` : playbook.strategyCount ? '' : ' (all tickers)'}.
        </p>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
