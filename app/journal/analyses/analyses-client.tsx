'use client';

import { useState, useEffect } from 'react';
import { Session } from 'next-auth';
import Navbar from '../../components/navbar';

interface SavedAnalysis {
  id: string;
  periodLabel: string;
  typeFilter?: string | null;
  tradesAnalyzed: number;
  intradayCount: number;
  swingCount: number;
  winRate: number | null;
  totalPL: number | null;
  analysis: string;
  createdAt: string;
}

export default function AnalysesClient({ session }: { session: Session }) {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'day' | 'swing' | 'mixed'>('all');

  useEffect(() => { fetchAnalyses(); }, []);

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/journal/analyze');
      const data = await res.json();
      if (data.success) setAnalyses(data.analyses);
    } catch { /* */ } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this analysis?')) return;
    try {
      const res = await fetch(`/api/journal/analyze?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAnalyses(prev => prev.filter(a => a.id !== id));
        if (selectedId === id) setSelectedId(null);
      }
    } catch { alert('Failed to delete'); }
  };

  const formatCurrency = (v: number | null) => {
    if (v === null) return 'N/A';
    return v >= 0 ? `$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
  };

  const getTypeLabel = (a: SavedAnalysis) => {
    if (a.intradayCount > 0 && a.swingCount > 0) return 'Mixed';
    if (a.intradayCount > 0) return 'Day';
    if (a.swingCount > 0) return 'Swing';
    return 'All';
  };

  const getTypeCategory = (a: SavedAnalysis): 'day' | 'swing' | 'mixed' => {
    if (a.intradayCount > 0 && a.swingCount > 0) return 'mixed';
    if (a.intradayCount > 0) return 'day';
    return 'swing';
  };

  const filtered = analyses.filter(a => filterType === 'all' || getTypeCategory(a) === filterType);
  const selected = analyses.find(a => a.id === selectedId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Journal Analyses</h1>
            <p className="text-blue-200 text-sm mt-1">Saved AI performance reports from your trading journal</p>
          </div>
          <a href="/journal" className="px-4 py-2 bg-slate-700/50 border border-white/10 text-blue-200 rounded-lg text-sm font-medium hover:bg-slate-600/50 transition-all">
            &larr; Back to Journal
          </a>
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-blue-200 text-sm font-medium">Filter:</span>
          {([
            { value: 'all' as const, label: 'All' },
            { value: 'day' as const, label: 'Day Trading' },
            { value: 'swing' as const, label: 'Swing Trading' },
            { value: 'mixed' as const, label: 'Mixed' },
          ]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterType(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filterType === opt.value
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
                  : 'bg-slate-800/50 text-blue-200 hover:bg-slate-700/50 border border-white/10'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-blue-200 py-12">Loading analyses...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-lg p-12 text-center">
            <p className="text-blue-200 text-lg">No saved analyses yet</p>
            <p className="text-blue-300 text-sm mt-2">Run an AI analysis from your Trading Journal and save the ones you find useful.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List */}
            <div className="lg:col-span-1 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {filtered.map(a => {
                const isSelected = selectedId === a.id;
                const typeLabel = getTypeLabel(a);
                return (
                  <div
                    key={a.id}
                    className={`rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-900/30 border-purple-500/50 shadow-lg shadow-purple-500/10'
                        : 'bg-slate-800/50 border-white/10 hover:bg-slate-700/50'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedId(isSelected ? null : a.id)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-semibold text-sm">{a.periodLabel}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              typeLabel === 'Day' ? 'bg-amber-500/20 text-amber-400' :
                              typeLabel === 'Swing' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-purple-500/20 text-purple-400'
                            }`}>
                              {typeLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs">
                            <span className="text-blue-300">{a.tradesAnalyzed} trades</span>
                            {a.winRate !== null && (
                              <span className={a.winRate >= 50 ? 'text-green-400' : 'text-red-400'}>{a.winRate}% WR</span>
                            )}
                            {a.totalPL !== null && (
                              <span className={a.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(a.totalPL)}</span>
                            )}
                          </div>
                          <p className="text-blue-400 text-[11px] mt-1">
                            {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </button>
                    <div className="px-4 pb-3 flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                        className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail */}
            <div className="lg:col-span-2">
              {selected ? (
                <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-lg overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-white">{selected.periodLabel}</h2>
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className="text-blue-300">{selected.tradesAnalyzed} trades</span>
                          {selected.intradayCount > 0 && <span className="text-amber-400">{selected.intradayCount} day</span>}
                          {selected.swingCount > 0 && <span className="text-blue-400">{selected.swingCount} swing</span>}
                          {selected.winRate !== null && (
                            <span className={selected.winRate >= 50 ? 'text-green-400' : 'text-red-400'}>{selected.winRate}% WR</span>
                          )}
                          {selected.totalPL !== null && (
                            <span className={selected.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(selected.totalPL)}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-blue-400 text-xs">
                        {new Date(selected.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="prose prose-invert prose-sm max-w-none text-blue-100 leading-relaxed whitespace-pre-wrap">
                      {selected.analysis}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/30 border border-white/5 rounded-lg p-12 text-center">
                  <p className="text-blue-300">Select an analysis from the list to view it</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
