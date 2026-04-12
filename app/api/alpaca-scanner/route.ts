/**
 * Alpaca Real-Time Day Trading Scanner
 * POST /api/alpaca-scanner
 *
 * Uses Alpaca Market Data APIs (REST + WebSocket) for real-time stock scanning:
 *   1. REST: /v1beta1/screener/stocks/movers → discover top gainers
 *   2. REST: /v2/stocks/snapshots           → enrich with live price/volume
 *   3. WebSocket: wss://stream.data.alpaca.markets/v2/iex → real-time bar updates
 *   4. Finnhub: /stock/profile2             → float / shares outstanding
 *
 * Streams results to client via SSE. WebSocket keeps feeding live bar updates
 * until the serverless function times out (~90 s), then the client reconnects.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import WebSocket from 'ws';

export const maxDuration = 120;

const ALPACA_DATA_BASE = 'https://data.alpaca.markets';
const ALPACA_WS_URL = 'wss://stream.data.alpaca.markets/v2/iex';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

interface ScannerCriteria {
  minChangePercent: number;
  maxChangePercent: number;
  minRelativeVolume: number;
  minFloat: number;
  maxFloat: number;
  minPrice: number;
  maxPrice: number;
  minVolume: number;
}

// ── Alpaca REST helpers ──

async function alpacaFetch(path: string, keyId: string, secret: string) {
  const url = `${ALPACA_DATA_BASE}${path}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'APCA-API-KEY-ID': keyId,
      'APCA-API-SECRET-KEY': secret,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Alpaca ${path} => ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function finnhubFetch(path: string, apiKey: string) {
  if (!apiKey) return null;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${FINNHUB_BASE}${path}${sep}token=${apiKey}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

// ── Main route ──

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alpacaKeyId = process.env.ALPACA_API_KEY_ID;
    const alpacaSecret = process.env.ALPACA_API_SECRET_KEY;
    if (!alpacaKeyId || !alpacaSecret) {
      return NextResponse.json({ error: 'Alpaca API keys not configured' }, { status: 500 });
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
      maxPrice: body.maxPrice ?? 200,
      minVolume: body.minVolume ?? 300000,
    };

    const encoder = new TextEncoder();
    let wsRef: WebSocket | null = null;
    let closed = false;

    const readable = new ReadableStream({
      async start(controller) {
        const send = (type: string, data: any) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
          } catch { /* stream closed */ }
        };

        try {
          // ── Phase 1: Discover movers via REST ──
          send('progress', { step: 'Fetching top market movers from Alpaca...', percent: 5 });

          let movers: { symbol: string; percent_change: number; change: number; price: number }[] = [];
          try {
            const moversData = await alpacaFetch(
              '/v1beta1/screener/stocks/movers?top=50',
              alpacaKeyId,
              alpacaSecret,
            );
            movers = (moversData.gainers || []).map((g: any) => ({
              symbol: g.symbol,
              percent_change: g.percent_change,
              change: g.change,
              price: g.price,
            }));
          } catch (e: any) {
            send('progress', { step: `Movers endpoint: ${e.message}. Trying snapshots fallback...`, percent: 8 });
          }

          send('progress', {
            step: `Found ${movers.length} gainers. Fetching live snapshots...`,
            percent: 15,
          });

          // Pre-filter movers by basic criteria
          const candidates = movers.filter(m =>
            m.percent_change >= criteria.minChangePercent &&
            m.percent_change <= criteria.maxChangePercent &&
            m.price >= criteria.minPrice &&
            m.price <= criteria.maxPrice &&
            m.symbol.length <= 5 &&
            !m.symbol.includes('.') &&
            !m.symbol.includes('-'),
          );

          if (candidates.length === 0) {
            send('progress', { step: 'No stocks match basic criteria from movers.', percent: 100 });
            send('complete', { totalResults: 0, scannedAt: new Date().toISOString() });
            controller.close();
            return;
          }

          // ── Phase 2: Get snapshots for live data ──
          const symbolList = candidates.map(c => c.symbol).slice(0, 50);
          send('progress', {
            step: `Getting snapshots for ${symbolList.length} stocks...`,
            percent: 20,
          });

          let snapshots: Record<string, any> = {};
          try {
            snapshots = await alpacaFetch(
              `/v2/stocks/snapshots?symbols=${symbolList.join(',')}&feed=iex`,
              alpacaKeyId,
              alpacaSecret,
            );
          } catch (e: any) {
            send('progress', { step: `Snapshots error: ${e.message}`, percent: 22 });
          }

          // ── Phase 3: Enrich with float data + filter ──
          send('progress', { step: 'Enriching with float data...', percent: 30 });

          const results: any[] = [];
          const qualifiedSymbols: string[] = [];
          let processed = 0;

          for (const sym of symbolList) {
            processed++;
            const snap = snapshots[sym];
            if (!snap) continue;

            const dailyBar = snap.dailyBar || {};
            const prevBar = snap.prevDailyBar || {};
            const latestTrade = snap.latestTrade || {};
            const minuteBar = snap.minuteBar || {};

            const currentPrice = latestTrade.p || dailyBar.c || 0;
            const dayOpen = dailyBar.o || 0;
            const dayHigh = dailyBar.h || 0;
            const dayLow = dailyBar.l || 0;
            const dayVolume = dailyBar.v || 0;
            const dayVwap = dailyBar.vw || 0;
            const prevClose = prevBar.c || 0;
            const prevVolume = prevBar.v || 1;

            const changePercent = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;
            const relativeVolume = prevVolume > 0 ? dayVolume / prevVolume : 1;

            if (dayVolume < criteria.minVolume) continue;
            if (relativeVolume < criteria.minRelativeVolume) continue;
            if (changePercent < criteria.minChangePercent || changePercent > criteria.maxChangePercent) continue;
            if (currentPrice < criteria.minPrice || currentPrice > criteria.maxPrice) continue;

            // Finnhub float
            let floatShares: number | null = null;
            let sharesOutstanding: number | null = null;
            let companyName = sym;
            let industry = '';

            if (finnhubKey) {
              try {
                const profile = await finnhubFetch(`/stock/profile2?symbol=${sym}`, finnhubKey);
                if (profile?.name) {
                  companyName = profile.name;
                  industry = profile.finnhubIndustry || '';
                  sharesOutstanding = profile.shareOutstanding ?? null;
                  floatShares = sharesOutstanding;
                }
              } catch { /* non-critical */ }
            }

            if (floatShares !== null) {
              if (criteria.minFloat > 0 && floatShares < criteria.minFloat) continue;
              if (criteria.maxFloat < 999 && floatShares > criteria.maxFloat) continue;
            }

            if (processed % 5 === 0) {
              send('progress', {
                step: `Enriching ${sym} (${processed}/${symbolList.length})...`,
                percent: 30 + Math.round((processed / symbolList.length) * 30),
              });
            }

            const result = {
              ticker: sym,
              name: companyName,
              industry,
              price: Math.round(currentPrice * 100) / 100,
              open: Math.round(dayOpen * 100) / 100,
              high: Math.round(dayHigh * 100) / 100,
              low: Math.round(dayLow * 100) / 100,
              vwap: Math.round(dayVwap * 100) / 100,
              prevClose: Math.round(prevClose * 100) / 100,
              change: Math.round((currentPrice - prevClose) * 100) / 100,
              changePercent: Math.round(changePercent * 100) / 100,
              volume: dayVolume,
              relativeVolume: Math.round(relativeVolume * 100) / 100,
              floatShares,
              sharesOutstanding,
              source: 'alpaca' as const,
              lastUpdate: new Date().toISOString(),
              minuteBar: minuteBar.t ? {
                open: minuteBar.o,
                high: minuteBar.h,
                low: minuteBar.l,
                close: minuteBar.c,
                volume: minuteBar.v,
                vwap: minuteBar.vw,
                timestamp: minuteBar.t,
              } : null,
            };

            results.push(result);
            qualifiedSymbols.push(sym);
            send('found', result);
          }

          send('progress', {
            step: `Found ${results.length} stocks. Connecting to real-time feed...`,
            percent: 70,
          });

          // ── Phase 4: WebSocket for real-time updates ──
          if (qualifiedSymbols.length > 0 && !closed) {
            try {
              const ws = new WebSocket(ALPACA_WS_URL);
              wsRef = ws;

              ws.on('open', () => {
                // Authenticate
                ws.send(JSON.stringify({
                  action: 'auth',
                  key: alpacaKeyId,
                  secret: alpacaSecret,
                }));
              });

              ws.on('message', (raw: WebSocket.Data) => {
                if (closed) return;
                try {
                  const messages = JSON.parse(raw.toString());
                  if (!Array.isArray(messages)) return;

                  for (const msg of messages) {
                    if (msg.T === 'success' && msg.msg === 'authenticated') {
                      // Subscribe to bars + trades for our qualified tickers
                      ws.send(JSON.stringify({
                        action: 'subscribe',
                        bars: qualifiedSymbols,
                        trades: qualifiedSymbols,
                      }));
                      send('progress', {
                        step: `🟢 LIVE — Streaming real-time data for ${qualifiedSymbols.length} stocks`,
                        percent: 100,
                      });
                      send('live', { symbols: qualifiedSymbols, connectedAt: new Date().toISOString() });
                    }

                    if (msg.T === 'error') {
                      send('ws_error', { code: msg.code, message: msg.msg });
                    }

                    // Real-time bar update (1-minute bar)
                    if (msg.T === 'b' && msg.S) {
                      send('bar', {
                        ticker: msg.S,
                        open: msg.o,
                        high: msg.h,
                        low: msg.l,
                        close: msg.c,
                        volume: msg.v,
                        vwap: msg.vw,
                        timestamp: msg.t,
                        tradeCount: msg.n,
                      });
                    }

                    // Real-time trade
                    if (msg.T === 't' && msg.S) {
                      send('trade', {
                        ticker: msg.S,
                        price: msg.p,
                        size: msg.s,
                        timestamp: msg.t,
                        exchange: msg.x,
                      });
                    }
                  }
                } catch { /* parse error — skip */ }
              });

              ws.on('error', (err: Error) => {
                send('ws_error', { message: err.message });
              });

              ws.on('close', () => {
                if (!closed) {
                  send('ws_disconnected', { reason: 'WebSocket closed' });
                }
              });

              // Keep alive — close before serverless timeout (~100s)
              const timeout = setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.close();
                }
                if (!closed) {
                  send('timeout', { message: 'Reconnect for continued streaming', duration: 100 });
                  closed = true;
                  controller.close();
                }
              }, 100_000);

              // Cleanup if the client disconnects
              request.signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                closed = true;
                if (ws.readyState === WebSocket.OPEN) ws.close();
                try { controller.close(); } catch { /* */ }
              });

            } catch (wsErr: any) {
              send('ws_error', { message: `WebSocket failed: ${wsErr.message}. Falling back to snapshot-only mode.` });
              send('complete', {
                totalResults: results.length,
                scannedAt: new Date().toISOString(),
                mode: 'snapshot-only',
              });
              controller.close();
            }
          } else {
            send('complete', {
              totalResults: results.length,
              scannedAt: new Date().toISOString(),
              mode: 'snapshot-only',
            });
            controller.close();
          }
        } catch (err: any) {
          console.error('[AlpacaScanner] Error:', err);
          send('error', { error: err.message });
          if (wsRef && wsRef.readyState === WebSocket.OPEN) wsRef.close();
          controller.close();
        }
      },
      cancel() {
        closed = true;
        if (wsRef && wsRef.readyState === WebSocket.OPEN) wsRef.close();
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
    console.error('[AlpacaScanner] Route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
