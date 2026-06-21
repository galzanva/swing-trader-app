'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Session } from 'next-auth';
import type { Trade } from './journal-types';
import TradeDetailDrawer from './trade-detail-drawer';
import DateRangeFilter, { DateRange, getDefault30DayRange } from '@/app/components/date-range-filter';
import { formatJournalStoredDate } from '@/lib/trade-dates';

interface Summary {
  totalTrades: number;
  totalClosed: number;
  totalOpen: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number;
  totalPL: number;
  avgPL: number;
  avgReturn: number;
  avgRMultiple: number | null;
  avgHoldingDays: number | null;
}

interface JournalClientProps {
  session: Session;
}

interface SavedReport {
  id: string;
  type: string;
  title: string;
  symbol: string;
  timeframe: string;
  createdAt: string;
}

type DrawerMode = 'view' | 'edit' | null;

interface SavedAnalysis {
  id: string;
  periodLabel: string;
  tradesAnalyzed: number;
  intradayCount: number;
  swingCount: number;
  winRate: number | null;
  totalPL: number | null;
  analysis: string;
  createdAt: string;
}

const ANALYSIS_STEPS = [
  'Fetching closed trades...',
  'Separating intraday vs swing trades...',
  'Detecting repeatable setups...',
  'Analyzing early exits & holding discipline...',
  'Building trade-type-specific context...',
  'AI is writing your performance report...',
];

function tradeCalendarDay(isoString: string) {
  return isoString.slice(0, 10);
}

function msFromJournalTime(t: string | null | undefined): number {
  if (!t || typeof t !== 'string') return 0;
  const p = t.trim().split(':');
  const h = parseInt(p[0], 10);
  const m = parseInt(p[1], 10);
  const s = parseInt(p[2], 10);
  if (!Number.isFinite(h)) return 0;
  const hh = Math.min(23, Math.max(0, h));
  const mm = Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0;
  const ss = Number.isFinite(s) ? Math.min(59, Math.max(0, s)) : 0;
  return ((hh * 60 + mm) * 60 + ss) * 1000;
}

/** Hold duration in seconds for a closed intraday trade when entry + exit times exist. */
function closedIntradayHoldSeconds(t: Trade): number | null {
  if (t.isOpen || t.returnPct === null) return null;
  const tt = t.tradeType || (t.holdingDays === 0 ? 'intraday' : 'swing');
  if (tt !== 'intraday') return null;
  if (!t.entryTime?.trim() || !t.exitTime?.trim()) return null;
  const entryDay = tradeCalendarDay(t.entryDate);
  const exitDay = t.exitDate ? tradeCalendarDay(t.exitDate) : entryDay;
  const entryMs = new Date(`${entryDay}T00:00:00.000Z`).getTime() + msFromJournalTime(t.entryTime);
  const exitMs = new Date(`${exitDay}T00:00:00.000Z`).getTime() + msFromJournalTime(t.exitTime);
  const sec = (exitMs - entryMs) / 1000;
  if (!Number.isFinite(sec) || sec < 0) return null;
  return sec;
}

/** Format an average duration: minutes + seconds (hours when needed). */
function formatAvgHoldDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (rem === 0 && mm === 0) return `${h}h`;
  if (rem === 0) return `${h}h ${mm}m`;
  return `${h}h ${mm}m ${rem}s`;
}

/** Descending: latest exit (day + time) first; opens / no exit use entry day + entry time. */
function journalTradeSortKey(t: Trade): number {
  const exitDate = t.exitDate;
  if (!t.isOpen && exitDate && t.exitPrice != null) {
    const dayMs = new Date(`${tradeCalendarDay(exitDate)}T00:00:00.000Z`).getTime();
    if (Number.isNaN(dayMs)) {
      const ed = new Date(`${tradeCalendarDay(t.entryDate)}T00:00:00.000Z`).getTime();
      return (Number.isNaN(ed) ? 0 : ed) + msFromJournalTime(t.entryTime);
    }
    return dayMs + msFromJournalTime(t.exitTime);
  }
  const dayMs = new Date(`${tradeCalendarDay(t.entryDate)}T00:00:00.000Z`).getTime();
  return (Number.isNaN(dayMs) ? 0 : dayMs) + msFromJournalTime(t.entryTime);
}

