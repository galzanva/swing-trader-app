import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PolygonClient } from "@/lib/data-vendors/polygon";
import { runTechnicalAnalysis, generateAISummaryPrompt, TechnicalAnalysisReport } from "@/lib/technical-analysis";
import { generateAITechnicalAnalysis, prepareAIInput, AIAnalysisOutput } from "@/lib/technical-analysis/ai-analyst";
import { isLLMConfigured, getModelDisplayName } from "@/lib/llm/config";

/**
 * Technical Analysis API - AI-Enhanced Technical Analysis
 * Uses the configured LLM for intelligent interpretation of technical data
 * Provides reasoning-backed signal grades, projections, and recommendations
 */

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { symbol, timeframe = "1day", aiEvaluate = false } = body;

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 }
      );
    }

    // Validate timeframe
    const validTimeframes = ["1min", "5min", "15min", "1hour", "1day"];
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json(
        { error: `Invalid timeframe. Must be one of: ${validTimeframes.join(", ")}` },
        { status: 400 }
      );
    }

    const polygonApiKey = process.env.POLYGON_API_KEY;

    if (!polygonApiKey) {
      return NextResponse.json(
        { error: "POLYGON_API_KEY not configured" },
        { status: 500 }
      );
    }

    console.log(`[TechnicalAnalysis] Starting analysis for ${symbol} on ${timeframe} (AI: ${aiEvaluate ? 'requested' : 'off'})`);

    // 1. Fetch market data
    const polygonClient = new PolygonClient(polygonApiKey);
    const marketData = await polygonClient.getAggregates(symbol, timeframe as any);

    // Minimum bars needed for analysis varies by timeframe
    // - Daily: 50 bars (swing trading, 200 EMA needs history)
    // - Intraday: 26 bars minimum (RSI-14, structure analysis needs 20, ~2hrs of 5min data)
    // Note: Polygon free tier may limit intraday history; 5min typically needs paid plan
    const minBarsRequired: Record<string, number> = {
      '1min': 26,
      '5min': 26,
      '15min': 26,
      '1hour': 26,
      '1day': 50
    };
    const requiredBars = minBarsRequired[timeframe] || 26;
    
    // Determine if this is intraday analysis (different trading style)
    const isIntraday = ['1min', '5min', '15min', '1hour'].includes(timeframe);
    
    if (marketData.bars.length < requiredBars) {
      console.warn(`[TechnicalAnalysis] Insufficient data: got ${marketData.bars.length} bars, need ${requiredBars}`);
      
      const intradaySuggestion = timeframe === '5min' || timeframe === '1min'
        ? '5min/1min data often requires a Polygon paid plan. Try 15min or 1hour, or use 1day for swing trading.'
        : timeframe !== '1day'
          ? 'Your Polygon plan may have limited intraday history. Try 1day for swing trading analysis.'
          : 'This stock may be newly listed or have limited trading history.';
      
      return NextResponse.json(
        { 
          error: `Insufficient data for ${timeframe} analysis. Got ${marketData.bars.length} bars, need at least ${requiredBars}.`,
          details: {
            barsReceived: marketData.bars.length,
            barsRequired: requiredBars,
            timeframe,
            suggestion: intradaySuggestion
          }
        },
        { status: 400 }
      );
    }
    
    // Log warning if we have limited data for longer-period indicators
    if (marketData.bars.length < 50) {
      console.warn(`[TechnicalAnalysis] Limited data (${marketData.bars.length} bars): 50+ period EMAs will use partial data`);
    }

    console.log(`[TechnicalAnalysis] Fetched ${marketData.bars.length} bars for ${symbol} (${timeframe})`);

    // 2. Convert bars to OHLCV format
    const ohlcv = marketData.bars.map(bar => ({
      timestamp: bar.timestamp || Date.now(),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume
    }));

    // 3. Run base technical analysis (indicators, patterns, levels)
    console.log(`[TechnicalAnalysis] Running base technical analysis...`);
    const report = runTechnicalAnalysis(ohlcv, symbol.toUpperCase(), timeframe);
    
    console.log(`[TechnicalAnalysis] Base analysis complete:
    - Base Signal: ${report.signalStrength.overall}/100 (${report.signalStrength.grade})
    - Direction: ${report.signalStrength.direction}
    - Strategy: ${report.recommendation.strategy}
    - Squeeze: ${report.squeeze.isInSqueeze ? `YES (${report.squeeze.squeezeDuration} bars)` : 'NO'}
    `);

    // 4. Run AI-enhanced analysis ONLY when explicitly requested
    let aiAnalysis: AIAnalysisOutput | null = null;
    let aiSummary = undefined;
    
    if (aiEvaluate) {
      if (!isLLMConfigured()) {
        return NextResponse.json(
          { error: "LLM API key not configured. AI evaluation requires an API key for the configured provider." },
          { status: 500 }
        );
      }
      
      try {
        console.log(`[TechnicalAnalysis] Running AI evaluation (requested by user)...`);
        
        const aiInput = prepareAIInput(
          symbol.toUpperCase(),
          timeframe,
          report.currentPrice,
          report.indicators,
          report.assessments,
          report.structureAnalysis,
          report.squeeze,
          report.levels.supportResistance,
          report.detectedRegime,
          isIntraday
        );
        
        aiAnalysis = await generateAITechnicalAnalysis(aiInput, undefined, isIntraday);
        
        if (aiAnalysis && aiAnalysis.signalStrength) {
          console.log(`[TechnicalAnalysis] AI Evaluation complete:
          - AI Signal: ${aiAnalysis.signalStrength?.overall}/100 (${aiAnalysis.signalStrength?.grade})
          - AI Direction: ${aiAnalysis.signalStrength?.direction}
          - AI Strategy: ${aiAnalysis.recommendation?.strategy}
          - AI Confidence: ${aiAnalysis.recommendation?.confidence}%
          - Headline: ${aiAnalysis.narrative?.headline}
          `);
          
          const narr = aiAnalysis.narrative;
          const rec = aiAnalysis.recommendation;
          aiSummary = {
            headline: narr?.headline || "AI Analysis Available",
            technicalOutlook: narr?.technicalOutlook || (rec?.confidenceReasoning ? `Confidence reasoning: ${rec.confidenceReasoning}` : "Detailed analysis provided below."),
            keyInsights: (narr?.keyInsights?.length ? narr.keyInsights : (rec?.keyOpportunities?.length ? rec.keyOpportunities : [])) || [],
            riskFactors: (narr?.riskFactors?.length ? narr.riskFactors : (rec?.keyRisks?.length ? rec.keyRisks : [])) || [],
            tradingPlan: narr?.tradingPlan || (rec?.invalidation ? `Invalidation: ${rec.invalidation}` : (rec?.confidenceReasoning || "See recommendation section.")),
            confidenceLevel: narr?.confidenceLevel || "medium"
          };
        } else {
          console.warn(`[TechnicalAnalysis] AI evaluation returned incomplete data (missing signalStrength). Received keys:`,
            aiAnalysis ? Object.keys(aiAnalysis) : 'null');
          aiAnalysis = null;
        }
      } catch (aiError) {
        console.error(`[TechnicalAnalysis] AI evaluation failed:`, aiError);
        aiAnalysis = null;
      }
    } else {
      console.log(`[TechnicalAnalysis] Pure technical analysis mode (no AI)`);
    }

    // 5. Compile final report with AI enhancements
    const finalReport: TechnicalAnalysisReport & { aiEnhanced?: any } = {
      ...report,
      aiSummary
    };
    
    // If AI analysis succeeded, enhance the report with AI-driven values
    if (aiAnalysis && aiAnalysis.signalStrength) {
      finalReport.aiEnhanced = {
        // AI-driven signal strength (replaces hardcoded)
        signalStrength: {
          overall: aiAnalysis.signalStrength.overall,
          grade: aiAnalysis.signalStrength.grade,
          direction: aiAnalysis.signalStrength.direction,
          reasoning: aiAnalysis.signalStrength.reasoning,
          breakdown: aiAnalysis.signalStrength.breakdown
        },
        // AI-driven price projections (replaces fixed ATR multiples)
        priceProjections: aiAnalysis.priceProjections,
        // AI-driven structure analysis (replaces hardcoded logic)
        structureAnalysis: aiAnalysis.structureAnalysis,
        // AI-driven recommendation (replaces if-else chains)
        recommendation: {
          action: aiAnalysis.recommendation.action,
          strategy: aiAnalysis.recommendation.strategy,
          confidence: aiAnalysis.recommendation.confidence,
          confidenceReasoning: aiAnalysis.recommendation.confidenceReasoning,
          entry: aiAnalysis.recommendation.entry,
          stopLoss: aiAnalysis.recommendation.stopLoss,
          targets: aiAnalysis.recommendation.targets,
          invalidation: aiAnalysis.recommendation.invalidation,
          keyRisks: aiAnalysis.recommendation.keyRisks,
          keyOpportunities: aiAnalysis.recommendation.keyOpportunities
        }
      };
    }

    // Add market data metadata
    const responseWithMeta = {
      ...finalReport,
      marketData: {
        name: marketData.name,
        exchange: marketData.exchange,
        marketCap: marketData.marketCap,
        lastBarDate: marketData.lastBarDate.toISOString(),
        dataAgeDays: marketData.dataAgeDays,
        barsAnalyzed: marketData.bars.length
      },
      analysisMode: aiAnalysis ? 'ai-enhanced' : 'technical-only',
      aiModel: aiAnalysis ? getModelDisplayName() : undefined,
    };

    console.log(`[TechnicalAnalysis] Complete for ${symbol} (mode: ${aiAnalysis ? 'AI-enhanced' : 'rule-based'})`);

    return NextResponse.json(responseWithMeta, { status: 200 });

  } catch (error: any) {
    console.error("[TechnicalAnalysis] Error:", error);
    
    return NextResponse.json(
      { 
        error: "Technical analysis failed", 
        message: error.message || "Unknown error occurred",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Generate fallback summary when OpenAI is not available
 */
function generateFallbackSummary(report: TechnicalAnalysisReport): TechnicalAnalysisReport['aiSummary'] {
  const { signalStrength, assessments, recommendation, indicators, projections, squeeze } = report;
  const isWait = recommendation.direction === 'wait';
  
  // Build headline based on recommendation
  let headline: string;
  if (isWait) {
    headline = `No Clear Edge - ${signalStrength.direction} bias with mixed signals`;
  } else {
    const directionWord = recommendation.direction === 'long' ? 'Bullish' : 'Bearish';
    headline = `${directionWord} ${assessments.momentum.strength} setup - ${recommendation.strategy}`;
  }
  
  // Build technical outlook
  let outlook = '';
  if (isWait) {
    outlook = `${report.symbol} shows mixed signals without a clear trading edge. `;
    outlook += `Price is ${indicators.movingAverages.priceVsEma20 > 0 ? 'above' : 'below'} key EMAs with ${assessments.trend.emaAlignment} alignment. `;
    outlook += `RSI at ${indicators.momentum.rsi.toFixed(1)} (${indicators.momentum.rsiSignal}) and ADX at ${indicators.trend.adx.toFixed(1)} indicate ${indicators.trend.adx < 20 ? 'range-bound conditions' : 'moderate trend presence'}. `;
    outlook += `Recommendation is to wait for a cleaner setup or confirmed breakout.`;
  } else {
    const bias = recommendation.direction === 'long' ? 'bullish' : 'bearish';
    outlook = `${report.symbol} shows ${bias} momentum supporting a ${recommendation.direction} position. `;
    outlook += `RSI at ${indicators.momentum.rsi.toFixed(1)} is ${indicators.momentum.rsiSignal}. `;
    outlook += `EMA alignment is ${assessments.trend.emaAlignment} with price ${indicators.movingAverages.priceVsEma20 > 0 ? 'above' : 'below'} the 20 EMA. `;
    if (squeeze.isInSqueeze) {
      outlook += `TTM Squeeze active - volatility compression may precede explosive move.`;
    }
  }
  
  // Build key insights
  const keyInsights: string[] = [];
  keyInsights.push(`Signal Grade: ${signalStrength.grade} (${signalStrength.overall}/100)`);
  
  if (isWait) {
    keyInsights.push(`Mixed signals - insufficient edge for directional trade`);
    keyInsights.push(`Price range-bound between support and resistance`);
    keyInsights.push(`Wait for volume-confirmed breakout before entry`);
  } else {
    keyInsights.push(`Momentum: ${assessments.momentum.direction} (${assessments.momentum.strength})`);
    keyInsights.push(`Trend: ${assessments.trend.primary.direction} with ADX at ${indicators.trend.adx.toFixed(1)}`);
    keyInsights.push(`Volume: ${indicators.volume.volumeSignal} activity`);
  }
  
  // Build risk factors
  const riskFactors: string[] = [];
  
  if (isWait) {
    riskFactors.push('No clear directional bias - premature entry increases loss probability');
    if (assessments.volatility.regime === 'high') {
      riskFactors.push('High volatility may cause false breakouts');
    }
    riskFactors.push('Wait for confirmation before committing capital');
  } else {
    if (assessments.volatility.regime === 'high') {
      riskFactors.push('High volatility - consider reduced position size');
    }
    if (assessments.momentum.divergences.length > 0) {
      riskFactors.push(assessments.momentum.divergences[0].description);
    }
    if (indicators.momentum.rsi > 70) {
      riskFactors.push('RSI overbought - watch for reversal signals');
    } else if (indicators.momentum.rsi < 30) {
      riskFactors.push('RSI oversold - potential bounce risk for shorts');
    }
    riskFactors.push(`Stop invalidation at $${recommendation.stopLoss.price.toFixed(2)}`);
  }
  
  if (riskFactors.length === 0) {
    riskFactors.push('Standard market risk applies');
  }
  
  // Build trading plan
  let tradingPlan: string;
  
  if (isWait) {
    tradingPlan = `No trade recommended. Current price action lacks conviction. `;
    tradingPlan += `Monitor for: (1) Breakout above resistance with volume, or (2) Breakdown below support with volume. `;
    tradingPlan += `Key levels: Resistance near $${recommendation.targets.t1.price.toFixed(2)}, Support near $${recommendation.targets.t3.price.toFixed(2)}.`;
  } else {
    tradingPlan = `${recommendation.direction.toUpperCase()} entry: ${recommendation.entry.type} at $${recommendation.entry.price.toFixed(2)}. `;
    tradingPlan += `Stop: $${recommendation.stopLoss.price.toFixed(2)} (${recommendation.stopLoss.riskPercent.toFixed(1)}% risk). `;
    tradingPlan += `Targets: T1=$${recommendation.targets.t1.price.toFixed(2)} (${recommendation.targets.t1.rr}:1 R:R), `;
    tradingPlan += `T2=$${recommendation.targets.t2.price.toFixed(2)} (${recommendation.targets.t2.rr}:1 R:R), `;
    tradingPlan += `T3=$${recommendation.targets.t3.price.toFixed(2)} (${recommendation.targets.t3.rr}:1 R:R).`;
  }
  
  // Determine confidence
  let confidenceLevel: 'high' | 'medium' | 'low';
  if (isWait) {
    confidenceLevel = 'low';
  } else if (signalStrength.overall >= 70 && assessments.momentum.strength === 'strong') {
    confidenceLevel = 'high';
  } else if (signalStrength.overall >= 55) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'low';
  }
  
  return {
    headline,
    technicalOutlook: outlook,
    keyInsights,
    riskFactors,
    tradingPlan,
    confidenceLevel
  };
}

