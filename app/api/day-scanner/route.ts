/**
 * Day Trading Scanner API
 * POST /api/day-scanner
 *
 * Scans the market for high-momentum, low-float stocks suitable for intraday trading.
 * Uses Polygon full-market snapshot + gainers, enriches with Finnhub news/profile/earnings.
 * Streams results via SSE for real-time UX.
 *
 * News recency: Only news published within the last 18 hours counts as "fresh"
 * for catalyst detection. Older articles are discarded entirely.
 * Earnings: Checked separately via Finnhub calendar — earnings today is its own catalyst type.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const maxDuration = 120;

const POLYGON_BASE = 'https://api.polygon.io';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

// 18 hours — covers last-night after-hours + pre-market + today
const NEWS_FRESHNESS_MS = 18 * 60 * 60 * 1000;

interface ScannerCriteria {
  minChangePercent: number;
  maxChangePercent: number;
  minRelativeVolume: number;
  minFloat: number;
  maxFloat: number;
  minPrice: number;
  maxPrice: number;
  minVolume: number;
  requireNews: boolean;
}

interface SnapshotTicker {
  ticker: string;
  day?: { c: number; h: number; l: number; o: number; v: number; vw: number };
  prevDay?: { c: number; h: number; l: number; o: number; v: number; vw: number };
  todaysChange?: number;
  todaysChangePerc?: number;
  updated?: number;
  min?: { av: number; c: number; v: number; vw: number };
}

async function polygonFetch(path: string, apiKey: string) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${POLYGON_BASE}${path}${sep}apiKey=${apiKey}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Polygon ${path} => ${res.status}`);
  return res.json();
}

async function polygonFetchSafe(path: string, apiKey: string) {
  try {
    return await polygonFetch(path, apiKey);
  } catch {
    return null;
  }
}

interface ShortData {
  shortFloat: number | null;      // % of float shorted (e.g. 25 = 25%)
  shortInterest: number | null;   // total shares shorted
  daysToCover: number | null;     // short ratio
  shortVolRatio: number | null;   // recent short volume / total volume (0-1)
  squeezePotential: 'extreme' | 'high' | 'moderate' | 'low' | 'none';
}

async function fetchShortData(
  sym: string,
  polygonKey: string,
  sharesOutstanding: number | null,
): Promise<ShortData> {
  const empty: ShortData = { shortFloat: null, shortInterest: null, daysToCover: null, shortVolRatio: null, squeezePotential: 'none' };
  try {
    const [siData, svData] = await Promise.all([
      polygonFetchSafe(`/stocks/v1/short-interest?ticker=${sym}&limit=1&sort=settlement_date.desc`, polygonKey),
      polygonFetchSafe(`/stocks/v1/short-volume?ticker=${sym}&limit=1&sort=date.desc`, polygonKey),
    ]);

    let shortInterest: number | null = null;
    let daysToCover: number | null = null;
    let shortFloat: number | null = null;

    if (siData?.results?.length > 0) {
      const si = siData.results[0];
      shortInterest = si.short_interest ?? null;
      daysToCover = si.days_to_cover ?? null;

      if (shortInterest && sharesOutstanding && sharesOutstanding > 0) {
        // sharesOutstanding from Finnhub is in millions; shortInterest is raw count
        shortFloat = (shortInterest / (sharesOutstanding * 1_000_000)) * 100;
      } else if (shortInterest) {
        // Fallback: try Polygon ticker details for shares outstanding
        const detailsData = await polygonFetchSafe(`/v3/reference/tickers?ticker=${sym}`, polygonKey);
        const shares = detailsData?.results?.[0]?.weighted_shares_outstanding ??
                       detailsData?.results?.[0]?.share_class_shares_outstanding;
        if (shares && shares > 0) {
          shortFloat = (shortInterest / shares) * 100;
        }
      }
    }

    let shortVolRatio: number | null = null;
    if (svData?.results?.length > 0) {
      const sv = svData.results[0];
      shortVolRatio = sv.short_volume_ratio != null ? sv.short_volume_ratio / 100 : null;
    }

    // Determine squeeze potential based on combination of factors
    let squeezePotential: ShortData['squeezePotential'] = 'none';
    const sf = shortFloat ?? 0;
    const dtc = daysToCover ?? 0;

    if (sf >= 30 && dtc >= 5) squeezePotential = 'extreme';
    else if (sf >= 20 && dtc >= 3) squeezePotential = 'high';
    else if (sf >= 15 || (sf >= 10 && dtc >= 3)) squeezePotential = 'moderate';
    else if (sf >= 8 || dtc >= 2) squeezePotential = 'low';

    return { shortFloat, shortInterest, daysToCover, shortVolRatio, squeezePotential };
  } catch {
    return empty;
  }
}

async function finnhubFetch(path: string, apiKey: string) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${FINNHUB_BASE}${path}${sep}token=${apiKey}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

function isNewsFresh(publishedUtc: string, nowMs: number): boolean {
  const pubMs = new Date(publishedUtc).getTime();
  return nowMs - pubMs <= NEWS_FRESHNESS_MS;
}

const CATALYST_KEYWORDS = /\b(fda|approv|clear|grant|breakthrough|fast.?track|orphan|pdufa|nda|bla|eua|phase\s*[1-4]|trial|patent|merger|acqui|buyout|takeover|deal|partnership|collaborat|licens|contract|award|settl|upgrade|initiat|outperform|overweight|buy.?rating|price.?target|beat|surprise|guidance|rais|upside|offering|ipo|split|dividend|buyback|repurchas)\b/i;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const polygonKey = process.env.POLYGON_API_KEY;
    if (!polygonKey) {
      return NextResponse.json({ error: 'Polygon API key not configured' }, { status: 500 });
    }
    const finnhubKey = process.env.FINNHUB_API_KEY || '';

    const body = await request.json();
    const criteria: ScannerCriteria = {
      minChangePercent: body.minChangePercent ?? 8,
      maxChangePercent: body.maxChangePercent ?? 999,
      minRelativeVolume: body.minRelativeVolume ?? 3,
      minFloat: body.minFloat ?? 0,
      maxFloat: body.maxFloat ?? 50,
      minPrice: body.minPrice ?? 1,
      maxPrice: body.maxPrice ?? 100,
      minVolume: body.minVolume ?? 300000,
      requireNews: body.requireNews ?? false,
    };

    const nowMs = Date.now();
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD for earnings check
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const send = (type: string, data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
        };

        try {
          send('progress', { step: 'Fetching top market gainers...', percent: 5 });

          const [gainersData, snapshotData] = await Promise.all([
            polygonFetch('/v2/snapshot/locale/us/markets/stocks/gainers?include_otc=false', polygonKey),
            polygonFetch('/v2/snapshot/locale/us/markets/stocks/tickers?include_otc=false', polygonKey),
          ]);

          send('progress', { step: 'Processing market data...', percent: 15 });

          const tickerMap = new Map<string, SnapshotTicker>();
          for (const t of (snapshotData.tickers || [])) {
            tickerMap.set(t.ticker, t);
          }
          for (const t of (gainersData.tickers || [])) {
            tickerMap.set(t.ticker, t);
          }

          send('progress', { step: 'Filtering by price change, volume & price...', percent: 20 });

          const candidates: SnapshotTicker[] = [];

          for (const t of Array.from(tickerMap.values())) {
            const dayClose = t.day?.c ?? 0;
            const prevClose = t.prevDay?.c ?? 0;
            const dayVolume = t.day?.v ?? 0;
            const changePerc = t.todaysChangePerc ?? (prevClose > 0 ? ((dayClose - prevClose) / prevClose) * 100 : 0);

            if (dayClose < criteria.minPrice || dayClose > criteria.maxPrice) continue;
            if (dayVolume < criteria.minVolume) continue;
            if (changePerc < criteria.minChangePercent || changePerc > criteria.maxChangePercent) continue;

            const sym = t.ticker;
            if (sym.length > 5) continue;
            if (sym.includes('.') || sym.includes('-')) continue;

            candidates.push(t);
          }

          candidates.sort((a, b) => (b.todaysChangePerc ?? 0) - (a.todaysChangePerc ?? 0));
          const topCandidates = candidates.slice(0, 60);

          send('progress', {
            step: `Found ${candidates.length} movers, enriching top ${topCandidates.length}...`,
            percent: 25,
          });

          const results: any[] = [];
          let processed = 0;

          for (const t of topCandidates) {
            processed++;
            const sym = t.ticker;
            const dayClose = t.day?.c ?? 0;
            const dayOpen = t.day?.o ?? 0;
            const dayHigh = t.day?.h ?? 0;
            const dayLow = t.day?.l ?? 0;
            const dayVolume = t.day?.v ?? 0;
            const dayVwap = t.day?.vw ?? 0;
            const prevVolume = t.prevDay?.v ?? 1;
            const changePerc = t.todaysChangePerc ?? 0;
            const changeAbs = t.todaysChange ?? 0;
            const relativeVolume = prevVolume > 0 ? dayVolume / prevVolume : 1;

            if (relativeVolume < criteria.minRelativeVolume) continue;

            if (processed % 5 === 0) {
              const pct = 25 + Math.round((processed / topCandidates.length) * 55);
              send('progress', {
                step: `Enriching ${sym} (${processed}/${topCandidates.length})...`,
                percent: pct,
              });
            }

            // ── Finnhub: profile + earnings (parallel) ──
            let floatShares: number | null = null;
            let sharesOutstanding: number | null = null;
            let marketCap: number | null = null;
            let companyName = sym;
            let industry = '';
            let earningsToday = false;
            let earningsTime: string | null = null; // 'bmo' (before market open) | 'amc' (after market close)

            if (finnhubKey) {
              try {
                const [profile, earningsData] = await Promise.all([
                  finnhubFetch(`/stock/profile2?symbol=${sym}`, finnhubKey),
                  finnhubFetch(`/calendar/earnings?from=${todayStr}&to=${todayStr}&symbol=${sym}`, finnhubKey),
                ]);

                if (profile && profile.name) {
                  companyName = profile.name;
                  industry = profile.finnhubIndustry || '';
                  sharesOutstanding = profile.shareOutstanding ?? null;
                  marketCap = profile.marketCapitalization ?? null;
                  floatShares = sharesOutstanding;
                }

                if (earningsData?.earningsCalendar?.length > 0) {
                  const entry = earningsData.earningsCalendar[0];
                  if (entry.date === todayStr) {
                    earningsToday = true;
                    earningsTime = entry.hour || null;
                  }
                }
              } catch {
                // Non-critical
              }
            }

            // Float filter
            if (floatShares !== null) {
              if (criteria.minFloat > 0 && floatShares < criteria.minFloat) continue;
              if (criteria.maxFloat < 999 && floatShares > criteria.maxFloat) continue;
            }

            // ── Polygon: news + short interest (parallel) ──
            let freshNews: any[] = [];
            let shortData: ShortData = { shortFloat: null, shortInterest: null, daysToCover: null, shortVolRatio: null, squeezePotential: 'none' };

            try {
              const [newsData, sd] = await Promise.all([
                polygonFetchSafe(
                  `/v2/reference/news?ticker=${sym}&limit=10&sort=published_utc&order=desc`,
                  polygonKey,
                ),
                fetchShortData(sym, polygonKey, sharesOutstanding),
              ]);

              shortData = sd;

              if (newsData?.results) {
                freshNews = newsData.results
                  .filter((n: any) => n.published_utc && isNewsFresh(n.published_utc, nowMs))
                  .map((n: any) => ({
                    title: n.title,
                    url: n.article_url,
                    source: n.publisher?.name || 'Unknown',
                    published: n.published_utc,
                    sentiment: n.insights?.find((i: any) => i.ticker === sym)?.sentiment || null,
                  }));
              }
            } catch {
              // Non-critical
            }

            // "require news" means fresh breaking news OR earnings today
            if (criteria.requireNews && freshNews.length === 0 && !earningsToday) continue;

            // Determine catalyst types
            const hasBreakingNews = freshNews.some((n: any) =>
              n.sentiment === 'positive' || CATALYST_KEYWORDS.test(n.title || '')
            );

            const catalystTypes: string[] = [];
            if (earningsToday) {
              catalystTypes.push(earningsTime === 'bmo' ? 'Earnings (BMO)' : earningsTime === 'amc' ? 'Earnings (AMC)' : 'Earnings');
            }
            if (hasBreakingNews) catalystTypes.push('Breaking News');
            if (shortData.squeezePotential === 'extreme' || shortData.squeezePotential === 'high') {
              catalystTypes.push('Short Squeeze');
            }

            const heatScore = calculateHeatScore(
              changePerc,
              relativeVolume,
              dayVolume,
              floatShares,
              freshNews.length,
              earningsToday,
              shortData,
            );

            const result = {
              ticker: sym,
              name: companyName,
              industry,
              price: dayClose,
              open: dayOpen,
              high: dayHigh,
              low: dayLow,
              vwap: dayVwap,
              change: changeAbs,
              changePercent: changePerc,
              volume: dayVolume,
              relativeVolume: Math.round(relativeVolume * 100) / 100,
              floatShares,
              sharesOutstanding,
              marketCap,
              heatScore,
              shortFloat: shortData.shortFloat !== null ? Math.round(shortData.shortFloat * 100) / 100 : null,
              shortInterest: shortData.shortInterest,
              daysToCover: shortData.daysToCover !== null ? Math.round(shortData.daysToCover * 100) / 100 : null,
              shortVolRatio: shortData.shortVolRatio !== null ? Math.round(shortData.shortVolRatio * 10000) / 100 : null,
              squeezePotential: shortData.squeezePotential,
              news: freshNews,
              freshNewsCount: freshNews.length,
              hasBreakingNews,
              earningsToday,
              earningsTime,
              catalystTypes,
              hasCatalyst: catalystTypes.length > 0,
            };

            results.push(result);
            send('found', result);
          }

          results.sort((a, b) => b.heatScore - a.heatScore);

          send('progress', { step: 'Scan complete!', percent: 100 });
          send('complete', {
            totalCandidates: candidates.length,
            totalResults: results.length,
            scannedAt: new Date().toISOString(),
          });

          controller.close();
        } catch (err: any) {
          console.error('[DayScanner] Error:', err);
          send('error', { error: err.message });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('[DayScanner] Route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function calculateHeatScore(
  changePercent: number,
  relativeVolume: number,
  volume: number,
  floatShares: number | null,
  freshNewsCount: number,
  earningsToday: boolean,
  shortData: ShortData,
): number {
  let score = 0;

  // Price change (max 25)
  if (changePercent >= 50) score += 25;
  else if (changePercent >= 30) score += 22;
  else if (changePercent >= 20) score += 19;
  else if (changePercent >= 15) score += 16;
  else if (changePercent >= 10) score += 12;
  else if (changePercent >= 5) score += 7;
  else score += Math.max(0, Math.round(changePercent));

  // Relative volume (max 20)
  if (relativeVolume >= 20) score += 20;
  else if (relativeVolume >= 10) score += 18;
  else if (relativeVolume >= 7) score += 15;
  else if (relativeVolume >= 5) score += 12;
  else if (relativeVolume >= 3) score += 8;
  else if (relativeVolume >= 2) score += 5;

  // Low float (max 15)
  if (floatShares !== null && floatShares > 0) {
    if (floatShares <= 5) score += 15;
    else if (floatShares <= 10) score += 12;
    else if (floatShares <= 20) score += 9;
    else if (floatShares <= 30) score += 6;
    else if (floatShares <= 50) score += 3;
  }

  // Short squeeze potential (max 15)
  // High short float on a stock that's running up = shorts are trapped = more fuel
  const sf = shortData.shortFloat ?? 0;
  const dtc = shortData.daysToCover ?? 0;
  if (sf >= 30 && dtc >= 5) score += 15;
  else if (sf >= 25 && dtc >= 4) score += 13;
  else if (sf >= 20 && dtc >= 3) score += 11;
  else if (sf >= 15 && dtc >= 2) score += 9;
  else if (sf >= 10) score += 6;
  else if (sf >= 5) score += 3;

  // Volume liquidity (max 8)
  if (volume >= 10_000_000) score += 8;
  else if (volume >= 5_000_000) score += 6;
  else if (volume >= 2_000_000) score += 5;
  else if (volume >= 1_000_000) score += 3;
  else if (volume >= 500_000) score += 1;

  // Fresh breaking news (max 8)
  if (freshNewsCount >= 3) score += 8;
  else if (freshNewsCount >= 2) score += 6;
  else if (freshNewsCount >= 1) score += 3;

  // Earnings today (4)
  if (earningsToday) score += 4;

  // Combo multiplier: short squeeze + catalyst running up = extra dangerous for shorts
  if (sf >= 15 && changePercent >= 15 && relativeVolume >= 5) score += 5;

  return Math.min(100, Math.round(score));
}
