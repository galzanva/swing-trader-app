'use client';

import { useState, useEffect } from 'react';
import { Session } from 'next-auth';
import Link from 'next/link';
import DashboardCard from './components/dashboard-card';

interface TopMover {
  ticker: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
}

interface OpenTrade {
  id: string;
  ticker: string;
  direction: 'long' | 'short';
  entryPrice: number;
  entryDate: string;
  amount: number;
  strategy: string | null;
  notes: string | null;
  currentPrice: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  daysHeld: number;
  isStale: boolean;
  priceSource: string;
}

interface DashboardStats {
  totalReports: number;
  totalTrades: number;
  totalStrategies: number;
  winRate: number;
  avgReturn: string;
  avgPL: string;
  totalPL: string;
  todayActivity: number;
}

interface RecentReport {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  symbol: string;
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
  const [gainers, setGainers] = useState<TopMover[]>([]);
  const [losers, setLosers] = useState<TopMover[]>([]);
  const [openTrades, setOpenTrades] = useState<OpenTrade[]>([]);
  const [openTradesSummary, setOpenTradesSummary] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  
  const [loadingMovers, setLoadingMovers] = useState(true);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchMarketMovers();
    fetchOpenTrades();
    fetchStats();
    
    // Refresh market movers every 5 minutes
    const moversInterval = setInterval(fetchMarketMovers, 5 * 60 * 1000);
    
    // Refresh open trades every 2 minutes
    const tradesInterval = setInterval(fetchOpenTrades, 2 * 60 * 1000);
    
