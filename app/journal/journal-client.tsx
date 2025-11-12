'use client';

import { useState, useEffect } from 'react';
import { Session } from 'next-auth';
import Navbar from '../components/navbar';

interface Trade {
  id: string;
  ticker: string;
  direction: 'long' | 'short';
  entryPrice: number;
  entryDate: string;
  exitPrice: number | null;
  exitDate: string | null;
  amount: number;
  strategy: string | null;
  notes: string | null;
  isOpen: boolean;
  returnPct: number | null;
  rMultiple: number | null;
  holdingDays: number | null;
  profitLoss: number | null;
  createdAt: string;
  updatedAt: string;
}

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

export default function JournalClient({ session }: JournalClientProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  // Form state
  const [ticker, setTicker] = useState('');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [entryPrice, setEntryPrice] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [exitPrice, setExitPrice] = useState('');
  const [exitDate, setExitDate] = useState('');
  const [amount, setAmount] = useState('');
  const [strategy, setStrategy] = useState('');
  const [notes, setNotes] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Strategy options (user can select or type "Other")
  const strategyOptions = [
    'EMA Pullback',
    'Breakout',
    'Reversal',
    'Momentum',
    'Squeeze Play',
    'Other',
  ];

  useEffect(() => {
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/journal/list');
      const data = await response.json();
      
      if (data.success) {
        setTrades(data.trades);
        setSummary(data.summary);
      } else {
        alert('Error fetching trades: ' + data.error);
      }
    } catch (error) {
      console.error('Error fetching trades:', error);
      alert('Failed to fetch trades');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!ticker || !entryPrice || !entryDate || !amount) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate exit fields if trade is closed
    if (!isOpen && (!exitPrice || !exitDate)) {
      alert('Exit price and date are required for closed trades');
      return;
    }

    try {
      setSaving(true);

      const tradeData = {
        id: editingTrade?.id,
        ticker: ticker.toUpperCase(),
        direction,
        entryPrice: parseFloat(entryPrice),
        entryDate,
        exitPrice: exitPrice ? parseFloat(exitPrice) : undefined,
        exitDate: exitDate || undefined,
        amount: parseFloat(amount),
        strategy: strategy || undefined,
        notes: notes || undefined,
        isOpen,
      };

      const response = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(editingTrade ? 'Trade updated successfully!' : 'Trade added successfully!');
        resetForm();
        setShowAddForm(false);
        setEditingTrade(null);
        fetchTrades();
      } else {
        alert('Error saving trade: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving trade:', error);
      alert('Failed to save trade');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTicker('');
    setDirection('long');
    setEntryPrice('');
    setEntryDate(new Date().toISOString().split('T')[0]);
    setExitPrice('');
    setExitDate('');
    setAmount('');
    setStrategy('');
    setNotes('');
    setIsOpen(false);
  };

  const handleEdit = (trade: Trade) => {
    setEditingTrade(trade);
    setTicker(trade.ticker);
    setDirection(trade.direction);
    setEntryPrice(trade.entryPrice.toString());
    setEntryDate(new Date(trade.entryDate).toISOString().split('T')[0]);
    setExitPrice(trade.exitPrice?.toString() || '');
    setExitDate(trade.exitDate ? new Date(trade.exitDate).toISOString().split('T')[0] : '');
    setAmount(trade.amount.toString());
    setStrategy(trade.strategy || '');
    setNotes(trade.notes || '');
    setIsOpen(trade.isOpen);
    setShowAddForm(true);
  };

  const handleDelete = async (tradeId: string) => {
    if (!confirm('Are you sure you want to delete this trade?')) {
      return;
    }

    try {
      const response = await fetch(`/api/journal/${tradeId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Trade deleted successfully!');
        fetchTrades();
      } else {
        alert('Error deleting trade: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting trade:', error);
      alert('Failed to delete trade');
    }
  };

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      setAiAnalysis(null);

      const response = await fetch('/api/journal/analyze', {
        method: 'POST',
      });

      const data = await response.json();
      
      if (data.success) {
        setAiAnalysis(data.analysis);
      } else {
        alert('Error generating analysis: ' + data.error);
      }
    } catch (error) {
      console.error('Error generating analysis:', error);
      alert('Failed to generate analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A';
    return value >= 0 ? `$${value.toFixed(2)}` : `-$${Math.abs(value).toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">📓 Trading Journal</h1>
          <p className="text-blue-200">Track your trades and discover patterns with AI analysis</p>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-lg p-4">
              <div className="text-blue-200 text-sm mb-1">Total Trades</div>
              <div className="text-2xl font-bold text-white">{summary.totalTrades}</div>
              <div className="text-xs text-blue-300 mt-1">
                {summary.totalOpen} open, {summary.totalClosed} closed
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-lg p-4">
              <div className="text-blue-200 text-sm mb-1">Win Rate</div>
              <div className={`text-2xl font-bold ${summary.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                {summary.winRate}%
              </div>
              <div className="text-xs text-blue-300 mt-1">
                {summary.winningTrades}W / {summary.losingTrades}L
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-lg p-4">
              <div className="text-blue-200 text-sm mb-1">Total P/L</div>
              <div className={`text-2xl font-bold ${summary.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(summary.totalPL)}
              </div>
              <div className="text-xs text-blue-300 mt-1">
                Avg: {formatCurrency(summary.avgPL)}
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-lg p-4">
              <div className="text-blue-200 text-sm mb-1">Avg Return</div>
              <div className={`text-2xl font-bold ${summary.avgReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {summary.avgReturn > 0 ? '+' : ''}{summary.avgReturn}%
              </div>
              <div className="text-xs text-blue-300 mt-1">
                {summary.avgRMultiple !== null ? `${summary.avgRMultiple}R` : 'N/A'} • {summary.avgHoldingDays !== null ? `${summary.avgHoldingDays} days` : 'N/A'}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => {
              resetForm();
              setEditingTrade(null);
              setShowAddForm(!showAddForm);
            }}
            className="px-4 py-2 bg-gradient-to-r from-teal-500 to-blue-500 text-white rounded-lg font-medium hover:from-teal-600 hover:to-blue-600 transition-all"
          >
            {showAddForm ? '✕ Cancel' : '+ Add Trade'}
          </button>

          <button
            onClick={handleAnalyze}
            disabled={analyzing || trades.length === 0}
            className="px-4 py-2 bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-lg font-medium hover:bg-purple-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? '🤖 Analyzing...' : '🤖 AI Analysis'}
          </button>
        </div>

        {/* Add/Edit Trade Form */}
        {showAddForm && (
          <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingTrade ? 'Edit Trade' : 'Add New Trade'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Ticker */}
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">
                    Ticker *
                  </label>
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                {/* Direction */}
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">
                    Direction *
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as 'long' | 'short')}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">
                    Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1000"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Entry Price */}
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">
                    Entry Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder="150.00"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                {/* Entry Date */}
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">
                    Entry Date *
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Trade Status */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isOpen"
                  checked={isOpen}
                  onChange={(e) => setIsOpen(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-slate-900/50 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="isOpen" className="text-sm text-blue-200">
                  Trade is still open
                </label>
              </div>

              {!isOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Exit Price */}
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-1">
                      Exit Price {!isOpen && '*'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={exitPrice}
                      onChange={(e) => setExitPrice(e.target.value)}
                      placeholder="155.00"
                      className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-500"
                      required={!isOpen}
                    />
                  </div>

                  {/* Exit Date */}
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-1">
                      Exit Date {!isOpen && '*'}
                    </label>
                    <input
                      type="date"
                      value={exitDate}
                      onChange={(e) => setExitDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      required={!isOpen}
                    />
                  </div>
                </div>
              )}

              {/* Strategy */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">
                  Strategy (optional)
                </label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a strategy...</option>
                  {strategyOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What was your thesis? How did it play out?"
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-gradient-to-r from-teal-500 to-blue-500 text-white rounded-lg font-medium hover:from-teal-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : editingTrade ? 'Update Trade' : 'Add Trade'}
                </button>
                
                {editingTrade && (
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setEditingTrade(null);
                      setShowAddForm(false);
                    }}
                    className="px-6 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* AI Analysis */}
        {aiAnalysis && (
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">🤖 AI Pattern Analysis</h2>
              <button
                onClick={() => setAiAnalysis(null)}
                className="text-purple-300 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="prose prose-invert prose-purple max-w-none">
              <div className="text-blue-100 whitespace-pre-wrap">{aiAnalysis}</div>
            </div>
          </div>
        )}

        {/* Trades List */}
        <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">Your Trades</h2>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-blue-200">
              Loading trades...
            </div>
          ) : trades.length === 0 ? (
            <div className="px-6 py-12 text-center text-blue-200">
              No trades yet. Click "Add Trade" to get started!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-200 uppercase tracking-wider">Ticker</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-200 uppercase tracking-wider">Direction</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-200 uppercase tracking-wider">Entry</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-200 uppercase tracking-wider">Exit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-200 uppercase tracking-wider">Return</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-200 uppercase tracking-wider">P/L</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-200 uppercase tracking-wider">R</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-200 uppercase tracking-wider">Days</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-200 uppercase tracking-wider">Strategy</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-blue-200 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {trades.map((trade) => (
                    <tr key={trade.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{trade.ticker}</div>
                        {trade.isOpen && <div className="text-xs text-green-400">Open</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          trade.direction === 'long' 
                            ? 'bg-green-500/20 text-green-300' 
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          {trade.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">${trade.entryPrice.toFixed(2)}</div>
                        <div className="text-xs text-blue-300">{formatDate(trade.entryDate)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {trade.exitPrice ? (
                          <>
                            <div className="text-sm text-white">${trade.exitPrice.toFixed(2)}</div>
                            {trade.exitDate && <div className="text-xs text-blue-300">{formatDate(trade.exitDate)}</div>}
                          </>
                        ) : (
                          <div className="text-sm text-blue-300">-</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {trade.returnPct !== null ? (
                          <div className={`text-sm font-semibold ${
                            trade.returnPct > 0 ? 'text-green-400' : trade.returnPct < 0 ? 'text-red-400' : 'text-blue-300'
                          }`}>
                            {trade.returnPct > 0 ? '+' : ''}{trade.returnPct.toFixed(2)}%
                          </div>
                        ) : (
                          <div className="text-sm text-blue-300">-</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {trade.profitLoss !== null ? (
                          <div className={`text-sm font-semibold ${
                            trade.profitLoss > 0 ? 'text-green-400' : trade.profitLoss < 0 ? 'text-red-400' : 'text-blue-300'
                          }`}>
                            {formatCurrency(trade.profitLoss)}
                          </div>
                        ) : (
                          <div className="text-sm text-blue-300">-</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">
                          {trade.rMultiple !== null ? `${trade.rMultiple.toFixed(2)}R` : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">
                          {trade.holdingDays !== null ? trade.holdingDays : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-blue-200 max-w-[150px] truncate">
                          {trade.strategy || '-'}
                        </div>
                        {trade.notes && (
                          <div className="text-xs text-blue-300 max-w-[150px] truncate mt-1" title={trade.notes}>
                            💬 {trade.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => handleEdit(trade)}
                          className="text-blue-400 hover:text-blue-300 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(trade.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

