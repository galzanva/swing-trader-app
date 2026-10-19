'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlaybookDayCheck from '@/app/playbook/playbook-day-check';

type Section = { title: string; items: string[] };
type Strategy = { id: string; name: string; criteria: { checklist?: Section[]; entry_rules?: string[] } | null };
type Note = {
  id: string;
  date: string;
  time: string | null;
  strategyId: string | null;
  checks: string[];
  body: string;
};

function localYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowHm() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function sectionsOf(strategy: Strategy | undefined): Section[] {
  const checklist = strategy?.criteria?.checklist;
  if (Array.isArray(checklist)) {
    const sections = checklist.filter((s) => s && Array.isArray(s.items) && s.items.length);
    if (sections.length) return sections;
  }
  const entry = strategy?.criteria?.entry_rules;
  if (Array.isArray(entry) && entry.length) return [{ title: 'Entry', items: entry }];
  return [];
}

function asChecks(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

export function formatSessionNotes(date: string, notes: Note[], strategies: Strategy[]): string {
  const lines = [
    `Intraday session notes — ${date}`,
    'Live notes only. Not fills. Paste the actual entry, exit, time, qty, and P/L with this before writing journal rows.',
    '',
  ];
  const ordered = [...notes].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  if (!ordered.length) lines.push('(no notes)');
  for (const note of ordered) {
    const strategy = strategies.find((s) => s.id === note.strategyId);
    lines.push(`${note.time || '—'} · ${strategy?.name || 'No strategy'}`);
    const sections = sectionsOf(strategy);
    if (sections.length) {
      lines.push('Checklist:');
      for (const sec of sections) {
        if (sections.length > 1) lines.push(sec.title);
        for (const item of sec.items) {
          lines.push(`${note.checks.includes(item) ? '[x]' : '[ ]'} ${item}`);
        }
      }
    }
    lines.push('Thoughts / feelings:');
    lines.push(note.body.trim() || '(none)');
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

export default function SessionNotesClient() {
  const [date, setDate] = useState(localYmd);
  const [notes, setNotes] = useState<Note[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const saves = useRef(new Map<string, Promise<unknown>>());
  const bodyTimers = useRef(new Map<string, number>());

  const load = useCallback(async (day: string) => {
    setLoading(true);
    const [notesRes, stratRes] = await Promise.all([
      fetch(`/api/session-notes?date=${day}`).then((r) => r.json()),
      fetch('/api/strategies').then((r) => r.json()),
    ]);
    if (notesRes.success) {
      setNotes((notesRes.notes || []).map((n: Note) => ({ ...n, checks: asChecks(n.checks), body: n.body || '' })));
    }
    if (stratRes.success) setStrategies(stratRes.strategies || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(date); }, [date, load]);

  const patch = (id: string, data: Partial<Pick<Note, 'time' | 'strategyId' | 'checks' | 'body'>>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...data } : n)));
    const prev = saves.current.get(id) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(() =>
      fetch(`/api/session-notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    );
    saves.current.set(id, next);
  };

  const addNote = async () => {
    const res = await fetch('/api/session-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time: nowHm(), checks: [], body: '' }),
    });
    const data = await res.json();
    if (data.success) {
      const note = { ...data.note, checks: [] as string[], body: '' };
      setNotes((prev) => [note, ...prev]);
      requestAnimationFrame(() => {
        document.getElementById(`note-${note.id}`)?.scrollIntoView({ block: 'start' });
      });
    }
  };

  const remove = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/session-notes/${id}`, { method: 'DELETE' });
  };

  const copyText = useMemo(() => formatSessionNotes(date, notes, strategies), [date, notes, strategies]);

  const copyDay = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(copyText);
      ok = true;
    } catch {
      const area = document.createElement('textarea');
      area.value = copyText;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      ok = document.execCommand('copy');
      area.remove();
    }
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Session Notes</h1>
          <p className="text-text-muted text-sm max-w-2xl">
            Live scratch pad. Check the strategy conditions in front of you and write what you felt. Copy the day into Claude with the real fills, then paste the result into journal import.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 bg-surface-2 border border-border rounded-xl text-text-primary"
          />
          <button type="button" onClick={() => void copyDay()} className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-2">
            {copied ? 'Copied' : 'Copy day'}
          </button>
          <button type="button" onClick={() => void addNote()} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium">
            + Note
          </button>
        </div>
      </div>

      <PlaybookDayCheck date={date} />

      {loading && <p className="text-sm text-text-muted">Loading notes…</p>}
      {!loading && notes.length === 0 && (
        <p className="text-sm text-text-muted">No notes for this day. The newest one stays at the top.</p>
      )}

      <div className="space-y-4">
        {notes.map((note) => {
          const strategy = strategies.find((s) => s.id === note.strategyId);
          const sections = sectionsOf(strategy);
          return (
            <article id={`note-${note.id}`} key={note.id} className="bg-surface-1 border border-border rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="time"
                  value={note.time || ''}
                  onChange={(e) => void patch(note.id, { time: e.target.value })}
                  className="px-3 py-2 bg-surface-2 border border-border rounded-xl text-text-primary"
                />
                <select
                  value={note.strategyId || ''}
                  onChange={(e) => void patch(note.id, { strategyId: e.target.value || null, checks: [] })}
                  className="flex-1 min-w-[16rem] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text-primary"
                >
                  <option value="">No strategy</option>
                  {strategies.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => void remove(note.id)} className="text-sm text-loss hover:underline">
                  Delete
                </button>
              </div>

              {sections.length > 0 && (
                <div className="space-y-3">
                  {sections.map((sec) => (
                    <div key={sec.title}>
                      <div className="text-xs font-semibold text-text-secondary mb-1.5">{sec.title}</div>
                      <ul className="space-y-1.5">
                        {sec.items.map((item) => {
                          const on = note.checks.includes(item);
                          return (
                            <li key={item}>
                              <label className="flex items-start gap-2 text-sm text-text-secondary cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={on}
                                  onChange={() => {
                                    const checks = on ? note.checks.filter((c) => c !== item) : [...note.checks, item];
                                    void patch(note.id, { checks });
                                  }}
                                />
                                <span>{item}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              {note.strategyId && sections.length === 0 && (
                <p className="text-xs text-text-muted">This strategy has no checklist yet.</p>
              )}

              <textarea
                value={note.body}
                onChange={(e) => {
                  const body = e.target.value;
                  setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, body } : n)));
                  const pending = bodyTimers.current.get(note.id);
                  if (pending) window.clearTimeout(pending);
                  bodyTimers.current.set(note.id, window.setTimeout(() => patch(note.id, { body }), 400));
                }}
                onBlur={(e) => {
                  const pending = bodyTimers.current.get(note.id);
                  if (pending) window.clearTimeout(pending);
                  patch(note.id, { body: e.target.value });
                }}
                rows={3}
                placeholder="What did you see, and how did it feel?"
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-sm text-text-primary placeholder-text-muted"
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}
