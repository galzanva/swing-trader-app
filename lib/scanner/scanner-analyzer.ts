/**
 * Enhanced Scanner Analyzer with Caching & Additional Filters
 * Now with Pattern Detection and Level Extraction
 */

import { PolygonClient } from '../data-vendors/polygon';
import { calculateTechnicalIndicators } from '../indicators/technical';
import { evaluateUserStrategy } from '../strategy-builder/evaluator';
import type { StrategyInput, OHLCV } from '../strategies/types';
import type { StrategyDsl } from '../strategy-builder/dsl-schema';
import type { EnhancedScannerConfig, TrendDirection } from './scanner-config';
import { scannerCache } from './scanner-cache';
import type { ScanResult } from './market-scanner';
import { extractPatternLevels, getAvailablePatternVariables } from '../patterns/extract-levels';
import { analyzeCombinedSqueeze } from '../indicators/squeeze';

export class ScannerAnalyzer {
  private polygonClient: PolygonClient;
  private cacheHits = 0;
  private apiCalls = 0;

  constructor(apiKey: string) {
    this.polygonClient = new PolygonClient(apiKey);
  }

  getStats() {
    return {
      cacheHits: this.cacheHits,
      apiCalls: this.apiCalls,
    };
  }

  resetStats() {
    this.cacheHits = 0;
    this.apiCalls = 0;
  }

