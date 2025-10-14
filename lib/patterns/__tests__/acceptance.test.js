/**
 * Acceptance Criteria Tests for Pattern Detection V2
 * Validates all requirements from the specification
 */

import { detectAllPatterns } from '../detector-v2';
import { OHLCV } from '../pattern-utils';

// Helper to create synthetic OHLCV data
function createBars(config: {
  count: number;
  basePrice: number;
  pattern?: 'flag' | 'triangle' | 'double_top' | 'flat';
  atr?: number;
}): OHLCV[] {
  const bars: OHLCV[] = [];
  const { count, basePrice, pattern = 'flat', atr = 1.0 } = config;
  
  for (let i = 0; i < count; i++) {
    const timestamp = Date.now() - (count - i) * 86400000;
    
    if (pattern === 'flag' && i < 20) {
      // Create pole (first 20 bars - strong up move)
      const open = basePrice + (i * 0.5);
      const close = open + 0.6;
      bars.push({
        timestamp,
        open,
        high: close + 0.1,
        low: open - 0.1,
        close,
        volume: 1000000 * (1 + Math.random() * 0.5)
      });
    } else if (pattern === 'flag' && i >= 20) {
      // Create consolidation (tight, parallel, declining volume)
      const poleTop = basePrice + (19 * 0.5) + 0.6;
      const idx = i - 20;
      const open = poleTop - (idx * 0.05);
      const close = open - 0.03;
      bars.push({
        timestamp,
        open,
        high: open + 0.05,
        low: close - 0.05,
        close,
        volume: 800000 * (1 - idx * 0.02) // Declining
      });
    } else if (pattern === 'triangle' && i < 40) {
      // Ascending triangle: flat resistance, rising support
      const resistance = basePrice + 2;
      const support = basePrice + (i * 0.03);
      const mid = (resistance + support) / 2;
      bars.push({
        timestamp,
        open: mid - 0.1,
        high: resistance + (Math.random() * 0.1 - 0.05),
        low: support - (Math.random() * 0.1 - 0.05),
        close: mid + 0.1,
        volume: 1000000 * (1 - i * 0.01) // Declining
      });
    } else if (pattern === 'double_top') {
      // Create double top
      if (i < 15) {
        const up = basePrice + (i * 0.2);
        bars.push({
          timestamp,
          open: up,
          high: up + 0.15,
          low: up - 0.05,
          close: up + 0.1,
          volume: 1000000
        });
      } else if (i >= 15 && i < 25) {
        // Valley
        const down = basePrice + 3 - ((i - 15) * 0.15);
        bars.push({
          timestamp,
          open: down + 0.1,
          high: down + 0.2,
          low: down,
          close: down + 0.05,
          volume: 900000
        });
      } else {
        // Second peak
        const up = basePrice + 1.5 + ((i - 25) * 0.15);
        bars.push({
          timestamp,
          open: up,
          high: up + 0.15,
          low: up - 0.05,
          close: up + 0.1,
          volume: 1000000
        });
      }
    } else {
      // Flat
      bars.push({
        timestamp,
        open: basePrice,
        high: basePrice + atr * 0.5,
        low: basePrice - atr * 0.5,
        close: basePrice + (Math.random() * atr - atr/2),
        volume: 1000000
      });
    }
  }
  
  return bars;
}

