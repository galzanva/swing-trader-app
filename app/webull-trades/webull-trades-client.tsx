'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ConnectionStatus {
  connected: boolean;
  hasEnvKeys: boolean;
  accountId: string | null;
  tokenStatus: string | null;
  host: string;
  lastSyncAt: string | null;
  lastSyncCount: number;
}

interface SyncSummary {
  totalOrders: number;
  pairedTrades: number;
  imported: number;
  updated?: number;
  merged?: number;
  duplicates: number;
  skipped: number;
  startDate: string;
  endDate: string;
}

type Step = 'status' | 'testing' | 'token' | 'syncing';

export default function WebullTradesClient() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [step, setStep] = useState<Step>('status');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [host, setHost] = useState('api.webull.com');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [mergeManual, setMergeManual] = useState(false);

  // Set default date range: last 30 days
  useEffect(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    setEndDate(now.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/webull');
      const data = await res.json();
      setStatus(data);
      if (data.host) setHost(data.host);
      if (data.accountId) setSelectedAccountId(data.accountId);
    } catch {
      setError('Failed to fetch connection status');
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const doAction = async (action: string, extra: Record<string, any> = {}) => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/webull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, host, ...extra }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || `Error ${res.status}`);
        return data;
      }

      return data;
    } catch (err: any) {
      setError(err.message);
      return { error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setStep('testing');
    const data = await doAction('test');
    if (data.success) {
      setMessage(`Connected! Found ${data.accounts?.length || 0} account(s).`);
      setAccounts(data.accounts || []);
      if (data.selectedAccountId) setSelectedAccountId(data.selectedAccountId);
      await fetchStatus();
    }
    setStep('status');
  };

  const handleCreateToken = async () => {
    setStep('token');
    const data = await doAction('token');
    if (data.success) {
      setMessage(data.message || 'Token created.');
      await fetchStatus();
    }
    setStep('status');
  };

  const handleCheckToken = async () => {
    const data = await doAction('check');
    if (data.success) {
      setMessage(`Token status: ${data.tokenStatus}`);
      await fetchStatus();
    }
  };

  const handleSync = async () => {
    setStep('syncing');
    setSyncSummary(null);
    const data = await doAction('sync', {
      accountId: selectedAccountId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      forceUpdate,
      mergeManual,
    });
    if (data.success) {
      setSyncSummary(data.summary);
      const parts = [`Imported ${data.summary.imported} trades`];
      if (data.summary.updated) parts.push(`updated ${data.summary.updated}`);
      if (data.summary.merged) parts.push(`merged ${data.summary.merged} with manual entries`);
      setMessage(parts.join(', ') + ' successfully!');
      await fetchStatus();
    }
    setStep('status');
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Webull Trade Import</h1>
        <p className="text-text-muted text-sm">
          Connect to your Webull account and import filled trades into your Trading Journal automatically.
        </p>
      </div>

      {/* Status Card */}
      <div className="bg-surface-1 border border-border rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Connection Status</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatusItem
            label="API Keys"
            value={status?.hasEnvKeys ? 'Configured' : 'Missing'}
            ok={!!status?.hasEnvKeys}
          />
          <StatusItem
            label="Account"
            value={status?.accountId ? status.accountId.slice(0, 12) + '...' : 'Not connected'}
            ok={!!status?.accountId}
          />
          <StatusItem
            label="2FA Token"
            value={status?.tokenStatus || 'Not created'}
            ok={status?.tokenStatus === 'NORMAL'}
          />
          <StatusItem
            label="Last Sync"
            value={status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleDateString() : 'Never'}
            ok={!!status?.lastSyncAt}
            extra={status?.lastSyncCount ? `${status.lastSyncCount} trades` : undefined}
          />
        </div>

        {/* Environment selector */}
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-text-muted">Environment:</label>
          <select
            value={host}
            onChange={e => setHost(e.target.value)}
            className="px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
          >
            <option value="api.webull.com">Production (api.webull.com)</option>
            <option value="us-openapi-alb.uat.webullbroker.com">Test (UAT)</option>
          </select>
        </div>
      </div>

      {/* Step 1: Test Connection */}
      <div className="bg-surface-1 border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Step 1: Test Connection</h3>
            <p className="text-xs text-text-muted mt-1">
              Verifies your WEBULL_API_KEY and WEBULL_API_SECRET from .env
            </p>
          </div>
          <button
            onClick={handleTestConnection}
            disabled={loading}
            className="px-5 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-all"
          >
            {loading && step === 'testing' ? 'Testing...' : 'Test Connection'}
          </button>
        </div>

        {accounts.length > 0 && (
          <div className="mt-3">
            <label className="text-sm text-text-muted block mb-1">Select Account:</label>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              className="px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent min-w-[300px]"
            >
              {accounts.map((a: any) => (
                <option key={a.account_id} value={a.account_id}>
                  {a.account_id} ({a.account_type || 'account'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Step 2: 2FA Token (if needed) */}
      <div className="bg-surface-1 border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Step 2: Access Token (2FA) — <span className="text-text-muted font-normal">Optional</span></h3>
            <p className="text-xs text-text-muted mt-1">
              Only needed if your Webull account has 2FA enabled. If you can already import trades without it, skip this step entirely.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateToken}
              disabled={loading}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-all"
            >
              Create Token
            </button>
            <button
              onClick={handleCheckToken}
              disabled={loading}
              className="px-4 py-2 bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded-lg text-sm transition-all"
            >
              Check Status
            </button>
          </div>
        </div>
        {status?.tokenStatus === 'PENDING' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-300">
            Token is pending verification. Open your Webull App, go to Menu → Messages → OpenAPI Notifications, and confirm the SMS code.
          </div>
        )}
        {status?.tokenStatus === 'NORMAL' && (
          <div className="bg-profit/10 border border-profit/30 rounded-lg p-3 text-sm text-profit">
            Token is active and valid. You can now sync trades.
          </div>
        )}
      </div>

      {/* Step 3: Sync Trades */}
      <div className="bg-surface-1 border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Step 3: Import Trades</h3>
            <p className="text-xs text-text-muted mt-1">
              Fetch filled orders from Webull, pair BUY/SELL into trades, and save to your journal.
              Duplicates are automatically skipped.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={loading || !selectedAccountId}
            className="px-5 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-all"
          >
            {loading && step === 'syncing' ? 'Importing...' : 'Import Trades'}
          </button>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="text-xs text-text-muted block mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>
          <div className="text-xs text-text-muted self-end pb-1">
            Webull allows up to 2 years of history
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={forceUpdate}
              onChange={e => setForceUpdate(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border bg-surface-2 text-accent focus:ring-accent/30"
            />
            <span className="text-xs text-text-muted">Update existing Webull trades (fix times / trade type for previously imported)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={mergeManual}
              onChange={e => setMergeManual(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border bg-surface-2 text-accent focus:ring-accent/30"
            />
            <span className="text-xs text-text-muted">
              Merge with manual entries — match by ticker, date &amp; prices; keeps your strategy, notes, exit reason &amp; R
            </span>
          </label>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-loss/10 border border-loss/30 rounded-xl p-4 mb-6">
          <p className="text-sm text-loss">{error}</p>
        </div>
      )}
      {message && !error && (
        <div className="bg-profit/10 border border-profit/30 rounded-xl p-4 mb-6">
          <p className="text-sm text-profit">{message}</p>
        </div>
      )}

      {/* Sync Summary */}
      {syncSummary && (
        <div className="bg-surface-1 border border-border rounded-xl p-6 mb-6">
          <h3 className="text-base font-semibold text-text-primary mb-4">Import Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <SummaryItem label="Total Filled Orders" value={syncSummary.totalOrders} />
            <SummaryItem label="Paired into Trades" value={syncSummary.pairedTrades} />
            <SummaryItem label="Newly Imported" value={syncSummary.imported} highlight />
            {(syncSummary.updated ?? 0) > 0 && (
              <SummaryItem label="Updated" value={syncSummary.updated!} highlight />
            )}
            {(syncSummary.merged ?? 0) > 0 && (
              <SummaryItem label="Merged with Manual" value={syncSummary.merged!} highlight />
            )}
            <SummaryItem label="Duplicates Skipped" value={syncSummary.duplicates} />
            <SummaryItem label="Unpaired / Skipped" value={syncSummary.skipped} />
            <SummaryItem label="Date Range" value={`${syncSummary.startDate} → ${syncSummary.endDate}`} />
          </div>
          {(syncSummary.imported > 0 || (syncSummary.updated ?? 0) > 0) && (
            <div className="mt-4">
              <Link
                href="/journal"
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent/20 text-accent hover:bg-accent/30 rounded-lg text-sm transition-all"
              >
                View in Trading Journal →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-surface-1 border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-secondary mb-3">How it works</h3>
        <ul className="space-y-2 text-xs text-text-muted">
          <li>
            <strong className="text-text-secondary">BUY + SELL pairing:</strong> Filled orders are matched by symbol chronologically.
            Each BUY is paired with the next SELL to create a complete trade entry.
          </li>
          <li>
            <strong className="text-text-secondary">Intraday detection:</strong> If entry and exit happen on the same day, the trade is marked as &quot;intraday&quot;
            and actual fill times are preserved. Swing trades default to 9:30 AM / 4:00 PM ET.
          </li>
          <li>
            <strong className="text-text-secondary">Deduplication:</strong> Each trade is tagged with a unique Webull order ID pair.
            Re-syncing the same date range won&apos;t create duplicates.
          </li>
          <li>
            <strong className="text-text-secondary">Manual notes:</strong> After import, you can add notes, strategies, and exit reasons
            to any trade in the Trading Journal.
          </li>
          <li>
            <strong className="text-text-secondary">Source tagging:</strong> Imported trades are tagged as source: &quot;webull&quot; so they&apos;re
            distinct from manually entered trades.
          </li>
        </ul>
      </div>
    </div>
  );
}

function StatusItem({ label, value, ok, extra }: { label: string; value: string; ok: boolean; extra?: string }) {
  return (
    <div className="bg-surface-2 rounded-lg p-3">
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className={`text-sm font-medium ${ok ? 'text-profit' : 'text-text-muted'}`}>
        {ok ? '●' : '○'} {value}
      </div>
      {extra && <div className="text-xs text-text-muted mt-0.5">{extra}</div>}
    </div>
  );
}

function SummaryItem({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className="bg-surface-2 rounded-lg p-3">
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-accent' : 'text-text-primary'}`}>
        {value}
      </div>
    </div>
  );
}