    return () => {
      clearInterval(moversInterval);
      clearInterval(tradesInterval);
    };
  }, []);

  const fetchMarketMovers = async () => {
    try {
      setLoadingMovers(true);
      const response = await fetch('/api/dashboard/market-movers');
      const data = await response.json();
      
      if (data.success) {
        setGainers(data.gainers);
        setLosers(data.losers);
      }
    } catch (error) {
      console.error('Error fetching market movers:', error);
    } finally {
      setLoadingMovers(false);
    }
  };

  const fetchOpenTrades = async () => {
    try {
      setLoadingTrades(true);
      // Add cache-busting and no-cache headers to ensure fresh real-time prices
      const response = await fetch(`/api/dashboard/open-trades?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setOpenTrades(data.trades);
        setOpenTradesSummary(data.summary);
        console.log(`[Dashboard] Loaded ${data.trades.length} positions with real-time prices`);
      }
    } catch (error) {
      console.error('Error fetching open trades:', error);
    } finally {
      setLoadingTrades(false);
    }
  };

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const response = await fetch('/api/dashboard/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
        setRecentReports(data.recentReports);
        setRecentTrades(data.recentTrades);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (absValue >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else if (absValue >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e6) {
      return `${(volume / 1e6).toFixed(2)}M`;
    } else if (volume >= 1e3) {
      return `${(volume / 1e3).toFixed(2)}K`;
    }
    return volume.toString();
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">
          Welcome back, {session.user?.name?.split(' ')[0] || 'Trader'}! 👋
        </h1>
        <p className="text-blue-200">
          Here's your trading dashboard with market insights and portfolio performance
        </p>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-teal-500/20 to-blue-500/20 backdrop-blur-lg rounded-xl p-4 border border-teal-500/30">
            <p className="text-teal-200 text-sm mb-1">Win Rate</p>
            <p className={`text-3xl font-bold ${stats.winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
              {stats.winRate}%
            </p>
            <p className="text-xs text-teal-300 mt-1">{stats.totalTrades} total trades</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-xl p-4 border border-purple-500/30">
            <p className="text-purple-200 text-sm mb-1">Total P/L</p>
            <p className={`text-3xl font-bold ${parseFloat(stats.totalPL) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(parseFloat(stats.totalPL))}
            </p>
            <p className="text-xs text-purple-300 mt-1">Avg: {formatCurrency(parseFloat(stats.avgPL))}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-lg rounded-xl p-4 border border-blue-500/30">
            <p className="text-blue-200 text-sm mb-1">Saved Reports</p>
            <p className="text-3xl font-bold text-white">{stats.totalReports}</p>
            <p className="text-xs text-blue-300 mt-1">{stats.todayActivity} today</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 backdrop-blur-lg rounded-xl p-4 border border-orange-500/30">
            <p className="text-orange-200 text-sm mb-1">Active Strategies</p>
            <p className="text-3xl font-bold text-white">{stats.totalStrategies}</p>
            <p className="text-xs text-orange-300 mt-1">Custom strategies</p>
          </div>
        </div>
      )}

      {/* Open Positions */}
      {openTrades.length > 0 && (
        <DashboardCard 
          title="Open Positions" 
          icon="📊"
          headerAction={
            <Link 
              href="/journal" 
              className="text-sm text-teal-300 hover:text-teal-200 transition-colors"
            >
              View All →
            </Link>
          }
        >
          {openTradesSummary && (
            <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-slate-900/50 rounded-lg">
              <div>
                <p className="text-blue-200 text-xs mb-1">Total Invested</p>
                <p className="text-white font-semibold">{formatCurrency(openTradesSummary.totalInvested)}</p>
              </div>
              <div>
                <p className="text-blue-200 text-xs mb-1">Unrealized P/L</p>
                <p className={`font-semibold ${openTradesSummary.totalUnrealizedPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(openTradesSummary.totalUnrealizedPL)}
                </p>
              </div>
              <div>
                <p className="text-blue-200 text-xs mb-1">Return</p>
                <p className={`font-semibold ${openTradesSummary.totalUnrealizedPLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {openTradesSummary.totalUnrealizedPLPercent > 0 ? '+' : ''}
                  {openTradesSummary.totalUnrealizedPLPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            {openTrades.slice(0, 5).map((trade) => (
              <div 
                key={trade.id} 
                className="p-4 bg-slate-900/30 rounded-lg hover:bg-slate-900/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-white font-semibold text-lg">{trade.ticker}</p>
                      <p className="text-xs text-blue-300">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${
                          trade.direction === 'long' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                        }`}>
                          {trade.direction.toUpperCase()}
                        </span>
                        Entry: ${trade.entryPrice.toFixed(2)} • {trade.daysHeld}d ago
                        {trade.priceSource === 'last_trade' && !trade.isStale && (
                          <span className="ml-2 text-green-400" title="Real-time price (15-min delayed)">🟢</span>
                        )}
                        {trade.priceSource === 'today_close' && !trade.isStale && (
                          <span className="ml-2 text-blue-400" title="Today's market data">📊</span>
                        )}
                        {trade.priceSource === 'prev_close' && !trade.isStale && (
                          <span className="ml-2 text-yellow-400" title="Last market close (Friday on weekends)">📅</span>
                        )}
                        {trade.isStale && <span className="ml-2 text-red-400" title="Price data may be outdated">⚠️</span>}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-white font-semibold">
                      ${trade.currentPrice > 0 ? trade.currentPrice.toFixed(2) : 'N/A'}
                    </p>
                    <p className={`text-sm font-semibold ${
                      trade.unrealizedPLPercent >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {trade.unrealizedPLPercent > 0 ? '+' : ''}
                      {trade.unrealizedPLPercent.toFixed(2)}%
                      <span className="text-xs ml-1">
                        ({trade.unrealizedPL >= 0 ? '+' : ''}{formatCurrency(trade.unrealizedPL)})
                      </span>
                    </p>
                  </div>
                </div>
                
                {trade.strategy && (
                  <p className="text-xs text-blue-300 mt-2">
                    Strategy: {trade.strategy}
                  </p>
                )}
              </div>
            ))}
          </div>
          
          {openTrades.length > 5 && (
            <div className="mt-4 text-center">
              <Link 
                href="/journal" 
                className="text-sm text-teal-300 hover:text-teal-200 transition-colors"
              >
                View {openTrades.length - 5} more positions →
              </Link>
            </div>
          )}
          
          {/* Price Source Legend */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-blue-300 mb-2 font-semibold">Price Indicators:</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="text-blue-200">
                <span className="text-green-400">🟢</span> Real-time (15-min delayed, market/extended hours only)
              </span>
              <span className="text-blue-200">
                <span className="text-blue-400">📊</span> Today&apos;s close
              </span>
              <span className="text-blue-200">
                <span className="text-yellow-400">📅</span> Last close (previous day or Friday on weekends)
              </span>
              <span className="text-blue-200">
                <span className="text-red-400">⚠️</span> Stale (&gt;4 days old)
              </span>
            </div>
          </div>
        </DashboardCard>
      )}

      {/* Market Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Gainers */}
        <DashboardCard 
          title="Top Gainers" 
          icon="🚀"
          headerAction={
            <button 
              onClick={fetchMarketMovers}
              disabled={loadingMovers}
              className="text-xs text-teal-300 hover:text-teal-200 transition-colors disabled:opacity-50"
            >
              {loadingMovers ? 'Loading...' : 'Refresh'}
            </button>
          }
        >
          {loadingMovers ? (
            <div className="text-center py-8 text-blue-200">Loading market data...</div>
          ) : gainers.length === 0 ? (
            <div className="text-center py-8 text-blue-200">No data available</div>
          ) : (
            <div className="space-y-2">
              {gainers.slice(0, 10).map((stock, index) => (
                <Link
                  key={stock.ticker}
                  href={`/analyze?symbol=${stock.ticker}`}
                  className="block p-3 bg-slate-900/30 rounded-lg hover:bg-slate-900/50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-blue-300 font-mono text-sm w-6">{index + 1}</span>
                      <div>
                        <p className="text-white font-semibold group-hover:text-teal-300 transition-colors">
                          {stock.ticker}
                        </p>
                        <p className="text-xs text-blue-300">Vol: {formatVolume(stock.volume)}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-white font-semibold">${stock.price.toFixed(2)}</p>
                      <p className="text-green-400 font-semibold text-sm">
                        +{stock.changePercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </DashboardCard>

        {/* Top Losers */}
        <DashboardCard 
          title="Top Losers" 
          icon="📉"
          headerAction={
            <button 
              onClick={fetchMarketMovers}
              disabled={loadingMovers}
              className="text-xs text-teal-300 hover:text-teal-200 transition-colors disabled:opacity-50"
            >
              {loadingMovers ? 'Loading...' : 'Refresh'}
            </button>
          }
        >
          {loadingMovers ? (
            <div className="text-center py-8 text-blue-200">Loading market data...</div>
          ) : losers.length === 0 ? (
            <div className="text-center py-8 text-blue-200">No data available</div>
          ) : (
            <div className="space-y-2">
              {losers.slice(0, 10).map((stock, index) => (
                <Link
                  key={stock.ticker}
                  href={`/analyze?symbol=${stock.ticker}`}
                  className="block p-3 bg-slate-900/30 rounded-lg hover:bg-slate-900/50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-blue-300 font-mono text-sm w-6">{index + 1}</span>
                      <div>
                        <p className="text-white font-semibold group-hover:text-teal-300 transition-colors">
                          {stock.ticker}
                        </p>
                        <p className="text-xs text-blue-300">Vol: {formatVolume(stock.volume)}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-white font-semibold">${stock.price.toFixed(2)}</p>
                      <p className="text-red-400 font-semibold text-sm">
                        {stock.changePercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Reports */}
        <DashboardCard 
          title="Recent Analysis" 
          icon="📝"
          headerAction={
            <Link 
              href="/reports" 
              className="text-sm text-teal-300 hover:text-teal-200 transition-colors"
            >
              View All →
            </Link>
          }
        >
          {loadingStats ? (
            <div className="text-center py-8 text-blue-200">Loading...</div>
          ) : recentReports.length === 0 ? (
            <div className="text-center py-8 text-blue-200">
              No saved reports yet. Start by analyzing a stock!
            </div>
          ) : (
            <div className="space-y-2">
              {recentReports.map((report) => (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="block p-3 bg-slate-900/30 rounded-lg hover:bg-slate-900/50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold group-hover:text-teal-300 transition-colors">
                        {report.symbol}
                      </p>
                      <p className="text-xs text-blue-300 truncate max-w-xs">
                        {report.title}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-blue-300">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </p>
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full">
                        {report.type}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </DashboardCard>

        {/* Recent Trades */}
        <DashboardCard 
          title="Recent Trades" 
          icon="💼"
          headerAction={
            <Link 
              href="/journal" 
              className="text-sm text-teal-300 hover:text-teal-200 transition-colors"
            >
              View All →
            </Link>
          }
        >
          {loadingStats ? (
            <div className="text-center py-8 text-blue-200">Loading...</div>
          ) : recentTrades.length === 0 ? (
            <div className="text-center py-8 text-blue-200">
              No trades yet. Start tracking your trades in the journal!
            </div>
          ) : (
            <div className="space-y-2">
              {recentTrades.map((trade) => (
                <Link
                  key={trade.id}
                  href="/journal"
                  className="block p-3 bg-slate-900/30 rounded-lg hover:bg-slate-900/50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-white font-semibold group-hover:text-teal-300 transition-colors">
                          {trade.ticker}
                        </p>
                        <p className="text-xs text-blue-300">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mr-1 ${
                            trade.direction === 'long' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                          }`}>
                            {trade.direction.toUpperCase()}
                          </span>
                          {trade.isOpen ? 'Open' : 'Closed'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {!trade.isOpen && trade.returnPct !== null && (
                        <p className={`text-sm font-semibold ${
                          trade.returnPct >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {trade.returnPct > 0 ? '+' : ''}{trade.returnPct.toFixed(2)}%
                        </p>
                      )}
                      <p className="text-xs text-blue-300">
                        {new Date(trade.entryDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>

      {/* Quick Actions */}
      <DashboardCard title="Quick Actions" icon="⚡">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/analyze"
            className="p-4 bg-gradient-to-br from-teal-500/20 to-blue-500/20 rounded-lg border border-teal-500/30 hover:from-teal-500/30 hover:to-blue-500/30 transition-all group"
          >
            <div className="text-3xl mb-2">🔍</div>
            <p className="text-white font-semibold group-hover:text-teal-300 transition-colors">
              Analyze Stock
            </p>
            <p className="text-xs text-blue-300 mt-1">Deep technical analysis</p>
          </Link>

          <Link
            href="/scanner"
            className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30 hover:from-purple-500/30 hover:to-pink-500/30 transition-all group"
          >
            <div className="text-3xl mb-2">📊</div>
            <p className="text-white font-semibold group-hover:text-purple-300 transition-colors">
              Market Scanner
            </p>
            <p className="text-xs text-blue-300 mt-1">Find opportunities</p>
          </Link>

          <Link
            href="/strategies/manage"
            className="p-4 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-lg border border-blue-500/30 hover:from-blue-500/30 hover:to-indigo-500/30 transition-all group"
          >
            <div className="text-3xl mb-2">🎯</div>
            <p className="text-white font-semibold group-hover:text-blue-300 transition-colors">
              Strategies
            </p>
            <p className="text-xs text-blue-300 mt-1">Build & manage</p>
          </Link>

          <Link
            href="/journal"
            className="p-4 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg border border-orange-500/30 hover:from-orange-500/30 hover:to-red-500/30 transition-all group"
          >
            <div className="text-3xl mb-2">📓</div>
            <p className="text-white font-semibold group-hover:text-orange-300 transition-colors">
              Trade Journal
            </p>
            <p className="text-xs text-blue-300 mt-1">Track performance</p>
          </Link>
        </div>
      </DashboardCard>

      {/* Tips for Swing Traders */}
      <DashboardCard title="Swing Trading Tips" icon="💡">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-900/30 rounded-lg">
            <h4 className="text-teal-300 font-semibold mb-2">📈 Trend is Your Friend</h4>
            <p className="text-sm text-blue-200">
              Look for stocks trading above their 20 and 50-day EMAs for bullish swings
            </p>
          </div>
          
          <div className="p-4 bg-slate-900/30 rounded-lg">
            <h4 className="text-teal-300 font-semibold mb-2">⏰ Patience Pays</h4>
            <p className="text-sm text-blue-200">
              Wait for proper setups with multi-bar confirmation. Quality over quantity.
            </p>
          </div>
          
          <div className="p-4 bg-slate-900/30 rounded-lg">
            <h4 className="text-teal-300 font-semibold mb-2">🛡️ Manage Risk</h4>
            <p className="text-sm text-blue-200">
              Always use stop losses and aim for at least 2:1 reward-to-risk ratio
            </p>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}

