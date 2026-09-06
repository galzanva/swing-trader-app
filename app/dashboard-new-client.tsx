'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Session } from 'next-auth';
import Link from 'next/link';
import DateRangeFilter, { DateRange, getDefault30DayRange } from '@/app/components/date-range-filter';
import { WinRateRing } from '@/app/components/charts';
import { formatJournalDateShort, todayInTimezone } from '@/lib/trade-dates';

interface Stats {
  totalTrades: number;
  winRate: number;
  totalPL: number;
  avgReturn: number;
  profitFactor: number;
  avgPL: number;
  wins: number;
  losses: number;
  avgWin: number;
  avgLoss: number;
  largestWin: { ticker: string; pnl: number; returnPct: number; date: string } | null;
  largestLoss: { ticker: string; pnl: number; returnPct: number; date: string } | null;
}

interface DailyBreakdown { date: string; pnl: number; trades: number; }

interface RecentTrade {
  id: string;
  ticker: string;
  direction: string;
  tradeType: string;
  entryDate: string;
  exitDate: string | null;
  exitTime: string | null;
  isOpen: boolean;
  returnPct: number | null;
  profitLoss: number | null;
}

const fmt = (n: number) => {
  const abs = Math.abs(n);
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(2)}`;
  return n >= 0 ? `+${s}` : `-${s}`;
};

const fmtShort = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1000) return n >= 0 ? `+$${(abs / 1000).toFixed(1)}k` : `-$${(abs / 1000).toFixed(1)}k`;
  return n >= 0 ? `+$${abs.toFixed(0)}` : `-$${abs.toFixed(0)}`;
};

export default function DashboardNewClient({ session }: { session: Session }) {
  const firstName = session.user?.name?.split(' ')[0] || 'Trader';
  const [stats, setStats] = useState<Stats | null>(null);
  const [dailyBreakdown, setDailyBreakdown] = useState<DailyBreakdown[]>([]);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState('America/New_York');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  useEffect(() => {
    fetch('/api/account/settings')
      .then(r => r.json())
      .then(d => {
        const tz = d.timezone || 'America/New_York';
        setTimezone(tz);
        setDateRange(getDefault30DayRange(tz));
      })
      .catch(() => setDateRange(getDefault30DayRange('America/New_York')));
  }, []);

  const fetchData = useCallback(async (range: DateRange) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetch(`/api/dashboard/stats?${params}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setDailyBreakdown(data.dailyBreakdown || []);
        setRecentTrades(data.recentTrades || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (dateRange) fetchData(dateRange);
  }, [dateRange, fetchData]);

  // Build week calendar: current week Mon–Sun anchored to the user's timezone "today".
  // Journal dates are stored as YYYY-MM-DDT00:00:00Z where the YYYY-MM-DD matches the
  // user's wall-clock date when the trade was entered. dailyBreakdown keys are the same
  // YYYY-MM-DD. So we use the user-tz "today" for week boundaries, and plain YYYY-MM-DD
  // strings for matching — no UTC/local mismatch.
  const weekDays = useMemo(() => {
    const todayStr = todayInTimezone(timezone);
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const todayDate = new Date(ty, tm - 1, td);
    const dow = todayDate.getDay(); // 0 Sun .. 6 Sat
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(ty, tm - 1, td + mondayOffset);

    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const daily = dailyBreakdown.find(db => db.date === dateStr);
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;
      days.push({
        dayName: dayNames[i],
        dayNum: d.getDate(),
        dateStr,
        pnl: daily?.pnl ?? 0,
        trades: daily?.trades ?? 0,
        isToday,
        isFuture,
      });
    }
    return days;
  }, [dailyBreakdown, timezone]);

  if (!dateRange) {
    return <div className="py-20 text-center"><div className="w-6 h-6 border-2 border-text-muted border-t-accent rounded-full animate-spin mx-auto" /></div>;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <DashHeader firstName={firstName} dateRange={dateRange} onDateChange={setDateRange} timezone={timezone} />
        <div className="py-20 text-center">
          <div className="w-6 h-6 border-2 border-text-muted border-t-accent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <DashHeader firstName={firstName} dateRange={dateRange} onDateChange={setDateRange} timezone={timezone} />
        <div className="py-20 text-center text-text-secondary">No data available for this period.</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 lg:space-y-10">
      <DashHeader firstName={firstName} dateRange={dateRange} onDateChange={setDateRange} timezone={timezone} />

      {/* Week Calendar */}
      <div className="bg-surface-1 border border-border rounded-2xl p-6 lg:p-8">
        <div className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-5">This Week</div>
        <div className="grid grid-cols-7 gap-3 lg:gap-4">
          {weekDays.map(d => (
            <div
              key={d.dateStr}
              className={`rounded-xl border-2 p-4 lg:p-5 min-h-[140px] flex flex-col justify-between text-center transition-colors ${
                d.isToday
                  ? 'border-accent/50 bg-accent/5'
                  : d.isFuture
                  ? 'border-border/50 opacity-40'
                  : 'border-border hover:border-border-hover'
              }`}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-3xl lg:text-4xl font-bold text-text-primary tabular-nums">{d.dayNum}</span>
                <span className="text-sm text-text-muted font-medium">{d.dayName}</span>
              </div>
              {d.trades > 0 ? (
                <>
                  <div className={`text-lg lg:text-xl font-bold tabular-nums ${d.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {fmtShort(d.pnl)}
                  </div>
                  <div className="text-sm text-text-muted">{d.trades} trade{d.trades !== 1 ? 's' : ''}</div>
                </>
              ) : (
                <>
                  <div className="text-lg text-text-muted">$0</div>
                  <div className="text-sm text-text-muted">0 trades</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-5">
        <StatCard label="Total Trades" value={stats.totalTrades.toString()} />
        <StatCard label="Win Rate" value={`${stats.winRate}%`} variant={stats.winRate >= 50 ? 'profit' : 'loss'} />
        <StatCard label="Total P/L" value={fmt(stats.totalPL)} variant={stats.totalPL >= 0 ? 'profit' : 'loss'} />
        <StatCard label="Profit Factor" value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor?.toFixed(2) ?? '0'} variant={stats.profitFactor >= 1 ? 'profit' : 'loss'} />
        <StatCard label="Avg P/L" value={fmt(stats.avgPL)} variant={stats.avgPL >= 0 ? 'profit' : 'loss'} />
      </div>

      {/* Win/Loss + Largest Win/Loss */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        {/* Winning vs Losing */}
        <div className="bg-surface-1 border border-border rounded-2xl p-6 lg:p-8 min-h-[280px] flex flex-col">
          <div className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Winning vs Losing</div>
          <div className="flex items-center justify-center flex-1 mb-4">
            <WinRateRing winRate={stats.winRate} size={120} />
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span className="text-profit">{stats.wins}W</span>
            <span className="text-loss">{stats.losses}L</span>
          </div>
          {stats.totalTrades > 0 && (
            <div className="mt-3 h-3 rounded-full bg-surface-3 overflow-hidden flex">
              <div className="bg-profit h-full" style={{ width: `${(stats.wins / stats.totalTrades) * 100}%` }} />
              <div className="bg-loss h-full" style={{ width: `${(stats.losses / stats.totalTrades) * 100}%` }} />
            </div>
          )}
        </div>

        {/* Avg Win vs Avg Loss */}
        <div className="bg-surface-1 border border-border rounded-2xl p-6 lg:p-8 min-h-[280px] flex flex-col justify-center">
          <div className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-6">Avg Win vs Avg Loss</div>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-base mb-2">
                <span className="text-text-secondary">Avg Win</span>
                <span className="text-profit font-bold text-lg tabular-nums">{fmt(stats.avgWin)}</span>
              </div>
              <div className="h-3 rounded-full bg-surface-3 overflow-hidden">
                <div className="bg-profit h-full rounded-full" style={{
                  width: `${stats.avgWin > 0 ? Math.min(100, (stats.avgWin / Math.max(stats.avgWin, Math.abs(stats.avgLoss))) * 100) : 0}%`
                }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-base mb-2">
                <span className="text-text-secondary">Avg Loss</span>
                <span className="text-loss font-bold text-lg tabular-nums">{fmt(stats.avgLoss)}</span>
              </div>
              <div className="h-3 rounded-full bg-surface-3 overflow-hidden">
                <div className="bg-loss h-full rounded-full" style={{
                  width: `${stats.avgLoss < 0 ? Math.min(100, (Math.abs(stats.avgLoss) / Math.max(stats.avgWin, Math.abs(stats.avgLoss))) * 100) : 0}%`
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Largest Winner */}
        <div className="bg-surface-1 border border-border rounded-2xl p-6 lg:p-8 min-h-[280px] flex flex-col justify-center">
          <div className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">Largest Winner</div>
          {stats.largestWin ? (
            <>
              <div className="text-4xl lg:text-5xl font-bold text-profit tabular-nums tracking-tight">{fmt(stats.largestWin.pnl)}</div>
              <div className="text-xl text-text-primary mt-3 font-semibold">{stats.largestWin.ticker}</div>
              <div className="text-base text-text-muted mt-2">{stats.largestWin.date} · {stats.largestWin.returnPct > 0 ? '+' : ''}{stats.largestWin.returnPct}%</div>
            </>
          ) : (
            <div className="text-lg text-text-muted mt-2">No winning trades</div>
          )}
        </div>

        {/* Largest Loser */}
        <div className="bg-surface-1 border border-border rounded-2xl p-6 lg:p-8 min-h-[280px] flex flex-col justify-center">
          <div className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">Largest Loser</div>
          {stats.largestLoss ? (
            <>
              <div className="text-4xl lg:text-5xl font-bold text-loss tabular-nums tracking-tight">{fmt(stats.largestLoss.pnl)}</div>
              <div className="text-xl text-text-primary mt-3 font-semibold">{stats.largestLoss.ticker}</div>
              <div className="text-base text-text-muted mt-2">{stats.largestLoss.date} · {stats.largestLoss.returnPct}%</div>
            </>
          ) : (
            <div className="text-lg text-text-muted mt-2">No losing trades</div>
          )}
        </div>
      </div>

      {/* Recent Trades — max 5 rows, no status column */}
      <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 lg:px-8 py-5 border-b border-border">
          <h2 className="text-lg lg:text-xl font-semibold text-text-primary">Recent Trades</h2>
          <Link href="/journal" className="text-sm font-medium text-accent hover:text-accent-hover transition-colors">
            View All
          </Link>
        </div>

        {recentTrades.length === 0 ? (
          <div className="px-6 lg:px-8 py-16 text-center">
            <p className="text-text-muted text-lg">No trades in this period</p>
            <Link href="/journal" className="inline-block mt-4 text-base font-medium text-accent hover:text-accent-hover transition-colors">
              Add your first trade
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="text-sm text-text-muted uppercase tracking-wider border-b border-border">
                  <th className="text-left px-6 lg:px-8 py-4 font-semibold">Ticker</th>
                  <th className="text-left px-6 lg:px-8 py-4 font-semibold">Side</th>
                  <th className="text-left px-6 lg:px-8 py-4 font-semibold">Entry</th>
                  <th className="text-left px-6 lg:px-8 py-4 font-semibold">Exit</th>
                  <th className="text-right px-6 lg:px-8 py-4 font-semibold">Return</th>
                  <th className="text-right px-6 lg:px-8 py-4 font-semibold">P&L</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map(t => (
                  <tr key={t.id} className="border-b border-border last:border-b-0 hover:bg-card-hover transition-colors">
                    <td className="px-6 lg:px-8 py-5 text-lg font-semibold text-text-primary">{t.ticker}</td>
                    <td className="px-6 lg:px-8 py-5">
                      <span className={`text-sm font-semibold px-3 py-1 rounded-lg ${
                        t.direction === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
                      }`}>{t.direction.toUpperCase()}</span>
                    </td>
                    <td className="px-6 lg:px-8 py-5 text-text-secondary text-lg">
                      {formatJournalDateShort(t.entryDate)}
                    </td>
                    <td className="px-6 lg:px-8 py-5 text-text-secondary text-lg">
                      {t.exitDate
                        ? `${formatJournalDateShort(t.exitDate)}${t.exitTime ? ' ' + t.exitTime : ''}`
                        : '—'}
                    </td>
                    <td className={`px-6 lg:px-8 py-5 text-right text-lg font-semibold tabular-nums ${
                      t.returnPct === null ? 'text-text-muted' : t.returnPct >= 0 ? 'text-profit' : 'text-loss'
                    }`}>
                      {t.returnPct !== null ? `${t.returnPct > 0 ? '+' : ''}${t.returnPct.toFixed(2)}%` : '—'}
                    </td>
                    <td className={`px-6 lg:px-8 py-5 text-right text-lg font-semibold tabular-nums ${
                      t.profitLoss === null ? 'text-text-muted' : t.profitLoss >= 0 ? 'text-profit' : 'text-loss'
                    }`}>
                      {t.profitLoss !== null ? fmt(t.profitLoss) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickAction href="/journal" label="Add Trade" />
        <QuickAction href="/webull-trades" label="Import Trades" />
        <QuickAction href="/analytics" label="View Analytics" />
        <QuickAction href="/technical-analysis" label="Run Analysis" />
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function DashHeader({ firstName, dateRange, onDateChange, timezone }: {
  firstName: string;
  dateRange: DateRange;
  onDateChange: (r: DateRange) => void;
  timezone: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold text-text-primary tracking-tight">Dashboard</h1>
        <p className="text-text-secondary text-lg mt-1">Welcome back, {firstName}</p>
      </div>
      <DateRangeFilter value={dateRange} onChange={onDateChange} timezone={timezone} />
    </div>
  );
}

function StatCard({ label, value, variant }: {
  label: string;
  value: string;
  variant?: 'profit' | 'loss';
}) {
  const color = variant === 'profit' ? 'text-profit' : variant === 'loss' ? 'text-loss' : 'text-text-primary';
  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-5 lg:p-6 min-h-[120px] flex flex-col justify-center">
      <div className="text-sm text-text-muted mb-2 font-medium uppercase tracking-wider">{label}</div>
      <div className={`text-2xl lg:text-3xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="bg-surface-1 border border-border rounded-2xl px-5 py-4 lg:py-5 hover:border-border-hover hover:bg-surface-2
                 transition-all flex items-center gap-4 group"
    >
      <span className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center text-text-muted shrink-0
                        group-hover:text-accent group-hover:bg-accent/10 transition-all">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </span>
      <span className="text-base lg:text-lg font-semibold text-text-primary">{label}</span>
    </Link>
  );
}
