'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Trade, TradeDetail, OHLCBar } from './journal-types';
import { formatJournalStoredDate, nyseCalendarDateString } from '@/lib/trade-dates';

function formatSavedAt(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function formatMoney(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatVol(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

function formatMFloat(m: number | null | undefined) {
  if (m == null || Number.isNaN(m)) return '—';
  return `${m.toFixed(1)}M shares`;
}

function parseOHLC(raw: unknown): OHLCBar | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const num = (k: string) => {
    const v = o[k];
    return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
  };
  const ts = o.timestamp;
  const out: OHLCBar = {
    open: num('open'),
    high: num('high'),
    low: num('low'),
    close: num('close'),
    volume: num('volume'),
    timestamp: typeof ts === 'number' && !Number.isNaN(ts) ? ts : undefined,
  };
  if (out.open == null && out.high == null && out.low == null && out.close == null) return null;
  return out;
}

const EXIT_REASON_LABELS: Record<string, string> = {
  hit_target: 'Hit target',
  stopped_out: 'Stopped out',
  manual_exit: 'Manual exit',
  time_exit: 'Time-based exit',
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
  icon?: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-2 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-surface-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-2">
          {title}
        </h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border last:border-0 text-sm">
      <span className="text-text-muted shrink-0">{label}</span>
      <span className="text-text-primary font-medium text-right min-w-0 break-words">{value}</span>
    </div>
  );
}

function OHLCCard({ title, bar }: { title: string; bar: OHLCBar | null }) {
  if (!bar || (bar.open == null && bar.close == null)) {
    return (
      <div className="rounded-lg bg-surface-2 border border-border p-4 text-sm text-text-muted">
        {title}: no saved session data for this date (add trade with Polygon enrichment enabled, or run enrichment).
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-surface-2 border border-border p-4">
      <div className="mb-3">
        <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{title}</div>
        {bar.timestamp != null && (
          <div className="text-[10px] text-text-muted mt-1">
            Polygon session date (ET): {nyseCalendarDateString(bar.timestamp)}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-[10px] text-text-muted uppercase">Open</div>
          <div className="text-text-primary font-mono">{bar.open != null ? `$${bar.open.toFixed(2)}` : '—'}</div>
        </div>
        <div>
          <div className="text-[10px] text-text-muted uppercase">High</div>
          <div className="text-profit font-mono">{bar.high != null ? `$${bar.high.toFixed(2)}` : '—'}</div>
        </div>
        <div>
          <div className="text-[10px] text-text-muted uppercase">Low</div>
          <div className="text-loss font-mono">{bar.low != null ? `$${bar.low.toFixed(2)}` : '—'}</div>
        </div>
        <div>
          <div className="text-[10px] text-text-muted uppercase">Close</div>
          <div className="text-text-primary font-mono">{bar.close != null ? `$${bar.close.toFixed(2)}` : '—'}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-[10px] text-text-muted uppercase">Volume</div>
          <div className="text-text-secondary font-mono">{bar.volume != null ? formatVol(bar.volume) : '—'}</div>
        </div>
      </div>
    </div>
  );
}

function detailToTradeForEdit(d: TradeDetail): Trade {
  const iso = (v: string | Date) => (typeof v === 'string' ? v : new Date(v).toISOString());
  return {
    id: d.id,
    ticker: d.ticker,
    direction: d.direction,
    tradeType: d.tradeType,
    entryPrice: d.entryPrice,
    entryDate: iso(d.entryDate as string),
    exitPrice: d.exitPrice,
    exitDate: d.exitDate ? iso(d.exitDate as string) : null,
    entryTime: d.entryTime,
    exitTime: d.exitTime,
    amount: d.amount,
    strategy: d.strategy,
    notes: d.notes,
    isOpen: d.isOpen,
    exitReason: d.exitReason,
    returnPct: d.returnPct,
    rMultiple: d.rMultiple,
    holdingDays: d.holdingDays,
    profitLoss: d.profitLoss,
    maxPotentialR: d.maxPotentialR ?? null,
    strategyId: d.strategyId ?? null,
    analysisReportId: d.analysisReportId,
    source: d.source,
    externalOrderId: d.externalOrderId,
    createdAt: iso(d.createdAt as string),
    updatedAt: iso(d.updatedAt as string),
  };
}

export interface TradeDetailDrawerProps {
  tradeId: string | null;
  onClose: () => void;
  onEdit: (trade: Trade) => void;
  onDelete: (tradeId: string) => Promise<boolean>;
}

export default function TradeDetailDrawer({ tradeId, onClose, onEdit, onDelete }: TradeDetailDrawerProps) {
  const [detail, setDetail] = useState<TradeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const res = await fetch(`/api/journal/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not load trade');
        return;
      }
      setDetail(data.trade as TradeDetail);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!tradeId) {
      setDetail(null);
      setError(null);
      return;
    }
    void load(tradeId);
  }, [tradeId, load]);

  useEffect(() => {
    if (!tradeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [tradeId, onClose]);

  if (!tradeId) return null;

  const entryBar = detail ? parseOHLC(detail.entryOHLC) : null;
  const exitBar = detail ? parseOHLC(detail.exitOHLC) : null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[70] transition-opacity"
        aria-hidden
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-[71] w-full sm:max-w-lg bg-surface-1 shadow-2xl flex flex-col animate-slide-in sm:border-l border-border"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-drawer-title"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border bg-surface-2 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {loading ? (
                <div className="h-8 w-40 bg-surface-3 rounded animate-pulse" />
              ) : detail ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="trade-drawer-title" className="text-2xl font-bold text-text-primary tracking-tight font-mono">
                      {detail.ticker}
                    </h2>
                    <span
                      className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        detail.direction === 'long'
                          ? 'bg-profit/10 text-profit border border-profit/30'
                          : 'bg-loss/10 text-loss border border-loss/30'
                      }`}
                    >
                      {detail.direction.toUpperCase()}
                    </span>
                    <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-surface-3 text-text-secondary border border-border">
                      {detail.tradeType === 'intraday' ? 'INTRADAY' : 'SWING'}
                    </span>
                    {(detail.source || 'manual') === 'webull' && (
                      <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-surface-3 text-text-secondary border border-border">
                        WEBULL
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1.5">
                    {detail.isOpen ? 'Open position' : 'Closed trade'}
                    {detail.holdingDays != null && !detail.isOpen ? ` · ${detail.holdingDays}d hold` : ''}
                  </p>
                </>
              ) : (
                <h2 id="trade-drawer-title" className="text-lg font-semibold text-text-primary">
                  Trade details
                </h2>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-text-muted hover:text-text-primary p-2 rounded-lg hover:bg-surface-3 transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {detail && !detail.isOpen && detail.returnPct != null && (
            <div className="mt-4 flex flex-wrap gap-4">
              <div
                className={`rounded-xl px-4 py-3 min-w-[120px] border ${
                  (detail.profitLoss ?? 0) >= 0
                    ? 'bg-profit/10 border-profit/25'
                    : 'bg-loss/10 border-loss/25'
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider text-text-muted">P / L</div>
                <div
                  className={`text-xl font-bold tabular-nums ${
                    (detail.profitLoss ?? 0) >= 0 ? 'text-profit' : 'text-loss'
                  }`}
                >
                  {formatMoney(detail.profitLoss)}
                </div>
              </div>
              <div className="rounded-xl px-4 py-3 min-w-[100px] border border-border bg-surface-2">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Return</div>
                <div
                  className={`text-xl font-bold tabular-nums ${
                    detail.returnPct >= 0 ? 'text-profit' : 'text-loss'
                  }`}
                >
                  {detail.returnPct >= 0 ? '+' : ''}
                  {detail.returnPct.toFixed(2)}%
                </div>
              </div>
              {detail.rMultiple != null && (
                <div className="rounded-xl px-4 py-3 min-w-[80px] border border-border bg-surface-2">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">R</div>
                  <div className="text-xl font-bold text-text-primary tabular-nums">{detail.rMultiple.toFixed(2)}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 rounded-lg bg-surface-2 animate-pulse" />
              ))}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss">
              {error}
            </div>
          )}
          {detail && !loading && (
            <>
              <Section title="Execution">
                <Row label="Entry" value={`$${detail.entryPrice.toFixed(2)} · ${formatJournalStoredDate(detail.entryDate)}`} />
                {detail.entryTime && <Row label="Entry time" value={detail.entryTime} />}
                <Row
                  label="Exit"
                  value={
                    detail.exitPrice != null
                      ? `$${detail.exitPrice.toFixed(2)}${detail.exitDate ? ` · ${formatJournalStoredDate(detail.exitDate)}` : ''}`
                      : '—'
                  }
                />
                {detail.exitTime && <Row label="Exit time" value={detail.exitTime} />}
                <Row label="Size" value={formatMoney(detail.amount)} />
                <Row label="Strategy" value={detail.strategy || '—'} />
                {detail.exitReason && (
                  <Row label="Exit reason" value={EXIT_REASON_LABELS[detail.exitReason] || detail.exitReason} />
                )}
                {detail.maxPotentialR != null && (
                  <Row label="Max potential (R)" value={detail.maxPotentialR.toFixed(2)} />
                )}
              </Section>

              <Section title="Ticker snapshot">
                <Row label="Sector" value={detail.sector || '—'} />
                <Row label="Industry" value={detail.industry || '—'} />
                <Row label="Float" value={formatMFloat(detail.floatShares)} />
                <Row label="Shares out." value={formatMFloat(detail.sharesOutstanding)} />
                <Row
                  label="Market cap"
                  value={detail.marketCap != null ? `$${detail.marketCap.toFixed(1)}M` : '—'}
                />
                <Row label="Avg volume" value={detail.avgVolume != null ? formatVol(detail.avgVolume) : '—'} />
                <Row label="Short % of float" value={detail.shortPercent != null ? `${detail.shortPercent.toFixed(2)}%` : '—'} />
                <Row label="Beta" value={detail.beta != null ? detail.beta.toFixed(2) : '—'} />
              </Section>

              <Section title="Session OHLC (saved)">
                <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
                  Daily bars are saved as <span className="text-text-secondary">unadjusted</span> US session OHLC so levels align with broker prints; re-save the trade to refresh after a bad match.
                </p>
                <div className="space-y-3">
                  <OHLCCard title={`Entry day · ${formatJournalStoredDate(detail.entryDate)}`} bar={entryBar} />
                  {detail.exitDate && (
                    <OHLCCard title={`Exit day · ${formatJournalStoredDate(detail.exitDate)}`} bar={exitBar} />
                  )}
                </div>
              </Section>

              <Section title="Technicals (daily @ save)">
                {detail.exitDate &&
                  detail.entryDate.slice(0, 10) === detail.exitDate.slice(0, 10) && (
                    <p className="text-[11px] text-loss mb-3 rounded-lg border border-loss/25 bg-loss/10 px-3 py-2 leading-relaxed">
                      Same calendar day for entry and exit: we store <strong>one daily bar</strong> per date, so both columns use that bar&apos;s OHLC and the same end-of-day indicators (not your intraday exit time).
                    </p>
                  )}
                <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
                  EMA, RSI, and ATR use Polygon <span className="text-text-secondary">unadjusted</span> daily closes <strong>through</strong> each session (oldest → newest). After a huge day from a low base, EMAs can still sit <strong>below</strong> the last close because they weight many prior sessions. ATR(14) is a <strong>smoothed</strong> average of true range — often much smaller than that day&apos;s high−low spike.
                  {detail.tradeType === 'intraday' && (
                    <span> ATR % = ATR ÷ that session&apos;s daily close.</span>
                  )}{' '}
                  If rows show dashes, use <span className="text-accent">Refresh OHLC</span> on the journal page (refreshes trades matching your filters; needs Polygon).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg bg-surface-2 border border-border p-3">
                    <div className="text-xs font-semibold text-text-secondary mb-2">At entry</div>
                    <Row label="EMA 9 / 20 / 50" value={`${n(detail.entryEMA9)} / ${n(detail.entryEMA20)} / ${n(detail.entryEMA50)}`} />
                    <Row label="RSI" value={n(detail.entryRSI)} />
                    <Row label="ATR ($)" value={n(detail.entryATR)} />
                    <Row label="ATR % of day close" value={atrPctLabel(detail.entryATR, entryBar?.close)} />
                  </div>
                  <div className="rounded-lg bg-surface-2 border border-border p-3">
                    <div className="text-xs font-semibold text-text-secondary mb-2">At exit</div>
                    <Row label="EMA 9 / 20 / 50" value={`${n(detail.exitEMA9)} / ${n(detail.exitEMA20)} / ${n(detail.exitEMA50)}`} />
                    <Row label="RSI" value={n(detail.exitRSI)} />
                    <Row label="ATR ($)" value={n(detail.exitATR)} />
                    <Row label="ATR % of day close" value={atrPctLabel(detail.exitATR, exitBar?.close)} />
                  </div>
                </div>
              </Section>

              {(detail.source || 'manual') === 'webull' && (
                <Section title="Broker / import">
                  <Row label="Order type" value={detail.orderType || '—'} />
                  <Row label="Instrument" value={detail.instrumentType || '—'} />
                  <Row label="Filled qty" value={detail.filledQty != null ? String(detail.filledQty) : '—'} />
                  <Row label="Avg fill" value={detail.avgFillPrice != null ? `$${detail.avgFillPrice.toFixed(4)}` : '—'} />
                  {detail.externalOrderId && (
                    <Row label="External ID" value={<span className="font-mono text-[11px] break-all">{detail.externalOrderId}</span>} />
                  )}
                </Section>
              )}

              {detail.notes && (
                <Section title="Notes">
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{detail.notes}</p>
                </Section>
              )}

              <p className="text-[11px] text-text-muted text-center pt-2">
                Saved {formatSavedAt(detail.createdAt)}
                {detail.updatedAt !== detail.createdAt ? ` · Updated ${formatSavedAt(detail.updatedAt)}` : ''}
              </p>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-border bg-surface-2 px-5 py-4 space-y-3">
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-border text-text-secondary hover:bg-surface-3 text-sm font-medium transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              disabled={!detail || deleting}
              onClick={() => {
                if (!detail) return;
                onEdit(detailToTradeForEdit(detail));
              }}
              className="px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              Edit trade
            </button>
            <button
              type="button"
              disabled={!detail || deleting}
              onClick={async () => {
                if (!detail) return;
                setDeleting(true);
                const ok = await onDelete(detail.id);
                setDeleting(false);
                if (ok) onClose();
              }}
              className="px-4 py-2.5 rounded-lg bg-loss/90 hover:bg-loss disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function n(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toFixed(2);
}

/** ATR as % of session close (daily bar) — day-trading volatility context */
function atrPctLabel(atr: number | null | undefined, sessionClose: number | null | undefined) {
  if (atr == null || sessionClose == null || !Number.isFinite(atr) || !Number.isFinite(sessionClose) || sessionClose === 0) {
    return '—';
  }
  return `${((atr / sessionClose) * 100).toFixed(2)}%`;
}