describe('Pattern Detection V2 - Acceptance Criteria', () => {
  
  describe('AC1: Triangle with quality metrics → composite ≥ 80', () => {
    it('should detect ascending triangle with ≥5 touches, width ≤3%, breakoutVolZ>1, confirmed → composite ≥ 80', () => {
      const bars = createBars({ count: 40, basePrice: 100, pattern: 'triangle' });
      
      // Add breakout bar with high volume
      bars.push({
        timestamp: Date.now(),
        open: 102,
        high: 103,
        low: 101.5,
        close: 102.8,
        volume: 2000000 // High volume for breakout
      });
      
      const result = detectAllPatterns(bars);
      
      expect(result.chartPattern).not.toBeNull();
      expect(result.chartPattern?.name).toBe('Ascending Triangle');
      expect(result.chartPattern?.metadata.totalTouches).toBeGreaterThanOrEqual(5);
      expect(result.chartPattern?.metadata.widthPct).toBeLessThanOrEqual(3);
      expect(result.chartPattern?.volumeZScore).toBeGreaterThan(1);
      expect(result.chartPattern?.breakoutStatus).toBe('confirmed');
      expect(result.composite.composite).toBeGreaterThanOrEqual(80);
      expect(result.composite.direction).toBe('bullish');
    });
  });
  
  describe('AC2: Flag with declining vol + confirmed breakout + retest → composite ≥ 85', () => {
    it('should detect bullish flag with retest and high composite', () => {
      const bars = createBars({ count: 45, basePrice: 100, pattern: 'flag' });
      
      // Add breakout
      bars.push({
        timestamp: Date.now() - 2 * 86400000,
        open: 110.5,
        high: 111.5,
        low: 110,
        close: 111.2,
        volume: 1800000 // High volume
      });
      
      // Add retest
      bars.push({
        timestamp: Date.now() - 86400000,
        open: 111,
        high: 111.3,
        low: 110.2, // Retest the breakout level
        close: 111,
        volume: 1200000
      });
      
      // Current bar above
      bars.push({
        timestamp: Date.now(),
        open: 111.1,
        high: 112,
        low: 110.9,
        close: 111.8,
        volume: 1500000
      });
      
      const result = detectAllPatterns(bars);
      
      expect(result.chartPattern).not.toBeNull();
      expect(result.chartPattern?.name).toBe('Bullish Flag');
      expect(result.chartPattern?.breakoutStatus).toBe('retest');
      expect(result.chartPattern?.metadata.breakoutVolZ).toBeGreaterThan(1);
      expect(result.composite.composite).toBeGreaterThanOrEqual(85);
      
      // Check reasons include key facts
      const allReasons = [
        ...result.chartPattern!.reasons,
        ...result.composite.reasons
      ].join(' ');
      
      expect(allReasons).toContain('touches');
      expect(allReasons).toContain('ATR');
      expect(allReasons).toContain('retest');
      expect(allReasons).toContain('volZ');
    });
  });
  
  describe('AC3: Double top with quality → composite ≥ 80', () => {
    it('should detect double top with symmetry ≤2%, separation ≥10 bars, neckline break volZ ≥1.2', () => {
      const bars = createBars({ count: 35, basePrice: 100, pattern: 'double_top' });
      
      // Add neckline break with high volume
      bars.push({
        timestamp: Date.now(),
        open: 101.6,
        high: 101.8,
        low: 101.3,
        close: 101.4, // Below neckline
        volume: 2200000 // volZ ≥ 1.2
      });
      
      const result = detectAllPatterns(bars);
      
      expect(result.chartPattern).not.toBeNull();
      expect(result.chartPattern?.name).toBe('Double Top');
      expect(result.chartPattern?.metadata.symmetryPct).toBeLessThanOrEqual(2);
      expect(result.chartPattern?.metadata.separationBars).toBeGreaterThanOrEqual(10);
      expect(result.chartPattern?.volumeZScore).toBeGreaterThanOrEqual(1.2);
      expect(result.composite.composite).toBeGreaterThanOrEqual(80);
      expect(result.composite.direction).toBe('bearish');
      
      // Check price target calculation
      expect(result.chartPattern?.priceTarget).toBeDefined();
      expect(result.chartPattern?.priceTarget).toBeLessThan(result.chartPattern?.keyLevels.support![0]!);
    });
  });
  
  describe('AC4: Candle opposes chart → composite reduced by 10', () => {
    it('should apply -10 penalty when candlestick opposes chart pattern', () => {
      const bars = createBars({ count: 40, basePrice: 100, pattern: 'triangle' });
      
      // Add bearish engulfing (opposes bullish triangle)
      bars.push({
        timestamp: Date.now() - 86400000,
        open: 102,
        high: 102.2,
        low: 101.8,
        close: 102.1,
        volume: 1000000
      });
      
      bars.push({
        timestamp: Date.now(),
        open: 102.3,
        high: 102.4,
        low: 101.5,
        close: 101.6, // Bearish engulfing
        volume: 1200000
      });
      
      const result = detectAllPatterns(bars);
      
      expect(result.chartPattern?.type).toBe('bullish');
      expect(result.candlestickPattern.type).toBe('bearish');
      expect(result.composite.penalties.opposition).toBe(10);
      
      const withoutPenalty = result.composite.composite + 10;
      expect(result.composite.reasons.some(r => r.includes('-10 opposition'))).toBe(true);
      expect(result.composite.analysis).toContain('conflict');
    });
  });
  
  describe('AC5: No chart pattern + basic trend → composite ≤ 55', () => {
    it('should cap composite at 55 when only basic trend present', () => {
      const bars = createBars({ count: 10, basePrice: 100, pattern: 'flat' });
      
      // Create simple uptrend (no engulfing or strong candle pattern)
      for (let i = 0; i < 5; i++) {
        bars.push({
          timestamp: Date.now() - (5 - i) * 86400000,
          open: 100 + i * 0.5,
          high: 100 + i * 0.5 + 0.3,
          low: 100 + i * 0.5 - 0.1,
          close: 100 + i * 0.5 + 0.25,
          volume: 1000000
        });
      }
      
      const result = detectAllPatterns(bars);
      
      expect(result.chartPattern).toBeNull();
      expect(['Uptrend', 'Consolidation'].includes(result.candlestickPattern.name)).toBe(true);
      expect(result.composite.composite).toBeLessThanOrEqual(55);
      expect(result.composite.reasons.some(r => r.includes('No structure')|| r.includes('wait for setup'))).toBe(true);
      expect(result.composite.analysis).toContain('wait');
    });
  });
  
  describe('AC6: Confidence capped at 95', () => {
    it('should never exceed 95% confidence on any pattern', () => {
      // Create perfect triangle with everything maxed
      const bars = createBars({ count: 40, basePrice: 100, pattern: 'triangle' });
      
      // Perfect breakout with massive volume
      bars.push({
        timestamp: Date.now() - 2 * 86400000,
        open: 102,
        high: 103.5,
        low: 101.8,
        close: 103.2,
        volume: 5000000
      });
      
      // Retest
      bars.push({
        timestamp: Date.now() - 86400000,
        open: 103,
        high: 103.2,
        low: 102,
        close: 103,
        volume: 2000000
      });
      
      // Bullish engulfing
      bars.push({
        timestamp: Date.now(),
        open: 103.1,
        high: 104.5,
        low: 103,
        close: 104.3,
        volume: 3000000
      });
      
      const result = detectAllPatterns(bars);
      
      expect(result.chartPattern?.confidence).toBeLessThanOrEqual(95);
      expect(result.candlestickPattern.confidence).toBeLessThanOrEqual(95);
      expect(result.composite.composite).toBeLessThanOrEqual(95);
      expect(result.composite.compositeLabel).toContain('high confidence');
    });
  });
  
  describe('AC7: Liquidity safeguards', () => {
    it('should cap composite at 70 when liquidity below threshold', () => {
      const bars = createBars({ count: 40, basePrice: 100, pattern: 'triangle' });
      
      const result = detectAllPatterns(bars, {
        avgDollarVolume: 500000, // Below 1M threshold
        minLiquidityThreshold: 1000000
      });
      
      expect(result.composite.composite).toBeLessThanOrEqual(70);
      expect(result.composite.reasons.some(r => r.includes('Low liquidity'))).toBe(true);
      expect(result.composite.analysis).toContain('liquidity warning');
    });
  });
  
  describe('AC8: Earnings safeguards', () => {
    it('should block trades when earnings within 1 day', () => {
      const bars = createBars({ count: 40, basePrice: 100, pattern: 'triangle' });
      
      const result = detectAllPatterns(bars, {
        daysToEarnings: 1,
        earningsBlockWindow: 3
      });
      
      expect(result.composite.composite).toBeLessThanOrEqual(40);
      expect(result.composite.reasons.some(r => r.includes('Earnings'))).toBe(true);
      expect(result.composite.analysis).toContain('EARNINGS ALERT');
    });
    
    it('should warn but not block when earnings 3+ days away', () => {
      const bars = createBars({ count: 40, basePrice: 100, pattern: 'triangle' });
      
      const result = detectAllPatterns(bars, {
        daysToEarnings: 5,
        earningsBlockWindow: 3
      });
      
      expect(result.composite.composite).toBeGreaterThan(40);
      expect(result.composite.reasons.some(r => r.includes('Earnings in 5 days'))).toBe(true);
    });
  });
  
  describe('AC9: Explainability - Reasons array', () => {
    it('should provide comprehensive reasons for all scores', () => {
      const bars = createBars({ count: 45, basePrice: 100, pattern: 'flag' });
      
      const result = detectAllPatterns(bars);
      
      if (result.chartPattern) {
        expect(result.chartPattern.reasons.length).toBeGreaterThan(0);
        
        const chartReasons = result.chartPattern.reasons.join(' ');
        expect(chartReasons).toMatch(/touches/i);
        expect(chartReasons).toMatch(/width/i);
        expect(chartReasons).toMatch(/slope/i);
      }
      
      expect(result.composite.reasons.length).toBeGreaterThan(0);
      const compositeReasons = result.composite.reasons.join(' ');
      expect(compositeReasons).toMatch(/base:/i);
    });
  });
});

