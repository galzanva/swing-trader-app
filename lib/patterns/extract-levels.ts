/**
 * Pattern Level Extraction
 * 
 * Extracts numeric support/resistance levels from detected chart patterns
 * and makes them available as named variables for expression evaluation
 */

import type { OHLCV } from '../strategies/types';
import { detectAllChartPatterns, type ChartPattern } from './chart-patterns';
import { detectAllChartPatterns as detectAllV2 } from './chart-patterns-v2';

export interface PatternLevels {
  // Double Bottom
  double_bottom_support?: number;
  double_bottom_neckline?: number;
  double_bottom_target?: number;
  
  // Double Top
  double_top_resistance?: number;
  double_top_neckline?: number;
  double_top_target?: number;
  
  // Ascending Triangle
  ascending_triangle_resistance?: number;
  ascending_triangle_support?: number;
  ascending_triangle_target?: number;
  
  // Descending Triangle
  descending_triangle_resistance?: number;
  descending_triangle_support?: number;
  descending_triangle_target?: number;
  
  // Bullish Flag
  bullish_flag_support?: number;
  bullish_flag_resistance?: number;
  bullish_flag_target?: number;
  
  // Bearish Flag
  bearish_flag_support?: number;
  bearish_flag_resistance?: number;
  bearish_flag_target?: number;
  
  // Head and Shoulders
  head_shoulders_neckline?: number;
  head_shoulders_left_shoulder?: number;
  head_shoulders_head?: number;
  head_shoulders_right_shoulder?: number;
  head_shoulders_target?: number;
  
  // Inverse Head and Shoulders
  inv_head_shoulders_neckline?: number;
  inv_head_shoulders_target?: number;
  
  // Generic levels (from highest confidence pattern)
  primary_support?: number;
  primary_resistance?: number;
  breakout_level?: number;
  pattern_target?: number;
}

/**
 * Extract price levels from all detected patterns
 */
export function extractPatternLevels(bars: OHLCV[], atr: number): PatternLevels {
  const levels: PatternLevels = {};
  
  // Detect patterns using V1 (legacy) detector
  const patternsV1 = detectAllChartPatterns(bars);
  
  // Process each detected pattern
  for (const pattern of patternsV1) {
    extractLevelsFromPattern(pattern, levels);
  }
  
  // Also try V2 detector for additional accuracy
  try {
    const patternsV2 = detectAllV2(bars, atr);
    for (const result of patternsV2) {
      if (result.institutional) {
        extractLevelsFromV2Pattern(result.institutional, levels);
      } else if (result.candidate) {
        extractLevelsFromV2Pattern(result.candidate, levels);
      }
    }
  } catch (err) {
    console.warn('[Pattern Levels] V2 detector error:', err);
  }
  
  // Set generic levels from highest confidence pattern
  if (patternsV1.length > 0) {
    const primary = patternsV1[0]; // Already sorted by confidence
    
    if (primary.keyLevels.support && primary.keyLevels.support.length > 0) {
      levels.primary_support = primary.keyLevels.support[0];
    }
    
    if (primary.keyLevels.resistance && primary.keyLevels.resistance.length > 0) {
      levels.primary_resistance = primary.keyLevels.resistance[0];
    }
    
    if (primary.keyLevels.breakoutLevel) {
      levels.breakout_level = primary.keyLevels.breakoutLevel;
    }
    
    if (primary.priceTarget) {
      levels.pattern_target = primary.priceTarget;
    }
  }
  
  return levels;
}

/**
 * Extract levels from V1 pattern
 */
