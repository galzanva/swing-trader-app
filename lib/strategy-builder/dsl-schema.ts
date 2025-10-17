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
  
  // Eligibility Criteria - Enhanced to support multiple complex conditions
  eligibility: z.object({
    // Multiple EMA rules can be combined (e.g., EMA20 > EMA50 AND EMA50 > EMA200)
    emaRules: z.array(EmaRuleSchema).optional(),
    
    // Single RSI range constraint
    rsiRange: RsiRangeSchema.optional(),
    
    // Single ATR range constraint
    atrRange: AtrRangeSchema.optional(),
    
    // Multiple volume rules for complex volume analysis
    volumeRules: z.array(VolumeRuleSchema).optional(),
    
    // Legacy single volume rule (for backward compatibility)
    volumeRule: VolumeRuleSchema.optional(),
    
    // Multiple price distance rules (e.g., within 1.5 ATR of EMA50 AND within 2% of support)
    priceDistances: z.array(PriceDistanceSchema).optional(),
    
    // Legacy single price distance (for backward compatibility)
    priceDistance: PriceDistanceSchema.optional(),
    
    // Multiple candle patterns can be required (e.g., bullish engulfing AND volume spike)
    candlePatterns: z.array(CandlePatternSchema).optional(),
    
    // Legacy single candle pattern (for backward compatibility)
    candlePattern: CandlePatternSchema.optional(),
    
    // Multiple chart patterns
    chartPatterns: z.array(ChartPatternSchema).optional(),
    
    // Legacy single chart pattern (for backward compatibility)
    chartPattern: ChartPatternSchema.optional(),
    
    // Multiple multi-bar conditions (e.g., 2 bars above EMA50 AND 3 bars of increasing volume)
    multiBarConditions: z.array(MultiBarConditionSchema).optional(),
    
    // Legacy single multi-bar condition (for backward compatibility)
    multiBarCondition: MultiBarConditionSchema.optional(),
    
    // Custom boolean expressions for advanced users
    custom: z.array(z.string()).optional(),
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

// Validation helper with detailed error reporting
export function validateStrategyDsl(data: unknown): { 
  success: boolean; 
  data?: StrategyDsl; 
  errors?: string[];
  warnings?: string[];
} {
  const result = StrategyDslSchema.safeParse(data);
  
  if (result.success) {
    const warnings: string[] = [];
    const dsl = result.data;
    
    // Check for core requirements
    if (!dsl.direction) {
      warnings.push('Direction (long/short) is required');
    }
    if (!dsl.trigger) {
      warnings.push('Entry trigger condition is required');
    }
    if (!dsl.stop) {
      warnings.push('Stop loss definition is required');
    }
    if (!dsl.targets || dsl.targets.length === 0) {
      warnings.push('At least one profit target is required');
    }
    
    // Check for conflicting rules
    const eligibility = dsl.eligibility;
    if (eligibility) {
      // Check RSI range validity
      if (eligibility.rsiRange && eligibility.rsiRange.min >= eligibility.rsiRange.max) {
        warnings.push('RSI min must be less than max');
      }
      
      // Check ATR range validity
      if (eligibility.atrRange && eligibility.atrRange.minPct >= eligibility.atrRange.maxPct) {
        warnings.push('ATR min must be less than max');
      }
      
      // Warn if no eligibility criteria defined
      const hasAnyCriteria = 
        (eligibility.emaRules && eligibility.emaRules.length > 0) ||
        eligibility.rsiRange ||
        eligibility.atrRange ||
        eligibility.volumeRule ||
        (eligibility.volumeRules && eligibility.volumeRules.length > 0) ||
        eligibility.priceDistance ||
        (eligibility.priceDistances && eligibility.priceDistances.length > 0) ||
        eligibility.candlePattern ||
        (eligibility.candlePatterns && eligibility.candlePatterns.length > 0) ||
        eligibility.chartPattern ||
        (eligibility.chartPatterns && eligibility.chartPatterns.length > 0) ||
        eligibility.multiBarCondition ||
        (eligibility.multiBarConditions && eligibility.multiBarConditions.length > 0);
        
      if (!hasAnyCriteria) {
        warnings.push('No eligibility criteria defined - strategy will match all stocks');
      }
    }
    
    return { 
      success: true, 
      data: result.data,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } else {
    const errors = result.error.errors.map(err => {
      const path = err.path.join('.') || 'root';
      return `${path}: ${err.message}`;
    });
    return { success: false, errors };
  }
}

// Normalize legacy single conditions to arrays for consistent processing
export function normalizeStrategyDsl(dsl: StrategyDsl): StrategyDsl {
  const normalized = { ...dsl };
  const eligibility = { ...normalized.eligibility };
  
  // Normalize volume rules
  if (eligibility.volumeRule && !eligibility.volumeRules) {
    eligibility.volumeRules = [eligibility.volumeRule];
  }
  
  // Normalize price distances
  if (eligibility.priceDistance && !eligibility.priceDistances) {
    eligibility.priceDistances = [eligibility.priceDistance];
  }
  
  // Normalize candle patterns
  if (eligibility.candlePattern && !eligibility.candlePatterns) {
    eligibility.candlePatterns = [eligibility.candlePattern];
  }
  
  // Normalize chart patterns
  if (eligibility.chartPattern && !eligibility.chartPatterns) {
    eligibility.chartPatterns = [eligibility.chartPattern];
  }
  
  // Normalize multi-bar conditions
  if (eligibility.multiBarCondition && !eligibility.multiBarConditions) {
    eligibility.multiBarConditions = [eligibility.multiBarCondition];
  }
  
  normalized.eligibility = eligibility;
  return normalized;
}

// Get all eligibility conditions as readable strings
export function getEligibilityDescriptions(dsl: StrategyDsl): string[] {
  const descriptions: string[] = [];
  const eligibility = dsl.eligibility;
  
  if (!eligibility) return descriptions;
  
  // EMA rules
  if (eligibility.emaRules) {
    eligibility.emaRules.forEach(rule => {
      descriptions.push(`EMA${rule.ema1} ${rule.operator} EMA${rule.ema2}${rule.description ? ` (${rule.description})` : ''}`);
    });
  }
  
  // RSI range
  if (eligibility.rsiRange) {
    descriptions.push(`RSI between ${eligibility.rsiRange.min} and ${eligibility.rsiRange.max}`);
  }
  
  // ATR range
  if (eligibility.atrRange) {
    descriptions.push(`ATR between ${eligibility.atrRange.minPct}% and ${eligibility.atrRange.maxPct}%`);
  }
  
  // Volume rules (both legacy and array)
  const volumeRules = eligibility.volumeRules || (eligibility.volumeRule ? [eligibility.volumeRule] : []);
  volumeRules.forEach(rule => {
    descriptions.push(`Volume (${rule.type}) ${rule.operator} ${rule.threshold}${rule.description ? ` - ${rule.description}` : ''}`);
  });
  
  // Price distances (both legacy and array)
  const priceDistances = eligibility.priceDistances || (eligibility.priceDistance ? [eligibility.priceDistance] : []);
  priceDistances.forEach(pd => {
    descriptions.push(`Price within ${pd.maxDistance}${pd.unit === 'atr' ? ' ATR' : '%'} of ${pd.fromLevel}${pd.description ? ` - ${pd.description}` : ''}`);
  });
  
  // Candle patterns (both legacy and array)
  const candlePatterns = eligibility.candlePatterns || (eligibility.candlePattern ? [eligibility.candlePattern] : []);
  candlePatterns.forEach(pattern => {
    descriptions.push(`Candle pattern: ${pattern.name.replace(/_/g, ' ')}${pattern.description ? ` - ${pattern.description}` : ''}`);
  });
  
  // Chart patterns (both legacy and array)
  const chartPatterns = eligibility.chartPatterns || (eligibility.chartPattern ? [eligibility.chartPattern] : []);
  chartPatterns.forEach(pattern => {
    descriptions.push(`Chart pattern: ${pattern.direction} ${pattern.type}${pattern.description ? ` - ${pattern.description}` : ''}`);
  });
  
  // Multi-bar conditions (both legacy and array)
  const multiBarConditions = eligibility.multiBarConditions || (eligibility.multiBarCondition ? [eligibility.multiBarCondition] : []);
  multiBarConditions.forEach(condition => {
    let desc = `${condition.count} bar${condition.count > 1 ? 's' : ''}`;
    if (condition.direction !== 'any') desc += ` ${condition.direction === 'up' ? 'bullish' : 'bearish'}`;
    if (condition.minLevel) desc += ` above ${condition.minLevel}`;
    if (condition.maxLevel) desc += ` below ${condition.maxLevel}`;
    if (condition.description) desc += ` - ${condition.description}`;
    descriptions.push(desc);
  });
  
  // Custom conditions
  if (eligibility.custom && eligibility.custom.length > 0) {
    eligibility.custom.forEach(cond => {
      descriptions.push(`Custom: ${cond}`);
    });
  }
  
  return descriptions;
}
