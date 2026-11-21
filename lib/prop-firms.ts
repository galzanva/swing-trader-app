export function isPropAccountType(accountType: string): boolean {
  return accountType === 'prop-eval' || accountType === 'prop-funded';
}

export function inferFirmSlug(slug: string, accountType?: string): string | null {
  if (accountType && !isPropAccountType(accountType)) return null;
  const s = slug.toLowerCase();
  if (s.startsWith('topstep')) return 'topstep';
  if (s.startsWith('tradethepool') || s.startsWith('ttp')) return 'tradethepool';
  if (s.startsWith('lucid')) return 'lucid';
  if (s.startsWith('apex')) return 'apex';
  if (s.startsWith('myfunded') || s.startsWith('mffu')) return 'myfundedfutures';
  const stripped = s.replace(/-(eval|funded)(-[a-z0-9]+)?$/i, '');
  if (accountType && isPropAccountType(accountType)) return stripped || s;
  return null;
}

export type EvalLedgerEntry = {
  type: string;
  amount: number;
  date: string;
  outcome?: string | null;
  daysToPass?: number | null;
};

export function summarizeEvals(entries: EvalLedgerEntry[]) {
  const evals = entries.filter((e) => e.type === 'eval_purchase');
  const payouts = entries.filter((e) => e.type === 'payout');
  const passed = evals.filter((e) => e.outcome === 'passed').sort((a, b) => a.date.localeCompare(b.date));
  const failed = evals.filter((e) => e.outcome === 'failed');
  const spend = evals.reduce((sum, e) => sum + e.amount, 0);
  const paid = payouts.reduce((sum, e) => sum + e.amount, 0);
  const dates = evals.map((e) => e.date.slice(0, 10)).sort();
  return {
    evalCount: evals.length,
    passed: passed.length,
    failed: failed.length,
    failRate: evals.length ? failed.length / evals.length : null,
    passDays: passed.map((e) => e.daysToPass).filter((n): n is number => typeof n === 'number' && n > 0),
    periodFrom: dates[0] ?? null,
    periodTo: dates[dates.length - 1] ?? null,
    evalSpend: Math.round(spend * 100) / 100,
    payouts: Math.round(paid * 100) / 100,
    truePL: Math.round((paid - spend) * 100) / 100,
  };
}

export function firmDisplayName(firmSlug: string): string {
  const map: Record<string, string> = {
    topstep: 'TopStep',
    tradethepool: 'TradeThePool',
    lucid: 'Lucid Trading',
    apex: 'Apex',
    myfundedfutures: 'My Funded Futures',
  };
  return map[firmSlug] || firmSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
