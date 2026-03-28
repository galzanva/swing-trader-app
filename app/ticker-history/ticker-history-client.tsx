'use client';

import { useState, useEffect, useMemo } from 'react';
import { Session } from 'next-auth';
import Navbar from '../components/navbar';
import Link from 'next/link';

interface WashSaleDetails {
  inWashSalePeriod: boolean;
  daysRemaining: number;
  lastLossDate: string | null;
  lastLossAmount: number | null;
  totalLossesInWindow: number;
}

interface TickerTrade {
  id: string;
  direction: string;
  tradeType: string;
  entryPrice: number;
  entryDate: string;
  exitPrice: number | null;
  exitDate: string | null;
  returnPct: number | null;
  profitLoss: number | null;
  strategy: string | null;
  isOpen: boolean;
}

interface TickerStats {
  ticker: string;
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPL: number;
  avgReturn: number;
  avgRMultiple: number | null;
  firstTradeDate: string;
  lastTradeDate: string;
  lastExitDate: string | null;
  daysSinceLastTrade: number;
  washSaleWarning: boolean;
  washSaleDetails: WashSaleDetails;
  trades: TickerTrade[];
}

interface TickerHistoryClientProps {
  session: Session;
}

export default function TickerHistoryClient({ session }: TickerHistoryClientProps) {
  const [tickers, setTickers] = useState<TickerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTicker, setSelectedTicker] = useState<TickerStats | null>(null);
  const [filterWashSale, setFilterWashSale] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'pl' | 'trades' | 'winrate'>('recent');
  const [tickerListPage, setTickerListPage] = useState(1);
  const [tradeDetailPage, setTradeDetailPage] = useState(1);
  const tickersPerPage = 15;
  const tradesPerPage = 20;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/journal/ticker-history');
      const data = await response.json();
      if (data.success) setTickers(data.tickers);
    } catch { /* */ } finally { setLoading(false); }
  };

  const filteredTickers = useMemo(() => {
    let result = tickers;
    if (search) {
      const s = search.toUpperCase();
      result = result.filter(t => t.ticker.includes(s));
    }
    if (filterWashSale) {
      result = result.filter(t => t.washSaleWarning);
    }
    switch (sortBy) {
      case 'pl': result = [...result].sort((a, b) => b.totalPL - a.totalPL); break;
      case 'trades': result = [...result].sort((a, b) => b.totalTrades - a.totalTrades); break;
      case 'winrate': result = [...result].sort((a, b) => b.winRate - a.winRate); break;
      default: break; // already sorted by most recent
    }
    return result;
  }, [tickers, search, filterWashSale, sortBy]);

  useEffect(() => {
    setTickerListPage(1);
  }, [search, filterWashSale, sortBy]);

  useEffect(() => {
    setTradeDetailPage(1);
  }, [selectedTicker?.ticker]);

  const tickerListTotalPages = Math.max(1, Math.ceil(filteredTickers.length / tickersPerPage));
  const tickerListPageSafe = Math.min(tickerListPage, tickerListTotalPages);
  const paginatedTickerList = useMemo(() => {
    const start = (tickerListPageSafe - 1) * tickersPerPage;
    return filteredTickers.slice(start, start + tickersPerPage);
  }, [filteredTickers, tickerListPageSafe, tickersPerPage]);

  const tradeDetailTotalPages = selectedTicker
    ? Math.max(1, Math.ceil(selectedTicker.trades.length / tradesPerPage))
    : 1;
  const tradeDetailPageSafe = selectedTicker
    ? Math.min(tradeDetailPage, tradeDetailTotalPages)
    : 1;
  const paginatedDetailTrades = useMemo(() => {
    if (!selectedTicker) return [];
    const start = (tradeDetailPageSafe - 1) * tradesPerPage;
    return selectedTicker.trades.slice(start, start + tradesPerPage);
  }, [selectedTicker, tradeDetailPageSafe, tradesPerPage]);

  const washSaleCount = tickers.filter(t => t.washSaleWarning).length;
  const overallPL = tickers.reduce((sum, t) => sum + t.totalPL, 0);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  };

  const formatCurrency = (value: number) => {
    return value >= 0 ? `$${value.toFixed(2)}` : `-$${Math.abs(value).toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Ticker History</h1>
          <p className="text-blue-200">Per-ticker performance, trade history, and wash sale rule tracking</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-lg p-4">
            <div className="text-blue-200 text-sm mb-1">Tickers Traded</div>
            <div className="text-2xl font-bold text-white">{tickers.length}</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-lg p-4">
            <div className="text-blue-200 text-sm mb-1">Overall P/L</div>
            <div className={`text-2xl font-bold ${overallPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(overallPL)}
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-lg p-4">
            <div className="text-blue-200 text-sm mb-1">Total Trades</div>
            <div className="text-2xl font-bold text-white">{tickers.reduce((s, t) => s + t.totalTrades, 0)}</div>
          </div>
          <div className={`backdrop-blur-lg border rounded-lg p-4 ${washSaleCount > 0 ? 'bg-red-900/30 border-red-500/30' : 'bg-slate-800/50 border-white/10'}`}>
            <div className={`text-sm mb-1 ${washSaleCount > 0 ? 'text-red-300' : 'text-blue-200'}`}>Wash Sale Warnings</div>
            <div className={`text-2xl font-bold ${washSaleCount > 0 ? 'text-red-400' : 'text-green-400'}`}>{washSaleCount}</div>
            {washSaleCount > 0 && <div className="text-xs text-red-300 mt-1">Review before re-entering</div>}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value.toUpperCase()); setSelectedTicker(null); }}
              placeholder="Search ticker..."
              className="w-full px-4 py-2.5 pl-10 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-500 uppercase font-mono"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <button
            onClick={() => setFilterWashSale(!filterWashSale)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              filterWashSale
                ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                : 'bg-slate-800/50 border border-white/10 text-blue-200 hover:bg-slate-700/50'
            }`}
          >
            {filterWashSale ? 'Showing Wash Sale Only' : 'Wash Sale Filter'}
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-blue-200 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="recent">Most Recent</option>
            <option value="pl">P/L (High to Low)</option>
            <option value="trades">Most Trades</option>
            <option value="winrate">Best Win Rate</option>
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center text-blue-200 py-12">Loading ticker history...</div>
        ) : selectedTicker ? (
          /* ==================== TICKER DETAIL VIEW ==================== */
          <div className="space-y-6">
            <button
              onClick={() => setSelectedTicker(null)}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1"
            >
              <span>&larr;</span> Back to all tickers
            </button>

            {/* Ticker Header */}
            <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-xl p-6">
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <h2 className="text-3xl font-bold text-white font-mono">{selectedTicker.ticker}</h2>
                {selectedTicker.washSaleWarning && (
                  <span className="px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full text-sm font-medium">
                    Wash Sale Warning
                  </span>
                )}
                <Link
                  href={`/technical-analysis?symbol=${selectedTicker.ticker}`}
                  className="ml-auto px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 rounded-lg text-sm font-medium hover:bg-indigo-600/30 transition-all"
                >
                  Run Analysis
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                <div>
                  <div className="text-xs text-blue-300 mb-0.5">Total Trades</div>
                  <div className="text-xl font-bold text-white">{selectedTicker.totalTrades}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-300 mb-0.5">Win Rate</div>
                  <div className={`text-xl font-bold ${selectedTicker.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{selectedTicker.winRate}%</div>
                  <div className="text-xs text-blue-300">{selectedTicker.wins}W / {selectedTicker.losses}L</div>
                </div>
                <div>
                  <div className="text-xs text-blue-300 mb-0.5">Total P/L</div>
                  <div className={`text-xl font-bold ${selectedTicker.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(selectedTicker.totalPL)}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-300 mb-0.5">Avg Return</div>
                  <div className={`text-xl font-bold ${selectedTicker.avgReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>{selectedTicker.avgReturn > 0 ? '+' : ''}{selectedTicker.avgReturn}%</div>
                </div>
                <div>
                  <div className="text-xs text-blue-300 mb-0.5">First Trade</div>
                  <div className="text-sm text-white">{formatDate(selectedTicker.firstTradeDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-300 mb-0.5">Last Trade</div>
                  <div className="text-sm text-white">{formatDate(selectedTicker.lastTradeDate)}</div>
                  <div className="text-xs text-blue-300">{selectedTicker.daysSinceLastTrade}d ago</div>
                </div>
              </div>
            </div>

            {/* Wash Sale Details */}
            {selectedTicker.washSaleWarning && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-red-300 mb-3">Wash Sale Rule Warning</h3>
                <p className="text-sm text-red-200 mb-4 leading-relaxed">
                  The IRS wash sale rule disallows a tax deduction for a loss if you buy the same or &quot;substantially identical&quot; security within 30 days before or after selling at a loss.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-red-900/30 rounded-lg p-3">
                    <div className="text-xs text-red-300 mb-0.5">Days Remaining</div>
                    <div className="text-2xl font-bold text-red-400">{selectedTicker.washSaleDetails.daysRemaining}</div>
                    <div className="text-xs text-red-300">of 30 day window</div>
                  </div>
                  <div className="bg-red-900/30 rounded-lg p-3">
                    <div className="text-xs text-red-300 mb-0.5">Last Loss Date</div>
                    <div className="text-sm font-medium text-white">{selectedTicker.washSaleDetails.lastLossDate ? formatDate(selectedTicker.washSaleDetails.lastLossDate) : '—'}</div>
                  </div>
                  <div className="bg-red-900/30 rounded-lg p-3">
                    <div className="text-xs text-red-300 mb-0.5">Last Loss Amount</div>
                    <div className="text-lg font-bold text-red-400">{selectedTicker.washSaleDetails.lastLossAmount !== null ? formatCurrency(selectedTicker.washSaleDetails.lastLossAmount) : '—'}</div>
                  </div>
                  <div className="bg-red-900/30 rounded-lg p-3">
                    <div className="text-xs text-red-300 mb-0.5">Total Losses (30d)</div>
                    <div className="text-lg font-bold text-red-400">{formatCurrency(-selectedTicker.washSaleDetails.totalLossesInWindow)}</div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-red-900/20 rounded-lg text-sm text-red-300">
                  <strong>Action:</strong> Wait until {selectedTicker.washSaleDetails.daysRemaining} more day{selectedTicker.washSaleDetails.daysRemaining !== 1 ? 's' : ''} before re-entering {selectedTicker.ticker} to avoid wash sale disallowance, or consult a tax professional.
                </div>
              </div>
            )}

            {!selectedTicker.washSaleWarning && selectedTicker.closedTrades > 0 && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-green-300 text-sm">
                  <span className="text-lg">✓</span>
                  <span>No wash sale concern — last loss (if any) was more than 30 days ago or no losses recorded.</span>
                </div>
              </div>
            )}

            {/* Trade History Table */}
            <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h3 className="text-lg font-bold text-white">Trade History for {selectedTicker.ticker}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-blue-200 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-blue-200 uppercase">Dir</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-blue-200 uppercase">Entry</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-blue-200 uppercase">Exit</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-blue-200 uppercase">Return</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-blue-200 uppercase">P/L</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-blue-200 uppercase">Strategy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {paginatedDetailTrades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            trade.tradeType === 'intraday' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {trade.tradeType === 'intraday' ? 'DAY' : 'SWING'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                            trade.direction === 'long' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                          }`}>
                            {trade.direction.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-white">${trade.entryPrice.toFixed(2)}</div>
                          <div className="text-xs text-blue-300">{formatDate(trade.entryDate)}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {trade.exitPrice ? (
                            <>
                              <div className="text-sm text-white">${trade.exitPrice.toFixed(2)}</div>
                              {trade.exitDate && <div className="text-xs text-blue-300">{formatDate(trade.exitDate)}</div>}
                            </>
                          ) : (
                            <div className="text-sm text-green-400">Open</div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {trade.returnPct !== null ? (
                            <span className={`text-sm font-semibold ${trade.returnPct > 0 ? 'text-green-400' : trade.returnPct < 0 ? 'text-red-400' : 'text-blue-300'}`}>
                              {trade.returnPct > 0 ? '+' : ''}{trade.returnPct.toFixed(2)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {trade.profitLoss !== null ? (
                            <span className={`text-sm font-semibold ${trade.profitLoss > 0 ? 'text-green-400' : trade.profitLoss < 0 ? 'text-red-400' : 'text-blue-300'}`}>
                              {formatCurrency(trade.profitLoss)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-200">{trade.strategy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedTicker.trades.length > tradesPerPage && tradeDetailTotalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-slate-900/30">
                  <div className="text-blue-200 text-sm">
                    Showing {(tradeDetailPageSafe - 1) * tradesPerPage + 1}–{Math.min(tradeDetailPageSafe * tradesPerPage, selectedTicker.trades.length)} of {selectedTicker.trades.length} trades
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setTradeDetailPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={tradeDetailPageSafe <= 1}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-lg transition-all disabled:text-blue-300 text-sm"
                    >
                      Previous
                    </button>
                    <div className="flex items-center px-4 py-2 bg-teal-600/20 text-white rounded-lg border border-teal-500/30 text-sm">
                      Page {tradeDetailPageSafe} of {tradeDetailTotalPages}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setTradeDetailPage(p => Math.min(tradeDetailTotalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={tradeDetailPageSafe >= tradeDetailTotalPages}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-lg transition-all disabled:text-blue-300 text-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ==================== TICKER LIST VIEW ==================== */
          <div className="space-y-3">
            {filteredTickers.length === 0 ? (
              <div className="text-center text-blue-200 py-12">
                {search ? `No tickers matching "${search}"` : 'No trades recorded yet. Add trades in your Trading Journal.'}
              </div>
            ) : (
              paginatedTickerList.map(t => (
                <button
                  key={t.ticker}
                  onClick={() => setSelectedTicker(t)}
                  className="w-full text-left bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-xl p-4 hover:bg-slate-700/50 hover:border-white/20 transition-all group"
                >
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center gap-3 min-w-[120px]">
                      <span className="text-lg font-bold text-white font-mono">{t.ticker}</span>
                      {t.washSaleWarning && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          Wash Sale
                        </span>
                      )}
                      {t.openTrades > 0 && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full text-[10px] font-bold">
                          {t.openTrades} Open
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-blue-300">{t.totalTrades} trades</span>
                        <span className="text-blue-400 mx-1">•</span>
                        <span className={t.winRate >= 50 ? 'text-green-400' : 'text-red-400'}>{t.winRate}% WR</span>
                      </div>
                      <div className={`font-semibold ${t.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(t.totalPL)}
                      </div>
                      <div className={`text-sm ${t.avgReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        avg {t.avgReturn > 0 ? '+' : ''}{t.avgReturn}%
                      </div>
                      <div className="text-xs text-blue-300">
                        Last: {formatDate(t.lastTradeDate)}
                      </div>
                    </div>
                    <div className="ml-auto text-blue-400 group-hover:text-blue-300 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {/* Wash Sale inline warning */}
                  {t.washSaleWarning && (
                    <div className="mt-3 px-3 py-2 bg-red-900/20 border border-red-500/20 rounded-lg text-xs text-red-300">
                      Wash sale window: {t.washSaleDetails.daysRemaining} days remaining • Last loss: {t.washSaleDetails.lastLossAmount !== null ? formatCurrency(t.washSaleDetails.lastLossAmount) : '—'}
                    </div>
                  )}
                </button>
              ))
            )}

            {filteredTickers.length > 0 && tickerListTotalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-xl p-4 mt-4">
                <div className="text-blue-200 text-sm">
                  Showing {(tickerListPageSafe - 1) * tickersPerPage + 1}–{Math.min(tickerListPageSafe * tickersPerPage, filteredTickers.length)} of {filteredTickers.length} tickers
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setTickerListPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={tickerListPageSafe <= 1}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-lg transition-all disabled:text-blue-300 text-sm"
                  >
                    Previous
                  </button>
                  <div className="flex items-center px-4 py-2 bg-teal-600/20 text-white rounded-lg border border-teal-500/30 text-sm">
                    Page {tickerListPageSafe} of {tickerListTotalPages}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setTickerListPage(p => Math.min(tickerListTotalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={tickerListPageSafe >= tickerListTotalPages}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-lg transition-all disabled:text-blue-300 text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
