/**
 * Map Chart Pattern Detection Results to Strategy Contexts
 * 
 * Converts TwoTierPatternResult[] from detectAllChartPatterns() into
 * strategy-specific contexts for eligibility gates and quality modifiers
 */

import { TwoTierPatternResult, InstitutionalPattern, CandidatePattern } from './pattern-utils';

export interface StrategyPatternContext {
  // Pattern identification
  name: string;
  status: 'institutional' | 'candidate' | 'none';
  
  // Key levels for strategy evaluation
  resistance?: number;
  support?: number;
  breakout?: number;
  
  // Pattern characteristics
  direction: 'bullish' | 'bearish' | 'neutral';
  type: 'reversal' | 'continuation';
  confidence: number;
  
  // Quality modifier for non-structure strategies
  qualityModifier: number; // -0.10 to +0.10
}

export interface AllPatternContexts {
  triangle: StrategyPatternContext | null;
  flag: StrategyPatternContext | null;
  doubleTop: StrategyPatternContext | null;
  doubleBottom: StrategyPatternContext | null;
}

/**
 * Map pattern detection results to strategy contexts
 */
export function mapPatternsToStrategyContexts(
  patternResults: TwoTierPatternResult[]
): AllPatternContexts {
  const contexts: AllPatternContexts = {
    triangle: null,
    flag: null,
    doubleTop: null,
    doubleBottom: null,
  };

  for (const result of patternResults) {
    // Prefer institutional over candidate
    const pattern = result.institutional || result.candidate;
    if (!pattern) continue;

    const status = result.institutional ? 'institutional' : 'candidate';
    
    switch (pattern.name.toLowerCase()) {
      case 'ascending triangle':
      case 'descending triangle':
        contexts.triangle = createStrategyContext(pattern, status);
        break;
        
      case 'bullish flag':
      case 'bearish flag':
        contexts.flag = createStrategyContext(pattern, status);
        break;
        
      case 'double top':
        contexts.doubleTop = createStrategyContext(pattern, status);
        break;
        
      case 'double bottom':
        contexts.doubleBottom = createStrategyContext(pattern, status);
        break;
    }
  }

  return contexts;
}

/**
 * Create strategy context from pattern
 */
function createStrategyContext(
  pattern: InstitutionalPattern | CandidatePattern,
  status: 'institutional' | 'candidate'
): StrategyPatternContext {
  // Extract key levels from pattern metadata
  const resistance = extractLevel(pattern, 'resistance');
  const support = extractLevel(pattern, 'support');
  const breakout = extractLevel(pattern, 'breakout');

  // Calculate quality modifier based on pattern characteristics
  const qualityModifier = calculateQualityModifier(pattern, status);

  return {
    name: pattern.name,
    status,
    resistance,
    support,
    breakout,
    direction: pattern.direction,
    type: pattern.type,
    confidence: pattern.confidence,
    qualityModifier,
  };
}

/**
 * Extract level from pattern metadata
 */
function extractLevel(pattern: InstitutionalPattern | CandidatePattern, levelType: string): number | undefined {
  // Pattern metadata structure varies by pattern type
  // This is a simplified extraction - in practice, you'd need to
  // examine the actual pattern metadata structure
  const metadata = (pattern as any).metadata;
  if (!metadata) return undefined;

  switch (levelType) {
    case 'resistance':
      return metadata.resistance || metadata.upperBound || metadata.peak;
    case 'support':
      return metadata.support || metadata.lowerBound || metadata.trough;
    case 'breakout':
      return metadata.breakout || metadata.trigger;
    default:
      return undefined;
  }
}

/**
 * Calculate quality modifier for non-structure strategies
 */
function calculateQualityModifier(
  pattern: InstitutionalPattern | CandidatePattern,
  status: 'institutional' | 'candidate'
): number {
  let modifier = 0;

  // Base modifier by status
  if (status === 'institutional') {
    modifier += 0.05; // Institutional patterns get positive modifier
  } else {
    modifier += 0.02; // Candidate patterns get small positive modifier
  }

  // Direction-based modifiers
  if (pattern.direction === 'bullish') {
    modifier += 0.03; // Bullish patterns favor long strategies
  } else if (pattern.direction === 'bearish') {
    modifier -= 0.03; // Bearish patterns favor short strategies
  }

  // Confidence-based scaling
  const confidenceFactor = pattern.confidence / 100;
  modifier *= confidenceFactor;

  // Cap the modifier
  return Math.max(-0.10, Math.min(0.10, modifier));
}

/**
 * Check if pattern context provides eligibility for structure-based strategy
 */
export function isEligibleForStructureStrategy(
  context: StrategyPatternContext | null,
  requiredDirection: 'bullish' | 'bearish'
): boolean {
  if (!context) return false;
  if (context.status !== 'institutional') return false;
  if (context.direction !== requiredDirection) return false;
  
  return true;
}

/**
 * Get quality modifier for non-structure strategy
 */
export function getQualityModifierForStrategy(
  contexts: AllPatternContexts,
  strategyDirection: 'bullish' | 'bearish'
): number {
  let totalModifier = 0;
  let applicablePatterns = 0;

  // Check all pattern contexts
  const allContexts = [contexts.triangle, contexts.flag, contexts.doubleTop, contexts.doubleBottom];
  
  for (const context of allContexts) {
    if (!context) continue;
    
    // Only apply modifiers from patterns that align with strategy direction
    if (context.direction === strategyDirection || context.direction === 'neutral') {
      totalModifier += context.qualityModifier;
      applicablePatterns++;
    } else {
      // Conflicting patterns get penalty
      totalModifier -= Math.abs(context.qualityModifier) * 0.5;
      applicablePatterns++;
    }
  }

  // Average the modifiers if multiple patterns exist
  if (applicablePatterns > 0) {
    totalModifier = totalModifier / applicablePatterns;
  }

  // Cap the final modifier
  return Math.max(-0.10, Math.min(0.10, totalModifier));
}
