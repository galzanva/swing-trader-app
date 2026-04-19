import type { FinnhubComprehensiveFundamentals } from "@/lib/data-vendors/finnhub";

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
  
  // Note: Options data removed - not useful for swing trading analysis
  
  // Additional info
  marketData: {
    marketCap?: number;
    exchange?: string;
    lastBarDate: string;
    dataAgeDays: number;
  };
  
  timestamp: string;
}
