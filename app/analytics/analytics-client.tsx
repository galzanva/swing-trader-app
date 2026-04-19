'use client';

import { useState, useEffect } from 'react';

interface BucketStats {
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPL: number;
  avgPL: number;
  avgReturn: number;
  avgR: number | null;
  totalR: number | null;
}

interface CumulativePoint {
  date: string;
  ticker: string;
  pnl: number;
  cumulative: number;
}

interface Reports {
  overall: BucketStats;
  intraday: BucketStats;
  swing: BucketStats;
  byStrategy: BucketStats[];
  byTimeOfDay: BucketStats[];
  byPriceRange: BucketStats[];
  bySector: BucketStats[];
  byFloat: BucketStats[];
  byDayOfWeek: BucketStats[];
  byTicker: BucketStats[];
  cumulativePL: CumulativePoint[];
  enrichmentCoverage: {
    total: number;
    withSector: number;
    withFloat: number;
    sectorPercent: number;
    floatPercent: number;
  };
}

const fmt = (n: number) => n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const plColor = (n: number) => n > 0 ? 'text-profit' : n < 0 ? 'text-loss' : 'text-text-secondary';

function ReportTable({ title, data, showR = false }: { title: string; data: BucketStats[]; showR?: boolean }) {
  if (data.length === 0) return null;
  return (
    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs text-text-muted uppercase font-medium">Label</th>
              <th className="px-4 py-2 text-right text-xs text-text-muted uppercase font-medium">Trades</th>
              <th className="px-4 py-2 text-right text-xs text-text-muted uppercase font-medium">Win Rate</th>
              <th className="px-4 py-2 text-right text-xs text-text-muted uppercase font-medium">Total P/L</th>
              <th className="px-4 py-2 text-right text-xs text-text-muted uppercase font-medium">Avg P/L</th>
              <th className="px-4 py-2 text-right text-xs text-text-muted uppercase font-medium">Avg Return</th>
              {showR && <th className="px-4 py-2 text-right text-xs text-text-muted uppercase font-medium">Avg R</th>}
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={row.label} className="border-b border-border hover:bg-card-hover">
                <td className="px-4 py-2.5 text-text-primary font-medium">{row.label}</td>
                <td className="px-4 py-2.5 text-right text-text-secondary">
                  {row.trades}
                  <span className="text-text-muted text-xs ml-1">({row.wins}W/{row.losses}L)</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className={row.winRate >= 50 ? 'text-profit' : 'text-loss'}>
                    {row.winRate}%
                  </span>
                </td>
                <td className={`px-4 py-2.5 text-right font-medium ${plColor(row.totalPL)}`}>
                  {fmt(row.totalPL)}
                </td>
                <td className={`px-4 py-2.5 text-right ${plColor(row.avgPL)}`}>
                  {fmt(row.avgPL)}
                </td>
                <td className={`px-4 py-2.5 text-right ${plColor(row.avgReturn)}`}>
                  {fmtPct(row.avgReturn)}
                </td>
                {showR && (
                  <td className={`px-4 py-2.5 text-right ${row.avgR !== null ? plColor(row.avgR) : 'text-text-muted'}`}>
                    {row.avgR !== null ? `${row.avgR.toFixed(2)}R` : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-surface-1 border border-border rounded-xl p-4">
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className={`text-xl font-bold ${color || 'text-text-primary'}`}>{value}</div>
      {sub && <div className="text-xs text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AnalyticsClient() {
  const [reports, setReports] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState('');

  useEffect(() => {
    fetch('/api/journal/analytics')
      .then(r => r.json())
      .then(d => { if (d.success && d.reports) setReports(d.reports); })
      .finally(() => setLoading(false));
  }, []);

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichMsg('');
    try {
      const res = await fetch('/api/journal/enrich', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (data.message) setEnrichMsg(data.message);
        else setEnrichMsg(`Updated ${data.summary.enriched} trade row(s) across ${data.summary.uniqueTickers} ticker(s)`);
        const r = await fetch('/api/journal/analytics');
        const d = await r.json();
        if (d.success && d.reports) setReports(d.reports);
      } else {
        setEnrichMsg(data.error || 'Enrichment failed');
      }
    } catch { setEnrichMsg('Network error'); }
    setEnriching(false);
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-text-secondary">Loading analytics...</div>
    );
  }

  if (!reports) {
    return (
      <div className="py-20 text-center text-text-secondary">
        <p>No closed trades to analyze yet.</p>
        <p className="text-text-muted text-sm mt-1">Close some trades and come back!</p>
      </div>
    );
  }

  const o = reports.overall;
  const bestStrategy = reports.byStrategy.length > 0 ? reports.byStrategy[0] : null;
  const worstStrategy = reports.byStrategy.length > 1
    ? reports.byStrategy[reports.byStrategy.length - 1]
    : null;
  const bestTime = reports.byTimeOfDay.reduce((best, cur) =>
    cur.totalPL > (best?.totalPL ?? -Infinity) ? cur : best, reports.byTimeOfDay[0]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Trade Analytics</h1>
          <p className="text-text-muted text-sm">
            Performance breakdown across {o.trades} closed trades
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {reports.enrichmentCoverage.floatPercent < 100 && (
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {enriching
                ? 'Enriching...'
                : `Enrich tickers (float ${reports.enrichmentCoverage.floatPercent}% · sector ${reports.enrichmentCoverage.sectorPercent}%)`}
            </button>
          )}
          <p className="text-[10px] text-text-muted max-w-xs text-right">
            Float bands use Finnhub shares outstanding (millions). Short interest is not loaded (no Polygon).
          </p>
        </div>
      </div>

      {enrichMsg && (
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm text-accent mb-4">{enrichMsg}</div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total P/L" value={fmt(o.totalPL)} color={plColor(o.totalPL)} />
        <StatCard label="Win Rate" value={`${o.winRate}%`} sub={`${o.wins}W / ${o.losses}L`} color={o.winRate >= 50 ? 'text-profit' : 'text-loss'} />
        <StatCard label="Avg P/L" value={fmt(o.avgPL)} color={plColor(o.avgPL)} />
        <StatCard label="Avg Return" value={fmtPct(o.avgReturn)} color={plColor(o.avgReturn)} />
        <StatCard label="Total Trades" value={`${o.trades}`} sub={`${reports.intraday.trades} day / ${reports.swing.trades} swing`} />
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {bestStrategy && (
          <div className="bg-profit/10 border border-profit/20 rounded-xl p-4">
            <div className="text-xs text-profit/60 mb-1">Best Strategy</div>
            <div className="text-lg font-bold text-profit">{bestStrategy.label}</div>
            <div className="text-xs text-profit/60 mt-0.5">
              {fmt(bestStrategy.totalPL)} · {bestStrategy.winRate}% WR · {bestStrategy.trades} trades
            </div>
          </div>
        )}
        {worstStrategy && worstStrategy.totalPL < 0 && (
          <div className="bg-loss/10 border border-loss/20 rounded-xl p-4">
            <div className="text-xs text-loss/60 mb-1">Worst Strategy</div>
            <div className="text-lg font-bold text-loss">{worstStrategy.label}</div>
            <div className="text-xs text-loss/60 mt-0.5">
              {fmt(worstStrategy.totalPL)} · {worstStrategy.winRate}% WR · {worstStrategy.trades} trades
            </div>
          </div>
        )}
        {bestTime && (
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
            <div className="text-xs text-accent/60 mb-1">Best Time of Day</div>
            <div className="text-lg font-bold text-accent">{bestTime.label}</div>
            <div className="text-xs text-accent/60 mt-0.5">
              {fmt(bestTime.totalPL)} · {bestTime.winRate}% WR · {bestTime.trades} trades
            </div>
          </div>
        )}
      </div>

      {/* Intraday vs Swing */}
      <ReportTable title="Day Trade vs Swing" data={[reports.intraday, reports.swing].filter(d => d.trades > 0)} />

      {/* By Strategy */}
      <ReportTable title="By Strategy" data={reports.byStrategy} />

      {/* By Time of Day */}
      {reports.byTimeOfDay.length > 0 && (
        <ReportTable title="By Time of Day (Entry)" data={reports.byTimeOfDay} />
      )}

      {/* Two-column layout for smaller reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportTable title="By Price Range" data={reports.byPriceRange} showR={false} />
        <ReportTable title="By Day of Week" data={reports.byDayOfWeek} showR={false} />
        <ReportTable title="By Sector" data={reports.bySector} showR={false} />
        <ReportTable title="By Float Size" data={reports.byFloat} showR={false} />
        <ReportTable title="Top Tickers (by frequency)" data={reports.byTicker} />
      </div>

      {/* Cumulative P/L */}
      {reports.cumulativePL.length > 0 && (
        <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Cumulative P/L Over Time</h3>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-[2px] h-40 overflow-x-auto">
              {(() => {
                const pts = reports.cumulativePL;
                const max = Math.max(...pts.map(p => Math.abs(p.cumulative)), 1);
                const midY = 80;
                return pts.map((p, i) => {
                  const barH = Math.abs(p.cumulative / max) * midY;
                  const isPos = p.cumulative >= 0;
                  return (
                    <div key={i} className="flex flex-col items-center justify-end relative group" style={{ minWidth: '4px', height: '160px' }}>
                      <div
                        className={`w-1 rounded-sm ${isPos ? 'bg-profit/70' : 'bg-loss/70'}`}
                        style={{
                          height: `${barH}px`,
                          position: 'absolute',
                          bottom: isPos ? `${midY}px` : `${midY - barH}px`,
                        }}
                      />
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-surface-4 text-xs text-text-primary px-2 py-1 rounded whitespace-nowrap z-10">
                        {p.date} {p.ticker}: {fmt(p.pnl)} (cum: {fmt(p.cumulative)})
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="flex justify-between text-[10px] text-text-muted mt-1 px-1">
              <span>{reports.cumulativePL[0]?.date}</span>
              <span>{reports.cumulativePL[reports.cumulativePL.length - 1]?.date}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
