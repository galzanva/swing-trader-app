import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PolygonClient } from "@/lib/data-vendors/polygon";
import { calculateTechnicalIndicators, findSupportResistance } from "@/lib/indicators/technical";
import { detectPatterns, getPrimaryPattern, getCompositePattern } from "@/lib/patterns/detector";
import { detectAllChartPatterns } from "@/lib/patterns/chart-patterns";
import { detectAllPatterns } from "@/lib/patterns/detector-v2";
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
  
  // All detected chart patterns (ranked by confidence)
  allChartPatterns: Array<{
    name: string;
    type: string;
    confidence: number;
    confidenceLabel: string;
    breakoutStatus: string;
  }>;
  
  // V2 Pattern Detection - Two-Tier System
  patternV2?: {
    // Institutional pattern (valid/tradeable)
    institutional?: {
      name: string;
      type: string;
      direction: string;
      confidence: number;
      confidenceLabel: string;
      breakoutStatus: string;
      priceTarget?: number;
      keyLevels: {
        support: number[];
        resistance: number[];
      };
      volumeZScore: number;
      reasons: string[];
      metadata: Record<string, any>;
    };
    // Candidate pattern (not confirmed)
    candidate?: {
      name: string;
      type: string;
      direction: string;
      confidence: number;
      confidenceLabel: string;
      metCriteria: string[];
      unmetCriteria: string[];
      nextSteps: string[];
      metadata: Record<string, any>;
    };
    // Explainability
    compositeReasons?: string[];
    chartPatternReasons?: string[];
    candlestickFacts?: {
      bodyPct?: number;
      wickTopPct?: number;
      wickBotPct?: number;
      engulfPct?: number;
      volRatio?: number;
      volZ?: number;
      closeLocationPct?: number;
    };
    chartPatternMetadata?: {
      touchesUpper?: number;
      touchesLower?: number;
      totalTouches?: number;
      widthPct?: number;
      widthATR?: number;
      slopeUpperPctPerBar?: number;
      slopeLowerPctPerBar?: number;
      r2Upper?: number;
      r2Lower?: number;
      breakoutVolZ?: number;
      symmetryPct?: number;
      heightATR?: number;
      separationBars?: number;
    };
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

    // 4. Detect patterns (V2: deterministic, explainable)
    const useV2 = process.env.PATTERN_DETECTION_V2 !== 'false'; // Default to V2
    
    let compositePattern;
    let allChartPatterns;
    let patternsV2;
    
    if (useV2) {
      console.log(`[Analyze] Using Pattern Detection V2`);
      // Calculate avg dollar volume from recent bars
      const avgDollarVolume = marketData.bars.slice(-20).reduce((sum, bar) => 
        sum + (bar.close * bar.volume), 0) / 20;
      
      patternsV2 = detectAllPatterns(marketData.bars, {
        avgDollarVolume,
        minLiquidityThreshold: 1000000,
        daysToEarnings: null // TODO: integrate earnings calendar
      });
      
      // Map V2 to V1 compatible format (use institutional pattern if available, otherwise use for display only)
      const v1ChartPattern = patternsV2.institutional ? {
        name: patternsV2.institutional.name,
        type: patternsV2.institutional.direction,
        confidence: patternsV2.institutional.confidence,
        confidenceLabel: patternsV2.institutional.confidenceLabel,
        description: `${patternsV2.institutional.name} (${patternsV2.institutional.type})`,
        breakoutStatus: patternsV2.institutional.breakoutStatus,
        priceTarget: patternsV2.institutional.priceTarget,
        keyLevels: patternsV2.institutional.keyLevels,
        volumeConfirmation: patternsV2.institutional.volumeZScore >= 1.0,
        volumeZScore: patternsV2.institutional.volumeZScore,
        patternHeight: null,
        metadata: patternsV2.institutional.metadata,
        reasons: patternsV2.institutional.reasons
      } : null;
      
      compositePattern = {
        candlestickPattern: {
          name: patternsV2.candlestickPattern.name,
          type: patternsV2.candlestickPattern.type,
          confidence: patternsV2.candlestickPattern.confidence,
          description: patternsV2.candlestickPattern.description,
          timeframe: patternsV2.candlestickPattern.timeframe,
          validation: patternsV2.candlestickPattern.facts as any // Type compatibility
        },
        chartPattern: v1ChartPattern,
        fusedConfidence: patternsV2.composite.composite,
        fusionBonus: Object.values(patternsV2.composite.bonuses).reduce((sum, val) => sum + (val || 0), 0) - 
                     Object.values(patternsV2.composite.penalties).reduce((sum, val) => sum + (val || 0), 0),
        analysis: patternsV2.composite.analysis
      } as any; // Type cast for V1/V2 compatibility
      
      // Map all two-tier results to old format for display
      allChartPatterns = patternsV2.allTwoTierResults
        .filter(r => r.institutional !== null)
        .map(r => r.institutional!)
        .map(p => ({
          name: p.name,
          type: p.direction,
          confidence: p.confidence,
          confidenceLabel: p.confidenceLabel,
          breakoutStatus: p.breakoutStatus
        }));
      
      const instName = patternsV2.institutional ? patternsV2.institutional.name : 'None';
      const candName = patternsV2.candidate ? `(Candidate: ${patternsV2.candidate.name})` : '';
      console.log(`[Analyze] V2 Candlestick: ${patternsV2.candlestickPattern.name}, Institutional: ${instName} ${candName}`);
      console.log(`[Analyze] V2 Composite: ${patternsV2.composite.composite}/100 (${patternsV2.composite.compositeLabel})`);
      console.log(`[Analyze] V2 Reasons:`, patternsV2.composite.reasons);
      console.log(`[Analyze] V2 Detected ${allChartPatterns.length} institutional patterns:`, allChartPatterns.map(p => `${p.name} (${p.confidence}%)`).join(', '));
    } else {
      console.log(`[Analyze] Using Pattern Detection V1`);
      const patterns = detectPatterns(marketData.bars);
      compositePattern = getCompositePattern(marketData.bars);
      allChartPatterns = detectAllChartPatterns(marketData.bars);
      console.log(`[Analyze] Candlestick: ${compositePattern.candlestickPattern.name}, Chart: ${compositePattern.chartPattern?.name || 'None'}`);
      console.log(`[Analyze] Pattern fusion: ${compositePattern.fusionBonus > 0 ? '+' : ''}${compositePattern.fusionBonus} bonus, Fused confidence: ${compositePattern.fusedConfidence}%`);
      console.log(`[Analyze] Detected ${allChartPatterns.length} chart patterns:`, allChartPatterns.map(p => `${p.name} (${p.confidence}%)`).join(', '));
    }

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
      // Handle narrative based on pattern type
      let chartInfo = '';
      let chartBanner = '';
      
      if (compositePattern.chartPattern) {
        // Institutional pattern
        chartInfo = ` ${compositePattern.chartPattern.name} (${compositePattern.chartPattern.breakoutStatus}) provides market structure.`;
        chartBanner = compositePattern.chartPattern.name;
      } else if (useV2 && patternsV2 && patternsV2.candidate) {
        // Candidate pattern
        const candidate = patternsV2.candidate;
        const topUnmet = candidate.unmetCriteria.length > 0 ? candidate.unmetCriteria[0] : '';
        const nextStep = candidate.nextSteps.length > 0 ? candidate.nextSteps[0] : 'monitor for confirmation';
        chartInfo = ` Candidate (Not Confirmed): ${candidate.name} — structure nearly fits institutional rules but fails: ${topUnmet}. Next: ${nextStep}.`;
        chartBanner = `Candidate pattern detected (not institutional)`;
      } else {
        // No pattern
        chartInfo = '';
        chartBanner = '';
      }
      
      // Build mentor notes with candidate pattern guidance if applicable
      let mentorNotes = compositePattern.analysis + ` Technical setup with ${score.rating} rating. ${score.recommendation} recommendation.`;
      
      // Add candidate pattern guidance
      if (useV2 && patternsV2 && patternsV2.candidate && !patternsV2.institutional) {
        const candidate = patternsV2.candidate;
        mentorNotes += `\n\n📚 Pattern Education — Why Not Institutional:\nThe ${candidate.name} pattern shows potential but doesn't yet meet professional-grade criteria. `;
        
        if (candidate.unmetCriteria.length > 0) {
          mentorNotes += `Key missing element: ${candidate.unmetCriteria[0].toLowerCase()}. `;
        }
        
        if (candidate.nextSteps.length > 0) {
          mentorNotes += `To upgrade to institutional (tradeable) status: ${candidate.nextSteps[0].toLowerCase()}. `;
        }
        
        mentorNotes += `Until then, treat this as a learning opportunity rather than a trade signal. Institutional patterns have stricter requirements to reduce false signals and improve edge.`;
      }
      
      aiAnalysis = {
        narrative: `${symbol} shows ${compositePattern.candlestickPattern.name} on ${timeframe}.${chartInfo} ${indicators.alignment} alignment (${indicators.trend}). Long-term bias: ${indicators.longTermBias}. RSI: ${indicators.rsi.toFixed(1)}, Overall score: ${score.overall}/100.`,
        mentorNotes,
        reasoning: [
          `Candlestick: ${compositePattern.candlestickPattern.name}`,
          chartBanner || 'No chart pattern',
          `Fusion bonus: ${compositePattern.fusionBonus > 0 ? '+' : ''}${compositePattern.fusionBonus}`,
          `${indicators.alignment} alignment, ${indicators.longTermBias} long-term bias`
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
      
      allChartPatterns: allChartPatterns.map(p => ({
        name: p.name,
        type: p.type,
        confidence: p.confidence,
        confidenceLabel: p.confidenceLabel,
        breakoutStatus: p.breakoutStatus
      })),
      
      // V2 Pattern Detection Data - Two-Tier System
      ...(useV2 && patternsV2 ? {
        patternV2: {
          institutional: patternsV2.institutional ? {
            name: patternsV2.institutional.name,
            type: patternsV2.institutional.type as string,
            direction: patternsV2.institutional.direction as string,
            confidence: patternsV2.institutional.confidence,
            confidenceLabel: patternsV2.institutional.confidenceLabel,
            breakoutStatus: patternsV2.institutional.breakoutStatus as string,
            priceTarget: (patternsV2.institutional.priceTarget === null ? undefined : patternsV2.institutional.priceTarget) as number | undefined,
            keyLevels: patternsV2.institutional.keyLevels,
            volumeZScore: patternsV2.institutional.volumeZScore,
            reasons: patternsV2.institutional.reasons,
            metadata: patternsV2.institutional.metadata
          } : undefined,
          candidate: patternsV2.candidate ? {
            name: patternsV2.candidate.name,
            type: patternsV2.candidate.type as string,
            direction: patternsV2.candidate.direction as string,
            confidence: patternsV2.candidate.confidence,
            confidenceLabel: patternsV2.candidate.confidenceLabel,
            metCriteria: patternsV2.candidate.metCriteria,
            unmetCriteria: patternsV2.candidate.unmetCriteria,
            nextSteps: patternsV2.candidate.nextSteps,
            metadata: patternsV2.candidate.metadata
          } : undefined,
          compositeReasons: patternsV2.composite.reasons,
          chartPatternReasons: patternsV2.institutional?.reasons || patternsV2.candidate?.metCriteria,
          candlestickFacts: patternsV2.candlestickPattern.facts,
          chartPatternMetadata: patternsV2.institutional?.metadata || patternsV2.candidate?.metadata
        }
      } : {}),
      
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