export default function JournalClient({ session }: JournalClientProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiAnalysisMeta, setAiAnalysisMeta] = useState<{ periodLabel: string; tradesAnalyzed: number; intradayCount: number; swingCount: number; winRate: number; totalPL: number; typeFilter: 'all' | 'intraday' | 'swing' } | null>(null);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [showSavedAnalyses, setShowSavedAnalyses] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [tickerReports, setTickerReports] = useState<SavedReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [timezone, setTimezone] = useState('America/New_York');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'intraday' | 'swing'>('all');
  const [strategyFilter, setStrategyFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'webull'>('all');
  const [brokerFilter, setBrokerFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [rehydratingOhlc, setRehydratingOhlc] = useState(false);
  const [viewTradeId, setViewTradeId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [tradesPage, setTradesPage] = useState(1);
  const tradesPerPage = 20;
  const editDrawerRef = useRef<HTMLDivElement>(null);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // Form state
  const [ticker, setTicker] = useState('');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [tradeType, setTradeType] = useState<'swing' | 'intraday'>('intraday');
  const [brokerForm, setBrokerForm] = useState('webull');
  const [entryPrice, setEntryPrice] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exitPrice, setExitPrice] = useState('');
  const [exitDate, setExitDate] = useState('');
  const [entryTimeForm, setEntryTimeForm] = useState('');
  const [exitTimeForm, setExitTimeForm] = useState('');
  const [amount, setAmount] = useState('');
  const [strategy, setStrategy] = useState('');
  const [selectedReportId, setSelectedReportId] = useState('');
  const [notes, setNotes] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [exitReason, setExitReason] = useState('');

  // Strategies from DB
  const [dbStrategies, setDbStrategies] = useState<{ id: string; name: string; tradeType: string }[]>([]);

  const exitReasonOptions = [
    { value: 'hit_target', label: 'Hit Target' },
    { value: 'stopped_out', label: 'Stopped Out' },
    { value: 'manual_exit', label: 'Manual Exit' },
    { value: 'time_exit', label: 'Time-Based Exit' },
  ];

  useEffect(() => {
    fetch('/api/account/settings')
      .then(r => r.json())
      .then(d => {
        const tz = d.timezone || 'America/New_York';
        setTimezone(tz);
        setDateRange(getDefault30DayRange(tz));
      })
      .catch(() => setDateRange(getDefault30DayRange('America/New_York')));
    fetchTrades(); fetchSavedAnalyses(); fetchStrategies();
  }, []);

  // Close edit drawer on Escape
  useEffect(() => {
    if (drawerMode !== 'edit') return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeEditDrawer(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [drawerMode]);

  // Lock body scroll when edit drawer is open
  useEffect(() => {
    if (drawerMode === 'edit') document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [drawerMode]);

  // Close tools menu on outside click
  useEffect(() => {
    if (!showToolsMenu) return;
    const handler = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) setShowToolsMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showToolsMenu]);

  // Fetch reports by ticker (debounced)
  useEffect(() => {
    if (!ticker || ticker.length === 0) {
      setTickerReports([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setLoadingReports(true);
        const response = await fetch(`/api/reports/search?ticker=${encodeURIComponent(ticker)}`);
        const data = await response.json();
        if (data.success) setTickerReports(data.reports);
      } catch { setTickerReports([]); } finally { setLoadingReports(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [ticker]);

  const localDateStr = () => new Date().toISOString().slice(0, 10);

  // Extract YYYY-MM-DD from a trade's ISO date string (stored as UTC midnight)
  const tradeDateStr = (isoString: string) => isoString.slice(0, 10);

  const normalizeStrategy = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
  const strategyFilterLabel = strategyFilter === '__none__' ? 'No Strategy' : strategyFilter.trim();
  const hasStrategyFilter = strategyFilter !== '';

  const filteredTrades = useMemo(() => {
    let result = trades;

    // Date range filter
    if (dateRange) {
      const { from, to } = dateRange;
      if (from !== '2000-01-01') {
        result = result.filter(trade => {
          const d = tradeDateStr(trade.entryDate);
          return d >= from && d <= to;
        });
      }
    }

    // Trade type filter
    if (typeFilter !== 'all') {
      result = result.filter(trade => {
        const tt = trade.tradeType || (trade.holdingDays === 0 ? 'intraday' : 'swing');
        return tt === typeFilter;
      });
    }

    // Strategy filter
    if (strategyFilter === '__none__') {
      result = result.filter(trade => !trade.strategy || !trade.strategy.trim());
    } else if (strategyFilter.trim() !== '') {
      const want = normalizeStrategy(strategyFilter);
      result = result.filter(trade => normalizeStrategy(trade.strategy) === want);
    }

    // Source filter
    if (sourceFilter !== 'all') {
      result = result.filter(trade => (trade.source || 'manual') === sourceFilter);
    }

    // Broker filter
    if (brokerFilter !== 'all') {
      result = result.filter(trade => (trade.broker || 'webull') === brokerFilter);
    }

    return [...result].sort((a, b) => {
      const kb = journalTradeSortKey(b);
      const ka = journalTradeSortKey(a);
      if (kb !== ka) return kb - ka;
      return b.id.localeCompare(a.id);
    });
  }, [trades, dateRange, typeFilter, strategyFilter, sourceFilter, brokerFilter]);

  const hasTradesWithNoStrategy = useMemo(() =>
    trades.some(t => !t.strategy || !t.strategy.trim()),
  [trades]);

  const strategyChoices = useMemo(() => {
    const all = new Set<string>();
    for (const t of trades) {
      const s = (t.strategy ?? '').trim();
      if (s) all.add(s);
    }
    for (const s of dbStrategies) {
      all.add(s.name);
    }
    return [...all].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [trades, dbStrategies]);

  useEffect(() => {
    setTradesPage(1);
    setSelectedIds(new Set());
  }, [dateRange, typeFilter, strategyFilter, sourceFilter, brokerFilter]);

  const tradesTotalPages = Math.max(1, Math.ceil(filteredTrades.length / tradesPerPage));
  const tradesPageSafe = Math.min(tradesPage, tradesTotalPages);
  const paginatedTrades = useMemo(() => {
    const start = (tradesPageSafe - 1) * tradesPerPage;
    return filteredTrades.slice(start, start + tradesPerPage);
  }, [filteredTrades, tradesPageSafe, tradesPerPage]);

  const filteredClosedCount = useMemo(() =>
    filteredTrades.filter(t => !t.isOpen && t.returnPct !== null).length,
  [filteredTrades]);

  const filteredSummary = useMemo(() => {
    const closedTrades = filteredTrades.filter(t => !t.isOpen && t.returnPct !== null);
    const openTrades = filteredTrades.filter(t => t.isOpen);
    const totalTrades = filteredTrades.length;
    const totalClosed = closedTrades.length;
    const totalOpen = openTrades.length;
    const winningTrades = closedTrades.filter(t => (t.returnPct ?? 0) > 0).length;
    const losingTrades = closedTrades.filter(t => (t.returnPct ?? 0) < 0).length;
    const breakEvenTrades = closedTrades.filter(t => (t.returnPct ?? 0) === 0).length;
    const winRate = totalClosed > 0 ? (winningTrades / totalClosed) * 100 : 0;
    const totalPL = closedTrades.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0);
    const avgPL = totalClosed > 0 ? totalPL / totalClosed : 0;
    const avgReturn = totalClosed > 0 ? closedTrades.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / totalClosed : 0;
    const dTrades = closedTrades.filter(t => t.holdingDays !== null);
    const avgHoldingDays = dTrades.length > 0 ? dTrades.reduce((sum, t) => sum + (t.holdingDays ?? 0), 0) / dTrades.length : null;

    let avgHoldDetail: string;
    if (typeFilter === 'intraday') {
      const holdSecs = closedTrades.map(closedIntradayHoldSeconds).filter((x): x is number => x !== null);
      if (holdSecs.length > 0) {
        const avgSec = holdSecs.reduce((a, b) => a + b, 0) / holdSecs.length;
        const label = `Avg hold ${formatAvgHoldDuration(avgSec)}`;
        avgHoldDetail =
          holdSecs.length < closedTrades.length
            ? `${label} (${holdSecs.length}/${closedTrades.length} with times)`
            : label;
      } else {
        avgHoldDetail = 'Avg hold — add entry & exit times';
      }
    } else {
      avgHoldDetail =
        avgHoldingDays !== null ? `Avg hold ${Math.round(avgHoldingDays)} days` : '—';
    }

    return {
      totalTrades, totalClosed, totalOpen, winningTrades, losingTrades, breakEvenTrades,
      winRate: parseFloat(winRate.toFixed(2)),
      totalPL: parseFloat(totalPL.toFixed(2)),
      avgPL: parseFloat(avgPL.toFixed(2)),
      avgReturn: parseFloat(avgReturn.toFixed(2)),
      avgHoldingDays: avgHoldingDays !== null ? Math.round(avgHoldingDays) : null,
      avgHoldDetail,
    };
  }, [filteredTrades, typeFilter]);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/journal/list');
      const data = await response.json();
      if (data.success) { setTrades(data.trades); setSummary(data.summary); }
      else alert('Error fetching trades: ' + data.error);
    } catch { alert('Failed to fetch trades'); } finally { setLoading(false); }
  };

  const fetchStrategies = async () => {
    try {
      const res = await fetch('/api/strategies');
      const data = await res.json();
      if (data.success) setDbStrategies(data.strategies.filter((s: { isActive: boolean }) => s.isActive));
    } catch { /* silent */ }
  };

  const closeEditDrawer = () => {
    setDrawerMode(null);
    setEditingTrade(null);
  };

  const openAddDrawer = () => {
    resetForm();
    setEditingTrade(null);
    fetchStrategies();
    setDrawerMode('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !entryPrice || !entryDate || !amount) {
      alert('Please fill in all required fields');
      return;
    }

    const isIntraday = tradeType === 'intraday';

    // For closed intraday trades, exit date = entry date automatically
    const effectiveExitDate = isIntraday && exitPrice && !isOpen ? entryDate : exitDate;

    if (!isOpen && !isIntraday && (!exitPrice || !effectiveExitDate)) {
      alert('Exit price and date are required for closed swing trades');
      return;
    }
    if (!isOpen && isIntraday && !exitPrice) {
      alert('Exit price is required for closed intraday trades');
      return;
    }

    try {
      setSaving(true);
      const tradeData = {
        id: editingTrade?.id,
        ticker: ticker.toUpperCase(),
        direction,
        tradeType,
        broker: brokerForm,
        entryPrice: parseFloat(entryPrice),
        entryDate,
        exitPrice: exitPrice ? parseFloat(exitPrice) : undefined,
        exitDate: effectiveExitDate || undefined,
        entryTime: entryTimeForm || undefined,
        exitTime: exitTimeForm || undefined,
        amount: parseFloat(amount),
        strategy: strategy || undefined,
        analysisReportId: selectedReportId || undefined,
        notes: notes || undefined,
        isOpen: isIntraday ? (exitPrice ? false : true) : isOpen,
        exitReason: exitReason && !isOpen ? (exitReason as any) : undefined,
      };

      const response = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData),
      });
      const data = await response.json();

      if (data.success) {
        closeEditDrawer();
        resetForm();
        fetchTrades();
      } else {
        alert('Error saving trade: ' + data.error);
      }
    } catch { alert('Failed to save trade'); } finally { setSaving(false); }
  };

  const resetForm = () => {
    setTicker(''); setDirection('long'); setTradeType('intraday');
    setBrokerForm('webull');
    setEntryPrice(''); setEntryDate(localDateStr());
    setExitPrice(''); setExitDate(''); setAmount('');
    setEntryTimeForm(''); setExitTimeForm('');
    setStrategy(''); setSelectedReportId(''); setNotes('');
    setIsOpen(false); setExitReason('');
  };

  const handleEdit = useCallback((trade: Trade) => {
    fetchStrategies();
    setEditingTrade(trade);
    setTicker(trade.ticker);
    setDirection(trade.direction);
    setTradeType(trade.tradeType || (trade.holdingDays === 0 ? 'intraday' : 'swing'));
    setBrokerForm(trade.broker || 'webull');
    setEntryPrice(trade.entryPrice.toString());
    setEntryDate(trade.entryDate.split('T')[0]);
    setExitPrice(trade.exitPrice?.toString() || '');
    setExitDate(trade.exitDate ? trade.exitDate.split('T')[0] : '');
    setEntryTimeForm(trade.entryTime || '');
    setExitTimeForm(trade.exitTime || '');
    setAmount(trade.amount.toString());
    setStrategy(trade.strategy || '');
    setSelectedReportId(trade.analysisReportId || '');
    setNotes(trade.notes || '');
    setIsOpen(trade.isOpen);
    setExitReason(trade.exitReason || '');
    setViewTradeId(null);
    setDrawerMode('edit');
  }, []);

  const handleDelete = async (tradeId: string): Promise<boolean> => {
    if (!confirm('Are you sure you want to delete this trade?')) return false;
    try {
      const response = await fetch(`/api/journal/${tradeId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        fetchTrades();
        return true;
      }
      alert('Error deleting trade: ' + data.error);
      return false;
    } catch {
      alert('Failed to delete trade');
      return false;
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedTrades.map(t => t.id);
    const allSelected = pageIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      pageIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (dateRange) {
      params.set('from', dateRange.from);
      params.set('to', dateRange.to);
    }
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (strategyFilter) params.set('strategy', strategyFilter);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (brokerFilter !== 'all') params.set('broker', brokerFilter);

    const url = `/api/journal/export?${params.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleRehydrateOhlc = async () => {
    const MAX_REFRESH = 2000;
    const ids = filteredTrades.map(t => t.id);
    if (ids.length === 0) {
      alert('No trades match your current filters (period, type, strategy, source). Widen or clear filters to refresh rows.');
      return;
    }
    const idsToSend = ids.slice(0, MAX_REFRESH);
    const truncated = ids.length > MAX_REFRESH;
    if (
      !confirm(
        `Re-fetch daily OHLC and indicators from Polygon for ${idsToSend.length} trade(s) that match your current filters${truncated ? ` (capped at ${MAX_REFRESH} of ${ids.length})` : ''}? Only these rows are updated — not the rest of your journal. Uses Polygon API quota.`,
      )
    ) {
      return;
    }
    try {
      setRehydratingOhlc(true);
      const res = await fetch('/api/journal/rehydrate-ohlc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeIds: idsToSend }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || data.details || 'Failed to refresh market data');
        return;
      }
      const errTail =
        Array.isArray(data.errors) && data.errors.length > 0
          ? `\n\nNotes:\n${data.errors.slice(0, 6).join('\n')}`
          : '';
      alert(
        `Updated ${data.updated} trade(s).${data.skipped ? ` Skipped ${data.skipped}.` : ''}${errTail}`,
      );
      fetchTrades();
    } catch {
      alert('Could not reach the server. Try again.');
    } finally {
      setRehydratingOhlc(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected trade(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch(`/api/journal/${id}`, { method: 'DELETE' }).then(r => r.json())
        )
      );
      const failed = results.filter(r => !r.success).length;
      if (failed > 0) alert(`${failed} trade(s) failed to delete.`);
      setSelectedIds(new Set());
      fetchTrades();
    } catch { alert('Failed to delete trades'); }
    setBulkDeleting(false);
  };

  const fetchSavedAnalyses = async () => {
    try {
      const res = await fetch('/api/journal/analyze');
      const data = await res.json();
      if (data.success) setSavedAnalyses(data.analyses);
    } catch { /* */ }
  };

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true); setAiAnalysis(null); setAiAnalysisMeta(null); setAnalysisStep(0);

      const stepInterval = setInterval(() => {
        setAnalysisStep(prev => Math.min(prev + 1, ANALYSIS_STEPS.length - 1));
      }, 2000);

      const rangeFrom = dateRange?.from || '2000-01-01';
      const rangeTo = dateRange?.to || localDateStr();
      const startDate = rangeFrom !== '2000-01-01' ? new Date(rangeFrom + 'T00:00:00.000Z').toISOString() : null;
      const endDate = new Date(rangeTo + 'T23:59:59.999Z').toISOString();
      const typeLabels: Record<string, string> = { all: '', intraday: ' (Day Trades)', swing: ' (Swing Trades)' };
      const stratSuffix = hasStrategyFilter ? ` • ${strategyFilterLabel}` : '';
      const periodLabel = (dateRange?.label || 'All Time') + (typeLabels[typeFilter] || '') + stratSuffix;

      const response = await fetch('/api/journal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          periodLabel,
          typeFilter,
          strategyFilter: strategyFilter === '__none__' ? '__none__' : (strategyFilter.trim() || null),
        }),
      });

      clearInterval(stepInterval);
      setAnalysisStep(ANALYSIS_STEPS.length - 1);

      const data = await response.json();
      if (data.success) {
        setAiAnalysis(data.analysis);
        setAiAnalysisMeta({
          periodLabel,
          tradesAnalyzed: data.summary?.totalTrades ?? data.tradesAnalyzed ?? 0,
          intradayCount: data.summary?.intradayTrades ?? 0,
          swingCount: data.summary?.swingTrades ?? 0,
          winRate: data.summary?.winRate ?? 0,
          totalPL: data.summary?.totalPL ?? 0,
          typeFilter: data.typeFilter ?? typeFilter,
        });
      }
      else alert('Error generating analysis: ' + data.error);
    } catch { alert('Failed to generate analysis'); } finally { setAnalyzing(false); }
  };

  const handleSaveAnalysis = async () => {
    if (!aiAnalysis || !aiAnalysisMeta) return;
    try {
      setSavingAnalysis(true);
      const res = await fetch('/api/journal/analyze', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: aiAnalysis, ...aiAnalysisMeta }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSavedAnalyses();
        setAiAnalysisMeta(null);
        setAiAnalysis(null);
      } else {
        alert('Error saving analysis');
      }
    } catch { alert('Failed to save analysis'); } finally { setSavingAnalysis(false); }
  };

  const handleDeleteAnalysis = async (id: string) => {
    if (!confirm('Delete this saved analysis?')) return;
    try {
      const res = await fetch(`/api/journal/analyze?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSavedAnalyses(prev => prev.filter(a => a.id !== id));
        fetchSavedAnalyses();
      }
    } catch { alert('Failed to delete analysis'); }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A';
    return value >= 0 ? `$${value.toFixed(2)}` : `-$${Math.abs(value).toFixed(2)}`;
  };

  const isIntraday = tradeType === 'intraday';

  if (!dateRange) {
    return <div className="py-20 text-center"><div className="w-8 h-8 border-2 border-text-muted border-t-accent rounded-full animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-8 lg:space-y-10">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 lg:gap-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-text-primary tracking-tight">Trading Journal</h1>
          <p className="text-text-muted text-base mt-1.5">Track your trades and discover patterns with AI analysis</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={openAddDrawer}
            className="px-5 py-2.5 bg-accent text-white rounded-xl text-base font-semibold hover:bg-accent-hover transition-all flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Add Trade
          </button>
          <div ref={toolsMenuRef} className="relative">
            <button onClick={() => setShowToolsMenu(!showToolsMenu)}
              className="px-4 py-2.5 bg-surface-2 border border-border text-text-secondary rounded-xl text-base font-medium hover:bg-surface-3 transition-all flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
              Tools
            </button>
            {showToolsMenu && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-surface-1 border border-border rounded-xl shadow-lg py-2 min-w-[240px]">
                <button onClick={() => { setShowToolsMenu(false); void handleRehydrateOhlc(); }}
                  disabled={rehydratingOhlc || filteredTrades.length === 0}
                  className="w-full text-left px-4 py-3 text-base text-text-secondary hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {rehydratingOhlc ? 'Refreshing...' : `Refresh OHLC (${filteredTrades.length})`}
                </button>
                <button onClick={() => { setShowToolsMenu(false); handleExportCSV(); }}
                  disabled={filteredTrades.length === 0}
                  className="w-full text-left px-4 py-3 text-base text-text-secondary hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Export CSV ({filteredTrades.length})
                </button>
                <button onClick={() => { setShowToolsMenu(false); handleAnalyze(); }}
                  disabled={analyzing || filteredClosedCount === 0}
                  className="w-full text-left px-4 py-3 text-base text-text-secondary hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {analyzing ? 'Analyzing...' : `AI Analysis (${filteredClosedCount} closed)`}
                </button>
                {savedAnalyses.length > 0 && (
                  <button onClick={() => { setShowToolsMenu(false); setShowSavedAnalyses(!showSavedAnalyses); }}
                    className="w-full text-left px-4 py-3 text-base text-text-secondary hover:bg-surface-2 transition-colors">
                    {showSavedAnalyses ? 'Hide' : 'View'} Past Analyses ({savedAnalyses.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Filters Bar ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <DateRangeFilter value={dateRange} onChange={setDateRange} timezone={timezone} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
          className="px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-base font-medium text-text-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent">
          <option value="all">All Types</option>
          <option value="intraday">Day Trades</option>
          <option value="swing">Swing Trades</option>
        </select>
        <select value={strategyFilter} onChange={e => setStrategyFilter(e.target.value)}
          className="px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-base font-medium text-text-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent min-w-[160px]">
          <option value="">All Strategies</option>
          {hasTradesWithNoStrategy && <option value="__none__">No Strategy</option>}
          {strategyChoices.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as typeof sourceFilter)}
          className="px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-base font-medium text-text-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent">
          <option value="all">All Sources</option>
          <option value="manual">Manual</option>
          <option value="webull">Webull</option>
        </select>
        <select value={brokerFilter} onChange={e => setBrokerFilter(e.target.value)}
          className="px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-base font-medium text-text-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent">
          <option value="all">All Accounts</option>
          <option value="webull">Webull</option>
          <option value="robinhood">Robinhood</option>
          <option value="tradethepool">TradeThePool</option>
        </select>
        {hasStrategyFilter && (
          <span className="text-sm text-text-muted">Showing <span className="font-semibold text-text-primary">{strategyFilterLabel}</span> only</span>
        )}
      </div>

      {/* ─── Summary Stats ─── */}
      {filteredSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-5">
          <div className="bg-surface-1 border border-border rounded-2xl p-5 lg:p-6 min-h-[112px] flex flex-col justify-center">
            <div className="text-sm text-text-muted mb-2 font-medium uppercase tracking-wider">Total Trades</div>
            <div className="text-2xl lg:text-3xl font-bold tabular-nums text-text-primary">{filteredSummary.totalTrades}</div>
            <div className="text-sm text-text-muted mt-1.5">{filteredSummary.totalOpen} open · {filteredSummary.totalClosed} closed</div>
          </div>
          <div className="bg-surface-1 border border-border rounded-2xl p-5 lg:p-6 min-h-[112px] flex flex-col justify-center">
            <div className="text-sm text-text-muted mb-2 font-medium uppercase tracking-wider">Win Rate</div>
            <div className={`text-2xl lg:text-3xl font-bold tabular-nums ${filteredSummary.winRate >= 50 ? 'text-profit' : 'text-loss'}`}>{filteredSummary.winRate}%</div>
            <div className="text-sm text-text-muted mt-1.5">{filteredSummary.winningTrades}W / {filteredSummary.losingTrades}L</div>
          </div>
          <div className="bg-surface-1 border border-border rounded-2xl p-5 lg:p-6 min-h-[112px] flex flex-col justify-center">
            <div className="text-sm text-text-muted mb-2 font-medium uppercase tracking-wider">Total P/L</div>
            <div className={`text-2xl lg:text-3xl font-bold tabular-nums ${filteredSummary.totalPL >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(filteredSummary.totalPL)}</div>
            <div className="text-sm text-text-muted mt-1.5">Avg: {formatCurrency(filteredSummary.avgPL)}</div>
          </div>
          <div className="bg-surface-1 border border-border rounded-2xl p-5 lg:p-6 min-h-[112px] flex flex-col justify-center">
            <div className="text-sm text-text-muted mb-2 font-medium uppercase tracking-wider">Avg Return</div>
            <div className={`text-2xl lg:text-3xl font-bold tabular-nums ${filteredSummary.avgReturn >= 0 ? 'text-profit' : 'text-loss'}`}>{filteredSummary.avgReturn > 0 ? '+' : ''}{filteredSummary.avgReturn}%</div>
            <div className="text-sm text-text-muted mt-1.5">{filteredSummary.avgHoldDetail}</div>
          </div>
        </div>
      )}

      {/* ─── AI Analysis Progress ─── */}
      {analyzing && (
        <div className="bg-surface-1 border border-border rounded-2xl p-6 lg:p-8">
          <h3 className="text-xl font-bold text-text-primary mb-5">Generating AI Analysis...</h3>
          <div className="space-y-3">
            {ANALYSIS_STEPS.map((step, i) => {
              const isActive = i === analysisStep;
              const isDone = i < analysisStep;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    isDone ? 'bg-accent text-white' : isActive ? 'bg-surface-4 text-text-primary animate-pulse' : 'bg-surface-2 text-text-muted'
                  }`}>
                    {isDone ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    ) : isActive ? (
                      <div className="w-3 h-3 bg-text-primary rounded-full" />
                    ) : (
                      <div className="w-2.5 h-2.5 bg-surface-4 rounded-full" />
                    )}
                  </div>
                  <span className={`text-base transition-all ${isDone ? 'text-accent' : isActive ? 'text-text-primary font-medium' : 'text-text-muted'}`}>{step}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-5 h-2 bg-surface-2 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-1000" style={{ width: `${((analysisStep + 1) / ANALYSIS_STEPS.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* ─── AI Analysis Result ─── */}
      {aiAnalysis && !analyzing && (
        <div className="bg-surface-1 border border-border rounded-2xl p-6 lg:p-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-text-primary">AI Performance Report</h2>
              {aiAnalysisMeta && (
                <p className="text-sm text-text-muted mt-1.5">
                  {aiAnalysisMeta.periodLabel} · {aiAnalysisMeta.tradesAnalyzed} trades
                  {aiAnalysisMeta.intradayCount > 0 && ` (${aiAnalysisMeta.intradayCount} day`}{aiAnalysisMeta.intradayCount > 0 && aiAnalysisMeta.swingCount > 0 ? ', ' : aiAnalysisMeta.intradayCount > 0 ? ')' : ''}
                  {aiAnalysisMeta.swingCount > 0 && `${aiAnalysisMeta.intradayCount > 0 ? '' : ' ('}${aiAnalysisMeta.swingCount} swing)`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {aiAnalysisMeta && (
                <button onClick={handleSaveAnalysis} disabled={savingAnalysis}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2">
                  {savingAnalysis ? 'Saving...' : 'Save Report'}
                </button>
              )}
              <button onClick={() => { setAiAnalysis(null); setAiAnalysisMeta(null); }} className="text-text-muted hover:text-text-primary transition-colors text-2xl leading-none">&times;</button>
            </div>
          </div>
          <div className="prose prose-invert max-w-none text-text-secondary text-base leading-relaxed whitespace-pre-wrap">{aiAnalysis}</div>
        </div>
      )}

      {/* ─── Saved Analyses ─── */}
      {showSavedAnalyses && savedAnalyses.length > 0 && (
        <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
          <div className="px-6 lg:px-8 py-5 border-b border-border flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">Past Analyses</h2>
            <a href="/journal/analyses" className="text-accent hover:text-accent-hover text-base font-medium transition-colors">View All &rarr;</a>
          </div>
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {savedAnalyses.slice(0, 10).map(a => (
              <div key={a.id} className="flex items-center justify-between px-6 lg:px-8 py-4 hover:bg-card-hover transition-colors group">
                <button onClick={() => { setAiAnalysis(a.analysis); setAiAnalysisMeta(null); setShowSavedAnalyses(false); }} className="flex-1 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-text-primary font-medium text-base">{a.periodLabel}</span>
                    <span className="text-text-muted text-sm">{a.tradesAnalyzed} trades{a.intradayCount > 0 && ` · ${a.intradayCount} day`}{a.swingCount > 0 && ` · ${a.swingCount} swing`}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm mt-1">
                    {a.winRate !== null && <span className={a.winRate >= 50 ? 'text-profit' : 'text-loss'}>{a.winRate}% WR</span>}
                    {a.totalPL !== null && <span className={a.totalPL >= 0 ? 'text-profit' : 'text-loss'}>{formatCurrency(a.totalPL)}</span>}
                    <span className="text-text-muted">{new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </button>
                <button onClick={() => handleDeleteAnalysis(a.id)} className="ml-3 text-text-muted hover:text-loss opacity-0 group-hover:opacity-100 transition-all" title="Delete">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Trades Table ─── */}
      <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
        <div className="px-6 lg:px-8 py-5 border-b border-border flex items-center justify-between">
          <h2 className="text-xl lg:text-2xl font-bold text-text-primary">
            Your Trades
            <span className="text-base font-normal text-text-muted ml-3">{filteredTrades.length} total</span>
          </h2>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-base text-text-secondary">{selectedIds.size} selected</span>
              <button onClick={() => setSelectedIds(new Set())} className="text-sm text-accent hover:text-accent-hover font-medium">Clear</button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                className="px-4 py-2 bg-loss/10 hover:bg-loss/20 disabled:opacity-50 text-loss text-sm font-semibold rounded-xl transition-colors">
                {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center text-text-muted text-lg">Loading trades...</div>
        ) : filteredTrades.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-text-secondary text-lg">
              {dateRange.label === 'All Time' && !hasStrategyFilter
                ? 'No trades yet. Click "Add Trade" to get started!'
                : hasStrategyFilter
                  ? `No trades match this period, type, and strategy ("${strategyFilterLabel}").`
                  : 'No trades found for the selected period.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead className="bg-surface-1">
                <tr>
                  <th className="pl-5 lg:pl-6 pr-1 py-4 w-10">
                    <input type="checkbox"
                      checked={paginatedTrades.length > 0 && paginatedTrades.every(t => selectedIds.has(t.id))}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-border bg-surface-2 text-accent focus:ring-accent/30 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 lg:px-5 py-4 text-left text-sm font-semibold text-text-muted uppercase tracking-wider">Ticker</th>
                  <th className="px-4 lg:px-5 py-4 text-left text-sm font-semibold text-text-muted uppercase tracking-wider">Type</th>
                  <th className="px-4 lg:px-5 py-4 text-left text-sm font-semibold text-text-muted uppercase tracking-wider">Side</th>
                  <th className="px-4 lg:px-5 py-4 text-left text-sm font-semibold text-text-muted uppercase tracking-wider">Entry</th>
                  <th className="px-4 lg:px-5 py-4 text-left text-sm font-semibold text-text-muted uppercase tracking-wider">Exit</th>
                  <th className="px-4 lg:px-5 py-4 text-right text-sm font-semibold text-text-muted uppercase tracking-wider">Return</th>
                  <th className="px-4 lg:px-5 py-4 text-right text-sm font-semibold text-text-muted uppercase tracking-wider">P/L</th>
                  <th className="px-4 lg:px-5 py-4 text-left text-sm font-semibold text-text-muted uppercase tracking-wider">Strategy</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTrades.map((trade) => (
                  <tr key={trade.id}
                    onClick={(e) => {
                      const el = e.target as HTMLElement;
                      if (el.tagName === 'INPUT' || el.closest('input')) return;
                      setViewTradeId(trade.id);
                      setDrawerMode('view');
                    }}
                    className={`border-b border-border hover:bg-card-hover transition-colors cursor-pointer ${selectedIds.has(trade.id) ? 'bg-accent/5' : ''}`}
                  >
                    <td className="pl-5 lg:pl-6 pr-1 py-4 w-10" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(trade.id)} onChange={() => toggleSelect(trade.id)}
                        className="w-4 h-4 rounded border-border bg-surface-2 text-accent focus:ring-accent/30 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 lg:px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-text-primary">{trade.ticker}</span>
                        <span className="inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded bg-surface-3 text-text-secondary uppercase">
                          {(trade.broker || 'webull') === 'tradethepool' ? 'TTP' : (trade.broker || 'webull') === 'robinhood' ? 'RH' : 'WB'}
                        </span>
                        {trade.isOpen && <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-lg bg-profit/10 text-profit">OPEN</span>}
                      </div>
                      {trade.entryTime && (
                        <div className="text-sm text-text-muted mt-0.5">{trade.entryTime.slice(0, 5)}{trade.exitTime ? ` → ${trade.exitTime.slice(0, 5)}` : ''}</div>
                      )}
                    </td>
                    <td className="px-4 lg:px-5 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-3 text-text-secondary">
                        {(trade.tradeType || (trade.holdingDays === 0 ? 'intraday' : 'swing')) === 'intraday' ? 'DAY' : 'SWING'}
                      </span>
                    </td>
                    <td className="px-4 lg:px-5 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-lg ${trade.direction === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>
                        {trade.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 lg:px-5 py-4 whitespace-nowrap">
                      <div className="text-base text-text-primary tabular-nums">${trade.entryPrice.toFixed(2)}</div>
                      <div className="text-sm text-text-muted">{formatJournalStoredDate(trade.entryDate)}</div>
                    </td>
                    <td className="px-4 lg:px-5 py-4 whitespace-nowrap">
                      {trade.exitPrice ? (
                        <>
                          <div className="text-base text-text-primary tabular-nums">${trade.exitPrice.toFixed(2)}</div>
                          {trade.exitDate && <div className="text-sm text-text-muted">{formatJournalStoredDate(trade.exitDate)}</div>}
                        </>
                      ) : <div className="text-base text-text-muted">—</div>}
                    </td>
                    <td className="px-4 lg:px-5 py-4 whitespace-nowrap text-right">
                      {trade.returnPct !== null ? (
                        <div className={`text-base font-semibold tabular-nums ${trade.returnPct > 0 ? 'text-profit' : trade.returnPct < 0 ? 'text-loss' : 'text-text-muted'}`}>
                          {trade.returnPct > 0 ? '+' : ''}{trade.returnPct.toFixed(2)}%
                        </div>
                      ) : <div className="text-base text-text-muted">—</div>}
                    </td>
                    <td className="px-4 lg:px-5 py-4 whitespace-nowrap text-right">
                      {trade.profitLoss !== null ? (
                        <div className={`text-base font-semibold tabular-nums ${trade.profitLoss > 0 ? 'text-profit' : trade.profitLoss < 0 ? 'text-loss' : 'text-text-muted'}`}>
                          {formatCurrency(trade.profitLoss)}
                        </div>
                      ) : <div className="text-base text-text-muted">—</div>}
                    </td>
                    <td className="px-4 lg:px-5 py-4">
                      <div className="text-base text-text-secondary max-w-[140px] truncate">{trade.strategy || '—'}</div>
                      {trade.notes && (
                        <div className="text-sm text-text-muted max-w-[140px] truncate mt-0.5" title={trade.notes}>{trade.notes}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredTrades.length > 0 && tradesTotalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 lg:px-8 py-5 border-t border-border bg-surface-1">
            <div className="text-text-secondary text-base">
              Showing {(tradesPageSafe - 1) * tradesPerPage + 1}–{Math.min(tradesPageSafe * tradesPerPage, filteredTrades.length)} of {filteredTrades.length}
            </div>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => { setTradesPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={tradesPageSafe <= 1}
                className="px-5 py-2.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed text-text-secondary rounded-xl transition-all text-base border border-border">
                Previous
              </button>
              <div className="flex items-center px-5 py-2.5 bg-accent text-white rounded-xl text-base font-medium">
                {tradesPageSafe} / {tradesTotalPages}
              </div>
              <button type="button"
                onClick={() => { setTradesPage(p => Math.min(tradesTotalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={tradesPageSafe >= tradesTotalPages}
                className="px-5 py-2.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed text-text-secondary rounded-xl transition-all text-base border border-border">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Trade Detail Drawer (View) ─── */}
      <TradeDetailDrawer
        tradeId={drawerMode === 'view' ? viewTradeId : null}
        onClose={() => { setViewTradeId(null); setDrawerMode(null); }}
        onEdit={trade => {
          setViewTradeId(null);
          setDrawerMode(null);
          handleEdit(trade);
        }}
        onDelete={handleDelete}
      />

      {/* ─── Edit/Add Trade Drawer ─── */}
      {drawerMode === 'edit' && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[70] transition-opacity" onClick={closeEditDrawer} />
          <div className="fixed inset-0 z-[71] flex justify-end pointer-events-none">
            <aside ref={editDrawerRef}
              className="pointer-events-auto h-full w-full sm:max-w-3xl xl:max-w-[56rem] bg-surface-1 shadow-2xl flex flex-col sm:border-l border-border animate-slide-in"
              role="dialog" aria-modal="true">
            {/* Drawer Header */}
            <div className="shrink-0 border-b border-border bg-surface-2 px-6 lg:px-8 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-text-primary">
                    {editingTrade ? 'Edit Trade' : 'Add New Trade'}
                  </h2>
                  {editingTrade && (editingTrade.source || 'manual') === 'webull' && (
                    <span className="inline-flex px-2.5 py-1 text-xs font-bold rounded-lg bg-surface-3 text-text-secondary border border-border">WEBULL</span>
                  )}
                </div>
                <button onClick={closeEditDrawer} className="shrink-0 text-text-muted hover:text-text-primary p-2 rounded-lg hover:bg-surface-3 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Ticker *</label>
                  <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="AAPL"
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent uppercase font-mono" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Trade Type *</label>
                  <select value={tradeType} onChange={(e) => { const v = e.target.value as 'swing' | 'intraday'; setTradeType(v); if (v === 'intraday') { setIsOpen(false); setExitDate(''); } }}
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent">
                    <option value="swing">Swing Trade</option>
                    <option value="intraday">Intraday / Day Trade</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Direction *</label>
                  <select value={direction} onChange={(e) => setDirection(e.target.value as 'long' | 'short')}
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent">
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Account</label>
                  <select value={brokerForm} onChange={(e) => setBrokerForm(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent">
                    <option value="webull">Webull</option>
                    <option value="robinhood">Robinhood</option>
                    <option value="tradethepool">TradeThePool</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Entry Price *</label>
                  <input type="number" step="0.01" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="150.00"
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Entry Date *</label>
                  <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Amount ($) *</label>
                  <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000"
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent" required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Entry Time</label>
                  <input type="time" step="1" value={entryTimeForm} onChange={(e) => setEntryTimeForm(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Exit Time</label>
                  <input type="time" step="1" value={exitTimeForm} onChange={(e) => setExitTimeForm(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                </div>
              </div>

              {isIntraday && (
                <div className="flex items-center gap-2 px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-secondary text-base">
                  <span className="shrink-0 text-text-muted">*</span>
                  <span>Intraday trade — exit date auto-set to entry date.</span>
                </div>
              )}

              {!isIntraday && (
                <div className="flex items-center space-x-3">
                  <input type="checkbox" id="isOpen" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)}
                    className="w-5 h-5 rounded border-border bg-surface-2 text-accent focus:ring-accent" />
                  <label htmlFor="isOpen" className="text-base text-text-secondary">Trade is still open</label>
                </div>
              )}

              {(isIntraday || !isOpen) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-secondary mb-2">Exit Price {!isIntraday && !isOpen ? '*' : ''}</label>
                    <input type="number" step="0.01" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder="155.00"
                      className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      required={!isIntraday ? !isOpen : false} />
                    {isIntraday && !exitPrice && <p className="text-sm text-text-muted mt-1.5">Leave empty if still in trade</p>}
                  </div>
                  {!isIntraday && (
                    <div>
                      <label className="block text-sm font-semibold text-text-secondary mb-2">Exit Date *</label>
                      <input type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)}
                        className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent" required={!isOpen} />
                    </div>
                  )}
                </div>
              )}

              {((isIntraday && exitPrice) || (!isIntraday && !isOpen)) && (
                <div>
                  <label className="block text-sm font-semibold text-text-secondary mb-2">Exit Reason</label>
                  <select value={exitReason} onChange={(e) => setExitReason(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent">
                    <option value="">Select exit reason...</option>
                    {exitReasonOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">Link to Analysis Report</label>
                <select value={selectedReportId} onChange={(e) => setSelectedReportId(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  disabled={!ticker || loadingReports}>
                  <option value="">None</option>
                  {loadingReports && <option value="" disabled>Searching reports for {ticker}...</option>}
                  {!loadingReports && ticker && tickerReports.length > 0 && (
                    <optgroup label={`Reports for ${ticker}`}>
                      {tickerReports.map(report => (
                        <option key={report.id} value={report.id}>
                          {report.type === 'strategy-analysis' ? 'Strategy' : report.type === 'technical-analysis' ? 'TA' : 'Deep'} — {report.title.substring(0, 35)}... ({new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {!ticker && <p className="text-sm text-text-muted mt-1.5">Enter a ticker to see available reports</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-text-secondary">Strategy</label>
                  <a href="/strategies" target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:text-accent-hover transition-colors">Manage Strategies →</a>
                </div>
                <select value={strategy} onChange={(e) => setStrategy(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent">
                  <option value="">Select a strategy...</option>
                  {dbStrategies.length > 0 && (
                    <optgroup label="Your Strategies">
                      {dbStrategies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was your thesis? How did it play out?" rows={3}
                  className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none" />
              </div>
            </form>

            {/* Drawer Footer */}
            <div className="shrink-0 border-t border-border bg-surface-2 px-6 lg:px-8 py-5">
              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeEditDrawer}
                  className="px-6 py-3 bg-surface-2 text-text-secondary border border-border rounded-xl text-base font-medium hover:bg-surface-3 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={saving} onClick={handleSubmit}
                  className="px-6 py-3 bg-accent text-white rounded-xl text-base font-semibold hover:bg-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'Saving...' : editingTrade ? 'Update Trade' : 'Add Trade'}
                </button>
              </div>
            </div>
          </aside>
          </div>
        </>
      )}
    </div>
  );
}
