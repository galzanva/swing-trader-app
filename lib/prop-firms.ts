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
