/**
 * Trade enrichment — Finnhub only (no Polygon).
 * Stores sector, industry, marketCap, shares outstanding / float proxy, beta, avg volume.
 * shortPercent is left null (not used without a paid short-interest feed).
 */

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

export interface TickerEnrichment {
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  floatShares: number | null;
  sharesOutstanding: number | null;
  shortPercent: number | null;
  avgVolume: number | null;
  beta: number | null;
}

async function safeFetch(url: string): Promise<any> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getFinnhubProfile(symbol: string) {
  if (!FINNHUB_KEY) return null;
  return safeFetch(`${FINNHUB_BASE}/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`);
}

async function getFinnhubMetrics(symbol: string) {
  if (!FINNHUB_KEY) return null;
  const data = await safeFetch(`${FINNHUB_BASE}/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`);
  return data?.metric || null;
}

/**
 * Fetch enrichment for a ticker (Finnhub profile + metrics only).
 */
export async function enrichTicker(symbol: string): Promise<TickerEnrichment> {
  const result: TickerEnrichment = {
    sector: null,
    industry: null,
    marketCap: null,
    floatShares: null,
    sharesOutstanding: null,
    shortPercent: null,
    avgVolume: null,
    beta: null,
  };

  const [profile, metrics] = await Promise.all([
    getFinnhubProfile(symbol),
    getFinnhubMetrics(symbol),
  ]);

  if (profile) {
    result.sector = profile.finnhubIndustry || profile.sector || null;
    result.industry = profile.finnhubIndustry || null;
    if (typeof profile.marketCapitalization === 'number' && profile.marketCapitalization > 0) {
      result.marketCap = profile.marketCapitalization;
    }
    if (typeof profile.shareOutstanding === 'number' && profile.shareOutstanding > 0) {
      result.sharesOutstanding = profile.shareOutstanding;
      result.floatShares = profile.shareOutstanding;
    }
  }

  if (metrics) {
    if (typeof metrics.beta === 'number') result.beta = metrics.beta;
    if (typeof metrics['10DayAverageTradingVolume'] === 'number') {
      result.avgVolume = metrics['10DayAverageTradingVolume'] * 1_000_000;
    } else if (typeof metrics['3MonthAverageTradingVolume'] === 'number') {
      result.avgVolume = metrics['3MonthAverageTradingVolume'] * 1_000_000;
    }
  }

  console.log(`[Enrichment] ${symbol}: sector=${result.sector}, mcap=${result.marketCap}M, float=${result.floatShares}M, beta=${result.beta}`);
  return result;
}
