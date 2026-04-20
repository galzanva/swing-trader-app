'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import DateRangeFilter, { DateRange, getDefaultAllTimeRange } from '@/app/components/date-range-filter';
import { HBarChart, VBarChart, LineChart, WinRateRing } from '@/app/components/charts';

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

interface DailyPL { date: string; pnl: number; }
interface CumulativePoint { date: string; ticker: string; pnl: number; cumulative: number; }

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
  byDirection: BucketStats[];
  byHoldingPeriod: BucketStats[];
  byTicker: BucketStats[];
  cumulativePL: CumulativePoint[];
  dailyPL: DailyPL[];
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

type SortDir = 'asc' | 'desc';
type SortCol = 'label' | 'trades' | 'winRate' | 'totalPL' | 'avgPL' | 'avgReturn' | 'avgR';

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-block ml-1 transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
      {dir === 'desc' ? '↓' : '↑'}
    </span>
  );
}

function ReportTable({ title, data, showR = false }: {
  title: string;
  data: BucketStats[];
  showR?: boolean;
}) {
  const [sortCol, setSortCol] = useState<SortCol>('totalPL');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir(col === 'label' ? 'asc' : 'desc');
    }
  };

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;

      if (sortCol === 'label') {
        av = a.label.toLowerCase();
        bv = b.label.toLowerCase();
      } else if (sortCol === 'avgR') {
        av = a.avgR ?? -Infinity;
        bv = b.avgR ?? -Infinity;
      } else {
        av = a[sortCol];
        bv = b[sortCol];
      }

      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [data, sortCol, sortDir]);

  if (data.length === 0) return null;

  const cols: { key: SortCol; label: string; align: 'left' | 'right' }[] = [
    { key: 'label', label: 'Category', align: 'left' },
    { key: 'trades', label: 'Trades', align: 'right' },
    { key: 'winRate', label: 'Win Rate', align: 'right' },
    { key: 'totalPL', label: 'Total P/L', align: 'right' },
    { key: 'avgPL', label: 'Avg P/L', align: 'right' },
    { key: 'avgReturn', label: 'Avg Return', align: 'right' },
    ...(showR ? [{ key: 'avgR' as SortCol, label: 'Avg R', align: 'right' as const }] : []),
  ];

  return (
    <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
      <div className="px-6 lg:px-8 py-4 lg:py-5 border-b border-border">
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr>
              {cols.map(c => (
                <th
                  key={c.key}
                  className={`group px-5 lg:px-6 py-4 text-sm text-text-muted uppercase tracking-wider font-semibold cursor-pointer select-none hover:text-text-secondary transition-colors ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  onClick={() => handleSort(c.key)}
                >
                  {c.label}
                  <SortArrow active={sortCol === c.key} dir={sortCol === c.key ? sortDir : 'desc'} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={row.label} className="border-b border-border last:border-b-0 hover:bg-card-hover transition-colors">
                <td className="px-5 lg:px-6 py-4 text-text-primary font-semibold text-lg">{row.label}</td>
                <td className="px-5 lg:px-6 py-4 text-right text-text-secondary">
                  {row.trades}
                  <span className="text-text-muted text-sm ml-1.5">({row.wins}W/{row.losses}L)</span>
                </td>
                <td className="px-5 lg:px-6 py-4 text-right tabular-nums">
                  <span className={`font-semibold ${row.winRate >= 50 ? 'text-profit' : 'text-loss'}`}>{row.winRate}%</span>
                </td>
                <td className={`px-5 lg:px-6 py-4 text-right font-semibold tabular-nums ${plColor(row.totalPL)}`}>{fmt(row.totalPL)}</td>
                <td className={`px-5 lg:px-6 py-4 text-right tabular-nums ${plColor(row.avgPL)}`}>{fmt(row.avgPL)}</td>
                <td className={`px-5 lg:px-6 py-4 text-right tabular-nums ${plColor(row.avgReturn)}`}>{fmtPct(row.avgReturn)}</td>
                {showR && (
                  <td className={`px-5 lg:px-6 py-4 text-right tabular-nums ${row.avgR !== null ? plColor(row.avgR) : 'text-text-muted'}`}>
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
    <div className="bg-surface-1 border border-border rounded-2xl p-5 lg:p-6 min-h-[112px] flex flex-col justify-center">
      <div className="text-sm text-text-muted mb-2 font-medium uppercase tracking-wider">{label}</div>
      <div className={`text-2xl lg:text-3xl font-bold tabular-nums ${color || 'text-text-primary'}`}>{value}</div>
      {sub && <div className="text-sm text-text-muted mt-1.5">{sub}</div>}
    </div>
  );
}

function InsightCard({ label, title, detail, variant }: {
  label: string;
  title: string;
  detail: string;
  variant: 'profit' | 'loss' | 'accent';
}) {
  const styles = {
    profit: 'bg-profit/10 border-profit/20 text-profit',
    loss: 'bg-loss/10 border-loss/20 text-loss',
    accent: 'bg-accent/10 border-accent/20 text-accent',
  };
  return (
    <div className={`border rounded-2xl p-5 lg:p-6 min-h-[120px] flex flex-col justify-center ${styles[variant]}`}>
      <div className="text-sm font-medium opacity-80 mb-2 uppercase tracking-wider">{label}</div>
      <div className="text-xl lg:text-2xl font-bold leading-tight">{title}</div>
      <div className="text-sm opacity-80 mt-2 leading-snug">{detail}</div>
    </div>
  );
}

type ViewTab = 'overview' | 'breakdown' | 'charts';

export default function AnalyticsClient() {
  const [reports, setReports] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [tab, setTab] = useState<ViewTab>('overview');

  useEffect(() => {
    fetch('/api/account/settings')
      .then(r => r.json())
      .then(d => {
        const tz = d.timezone || 'America/New_York';
        setTimezone(tz);
        setDateRange(getDefaultAllTimeRange(tz));
      })
      .catch(() => {
        setDateRange(getDefaultAllTimeRange('America/New_York'));
      });
  }, []);

  const fetchAnalytics = useCallback(async (range: DateRange, tz: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to, tz });
      const res = await fetch(`/api/journal/analytics?${params}`);
      const d = await res.json();
      if (d.success && d.reports) setReports(d.reports);
      else setReports(null);
    } catch {
      setReports(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dateRange) fetchAnalytics(dateRange, timezone);
  }, [dateRange, timezone, fetchAnalytics]);

  const handleDateChange = (range: DateRange) => setDateRange(range);

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichMsg('');
    try {
      const res = await fetch('/api/journal/enrich', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setEnrichMsg(data.message || `Updated ${data.summary?.enriched || 0} trade(s)`);
        if (dateRange) fetchAnalytics(dateRange, timezone);
      } else {
        setEnrichMsg(data.error || 'Enrichment failed');
      }
    } catch { setEnrichMsg('Network error'); }
    setEnriching(false);
  };

  // Aggregate cumulative PL by day (last point per day)
  const cumulativeByDay = useMemo(() => {
    if (!reports?.cumulativePL?.length) return [];
    const dayMap = new Map<string, CumulativePoint>();
    for (const p of reports.cumulativePL) {
      dayMap.set(p.date, p);
    }
    return [...dayMap.values()];
  }, [reports]);

  const cumulativeLineData = useMemo(() =>
    cumulativeByDay.map(p => ({
      label: p.date,
      value: p.cumulative,
      detail: `${p.ticker}: ${fmt(p.pnl)}`,
    })),
  [cumulativeByDay]);

  const dailyChartData = useMemo(() =>
    (reports?.dailyPL || []).map(p => ({
      label: p.date,
      value: p.pnl,
      tooltip: `${p.date}: ${fmt(p.pnl)}`,
    })),
  [reports]);

  // Chart data for horizontal bars
  const strategyChartData = useMemo(() =>
    (reports?.byStrategy || []).map(s => ({ label: s.label, value: s.totalPL, extra: `${s.winRate}% WR` })),
  [reports]);
  const timeOfDayChart = useMemo(() =>
    (reports?.byTimeOfDay || []).map(s => ({ label: s.label, value: s.totalPL, extra: `${s.trades} trades` })),
  [reports]);
  const dayOfWeekChart = useMemo(() =>
    (reports?.byDayOfWeek || []).map(s => ({ label: s.label, value: s.totalPL, extra: `${s.winRate}% WR` })),
  [reports]);
  const floatChart = useMemo(() =>
    (reports?.byFloat || []).filter(s => s.label !== 'Unknown').map(s => ({ label: s.label, value: s.totalPL, extra: `${s.trades} trades` })),
  [reports]);
  const priceRangeChart = useMemo(() =>
    (reports?.byPriceRange || []).map(s => ({ label: s.label, value: s.totalPL, extra: `${s.trades} trades` })),
  [reports]);
  const holdingChart = useMemo(() =>
    (reports?.byHoldingPeriod || []).filter(s => s.label !== 'Unknown').map(s => ({ label: s.label, value: s.totalPL, extra: `${s.trades} trades` })),
  [reports]);

  if (!dateRange) {
    return <div className="py-20 text-center text-text-secondary text-lg">Loading...</div>;
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader dateRange={dateRange} onDateChange={handleDateChange} timezone={timezone} tab={tab} onTabChange={setTab} />
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-text-muted border-t-accent rounded-full animate-spin mx-auto" />
          <p className="text-text-muted text-base mt-4">Analyzing trades...</p>
        </div>
      </div>
    );
  }

  if (!reports) {
    return (
      <div className="space-y-8">
        <PageHeader dateRange={dateRange} onDateChange={handleDateChange} timezone={timezone} tab={tab} onTabChange={setTab} />
        <div className="py-20 text-center px-4">
          <p className="text-text-secondary text-lg">No closed trades found in selected range.</p>
          <p className="text-text-muted text-base mt-2">Try expanding your date range or close some trades first.</p>
        </div>
      </div>
    );
  }

  const o = reports.overall;
  const bestStrategy = reports.byStrategy.length > 0 ? reports.byStrategy[0] : null;
  const worstStrategy = reports.byStrategy.length > 1 ? reports.byStrategy[reports.byStrategy.length - 1] : null;
  const bestTime = reports.byTimeOfDay.reduce((best, cur) =>
    cur.totalPL > (best?.totalPL ?? -Infinity) ? cur : best, reports.byTimeOfDay[0]);
  const bestDay = reports.byDayOfWeek.reduce((best, cur) =>
    cur.totalPL > (best?.totalPL ?? -Infinity) ? cur : best, reports.byDayOfWeek[0]);

  return (
    <div className="space-y-8 lg:space-y-10">
      <PageHeader
        dateRange={dateRange}
        onDateChange={handleDateChange}
        timezone={timezone}
        tab={tab}
        onTabChange={setTab}
        enrichCoverage={reports.enrichmentCoverage}
        onEnrich={handleEnrich}
        enriching={enriching}
      />

      {enrichMsg && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 text-base text-accent">{enrichMsg}</div>
      )}

      {tab === 'overview' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-5">
            <StatCard label="Total P/L" value={fmt(o.totalPL)} color={plColor(o.totalPL)} />
            <StatCard label="Win Rate" value={`${o.winRate}%`} sub={`${o.wins}W / ${o.losses}L`} color={o.winRate >= 50 ? 'text-profit' : 'text-loss'} />
            <StatCard label="Avg P/L" value={fmt(o.avgPL)} color={plColor(o.avgPL)} />
            <StatCard label="Avg Return" value={fmtPct(o.avgReturn)} color={plColor(o.avgReturn)} />
            <StatCard label="Total Trades" value={`${o.trades}`} sub={`${reports.intraday.trades} day / ${reports.swing.trades} swing`} />
            <StatCard
              label="Profit Factor"
              value={(() => {
                const gp = reports.cumulativePL.reduce((s, p) => s + (p.pnl > 0 ? p.pnl : 0), 0);
                const gl = Math.abs(reports.cumulativePL.reduce((s, p) => s + (p.pnl < 0 ? p.pnl : 0), 0));
                return gl > 0 ? (gp / gl).toFixed(2) : '∞';
              })()}
              color="text-text-primary"
            />
          </div>

          {/* Key Insights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            {bestStrategy && bestStrategy.totalPL > 0 && (
              <InsightCard label="Best Strategy" title={bestStrategy.label}
                detail={`${fmt(bestStrategy.totalPL)} · ${bestStrategy.winRate}% WR · ${bestStrategy.trades} trades`} variant="profit" />
            )}
            {worstStrategy && worstStrategy.totalPL < 0 && (
              <InsightCard label="Worst Strategy" title={worstStrategy.label}
                detail={`${fmt(worstStrategy.totalPL)} · ${worstStrategy.winRate}% WR · ${worstStrategy.trades} trades`} variant="loss" />
            )}
            {bestTime && bestTime.trades > 0 && (
              <InsightCard label="Best Time of Day" title={bestTime.label}
                detail={`${fmt(bestTime.totalPL)} · ${bestTime.winRate}% WR · ${bestTime.trades} trades`} variant="accent" />
            )}
            {bestDay && bestDay.trades > 0 && (
              <InsightCard label="Best Day of Week" title={bestDay.label}
                detail={`${fmt(bestDay.totalPL)} · ${bestDay.winRate}% WR · ${bestDay.trades} trades`} variant="accent" />
            )}
          </div>

          {/* Win Rate + Day vs Swing */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
            <div className="bg-surface-1 border border-border rounded-2xl p-8 lg:p-10 flex flex-col items-center justify-center min-h-[260px]">
              <WinRateRing winRate={o.winRate} size={120} />
              <p className="text-sm font-medium text-text-secondary uppercase tracking-wider mt-5">Overall Win Rate</p>
            </div>
            <div className="lg:col-span-2">
              <ReportTable title="Day Trade vs Swing" data={[reports.intraday, reports.swing].filter(d => d.trades > 0)} />
            </div>
          </div>

          {/* Cumulative P/L — line chart */}
          <LineChart
            data={cumulativeLineData}
            title="Cumulative P/L Over Time"
            height={280}
            valueFormatter={fmt}
          />

          {/* Daily P/L — bar chart */}
          <VBarChart data={dailyChartData} title="Daily P/L" height={240} />
        </>
      )}

      {tab === 'breakdown' && (
        <>
          <ReportTable title="By Strategy" data={reports.byStrategy} showR />
          {reports.byDirection.length > 0 && <ReportTable title="Long vs Short" data={reports.byDirection} />}
          {reports.byTimeOfDay.length > 0 && <ReportTable title="By Time of Day (Intraday)" data={reports.byTimeOfDay} />}
          <ReportTable title="By Day of Week" data={reports.byDayOfWeek} />
          {reports.byHoldingPeriod.length > 0 && <ReportTable title="By Holding Period" data={reports.byHoldingPeriod} />}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            <ReportTable title="By Price Range" data={reports.byPriceRange} />
            <ReportTable title="By Float Size" data={reports.byFloat} />
            <ReportTable title="By Sector" data={reports.bySector} />
            <ReportTable title="Top Tickers" data={reports.byTicker} showR />
          </div>
        </>
      )}

      {tab === 'charts' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            <HBarChart data={strategyChartData} title="P/L by Strategy" valueFormatter={fmt} />
            <HBarChart data={dayOfWeekChart} title="P/L by Day of Week" valueFormatter={fmt} />
            {timeOfDayChart.length > 0 && <HBarChart data={timeOfDayChart} title="P/L by Time of Day" valueFormatter={fmt} />}
            <HBarChart data={priceRangeChart} title="P/L by Price Range" valueFormatter={fmt} />
            {floatChart.length > 0 && <HBarChart data={floatChart} title="P/L by Float Size" valueFormatter={fmt} />}
            {holdingChart.length > 0 && <HBarChart data={holdingChart} title="P/L by Holding Period" valueFormatter={fmt} />}
          </div>
          <LineChart data={cumulativeLineData} title="Cumulative P/L Over Time" height={300} valueFormatter={fmt} />
          <VBarChart data={dailyChartData} title="Daily P/L" height={260} />
        </>
      )}
    </div>
  );
}

/* ── Page Header ───────────────────────────────────────────────── */

function PageHeader({ dateRange, onDateChange, timezone, tab, onTabChange, enrichCoverage, onEnrich, enriching }: {
  dateRange: DateRange;
  onDateChange: (r: DateRange) => void;
  timezone: string;
  tab: ViewTab;
  onTabChange: (t: ViewTab) => void;
  enrichCoverage?: Reports['enrichmentCoverage'];
  onEnrich?: () => void;
  enriching?: boolean;
}) {
  const tabs: { key: ViewTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'breakdown', label: 'Breakdowns' },
    { key: 'charts', label: 'Charts' },
  ];

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 lg:gap-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-text-primary tracking-tight">Trade Analytics</h1>
          <p className="text-text-muted text-base mt-1.5">Identify patterns and optimize performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {enrichCoverage && enrichCoverage.floatPercent < 100 && onEnrich && (
            <button onClick={onEnrich} disabled={enriching}
              className="px-4 py-2.5 bg-surface-2 border border-border text-text-secondary text-base font-medium rounded-xl hover:bg-surface-3 transition-colors disabled:opacity-50">
              {enriching ? 'Enriching...' : 'Enrich Data'}
            </button>
          )}
          <DateRangeFilter value={dateRange} onChange={onDateChange} timezone={timezone} />
        </div>
      </div>
      <div className="flex gap-1 bg-surface-2 rounded-xl p-1.5 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => onTabChange(t.key)}
            className={`px-5 py-2.5 text-base font-medium rounded-lg transition-colors ${
              tab === t.key ? 'bg-bg text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
