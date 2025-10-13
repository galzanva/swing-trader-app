import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PolygonClient } from "@/lib/data-vendors/polygon";
import { calculateTechnicalIndicators, findSupportResistance } from "@/lib/indicators/technical";
import { detectPatterns, getPrimaryPattern, getCompositePattern } from "@/lib/patterns/detector";
import { calculateSetupScore, calculateCompositeScore } from "@/lib/scoring/rating";
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
    validation?: {
      wickToBodyRatio?: number;
      bodySize?: number;
      volumeRatio?: number;
      note?: string;
    };
  };
  
  // Chart pattern info
  chartPattern: {
    name: string;
    type: string;
    confidence: number;
    confidenceLabel: string;
    breakoutStatus: string;
    priceTarget?: number;
    keyLevels: {
      resistance?: number[];
      support?: number[];
      breakoutLevel?: number;
    };
    volumeConfirmation: boolean;
    volumeZScore?: number;
    metadata?: {
      tightness?: number;
      duration?: number;
      trendStrength?: number;
    };
  } | null;
  
  // Pattern fusion info
  patternFusion: {
    fusedConfidence: number;
    fusionBonus: number;
    analysis: string;
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
    atrValue: number;
    atrMultiple: number;
    riskPerShare: number;
    riskPercent: number;
    positionSize: string;
    riskAmount: string;
    reasoning: string;
    isValid: boolean;
    validationMessage: string;
    direction: "long" | "short";
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
    emaCompression: number;
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
    lastBarDate: string;
    dataAgeDays: number;
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

    // 4. Detect patterns (candlestick + chart patterns)
    const patterns = detectPatterns(marketData.bars);
    const compositePattern = getCompositePattern(marketData.bars);
    console.log(`[Analyze] Candlestick: ${compositePattern.candlestickPattern.name}, Chart: ${compositePattern.chartPattern?.name || 'None'}`);
    console.log(`[Analyze] Pattern fusion: ${compositePattern.fusionBonus > 0 ? '+' : ''}${compositePattern.fusionBonus} bonus, Fused confidence: ${compositePattern.fusedConfidence}%`);

    // 5. Calculate setup score (with chart pattern fusion)
    const score = calculateCompositeScore(indicators, compositePattern);
    console.log(`[Analyze] Setup score: ${score.overall}/100 (${score.rating})`);

    // 6. Create risk management plan (using candlestick pattern for entry/stop placement)
    const riskPlan = createRiskManagementPlan(
      marketData.currentPrice,
      indicators,
      compositePattern.candlestickPattern,
      supportResistance
    );
    const rrValidation = validateRiskReward(riskPlan.riskReward);
    console.log(`[Analyze] Risk/Reward: ${riskPlan.riskReward.target1}:1 (Valid: ${rrValidation.isValid})`);

    // 7. Generate AI analysis (if OpenAI key is available)
    let aiAnalysis;
    if (openaiApiKey) {
      try {
        const llmAnalyzer = new LLMAnalyzer(openaiApiKey);
        aiAnalysis = await llmAnalyzer.generateCompositeAnalysis(
          symbol,
          timeframe,
          indicators,
          compositePattern,
          score,
          riskPlan
        );
        console.log(`[Analyze] Generated AI analysis with chart pattern context`);
      } catch (error) {
        console.error("[Analyze] Error generating AI analysis:", error);
        // Use fallback analysis
        aiAnalysis = {
          narrative: compositePattern.chartPattern 
            ? `${compositePattern.chartPattern.name} chart pattern (${compositePattern.chartPattern.confidence}%) combined with ${compositePattern.candlestickPattern.name} provides ${compositePattern.fusionBonus > 0 ? 'strong' : 'conflicting'} signal. Overall score: ${score.overall}/100.`
            : `Technical analysis shows ${compositePattern.candlestickPattern.name} pattern with ${score.overall}/100 setup score.`,
          mentorNotes: compositePattern.analysis,
          reasoning: [
            `Candlestick: ${compositePattern.candlestickPattern.name} (${compositePattern.candlestickPattern.confidence}%)`,
            compositePattern.chartPattern ? `Chart pattern: ${compositePattern.chartPattern.name} (${compositePattern.chartPattern.confidence}%)` : 'No chart pattern detected',
            `Fusion confidence: ${compositePattern.fusedConfidence}%`
          ],
          warnings: ["AI analysis failed - review data carefully"],
          strengths: []
        };
      }
    } else {
      // Fallback without AI
      const chartInfo = compositePattern.chartPattern 
        ? ` ${compositePattern.chartPattern.name} (${compositePattern.chartPattern.breakoutStatus}) provides market structure.`
        : '';
      
      aiAnalysis = {
        narrative: `${symbol} shows ${compositePattern.candlestickPattern.name} on ${timeframe}.${chartInfo} ${indicators.trend} trend. RSI: ${indicators.rsi.toFixed(1)}, Overall score: ${score.overall}/100.`,
        mentorNotes: compositePattern.analysis + ` Technical setup with ${score.rating} rating. ${score.recommendation} recommendation.`,
        reasoning: [
          `Candlestick: ${compositePattern.candlestickPattern.name}`,
          compositePattern.chartPattern ? `Chart: ${compositePattern.chartPattern.name} (${compositePattern.chartPattern.breakoutStatus})` : 'No chart pattern',
          `Fusion bonus: ${compositePattern.fusionBonus > 0 ? '+' : ''}${compositePattern.fusionBonus}`,
          `${indicators.trend} trend with ${indicators.strength} strength`
        ],
        warnings: indicators.rsi > 70 ? ["RSI overbought"] : indicators.rsi < 30 ? ["RSI oversold"] : [],
        strengths: score.overall > 70 ? ["High setup quality", compositePattern.fusionBonus > 10 ? "Strong pattern alignment" : "Favorable technical alignment"] : []
      };
    }

    // 8. Compile full report
    const report: AnalysisReport = {
      symbol: marketData.symbol,
      name: marketData.name,
      timeframe: marketData.timeframe,
      currentPrice: marketData.currentPrice,
      
      pattern: {
        name: compositePattern.candlestickPattern.name,
        type: compositePattern.candlestickPattern.type,
        confidence: compositePattern.candlestickPattern.confidence,
        validation: compositePattern.candlestickPattern.validation
      },
      
      chartPattern: compositePattern.chartPattern ? {
        name: compositePattern.chartPattern.name,
        type: compositePattern.chartPattern.type,
        confidence: compositePattern.chartPattern.confidence,
        confidenceLabel: compositePattern.chartPattern.confidenceLabel || `${compositePattern.chartPattern.confidence}% confidence`,
        breakoutStatus: compositePattern.chartPattern.breakoutStatus,
        priceTarget: compositePattern.chartPattern.priceTarget,
        keyLevels: compositePattern.chartPattern.keyLevels,
        volumeConfirmation: compositePattern.chartPattern.volumeConfirmation,
        volumeZScore: compositePattern.chartPattern.volumeZScore,
        metadata: compositePattern.chartPattern.metadata
      } : null,
      
      patternFusion: {
        fusedConfidence: compositePattern.fusedConfidence,
        fusionBonus: compositePattern.fusionBonus,
        analysis: compositePattern.analysis
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
        atrValue: riskPlan.atrValue,
        atrMultiple: riskPlan.atrMultiple,
        riskPerShare: riskPlan.riskPerShare,
        riskPercent: riskPlan.riskPercent,
        positionSize: riskPlan.positionSize,
        riskAmount: riskPlan.riskAmount,
        reasoning: riskPlan.reasoning,
        isValid: rrValidation.isValid,
        validationMessage: rrValidation.message,
        direction: riskPlan.direction
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
        emaCompression: indicators.emaCompression,
        supportLevels: supportResistance.support,
        resistanceLevels: supportResistance.resistance
      },
      
      analysis: aiAnalysis,
      
      marketData: {
        marketCap: marketData.marketCap,
        exchange: marketData.exchange,
        lastBarDate: marketData.lastBarDate.toISOString(),
        dataAgeDays: marketData.dataAgeDays
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
