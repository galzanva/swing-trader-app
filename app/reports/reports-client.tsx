'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SavedReport {
  id: string;
  type: string;
  title: string;
  description: string | null;
  parameters: any;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
  lastRerunAt: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export default function ReportsClient() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  // Fetch reports
  const fetchReports = async (page = 1) => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (typeFilter) params.append('type', typeFilter);
      if (searchQuery) params.append('search', searchQuery);
      if (tagFilter) params.append('tag', tagFilter);
      if (showPinnedOnly) params.append('pinned', 'true');

      const response = await fetch(`/api/reports?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch reports');
      }

      setReports(data.reports);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Load reports on mount and when filters change
  useEffect(() => {
    fetchReports(1);
  }, [typeFilter, tagFilter, showPinnedOnly]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        fetchReports(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handlePageChange = (newPage: number) => {
    fetchReports(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deep-analysis':
        return 'Legacy (deep analysis)';
      case 'strategy-analysis':
        return 'Strategy Analysis';
      case 'backtest':
        return 'Backtest';
      case 'technical-analysis':
        return 'Technical Analysis';
      default:
        return type;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Saved Reports</h1>
        <p className="text-text-secondary">
          Access your saved analysis reports. Rerun, compare, or export them anytime.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-surface-1 rounded-xl p-6 border border-border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or description..."
              className="w-full px-4 py-2 bg-surface-2 border border-border text-text-primary placeholder-text-muted rounded-lg focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Report Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-2 bg-surface-2 border border-border text-text-primary rounded-lg focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            >
              <option value="">All Types</option>
              <option value="deep-analysis">Legacy (deep analysis)</option>
              <option value="technical-analysis">Technical Analysis</option>
              <option value="backtest">Backtest</option>
            </select>
          </div>

          {/* Tag Filter */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Tag Filter
            </label>
            <input
              type="text"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              placeholder="Filter by tag..."
              className="w-full px-4 py-2 bg-surface-2 border border-border text-text-primary placeholder-text-muted rounded-lg focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* Pinned Only */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Filters
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPinnedOnly}
                onChange={(e) => setShowPinnedOnly(e.target.checked)}
                className="w-5 h-5 rounded border-border bg-surface-2 text-accent focus:ring-2 focus:ring-accent"
              />
              <span className="text-text-primary">Pinned only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-loss/10 border border-loss/30 rounded-lg p-4 mb-6">
          <p className="text-loss">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <svg
            className="animate-spin h-8 w-8 text-accent"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      )}

      {/* Reports List */}
      {!isLoading && reports.length === 0 && (
        <div className="bg-surface-1 rounded-xl p-12 border border-border text-center">
          <h3 className="text-xl font-bold text-text-primary mb-2">No reports found</h3>
          <p className="text-text-secondary mb-6">
            {searchQuery || typeFilter || tagFilter || showPinnedOnly
              ? 'Try adjusting your filters or search query'
              : 'Start by running an analysis and saving the report'}
          </p>
          <Link
            href="/technical-analysis"
            className="inline-block px-6 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent-hover transition-all"
          >
            Open Technical Analysis
          </Link>
        </div>
      )}

      {!isLoading && reports.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 mb-6">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className="block bg-surface-1 rounded-xl p-6 border border-border hover:border-border-hover hover:bg-surface-2 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                          {report.title}
                          {report.isPinned && (
                            <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 2a.75.75 0 01.59.29l2.5 3.2a.75.75 0 01-.59 1.21H11v4.5h1.5a.75.75 0 01.59 1.21l-2.5 3.2a.75.75 0 01-1.18 0l-2.5-3.2A.75.75 0 017.5 11.2H9v-4.5H7.5a.75.75 0 01-.59-1.21l2.5-3.2A.75.75 0 0110 2z" />
                            </svg>
                          )}
                        </h3>
                        <p className="text-sm text-text-muted">
                          {getTypeLabel(report.type)}
                        </p>
                      </div>
                    </div>
                    {report.description && (
                      <p className="text-text-secondary text-sm mb-3">
                        {report.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {report.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-surface-3 text-text-secondary text-xs rounded-full border border-border"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-text-muted space-y-1">
                      <div>
                        Created: {new Date(report.createdAt).toLocaleDateString()}
                      </div>
                      {report.lastViewedAt && (
                        <div>
                          Last viewed:{' '}
                          {new Date(report.lastViewedAt).toLocaleDateString()}
                        </div>
                      )}
                      {report.lastRerunAt && (
                        <div>
                          Last rerun:{' '}
                          {new Date(report.lastRerunAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <svg
                      className="w-6 h-6 text-text-muted"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-surface-1 rounded-xl p-4 border border-border">
              <div className="text-text-secondary text-sm">
                Showing {reports.length} of {pagination.total} reports
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all"
                >
                  Previous
                </button>
                <div className="flex items-center px-4 py-2 bg-accent/10 text-accent rounded-lg border border-accent/30 text-sm">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasMore}
                  className="px-4 py-2 bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
