'use client';

import { useState, useEffect, useMemo } from 'react';
import { Session } from 'next-auth';
import Link from 'next/link';

interface DashboardStats {
  totalTrades: number;
  winRate: number;
  avgReturn: string;
  totalPL: string;
  avgPL: string;
  todayActivity: number;
}

interface RecentTrade {
  id: string;
  ticker: string;
  direction: string;
  entryDate: string;
  isOpen: boolean;
  returnPct: number | null;
  profitLoss: number | null;
}

interface DashboardNewClientProps {
  session: Session;
}

export default function DashboardNewClient({ session }: DashboardNewClientProps) {
  const firstName = session.user?.name?.split(' ')[0] || 'Trader';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setRecentTrades(data.recentTrades);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const totalPL = useMemo(() => parseFloat(stats?.totalPL ?? '0'), [stats]);
  const avgReturn = useMemo(() => parseFloat(stats?.avgReturn ?? '0'), [stats]);

  const formatCurrency = (v: number) => {
    const abs = Math.abs(v);
    const formatted = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(2);
    return v >= 0 ? `$${formatted}` : `-$${formatted}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Welcome back, {firstName}
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Here&apos;s your trading performance overview
        </p>
      </div>

      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Trades"
            value={stats.totalTrades.toString()}
            sub={`${stats.todayActivity} today`}
          />
          <StatCard
            label="Win Rate"
            value={`${stats.winRate}%`}
            variant={stats.winRate >= 50 ? 'profit' : 'loss'}
          />
          <StatCard
            label="Total P&L"
            value={formatCurrency(totalPL)}
            variant={totalPL >= 0 ? 'profit' : 'loss'}
          />
          <StatCard
            label="Avg Return"
            value={`${avgReturn > 0 ? '+' : ''}${avgReturn}%`}
            sub={`Avg P&L: ${formatCurrency(parseFloat(stats.avgPL))}`}
            variant={avgReturn >= 0 ? 'profit' : 'loss'}
          />
        </div>
      )}

      {/* Recent Trades */}
      <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text-primary">Recent Trades</h2>
          <Link href="/journal" className="text-xs text-accent hover:text-accent-hover transition-colors">
            View All &rarr;
          </Link>
        </div>

        {recentTrades.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-text-muted text-sm">No trades yet</p>
            <Link
              href="/journal"
              className="inline-block mt-3 text-sm text-accent hover:text-accent-hover transition-colors"
            >
              Add your first trade &rarr;
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-text-muted uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Ticker</th>
                <th className="text-left px-5 py-3 font-medium">Side</th>
                <th className="text-left px-5 py-3 font-medium">Date</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-right px-5 py-3 font-medium">Return</th>
                <th className="text-right px-5 py-3 font-medium">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentTrades.map((trade) => (
                <tr key={trade.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-text-primary">{trade.ticker}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      trade.direction === 'long'
                        ? 'bg-profit/10 text-profit'
                        : 'bg-loss/10 text-loss'
                    }`}>
                      {trade.direction.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-text-secondary">
                    {new Date(trade.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium ${trade.isOpen ? 'text-accent' : 'text-text-muted'}`}>
                      {trade.isOpen ? 'Open' : 'Closed'}
                    </span>
                  </td>
                  <td className={`px-5 py-3 text-sm text-right font-medium ${
                    trade.returnPct === null ? 'text-text-muted' :
                    trade.returnPct >= 0 ? 'text-profit' : 'text-loss'
                  }`}>
                    {trade.returnPct !== null ? `${trade.returnPct > 0 ? '+' : ''}${trade.returnPct.toFixed(2)}%` : '—'}
                  </td>
                  <td className={`px-5 py-3 text-sm text-right font-medium ${
                    trade.profitLoss === null ? 'text-text-muted' :
                    trade.profitLoss >= 0 ? 'text-profit' : 'text-loss'
                  }`}>
                    {trade.profitLoss !== null ? formatCurrency(trade.profitLoss) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickAction href="/journal" label="Add Trade" icon="+" />
        <QuickAction href="/webull-trades" label="Import Trades" icon="↑" />
        <QuickAction href="/analytics" label="View Analytics" icon="≡" />
        <QuickAction href="/technical-analysis" label="Run Analysis" icon="⤴" />
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: 'profit' | 'loss';
}) {
  const valueColor =
    variant === 'profit' ? 'text-profit' :
    variant === 'loss' ? 'text-loss' :
    'text-text-primary';

  return (
    <div className="bg-surface-1 border border-border rounded-xl p-4">
      <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-semibold ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

function QuickAction({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="bg-surface-1 border border-border rounded-xl p-4 hover:border-border-hover hover:bg-surface-2
                 transition-all flex items-center gap-3 group"
    >
      <span className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center text-text-secondary
                        group-hover:text-accent group-hover:bg-accent/10 transition-all text-sm font-medium">
        {icon}
      </span>
      <span className="text-sm font-medium text-text-primary">{label}</span>
    </Link>
  );
}