function extractLevelsFromPattern(pattern: ChartPattern, levels: PatternLevels): void {
  const name = pattern.name.toLowerCase().replace(/\s+/g, '_');
  
  switch (pattern.name) {
    case 'Double Bottom':
      if (pattern.keyLevels.support && pattern.keyLevels.support.length > 0) {
        levels.double_bottom_support = pattern.keyLevels.support[0];
      }
      if (pattern.keyLevels.resistance && pattern.keyLevels.resistance.length > 0) {
        levels.double_bottom_neckline = pattern.keyLevels.resistance[0];
      }
      if (pattern.priceTarget) {
        levels.double_bottom_target = pattern.priceTarget;
      }
      break;
      
    case 'Double Top':
      if (pattern.keyLevels.resistance && pattern.keyLevels.resistance.length > 0) {
        levels.double_top_resistance = pattern.keyLevels.resistance[0];
      }
      if (pattern.keyLevels.support && pattern.keyLevels.support.length > 0) {
        levels.double_top_neckline = pattern.keyLevels.support[0];
      }
      if (pattern.priceTarget) {
        levels.double_top_target = pattern.priceTarget;
      }
      break;
      
    case 'Ascending Triangle':
      if (pattern.keyLevels.resistance && pattern.keyLevels.resistance.length > 0) {
        levels.ascending_triangle_resistance = pattern.keyLevels.resistance[0];
      }
      if (pattern.keyLevels.support && pattern.keyLevels.support.length > 0) {
        levels.ascending_triangle_support = pattern.keyLevels.support[0];
      }
      if (pattern.priceTarget) {
        levels.ascending_triangle_target = pattern.priceTarget;
      }
      break;
      
    case 'Descending Triangle':
      if (pattern.keyLevels.support && pattern.keyLevels.support.length > 0) {
        levels.descending_triangle_support = pattern.keyLevels.support[0];
      }
      if (pattern.keyLevels.resistance && pattern.keyLevels.resistance.length > 0) {
        levels.descending_triangle_resistance = pattern.keyLevels.resistance[0];
      }
      if (pattern.priceTarget) {
        levels.descending_triangle_target = pattern.priceTarget;
      }
      break;
      
    case 'Bullish Flag':
      if (pattern.keyLevels.support && pattern.keyLevels.support.length > 0) {
        levels.bullish_flag_support = pattern.keyLevels.support[0];
      }
      if (pattern.keyLevels.resistance && pattern.keyLevels.resistance.length > 0) {
        levels.bullish_flag_resistance = pattern.keyLevels.resistance[0];
      }
      if (pattern.priceTarget) {
        levels.bullish_flag_target = pattern.priceTarget;
      }
      break;
      
    case 'Bearish Flag':
      if (pattern.keyLevels.support && pattern.keyLevels.support.length > 0) {
        levels.bearish_flag_support = pattern.keyLevels.support[0];
      }
      if (pattern.keyLevels.resistance && pattern.keyLevels.resistance.length > 0) {
        levels.bearish_flag_resistance = pattern.keyLevels.resistance[0];
      }
      if (pattern.priceTarget) {
        levels.bearish_flag_target = pattern.priceTarget;
      }
      break;
  }
}

/**
 * Extract levels from V2 pattern (institutional or candidate)
 */
function extractLevelsFromV2Pattern(pattern: any, levels: PatternLevels): void {
  // V2 patterns have more detailed structure
  // Extract based on pattern type
  if (pattern.name?.includes('Double Bottom')) {
    if (pattern.support) levels.double_bottom_support = pattern.support;
    if (pattern.neckline) levels.double_bottom_neckline = pattern.neckline;
    if (pattern.target) levels.double_bottom_target = pattern.target;
  } else if (pattern.name?.includes('Double Top')) {
    if (pattern.resistance) levels.double_top_resistance = pattern.resistance;
    if (pattern.neckline) levels.double_top_neckline = pattern.neckline;
    if (pattern.target) levels.double_top_target = pattern.target;
  }
  // Add more V2 pattern types as needed
}

/**
 * Get all available pattern variables for a given set of levels
 */
export function getAvailablePatternVariables(levels: PatternLevels): string[] {
  const variables: string[] = [];
  
  for (const [key, value] of Object.entries(levels)) {
    if (value !== undefined && typeof value === 'number' && isFinite(value)) {
      variables.push(key);
    }
  }
  
  return variables;
}

/**
 * Validate if a variable name refers to a pattern level
 */
export function isPatternVariable(varName: string): boolean {
  const patternPrefixes = [
    'double_bottom_',
    'double_top_',
    'ascending_triangle_',
    'descending_triangle_',
    'bullish_flag_',
    'bearish_flag_',
    'head_shoulders_',
    'inv_head_shoulders_',
    'primary_',
    'breakout_level',
    'pattern_target'
  ];
  
  return patternPrefixes.some(prefix => varName.startsWith(prefix) || varName === prefix.replace(/_$/, ''));
}

/**
 * Get description of a pattern variable
 */
export function describePatternVariable(varName: string): string {
  const descriptions: Record<string, string> = {
    double_bottom_support: 'Double Bottom Support Level',
    double_bottom_neckline: 'Double Bottom Neckline',
    double_bottom_target: 'Double Bottom Price Target',
    double_top_resistance: 'Double Top Resistance Level',
    double_top_neckline: 'Double Top Neckline',
    double_top_target: 'Double Top Price Target',
    ascending_triangle_resistance: 'Ascending Triangle Resistance',
    ascending_triangle_support: 'Ascending Triangle Support',
    ascending_triangle_target: 'Ascending Triangle Target',
    descending_triangle_resistance: 'Descending Triangle Resistance',
    descending_triangle_support: 'Descending Triangle Support',
    descending_triangle_target: 'Descending Triangle Target',
    bullish_flag_support: 'Bullish Flag Support',
    bullish_flag_resistance: 'Bullish Flag Resistance',
    bullish_flag_target: 'Bullish Flag Target',
    bearish_flag_support: 'Bearish Flag Support',
    bearish_flag_resistance: 'Bearish Flag Resistance',
    bearish_flag_target: 'Bearish Flag Target',
    primary_support: 'Primary Support Level',
    primary_resistance: 'Primary Resistance Level',
    breakout_level: 'Breakout Level',
    pattern_target: 'Pattern Price Target',
  };
  
  return descriptions[varName] || varName.replace(/_/g, ' ');
}