  /**
   * Analyze ticker with caching and enhanced filters
   */
  async analyzeTicker(
    snapshotData: any,
    strategy: StrategyDsl,
    config: EnhancedScannerConfig
  ): Promise<ScanResult | null> {
    const ticker = snapshotData.ticker;

    try {
      // Try cache first
      const cached = scannerCache.get(ticker, strategy.timeframe);
      let bars: OHLCV[];
      let indicators: any;
      let shortInterest: any = {};

      if (cached) {
        console.log(`[Scanner] ${ticker}: Cache hit`);
        this.cacheHits++;
        bars = cached.bars;
        indicators = cached.indicators;
        shortInterest = cached.shortInterest || {};
      } else {
        console.log(`[Scanner] ${ticker}: Fetching data`);
        this.apiCalls++;

        // Fetch full OHLCV data with short interest
        const marketData = await this.polygonClient.getAggregatesWithShortInterest(
          ticker,
          strategy.timeframe,
          300 // Get 300 bars
        );

        // Skip if data is stale (more than 5 days old)
        if (marketData.dataAgeDays > 5) {
          console.log(`[Scanner] ${ticker}: Stale data (${marketData.dataAgeDays} days old)`);
          return null;
        }

        // Apply market cap filter now (if available in full data)
        if (marketData.marketCap && config.marketCapPreset && config.marketCapPreset !== 'any') {
          const { getMarketCapRange } = await import('./scanner-config');
          const marketCapRange = getMarketCapRange(config);
          if (marketCapRange) {
            if (marketData.marketCap < marketCapRange.min || marketData.marketCap > marketCapRange.max) {
              console.log(`[Scanner] ${ticker}: Market cap $${(marketData.marketCap / 1e9).toFixed(2)}B outside range`);
              return null;
            }
          }
        }

        bars = marketData.bars;
        indicators = calculateTechnicalIndicators(bars);
        shortInterest = marketData.shortInterest || {};

        // Cache for future use (including short interest!)
        scannerCache.set(ticker, strategy.timeframe, bars, indicators, shortInterest);
      }

      const currentPrice = bars[bars.length - 1]?.close || 0;
      const atrPct = (indicators.atr / currentPrice) * 100;
      
      // Extract pattern-derived price levels
      console.log(`[Scanner] ${ticker}: Detecting patterns and extracting levels...`);
      const patternLevels = extractPatternLevels(bars, indicators.atr);
      const availablePatternVars = getAvailablePatternVariables(patternLevels);
      
      if (availablePatternVars.length > 0) {
        console.log(`[Scanner] ${ticker}: Found pattern levels:`, availablePatternVars.join(', '));
      } else {
        console.log(`[Scanner] ${ticker}: No pattern levels detected`);
      }

      // Apply ATR% filter
      if (config.minAtrPct !== undefined && atrPct < config.minAtrPct) {
        console.log(`[Scanner] ${ticker}: ATR ${atrPct.toFixed(2)}% < ${config.minAtrPct}%`);
        return null;
      }
      if (config.maxAtrPct !== undefined && atrPct > config.maxAtrPct) {
        console.log(`[Scanner] ${ticker}: ATR ${atrPct.toFixed(2)}% > ${config.maxAtrPct}%`);
        return null;
      }

      // Apply trend filter
      if (config.trendDirection && config.trendDirection !== 'any') {
        const trendMatch = this.checkTrend(indicators, config.trendDirection);
        if (!trendMatch) {
          console.log(`[Scanner] ${ticker}: Trend mismatch (want ${config.trendDirection})`);
          return null;
        }
      }

      // Apply earnings proximity filter
      if (config.skipEarnings) {
        // TODO: Integrate earnings calendar API
        // For now, skip this check (would need Polygon premium subscription)
      }

      // Apply squeeze filters (Short Float + TTM Squeeze)
      if (config.minShortFloat || config.minDaysToCover || (config.ttmSqueezeState && config.ttmSqueezeState !== 'any')) {
        console.log(`[Scanner] ${ticker}: Applying squeeze filters - minShortFloat: ${config.minShortFloat}, minDaysToCover: ${config.minDaysToCover}, ttmSqueezeState: ${config.ttmSqueezeState}`);
        console.log(`[Scanner] ${ticker}: shortInterest data:`, shortInterest);
        
        const ohlcv = bars.map(b => ({
          timestamp: b.timestamp,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume,
        }));
        
        // Calculate squeeze analysis with actual short interest data
        const squeezeAnalysis = analyzeCombinedSqueeze(ohlcv, shortInterest, 5);
        console.log(`[Scanner] ${ticker}: Squeeze analysis - Short Float: ${squeezeAnalysis.shortSqueeze.shortFloat}, TTM: ${squeezeAnalysis.ttmSqueeze.current.state}`);
        
        // Apply Short Float filter
        if (config.minShortFloat && squeezeAnalysis.shortSqueeze.shortFloat !== null) {
          if (squeezeAnalysis.shortSqueeze.shortFloat < config.minShortFloat) {
            console.log(`[Scanner] ${ticker}: Short float ${squeezeAnalysis.shortSqueeze.shortFloat.toFixed(1)}% < ${config.minShortFloat}%`);
            return null;
          }
        }
        
        // Apply Days to Cover filter
        if (config.minDaysToCover && squeezeAnalysis.shortSqueeze.daysToCover !== null) {
          if (squeezeAnalysis.shortSqueeze.daysToCover < config.minDaysToCover) {
            console.log(`[Scanner] ${ticker}: Days to cover ${squeezeAnalysis.shortSqueeze.daysToCover.toFixed(1)} < ${config.minDaysToCover}`);
            return null;
          }
        }
        
        // Apply TTM Squeeze State filter
        if (config.ttmSqueezeState && config.ttmSqueezeState !== 'any') {
          const ttmState = squeezeAnalysis.ttmSqueeze.current.state;
          if (ttmState !== config.ttmSqueezeState) {
            console.log(`[Scanner] ${ticker}: TTM squeeze ${ttmState} != ${config.ttmSqueezeState}`);
            return null;
          }
        }
        
        console.log(`[Scanner] ${ticker}: Passed squeeze filters (Short: ${squeezeAnalysis.shortSqueeze.shortFloat?.toFixed(1) || 'N/A'}%, DTC: ${squeezeAnalysis.shortSqueeze.daysToCover?.toFixed(1) || 'N/A'}, TTM: ${squeezeAnalysis.ttmSqueeze.current.state})`);
      }

      // Build strategy input with pattern levels
      const strategyInput: StrategyInput = {
        symbol: ticker,
        timeframe: strategy.timeframe,
        asOf: new Date().toISOString(),
        price: currentPrice,
        bars,
        high: bars.map(b => b.high),
        low: bars.map(b => b.low),
        close: bars.map(b => b.close),
        volume: bars.map(b => b.volume),
        ema9: indicators.ema9,
        ema20: indicators.ema20,
        ema50: indicators.ema50,
        ema200: indicators.ema200,
        rsi14: indicators.rsi,
        atr: indicators.atr,
        atrPct,
        volZ: indicators.volumeZScore,
        spyRegime: 'neutral',
        spreadBps: 10,
        advUsd: (bars[bars.length - 1]?.volume || 0) * currentPrice,
        earningsDays: null,
        patternContexts: {
          triangle: null,
          flag: null,
          doubleTop: null,
          doubleBottom: null,
        },
        // Add pattern levels for expression evaluation
        patternLevels,
      };

      // Evaluate strategy
      const evaluation = evaluateUserStrategy(strategy, strategyInput);

      // Calculate squeeze analysis for all stocks (for ranking)
      const ohlcv = bars.map(b => ({
        timestamp: b.timestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      }));
      const squeezeAnalysis = analyzeCombinedSqueeze(ohlcv, shortInterest, 5);

      // Calculate match score (now includes squeeze score)
      const matchScore = this.calculateMatchScore(evaluation, strategyInput, squeezeAnalysis);

      // Extract snapshot data
      const price = snapshotData.day?.c || snapshotData.prevDay?.c || currentPrice;
      const prevClose = snapshotData.prevDay?.c || price;
      const change = price - prevClose;
      const changePercent = (change / prevClose) * 100;
      const volume = snapshotData.day?.v || snapshotData.prevDay?.v || 0;

      return {
        ticker,
        name: snapshotData.name || ticker,
        price,
        change,
        changePercent,
        volume,
        marketCap: snapshotData.marketCap,
        matchScore,
        matchDetails: {
          eligible: evaluation !== null,
          viability: evaluation?.viability,
          quality: evaluation?.quality,
          failureReason: evaluation === null
            ? this.getFailureReason(strategyInput, strategy)
            : undefined,
          passedCriteria: evaluation?.reasons || [],
          rrFirst: evaluation?.rrFirst,
        },
        indicators: {
          ema9: indicators.ema9,
          ema20: indicators.ema20,
          ema50: indicators.ema50,
          rsi14: indicators.rsi,
          atrPct,
          volZ: indicators.volumeZScore,
        },
        // Add squeeze data to scan results
        squeeze: {
          combinedScore: squeezeAnalysis.combinedScore,
          combinedPotential: squeezeAnalysis.combinedPotential,
          alignment: squeezeAnalysis.alignment,
          shortFloat: squeezeAnalysis.shortSqueeze.shortFloat,
          daysToCover: squeezeAnalysis.shortSqueeze.daysToCover,
          ttmState: squeezeAnalysis.ttmSqueeze.current.state,
          ttmDuration: squeezeAnalysis.ttmSqueeze.squeezeDuration,
        },
      };
    } catch (error) {
      console.error(`[Scanner] ${ticker}: Error -`, error);
      return null;
    }
  }

