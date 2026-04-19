'use client';

import { useState, useEffect } from 'react';
import { Session } from 'next-auth';


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
    <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Journal Analyses</h1>
            <p className="text-text-secondary text-sm mt-1">Saved AI performance reports from your trading journal</p>
          </div>
          <a href="/journal" className="px-4 py-2 bg-surface-2 border border-border text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-3 transition-all">
            &larr; Back to Journal
          </a>
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-text-secondary text-sm font-medium">Filter:</span>
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
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-text-secondary hover:bg-surface-3 border border-border'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-text-secondary py-12">Loading analyses...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface-1 border border-border rounded-xl p-12 text-center">
            <p className="text-text-secondary text-lg">No saved analyses yet</p>
            <p className="text-text-muted text-sm mt-2">Run an AI analysis from your Trading Journal and save the ones you find useful.</p>
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
                    className={`rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-accent/10 border-accent/30'
                        : 'bg-surface-1 border-border hover:bg-surface-2'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedId(isSelected ? null : a.id)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-text-primary font-semibold text-sm">{a.periodLabel}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              typeLabel === 'Day' ? 'bg-surface-3 text-text-secondary' :
                              typeLabel === 'Swing' ? 'bg-accent/10 text-accent' :
                              'bg-surface-4 text-text-secondary'
                            }`}>
                              {typeLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs">
                            <span className="text-text-muted">{a.tradesAnalyzed} trades</span>
                            {a.winRate !== null && (
                              <span className={a.winRate >= 50 ? 'text-profit' : 'text-loss'}>{a.winRate}% WR</span>
                            )}
                            {a.totalPL !== null && (
                              <span className={a.totalPL >= 0 ? 'text-profit' : 'text-loss'}>{formatCurrency(a.totalPL)}</span>
                            )}
                          </div>
                          <p className="text-text-muted text-[11px] mt-1">
                            {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </button>
                    <div className="px-4 pb-3 flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                        className="text-xs text-text-muted hover:text-loss transition-colors"
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
                <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-text-primary">{selected.periodLabel}</h2>
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className="text-text-muted">{selected.tradesAnalyzed} trades</span>
                          {selected.intradayCount > 0 && <span className="text-text-secondary">{selected.intradayCount} day</span>}
                          {selected.swingCount > 0 && <span className="text-accent">{selected.swingCount} swing</span>}
                          {selected.winRate !== null && (
                            <span className={selected.winRate >= 50 ? 'text-profit' : 'text-loss'}>{selected.winRate}% WR</span>
                          )}
                          {selected.totalPL !== null && (
                            <span className={selected.totalPL >= 0 ? 'text-profit' : 'text-loss'}>{formatCurrency(selected.totalPL)}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-text-muted text-xs">
                        {new Date(selected.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="prose prose-invert prose-sm max-w-none text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {selected.analysis}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-1 border border-border rounded-xl p-12 text-center">
                  <p className="text-text-muted">Select an analysis from the list to view it</p>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
