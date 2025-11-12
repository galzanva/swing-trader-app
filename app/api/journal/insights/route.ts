/**
 * API Route: Trading Journal Insights for Strategy Builder
 * GET /api/journal/insights - Get actionable insights for strategy building
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

interface StrategyInsight {
  strategy: string;
  totalTrades: number;
  winRate: number;
  avgReturn: number;
  avgRMultiple: number | null;
  bestConditions: string[];
  hints: string[];
  confidence: 'High' | 'Medium' | 'Low';
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const strategyName = searchParams.get('strategy'); // Optional: filter by strategy

    console.log(`[Journal Insights] Fetching insights for user ${userId}, strategy: ${strategyName || 'all'}`);

    // Fetch all closed trades
    const where: any = {
      userId,
      isOpen: false,
      returnPct: { not: null },
    };
    
    if (strategyName) {
      where.strategy = strategyName;
    }

    const trades = await prisma.tradeJournal.findMany({
      where,
      orderBy: {
        entryDate: 'desc',
      },
    });

    if (trades.length === 0) {
      return NextResponse.json({
        success: true,
        insights: [],
        globalHints: ['Start tracking your trades to unlock personalized strategy insights!'],
      });
    }

    console.log(`[Journal Insights] Analyzing ${trades.length} closed trades`);

    // Group by strategy and generate insights
    const strategyMap = new Map<string, any[]>();
    
    for (const trade of trades) {
      const strategy = trade.strategy || 'Untagged';
      const strategyTrades = strategyMap.get(strategy) || [];
      strategyTrades.push(trade);
      strategyMap.set(strategy, strategyTrades);
    }

    const insights: StrategyInsight[] = [];

    for (const [strategy, strategyTrades] of strategyMap.entries()) {
      const winners = strategyTrades.filter(t => (t.returnPct ?? 0) > 0);
      const winRate = (winners.length / strategyTrades.length) * 100;
      const avgReturn = strategyTrades.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / strategyTrades.length;
      
      const tradesWithR = strategyTrades.filter(t => t.rMultiple !== null);
      const avgRMultiple = tradesWithR.length > 0
        ? tradesWithR.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / tradesWithR.length
        : null;

      // Analyze conditions
      const bestConditions = analyzeBestConditions(strategyTrades, winners);
      
      // Generate hints
      const hints = generateHints(strategyTrades, winners);
      
      // Determine confidence
      let confidence: 'High' | 'Medium' | 'Low' = 'Low';
      if (strategyTrades.length >= 10) confidence = 'High';
      else if (strategyTrades.length >= 5) confidence = 'Medium';

      insights.push({
        strategy,
        totalTrades: strategyTrades.length,
        winRate: parseFloat(winRate.toFixed(1)),
        avgReturn: parseFloat(avgReturn.toFixed(2)),
        avgRMultiple: avgRMultiple !== null ? parseFloat(avgRMultiple.toFixed(2)) : null,
        bestConditions,
        hints,
        confidence,
      });
    }

    // Sort by total trades and win rate
    insights.sort((a, b) => {
      if (a.totalTrades !== b.totalTrades) {
        return b.totalTrades - a.totalTrades;
      }
      return b.winRate - a.winRate;
    });

    // Generate global hints
    const globalHints = generateGlobalHints(trades);

    return NextResponse.json({
      success: true,
      insights,
      globalHints,
      totalTradesAnalyzed: trades.length,
    });

  } catch (error: any) {
    console.error('[Journal Insights] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

function analyzeBestConditions(allTrades: any[], winners: any[]): string[] {
  const conditions: string[] = [];
  
  // Analyze ATR levels
  const winnersWithATR = winners.filter(t => t.entryATR && t.entryPrice);
  const losersWithATR = allTrades.filter(t => (t.returnPct ?? 0) <= 0 && t.entryATR && t.entryPrice);
  
  if (winnersWithATR.length >= 3) {
    const winnerAvgATRPct = winnersWithATR.reduce((sum, t) => sum + (t.entryATR / t.entryPrice * 100), 0) / winnersWithATR.length;
    const loserAvgATRPct = losersWithATR.length > 0
      ? losersWithATR.reduce((sum, t) => sum + (t.entryATR / t.entryPrice * 100), 0) / losersWithATR.length
      : 999;
    
    if (winnerAvgATRPct < 1.8 && winnerAvgATRPct < loserAvgATRPct - 0.3) {
      conditions.push(`ATR below ${winnerAvgATRPct.toFixed(1)}%`);
    } else if (winnerAvgATRPct > 2.2 && winnerAvgATRPct > loserAvgATRPct + 0.3) {
      conditions.push(`ATR above ${winnerAvgATRPct.toFixed(1)}%`);
    }
  }
  
  // Analyze RSI zones
  const winnersWithRSI = winners.filter(t => t.entryRSI);
  if (winnersWithRSI.length >= 3) {
    const avgRSI = winnersWithRSI.reduce((sum, t) => sum + t.entryRSI, 0) / winnersWithRSI.length;
    
    if (avgRSI < 35) {
      conditions.push('RSI in oversold zone (<35)');
    } else if (avgRSI > 65) {
      conditions.push('RSI in overbought zone (>65)');
    } else if (avgRSI >= 45 && avgRSI <= 55) {
      conditions.push('RSI near neutral (45-55)');
    }
  }
  
  // Analyze EMA alignment
  const winnersWithEMA = winners.filter(t => t.entryEMA9 && t.entryEMA20 && t.entryEMA50);
  if (winnersWithEMA.length >= 3) {
    const bullishCount = winnersWithEMA.filter(t => 
      t.entryEMA9 > t.entryEMA20 && t.entryEMA20 > t.entryEMA50
    ).length;
    
    const bearishCount = winnersWithEMA.filter(t => 
      t.entryEMA9 < t.entryEMA20 && t.entryEMA20 < t.entryEMA50
    ).length;
    
    if (bullishCount / winnersWithEMA.length > 0.7) {
      conditions.push('Strong bullish EMA alignment');
    } else if (bearishCount / winnersWithEMA.length > 0.7) {
      conditions.push('Strong bearish EMA alignment');
    }
  }
  
  return conditions;
}

function generateHints(allTrades: any[], winners: any[]): string[] {
  const hints: string[] = [];
  
  // Check for early exits
  const earlyExits = allTrades.filter(t => 
    t.rMultiple !== null && 
    t.maxPotentialR !== null && 
    t.rMultiple < 1 && 
    t.maxPotentialR >= 2
  );
  
  if (earlyExits.length >= 2) {
    hints.push('💡 Consider wider targets—most early exits left gains on the table');
  }
  
  // Check win rate vs R multiple
  const winRate = (winners.length / allTrades.length) * 100;
  const tradesWithR = allTrades.filter(t => t.rMultiple !== null);
  const avgR = tradesWithR.length > 0
    ? tradesWithR.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / tradesWithR.length
    : null;
  
  if (winRate > 60 && avgR !== null && avgR < 1.2) {
    hints.push('✅ High win rate! Consider letting winners run longer for better R multiples');
  } else if (winRate < 45 && avgR !== null && avgR > 1.8) {
    hints.push('⚠️ Good R multiples but lower win rate. Consider tighter entry criteria');
  }
  
  // Check holding period
  const tradesWithDays = allTrades.filter(t => t.holdingDays !== null);
  if (tradesWithDays.length >= 3) {
    const avgDays = tradesWithDays.reduce((sum, t) => sum + (t.holdingDays ?? 0), 0) / tradesWithDays.length;
    const winnerAvgDays = winners.filter(t => t.holdingDays !== null).length > 0
      ? winners.filter(t => t.holdingDays !== null).reduce((sum, t) => sum + (t.holdingDays ?? 0), 0) / winners.filter(t => t.holdingDays !== null).length
      : 0;
    
    if (winnerAvgDays > avgDays * 1.5) {
      hints.push(`📊 Winners typically need ${winnerAvgDays.toFixed(0)} days to develop—be patient`);
    }
  }
  
  // Check exit reasons
  const manualExits = allTrades.filter(t => t.exitReason === 'manual_exit');
  const targetHits = allTrades.filter(t => t.exitReason === 'hit_target');
  
  if (manualExits.length > targetHits.length && manualExits.length >= 3) {
    hints.push('⚠️ Many manual exits—consider setting clear targets and stops upfront');
  }
  
  return hints;
}

function generateGlobalHints(allTrades: any[]): string[] {
  const hints: string[] = [];
  
  const winners = allTrades.filter(t => (t.returnPct ?? 0) > 0);
  const winRate = (winners.length / allTrades.length) * 100;
  
  // Overall performance hints
  if (winRate >= 60) {
    hints.push('🎯 Strong performance! Keep executing your best setups consistently');
  } else if (winRate >= 45) {
    hints.push('📈 Solid win rate. Focus on letting winners run to improve R multiples');
  } else {
    hints.push('💡 Win rate needs work. Review your entry criteria and wait for higher-probability setups');
  }
  
  // Sample size hint
  if (allTrades.length < 20) {
    hints.push(`📊 Track ${20 - allTrades.length} more trades to unlock more accurate pattern insights`);
  }
  
  // Strategy diversification
  const strategiesUsed = new Set(allTrades.map(t => t.strategy).filter(Boolean));
  if (strategiesUsed.size === 1) {
    hints.push('💡 Consider testing additional strategies to find what works best for you');
  }
  
  return hints;
}

