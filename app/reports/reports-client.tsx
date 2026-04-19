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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deep-analysis':
        return '🔍';
      case 'strategy-analysis':
        return '🎯';
      case 'backtest':
        return '📊';
      case 'technical-analysis':
        return '📈';
      default:
        return '📄';
    }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">📂 Saved Reports</h1>
        <p className="text-blue-200">
          Access your saved analysis reports. Rerun, compare, or export them anytime.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or description..."
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">
              Report Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Types</option>
              <option value="deep-analysis">Legacy (deep analysis)</option>
              <option value="technical-analysis">Technical Analysis</option>
              <option value="backtest">Backtest</option>
            </select>
          </div>

          {/* Tag Filter */}
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">
              Tag Filter
            </label>
            <input
              type="text"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              placeholder="Filter by tag..."
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Pinned Only */}
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">
              Filters
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPinnedOnly}
                onChange={(e) => setShowPinnedOnly(e.target.checked)}
                className="w-5 h-5 rounded border-white/20 bg-white/10 text-teal-500 focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-white">Pinned only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <svg
            className="animate-spin h-8 w-8 text-teal-500"
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
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-12 border border-white/10 text-center">
          <div className="text-6xl mb-4">📂</div>
          <h3 className="text-xl font-bold text-white mb-2">No reports found</h3>
          <p className="text-blue-200 mb-6">
            {searchQuery || typeFilter || tagFilter || showPinnedOnly
              ? 'Try adjusting your filters or search query'
              : 'Start by running an analysis and saving the report'}
          </p>
          <Link
            href="/technical-analysis"
            className="inline-block px-6 py-3 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg"
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
                className="block bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 hover:border-teal-500/50 hover:bg-white/10 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{getTypeIcon(report.type)}</span>
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          {report.title}
                          {report.isPinned && (
                            <span className="text-yellow-400" title="Pinned">
                              📌
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-blue-300">
                          {getTypeLabel(report.type)}
                        </p>
                      </div>
                    </div>
                    {report.description && (
                      <p className="text-blue-200 text-sm mb-3">
                        {report.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {report.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-blue-300 space-y-1">
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
                      className="w-6 h-6 text-blue-300"
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
            <div className="flex items-center justify-between bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
              <div className="text-blue-200 text-sm">
                Showing {reports.length} of {pagination.total} reports
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-lg transition-all disabled:text-blue-300"
                >
                  Previous
                </button>
                <div className="flex items-center px-4 py-2 bg-teal-600/20 text-white rounded-lg border border-teal-500/30">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasMore}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-lg transition-all disabled:text-blue-300"
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

