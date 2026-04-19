'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Session } from 'next-auth';
import type { Trade } from './journal-types';
import TradeDetailDrawer from './trade-detail-drawer';
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

type TimePeriod = 'today' | 'yesterday' | 'week' | 'lastweek' | 'month' | 'lastmonth' | 'ytd' | '1year' | 'all';

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
  const [showModal, setShowModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [tickerReports, setTickerReports] = useState<SavedReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'intraday' | 'swing'>('all');
  /** '' = all strategies; otherwise trimmed strategy label (case-insensitive match on trades) */
  const [strategyFilter, setStrategyFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'webull'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [rehydratingOhlc, setRehydratingOhlc] = useState(false);
  const [viewTradeId, setViewTradeId] = useState<string | null>(null);
  const [tradesPage, setTradesPage] = useState(1);
  const tradesPerPage = 20;
  const modalRef = useRef<HTMLDivElement>(null);

  // Form state
  const [ticker, setTicker] = useState('');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [tradeType, setTradeType] = useState<'swing' | 'intraday'>('intraday');
  const [entryPrice, setEntryPrice] = useState('');
  const [entryDate, setEntryDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
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

  useEffect(() => { fetchTrades(); fetchSavedAnalyses(); fetchStrategies(); }, []);

  // Close modal on outside click
  useEffect(() => {
    if (!showModal) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        closeModal();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModal]);

  // Close modal on Escape key
  useEffect(() => {
    if (!showModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showModal]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = showModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

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

  // Get local date string YYYY-MM-DD without timezone shift
  const localDateStr = (d: Date = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Extract YYYY-MM-DD from a trade's ISO date string (stored as UTC midnight)
  const tradeDateStr = (isoString: string) => isoString.slice(0, 10);

  // Date range returns YYYY-MM-DD strings for comparison (avoids UTC/local mismatch)
  const normalizeStrategy = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
  const strategyFilterLabel = strategyFilter === '__none__' ? 'No Strategy' : strategyFilter.trim();
  const hasStrategyFilter = strategyFilter !== '';

  const getDateRange = (period: TimePeriod): { startStr: string | null; endStr: string } => {
    const now = new Date();
    const todayStr = localDateStr(now);

    switch (period) {
      case 'today':
        return { startStr: todayStr, endStr: todayStr };
      case 'yesterday': {
        const y = new Date(now);
        y.setDate(now.getDate() - 1);
        const yStr = localDateStr(y);
        return { startStr: yStr, endStr: yStr };
      }
      case 'week': {
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        return { startStr: localDateStr(monday), endStr: todayStr };
      }
      case 'lastweek': {
        const day = now.getDay();
        const thisMonday = new Date(now);
        thisMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        const lastMonday = new Date(thisMonday);
        lastMonday.setDate(thisMonday.getDate() - 7);
        const lastSunday = new Date(thisMonday);
        lastSunday.setDate(thisMonday.getDate() - 1);
        return { startStr: localDateStr(lastMonday), endStr: localDateStr(lastSunday) };
      }
      case 'month':
        return { startStr: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, endStr: todayStr };
      case 'lastmonth': {
        const firstOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastOfLast = new Date(now.getFullYear(), now.getMonth(), 0);
        return { startStr: localDateStr(firstOfLast), endStr: localDateStr(lastOfLast) };
      }
      case 'ytd':
        return { startStr: `${now.getFullYear()}-01-01`, endStr: todayStr };
      case '1year': {
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        return { startStr: localDateStr(oneYearAgo), endStr: todayStr };
      }
      case 'all':
        return { startStr: null, endStr: todayStr };
    }
  };

  const filteredTrades = useMemo(() => {
    let result = trades;

    // Period filter
    if (selectedPeriod !== 'all') {
      const { startStr, endStr } = getDateRange(selectedPeriod);
      if (startStr) {
        result = result.filter(trade => {
          const d = tradeDateStr(trade.entryDate);
          return d >= startStr && d <= endStr;
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

    // Strategy filter (win rate / P&L for this setup only)
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

    return [...result].sort((a, b) => {
      const kb = journalTradeSortKey(b);
      const ka = journalTradeSortKey(a);
      if (kb !== ka) return kb - ka;
      return b.id.localeCompare(a.id);
    });
  }, [trades, selectedPeriod, typeFilter, strategyFilter, sourceFilter]);

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
  }, [selectedPeriod, typeFilter, strategyFilter, sourceFilter]);

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

  const closeModal = () => {
    setShowModal(false);
    setEditingTrade(null);
  };

  const openAddModal = () => {
    resetForm();
    setEditingTrade(null);
    fetchStrategies();
    setShowModal(true);
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
        closeModal();
        resetForm();
        fetchTrades();
      } else {
        alert('Error saving trade: ' + data.error);
      }
    } catch { alert('Failed to save trade'); } finally { setSaving(false); }
  };

  const resetForm = () => {
    setTicker(''); setDirection('long'); setTradeType('intraday');
    setEntryPrice(''); setEntryDate(localDateStr());
    setExitPrice(''); setExitDate(''); setAmount('');
    setEntryTimeForm(''); setExitTimeForm('');
    setStrategy(''); setSelectedReportId(''); setNotes('');
    setIsOpen(false); setExitReason('');
  };

  const handleEdit = (trade: Trade) => {
    fetchStrategies();
    setEditingTrade(trade);
    setTicker(trade.ticker);
    setDirection(trade.direction);
    setTradeType(trade.tradeType || (trade.holdingDays === 0 ? 'intraday' : 'swing'));
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
    setShowModal(true);
  };

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

      const { startStr, endStr } = getDateRange(selectedPeriod);
      const periodLabels: Record<TimePeriod, string> = {
        today: 'Today', yesterday: 'Yesterday', week: 'This Week', lastweek: 'Last Week',
        month: 'This Month', lastmonth: 'Last Month', ytd: 'YTD', '1year': '1 Year', all: 'All Time',
      };
      const startDate = startStr ? new Date(startStr + 'T00:00:00.000Z').toISOString() : null;
      const endDate = new Date(endStr + 'T23:59:59.999Z').toISOString();
      const typeLabels: Record<string, string> = { all: '', intraday: ' (Day Trades)', swing: ' (Swing Trades)' };
      const stratSuffix = hasStrategyFilter ? ` • ${strategyFilterLabel}` : '';
      const periodLabel = periodLabels[selectedPeriod] + (typeLabels[typeFilter] || '') + stratSuffix;

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

  return (
    <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">Trading Journal</h1>
          <p className="text-text-secondary">Track your trades and discover patterns with AI analysis</p>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-text-secondary text-sm font-medium w-12">Period:</span>
            <div className="flex gap-2 flex-wrap">
              {([
                { value: 'today' as TimePeriod, label: 'Today' },
                { value: 'yesterday' as TimePeriod, label: 'Yesterday' },
                { value: 'week' as TimePeriod, label: 'This Week' },
                { value: 'lastweek' as TimePeriod, label: 'Last Week' },
                { value: 'month' as TimePeriod, label: 'This Month' },
                { value: 'lastmonth' as TimePeriod, label: 'Last Month' },
                { value: 'ytd' as TimePeriod, label: 'YTD' },
                { value: '1year' as TimePeriod, label: '1 Year' },
                { value: 'all' as TimePeriod, label: 'All Time' },
              ]).map(period => (
                <button
                  key={period.value}
                  onClick={() => setSelectedPeriod(period.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedPeriod === period.value
                    ? 'bg-accent text-white'
                    : 'bg-surface-2 text-text-secondary border border-border hover:bg-surface-3'
                    }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-text-secondary text-sm font-medium w-12">Type:</span>
            <div className="flex gap-2 flex-wrap">
              {([
                { value: 'all' as const, label: 'All' },
                { value: 'intraday' as const, label: 'Day Trades' },
                { value: 'swing' as const, label: 'Swing Trades' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTypeFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${typeFilter === opt.value
                    ? 'bg-accent text-white'
                    : 'bg-surface-2 text-text-secondary border border-border hover:bg-surface-3'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-text-secondary text-sm font-medium w-12 shrink-0">Strategy:</span>
            <select
              value={strategyFilter}
              onChange={e => setStrategyFilter(e.target.value)}
              className="min-w-[200px] max-w-md px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            >
              <option value="">All strategies</option>
              {hasTradesWithNoStrategy && (
                <option value="__none__">No Strategy</option>
              )}
              {strategyChoices.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {strategyFilter && (
              <span className="text-xs text-text-muted">
                Stats and table show only this strategy in the period above
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-text-secondary text-sm font-medium w-12 shrink-0">Source:</span>
            <div className="flex gap-2 flex-wrap">
              {([
                { value: 'all' as const, label: 'All Sources' },
                { value: 'manual' as const, label: 'Manual' },
                { value: 'webull' as const, label: 'Webull' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSourceFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${sourceFilter === opt.value
                    ? 'bg-accent text-white'
                    : 'bg-surface-2 text-text-secondary border border-border hover:bg-surface-3'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        {filteredSummary && (
          <div className="mb-8">
            {hasStrategyFilter && (
              <p className="text-sm text-text-secondary mb-3">
                Showing stats for <span className="font-semibold text-text-primary">{strategyFilterLabel}</span> only (with Period + Type filters above).
              </p>
            )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-1 border border-border rounded-xl p-4">
              <div className="text-text-secondary text-sm mb-1">Total Trades</div>
              <div className="text-2xl font-bold text-text-primary">{filteredSummary.totalTrades}</div>
              <div className="text-xs text-text-muted mt-1">{filteredSummary.totalOpen} open, {filteredSummary.totalClosed} closed</div>
            </div>
            <div className="bg-surface-1 border border-border rounded-xl p-4">
              <div className="text-text-secondary text-sm mb-1">Win Rate</div>
              <div className={`text-2xl font-bold ${filteredSummary.winRate >= 50 ? 'text-profit' : 'text-loss'}`}>{filteredSummary.winRate}%</div>
              <div className="text-xs text-text-muted mt-1">{filteredSummary.winningTrades}W / {filteredSummary.losingTrades}L</div>
            </div>
            <div className="bg-surface-1 border border-border rounded-xl p-4">
              <div className="text-text-secondary text-sm mb-1">Total P/L</div>
              <div className={`text-2xl font-bold ${filteredSummary.totalPL >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(filteredSummary.totalPL)}</div>
              <div className="text-xs text-text-muted mt-1">Avg: {formatCurrency(filteredSummary.avgPL)}</div>
            </div>
            <div className="bg-surface-1 border border-border rounded-xl p-4">
              <div className="text-text-secondary text-sm mb-1">Avg Return</div>
              <div className={`text-2xl font-bold ${filteredSummary.avgReturn >= 0 ? 'text-profit' : 'text-loss'}`}>{filteredSummary.avgReturn > 0 ? '+' : ''}{filteredSummary.avgReturn}%</div>
              <div className="text-xs text-text-muted mt-1">{filteredSummary.avgHoldDetail}</div>
            </div>
          </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-all"
          >
            + Add Trade
          </button>
          <button
            type="button"
            onClick={() => void handleRehydrateOhlc()}
            disabled={rehydratingOhlc || filteredTrades.length === 0}
            className="px-4 py-2 bg-surface-2 border border-border text-text-secondary rounded-lg font-medium hover:bg-surface-3 transition-all disabled:opacity-45 disabled:cursor-not-allowed"
            title="Re-run Polygon for trades matching Period, Type, Strategy, and Source filters (not the whole journal)"
          >
            {rehydratingOhlc ? 'Refreshing...' : `Refresh OHLC (${filteredTrades.length})`}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || filteredClosedCount === 0}
            className="px-4 py-2 bg-surface-2 border border-border text-text-secondary rounded-lg font-medium hover:bg-surface-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing
              ? 'Analyzing...'
              : `AI Analysis (${filteredClosedCount} closed${typeFilter === 'intraday' ? ' day' : typeFilter === 'swing' ? ' swing' : ''} trades${hasStrategyFilter ? ` · ${strategyFilterLabel}` : ''})`}
          </button>
          {filteredClosedCount === 0 && filteredTrades.length > 0 && (
            <span className="text-xs text-text-muted self-center">No closed trades in filter -- add exit data or change filters</span>
          )}
          {savedAnalyses.length > 0 && (
            <button
              onClick={() => setShowSavedAnalyses(!showSavedAnalyses)}
              className="px-4 py-2 bg-surface-2 border border-border text-text-secondary rounded-lg font-medium hover:bg-surface-3 transition-all"
            >
              {showSavedAnalyses ? 'Hide' : 'View'} Past Analyses ({savedAnalyses.length})
            </button>
          )}
        </div>

        {/* Analysis Progress Bar */}
        {analyzing && (
          <div className="bg-surface-1 border border-border rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold text-text-primary mb-4">Generating AI Analysis...</h3>
            <div className="space-y-3">
              {ANALYSIS_STEPS.map((step, i) => {
                const isActive = i === analysisStep;
                const isDone = i < analysisStep;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      isDone ? 'bg-accent text-white' : isActive ? 'bg-surface-4 text-text-primary animate-pulse' : 'bg-surface-2 text-text-muted'
                    }`}>
                      {isDone ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      ) : isActive ? (
                        <div className="w-2.5 h-2.5 bg-text-primary rounded-full" />
                      ) : (
                        <div className="w-2 h-2 bg-surface-4 rounded-full" />
                      )}
                    </div>
                    <span className={`text-sm transition-all ${isDone ? 'text-accent' : isActive ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-1000"
                style={{ width: `${((analysisStep + 1) / ANALYSIS_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* AI Analysis Result */}
        {aiAnalysis && !analyzing && (
          <div className="bg-surface-1 border border-border rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-text-primary">AI Performance Report</h2>
                {aiAnalysisMeta && (
                  <p className="text-xs text-text-muted mt-1">
                    {aiAnalysisMeta.periodLabel} &middot; {aiAnalysisMeta.tradesAnalyzed} trades
                    {aiAnalysisMeta.intradayCount > 0 && ` (${aiAnalysisMeta.intradayCount} day`}{aiAnalysisMeta.intradayCount > 0 && aiAnalysisMeta.swingCount > 0 ? ', ' : aiAnalysisMeta.intradayCount > 0 ? ')' : ''}
                    {aiAnalysisMeta.swingCount > 0 && `${aiAnalysisMeta.intradayCount > 0 ? '' : ' ('}${aiAnalysisMeta.swingCount} swing)`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {aiAnalysisMeta && (
                  <button
                    onClick={handleSaveAnalysis}
                    disabled={savingAnalysis}
                    className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingAnalysis ? (
                      <><svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>Save Report</>
                    )}
                  </button>
                )}
                <button onClick={() => { setAiAnalysis(null); setAiAnalysisMeta(null); }} className="text-text-muted hover:text-text-primary transition-colors text-xl leading-none">&times;</button>
              </div>
            </div>
            <div className="prose prose-invert prose-sm max-w-none text-text-secondary leading-relaxed whitespace-pre-wrap">{aiAnalysis}</div>
          </div>
        )}

        {/* Saved Analyses (inline preview -- full list on /journal/analyses) */}
        {showSavedAnalyses && savedAnalyses.length > 0 && (
          <div className="bg-surface-1 border border-border rounded-xl mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">Past Analyses</h2>
              <a href="/journal/analyses" className="text-accent hover:text-accent-hover text-sm font-medium transition-colors">View All &rarr;</a>
            </div>
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {savedAnalyses.slice(0, 10).map(a => (
                <div key={a.id} className="flex items-center justify-between px-6 py-3 hover:bg-card-hover transition-colors group">
                  <button
                    onClick={() => { setAiAnalysis(a.analysis); setAiAnalysisMeta(null); setShowSavedAnalyses(false); }}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-text-primary font-medium text-sm">{a.periodLabel}</span>
                      <span className="text-text-muted text-xs">
                        {a.tradesAnalyzed} trades
                        {a.intradayCount > 0 && ` · ${a.intradayCount} day`}
                        {a.swingCount > 0 && ` · ${a.swingCount} swing`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs mt-0.5">
                      {a.winRate !== null && (
                        <span className={a.winRate >= 50 ? 'text-profit' : 'text-loss'}>{a.winRate}% WR</span>
                      )}
                      {a.totalPL !== null && (
                        <span className={a.totalPL >= 0 ? 'text-profit' : 'text-loss'}>{formatCurrency(a.totalPL)}</span>
                      )}
                      <span className="text-text-muted">
                        {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteAnalysis(a.id)}
                    className="ml-3 text-text-muted hover:text-loss opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trades List */}
        <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">Your Trades</h2>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">{selectedIds.size} selected</span>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-accent hover:text-accent-hover"
                >
                  Clear
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="px-3 py-1.5 bg-loss/10 hover:bg-loss/20 disabled:opacity-50 text-loss text-xs font-medium rounded-lg transition-colors"
                >
                  {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-text-secondary">Loading trades...</div>
          ) : filteredTrades.length === 0 ? (
            <div className="px-6 py-12 text-center text-text-secondary">
              {selectedPeriod === 'all' && !hasStrategyFilter
                ? 'No trades yet. Click "Add Trade" to get started!'
                : hasStrategyFilter
                  ? `No trades match this period, type, and strategy ("${strategyFilterLabel}").`
                  : 'No trades found for the selected period.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-1">
                  <tr>
                    <th className="pl-4 pr-1 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={paginatedTrades.length > 0 && paginatedTrades.every(t => selectedIds.has(t.id))}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 rounded border-border bg-surface-2 text-accent focus:ring-accent/30 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Ticker</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Dir</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Entry</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Exit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Return</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">P/L</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Strategy</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTrades.map((trade) => (
                    <tr key={trade.id} className={`border-b border-border hover:bg-card-hover transition-colors ${selectedIds.has(trade.id) ? 'bg-accent/5' : ''}`}>
                      <td className="pl-4 pr-1 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(trade.id)}
                          onChange={() => toggleSelect(trade.id)}
                          className="w-3.5 h-3.5 rounded border-border bg-surface-2 text-accent focus:ring-accent/30 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-text-primary">{trade.ticker}</span>
                          {(trade.source || 'manual') === 'webull' && (
                            <span className="inline-flex px-1.5 py-0.5 text-[9px] font-bold rounded bg-surface-3 text-text-secondary uppercase">WB</span>
                          )}
                        </div>
                        {trade.isOpen && <div className="text-xs text-profit">Open</div>}
                        {trade.entryTime && (
                          <div className="text-[10px] text-text-muted">{trade.entryTime.slice(0, 5)}{trade.exitTime ? ` → ${trade.exitTime.slice(0, 5)}` : ''}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-surface-3 text-text-secondary">
                          {(trade.tradeType || (trade.holdingDays === 0 ? 'intraday' : 'swing')) === 'intraday' ? 'DAY' : 'SWING'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${trade.direction === 'long'
                          ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>
                          {trade.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-text-primary">${trade.entryPrice.toFixed(2)}</div>
                        <div className="text-xs text-text-muted">{formatJournalStoredDate(trade.entryDate)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {trade.exitPrice ? (
                          <>
                            <div className="text-sm text-text-primary">${trade.exitPrice.toFixed(2)}</div>
                            {trade.exitDate && <div className="text-xs text-text-muted">{formatJournalStoredDate(trade.exitDate)}</div>}
                          </>
                        ) : (<div className="text-sm text-text-muted">—</div>)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {trade.returnPct !== null ? (
                          <div className={`text-sm font-semibold ${trade.returnPct > 0 ? 'text-profit' : trade.returnPct < 0 ? 'text-loss' : 'text-text-muted'}`}>
                            {trade.returnPct > 0 ? '+' : ''}{trade.returnPct.toFixed(2)}%
                          </div>
                        ) : (<div className="text-sm text-text-muted">—</div>)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {trade.profitLoss !== null ? (
                          <div className={`text-sm font-semibold ${trade.profitLoss > 0 ? 'text-profit' : trade.profitLoss < 0 ? 'text-loss' : 'text-text-muted'}`}>
                            {formatCurrency(trade.profitLoss)}
                          </div>
                        ) : (<div className="text-sm text-text-muted">—</div>)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-text-secondary max-w-[120px] truncate">{trade.strategy || '—'}</div>
                        {trade.notes && (
                          <div className="text-xs text-text-muted max-w-[120px] truncate mt-0.5" title={trade.notes}>{trade.notes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        <div className="flex flex-wrap justify-end gap-x-2 gap-y-1">
                          <button
                            type="button"
                            onClick={() => setViewTradeId(trade.id)}
                            className="text-accent hover:text-accent-hover font-medium"
                          >
                            View
                          </button>
                          <button type="button" onClick={() => handleEdit(trade)} className="text-text-secondary hover:text-text-primary">
                            Edit
                          </button>
                          <button type="button" onClick={() => void handleDelete(trade.id)} className="text-loss hover:text-loss">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredTrades.length > 0 && tradesTotalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-border bg-surface-1">
              <div className="text-text-secondary text-sm">
                Showing {(tradesPageSafe - 1) * tradesPerPage + 1}–{Math.min(tradesPageSafe * tradesPerPage, filteredTrades.length)} of {filteredTrades.length} trades
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setTradesPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={tradesPageSafe <= 1}
                  className="px-4 py-2 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed text-text-secondary rounded-lg transition-all text-sm border border-border"
                >
                  Previous
                </button>
                <div className="flex items-center px-4 py-2 bg-accent text-white rounded-lg text-sm">
                  Page {tradesPageSafe} of {tradesTotalPages}
                </div>
                <button
                  type="button"
                  onClick={() => { setTradesPage(p => Math.min(tradesTotalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={tradesPageSafe >= tradesTotalPages}
                  className="px-4 py-2 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed text-text-secondary rounded-lg transition-all text-sm border border-border"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      <TradeDetailDrawer
        tradeId={viewTradeId}
        onClose={() => setViewTradeId(null)}
        onEdit={trade => {
          setViewTradeId(null);
          handleEdit(trade);
        }}
        onDelete={handleDelete}
      />

      {/* ==================== MODAL FORM ==================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div ref={modalRef} className="bg-surface-1 border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface-1 z-10 rounded-t-xl">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-text-primary">
                  {editingTrade ? 'Edit Trade' : 'Add New Trade'}
                </h2>
                {editingTrade && (editingTrade.source || 'manual') === 'webull' && (
                  <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded bg-surface-3 text-text-secondary border border-border">
                    WEBULL IMPORT
                  </span>
                )}
              </div>
              <button onClick={closeModal} className="text-text-muted hover:text-text-primary text-2xl leading-none transition-colors">&times;</button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Row 1: Ticker, Trade Type, Direction */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Ticker *</label>
                  <input
                    type="text" value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent uppercase font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Trade Type *</label>
                  <select
                    value={tradeType}
                    onChange={(e) => {
                      const val = e.target.value as 'swing' | 'intraday';
                      setTradeType(val);
                      if (val === 'intraday') { setIsOpen(false); setExitDate(''); }
                    }}
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    <option value="swing">Swing Trade</option>
                    <option value="intraday">Intraday / Day Trade</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Direction *</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as 'long' | 'short')}
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Entry Price, Entry Date, Amount */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Entry Price *</label>
                  <input type="number" step="0.01" value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)} placeholder="150.00"
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Entry Date *</label>
                  <input type="date" value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Amount ($) *</label>
                  <input type="number" step="0.01" value={amount}
                    onChange={(e) => setAmount(e.target.value)} placeholder="1000"
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                    required
                  />
                </div>
              </div>

              {/* Entry / Exit Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Entry Time</label>
                  <input type="time" step="1" value={entryTimeForm}
                    onChange={(e) => setEntryTimeForm(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                  <p className="text-xs text-text-muted mt-1">Optional -- for intraday precision</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Exit Time</label>
                  <input type="time" step="1" value={exitTimeForm}
                    onChange={(e) => setExitTimeForm(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Intraday info banner */}
              {isIntraday && (
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-secondary text-sm">
                  <span className="shrink-0 text-text-muted">*</span>
                  <span>Intraday trade -- exit date auto-set to entry date. No &quot;open trade&quot; needed.</span>
                </div>
              )}

              {/* Swing: Trade Open checkbox */}
              {!isIntraday && (
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="isOpen" checked={isOpen}
                    onChange={(e) => setIsOpen(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-surface-2 text-accent focus:ring-accent"
                  />
                  <label htmlFor="isOpen" className="text-sm text-text-secondary">Trade is still open</label>
                </div>
              )}

              {/* Exit fields - shown when trade is closed */}
              {(isIntraday || !isOpen) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Exit Price {!isIntraday && !isOpen ? '*' : ''}
                    </label>
                    <input type="number" step="0.01" value={exitPrice}
                      onChange={(e) => setExitPrice(e.target.value)} placeholder="155.00"
                      className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      required={!isIntraday ? !isOpen : false}
                    />
                    {isIntraday && !exitPrice && (
                      <p className="text-xs text-text-muted mt-1">Leave empty if still in trade</p>
                    )}
                  </div>

                  {/* Exit Date - only for swing trades */}
                  {!isIntraday && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">Exit Date *</label>
                      <input type="date" value={exitDate}
                        onChange={(e) => setExitDate(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        required={!isOpen}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Exit Reason - shown when closed */}
              {((isIntraday && exitPrice) || (!isIntraday && !isOpen)) && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Exit Reason</label>
                  <select value={exitReason} onChange={(e) => setExitReason(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    <option value="">Select exit reason...</option>
                    {exitReasonOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Link to Saved Report */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Link to Analysis Report</label>
                <select value={selectedReportId} onChange={(e) => setSelectedReportId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  disabled={!ticker || loadingReports}
                >
                  <option value="">None</option>
                  {loadingReports && <option value="" disabled>Searching reports for {ticker}...</option>}
                  {!loadingReports && ticker && tickerReports.length > 0 && (
                    <optgroup label={`Reports for ${ticker}`}>
                      {tickerReports.map(report => (
                        <option key={report.id} value={report.id}>
                          {report.type === 'strategy-analysis' ? 'Strategy' : report.type === 'technical-analysis' ? 'TA' : 'Deep'} — {report.title.substring(0, 35)}... ({new Date(report.createdAt).toLocaleDateString()})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {!ticker && <p className="text-xs text-text-muted mt-1">Enter a ticker to see available reports</p>}
              </div>

              {/* Strategy */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-text-secondary">Strategy</label>
                  <a href="/strategies" target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-accent hover:text-accent-hover transition-colors">
                    Manage Strategies →
                  </a>
                </div>
                <select value={strategy} onChange={(e) => setStrategy(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  <option value="">Select a strategy...</option>
                  {dbStrategies.length > 0 && (
                    <optgroup label="Your Strategies">
                      {dbStrategies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="What was your thesis? How did it play out?"
                  rows={2}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <button type="button" onClick={closeModal}
                  className="px-5 py-2 bg-surface-2 text-text-secondary border border-border rounded-lg font-medium hover:bg-surface-3 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'Saving...' : editingTrade ? 'Update Trade' : 'Add Trade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
