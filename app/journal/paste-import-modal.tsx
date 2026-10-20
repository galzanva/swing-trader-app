'use client';

import { useEffect, useMemo, useState } from 'react';
import { entryClockLine, entryPriceLine, exitPriceLine } from '@/lib/journal-fills';

type PreviewTrade = {
  ticker: string;
  direction: 'long' | 'short';
  tradeType: 'intraday' | 'swing';
  entryDate: string;
  exitDate: string | null;
  entryTime: string | null;
  exitTime: string | null;
  exit2Time?: string | null;
  entryPrice: number;
  exitPrice: number | null;
  exit2Price?: number | null;
  fills?: { side: 'entry' | 'exit'; time: string; price: number }[] | null;
  qty: number | null;
  amount: number;
  profitLoss: number | null;
  strategy: string | null;
  strategyId: string | null;
  notes: string | null;
  exitReason: string | null;
  broker: string;
  fingerprint: string;
  duplicate: boolean;
};

type Broker = { slug: string; name: string };

export default function PasteImportModal({
  open,
  onClose,
  brokers,
  defaultBroker,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  brokers: Broker[];
  defaultBroker: string;
  onImported: () => void;
}) {
  const [text, setText] = useState('');
  const [broker, setBroker] = useState(defaultBroker);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parser, setParser] = useState<string | null>(null);
  const [trades, setTrades] = useState<PreviewTrade[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) setBroker(defaultBroker);
  }, [open, defaultBroker]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !importing) onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, importing, onClose]);

  const selectedTrades = useMemo(
    () => trades.filter((_, i) => selected.has(i) && !trades[i].duplicate),
    [trades, selected],
  );
  const selectedPnl = selectedTrades.reduce((s, t) => s + (t.profitLoss ?? 0), 0);

  const reset = () => {
    setText('');
    setError(null);
    setWarnings([]);
    setParser(null);
    setTrades([]);
    setSelected(new Set());
  };

  const handleParse = async () => {
    setParsing(true);
    setError(null);
    setWarnings([]);
    setTrades([]);
    setSelected(new Set());
    try {
      const res = await fetch('/api/journal/import/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, broker }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Parse failed');
        return;
      }
      setParser(data.parser);
      setWarnings(data.warnings || []);
      setTrades(data.trades || []);
      const next = new Set<number>();
      (data.trades || []).forEach((t: PreviewTrade, i: number) => {
        if (!t.duplicate) next.add(i);
      });
      setSelected(next);
      if (data.inferredBroker) setBroker(data.inferredBroker);
    } catch {
      setError('Failed to parse paste');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedTrades.length) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/journal/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker,
          trades: trades.map((t, i) => ({
            ...t,
            broker,
            skip: !selected.has(i),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Import failed');
        return;
      }
      onImported();
      reset();
      onClose();
      alert(`Imported ${data.created} trade${data.created === 1 ? '' : 's'}${data.skipped ? `, skipped ${data.skipped}` : ''}.`);
    } catch {
      setError('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const fmt = (n: number | null) => {
    if (n == null) return '—';
    return n >= 0 ? `$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/60" onClick={() => !importing && onClose()} />
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden bg-surface-1 border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="px-5 sm:px-6 py-4 border-b border-border flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Paste import</h2>
            <p className="text-sm text-text-muted mt-1">
              Paste a session dump, CSV, or pipe table. AI will sort messy notes; you confirm before anything is saved.
            </p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl leading-none" aria-label="Close">&times;</button>
        </div>

        <div className="px-5 sm:px-6 py-4 overflow-y-auto space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="text-sm text-text-muted sm:w-48 shrink-0">
              Account
              <select
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-base text-text-primary focus:outline-none focus:border-accent"
              >
                {brokers.map((b) => (
                  <option key={b.slug} value={b.slug}>{b.name}</option>
                ))}
              </select>
            </label>
            <p className="text-sm text-text-muted self-end pb-2">
              Detected account from the paste overrides this if it is obvious (Topstep Funded vs Eval).
            </p>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Date,Time In,Time Out,Symbol,Side,Entry,Exit,Qty,Fees,P&L,Strategy,...\nor\n=== MNQ — Mon Sep 28, 2026 (Topstep Funded) ===\nT1  10:02 Short  3c 30613.50>30623.50  -60.0'}
            className="w-full h-48 px-4 py-3 bg-surface-2 border border-border rounded-xl text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-y"
          />

          {error && <div className="text-sm text-loss bg-loss/10 border border-loss/30 rounded-xl px-4 py-3">{error}</div>}
          {warnings.length > 0 && (
            <div className="text-sm text-text-secondary bg-surface-2 border border-border rounded-xl px-4 py-3 space-y-1">
              {warnings.map((w, i) => <div key={i}>{w}</div>)}
            </div>
          )}

          {trades.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-text-muted">
                  {trades.length} parsed{parser ? ` · ${parser}` : ''} · {selectedTrades.length} selected · {fmt(selectedPnl)}
                </div>
                <button
                  type="button"
                  className="text-sm text-accent hover:underline"
                  onClick={() => {
                    if (selected.size === trades.filter((t) => !t.duplicate).length) setSelected(new Set());
                    else {
                      const next = new Set<number>();
                      trades.forEach((t, i) => { if (!t.duplicate) next.add(i); });
                      setSelected(next);
                    }
                  }}
                >
                  Toggle all new
                </button>
              </div>
              <div className="overflow-x-auto border border-border rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-muted uppercase tracking-wider text-xs bg-surface-2">
                      <th className="px-3 py-2 w-8" />
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Ticker</th>
                      <th className="px-3 py-2">Side</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Entry</th>
                      <th className="px-3 py-2 text-right">Exit</th>
                      <th className="px-3 py-2 text-right">P/L</th>
                      <th className="px-3 py-2">Setup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t, i) => (
                      <tr key={t.fingerprint + i} className={`border-t border-border ${t.duplicate ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            disabled={t.duplicate}
                            checked={selected.has(i)}
                            onChange={() => {
                              const next = new Set(selected);
                              if (next.has(i)) next.delete(i);
                              else next.add(i);
                              setSelected(next);
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 tabular-nums text-text-primary">{t.entryDate}</td>
                        <td className="px-3 py-2 tabular-nums text-text-secondary">{entryClockLine(t) || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-text-primary">{t.ticker}</td>
                        <td className={`px-3 py-2 ${t.direction === 'long' ? 'text-profit' : 'text-loss'}`}>{t.direction}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{t.qty ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{entryPriceLine(t.entryPrice, t).replace(/\$/g, '')}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{t.exitPrice == null ? '—' : exitPriceLine(t).replace(/\$/g, '')}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${(t.profitLoss ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(t.profitLoss)}</td>
                        <td className="px-3 py-2 text-text-secondary max-w-[160px] truncate" title={t.strategy || ''}>
                          {t.duplicate ? 'Already imported' : (t.strategy || '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-border flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            className="px-4 py-2.5 rounded-xl text-base text-text-secondary hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleParse}
            disabled={parsing || !text.trim()}
            className="px-5 py-2.5 rounded-xl text-base font-semibold bg-surface-2 border border-border text-text-primary hover:bg-surface-3 disabled:opacity-40"
          >
            {parsing ? 'Parsing...' : 'Parse paste'}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || selectedTrades.length === 0}
            className="px-5 py-2.5 rounded-xl text-base font-semibold bg-accent text-white hover:bg-accent-hover disabled:opacity-40"
          >
            {importing ? 'Importing...' : `Import ${selectedTrades.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}
