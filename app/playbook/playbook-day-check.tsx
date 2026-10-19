'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Rule = { id: string; text: string };

export default function PlaybookDayCheck({ date }: { date: string }) {
  const [playbook, setPlaybook] = useState<{ id: string; name: string; rules: Rule[] } | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const load = useCallback(async (day: string) => {
    setReady(false);
    const res = await fetch(`/api/playbook-checkin?date=${day}`);
    const data = await res.json();
    setPlaybook(data.playbook || null);
    setChecks(data.day?.checks || {});
    setStatus(data.day?.followedAll ? 'All rules followed' : '');
    setReady(true);
  }, []);

  useEffect(() => { void load(date); }, [date, load]);

  const save = (next: Record<string, boolean>) => {
    if (!playbook) return;
    setStatus('Saving…');
    const snapshot = next;
    queue.current = queue.current.catch(() => undefined).then(async () => {
      const res = await fetch('/api/playbook-checkin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, playbookId: playbook.id, checks: snapshot }),
      });
      const data = await res.json();
      if (data.success) setStatus(data.followedAll ? 'All rules followed' : '');
    });
  };

  if (!ready) return null;
  if (!playbook) {
    return (
      <p className="text-sm text-text-muted">
        No active playbook.{' '}
        <Link href="/playbook" className="text-accent hover:underline">Set one up</Link>
        {' '}to check rules here.
      </p>
    );
  }

  const checked = playbook.rules.filter((r) => checks[r.id]).length;

  return (
    <section className="bg-surface-1 border border-border rounded-2xl p-5 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-accent">Playbook</div>
          <h2 className="text-base font-semibold text-text-primary">{playbook.name}</h2>
        </div>
        <div className="text-xs text-text-muted">
          {playbook.rules.length > 0 && <span className="mr-3">{checked} of {playbook.rules.length}</span>}
          {status === 'All rules followed' ? (
            <span className="text-profit">{status}</span>
          ) : (
            <span>{status}</span>
          )}
          <Link href="/playbook" className="ml-3 text-accent hover:underline">Edit playbook</Link>
        </div>
      </div>
      {playbook.rules.length === 0 ? (
        <p className="text-sm text-text-muted">This playbook has no rules yet.</p>
      ) : (
        <ul className="space-y-2">
          {playbook.rules.map((rule) => (
            <li key={rule.id}>
              <label className="flex items-start gap-3 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checks[rule.id] === true}
                  onChange={(e) => {
                    const next = { ...checks, [rule.id]: e.target.checked };
                    setChecks(next);
                    save(next);
                  }}
                />
                <span>{rule.text}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
