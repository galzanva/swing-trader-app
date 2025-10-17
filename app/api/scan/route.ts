/**
 * Market Scanner API Route
 * POST /api/scan
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { MarketScanner, type ScannerConfig, type ScanProgress } from '@/lib/scanner/market-scanner';
import { getUserStrategies } from '@/lib/strategy-builder/repository';
import type { StrategyDsl } from '@/lib/strategy-builder/dsl-schema';

export const maxDuration = 300; // 5 minutes for long-running scan

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { strategyId, config, maxResults = 20, stream = false } = body;

    if (!strategyId) {
      return NextResponse.json(
        { error: 'Strategy ID is required' },
        { status: 400 }
      );
    }

    // Get user's strategy
    const strategies = await getUserStrategies(session.user.id, false);
    const strategy = strategies.find(s => s.id === strategyId);

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    if (!strategy.isActive) {
      return NextResponse.json(
        { error: 'Strategy is not active' },
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

    console.log(`[API] Starting market scan for strategy: ${strategy.name}`);
    console.log(`[API] User: ${session.user.email}, Max results: ${maxResults}, Stream: ${stream}`);

    // Configure scanner
    const scanConfig: ScannerConfig = {
      minPrice: config?.minPrice || 5,
      maxPrice: config?.maxPrice || 1000,
      minVolume: config?.minVolume || 500000,
      marketCapPreset: config?.marketCapPreset || 'mid_plus',
      minDollarVolume: config?.minDollarVolume || 20_000_000,
      excludeOTC: config?.excludeOTC !== false,
      excludeETFs: config?.excludeETFs !== false,
      excludeWarrants: config?.excludeWarrants !== false,
      excludeADRs: config?.excludeADRs !== false,
      sortByDollarVolume: true,
      earlyExitEnabled: true,
    };

    // If streaming is requested, use Server-Sent Events
    if (stream) {
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            // Create scanner
            const scanner = new MarketScanner(apiKey);
            
            // Set up progress callback
            scanner.onProgress((progress: ScanProgress) => {
              const data = `data: ${JSON.stringify({ type: 'progress', data: progress })}\n\n`;
              controller.enqueue(encoder.encode(data));
            });

            // Run scan
            const results = await scanner.scanMarket(
              strategy.dsl as StrategyDsl,
              scanConfig,
              maxResults
            );

            console.log(`[API] Scan complete. Found ${results.length} results.`);

            // Send final results
            const finalData = {
              type: 'complete',
              data: {
                success: true,
                strategy: {
                  id: strategy.id,
                  name: strategy.name,
                  direction: strategy.direction,
                  timeframe: strategy.timeframe,
                },
                config: scanConfig,
                results,
                metadata: {
                  totalScanned: results.length,
                  qualified: results.filter(r => r.matchDetails.eligible).length,
                  avgMatchScore: results.length > 0
                    ? Math.round(results.reduce((sum, r) => sum + r.matchScore, 0) / results.length)
                    : 0,
                  scannedAt: new Date().toISOString(),
                },
              }
            };
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`));
            controller.close();
          } catch (error: any) {
            console.error('[API] Market scan error:', error);
            const errorData = {
              type: 'error',
              data: {
                error: 'Market scan failed',
                details: error.message,
              }
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(customReadable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming mode (backward compatibility)
    const scanner = new MarketScanner(apiKey);
    const results = await scanner.scanMarket(
      strategy.dsl as StrategyDsl,
      scanConfig,
      maxResults
    );

    console.log(`[API] Scan complete. Found ${results.length} results.`);

    return NextResponse.json({
      success: true,
      strategy: {
        id: strategy.id,
        name: strategy.name,
        direction: strategy.direction,
        timeframe: strategy.timeframe,
      },
      config: scanConfig,
      results,
      metadata: {
        totalScanned: results.length,
        qualified: results.filter(r => r.matchDetails.eligible).length,
        avgMatchScore: results.length > 0
          ? Math.round(results.reduce((sum, r) => sum + r.matchScore, 0) / results.length)
          : 0,
        scannedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[API] Market scan error:', error);
    return NextResponse.json(
      {
        error: 'Market scan failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
