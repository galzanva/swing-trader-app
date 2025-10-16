/**
 * Strategy DSL Schema with Zod Validation
 * 
 * Defines the type-safe structure for user-defined strategies
 */

import { z } from 'zod';

// Expression for dynamic levels (e.g., "ema20-0.5*ATR", "entry+1.5*ATR", "low-0.5*ATR")
export const ExpressionSchema = z.string().regex(
  /^[\d.]+$|^[a-z_][\w\d+\-*/.()]*$/i,
  'Invalid expression format'
);

// Direction
export const DirectionSchema = z.enum(['long', 'short']);

// Timeframe
export const TimeframeSchema = z.enum(['1min', '5min', '15min', '1hour', '1day']);

// EMA Rule
export const EmaRuleSchema = z.object({
  ema1: z.number().min(1).max(200),
  operator: z.enum(['>', '<', '>=', '<=', '==']),
  ema2: z.number().min(1).max(200),
  description: z.string().optional(),
});

// RSI Range
export const RsiRangeSchema = z.object({
  period: z.number().default(14),
  min: z.number().min(0).max(100),
  max: z.number().min(0).max(100),
}).refine(data => data.min < data.max, {
  message: 'RSI min must be less than max',
});

// ATR Range
export const AtrRangeSchema = z.object({
  period: z.number().default(14),
  minPct: z.number().min(0).max(100),
  maxPct: z.number().min(0).max(100),
}).refine(data => data.minPct < data.maxPct, {
  message: 'ATR min must be less than max',
});

// Volume Rule
export const VolumeRuleSchema = z.object({
  type: z.enum(['z-score', 'relative', 'absolute']),
  threshold: z.number(),
  operator: z.enum(['>=', '>', '<=', '<']),
  description: z.string().optional(),
});

// Price Distance Rule
export const PriceDistanceSchema = z.object({
  fromLevel: ExpressionSchema,
  maxDistance: z.number(), // as % or ATR multiplier
  unit: z.enum(['pct', 'atr']),
  description: z.string().optional(),
});

// Candle Pattern
export const CandlePatternSchema = z.object({
  name: z.enum([
    'bullish_engulfing',
    'bearish_engulfing',
    'hammer',
    'shooting_star',
    'doji',
    'consecutive_closes',
    'any_bullish',
    'any_bearish',
  ]),
  params: z.record(z.any()).optional(),
  description: z.string().optional(),
});

// Chart Pattern
export const ChartPatternSchema = z.object({
  type: z.enum([
    'triangle',
    'flag',
    'double_top',
    'double_bottom',
    'head_shoulders',
    'wedge',
  ]),
  direction: z.enum(['bullish', 'bearish', 'any']),
  status: z.enum(['institutional', 'candidate', 'any']).default('any'),
  lookbackBars: z.number().min(10).max(100).default(50),
  description: z.string().optional(),
});

// Multi-Bar Condition (e.g., "2+ red candles staying above EMA50")
export const MultiBarConditionSchema = z.object({
  count: z.number().min(1).max(10),
  direction: z.enum(['up', 'down', 'any']).default('any'),
  minLevel: ExpressionSchema.optional(), // e.g., "ema50" - bars must stay above this
  maxLevel: ExpressionSchema.optional(), // e.g., "ema20" - bars must stay below this
  checkLows: z.boolean().default(true), // For minLevel: check bar.low or bar.close?
  checkHighs: z.boolean().default(true), // For maxLevel: check bar.high or bar.close?
  description: z.string().optional(),
});

// Trigger Condition
export const TriggerSchema = z.object({
  type: z.enum(['breakout', 'pullback', 'reversal', 'continuation', 'custom']),
  level: ExpressionSchema,
  description: z.string(),
});

// Stop Loss
export const StopLossSchema = z.object({
  type: z.enum(['fixed', 'atr', 'swing', 'ema']),
  value: ExpressionSchema, // e.g., "entry-1*ATR" or "45.50"
  description: z.string().optional(),
});

// Target
export const TargetSchema = z.object({
  level: ExpressionSchema, // e.g., "entry+1.5*ATR" or "ema20"
  rr: z.number().optional(), // calculated if not provided
  label: z.string().optional(),
});

