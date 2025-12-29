/**
 * Pre-built Strategy Templates
 * 
 * Common trading strategies that users can start with and customize
 */

import type { StrategyDsl } from './dsl-schema';

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  dsl: StrategyDsl;
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // NEW: US SWING – EARLY-STAGE BULLISH TREND (5–15 DAYS)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'us-swing-early-bullish',
    name: 'US Swing – Early-Stage Bullish Trend (5–15 days)',
    description: `Targets stocks already above 20/50 EMA with rising ADX (20-30 range).
Prefers RSI 55–65 to avoid late overbought blow-offs.
Requires confirming volume/flow and controlled ATR% (2-8%).
Designed for directional long swings, NOT for mean-reversion shorts or late-stage chasing.`,
    difficulty: 'intermediate',
    dsl: {
      name: 'US Swing – Early-Stage Bullish Trend',
      description: `Early-stage uptrend scanner for 5-15 day swing trades.
KEY PRINCIPLES:
• Capture trends that are established but not yet mature or parabolic
• Avoid extended/vertical moves (price not >10% above EMA20)
• Momentum must confirm trend but avoid exhaustion
• Volume should confirm buying interest, not chase blow-offs`,
      direction: 'long',
      timeframe: '1day',
      eligibility: {
        // EMA Structure: Price > EMA20 > EMA50
        emaRules: [
          { ema1: 9, operator: '>', ema2: 20, description: 'Price above EMA20' },
          { ema1: 20, operator: '>', ema2: 50, description: 'EMA20 above EMA50 (uptrend)' },
        ],
        
        // RSI: 55-65 (bullish but not overbought)
        // DO NOT use RSI > 70 - explicitly avoiding overbought signals
        rsiRange: {
          period: 14,
          min: 55,
          max: 65,
        },
        
        // ATR: 2-8% (tradable volatility)
        atrRange: {
          period: 14,
          minPct: 2,
          maxPct: 8,
        },
        
        // Volume: ≥1.5× average (confirmation)
        volumeRules: [
          {
            type: 'relative',
            threshold: 1.5,
            operator: '>=',
            description: 'Volume ≥ 1.5× 20-day average',
          },
        ],
        
        // Custom conditions for advanced filtering
        custom: [
          'ADX >= 20 AND ADX <= 30',
          '+DI > -DI',
          'EMA20_DISTANCE >= 0% AND EMA20_DISTANCE <= 10%',
          'MACD > 0 OR MACD_CROSSED_SIGNAL_WITHIN_5_BARS',
          'CMF > -0.1',
          'OBV > OBV_MA20 (uptrend)',
        ],
      },
      trigger: {
        type: 'pullback',
        level: 'ema20',
        description: 'Enter on pullback toward EMA20 or prior breakout level',
      },
      stop: {
        type: 'swing',
        value: 'low-1.35*ATR',
        description: 'Below last swing low, or ~1.2-1.5× ATR below entry zone',
      },
      targets: [
        {
          level: 'entry+1.25*ATR',
          label: 'T1 (5-10 day)',
          rr: 1.0,
        },
        {
          level: 'entry+2*ATR',
          label: 'T2 (Extended - only if ADX > 25)',
          rr: 1.5,
        },
      ],
      riskManagement: {
        minRR: 1.0,
        maxPositionSize: 2,
        earningsDaysBuffer: 3,
      },
    },
  },
  
  {
    id: 'breakout-retest',
    name: 'Breakout & Retest of Key Resistance',
    description: 'Wait for a breakout above resistance, then enter on the retest when price bounces off the old resistance (now support). Classic low-risk entry after momentum shift.',
    difficulty: 'beginner',
    dsl: {
      name: 'Breakout & Retest',
      description: 'Enter after a breakout retests the broken resistance level as new support',
      direction: 'long',
      timeframe: '1day',
      eligibility: {
        emaRules: [
          { ema1: 20, operator: '>', ema2: 50, description: 'Uptrend: EMA20 above EMA50' },
        ],
        volumeRules: [
          { type: 'z-score', threshold: 1.5, operator: '>=', description: 'Strong volume on breakout' },
        ],
        priceDistances: [
          { fromLevel: 'primary_resistance', maxDistance: 1, unit: 'atr', description: 'Price retesting the breakout level' },
        ],
        candlePatterns: [
          { name: 'any_bullish', description: 'Bullish candle on the bounce' },
        ],
      },
      trigger: {
        type: 'pullback',
        level: 'primary_resistance',
        description: 'Price pulls back to test the broken resistance (now support) and bounces',
      },
      stop: {
        type: 'atr',
        value: 'entry-1.5*ATR',
        description: '1.5 ATR below the retest entry to allow for normal volatility',
      },
      targets: [
        { level: 'entry+2*ATR', label: 'T1', rr: 2 },
        { level: 'entry+4*ATR', label: 'T2', rr: 4 },
      ],
      riskManagement: {
        minRR: 1.5,
        maxPositionSize: 2,
        earningsDaysBuffer: 3,
      },
    },
  },
  {
    id: 'ema-pullback',
    name: 'EMA Pullback in Strong Trend',
    description: 'Buy when price pulls back to a key moving average (like EMA50) in a strong uptrend. Classic trend-following strategy with high win rate.',
    difficulty: 'beginner',
    dsl: {
      name: 'EMA50 Pullback',
      description: 'Enter when price pulls back to EMA50 support in an uptrend',
      direction: 'long',
      timeframe: '1day',
      eligibility: {
        emaRules: [
          { ema1: 20, operator: '>', ema2: 50, description: 'EMA20 above EMA50' },
          { ema1: 50, operator: '>', ema2: 200, description: 'EMA50 above EMA200' },
        ],
        rsiRange: { period: 14, min: 40, max: 70 },
        priceDistances: [
          { fromLevel: 'ema50', maxDistance: 1.5, unit: 'atr', description: 'Within 1.5 ATR of EMA50' },
        ],
        candlePatterns: [
          { name: 'bullish_engulfing' },
        ],
        multiBarConditions: [
          { count: 2, direction: 'any', checkLows: true, checkHighs: false, description: '2 bars staying above EMA50' },
        ],
      },
      trigger: {
        type: 'pullback',
        level: 'ema50',
        description: 'Price pulls back to EMA50 and bounces',
      },
      stop: {
        type: 'atr',
        value: 'entry-1.5*ATR',
        description: '1.5 ATR below entry',
      },
      targets: [
        { level: 'entry+1.5*ATR', label: 'T1', rr: 1.5 },
        { level: 'entry+3*ATR', label: 'T2', rr: 3 },
      ],
      riskManagement: {
        minRR: 1.5,
        maxPositionSize: 2,
        earningsDaysBuffer: 3,
      },
    },
  },
  {
    id: 'double-bottom-breakout',
    name: 'Double Bottom Breakout',
    description: 'Enter when price breaks above the neckline of a double bottom pattern. Strong reversal signal with clear risk/reward.',
    difficulty: 'intermediate',
    dsl: {
      name: 'Double Bottom Breakout',
      description: 'Enter on breakout above double bottom neckline',
      direction: 'long',
      timeframe: '1day',
      eligibility: {
        chartPatterns: [
          { type: 'double_bottom', direction: 'bullish', status: 'institutional', lookbackBars: 50 },
        ],
        volumeRules: [
          { type: 'z-score', threshold: 1, operator: '>=', description: 'Volume confirmation' },
        ],
        candlePatterns: [
          { name: 'any_bullish' },
        ],
      },
      trigger: {
        type: 'breakout',
        level: 'double_bottom_neckline',
        description: 'Price breaks above the neckline with volume',
      },
      stop: {
        type: 'fixed',
        value: 'double_bottom_support',
        description: 'Stop at the double bottom support level',
      },
      targets: [
        { level: 'double_bottom_target', label: 'T1', rr: 2 },
      ],
      riskManagement: {
        minRR: 1.5,
        maxPositionSize: 2,
        earningsDaysBuffer: 3,
      },
    },
  },
  {
    id: 'rsi-oversold-bounce',
    name: 'RSI Oversold Bounce',
    description: 'Enter when RSI bounces from oversold territory (below 30) back above 40, indicating momentum shift. Works best in uptrends.',
    difficulty: 'beginner',
    dsl: {
      name: 'RSI Oversold Bounce',
      description: 'Buy when RSI recovers from oversold levels',
      direction: 'long',
      timeframe: '1day',
      eligibility: {
        emaRules: [
          { ema1: 50, operator: '>', ema2: 200, description: 'Long-term uptrend' },
        ],
        rsiRange: { period: 14, min: 40, max: 60 },
        priceDistances: [
          { fromLevel: 'ema50', maxDistance: 2, unit: 'atr', description: 'Not too far from support' },
        ],
      },
      trigger: {
        type: 'reversal',
        level: 'ema50',
        description: 'RSI crosses above 40 after being oversold',
      },
      stop: {
        type: 'swing',
        value: 'low-0.5*ATR',
        description: 'Below recent swing low',
      },
      targets: [
        { level: 'entry+2*ATR', label: 'T1', rr: 2 },
        { level: 'entry+3.5*ATR', label: 'T2', rr: 3.5 },
      ],
      riskManagement: {
        minRR: 1.5,
        maxPositionSize: 2,
        earningsDaysBuffer: 3,
      },
    },
  },
  {
    id: 'flag-continuation',
    name: 'Bull Flag Continuation',
    description: 'Enter when price breaks out of a bull flag pattern in a strong uptrend. High probability trend continuation setup.',
    difficulty: 'intermediate',
    dsl: {
      name: 'Bull Flag Breakout',
      description: 'Enter on breakout from bull flag consolidation',
      direction: 'long',
      timeframe: '1day',
      eligibility: {
        emaRules: [
          { ema1: 20, operator: '>', ema2: 50, description: 'Strong uptrend' },
        ],
        chartPatterns: [
          { type: 'flag', direction: 'bullish', status: 'any', lookbackBars: 50 },
        ],
        volumeRules: [
          { type: 'z-score', threshold: 1.5, operator: '>=', description: 'Volume expansion on breakout' },
        ],
      },
      trigger: {
        type: 'breakout',
        level: 'bullish_flag_resistance',
        description: 'Price breaks above flag resistance',
      },
      stop: {
        type: 'fixed',
        value: 'bullish_flag_support',
        description: 'Stop below flag support',
      },
      targets: [
        { level: 'entry+2*ATR', label: 'T1', rr: 2 },
        { level: 'bullish_flag_target', label: 'T2' },
      ],
      riskManagement: {
        minRR: 1.5,
        maxPositionSize: 2,
        earningsDaysBuffer: 3,
      },
    },
  },
  {
    id: 'squeeze-momentum',
    name: 'TTM Squeeze Breakout',
    description: 'Enter when the TTM Squeeze fires (volatility expansion) after a period of consolidation. High momentum setup.',
    difficulty: 'advanced',
    dsl: {
      name: 'Squeeze Momentum',
      description: 'Enter on TTM Squeeze fire with momentum',
      direction: 'long',
      timeframe: '1day',
      eligibility: {
        emaRules: [
          { ema1: 20, operator: '>', ema2: 50, description: 'Price above key EMAs' },
        ],
        squeezeDynamics: {
          shortVolumeTrend: 'any',
          ttmSqueezeState: 'FIRE',
          minSqueezeDuration: 5,
          requireBothSqueezes: false,
          ttmFireConfirmation: {
            required: true,
            momentumDirection: 'bullish',
            minHistogram: 0,
          },
          description: 'Squeeze fired with bullish momentum',
        },
      },
      trigger: {
        type: 'breakout',
        level: 'high',
        description: 'Squeeze fires and price breaks out',
      },
      stop: {
        type: 'atr',
        value: 'entry-2*ATR',
        description: '2 ATR stop for volatility expansion',
      },
      targets: [
        { level: 'entry+3*ATR', label: 'T1', rr: 1.5 },
        { level: 'entry+5*ATR', label: 'T2', rr: 2.5 },
      ],
      riskManagement: {
        minRR: 1.5,
        maxPositionSize: 1.5,
        earningsDaysBuffer: 3,
      },
    },
  },
];

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): StrategyTemplate | undefined {
  return STRATEGY_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by difficulty level
 */
export function getTemplatesByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): StrategyTemplate[] {
  return STRATEGY_TEMPLATES.filter(t => t.difficulty === difficulty);
}

