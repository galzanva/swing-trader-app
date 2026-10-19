'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { todayInTimezone } from '@/lib/trade-dates';

type Section = { items?: string[] };
type Note = {
  id: string;
  time: string | null;
  body: string;
  checks: unknown;
  strategy: { name: string; criteria: { checklist?: Section[]; entry_rules?: string[] } | null } | null;
};

function checklistSize(criteria: Note['strategy'] extends null ? never : NonNullable<Note['strategy']>['criteria']): number {
  if (!criteria) return 0;
  const sections = criteria.checklist;
  if (Array.isArray(sections)) {
    const count = sections.reduce((sum, section) => sum + (Array.isArray(section?.items) ? section.items.length : 0), 0);
    if (count) return count;
  }
  return Array.isArray(criteria.entry_rules) ? criteria.entry_rules.length : 0;
}

function checkCount(raw: unknown): number {
  return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string').length : 0;
}

export default function SessionSummary({ timezone }: { timezone: string }) {
  const [date, setDate] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void fetch('/api/session-notes?recent=1')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setDate(d.date || null);
          setNotes(d.notes || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const today = todayInTimezone(timezone);
  const isToday = date === today;
  const title = !date ? 'Session' : isToday ? "Today's session" : 'Latest session';

  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          {date && !isToday && <p className="text-xs text-text-muted mt-1">{date}</p>}
        </div>
        <Link href="/session-notes" className="text-sm text-accent hover:underline shrink-0">Open</Link>
      </div>
      {!loaded && <p className="text-sm text-text-muted">Loading session…</p>}
      {loaded && notes.length === 0 && (
        <p className="text-sm text-text-muted">No session notes yet.</p>
      )}
      {notes.length > 0 && (
        <ul className="space-y-3">
          {notes.slice(0, 4).map((note) => {
            const total = checklistSize(note.strategy?.criteria ?? null);
            const met = checkCount(note.checks);
            const feeling = (note.body || '').trim();
            return (
              <li key={note.id} className="text-sm">
                <div className="text-text-primary">
                  <span className="tabular-nums text-text-muted">{note.time || '—'}</span>
                  {' · '}
                  {note.strategy?.name || 'No strategy'}
                  {total > 0 && <span className="text-text-muted"> · {met}/{total}</span>}
                </div>
                {feeling && <p className="text-text-secondary mt-0.5 line-clamp-2">{feeling}</p>}
              </li>
            );
          })}
          {notes.length > 4 && (
            <li className="text-xs text-text-muted">{notes.length - 4} more in this session</li>
          )}
        </ul>
      )}
    </div>
  );
}
