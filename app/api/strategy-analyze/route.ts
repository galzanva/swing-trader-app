/**
 * Strategy Analysis API Route - Version 1.1
 * Implements complete AI swing trading strategy system
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PolygonClient } from '@/lib/data-vendors/polygon';
import { buildStrategyInput, detectSPYRegimeFromData } from '@/lib/strategies/input-builder';
import { evaluateAllStrategies, getStrategySummary } from '@/lib/strategies/orchestrator';
import { generateFullMentorOutput, generateMarkdownReport } from '@/lib/strategies/mentor';
import { evaluateAllStrategiesWithUser } from '@/lib/strategy-builder/orchestrator-integration';
import { analyzeCombinedSqueeze } from '@/lib/indicators/squeeze';
import { LLMAnalyzer } from '@/lib/llm/analyzer';
import { isLLMConfigured, getModelDisplayName } from '@/lib/llm/config';

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { symbol, timeframe = '1day', recordHistory = false } = body;

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    // Validate timeframe
    const validTimeframes = ['1min', '5min', '15min', '1hour', '1day'];
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json(
        { error: `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for API keys
    const polygonApiKey = process.env.POLYGON_API_KEY;

    if (!polygonApiKey) {
      return NextResponse.json(
        { error: 'POLYGON_API_KEY not configured' },
        { status: 500 }
      );
    }

    console.log(`[Strategy Analyze] Starting analysis for ${symbol} on ${timeframe}`);

    // 1. Fetch market data WITH short interest
    const polygonClient = new PolygonClient(polygonApiKey);
    const marketData = await polygonClient.getAggregatesWithShortInterest(symbol, timeframe as any);

    if (marketData.bars.length < 100) {
      return NextResponse.json(
        { error: 'Insufficient data for analysis. Need at least 100 bars.' },
        { status: 400 }
      );
    }

    console.log(`[Strategy Analyze] Fetched ${marketData.bars.length} bars with short interest data`);

    // 2. Fetch SPY data for regime detection (optional)
    let spyRegime: 'bullish' | 'neutral' | 'bearish' = 'neutral';
    try {
      const spyData = await polygonClient.getAggregates('SPY', timeframe as any);
      if (spyData.bars.length >= 200) {
        const spyOHLCV = spyData.bars.map(b => ({
          timestamp: b.timestamp,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume,
        }));
        spyRegime = detectSPYRegimeFromData(spyOHLCV);
        console.log(`[Strategy Analyze] SPY regime: ${spyRegime}`);
      }
    } catch (error) {
      console.warn('[Strategy Analyze] Could not fetch SPY data, using neutral regime');
    }

    // 3. Build strategy input
    const strategyInput = buildStrategyInput(marketData, spyRegime, null);
    console.log(`[Strategy Analyze] Built strategy input`);

    // 4. Calculate Squeeze Analysis (Short Float + TTM Squeeze)
    let squeezeAnalysis;
    try {
      const ohlcv = marketData.bars.map(b => ({
        timestamp: b.timestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      }));
      
      const shortInterest = marketData.shortInterest || {};
      const combinedSqueeze = analyzeCombinedSqueeze(ohlcv, shortInterest, 5);
      
      // Pass the FULL combined squeeze object (not transformed)
      // The LLM expects the flat structure with combinedScore, combinedPotential, etc.
      squeezeAnalysis = combinedSqueeze;
      
      console.log(`[Strategy Analyze] Squeeze analysis: ${combinedSqueeze.combinedPotential} potential (score: ${combinedSqueeze.combinedScore})`);
    } catch (error) {
      console.error('[Strategy Analyze] Error analyzing squeeze dynamics:', error);
      squeezeAnalysis = undefined;
    }

    // 5. Evaluate all strategies (user strategies first, then core strategies)
    const userId = session.user?.id;
    const evaluation = await evaluateAllStrategiesWithUser(strategyInput, userId);
    
    if (!evaluation) {
      return NextResponse.json({
        error: 'No strategy evaluation returned',
        message: 'Internal error during strategy evaluation',
      }, { status: 500 });
    }

    console.log(`[Strategy Analyze] Evaluated strategies: ${evaluation.strategy} - ${evaluation.status}`);

    // 6. Generate AI-powered mentor analysis (if OpenAI key available)
    let aiAnalysis;
    let mentorOutput;
    
    if (isLLMConfigured() && (evaluation.status === 'ready' || evaluation.status === 'candidate')) {
      try {
        const llmAnalyzer = new LLMAnalyzer();
        aiAnalysis = await llmAnalyzer.generateStrategyAnalysis(
          symbol,
          evaluation,
          strategyInput,
          squeezeAnalysis
        );
        console.log(`[Strategy Analyze] Generated AI mentor analysis with squeeze insights`);
      } catch (error) {
        console.error('[Strategy Analyze] Error generating AI analysis:', error);
        // Fallback to template-based mentor
        mentorOutput = generateFullMentorOutput(evaluation);
      }
    } else {
      // Fallback to template-based mentor
      mentorOutput = generateFullMentorOutput(evaluation);
      console.log(`[Strategy Analyze] Generated template-based mentor explanation`);
    }

    // 7. Calculate summary statistics
    const summary = getStrategySummary(evaluation);
    console.log(`[Strategy Analyze] Risk: $${summary.risk}, Reward: $${summary.reward}, RR: ${summary.rrRatio}`);

    // 8. Historical data is now provided by BACKTESTING (no database needed)
    // The backtesting engine already scanned the 200 bars and found historical occurrences
    // recordHistory parameter is now ignored - backtesting runs automatically

    // 9. Build response
    const response = {
      // Core evaluation
      evaluation,
      
      // AI Analysis (if available) or fallback to template
      mentor: aiAnalysis ? {
        systemMessage: `AI-powered analysis using ${getModelDisplayName()}`,
        explanation: aiAnalysis.mentorNotes,
        forTrade: aiAnalysis.forTrade,
        againstTrade: aiAnalysis.againstTrade,
        aiGenerated: true,
        aiModel: getModelDisplayName(),
      } : {
        systemMessage: mentorOutput!.systemMessage,
        explanation: mentorOutput!.explanation,
        forTrade: [], // No for/against in template mode
        againstTrade: [], // No for/against in template mode
        aiGenerated: false,
      },
      
      // Squeeze Analysis
      squeezeAnalysis,
      
      // Summary stats
      summary,
      
      // Market context
      context: {
        symbol: marketData.symbol,
        name: marketData.name,
        currentPrice: marketData.currentPrice,
        timeframe: marketData.timeframe,
        dataAgeDays: marketData.dataAgeDays,
        lastBarDate: marketData.lastBarDate.toISOString(),
        spyRegime,
        marketCap: marketData.marketCap,
        exchange: marketData.exchange,
      },
      
      // Technical indicators (for UI display)
      technical: {
        ema9: strategyInput.ema9,
        ema20: strategyInput.ema20,
        ema50: strategyInput.ema50,
        ema200: strategyInput.ema200,
        rsi14: strategyInput.rsi14,
        atr: strategyInput.atr,
        atrPct: strategyInput.atrPct,
        volZ: strategyInput.volZ,
      },
      
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error: any) {
    console.error('[Strategy Analyze] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Analysis failed', 
        message: error.message || 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for generating markdown report
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe') || '1day';

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    // Fetch and analyze (same as POST)
    const polygonApiKey = process.env.POLYGON_API_KEY;
    if (!polygonApiKey) {
      return NextResponse.json(
        { error: 'POLYGON_API_KEY not configured' },
        { status: 500 }
      );
    }

    const polygonClient = new PolygonClient(polygonApiKey);
    const marketData = await polygonClient.getAggregates(symbol, timeframe as any);

    if (marketData.bars.length < 100) {
      return NextResponse.json(
        { error: 'Insufficient data for analysis. Need at least 100 bars.' },
        { status: 400 }
      );
    }

    const strategyInput = buildStrategyInput(marketData, 'neutral', null);
    const evaluation = await evaluateAllStrategies(strategyInput);

    if (!evaluation) {
      return NextResponse.json(
        { error: 'No evaluation returned' },
        { status: 500 }
      );
    }

    // Generate markdown report
    const markdown = generateMarkdownReport(evaluation);

    // Return as text/markdown
    return new Response(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${symbol}_strategy_report.md"`,
      },
    });

  } catch (error: any) {
    console.error('[Strategy Analyze] GET Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Report generation failed', 
        message: error.message 
      },
      { status: 500 }
    );
  }
}

