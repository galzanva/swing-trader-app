'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

export interface DateRange {
  from: string;   // YYYY-MM-DD
  to: string;     // YYYY-MM-DD
  label: string;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  timezone: string;
}

/**
 * "Today" in the user's timezone as a plain YYYY-MM-DD string.
 * Journal dates are stored as YYYY-MM-DDT00:00:00Z (UTC midnight on the intended calendar date).
 * The YYYY-MM-DD portion already matches the user's wall-clock date at the time the trade was
 * entered, so filter boundaries must use the user's wall-clock "today" — NOT UTC today.
 * (At 10pm ET on Sunday, UTC is already Monday; using UTC "today" would shift week/month presets.)
 */
function todayYmd(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function startOfWeek(d: Date): Date {
  const dow = d.getDay(); // 0 Sun .. 6 Sat
  const diff = dow === 0 ? 6 : dow - 1; // Mon=0
  return addDays(d, -diff);
}

function getPresets(tz: string): { label: string; from: string; to: string }[] {
  const todayStr = todayYmd(tz);
  const today = ymdToDate(todayStr);
  const yesterday = addDays(today, -1);

  const thisWeekStart = startOfWeek(today);
  const lastWeekEnd = addDays(thisWeekStart, -1);
  const lastWeekStart = startOfWeek(lastWeekEnd);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthEnd = addDays(thisMonthStart, -1);
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);

  const ytdStart = new Date(today.getFullYear(), 0, 1);
  const last30 = addDays(today, -29);

  return [
    { label: 'Today', from: todayStr, to: todayStr },
    { label: 'Yesterday', from: fmtLocal(yesterday), to: fmtLocal(yesterday) },
    { label: 'This Week', from: fmtLocal(thisWeekStart), to: todayStr },
    { label: 'Last Week', from: fmtLocal(lastWeekStart), to: fmtLocal(lastWeekEnd) },
    { label: 'Last 30 Days', from: fmtLocal(last30), to: todayStr },
    { label: 'This Month', from: fmtLocal(thisMonthStart), to: todayStr },
    { label: 'Last Month', from: fmtLocal(lastMonthStart), to: fmtLocal(lastMonthEnd) },
    { label: 'YTD', from: fmtLocal(ytdStart), to: todayStr },
    { label: 'All Time', from: '2000-01-01', to: todayStr },
  ];
}

function MiniCalendar({ month, year, selectedFrom, selectedTo, onSelect, onMonthChange }: {
  month: number;
  year: number;
  selectedFrom: string;
  selectedTo: string;
  onSelect: (date: string) => void;
  onMonthChange: (dir: -1 | 1) => void;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="w-64">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => onMonthChange(-1)} className="p-1 hover:bg-surface-3 rounded text-text-secondary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-sm font-medium text-text-primary">{monthName}</span>
        <button onClick={() => onMonthChange(1)} className="p-1 hover:bg-surface-3 rounded text-text-secondary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} className="py-1 text-text-muted font-medium">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isFrom = ds === selectedFrom;
          const isTo = ds === selectedTo;
          const inRange = ds >= selectedFrom && ds <= selectedTo && selectedFrom !== selectedTo;
          return (
            <button
              key={ds}
              onClick={() => onSelect(ds)}
              className={`py-1 rounded text-xs transition-colors ${
                isFrom || isTo
                  ? 'bg-accent text-white font-semibold'
                  : inRange
                  ? 'bg-accent/20 text-text-primary'
                  : 'hover:bg-surface-3 text-text-secondary'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangeFilter({ value, onChange, timezone }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);
  const [pickingStart, setPickingStart] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const presets = useMemo(() => getPresets(timezone), [timezone]);

  const [calMonth, setCalMonth] = useState(() => {
    const d = ymdToDate(todayYmd(timezone));
    return { month: d.getMonth(), year: d.getFullYear() };
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePreset = (p: { label: string; from: string; to: string }) => {
    onChange({ from: p.from, to: p.to, label: p.label });
    setCustomFrom(p.from);
    setCustomTo(p.to);
    setOpen(false);
  };

  const handleCalSelect = (date: string) => {
    if (pickingStart) {
      setCustomFrom(date);
      setCustomTo(date);
      setPickingStart(false);
    } else {
      const from = date < customFrom ? date : customFrom;
      const to = date >= customFrom ? date : customFrom;
      setCustomFrom(from);
      setCustomTo(to);
      setPickingStart(true);
      onChange({ from, to, label: 'Custom' });
      setOpen(false);
    }
  };

  const handleMonthChange = (dir: -1 | 1) => {
    setCalMonth(prev => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { month: m, year: y };
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-base font-medium text-text-secondary hover:bg-surface-3 transition-colors"
      >
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <span>{value.label}</span>
        <svg className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-surface-1 border border-border rounded-xl shadow-lg p-4 flex gap-4">
          {/* Presets */}
          <div className="flex flex-col gap-1 min-w-[120px]">
            <div className="text-xs text-text-muted font-medium mb-1 uppercase tracking-wider">Quick Select</div>
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => handlePreset(p)}
                className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  value.label === p.label
                    ? 'bg-accent text-white font-medium'
                    : 'text-text-secondary hover:bg-surface-2'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px bg-border" />

          {/* Calendar */}
          <div>
            <div className="text-xs text-text-muted font-medium mb-2 uppercase tracking-wider">Custom Range</div>
            <MiniCalendar
              month={calMonth.month}
              year={calMonth.year}
              selectedFrom={customFrom}
              selectedTo={customTo}
              onSelect={handleCalSelect}
              onMonthChange={handleMonthChange}
            />
            {!pickingStart && (
              <p className="text-xs text-text-muted mt-2 text-center">Select end date</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function getDefaultAllTimeRange(tz: string): DateRange {
  return { from: '2000-01-01', to: todayYmd(tz), label: 'All Time' };
}

export function getDefault30DayRange(tz: string): DateRange {
  const todayStr = todayYmd(tz);
  const today = ymdToDate(todayStr);
  const from = addDays(today, -29);
  return { from: fmtLocal(from), to: todayStr, label: 'Last 30 Days' };
}
