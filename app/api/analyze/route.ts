import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PolygonClient } from "@/lib/data-vendors/polygon";
import { calculateTechnicalIndicators, findSupportResistance } from "@/lib/indicators/technical";
import { detectPatterns, getPrimaryPattern } from "@/lib/patterns/detector";
import { calculateSetupScore } from "@/lib/scoring/rating";
import { createRiskManagementPlan, validateRiskReward } from "@/lib/risk/management";
import { LLMAnalyzer } from "@/lib/llm/analyzer";

export interface AnalysisReport {
  symbol: string;
  name: string;
  timeframe: string;
  currentPrice: number;
  
  // Header info
  pattern: {
    name: string;
    type: string;
    confidence: number;
  };
  
  // Score
  score: {
    overall: number;
    rating: string;
    recommendation: string;
    breakdown: {
      technical: number;
      momentum: number;
      trend: number;
      pattern: number;
      volume: number;
    };
  };
  
  // Entry, stop, targets
  riskManagement: {
    entry: number;
    stopLoss: number;
    targets: {
      target1: number;
      target2: number;
      target3: number;
    };
    riskReward: {
      target1: number;
      target2: number;
      target3: number;
    };
    positionSize: string;
    riskAmount: string;
    reasoning: string;
    isValid: boolean;
    validationMessage: string;
  };
  
  // Technical facts
  technical: {
    ema9: number;
    ema20: number;
    ema50: number;
    ema200: number;
    rsi: number;
    macd: {
      value: number;
      signal: number;
      histogram: number;
    };
    volumeZScore: number;
    atr: number;
    trend: string;
    trendStrength: number;
    supportLevels: number[];
    resistanceLevels: number[];
  };
  
  // Probabilities & AI Analysis
  analysis: {
    narrative: string;
    mentorNotes: string;
    reasoning: string[];
    warnings: string[];
    strengths: string[];
  };
  
  // Additional info
  marketData: {
    marketCap?: number;
    exchange?: string;
  };
  
  timestamp: string;
}

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

    console.log(`[Analyze] Starting analysis for ${symbol} on ${timeframe}`);

    // 1. Fetch market data
    const polygonClient = new PolygonClient(polygonApiKey);
    const marketData = await polygonClient.getAggregates(symbol, timeframe as any);

    if (marketData.bars.length < 200) {
      return NextResponse.json(
        { error: "Insufficient data for analysis. Need at least 200 bars." },
        { status: 400 }
      );
    }

    console.log(`[Analyze] Fetched ${marketData.bars.length} bars`);

    // 2. Calculate technical indicators
    const indicators = calculateTechnicalIndicators(marketData.bars);
    console.log(`[Analyze] Calculated technical indicators`);

    // 3. Find support/resistance levels
    const supportResistance = findSupportResistance(marketData.bars);
    console.log(`[Analyze] Found ${supportResistance.support.length} support and ${supportResistance.resistance.length} resistance levels`);

    // 4. Detect patterns
    const patterns = detectPatterns(marketData.bars);
    const primaryPattern = getPrimaryPattern(marketData.bars);
    console.log(`[Analyze] Detected ${patterns.length} patterns. Primary: ${primaryPattern.name}`);

    // 5. Calculate setup score
    const score = calculateSetupScore(indicators, primaryPattern);
    console.log(`[Analyze] Setup score: ${score.overall}/100 (${score.rating})`);

    // 6. Create risk management plan
    const riskPlan = createRiskManagementPlan(
      marketData.currentPrice,
      indicators,
      primaryPattern,
      supportResistance
    );
    const rrValidation = validateRiskReward(riskPlan.riskReward);
    console.log(`[Analyze] Risk/Reward: ${riskPlan.riskReward.target1}:1 (Valid: ${rrValidation.isValid})`);

    // 7. Generate AI analysis (if OpenAI key is available)
    let aiAnalysis;
    if (openaiApiKey) {
      try {
        const llmAnalyzer = new LLMAnalyzer(openaiApiKey);
        aiAnalysis = await llmAnalyzer.generateAnalysis(
          symbol,
          timeframe,
          indicators,
          primaryPattern,
          score,
          riskPlan
        );
        console.log(`[Analyze] Generated AI analysis`);
      } catch (error) {
        console.error("[Analyze] Error generating AI analysis:", error);
        // Use fallback analysis
        aiAnalysis = {
          narrative: `Technical analysis shows ${primaryPattern.name} pattern with ${score.overall}/100 setup score.`,
          mentorNotes: "AI analysis unavailable. Review technical indicators manually.",
          reasoning: [`${primaryPattern.name} detected`, `Score: ${score.overall}/100`],
          warnings: ["AI analysis failed - review data carefully"],
          strengths: []
        };
      }
    } else {
      // Fallback without AI
      aiAnalysis = {
        narrative: `${symbol} shows ${primaryPattern.name} pattern on ${timeframe} with ${indicators.trend} trend. RSI: ${indicators.rsi.toFixed(1)}, Overall score: ${score.overall}/100.`,
        mentorNotes: `Technical setup with ${score.rating} rating. ${score.recommendation} recommendation based on current indicators.`,
        reasoning: [
          `${primaryPattern.name} pattern identified`,
          `${indicators.trend} trend with ${indicators.strength} strength`,
          `RSI at ${indicators.rsi.toFixed(1)}`
        ],
        warnings: indicators.rsi > 70 ? ["RSI overbought"] : indicators.rsi < 30 ? ["RSI oversold"] : [],
        strengths: score.overall > 70 ? ["High setup quality", "Favorable technical alignment"] : []
      };
    }

    // 8. Compile full report
    const report: AnalysisReport = {
      symbol: marketData.symbol,
      name: marketData.name,
      timeframe: marketData.timeframe,
      currentPrice: marketData.currentPrice,
      
      pattern: {
        name: primaryPattern.name,
        type: primaryPattern.type,
        confidence: primaryPattern.confidence
      },
      
      score: {
        overall: score.overall,
        rating: score.rating,
        recommendation: score.recommendation,
        breakdown: {
          technical: score.technical,
          momentum: score.momentum,
          trend: score.trend,
          pattern: score.pattern,
          volume: score.volume
        }
      },
      
      riskManagement: {
        entry: riskPlan.entry,
        stopLoss: riskPlan.stopLoss,
        targets: riskPlan.targets,
        riskReward: riskPlan.riskReward,
        positionSize: riskPlan.positionSize,
        riskAmount: riskPlan.riskAmount,
        reasoning: riskPlan.reasoning,
        isValid: rrValidation.isValid,
        validationMessage: rrValidation.message
      },
      
      technical: {
        ema9: indicators.ema9,
        ema20: indicators.ema20,
        ema50: indicators.ema50,
        ema200: indicators.ema200,
        rsi: indicators.rsi,
        macd: indicators.macd,
        volumeZScore: indicators.volumeZScore,
        atr: indicators.atr,
        trend: indicators.trend,
        trendStrength: indicators.strength,
        supportLevels: supportResistance.support,
        resistanceLevels: supportResistance.resistance
      },
      
      analysis: aiAnalysis,
      
      marketData: {
        marketCap: marketData.marketCap,
        exchange: marketData.exchange
      },
      
      timestamp: new Date().toISOString()
    };

    console.log(`[Analyze] Analysis complete for ${symbol}`);

    return NextResponse.json(report, { status: 200 });

  } catch (error: any) {
    console.error("[Analyze] Error:", error);
    
    return NextResponse.json(
      { 
        error: "Analysis failed", 
        message: error.message || "Unknown error occurred",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