  /**
   * Check if trend matches filter
   */
  private checkTrend(indicators: any, trendDirection: TrendDirection): boolean {
    const { ema50, ema200 } = indicators;

    switch (trendDirection) {
      case 'uptrend':
        return ema50 > ema200;
      case 'downtrend':
        return ema50 < ema200;
      case 'neutral':
        return Math.abs(ema50 - ema200) / ema200 < 0.02; // Within 2%
      default:
        return true;
    }
  }

  /**
   * Calculate match score with squeeze integration
   */
  private calculateMatchScore(evaluation: any, input: StrategyInput, squeezeAnalysis?: any): number {
    if (!evaluation) return 0;

    // Base score from viability (0-100)
    let score = (evaluation.viability || 0) * 100;

    // Volume bonus
    if (input.volZ > 1.0) score += 5;

    // R:R bonus
    const rrFirst = evaluation.rrFirst || 0;
    if (rrFirst > 2.0) score += 5;

    // Squeeze score bonus (up to 15 points)
    if (squeezeAnalysis) {
      const squeezeScore = squeezeAnalysis.combinedScore || 0;
      const squeezeBonus = (squeezeScore / 100) * 15; // Max 15 points
      score += squeezeBonus;

      // Additional alignment bonus (5 points if both squeezes aligned)
      if (squeezeAnalysis.alignment) {
        score += 5;
      }

      // FIRE bonus (10 points for immediate breakout)
      if (squeezeAnalysis.ttmSqueeze?.current?.state === 'FIRE') {
        score += 10;
      }
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Get failure reason
   */
  private getFailureReason(input: StrategyInput, strategy: StrategyDsl): string {
    const { eligibility } = strategy;
    if (!eligibility) return 'No eligibility criteria';

    // Check EMA rules
    if (eligibility.emaRules && eligibility.emaRules.length > 0) {
      for (const rule of eligibility.emaRules) {
        const ema1 = this.getEmaValue(rule.ema1, input);
        const ema2 = this.getEmaValue(rule.ema2, input);
        if (ema1 && ema2) {
          const passes = this.checkComparison(ema1, rule.operator, ema2);
          if (!passes) {
            return `EMA${rule.ema1} ${rule.operator} EMA${rule.ema2}`;
          }
        }
      }
    }

    // Check RSI
    if (eligibility.rsiRange) {
      const { min, max } = eligibility.rsiRange;
      if (input.rsi14 < min || input.rsi14 > max) {
        return `RSI outside range [${min}-${max}]`;
      }
    }

    // Check volume
    if (eligibility.volumeRule) {
      const { threshold, operator } = eligibility.volumeRule;
      const passes = this.checkComparison(input.volZ, operator, threshold);
      if (!passes) {
        return `Volume ${operator} ${threshold}`;
      }
    }

    return 'Criteria not met';
  }

  private getEmaValue(period: number, input: StrategyInput): number | undefined {
    if (period === 9) return input.ema9;
    if (period === 20) return input.ema20;
    if (period === 50) return input.ema50;
    if (period === 200) return input.ema200;
    return undefined;
  }

  private checkComparison(val1: number, operator: string, val2: number): boolean {
    switch (operator) {
      case '>':
        return val1 > val2;
      case '<':
        return val1 < val2;
      case '>=':
        return val1 >= val2;
      case '<=':
        return val1 <= val2;
      case '==':
        return Math.abs(val1 - val2) < 0.01;
      default:
        return false;
    }
  }
}

