import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PolygonClient } from "@/lib/data-vendors/polygon";
import { FinnhubClient, type FinnhubComprehensiveFundamentals } from "@/lib/data-vendors/finnhub";
import { calculateTechnicalIndicators, findSupportResistance } from "@/lib/indicators/technical";
import { detectPatterns, getPrimaryPattern, getCompositePattern } from "@/lib/patterns/detector";
import { detectAllChartPatterns } from "@/lib/patterns/chart-patterns";
import { detectAllPatterns } from "@/lib/patterns/detector-v2";
import { calculateSetupScore, calculateCompositeScore } from "@/lib/scoring/rating";

// Helper functions for rating and recommendation
function getRatingFromScore(score: number): "A+" | "A" | "B" | "C" | "D" {
  if (score >= 90) return "A+";
  if (score >= 76) return "A";
  if (score >= 61) return "B";
  if (score >= 41) return "C";
  return "D";
}

function getRecommendationFromScore(score: number, direction: "bullish" | "bearish" | "neutral"): string {
  if (direction === "bullish") {
    if (score >= 76) return "Strong Buy";
    if (score >= 61) return "Buy";
    return "Watch";
  } else if (direction === "bearish") {
    if (score >= 76) return "Strong Short";
    if (score >= 61) return "Short";
    return "Watch";
  }
  return "Watch";
}
import { createRiskManagementPlan, validateRiskReward } from "@/lib/risk/management";
import { LLMAnalyzer } from "@/lib/llm/analyzer";
import { calculateConfirmationEntry } from "@/lib/execution/confirmation-entries";
import { validateReport, formatQAReport, type AnalysisReportForQA } from "@/lib/validation/qa-checklist";
import { analyzeCombinedSqueeze } from "@/lib/indicators/squeeze";

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
    // Discarded pattern (extreme violations - excluded from scoring)
    discarded?: {
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
    ratingAdjustment?: {
      originalScore: number;
      originalRating: string;
      adjustedScore: number;
      adjustedRating: string;
      reason: string;
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
  
  // Execution Plan (Confirmation Entry Logic)
  execution: {
    entry: {
      type: "breakout" | "breakdown" | "retest" | "market";
      triggerPrice: number;
      note: string;
    };
    stopLoss: {
      price: number;
      movePct: number;
    };
    targets: Array<{
      name: string;
      price: number;
      movePct: number;
      rr: number;
    }>;
    status: "ready" | "candidate" | "missed" | "blocked" | "neutral";
    viabilityIndex?: number;
    viabilityLabel?: string;
    warnings: string[];
    patternTarget?: {
      price: number;
      movePct: number;
      confluence?: string;
    };
  };
  
  // Execution Metadata
  executionDirection: "bullish" | "bearish" | "neutral";
  patternSource: "institutional" | "candidate" | "candle-only";
  hasConflict: boolean;
  
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
  
  // Squeeze Analysis (Short Float Squeeze & TTM Squeeze)
  squeezeAnalysis?: {
    shortSqueeze: {
      potential: 'high' | 'moderate' | 'low' | 'none';
      score: number;
      daysToCover: number | null;
      shortFloat: number | null;
      shortVolumeZ: number | null;
      shortVolumeTrend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
      triggers: string[];
      warnings: string[];
    };
    ttmSqueeze: {
      state: 'ON' | 'FIRE' | 'OFF';
      duration: number;
      momentumDirection: 'bullish' | 'bearish' | 'neutral';
      momentumStrength: number;
      fireConfirmed: boolean;
      potentialBreakout: 'bullish' | 'bearish' | 'neutral';
      triggers: string[];
      warnings: string[];
    };
    combined: {
      score: number;
      potential: 'extreme' | 'high' | 'moderate' | 'low' | 'none';
      alignment: boolean;
      recommendation: string;
      triggers: string[];
      warnings: string[];
    };
  };
  
  // Fundamentals Analysis (from Finnhub)
  fundamentals?: FinnhubComprehensiveFundamentals;
  
  // Recent News with Sentiment
  news?: Array<{
    id: string;
    title: string;
    published_utc: string;
    article_url: string;
    description?: string;
    publisher?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    sentiment_reasoning?: string;
  }>;
  
  newsSummary?: {
    overallSentiment: 'bullish' | 'bearish' | 'neutral';
    sentimentScore: number; // -100 to +100
    keyThemes: string[];
    summary: string;
  };
  
  // Options Insight (from Massive.com options chain)
  optionsInsight?: {
    sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
    confidence: 'high' | 'medium' | 'low';
    message: string;
    callPutRatio: number;
    totalCallVolume: number;
    totalPutVolume: number;
    ivTrend: 'rising' | 'flat' | 'falling';
    atmStrike: number;
    topCallStrikes: Array<{ strike: number; volume: number; oi: number }>;
    topPutStrikes: Array<{ strike: number; volume: number; oi: number }>;
    expirations: string[];
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
    const finnhubApiKey = process.env.FINNHUB_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!polygonApiKey) {
      return NextResponse.json(
        { error: "POLYGON_API_KEY not configured" },
        { status: 500 }
      );
    }
    
    if (!finnhubApiKey) {
      console.warn('[Analyze] FINNHUB_API_KEY not configured - fundamental analysis will be limited');
    }

    console.log(`[Analyze] Starting analysis for ${symbol} on ${timeframe}`);

    // 1. Fetch market data with short interest
    const polygonClient = new PolygonClient(polygonApiKey);
    const marketData = await polygonClient.getAggregatesWithShortInterest(symbol, timeframe as any);

    if (marketData.bars.length < 100) {
  return NextResponse.json(
        { error: "Insufficient data for analysis. Need at least 100 bars." },
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
    // CRITICAL: Determine execution direction from pattern hierarchy (institutional > candidate > candle)
    let executionDirection: "bullish" | "bearish" | "neutral" = "neutral";
    let patternSource: "institutional" | "candidate" | "candle-only" = "candle-only";
    
    if (useV2 && patternsV2) {
      if (patternsV2.institutional) {
        // Institutional pattern drives direction (highest priority)
        executionDirection = patternsV2.institutional.direction as "bullish" | "bearish" | "neutral";
        patternSource = "institutional";
        console.log(`[Analyze] Direction from INSTITUTIONAL: ${patternsV2.institutional.name} (${executionDirection})`);
      } else if (patternsV2.candidate) {
        // Candidate pattern drives direction (medium priority)
        executionDirection = patternsV2.candidate.direction as "bullish" | "bearish" | "neutral";
        patternSource = "candidate";
        console.log(`[Analyze] Direction from CANDIDATE: ${patternsV2.candidate.name} (${executionDirection})`);
      } else {
        // Candlestick only (lowest priority)
        executionDirection = compositePattern.candlestickPattern.type === 'bullish' ? 'bullish' :
                            compositePattern.candlestickPattern.type === 'bearish' ? 'bearish' : 'neutral';
        patternSource = "candle-only";
        console.log(`[Analyze] Direction from CANDLE: ${compositePattern.candlestickPattern.name} (${executionDirection})`);
      }
    } else {
      // V1 fallback: use candlestick pattern
      executionDirection = compositePattern.candlestickPattern.type === 'bullish' ? 'bullish' :
                          compositePattern.candlestickPattern.type === 'bearish' ? 'bearish' : 'neutral';
      patternSource = "candle-only";
    }
    
    // Detect conflicts between candle and chart patterns
    let hasConflict = false;
    if (useV2 && patternsV2) {
      const chartDirection = patternsV2.institutional?.direction || patternsV2.candidate?.direction;
      const candleDirection = compositePattern.candlestickPattern.type;
      
      if (chartDirection && candleDirection && 
          chartDirection !== 'neutral' && candleDirection !== 'neutral' &&
          chartDirection !== candleDirection) {
        hasConflict = true;
        console.log(`[Analyze] CONFLICT DETECTED: Chart ${chartDirection} vs Candle ${candleDirection}`);
      }
    }
    
    const score = calculateCompositeScore(indicators, compositePattern, executionDirection);
    
    // Apply candidate cap rule globally
    let mainScore: number;
    if (useV2 && patternsV2 && patternsV2.institutional) {
      // Institutional: use pattern score (composite)
      mainScore = score.pattern;
    } else if (useV2 && patternsV2 && patternsV2.candidate) {
      // Candidate: apply cap at 65
      mainScore = Math.min(score.pattern, 65);
    } else {
      // Candle-only or V1: use overall score
      mainScore = score.overall;
    }
    
    let mainRating = getRatingFromScore(mainScore);
    let mainRecommendation = getRecommendationFromScore(mainScore, executionDirection);
    
    console.log(`[Analyze] Setup score: ${mainScore}/100 (${mainRating}) - ${executionDirection} direction`);

    // 6. Create risk management plan (using executionDirection for correct direction)
    const riskPlan = createRiskManagementPlan(
      marketData.currentPrice,
      indicators,
      compositePattern.candlestickPattern,
      supportResistance,
      executionDirection // Pass execution direction from pattern hierarchy
    );
    const rrValidation = validateRiskReward(riskPlan.riskReward);
    console.log(`[Analyze] Risk/Reward: ${riskPlan.riskReward.target1}:1 (Valid: ${rrValidation.isValid})`);

    // 6.5. Calculate confirmation entry with rule-based triggers
    const avgDollarVolume = marketData.bars.slice(-20).reduce((sum, bar) => 
      sum + (bar.close * bar.volume), 0) / 20;

    const executionPlan = calculateConfirmationEntry({
      currentPrice: marketData.currentPrice,
      bars: marketData.bars,
      atr: indicators.atr,
      direction: executionDirection,
      chartPattern: compositePattern.chartPattern ? {
        name: compositePattern.chartPattern.name,
        breakoutLevel: compositePattern.chartPattern.keyLevels?.breakoutLevel,
        breakoutStatus: compositePattern.chartPattern.breakoutStatus,
        priceTarget: compositePattern.chartPattern.priceTarget,
        keyLevels: {
          support: compositePattern.chartPattern.keyLevels?.support || [],
          resistance: compositePattern.chartPattern.keyLevels?.resistance || []
        }
      } : undefined,
      candlestickPattern: {
        name: compositePattern.candlestickPattern.name,
        type: compositePattern.candlestickPattern.type as "bullish" | "bearish" | "neutral",
        confirmationNeeded: ['Inside Bar', 'Doji'].includes(compositePattern.candlestickPattern.name)
      },
      isInstitutional: !!(useV2 && patternsV2 && patternsV2.institutional),
      isCandidate: !!(useV2 && patternsV2 && patternsV2.candidate),
      daysToEarnings: null, // TODO: integrate earnings calendar
      avgDollarVolume,
      ema200: indicators.ema200,
      volumeZScore: indicators.volumeZScore
    });
    console.log(`[Analyze] Execution: ${executionPlan.status}, Entry ${executionPlan.entry.type} @ $${executionPlan.entry.triggerPrice}`);

    // 6.7. Perform Squeeze Analysis (Short Float + TTM Squeeze)
    let squeezeAnalysis;
    try {
      console.log(`[Analyze] Analyzing squeeze dynamics...`);
      const ohlcv = marketData.bars.map(bar => ({
        timestamp: bar.timestamp || Date.now(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      }));
      
      const shortInterest = marketData.shortInterest || {};
      const combinedSqueeze = analyzeCombinedSqueeze(ohlcv, shortInterest, 5);
      
      squeezeAnalysis = {
        shortSqueeze: {
          potential: combinedSqueeze.shortSqueeze.potential,
          score: combinedSqueeze.shortSqueeze.score,
          daysToCover: combinedSqueeze.shortSqueeze.daysToCover,
          shortFloat: combinedSqueeze.shortSqueeze.shortFloat,
          shortVolumeZ: combinedSqueeze.shortSqueeze.shortVolumeZ,
          shortVolumeTrend: combinedSqueeze.shortSqueeze.shortVolumeTrend,
          triggers: combinedSqueeze.shortSqueeze.triggers,
          warnings: combinedSqueeze.shortSqueeze.warnings,
        },
        ttmSqueeze: {
          state: combinedSqueeze.ttmSqueeze.current.state,
          duration: combinedSqueeze.ttmSqueeze.squeezeDuration,
          momentumDirection: combinedSqueeze.ttmSqueeze.current.momentumDirection,
          momentumStrength: combinedSqueeze.ttmSqueeze.current.momentumStrength,
          fireConfirmed: combinedSqueeze.ttmSqueeze.fireConfirmed,
          potentialBreakout: combinedSqueeze.ttmSqueeze.potentialBreakout,
          triggers: combinedSqueeze.ttmSqueeze.triggers,
          warnings: combinedSqueeze.ttmSqueeze.warnings,
        },
        combined: {
          score: combinedSqueeze.combinedScore,
          potential: combinedSqueeze.combinedPotential,
          alignment: combinedSqueeze.alignment,
          recommendation: combinedSqueeze.recommendation,
          triggers: combinedSqueeze.triggers,
          warnings: combinedSqueeze.warnings,
        },
      };
      
      console.log(`[Analyze] Squeeze analysis complete: ${combinedSqueeze.combinedPotential} potential (score: ${combinedSqueeze.combinedScore})`);
    } catch (error) {
      console.error("[Analyze] Error analyzing squeeze dynamics:", error);
      squeezeAnalysis = undefined;
    }

    // 6.8. Fetch Fundamentals from Finnhub (in parallel with news from Polygon)
    let fundamentalsData: FinnhubComprehensiveFundamentals | undefined;
    let newsArticles;
    let newsSummary;
    
    try {
      console.log(`[Analyze] Fetching fundamentals (Finnhub) and news (Polygon)...`);
      
      // Fetch in parallel
      const finnhubClient = finnhubApiKey ? new FinnhubClient(finnhubApiKey) : null;
      const [fundamentals, news] = await Promise.all([
        finnhubClient ? finnhubClient.getComprehensiveFundamentals(symbol, marketData.currentPrice) : Promise.resolve(undefined),
        polygonClient.getNews(symbol, 5) // Get 5 most recent articles
      ]);
      
      // Process Finnhub fundamentals
      if (fundamentals) {
        fundamentalsData = fundamentals;
        console.log(`[Analyze] Finnhub fundamentals - Quality: ${fundamentals.qualityScore}, Viability: ${fundamentals.viabilityScore}, Risk: ${fundamentals.riskScore}`);
        console.log(`[Analyze] Valuation: ${fundamentals.viability.valuation}, Quality: ${fundamentals.quality.grade}, Risk: ${fundamentals.risk.level}`);
        if (fundamentals.profile) {
          console.log(`[Analyze] Company Profile - Sector: ${fundamentals.profile.sector || 'N/A'}, Industry: ${fundamentals.profile.industry || 'N/A'}`);
        }
      } else {
        console.log(`[Analyze] No fundamentals data available for ${symbol}`);
      }
      
      // Process news
      if (news && news.length > 0) {
        console.log(`[Analyze] Found ${news.length} news articles`);
        
        // Calculate sentiment
        let positiveCount = 0;
        let negativeCount = 0;
        let neutralCount = 0;
        const keyThemes: Set<string> = new Set();
        
        newsArticles = news.map(article => {
          // Extract sentiment from insights
          let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
          let sentiment_reasoning = '';
          
          if (article.insights && article.insights.length > 0) {
            const insight = article.insights.find(i => i.ticker === symbol) || article.insights[0];
            sentiment = insight.sentiment;
            sentiment_reasoning = insight.sentiment_reasoning || '';
            
            if (sentiment === 'positive') positiveCount++;
            else if (sentiment === 'negative') negativeCount++;
            else neutralCount++;
          } else {
            neutralCount++;
          }
          
          // Extract themes from title (simple keyword extraction)
          const titleWords = article.title.toLowerCase().split(' ');
          const themes = ['earnings', 'revenue', 'growth', 'acquisition', 'partnership', 'lawsuit', 'downgrade', 'upgrade'];
          titleWords.forEach(word => {
            if (themes.some(theme => word.includes(theme))) {
              keyThemes.add(word);
            }
          });
          
          return {
            id: article.id,
            title: article.title,
            published_utc: article.published_utc,
            article_url: article.article_url,
            description: article.description,
            publisher: article.publisher?.name,
            sentiment,
            sentiment_reasoning
          };
        });
        
        // Calculate overall sentiment
        const sentimentScore = ((positiveCount - negativeCount) / news.length) * 100;
        const overallSentiment: 'bullish' | 'bearish' | 'neutral' = 
          sentimentScore > 20 ? 'bullish' : sentimentScore < -20 ? 'bearish' : 'neutral';
        
        newsSummary = {
          overallSentiment,
          sentimentScore,
          keyThemes: Array.from(keyThemes),
          summary: `${positiveCount} positive, ${negativeCount} negative, ${neutralCount} neutral articles. Overall sentiment: ${overallSentiment}.`
        };
        
        console.log(`[Analyze] News sentiment: ${overallSentiment} (score: ${sentimentScore.toFixed(0)})`);
      } else {
        console.log(`[Analyze] No news articles found for ${symbol}`);
      }
    } catch (error) {
      console.error("[Analyze] Error fetching fundamentals or news:", error);
    }

    // Fetch and analyze options chain
    let optionsInsight;
    try {
      console.log(`[Analyze] Fetching options chain for ${symbol}...`);
      const optionsChain = await polygonClient.getOptionsChain(symbol, marketData.currentPrice);
      
      if (optionsChain) {
        console.log(`[Analyze] Options chain received: ${optionsChain.contracts.length} contracts across ${[...new Set(optionsChain.contracts.map(c => c.expiration))].length} expirations`);
        
        try {
          // Analyze options sentiment (use executionDirection from pattern hierarchy)
          const fullOptionsInsight = polygonClient.analyzeOptionsInsight(optionsChain, {
            direction: executionDirection,
            rsi: indicators.rsi,
            volZ: indicators.volumeZScore,
            trend: compositePattern.candlestickPattern.name,
          });
          
          // Store the insight (excluding raw data for API response)
          optionsInsight = {
            sentiment: fullOptionsInsight.sentiment,
            confidence: fullOptionsInsight.confidence,
            message: fullOptionsInsight.message,
            callPutRatio: fullOptionsInsight.callPutRatio,
            totalCallVolume: fullOptionsInsight.totalCallVolume,
            totalPutVolume: fullOptionsInsight.totalPutVolume,
            ivTrend: fullOptionsInsight.ivTrend,
            atmStrike: fullOptionsInsight.atmStrike,
            topCallStrikes: fullOptionsInsight.topCallStrikes,
            topPutStrikes: fullOptionsInsight.topPutStrikes,
            expirations: fullOptionsInsight.expirations,
          };
          
          console.log(`[Analyze] ✅ Options sentiment: ${optionsInsight.sentiment} (${optionsInsight.confidence} confidence)`);
          console.log(`[Analyze] ✅ Call/Put ratio: ${optionsInsight.callPutRatio.toFixed(2)}, IV trend: ${optionsInsight.ivTrend}`);
          console.log(`[Analyze] ✅ Options insight successfully generated and will be included in report`);
        } catch (analysisError) {
          console.error(`[Analyze] Error analyzing options chain:`, analysisError);
          optionsInsight = undefined;
        }
      } else {
        console.log(`[Analyze] ⚠️ No options data available for ${symbol} (optionsChain is null)`);
      }
    } catch (error) {
      console.error("[Analyze] Error fetching or analyzing options:", error);
    }

    // 7. Generate AI analysis (if OpenAI key is available)
    let aiAnalysis;
    let ratingAdjustmentDetails: {
      originalScore: number;
      originalRating: string;
      adjustedScore: number;
      adjustedRating: string;
      reason: string;
    } | undefined;
    
    if (openaiApiKey) {
      try {
        const llmAnalyzer = new LLMAnalyzer(openaiApiKey);
        aiAnalysis = await llmAnalyzer.generateCompositeAnalysis(
          symbol,
          timeframe,
          indicators,
          compositePattern,
          score,
          riskPlan,
          executionPlan,
          squeezeAnalysis, // Pass squeeze analysis to LLM
          fundamentalsData, // Pass fundamentals to LLM
          newsSummary, // Pass news summary to LLM
          optionsInsight, // Pass options insight to LLM
          mainScore // Pass the ACTUAL displayed score (mainScore) to prevent AI hallucination
        );
        console.log(`[Analyze] Generated AI analysis with fundamentals, news, and options context`);
        
        // Apply AI rating adjustment if provided and store the adjustment details
        if (aiAnalysis.ratingAdjustment) {
          const originalScore = mainScore;
          const originalRating = mainRating;
          mainScore = aiAnalysis.ratingAdjustment.adjustedScore;
          mainRating = aiAnalysis.ratingAdjustment.adjustedRating;
          mainRecommendation = getRecommendationFromScore(mainScore, executionDirection);
          
          ratingAdjustmentDetails = {
            originalScore,
            originalRating,
            adjustedScore: mainScore,
            adjustedRating: mainRating,
            reason: aiAnalysis.ratingAdjustment.reason
          };
          
          console.log(`[Analyze] 🎯 AI ADJUSTED RATING: ${originalScore}/100 (${originalRating}) → ${mainScore}/100 (${mainRating})`);
          console.log(`[Analyze] Reason: ${aiAnalysis.ratingAdjustment.reason}`);
        }
      } catch (error) {
        console.error("[Analyze] Error generating AI analysis:", error);
        console.log("[Analyze] Falling back to comprehensive non-LLM analysis...");
        // Use comprehensive fallback (same as no-key fallback below)
        const trendDesc = indicators.trend === 'bullish' ? 'bullish' : indicators.trend === 'bearish' ? 'bearish' : 'neutral';
        const priceVs200 = marketData.currentPrice > indicators.ema200 ? 'above' : 'below';
        const countertrend = (executionDirection === 'bullish' && priceVs200 === 'below') || (executionDirection === 'bearish' && priceVs200 === 'above');
        
        const patternStr = compositePattern.chartPattern 
          ? `${compositePattern.chartPattern.name} chart pattern (${compositePattern.chartPattern.confidence}% confidence, ${compositePattern.chartPattern.breakoutStatus})`
          : 'candlestick-only setup';
        
        const squeezeStr = squeezeAnalysis && squeezeAnalysis.combined.potential !== 'none'
          ? `Squeeze dynamics show ${squeezeAnalysis.combined.potential} potential (score: ${squeezeAnalysis.combined.score}/100). ` +
            (squeezeAnalysis.ttmSqueeze?.state === 'FIRE' ? 'TTM Squeeze FIRE detected - breakout in progress. ' : 
             squeezeAnalysis.ttmSqueeze?.state === 'ON' ? `TTM Squeeze ON for ${squeezeAnalysis.ttmSqueeze.duration} bars - volatility compression building. ` : '') +
            (squeezeAnalysis.shortSqueeze?.shortFloat ? `Short float at ${squeezeAnalysis.shortSqueeze.shortFloat.toFixed(1)}%. ` : '')
          : 'No significant squeeze dynamics detected. ';
        
        const newsStr = newsSummary
          ? `Recent news sentiment is ${newsSummary.overallSentiment} (${newsSummary.sentimentScore > 0 ? '+' : ''}${newsSummary.sentimentScore.toFixed(0)}). `
          : 'No recent news available. ';
        
        const narrative = `${symbol} presents a ${executionDirection} setup on ${timeframe} with ${patternStr}. ` +
          `Technical: ${trendDesc} trend, RSI ${indicators.rsi.toFixed(1)}, ${indicators.alignment} alignment. ` +
          squeezeStr + newsStr +
          `Overall score: ${mainScore}/100 (${mainRating}). ` +
          (countertrend ? `Note: This is a countertrend trade (price ${priceVs200} 200 EMA). ` : '');
        
        let mentorNotes = `**Technical Setup Analysis:**\n`;
        mentorNotes += `${compositePattern.candlestickPattern.name} pattern with ${compositePattern.candlestickPattern.confidence}% confidence provides ${executionDirection} entry signal. `;
        if (compositePattern.chartPattern) {
          mentorNotes += `${compositePattern.chartPattern.name} structure confirms with ${compositePattern.chartPattern.confidence}% confidence (${compositePattern.chartPattern.breakoutStatus}). `;
        }
        mentorNotes += `Price action shows ${indicators.alignment} alignment in a ${trendDesc} trend (strength: ${indicators.strength}).\n\n`;
        
        if (squeezeAnalysis && squeezeAnalysis.combined.potential !== 'none') {
          mentorNotes += `**Squeeze Dynamics:**\n${squeezeAnalysis.combined.recommendation}\n\n`;
        }
        
        if (newsSummary && newsSummary.overallSentiment !== 'neutral') {
          mentorNotes += `**News Sentiment:**\n${newsSummary.summary} `;
          mentorNotes += newsSummary.overallSentiment === 'bullish' ? 'Positive sentiment provides catalyst support. ' :
                         'Negative sentiment creates headwind - watch for reversal. ';
          mentorNotes += `\n\n`;
        }
        
        mentorNotes += `**Risk Management:**\nEntry: $${riskPlan.entry.toFixed(2)}, Stop: $${riskPlan.stopLoss.toFixed(2)} (${riskPlan.riskPercent.toFixed(1)}% risk). R:R: ${riskPlan.riskReward.target1.toFixed(1)}:1.`;
        
        const reasoning = [
          `Technical: ${compositePattern.candlestickPattern.name} + ${patternStr}`,
          `Trend: ${trendDesc} (${indicators.strength} strength)`,
          `Momentum: RSI ${indicators.rsi.toFixed(1)}, MACD ${indicators.macd.histogram > 0 ? 'positive' : 'negative'}`,
        ];
        if (squeezeAnalysis && squeezeAnalysis.combined.potential !== 'none') {
          reasoning.push(`Squeeze: ${squeezeAnalysis.combined.potential} potential`);
        }
        if (newsSummary) {
          reasoning.push(`Sentiment: ${newsSummary.overallSentiment}`);
        }
        
        const strengths = [];
        if (mainScore >= 70) strengths.push('High quality technical setup');
        if (compositePattern.fusionBonus > 10) strengths.push('Strong pattern alignment');
        if (squeezeAnalysis && squeezeAnalysis.combined.score >= 50) strengths.push(`${squeezeAnalysis.combined.potential} squeeze dynamics`);
        if (newsSummary && newsSummary.overallSentiment === (executionDirection === 'bullish' ? 'bullish' : 'bearish')) strengths.push('News sentiment aligned');
        if (strengths.length === 0) strengths.push('Setup meets minimum criteria');
        
        const warnings = [];
        if (countertrend) warnings.push('Countertrend trade - higher risk');
        if (indicators.rsi > 70) warnings.push('RSI overbought');
        if (indicators.rsi < 30) warnings.push('RSI oversold');
        if (newsSummary && newsSummary.overallSentiment !== 'neutral' && newsSummary.overallSentiment !== (executionDirection === 'bullish' ? 'bullish' : 'bearish')) {
          warnings.push('News sentiment conflicts with trade direction');
        }
        if (warnings.length === 0) warnings.push('Monitor for confirmation');
        
        aiAnalysis = { narrative, mentorNotes, reasoning, warnings, strengths };
      }
    } else {
      // Fallback without AI - Create comprehensive analysis using all available data
      console.log('[Analyze] Using comprehensive fallback analysis (no OpenAI key)');
      
      // Technical analysis
      const trendDesc = indicators.trend === 'bullish' ? 'bullish' : indicators.trend === 'bearish' ? 'bearish' : 'neutral';
      const priceVs200 = marketData.currentPrice > indicators.ema200 ? 'above' : 'below';
      const countertrend = (executionDirection === 'bullish' && priceVs200 === 'below') || (executionDirection === 'bearish' && priceVs200 === 'above');
      
      // Pattern analysis
      const patternStr = compositePattern.chartPattern 
        ? `${compositePattern.chartPattern.name} chart pattern (${compositePattern.chartPattern.confidence}% confidence, ${compositePattern.chartPattern.breakoutStatus})`
        : 'candlestick-only setup';
      
      // Squeeze analysis
      const squeezeStr = squeezeAnalysis && squeezeAnalysis.combined.potential !== 'none'
        ? `Squeeze dynamics show ${squeezeAnalysis.combined.potential} potential (score: ${squeezeAnalysis.combined.score}/100). ` +
          (squeezeAnalysis.ttmSqueeze?.state === 'FIRE' ? 'TTM Squeeze FIRE detected - breakout in progress. ' : 
           squeezeAnalysis.ttmSqueeze?.state === 'ON' ? `TTM Squeeze ON for ${squeezeAnalysis.ttmSqueeze.duration} bars - volatility compression building. ` : '') +
          (squeezeAnalysis.shortSqueeze?.shortFloat ? `Short float at ${squeezeAnalysis.shortSqueeze.shortFloat.toFixed(1)}%. ` : '')
        : 'No significant squeeze dynamics detected. ';
      
      // Fundamentals analysis
      const fundamentalsStr = fundamentalsData
        ? `Fundamentals: ${fundamentalsData.viability.valuation} valuation with ${fundamentalsData.quality.grade} quality ` +
          `(Quality: ${fundamentalsData.qualityScore}/100, Viability: ${fundamentalsData.viabilityScore}/100, Risk: ${fundamentalsData.riskScore}/100). ` +
          (fundamentalsData.viability.pe ? `P/E: ${fundamentalsData.viability.pe.toFixed(1)}. ` : '') +
          (fundamentalsData.quality.roe ? `ROE: ${fundamentalsData.quality.roe.toFixed(1)}%. ` : '')
        : 'Fundamentals data unavailable. ';
      
      // News sentiment
      const newsStr = newsSummary
        ? `Recent news sentiment is ${newsSummary.overallSentiment} (${newsSummary.sentimentScore > 0 ? '+' : ''}${newsSummary.sentimentScore.toFixed(0)}). `
        : 'No recent news available. ';
      
      // Build comprehensive narrative
      const narrative = `${symbol} presents a ${executionDirection} setup on ${timeframe} with ${patternStr}. ` +
        `Technical: ${trendDesc} trend, RSI ${indicators.rsi.toFixed(1)}, ${indicators.alignment} alignment. ` +
        squeezeStr + fundamentalsStr + newsStr +
        `Overall score: ${mainScore}/100 (${mainRating}). ` +
        (countertrend ? `Note: This is a countertrend trade (price ${priceVs200} 200 EMA). ` : '');
      
      // Build comprehensive mentor notes
      let mentorNotes = `**Technical Setup Analysis:**\n`;
      mentorNotes += `${compositePattern.candlestickPattern.name} pattern with ${compositePattern.candlestickPattern.confidence}% confidence provides ${executionDirection} entry signal. `;
      if (compositePattern.chartPattern) {
        mentorNotes += `${compositePattern.chartPattern.name} structure confirms with ${compositePattern.chartPattern.confidence}% confidence (${compositePattern.chartPattern.breakoutStatus}). `;
      }
      mentorNotes += `Price action shows ${indicators.alignment} alignment in a ${trendDesc} trend (strength: ${indicators.strength}).\n\n`;
      
      if (squeezeAnalysis && squeezeAnalysis.combined.potential !== 'none') {
        mentorNotes += `**Squeeze Dynamics:**\n`;
        mentorNotes += `${squeezeAnalysis.combined.recommendation}\n\n`;
      }
      
      if (fundamentalsData) {
        mentorNotes += `**Fundamental Backdrop:**\n`;
        mentorNotes += `${fundamentalsData.quality.summary} ${fundamentalsData.viability.summary} `;
        mentorNotes += `Risk assessment: ${fundamentalsData.risk.summary} `;
        mentorNotes += `\n`;
        mentorNotes += `• Quality Score: ${fundamentalsData.qualityScore}/100\n`;
        mentorNotes += `• Viability Score: ${fundamentalsData.viabilityScore}/100\n`;
        mentorNotes += `• Risk Score: ${fundamentalsData.riskScore}/100\n`;
        mentorNotes += fundamentalsData.viability.valuation === 'undervalued' ? '→ Undervalued entry point supports long-term conviction. ' :
                       fundamentalsData.viability.valuation === 'overvalued' ? '→ Overvaluation increases downside risk - use smaller position size. ' :
                       '→ Fair valuation - technical factors drive near-term action. ';
        mentorNotes += `\n\n`;
      }
      
      if (newsSummary && newsSummary.overallSentiment !== 'neutral') {
        mentorNotes += `**News Sentiment:**\n`;
        mentorNotes += `${newsSummary.summary} `;
        mentorNotes += newsSummary.overallSentiment === 'bullish' ? 'Positive sentiment provides catalyst support. ' :
                       'Negative sentiment creates headwind - watch for reversal. ';
        mentorNotes += `\n\n`;
      }
      
      mentorNotes += `**Risk Management:**\n`;
      mentorNotes += `Entry: $${riskPlan.entry.toFixed(2)}, Stop: $${riskPlan.stopLoss.toFixed(2)} (${riskPlan.riskPercent.toFixed(1)}% risk). `;
      mentorNotes += `R:R: ${riskPlan.riskReward.target1.toFixed(1)}:1. `;
      if (countertrend) {
        mentorNotes += `⚠️ Countertrend setup requires tight stops and confirmation. `;
      }
      mentorNotes += `Position sizing: ${riskPlan.positionSize} (risk: ${riskPlan.riskAmount}).`;
      
      // Build reasoning array
      const reasoning = [
        `Technical: ${compositePattern.candlestickPattern.name} + ${patternStr}`,
        `Trend: ${trendDesc} (${indicators.strength} strength)`,
        `Momentum: RSI ${indicators.rsi.toFixed(1)}, MACD ${indicators.macd.histogram > 0 ? 'positive' : 'negative'}`,
        `Volume: Z-score ${indicators.volumeZScore.toFixed(2)}`,
      ];
      if (squeezeAnalysis && squeezeAnalysis.combined.potential !== 'none') {
        reasoning.push(`Squeeze: ${squeezeAnalysis.combined.potential} potential (${squeezeAnalysis.combined.score}/100)`);
      }
      if (fundamentalsData) {
        reasoning.push(`Fundamentals: ${fundamentalsData.viability.valuation}, ${fundamentalsData.quality.grade} quality (Q:${fundamentalsData.qualityScore} V:${fundamentalsData.viabilityScore} R:${fundamentalsData.riskScore})`);
      }
      if (newsSummary) {
        reasoning.push(`Sentiment: ${newsSummary.overallSentiment} (${newsSummary.sentimentScore > 0 ? '+' : ''}${newsSummary.sentimentScore.toFixed(0)})`);
      }
      
      // Build strengths
      const strengths = [];
      if (mainScore >= 70) strengths.push('High quality technical setup');
      if (compositePattern.fusionBonus > 10) strengths.push('Strong pattern alignment');
      if (indicators.volumeZScore > 1) strengths.push('Above-average volume confirmation');
      if (squeezeAnalysis && squeezeAnalysis.combined.score >= 50) strengths.push(`${squeezeAnalysis.combined.potential} squeeze dynamics`);
      if (fundamentalsData && fundamentalsData.viability.valuation === 'undervalued') strengths.push('Undervalued fundamentals provide downside support');
      if (fundamentalsData && fundamentalsData.quality.grade === 'excellent') strengths.push('Excellent fundamental quality');
      if (fundamentalsData && fundamentalsData.qualityScore >= 70) strengths.push(`Strong fundamentals (Quality: ${fundamentalsData.qualityScore}/100)`);
      if (newsSummary && newsSummary.overallSentiment === (executionDirection === 'bullish' ? 'bullish' : 'bearish')) strengths.push('News sentiment aligned with trade direction');
      if (strengths.length === 0) strengths.push('Setup meets minimum criteria');
      
      // Build warnings
      const warnings = [];
      if (countertrend) warnings.push('Countertrend trade - higher risk, requires confirmation');
      if (indicators.rsi > 70) warnings.push('RSI overbought - potential pullback risk');
      if (indicators.rsi < 30) warnings.push('RSI oversold - potential bounce risk');
      if (fundamentalsData && fundamentalsData.viability.valuation === 'overvalued') warnings.push('Overvalued fundamentals suggest elevated risk');
      if (fundamentalsData && fundamentalsData.riskScore >= 70) warnings.push(`High fundamental risk (Risk: ${fundamentalsData.riskScore}/100)`);
      if (fundamentalsData && fundamentalsData.risk.earningsRisk) warnings.push(`Earnings in ${fundamentalsData.risk.daysToEarnings} days - elevated event risk`);
      if (newsSummary && newsSummary.overallSentiment !== 'neutral' && newsSummary.overallSentiment !== (executionDirection === 'bullish' ? 'bullish' : 'bearish')) {
        warnings.push('News sentiment conflicts with trade direction');
      }
      if (mainScore < 60) warnings.push('Lower quality setup - consider waiting for better opportunity');
      if (warnings.length === 0) warnings.push('Monitor for confirmation before entry');
      
      aiAnalysis = {
        narrative,
        mentorNotes,
        reasoning,
        warnings,
        strengths
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
          discarded: patternsV2.discarded ? {
            name: patternsV2.discarded.name,
            type: patternsV2.discarded.type as string,
            direction: patternsV2.discarded.direction as string,
            confidence: patternsV2.discarded.confidence,
            confidenceLabel: patternsV2.discarded.confidenceLabel,
            breakoutStatus: patternsV2.discarded.breakoutStatus as string,
            priceTarget: (patternsV2.discarded.priceTarget === null ? undefined : patternsV2.discarded.priceTarget) as number | undefined,
            keyLevels: patternsV2.discarded.keyLevels,
            volumeZScore: patternsV2.discarded.volumeZScore,
            reasons: patternsV2.discarded.reasons,
            metadata: patternsV2.discarded.metadata
          } : undefined,
          compositeReasons: patternsV2.composite.reasons,
          chartPatternReasons: patternsV2.institutional?.reasons || patternsV2.candidate?.metCriteria,
          candlestickFacts: patternsV2.candlestickPattern.facts,
          chartPatternMetadata: patternsV2.institutional?.metadata || patternsV2.candidate?.metadata
        }
      } : {}),
      
      score: {
        overall: mainScore, // Use composite score for institutional, overall for others
        rating: mainRating,
        recommendation: mainRecommendation,
        breakdown: {
          technical: score.technical,
          momentum: score.momentum,
          trend: score.trend,
          pattern: score.pattern,
          volume: score.volume
        },
        ratingAdjustment: ratingAdjustmentDetails
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
      
      execution: executionPlan,
      
      // Execution Metadata
      executionDirection,
      patternSource,
      hasConflict,
      
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
      
      squeezeAnalysis,
      
      fundamentals: fundamentalsData,
      
      news: newsArticles,
      
      newsSummary,
      
      optionsInsight,
      
      marketData: {
        marketCap: marketData.marketCap,
        exchange: marketData.exchange,
        lastBarDate: marketData.lastBarDate.toISOString(),
        dataAgeDays: marketData.dataAgeDays
      },
      
      timestamp: new Date().toISOString()
    };

    console.log(`[Analyze] Analysis complete for ${symbol}`);

    // 9. Run QA validation
    const qaReport = report as unknown as AnalysisReportForQA;
    const qaResult = validateReport(qaReport);
    
    console.log(`[QA] Validation Score: ${qaResult.score}/100 - ${qaResult.passed ? 'PASSED' : 'FAILED'}`);
    if (qaResult.issues.length > 0) {
      console.log(`[QA] Issues found: ${qaResult.issues.length}`);
      qaResult.issues.forEach(issue => {
        console.log(`  - [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.message}`);
      });
    }
    if (qaResult.warnings.length > 0) {
      console.log(`[QA] Warnings: ${qaResult.warnings.length}`);
      qaResult.warnings.forEach(warning => {
        console.log(`  - ${warning.category}: ${warning.message}`);
      });
    }
    
    // Log full QA report in development
    if (process.env.NODE_ENV === 'development') {
      console.log(formatQAReport(qaResult));
    }

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
