'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AnalysisReportDisplay from '../../components/analysis-report-display';
import StrategyAnalysisReportDisplay from '../../components/strategy-analysis-report-display';
import type { AnalysisReport } from '../../api/analyze/route';

interface SavedReport {
  id: string;
  type: string;
  title: string;
  description: string | null;
  parameters: any;
  reportData: any;
  cachedData: any;
  tags: string[];
  isPinned: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
  lastRerunAt: string | null;
}

interface ReportDetailClientProps {
  reportId: string;
}

export default function ReportDetailClient({ reportId }: ReportDetailClientProps) {
  const router = useRouter();
  const [report, setReport] = useState<SavedReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Actions
  const [isRerunning, setIsRerunning] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Fetch report
  useEffect(() => {
    fetchReport();
  }, [reportId]);

  const fetchReport = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/reports/${reportId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch report');
      }

      setReport(data.report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRerun = async () => {
    if (!report) return;

    setIsRerunning(true);
    setError('');

    try {
      const response = await fetch(`/api/reports/${report.id}/rerun`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to rerun report');
      }

      // Refresh the report
      await fetchReport();
      alert('Report updated successfully with latest data!');
    } catch (err: any) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setIsRerunning(false);
    }
  };

  const handleDuplicate = async () => {
    if (!report) return;

    setIsDuplicating(true);
    setError('');

    try {
      const response = await fetch(`/api/reports/${report.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${report.title} (Copy)`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to duplicate report');
      }

      // Navigate to the new report
      router.push(`/reports/${data.reportId}`);
    } catch (err: any) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDelete = async () => {
    if (!report) return;

    setIsDeleting(true);
    setError('');

    try {
      const response = await fetch(`/api/reports/${report.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete report');
      }

      // Navigate back to reports list
      router.push('/reports');
    } catch (err: any) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleExport = () => {
    if (!report) return;

    // Export as JSON
    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleTogglePin = async () => {
    if (!report) return;

    try {
      const response = await fetch(`/api/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPinned: !report.isPinned,
        }),
      });

      if (response.ok) {
        setReport({ ...report, isPinned: !report.isPinned });
      }
    } catch (err: any) {
      console.error('Failed to toggle pin:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <svg
          className="animate-spin h-12 w-12 text-teal-500"
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
    );
  }

  if (error && !report) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-300 mb-2">Error Loading Report</h2>
          <p className="text-red-200 mb-4">{error}</p>
          <Link
            href="/reports"
            className="inline-block px-4 py-2 bg-red-600/30 hover:bg-red-600/40 text-red-200 rounded-lg transition-all"
          >
            Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with Actions */}
      <div className="mb-6">
        <Link
          href="/reports"
          className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-all mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Reports</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              {report.title}
              {report.isPinned && (
                <span className="text-yellow-400 text-2xl" title="Pinned">
                  📌
                </span>
              )}
            </h1>
            {report.description && (
              <p className="text-blue-200">{report.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {report.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTogglePin}
              className="px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 rounded-lg transition-all border border-yellow-500/30 flex items-center gap-2"
              title={report.isPinned ? 'Unpin' : 'Pin'}
            >
              <span className="text-xl">📌</span>
              <span className="hidden sm:inline">{report.isPinned ? 'Unpin' : 'Pin'}</span>
            </button>

            <button
              onClick={handleRerun}
              disabled={isRerunning}
              className="px-4 py-2 bg-teal-600/20 hover:bg-teal-600/30 disabled:bg-gray-600/20 text-teal-300 disabled:text-gray-400 rounded-lg transition-all border border-teal-500/30 disabled:border-gray-500/30 flex items-center gap-2 disabled:cursor-not-allowed"
            >
              {isRerunning ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="hidden sm:inline">Rerunning...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden sm:inline">Rerun</span>
                </>
              )}
            </button>

            <button
              onClick={handleDuplicate}
              disabled={isDuplicating}
              className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 disabled:bg-gray-600/20 text-blue-300 disabled:text-gray-400 rounded-lg transition-all border border-blue-500/30 disabled:border-gray-500/30 flex items-center gap-2 disabled:cursor-not-allowed"
            >
              {isDuplicating ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="hidden sm:inline">Duplicating...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">Duplicate</span>
                </>
              )}
            </button>

            <button
              onClick={handleExport}
              className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg transition-all border border-purple-500/30 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg transition-all border border-red-500/30 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-red-500/30">
            <h3 className="text-xl font-bold text-white mb-2">Delete Report?</h3>
            <p className="text-blue-200 mb-6">
              Are you sure you want to delete this report? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 text-white rounded-lg transition-all disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 mb-6">
        <h3 className="text-lg font-bold text-white mb-4">Report Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-blue-300 mb-1">Created</div>
            <div className="text-white font-medium">
              {new Date(report.createdAt).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-blue-300 mb-1">Last Updated</div>
            <div className="text-white font-medium">
              {new Date(report.updatedAt).toLocaleString()}
            </div>
          </div>
          {report.lastViewedAt && (
            <div>
              <div className="text-blue-300 mb-1">Last Viewed</div>
              <div className="text-white font-medium">
                {new Date(report.lastViewedAt).toLocaleString()}
              </div>
            </div>
          )}
          {report.lastRerunAt && (
            <div>
              <div className="text-blue-300 mb-1">Last Rerun</div>
              <div className="text-white font-medium">
                {new Date(report.lastRerunAt).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Data - Render based on type */}
      {report.type === 'deep-analysis' ? (
        <AnalysisReportDisplay report={report.reportData as AnalysisReport} />
      ) : report.type === 'strategy-analysis' ? (
        <StrategyAnalysisReportDisplay report={report.reportData} />
      ) : (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-bold text-white mb-4">Report Data</h3>
          <div className="bg-slate-900/50 rounded-lg p-4 overflow-auto max-h-[600px]">
            <pre className="text-sm text-blue-200 whitespace-pre-wrap">
              {JSON.stringify(report.reportData, null, 2)}
            </pre>
          </div>
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-200 text-sm">
              <strong>Note:</strong> Full UI rendering for {report.type} reports coming soon.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

