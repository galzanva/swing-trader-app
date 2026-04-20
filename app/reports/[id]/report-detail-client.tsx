'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AnalysisReportDisplay from '../../components/analysis-report-display';
import TechnicalAnalysisReportDisplay from '../../components/technical-analysis-report-display';
import type { AnalysisReport } from '@/lib/types/analysis-report';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  
  // Ref for the report content to capture
  const reportContentRef = useRef<HTMLDivElement>(null);
  
  // Fetch report
  useEffect(() => {
    fetchReport();
  }, [reportId]);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) setShowDeleteConfirm(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [showDeleteConfirm, isDeleting]);

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

  const handleDownloadPDF = async () => {
    if (!report || !reportContentRef.current) return;
    
    setIsDownloading(true);
    setShowDownloadMenu(false);
    
    try {
      const element = reportContentRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      const fileName = `${report.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!report || !reportContentRef.current) return;
    
    setIsDownloading(true);
    setShowDownloadMenu(false);
    
    try {
      const element = reportContentRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });
      
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${report.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.png`;
          link.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png', 1.0);
    } catch (err: any) {
      console.error('Error generating image:', err);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsDownloading(false);
    }
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
          className="animate-spin h-12 w-12 text-accent"
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
      <div>
        <div className="bg-loss/10 border border-loss/30 rounded-lg p-6">
          <h2 className="text-xl font-bold text-loss mb-2">Error Loading Report</h2>
          <p className="text-loss/80 mb-4">{error}</p>
          <Link
            href="/reports"
            className="inline-block px-4 py-2 bg-loss/10 hover:bg-loss/20 text-loss rounded-lg transition-all"
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
    <div>
      {/* Header with Actions */}
      <div className="mb-6">
        <Link
          href="/reports"
          className="inline-flex items-center gap-2 text-text-muted hover:text-text-secondary transition-all mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Reports</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
              {report.title}
              {report.isPinned && (
                <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20" aria-label="Pinned">
                  <path d="M10 2a.75.75 0 01.59.29l2.5 3.2a.75.75 0 01-.59 1.21H11v4.5h1.5a.75.75 0 01.59 1.21l-2.5 3.2a.75.75 0 01-1.18 0l-2.5-3.2A.75.75 0 017.5 11.2H9v-4.5H7.5a.75.75 0 01-.59-1.21l2.5-3.2A.75.75 0 0110 2z" />
                </svg>
              )}
            </h1>
            {report.description && (
              <p className="text-text-secondary">{report.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {report.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-surface-3 text-text-secondary text-xs rounded-full border border-border"
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
              className="px-4 py-2 bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 rounded-lg transition-all flex items-center gap-2"
              title={report.isPinned ? 'Unpin' : 'Pin'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span className="hidden sm:inline">{report.isPinned ? 'Unpin' : 'Pin'}</span>
            </button>

            <button
              onClick={handleRerun}
              disabled={isRerunning || report.type === 'deep-analysis'}
              title={report.type === 'deep-analysis' ? 'Rerun is not available for legacy deep analysis reports' : undefined}
              className="px-4 py-2 bg-accent text-white hover:bg-accent-hover disabled:opacity-40 rounded-lg transition-all flex items-center gap-2 disabled:cursor-not-allowed"
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
              className="px-4 py-2 bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 disabled:opacity-40 rounded-lg transition-all flex items-center gap-2 disabled:cursor-not-allowed"
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

            {/* Export JSON Button */}
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 rounded-lg transition-all flex items-center gap-2"
              title="Export as JSON"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">JSON</span>
            </button>
            
            {/* Download PDF/Image Button with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                disabled={isDownloading}
                className="px-4 py-2 bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 disabled:opacity-40 rounded-lg transition-all flex items-center gap-2 disabled:cursor-not-allowed"
                title="Download as PDF or Image"
              >
                {isDownloading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">Generating...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className="hidden sm:inline">Download</span>
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>
              
              {/* Dropdown Menu */}
              {showDownloadMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-1 border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={handleDownloadPDF}
                    className="w-full px-4 py-3 text-left text-text-primary hover:bg-surface-2 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 text-loss" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <div className="font-medium">Download PDF</div>
                      <div className="text-xs text-text-muted">Multi-page document</div>
                    </div>
                  </button>
                  <button
                    onClick={handleDownloadImage}
                    className="w-full px-4 py-3 text-left text-text-primary hover:bg-surface-2 flex items-center gap-3 transition-colors border-t border-border"
                  >
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <div className="font-medium">Download Image</div>
                      <div className="text-xs text-text-muted">High-res PNG</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-loss/10 text-loss hover:bg-loss/20 rounded-lg transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation drawer */}
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-50 transition-opacity"
            aria-hidden
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          />
          <div className="fixed inset-0 z-[51] flex justify-end pointer-events-none">
            <aside
              className="pointer-events-auto h-full w-full sm:max-w-md bg-surface-1 shadow-2xl flex flex-col animate-slide-in sm:border-l border-border"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-report-title"
            >
            <div className="shrink-0 border-b border-border bg-surface-2 px-6 py-5 flex items-center justify-between">
              <h3 id="delete-report-title" className="text-xl font-bold text-text-primary">
                Delete report?
              </h3>
              <button
                type="button"
                onClick={() => !isDeleting && setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="text-text-muted hover:text-text-primary p-2 rounded-lg hover:bg-surface-3 transition-colors disabled:opacity-50"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <p className="text-text-secondary text-base leading-relaxed">
                Are you sure you want to delete this report? This action cannot be undone.
              </p>
            </div>
            <div className="shrink-0 border-t border-border bg-surface-2 px-6 py-5 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-5 py-3 bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 rounded-xl transition-all disabled:cursor-not-allowed text-base font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-5 py-3 bg-loss/15 text-loss hover:bg-loss/25 rounded-xl transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base font-semibold"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          </aside>
          </div>
        </>
      )}

      {/* Report Content - Wrapped for PDF/Image export */}
      <div ref={reportContentRef}>
        {/* Metadata */}
        <div className="bg-surface-1 rounded-xl p-6 border border-border mb-6">
          <h3 className="text-lg font-bold text-text-primary mb-4">Report Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-text-muted mb-1">Created</div>
              <div className="text-text-primary font-medium">
                {new Date(report.createdAt).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-text-muted mb-1">Last Updated</div>
              <div className="text-text-primary font-medium">
                {new Date(report.updatedAt).toLocaleString()}
              </div>
            </div>
            {report.lastViewedAt && (
              <div>
                <div className="text-text-muted mb-1">Last Viewed</div>
                <div className="text-text-primary font-medium">
                  {new Date(report.lastViewedAt).toLocaleString()}
                </div>
              </div>
            )}
            {report.lastRerunAt && (
              <div>
                <div className="text-text-muted mb-1">Last Rerun</div>
                <div className="text-text-primary font-medium">
                  {new Date(report.lastRerunAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Report Data - Render based on type */}
        {report.type === 'deep-analysis' ? (
          <AnalysisReportDisplay report={report.reportData as AnalysisReport} />
        ) : report.type === 'technical-analysis' ? (
          <TechnicalAnalysisReportDisplay report={report.reportData} />
        ) : (
          <div className="bg-surface-1 rounded-xl p-6 border border-border">
            <h3 className="text-lg font-bold text-text-primary mb-4">Report Data</h3>
            <div className="bg-surface-2 rounded-lg p-4 overflow-auto max-h-[600px]">
              <pre className="text-sm text-text-secondary whitespace-pre-wrap">
                {JSON.stringify(report.reportData, null, 2)}
              </pre>
            </div>
            <div className="mt-4 p-4 bg-accent/10 border border-accent/30 rounded-lg">
              <p className="text-text-secondary text-sm">
                <strong>Note:</strong> Full UI rendering for {report.type} reports coming soon.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close download menu */}
      {showDownloadMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDownloadMenu(false)}
        />
      )}
    </div>
  );
}
