/**
 * Swing Strategy Scanner
 * 
 * Rule-based scanner for early-stage bullish trends suitable for 5-15 day swing trades
 * Implements the "US Swing – Early-Stage Bullish Trend" strategy
 */

import type { OHLCV } from '../strategies/types';
import { calculateEMA, calculateRSI, calculateATR, calculateMACD, calculateADX } from '../technical-analysis/advanced-indicators';
import { calculateOBV, calculateCMF, calculateStochastic } from '../technical-analysis/advanced-indicators';
import type { 
  SwingStrategyConfig, 
  SwingScanResult, 
  SwingScanParameters,
  EARLY_STAGE_BULLISH_TREND 
} from './swing-strategy-templates';

// ═══════════════════════════════════════════════════════════════════════════
// SWING SCANNER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class SwingScanner {
  private config: SwingStrategyConfig;
  private params: SwingScanParameters;
  
  constructor(config: SwingStrategyConfig, params: Partial<SwingScanParameters> = {}) {
    this.config = config;
    this.params = { ...getDefaultParams(), ...params };
  }
  
  /**
   * Evaluate a single ticker against the swing strategy
   */
  evaluateTicker(
    ticker: string,
    name: string,
    bars: OHLCV[],
    avgDollarVolume: number
  ): SwingScanResult | null {
    if (bars.length < 50) {
      return null; // Insufficient data
    }
    
    const currentBar = bars[bars.length - 1];
    const price = currentBar.close;
    
    // ─────────────────────────────────────────────────────────────────
    // STEP 1: Calculate all indicators
    // ─────────────────────────────────────────────────────────────────
    const closes = bars.map(b => b.close);
    const volumes = bars.map(b => b.volume);
    
    // EMAs
    const ema9Array = calculateEMA(closes, 9);
    const ema20Array = calculateEMA(closes, 20);
    const ema50Array = calculateEMA(closes, 50);
    const ema200Array = calculateEMA(closes, 200);
    
    const ema9 = ema9Array[ema9Array.length - 1] || price;
    const ema20 = ema20Array[ema20Array.length - 1] || price;
    const ema50 = ema50Array[ema50Array.length - 1] || price;
    const ema200 = ema200Array[ema200Array.length - 1] || price;
    
    // EMA Distance
    const ema20Distance = ((price - ema20) / ema20) * 100;
    
    // ADX
    const adxData = calculateADX(bars, 14);
    const adx = adxData.adx[adxData.adx.length - 1] || 0;
    const plusDI = adxData.plusDI[adxData.plusDI.length - 1] || 0;
    const minusDI = adxData.minusDI[adxData.minusDI.length - 1] || 0;
    
    // RSI
    const rsiArray = calculateRSI(closes, 14);
    const rsi = rsiArray[rsiArray.length - 1] || 50;
    
    // MACD
    const macdData = calculateMACD(closes, 12, 26, 9);
    const macdLine = macdData.macd[macdData.macd.length - 1] || 0;
    const macdSignal = macdData.signal[macdData.signal.length - 1] || 0;
    const macdHistogram = macdData.histogram[macdData.histogram.length - 1] || 0;
    
    // Check MACD cross within last 5 bars
    const macdCrossedRecently = this.checkMACDCrossWithinBars(macdData, 5);
    
    // Stochastic
    const stochData = calculateStochastic(bars, 14, 3, 3);
    const stochK = stochData.k[stochData.k.length - 1] || 50;
    
    // ATR
    const atrArray = calculateATR(bars, 14);
    const atr = atrArray[atrArray.length - 1] || 0;
    const atrPercent = (atr / price) * 100;
    
    // Volume
    const avgVolume20 = this.calculateAvgVolume(volumes, 20);
    // Use 3-day average for more stable volume reading (based on config)
    const use3DayAvg = this.config.volume?.use3DayAverage ?? true;
    const recentVolume = use3DayAvg 
      ? this.calculateAvgVolume(volumes, 3)
      : volumes[volumes.length - 1];
    const volumeRatio = avgVolume20 > 0 ? recentVolume / avgVolume20 : 1;
    
    // OBV
    const obvArray = calculateOBV(bars);
    const obv = obvArray[obvArray.length - 1] || 0;
    const obvMA = this.calculateMA(obvArray, 20);
    const obvTrend: 'rising' | 'falling' | 'flat' = obv > obvMA * 1.02 ? 'rising' : obv < obvMA * 0.98 ? 'falling' : 'flat';
    
    // CMF
    const cmfArray = calculateCMF(bars, 20);
    const cmf = cmfArray[cmfArray.length - 1] || 0;
    
    // Check for new high
    const hasNewHigh = this.checkNewHighWithinBars(bars, 20, 10);
    
    // Check for breakout above prior range
    const hasBreakout = this.checkBreakoutAbovePriorBars(bars, 40);
    
    // ─────────────────────────────────────────────────────────────────
    // STEP 2: Apply Filters
    // ─────────────────────────────────────────────────────────────────
    
    const trendFilter = this.evaluateTrendFilter(
      price, ema20, ema50, ema200, ema20Distance,
      adx, plusDI, minusDI, hasNewHigh, hasBreakout
    );
    
    const momentumFilter = this.evaluateMomentumFilter(
      rsi, macdLine, macdCrossedRecently, stochK
    );
    
    const volumeFilter = this.evaluateVolumeFilter(
      volumeRatio, obvTrend, cmf
    );
    
    const volatilityFilter = this.evaluateVolatilityFilter(atrPercent);
    
    // ─────────────────────────────────────────────────────────────────
    // STEP 3: Check if all filters pass
    // ─────────────────────────────────────────────────────────────────
    
    const allFiltersPassed = 
      trendFilter.passed && 
      momentumFilter.passed && 
      volumeFilter.passed && 
      volatilityFilter.passed;
    
    if (!allFiltersPassed) {
      return null; // Does not qualify
    }
    
    // ─────────────────────────────────────────────────────────────────
    // STEP 4: Calculate Overall Score
    // ─────────────────────────────────────────────────────────────────
    
    const overallScore = Math.round(
      trendFilter.score * 0.35 +
      momentumFilter.score * 0.25 +
      volumeFilter.score * 0.25 +
      volatilityFilter.score * 0.15
    );
    
    const confidence = overallScore >= 75 ? 'high' : overallScore >= 60 ? 'medium' : 'low';
    
    // ─────────────────────────────────────────────────────────────────
    // STEP 5: Generate Trading Blueprint
    // ─────────────────────────────────────────────────────────────────
    
    const blueprint = this.generateTradingBlueprint(
      price, ema20, atr, bars
    );
    
    // ─────────────────────────────────────────────────────────────────
    // STEP 6: Build Result
    // ─────────────────────────────────────────────────────────────────
    
    const notes: string[] = [];
    const warnings: string[] = [];
    
    // Add notes based on conditions
    if (hasNewHigh) {
      notes.push('Made new 20-day high recently');
    }
    if (hasBreakout) {
      notes.push('Broke above prior consolidation range');
    }
    if (adx > 25) {
      notes.push('ADX indicates strengthening trend');
    }
    if (obvTrend === 'rising') {
      notes.push('OBV confirms accumulation');
    }
    
    // Add warnings
    if (ema20Distance > 7) {
      warnings.push(`Price ${ema20Distance.toFixed(1)}% above EMA20 - approaching extended territory`);
    }
    if (stochK > 80) {
      warnings.push('Stochastic overbought - consider waiting for pullback');
    }
    if (volumeRatio > 3) {
      warnings.push('Volume spike may indicate blow-off - use caution');
    }
    
    return {
      ticker,
      name,
      price,
      regimeLabel: 'Early-stage bullish trend, 5–15 day swing candidate',
      filterScores: {
        trend: trendFilter,
        momentum: momentumFilter,
        volume: volumeFilter,
        volatility: volatilityFilter,
      },
      overallScore,
      confidence,
      indicators: {
        ema20,
        ema50,
        ema200,
        ema20Distance,
        adx,
        plusDI,
        minusDI,
        rsi,
        macdLine,
        macdSignal,
        macdHistogram,
        volumeRatio,
        obvTrend,
        cmf,
        atrPercent,
      },
      blueprint,
      notes,
      warnings,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FILTER EVALUATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════
  
  private evaluateTrendFilter(
    price: number,
    ema20: number,
    ema50: number,
    ema200: number,
    ema20Distance: number,
    adx: number,
    plusDI: number,
    minusDI: number,
    hasNewHigh: boolean,
    hasBreakout: boolean
  ): { passed: boolean; score: number; details: string[] } {
    const details: string[] = [];
    let score = 0;
    let passed = true;
    
    // Check Price > EMA20
    if (price > ema20) {
      score += 20;
      details.push(`✓ Price above EMA20 ($${ema20.toFixed(2)})`);
    } else {
      passed = false;
      details.push(`✗ Price below EMA20`);
    }
    
    // Check Price > EMA50
    if (price > ema50) {
      score += 20;
      details.push(`✓ Price above EMA50 ($${ema50.toFixed(2)})`);
    } else {
      passed = false;
      details.push(`✗ Price below EMA50`);
    }
    
    // Check EMA20 Distance (0% ≤ distance ≤ 10%)
    // Min distance is always 0 (price must be at or above EMA20)
    const ema20DistanceMin = 0;
    if (ema20Distance >= ema20DistanceMin && ema20Distance <= this.params.ema20DistanceMax) {
      score += 20;
      details.push(`✓ EMA20 distance ${ema20Distance.toFixed(1)}% (within 0-${this.params.ema20DistanceMax}%)`);
    } else if (ema20Distance > this.params.ema20DistanceMax) {
      passed = false;
      details.push(`✗ Price too extended (${ema20Distance.toFixed(1)}% above EMA20)`);
    } else {
      passed = false;
      details.push(`✗ Price below EMA20`);
    }
    
    // Check ADX (20-30)
    if (adx >= this.params.adxMin && adx <= this.params.adxMax) {
      score += 20;
      details.push(`✓ ADX ${adx.toFixed(1)} (in ${this.params.adxMin}-${this.params.adxMax} range)`);
    } else {
      passed = false;
      details.push(`✗ ADX ${adx.toFixed(1)} outside ${this.params.adxMin}-${this.params.adxMax} range`);
    }
    
    // Check +DI > -DI
    if (plusDI > minusDI) {
      score += 10;
      details.push(`✓ +DI (${plusDI.toFixed(1)}) > -DI (${minusDI.toFixed(1)}) = bullish bias`);
    } else {
      passed = false;
      details.push(`✗ +DI ≤ -DI = no bullish bias`);
    }
    
    // Bonus: New high or breakout
    if (hasNewHigh || hasBreakout) {
      score += 10;
      details.push(`✓ ${hasNewHigh ? 'New 20-day high' : 'Breakout'} detected`);
    }
    
    return { passed, score: Math.min(100, score), details };
  }
  
  private evaluateMomentumFilter(
    rsi: number,
    macdLine: number,
    macdCrossedRecently: boolean,
    stochK: number
  ): { passed: boolean; score: number; details: string[] } {
    const details: string[] = [];
    let score = 0;
    let passed = true;
    
    // Check RSI (55-65)
    if (rsi >= this.params.rsiMin && rsi <= this.params.rsiMax) {
      score += 40;
      details.push(`✓ RSI ${rsi.toFixed(1)} (in ${this.params.rsiMin}-${this.params.rsiMax} range)`);
    } else {
      passed = false;
      if (rsi > this.params.rsiMax) {
        details.push(`✗ RSI ${rsi.toFixed(1)} too high (overbought risk)`);
      } else {
        details.push(`✗ RSI ${rsi.toFixed(1)} too low (weak momentum)`);
      }
    }
    
    // Check MACD > 0 OR MACD crossed signal recently
    if (macdLine > 0) {
      score += 30;
      details.push(`✓ MACD (${macdLine.toFixed(3)}) above zero`);
    } else if (macdCrossedRecently) {
      score += 25;
      details.push(`✓ MACD crossed above signal within 5 bars`);
    } else {
      passed = false;
      details.push(`✗ MACD below zero and no recent cross`);
    }
    
    // Check Stochastic not too high (avoid exhaustion)
    if (stochK <= (this.config.momentum.stochMaxForEntry || 90)) {
      score += 30;
      details.push(`✓ Stochastic ${stochK.toFixed(1)} (not exhausted)`);
    } else {
      // Warning but don't fail
      details.push(`⚠ Stochastic ${stochK.toFixed(1)} elevated (caution)`);
    }
    
    return { passed, score: Math.min(100, score), details };
  }
  
  private evaluateVolumeFilter(
    volumeRatio: number,
    obvTrend: 'rising' | 'falling' | 'flat',
    cmf: number
  ): { passed: boolean; score: number; details: string[] } {
    const details: string[] = [];
    let score = 0;
    let passed = true;
    
    // Check volume ratio
    if (volumeRatio >= this.params.volumeRatioMin) {
      score += 35;
      details.push(`✓ Volume ${volumeRatio.toFixed(1)}× 20-day average`);
      
      // Warn if too high
      if (volumeRatio > 4) {
        details.push(`⚠ Very high volume may indicate blow-off`);
      }
    } else {
      passed = false;
      details.push(`✗ Volume ${volumeRatio.toFixed(1)}× below ${this.params.volumeRatioMin}× threshold`);
    }
    
    // Check OBV trend
    if (this.params.requireOBVConfirm) {
      if (obvTrend === 'rising') {
        score += 35;
        details.push(`✓ OBV trending up (accumulation)`);
      } else if (obvTrend === 'flat') {
        score += 15;
        details.push(`○ OBV flat (neutral)`);
      } else {
        passed = false;
        details.push(`✗ OBV falling (distribution)`);
      }
    } else {
      score += 20; // Neutral if not required
    }
    
    // Check CMF
    if (this.params.excludeNegativeCMF && cmf <= (this.config.volume.cmfExcludeBelow || -0.1)) {
      passed = false;
      details.push(`✗ CMF ${cmf.toFixed(3)} indicates distribution`);
    } else if (cmf > 0) {
      score += 30;
      details.push(`✓ CMF ${cmf.toFixed(3)} positive (accumulation)`);
    } else {
      score += 10;
      details.push(`○ CMF ${cmf.toFixed(3)} neutral`);
    }
    
    return { passed, score: Math.min(100, score), details };
  }
  
  private evaluateVolatilityFilter(
    atrPercent: number
  ): { passed: boolean; score: number; details: string[] } {
    const details: string[] = [];
    let score = 0;
    let passed = true;
    
    // Check ATR% in range (2-8%)
    if (atrPercent >= this.params.atrPercentMin && atrPercent <= this.params.atrPercentMax) {
      // Score higher for optimal range (3-6%)
      if (atrPercent >= 3 && atrPercent <= 6) {
        score = 100;
        details.push(`✓ ATR ${atrPercent.toFixed(2)}% (optimal for swings)`);
      } else {
        score = 70;
        details.push(`✓ ATR ${atrPercent.toFixed(2)}% (acceptable range)`);
      }
    } else {
      passed = false;
      if (atrPercent < this.params.atrPercentMin) {
        details.push(`✗ ATR ${atrPercent.toFixed(2)}% too low (slow mover)`);
      } else {
        details.push(`✗ ATR ${atrPercent.toFixed(2)}% too high (too volatile)`);
      }
    }
    
    return { passed, score, details };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TRADING BLUEPRINT GENERATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  private generateTradingBlueprint(
    price: number,
    ema20: number,
    atr: number,
    bars: OHLCV[]
  ): SwingScanResult['blueprint'] {
    // Find recent swing low for stop calculation
    const swingLow = this.findRecentSwingLow(bars, 20);
    
    // Entry zone: Pullback to EMA20 area
    const entryLow = ema20;
    const entryHigh = ema20 + atr * 0.5; // Allow entry up to 0.5 ATR above EMA20
    
    // Stop loss: Below swing low OR 1.35× ATR below entry, whichever is tighter
    const atrBasedStop = entryLow - atr * (this.config.tradingBlueprint.stopAtrMultiplier || 1.35);
    const swingBasedStop = swingLow - atr * 0.2; // Just below swing low
    const suggestedStop = Math.max(atrBasedStop, swingBasedStop); // Use tighter stop
    
    // Risk calculation
    const entryMidpoint = (entryLow + entryHigh) / 2;
    const stopRiskPercent = ((entryMidpoint - suggestedStop) / entryMidpoint) * 100;
    
    // Targets
    const primaryTargetMultiplier = this.config.tradingBlueprint.primaryTargetAtrMultiplier;
    const primaryTarget = entryMidpoint + atr * primaryTargetMultiplier;
    const primaryTargetRR = (primaryTarget - entryMidpoint) / (entryMidpoint - suggestedStop);
    
    const extendedTargetMultiplier = this.config.tradingBlueprint.extendedTargetAtrMultiplier || 2.0;
    const extendedTarget = entryMidpoint + atr * extendedTargetMultiplier;
    const extendedTargetRR = (extendedTarget - entryMidpoint) / (entryMidpoint - suggestedStop);
    
    return {
      suggestedEntryZone: {
        low: Number(entryLow.toFixed(2)),
        high: Number(entryHigh.toFixed(2)),
      },
      entryType: 'Limit order near EMA20',
      entryDescription: `Enter on pullback to $${entryLow.toFixed(2)} - $${entryHigh.toFixed(2)} zone`,
      
      suggestedStop: Number(suggestedStop.toFixed(2)),
      stopRiskPercent: Number(stopRiskPercent.toFixed(2)),
      stopDescription: `Stop at $${suggestedStop.toFixed(2)} (below swing low / ~${this.config.tradingBlueprint.stopAtrMultiplier}× ATR)`,
      
      primaryTarget: Number(primaryTarget.toFixed(2)),
      primaryTargetRR: Number(primaryTargetRR.toFixed(2)),
      primaryTargetDescription: `Primary target $${primaryTarget.toFixed(2)} (~${primaryTargetMultiplier}× ATR, ${primaryTargetRR.toFixed(1)}:1 R:R)`,
      
      extendedTarget: Number(extendedTarget.toFixed(2)),
      extendedTargetRR: Number(extendedTargetRR.toFixed(2)),
      extendedTargetCondition: this.config.tradingBlueprint.extendedTargetCondition,
      
      suggestedHoldingDays: {
        min: this.config.holdingPeriod.min,
        max: this.config.holdingPeriod.max,
      },
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════
  
  private checkMACDCrossWithinBars(macdData: { histogram: number[] }, bars: number): boolean {
    const hist = macdData.histogram;
    for (let i = hist.length - 1; i >= Math.max(0, hist.length - bars); i--) {
      if (i > 0 && hist[i] > 0 && hist[i - 1] <= 0) {
        return true; // Bullish cross
      }
    }
    return false;
  }
  
  private checkNewHighWithinBars(bars: OHLCV[], highLookback: number, withinBars: number): boolean {
    if (bars.length < highLookback) return false;
    
    // Find 20-day high excluding recent bars
    const historicalHigh = Math.max(...bars.slice(-highLookback - withinBars, -withinBars).map(b => b.high));
    
    // Check if any recent bar made a new high
    for (let i = bars.length - withinBars; i < bars.length; i++) {
      if (bars[i].high > historicalHigh) {
        return true;
      }
    }
    return false;
  }
  
  private checkBreakoutAbovePriorBars(bars: OHLCV[], priorBars: number): boolean {
    if (bars.length < priorBars + 1) return false;
    
    const currentClose = bars[bars.length - 1].close;
    const priorHighClose = Math.max(...bars.slice(-priorBars - 1, -1).map(b => b.close));
    
    return currentClose > priorHighClose;
  }
  
  private calculateAvgVolume(volumes: number[], period: number): number {
    const slice = volumes.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }
  
  private calculateMA(data: number[], period: number): number {
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }
  
  private findRecentSwingLow(bars: OHLCV[], lookback: number): number {
    const recentBars = bars.slice(-lookback);
    let swingLow = Infinity;
    
    for (let i = 2; i < recentBars.length - 2; i++) {
      const bar = recentBars[i];
      const prev1 = recentBars[i - 1];
      const prev2 = recentBars[i - 2];
      const next1 = recentBars[i + 1];
      const next2 = recentBars[i + 2];
      
      // Simple swing low: lower than surrounding bars
      if (bar.low < prev1.low && bar.low < prev2.low &&
          bar.low < next1.low && bar.low < next2.low) {
        swingLow = Math.min(swingLow, bar.low);
      }
    }
    
    // Fallback to recent low
    if (swingLow === Infinity) {
      swingLow = Math.min(...recentBars.map(b => b.low));
    }
    
    return swingLow;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT PARAMETERS
// ═══════════════════════════════════════════════════════════════════════════

function getDefaultParams(): SwingScanParameters {
  return {
    minPrice: 5,
    minAvgDollarVolume: 5_000_000,
    volumeRatioMin: 1.5,
    adxMin: 20,
    adxMax: 30,
    rsiMin: 55,
    rsiMax: 65,
    ema20DistanceMax: 10,
    atrPercentMin: 2,
    atrPercentMax: 8,
    requireNewHigh: false,
    requireOBVConfirm: true,
    excludeNegativeCMF: true,
    maxResults: 50,
    sortBy: 'score',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export function createEarlyBullishScanner(params?: Partial<SwingScanParameters>): SwingScanner {
  const { EARLY_STAGE_BULLISH_TREND } = require('./swing-strategy-templates');
  return new SwingScanner(EARLY_STAGE_BULLISH_TREND, params);
}

