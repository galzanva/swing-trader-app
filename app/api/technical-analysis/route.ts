import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PolygonClient } from "@/lib/data-vendors/polygon";
import { runTechnicalAnalysis, generateAISummaryPrompt, TechnicalAnalysisReport } from "@/lib/technical-analysis";

/**
 * Technical Analysis API - Pure Technical Analysis
 * No fundamentals, no news, no options
 * Focus: Indicators, patterns, probabilities, price projections
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
    const { symbol, timeframe = "1day" } = body;

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

    // Check for API keys
    const polygonApiKey = process.env.POLYGON_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!polygonApiKey) {
      return NextResponse.json(
        { error: "POLYGON_API_KEY not configured" },
        { status: 500 }
      );
    }

    console.log(`[TechnicalAnalysis] Starting analysis for ${symbol} on ${timeframe}`);

    // 1. Fetch market data
    const polygonClient = new PolygonClient(polygonApiKey);
    const marketData = await polygonClient.getAggregates(symbol, timeframe as any);

    if (marketData.bars.length < 100) {
      return NextResponse.json(
        { error: "Insufficient data for analysis. Need at least 100 bars." },
        { status: 400 }
      );
    }

    console.log(`[TechnicalAnalysis] Fetched ${marketData.bars.length} bars for ${symbol}`);

    // 2. Convert bars to OHLCV format
    const ohlcv = marketData.bars.map(bar => ({
      timestamp: bar.timestamp || Date.now(),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume
    }));

    // 3. Run complete technical analysis
    console.log(`[TechnicalAnalysis] Running technical analysis...`);
    const report = runTechnicalAnalysis(ohlcv, symbol.toUpperCase(), timeframe);
    
    console.log(`[TechnicalAnalysis] Analysis complete:
    - Signal Strength: ${report.signalStrength.overall}/100 (${report.signalStrength.grade})
    - Direction: ${report.signalStrength.direction}
    - Strategy: ${report.recommendation.strategy}
    - Momentum: ${report.assessments.momentum.direction} (${report.assessments.momentum.strength})
    - Trend: ${report.assessments.trend.emaAlignment} alignment
    - Volatility: ${report.assessments.volatility.regime}
    - Squeeze: ${report.squeeze.isInSqueeze ? `YES (${report.squeeze.squeezeDuration} bars)` : 'NO'}
    `);

    // 4. Generate AI summary if OpenAI is available
    let aiSummary = undefined;
    
    if (openaiApiKey) {
      try {
        console.log(`[TechnicalAnalysis] Generating AI summary...`);
        
        const prompt = generateAISummaryPrompt(report);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a professional technical analyst. Provide concise, data-driven analysis based ONLY on technical indicators. Never mention fundamentals, news, or external factors. Always respond with valid JSON.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3,
            max_tokens: 1000,
            response_format: { type: 'json_object' }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices[0]?.message?.content;
          
          if (content) {
            try {
              aiSummary = JSON.parse(content);
              console.log(`[TechnicalAnalysis] AI summary generated: ${aiSummary.headline}`);
            } catch (parseError) {
              console.error(`[TechnicalAnalysis] Failed to parse AI response:`, parseError);
            }
          }
        } else {
          console.error(`[TechnicalAnalysis] OpenAI API error: ${response.status}`);
        }
      } catch (aiError) {
        console.error(`[TechnicalAnalysis] AI summary generation failed:`, aiError);
      }
    } else {
      // Generate fallback summary without AI
      console.log(`[TechnicalAnalysis] No OpenAI key - using fallback summary`);
      aiSummary = generateFallbackSummary(report);
    }

    // 5. Compile final report with AI summary
    const finalReport: TechnicalAnalysisReport = {
      ...report,
      aiSummary
    };

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
      }
    };

    console.log(`[TechnicalAnalysis] Complete for ${symbol}`);

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

