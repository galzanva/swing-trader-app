'use client';

import { useState, useEffect, useMemo } from 'react';
import { Session } from 'next-auth';

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
      default: break;
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
    <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">Ticker History</h1>
          <p className="text-text-secondary">Per-ticker performance, trade history, and wash sale rule tracking</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface-1 border border-border rounded-xl p-4">
            <div className="text-text-secondary text-sm mb-1">Tickers Traded</div>
            <div className="text-2xl font-bold text-text-primary">{tickers.length}</div>
          </div>
          <div className="bg-surface-1 border border-border rounded-xl p-4">
            <div className="text-text-secondary text-sm mb-1">Overall P/L</div>
            <div className={`text-2xl font-bold ${overallPL >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatCurrency(overallPL)}
            </div>
          </div>
          <div className="bg-surface-1 border border-border rounded-xl p-4">
            <div className="text-text-secondary text-sm mb-1">Total Trades</div>
            <div className="text-2xl font-bold text-text-primary">{tickers.reduce((s, t) => s + t.totalTrades, 0)}</div>
          </div>
          <div className={`border rounded-xl p-4 ${washSaleCount > 0 ? 'bg-loss/10 border-loss/30' : 'bg-surface-1 border-border'}`}>
            <div className={`text-sm mb-1 ${washSaleCount > 0 ? 'text-loss' : 'text-text-secondary'}`}>Wash Sale Warnings</div>
            <div className={`text-2xl font-bold ${washSaleCount > 0 ? 'text-loss' : 'text-profit'}`}>{washSaleCount}</div>
            {washSaleCount > 0 && <div className="text-xs text-loss mt-1">Review before re-entering</div>}
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
              className="w-full px-4 py-2.5 pl-10 bg-surface-2 border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent uppercase font-mono"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <button
            onClick={() => setFilterWashSale(!filterWashSale)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              filterWashSale
                ? 'bg-loss/10 border border-loss/30 text-loss'
                : 'bg-surface-2 border border-border text-text-secondary hover:bg-surface-3'
            }`}
          >
            {filterWashSale ? 'Showing Wash Sale Only' : 'Wash Sale Filter'}
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2.5 bg-surface-2 border border-border rounded-lg text-text-secondary text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
          >
            <option value="recent">Most Recent</option>
            <option value="pl">P/L (High to Low)</option>
            <option value="trades">Most Trades</option>
            <option value="winrate">Best Win Rate</option>
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center text-text-secondary py-12">Loading ticker history...</div>
        ) : selectedTicker ? (
          /* ==================== TICKER DETAIL VIEW ==================== */
          <div className="space-y-6">
            <button
              onClick={() => setSelectedTicker(null)}
              className="text-accent hover:text-accent-hover text-sm font-medium flex items-center gap-1"
            >
              <span>&larr;</span> Back to all tickers
            </button>

            {/* Ticker Header */}
            <div className="bg-surface-1 border border-border rounded-xl p-6">
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <h2 className="text-3xl font-bold text-text-primary font-mono">{selectedTicker.ticker}</h2>
                {selectedTicker.washSaleWarning && (
                  <span className="px-3 py-1 bg-loss/10 text-loss border border-loss/30 rounded-full text-sm font-medium">
                    Wash Sale Warning
                  </span>
                )}
                <Link
                  href={`/technical-analysis?symbol=${selectedTicker.ticker}`}
                  className="ml-auto px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-all"
                >
                  Run Analysis
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Total Trades</div>
                  <div className="text-xl font-bold text-text-primary">{selectedTicker.totalTrades}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Win Rate</div>
                  <div className={`text-xl font-bold ${selectedTicker.winRate >= 50 ? 'text-profit' : 'text-loss'}`}>{selectedTicker.winRate}%</div>
                  <div className="text-xs text-text-muted">{selectedTicker.wins}W / {selectedTicker.losses}L</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Total P/L</div>
                  <div className={`text-xl font-bold ${selectedTicker.totalPL >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(selectedTicker.totalPL)}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Avg Return</div>
                  <div className={`text-xl font-bold ${selectedTicker.avgReturn >= 0 ? 'text-profit' : 'text-loss'}`}>{selectedTicker.avgReturn > 0 ? '+' : ''}{selectedTicker.avgReturn}%</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">First Trade</div>
                  <div className="text-sm text-text-primary">{formatDate(selectedTicker.firstTradeDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Last Trade</div>
                  <div className="text-sm text-text-primary">{formatDate(selectedTicker.lastTradeDate)}</div>
                  <div className="text-xs text-text-muted">{selectedTicker.daysSinceLastTrade}d ago</div>
                </div>
              </div>
            </div>

            {/* Wash Sale Details */}
            {selectedTicker.washSaleWarning && (
              <div className="bg-loss/10 border border-loss/30 rounded-xl p-6">
                <h3 className="text-lg font-bold text-loss mb-3">Wash Sale Rule Warning</h3>
                <p className="text-sm text-loss/80 mb-4 leading-relaxed">
                  The IRS wash sale rule disallows a tax deduction for a loss if you buy the same or &quot;substantially identical&quot; security within 30 days before or after selling at a loss.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-loss/10 rounded-lg p-3">
                    <div className="text-xs text-loss mb-0.5">Days Remaining</div>
                    <div className="text-2xl font-bold text-loss">{selectedTicker.washSaleDetails.daysRemaining}</div>
                    <div className="text-xs text-loss/70">of 30 day window</div>
                  </div>
                  <div className="bg-loss/10 rounded-lg p-3">
                    <div className="text-xs text-loss mb-0.5">Last Loss Date</div>
                    <div className="text-sm font-medium text-text-primary">{selectedTicker.washSaleDetails.lastLossDate ? formatDate(selectedTicker.washSaleDetails.lastLossDate) : '—'}</div>
                  </div>
                  <div className="bg-loss/10 rounded-lg p-3">
                    <div className="text-xs text-loss mb-0.5">Last Loss Amount</div>
                    <div className="text-lg font-bold text-loss">{selectedTicker.washSaleDetails.lastLossAmount !== null ? formatCurrency(selectedTicker.washSaleDetails.lastLossAmount) : '—'}</div>
                  </div>
                  <div className="bg-loss/10 rounded-lg p-3">
                    <div className="text-xs text-loss mb-0.5">Total Losses (30d)</div>
                    <div className="text-lg font-bold text-loss">{formatCurrency(-selectedTicker.washSaleDetails.totalLossesInWindow)}</div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-loss/5 rounded-lg text-sm text-loss">
                  <strong>Action:</strong> Wait until {selectedTicker.washSaleDetails.daysRemaining} more day{selectedTicker.washSaleDetails.daysRemaining !== 1 ? 's' : ''} before re-entering {selectedTicker.ticker} to avoid wash sale disallowance, or consult a tax professional.
                </div>
              </div>
            )}

            {!selectedTicker.washSaleWarning && selectedTicker.closedTrades > 0 && (
              <div className="bg-profit/10 border border-profit/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-profit text-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>No wash sale concern — last loss (if any) was more than 30 days ago or no losses recorded.</span>
                </div>
              </div>
            )}

            {/* Trade History Table */}
            <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-lg font-bold text-text-primary">Trade History for {selectedTicker.ticker}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">Dir</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">Entry</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">Exit</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">Return</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">P/L</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">Strategy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDetailTrades.map((trade) => (
                      <tr key={trade.id} className="border-b border-border hover:bg-card-hover transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            trade.tradeType === 'intraday' ? 'bg-surface-3 text-text-secondary' : 'bg-accent/10 text-accent'
                          }`}>
                            {trade.tradeType === 'intraday' ? 'DAY' : 'SWING'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                            trade.direction === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
                          }`}>
                            {trade.direction.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-text-primary">${trade.entryPrice.toFixed(2)}</div>
                          <div className="text-xs text-text-muted">{formatDate(trade.entryDate)}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {trade.exitPrice ? (
                            <>
                              <div className="text-sm text-text-primary">${trade.exitPrice.toFixed(2)}</div>
                              {trade.exitDate && <div className="text-xs text-text-muted">{formatDate(trade.exitDate)}</div>}
                            </>
                          ) : (
                            <div className="text-sm text-profit">Open</div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {trade.returnPct !== null ? (
                            <span className={`text-sm font-semibold ${trade.returnPct > 0 ? 'text-profit' : trade.returnPct < 0 ? 'text-loss' : 'text-text-muted'}`}>
                              {trade.returnPct > 0 ? '+' : ''}{trade.returnPct.toFixed(2)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {trade.profitLoss !== null ? (
                            <span className={`text-sm font-semibold ${trade.profitLoss > 0 ? 'text-profit' : trade.profitLoss < 0 ? 'text-loss' : 'text-text-muted'}`}>
                              {formatCurrency(trade.profitLoss)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{trade.strategy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedTicker.trades.length > tradesPerPage && tradeDetailTotalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-border">
                  <div className="text-text-secondary text-sm">
                    Showing {(tradeDetailPageSafe - 1) * tradesPerPage + 1}–{Math.min(tradeDetailPageSafe * tradesPerPage, selectedTicker.trades.length)} of {selectedTicker.trades.length} trades
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setTradeDetailPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={tradeDetailPageSafe <= 1}
                      className="px-4 py-2 bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all text-sm"
                    >
                      Previous
                    </button>
                    <div className="flex items-center px-4 py-2 bg-accent/10 text-accent rounded-lg border border-accent/30 text-sm">
                      Page {tradeDetailPageSafe} of {tradeDetailTotalPages}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setTradeDetailPage(p => Math.min(tradeDetailTotalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={tradeDetailPageSafe >= tradeDetailTotalPages}
                      className="px-4 py-2 bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all text-sm"
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
              <div className="text-center text-text-secondary py-12">
                {search ? `No tickers matching "${search}"` : 'No trades recorded yet. Add trades in your Trading Journal.'}
              </div>
            ) : (
              paginatedTickerList.map(t => (
                <button
                  key={t.ticker}
                  onClick={() => setSelectedTicker(t)}
                  className="w-full text-left bg-surface-1 border border-border rounded-xl p-4 hover:bg-surface-2 hover:border-border-hover transition-all group"
                >
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center gap-3 min-w-[120px]">
                      <span className="text-lg font-bold text-text-primary font-mono">{t.ticker}</span>
                      {t.washSaleWarning && (
                        <span className="px-2 py-0.5 bg-loss/10 text-loss border border-loss/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          Wash Sale
                        </span>
                      )}
                      {t.openTrades > 0 && (
                        <span className="px-2 py-0.5 bg-profit/10 text-profit rounded-full text-[10px] font-bold">
                          {t.openTrades} Open
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-text-muted">{t.totalTrades} trades</span>
                        <span className="text-text-muted mx-1">·</span>
                        <span className={t.winRate >= 50 ? 'text-profit' : 'text-loss'}>{t.winRate}% WR</span>
                      </div>
                      <div className={`font-semibold ${t.totalPL >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatCurrency(t.totalPL)}
                      </div>
                      <div className={`text-sm ${t.avgReturn >= 0 ? 'text-profit' : 'text-loss'}`}>
                        avg {t.avgReturn > 0 ? '+' : ''}{t.avgReturn}%
                      </div>
                      <div className="text-xs text-text-muted">
                        Last: {formatDate(t.lastTradeDate)}
                      </div>
                    </div>
                    <div className="ml-auto text-text-muted group-hover:text-text-secondary transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {/* Wash Sale inline warning */}
                  {t.washSaleWarning && (
                    <div className="mt-3 px-3 py-2 bg-loss/5 border border-loss/20 rounded-lg text-xs text-loss">
                      Wash sale window: {t.washSaleDetails.daysRemaining} days remaining · Last loss: {t.washSaleDetails.lastLossAmount !== null ? formatCurrency(t.washSaleDetails.lastLossAmount) : '—'}
                    </div>
                  )}
                </button>
              ))
            )}

            {filteredTickers.length > 0 && tickerListTotalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-1 border border-border rounded-xl p-4 mt-4">
                <div className="text-text-secondary text-sm">
                  Showing {(tickerListPageSafe - 1) * tickersPerPage + 1}–{Math.min(tickerListPageSafe * tickersPerPage, filteredTickers.length)} of {filteredTickers.length} tickers
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setTickerListPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={tickerListPageSafe <= 1}
                    className="px-4 py-2 bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all text-sm"
                  >
                    Previous
                  </button>
                  <div className="flex items-center px-4 py-2 bg-accent/10 text-accent rounded-lg border border-accent/30 text-sm">
                    Page {tickerListPageSafe} of {tickerListTotalPages}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setTickerListPage(p => Math.min(tickerListTotalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={tickerListPageSafe >= tickerListTotalPages}
                    className="px-4 py-2 bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
