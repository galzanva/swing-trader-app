'use client';

import { useCallback, useEffect, useState } from 'react';
import PlaybookDiscipline from './playbook-discipline';

type Strategy = { id: string; name: string };
type Rule = { id: string; text: string; sortOrder: number };
type Playbook = {
  id: string;
  name: string;
  tickers: string | null;
  isActive: boolean;
  rules: Rule[];
  strategies: { strategy: Strategy }[];
};

function localYmd() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function PlaybookClient() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Playbook | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [tickers, setTickers] = useState('');
  const [strategyIds, setStrategyIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(localYmd);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const [checkSaved, setCheckSaved] = useState<string | null>(null);

  const active = playbooks.find((p) => p.isActive) || null;

  const load = useCallback(async () => {
    const [pb, st] = await Promise.all([
      fetch('/api/playbooks').then((r) => r.json()),
      fetch('/api/strategies').then((r) => r.json()),
    ]);
    if (pb.success) setPlaybooks(pb.playbooks);
    if (st.success) setStrategies(st.strategies.map((s: Strategy) => ({ id: s.id, name: s.name })));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadCheckin = useCallback(async (playbookId: string, day: string) => {
    const res = await fetch(`/api/playbook-checkin?date=${day}&playbookId=${playbookId}`);
    const data = await res.json();
    setChecks(data.day?.checks || {});
    setNote(data.day?.note || '');
    setCheckSaved(data.day ? (data.day.followedAll ? 'Followed' : 'Missed') : null);
  }, []);

  useEffect(() => {
    if (!active) return;
    void loadCheckin(active.id, date);
  }, [active, date, loadCheckin]);

  const openNew = () => {
    setEditing(null);
    setName('');
    setRulesText('');
    setTickers('');
    setStrategyIds([]);
    setError('');
    setShowForm(true);
  };

  const openEdit = (p: Playbook) => {
    setEditing(p);
    setName(p.name);
    setRulesText(p.rules.map((r) => r.text).join('\n'));
    setTickers(p.tickers || '');
    setStrategyIds(p.strategies.map((s) => s.strategy.id));
    setError('');
    setShowForm(true);
  };

  const savePlaybook = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    const payload = {
      name: name.trim(),
      tickers,
      rules: rulesText.split('\n').map((l) => l.trim()).filter(Boolean),
      strategyIds,
      isActive: editing ? undefined : playbooks.length === 0,
    };
    const res = await fetch(editing ? `/api/playbooks/${editing.id}` : '/api/playbooks', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || 'Save failed'); return; }
    setShowForm(false);
    await load();
  };

  const activate = async (id: string) => {
    await fetch(`/api/playbooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activate: true }),
    });
    await load();
  };

  const remove = async (p: Playbook) => {
    if (!confirm(`Delete playbook "${p.name}"? Daily check-ins for it go away too.`)) return;
    await fetch(`/api/playbooks/${p.id}`, { method: 'DELETE' });
    await load();
  };

  const saveCheckin = async () => {
    if (!active) return;
    setSaving(true);
    const res = await fetch('/api/playbook-checkin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, playbookId: active.id, checks, note }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) setCheckSaved(data.followedAll ? 'Followed' : 'Missed');
  };

  const toggleStrategy = (id: string) => {
    setStrategyIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Playbook</h1>
          <p className="text-text-muted text-sm">
            One active playbook. Check its rules at the end of the day and see how that lines up with P/L.
          </p>
        </div>
        <button type="button" onClick={openNew} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg text-sm">
          + New playbook
        </button>
      </div>

      {active && (
        <div className="bg-surface-1 border border-border rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-accent">Active today</div>
              <h2 className="text-lg font-semibold text-text-primary">{active.name}</h2>
            </div>
            <label className="text-sm text-text-muted">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="ml-2 px-3 py-2 bg-surface-2 border border-border rounded-xl text-text-primary"
              />
            </label>
          </div>
          {active.rules.length === 0 ? (
            <p className="text-sm text-text-muted">Add rules to this playbook before checking in.</p>
          ) : (
            <ul className="space-y-2">
              {active.rules.map((r) => (
                <li key={r.id}>
                  <label className="flex items-start gap-3 text-sm text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checks[r.id] === true}
                      onChange={(e) => setChecks((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                    />
                    <span>{r.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Optional note for the day"
            className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-sm text-text-primary placeholder-text-muted"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving || active.rules.length === 0}
              onClick={() => void saveCheckin()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              {saving ? 'Saving…' : 'Save check-in'}
            </button>
            {checkSaved && (
              <span className={checkSaved === 'Followed' ? 'text-sm text-profit' : 'text-sm text-loss'}>
                {checkSaved === 'Followed' ? 'All rules followed' : 'A rule was missed'}
              </span>
            )}
          </div>
        </div>
      )}

      <PlaybookDiscipline playbookId={active?.id} />

      <div className="space-y-3">
        {loading && <p className="text-text-muted text-sm">Loading playbooks…</p>}
        {!loading && playbooks.length === 0 && (
          <p className="text-text-muted text-sm">No playbook yet. Create one and mark it active.</p>
        )}
        {playbooks.map((p) => (
          <div key={p.id} className="bg-surface-1 border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-text-primary">{p.name}</h3>
                  {p.isActive && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">ACTIVE</span>}
                </div>
                <p className="text-xs text-text-muted mt-1">
                  {p.rules.length} rule{p.rules.length === 1 ? '' : 's'}
                  {p.strategies.length ? ` · ${p.strategies.map((s) => s.strategy.name).join(', ')}` : ''}
                  {p.tickers ? ` · ${p.tickers}` : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {!p.isActive && (
                  <button type="button" onClick={() => void activate(p.id)} className="px-2.5 py-1.5 text-xs text-accent hover:bg-accent/10 rounded-lg">
                    Set active
                  </button>
                )}
                <button type="button" onClick={() => openEdit(p)} className="px-2.5 py-1.5 text-xs text-text-secondary hover:bg-surface-2 rounded-lg">
                  Edit
                </button>
                <button type="button" onClick={() => void remove(p)} className="px-2.5 py-1.5 text-xs text-loss hover:bg-loss/10 rounded-lg">
                  Delete
                </button>
              </div>
            </div>
            {p.rules.length > 0 && (
              <ul className="mt-3 space-y-1">
                {p.rules.map((r) => (
                  <li key={r.id} className="flex gap-2 text-sm text-text-secondary">
                    <span className="mt-1 w-3.5 h-3.5 shrink-0 rounded border border-border" />
                    {r.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[70]" onClick={() => setShowForm(false)} />
          <div className="fixed inset-0 z-[71] flex justify-end pointer-events-none">
            <aside className="pointer-events-auto h-full w-full sm:max-w-xl bg-surface-1 shadow-2xl flex flex-col sm:border-l border-border">
              <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary">{editing ? 'Edit playbook' : 'New playbook'}</h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-text-muted px-2">×</button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {error && <div className="text-sm text-loss">{error}</div>}
                <label className="block text-sm text-text-secondary">
                  Name
                  <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary" />
                </label>
                <label className="block text-sm text-text-secondary">
                  Rules <span className="text-text-muted">(one per line)</span>
                  <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} rows={8} className="mt-1 w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-sm" placeholder={'Only trade the open window\nStop is on the ticket before entry'} />
                </label>
                <div>
                  <div className="text-sm text-text-secondary mb-2">Strategies in this playbook</div>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-surface-2 p-2 space-y-1">
                    {strategies.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 px-2 py-1 text-sm text-text-secondary">
                        <input type="checkbox" checked={strategyIds.includes(s.id)} onChange={() => toggleStrategy(s.id)} />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="block text-sm text-text-secondary">
                  Tickers <span className="text-text-muted">(optional, comma separated)</span>
                  <input value={tickers} onChange={(e) => setTickers(e.target.value.toUpperCase())} placeholder="MESZ6, ESZ6" className="mt-1 w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary" />
                </label>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-text-secondary">Cancel</button>
                <button type="button" disabled={saving} onClick={() => void savePlaybook()} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