// Multi-bar Confirmation
export const ConfirmationSchema = z.object({
  barsRequired: z.number().min(1).max(10).default(1),
  conditions: z.array(z.string()).min(1),
  allRequired: z.boolean().default(true),
});

// Full Strategy DSL
export const StrategyDslSchema = z.object({
  // Metadata
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  
  // Core Setup
  direction: DirectionSchema,
  timeframe: TimeframeSchema.default('1day'),
  
  // Eligibility Criteria
  eligibility: z.object({
    emaRules: z.array(EmaRuleSchema).optional(),
    rsiRange: RsiRangeSchema.optional(),
    atrRange: AtrRangeSchema.optional(),
    volumeRule: VolumeRuleSchema.optional(),
    priceDistance: PriceDistanceSchema.optional(),
    candlePattern: CandlePatternSchema.optional(),
    chartPattern: ChartPatternSchema.optional(),
    multiBarCondition: MultiBarConditionSchema.optional(),
    custom: z.array(z.string()).optional(), // Custom boolean expressions
  }),
  
  // Entry & Exit
  trigger: TriggerSchema,
  stop: StopLossSchema,
  targets: z.array(TargetSchema).min(1).max(3),
  
  // Confirmation
  confirmation: ConfirmationSchema.optional(),
  
  // Risk Management
  riskManagement: z.object({
    minRR: z.number().min(1).default(1.5),
    maxPositionSize: z.number().min(0).max(100).default(2),
    earningsDaysBuffer: z.number().min(0).max(7).default(3),
  }).optional(),
  
  // Quality Scoring (optional overrides)
  qualityWeights: z.object({
    baseQuality: z.number().min(0).max(1).default(0.65),
    emaAlignment: z.number().min(0).max(1).default(0.1),
    rsiMomentum: z.number().min(0).max(1).default(0.1),
    volumeConfirmation: z.number().min(0).max(1).default(0.05),
    patternStrength: z.number().min(0).max(1).default(0.1),
  }).optional(),
}).strict(); // Reject unknown fields

// Infer TypeScript types from Zod schema
export type StrategyDsl = z.infer<typeof StrategyDslSchema>;
export type EmaRule = z.infer<typeof EmaRuleSchema>;
export type RsiRange = z.infer<typeof RsiRangeSchema>;
export type AtrRange = z.infer<typeof AtrRangeSchema>;
export type VolumeRule = z.infer<typeof VolumeRuleSchema>;
export type PriceDistance = z.infer<typeof PriceDistanceSchema>;
export type CandlePattern = z.infer<typeof CandlePatternSchema>;
export type ChartPattern = z.infer<typeof ChartPatternSchema>;
export type MultiBarCondition = z.infer<typeof MultiBarConditionSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type StopLoss = z.infer<typeof StopLossSchema>;
export type Target = z.infer<typeof TargetSchema>;
export type Confirmation = z.infer<typeof ConfirmationSchema>;

// Helper to create default strategy template
export function createDefaultStrategyDsl(partial: Partial<StrategyDsl>): StrategyDsl {
  return StrategyDslSchema.parse({
    name: partial.name || 'My Strategy',
    description: partial.description || '',
    direction: partial.direction || 'long',
    timeframe: partial.timeframe || '1day',
    eligibility: partial.eligibility || {},
    trigger: partial.trigger || {
      type: 'breakout',
      level: 'ema20',
      description: 'Price crosses above EMA20',
    },
    stop: partial.stop || {
      type: 'atr',
      value: 'entry-1*ATR',
      description: '1 ATR below entry',
    },
    targets: partial.targets || [
      { level: 'entry+1.5*ATR', label: 'T1' },
      { level: 'entry+2.5*ATR', label: 'T2' },
    ],
    confirmation: partial.confirmation,
    riskManagement: partial.riskManagement,
    qualityWeights: partial.qualityWeights,
  });
}

// Validation helper
export function validateStrategyDsl(data: unknown): { 
  success: boolean; 
  data?: StrategyDsl; 
  errors?: string[];
} {
  const result = StrategyDslSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const errors = result.error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    );
    return { success: false, errors };
  }
}
