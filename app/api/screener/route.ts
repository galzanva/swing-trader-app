/**
 * Stock Screener API Route
 * POST /api/screener
 * 
 * Flexible filter-based stock screening that works WITHOUT strategies
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PolygonClient } from '@/lib/data-vendors/polygon';
import { ScreenerEngine, type ScreenerFilters, type ScreenerResult, FILTER_PRESETS } from '@/lib/screener';
import type { OHLCV } from '@/lib/types/market';

// Extended type for snapshot data (includes extra fields from API)
interface SnapshotTicker {
  T: string;      // Ticker symbol
  c: number;      // Close
  h: number;      // High
  l: number;      // Low
  o: number;      // Open
  v: number;      // Volume
  vw: number;     // VWAP
  t: number;      // Timestamp
  day?: { c: number; v: number; h: number; l: number; o: number };
  prevDay?: { c: number; v: number };
}

export const maxDuration = 300; // 5 minutes

interface ScreenerRequest {
  // Use a preset or custom filters
  preset?: keyof typeof FILTER_PRESETS;
  filters?: ScreenerFilters;
  
  // Results control
  maxResults?: number;
  maxCandidates?: number; // Max stocks to evaluate (default: 2000 for streaming, 1000 for non-streaming)
  sortBy?: 'matchScore' | 'price' | 'volume' | 'changePercent' | 'adx' | 'rsi';
  sortOrder?: 'asc' | 'desc';
  
  // Streaming
  stream?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ScreenerRequest = await request.json();
    const { 
      preset, 
      filters: customFilters, 
      maxResults = 50,
      maxCandidates, // Will be set based on stream mode if not provided
      sortBy = 'matchScore',
      sortOrder = 'desc',
      stream = false 
    } = body;
    
    // Set default maxCandidates based on mode
    const defaultMaxCandidates = stream ? 2000 : 1000;
    const candidateLimit = maxCandidates || defaultMaxCandidates;

    // Get filters from preset or custom
    let filters: ScreenerFilters;
    let presetName = 'Custom';
    
    if (preset && FILTER_PRESETS[preset]) {
      filters = FILTER_PRESETS[preset].filters;
      presetName = FILTER_PRESETS[preset].name;
      console.log(`[Screener] Using preset: ${presetName}`);
    } else if (customFilters) {
      filters = customFilters;
      console.log(`[Screener] Using custom filters`);
    } else {
      return NextResponse.json(
        { error: 'Either preset or filters must be provided' },
        { status: 400 }
      );
    }

    // Validate Polygon API key
    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Market data provider not configured' },
        { status: 500 }
      );
    }

    console.log(`[Screener] Starting scan with ${presetName} filters`);
    console.log(`[Screener] User: ${session.user.email}, Max results: ${maxResults}`);

    // Create screener engine
    const screener = new ScreenerEngine(filters);
    const polygon = new PolygonClient(apiKey);

    // If streaming
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Get market snapshot (using grouped daily endpoint)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'progress', 
              data: { message: 'Fetching market snapshot...', percent: 5 } 
            })}\n\n`));
            
            const snapshot = await polygon.getGroupedDaily();
            const rawTickers = snapshot.results || [];

            // Apply quick pre-filters from snapshot
            // Note: getGroupedDaily returns results with T (ticker), c (close), v (volume), etc.
            let candidates: SnapshotTicker[] = rawTickers.filter((t) => {
              const price = t.c || 0;
              const volume = t.v || 0;
              
              // Quick price filter
              if (filters.price?.enabled) {
                if (filters.price.minPrice && price < filters.price.minPrice) return false;
                if (filters.price.maxPrice && price > filters.price.maxPrice) return false;
              }
              
              // Quick volume filter
              if (volume < 100000) return false;
              
              // Exclude by type
              const symbol = (t.T || '').toUpperCase();
              if (filters.exchange?.excludeWarrants) {
                if (symbol.includes('.W') || symbol.includes('-W')) return false;
              }
              
              return true;
            }) as SnapshotTicker[];

            // Sort by dollar volume for priority
            candidates = candidates.sort((a, b) => {
              const volA = (a.v || 0) * (a.c || 0);
              const volB = (b.v || 0) * (b.c || 0);
              return volB - volA;
            }).slice(0, Math.min(candidateLimit, candidates.length)); // Process top candidates

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'progress', 
              data: { message: `Evaluating ${candidates.length} candidates...`, percent: 10 } 
            })}\n\n`));

            const results: ScreenerResult[] = [];
            let processed = 0;

            for (const ticker of candidates) {
              if (results.length >= maxResults) break;
              
              processed++;
              const symbol = ticker.T;
              
              // Progress update every 20 tickers
              if (processed % 20 === 0) {
                const percent = 10 + Math.round((processed / candidates.length) * 80);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'progress', 
                  data: { 
                    message: `Evaluating ${symbol} (${processed}/${candidates.length})...`, 
                    percent,
                    found: results.length
                  } 
                })}\n\n`));
              }

              try {
                // Fetch OHLCV data
                const marketData = await polygon.getAggregates(symbol, '1day', 200);
                if (!marketData.bars || marketData.bars.length < 50) continue;
                
                const bars: OHLCV[] = marketData.bars;
                const tickerPrice = ticker.c || 0;
                const tickerVol = ticker.v || 0;
                
                // Evaluate with screener
                const result = screener.evaluate(
                  symbol,
                  symbol, // Use symbol as name (snapshot doesn't include names)
                  bars,
                  {
                    exchange: 'US', // Grouped daily doesn't include exchange
                    avgDollarVolume: tickerVol * tickerPrice,
                  }
                );
                
                // Debug logging for first few stocks to see what's failing
                if (processed <= 5 && result) {
                  const failedFilters = result.filterResults.filter(f => !f.passed);
                  if (failedFilters.length > 0) {
                    console.log(`[Screener] ${symbol}: Failed ${failedFilters.length}/${result.totalFilters} filters:`, 
                      failedFilters.map(f => `${f.name} (${f.reason || f.value})`).join(', '));
                  }
                }
                
                if (result && result.passed) {
                  results.push(result);
                  
                  // Send found result
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'found', 
                    data: result 
                  })}\n\n`));
                }
              } catch (err) {
                // Skip ticker on error
                console.log(`[Screener] Error evaluating ${symbol}:`, err);
              }
            }

            // Sort results
            results.sort((a, b) => {
              let aVal: number, bVal: number;
              
              switch (sortBy) {
                case 'price': aVal = a.price; bVal = b.price; break;
                case 'volume': aVal = a.volume; bVal = b.volume; break;
                case 'changePercent': aVal = a.changePercent; bVal = b.changePercent; break;
                case 'adx': aVal = a.indicators.adx || 0; bVal = b.indicators.adx || 0; break;
                case 'rsi': aVal = a.indicators.rsi || 0; bVal = b.indicators.rsi || 0; break;
                default: aVal = a.matchScore; bVal = b.matchScore;
              }
              
              return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
            });

            // Send final results
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'complete', 
              data: {
                success: true,
                preset: presetName,
                results,
                metadata: {
                  totalScanned: processed,
                  passed: results.length,
                  scannedAt: new Date().toISOString(),
                }
              } 
            })}\n\n`));
            
            controller.close();
          } catch (error: any) {
            console.error('[Screener] Error:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'error', 
              data: { error: error.message } 
            })}\n\n`));
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
    }

    // Non-streaming mode
    const snapshot = await polygon.getGroupedDaily();
    const rawTickers = snapshot.results || [];
    
    // Quick pre-filter
    let candidates = rawTickers.filter((t) => {
      const price = t.c || 0;
      if (filters.price?.enabled) {
        if (filters.price.minPrice && price < filters.price.minPrice) return false;
        if (filters.price.maxPrice && price > filters.price.maxPrice) return false;
      }
      return true;
    });
    
    // Sort by dollar volume and limit
    candidates = candidates.sort((a, b) => {
      const volA = (a.v || 0) * (a.c || 0);
      const volB = (b.v || 0) * (b.c || 0);
      return volB - volA;
    }).slice(0, Math.min(candidateLimit, candidates.length));

    const results: ScreenerResult[] = [];
    
    for (const ticker of candidates) {
      if (results.length >= maxResults) break;
      
      try {
        const symbol = ticker.T;
        const marketData = await polygon.getAggregates(symbol, '1day', 200);
        if (!marketData.bars || marketData.bars.length < 50) continue;
        
        const result = screener.evaluate(
          symbol,
          symbol,
          marketData.bars,
          {
            exchange: 'US',
          }
        );
        
        if (result && result.passed) {
          results.push(result);
        }
      } catch (err) {
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      preset: presetName,
      results,
      metadata: {
        totalScanned: candidates.length,
        passed: results.length,
        scannedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Screener] Error:', error);
    return NextResponse.json(
      { error: 'Screener failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/screener/presets
 * Returns available filter presets
 */
export async function GET() {
  const presets = Object.entries(FILTER_PRESETS).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description,
  }));
  
  return NextResponse.json({ presets });
}

