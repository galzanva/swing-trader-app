/**
 * API Route: AI Journal Analysis
 * POST /api/journal/analyze - Analyze trading patterns with AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { callLLM } from '@/lib/llm/client';
import { isLLMConfigured } from '@/lib/llm/config';

export async function POST(request: NextRequest) {
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

    if (!isLLMConfigured()) {
      return NextResponse.json(
        { error: 'LLM API key not configured' },
        { status: 500 }
      );
    }

    console.log(`[Journal Analysis] Analyzing trades for user ${userId}`);

    // Fetch all closed trades with enriched data for analysis
    const trades = await prisma.tradeJournal.findMany({
      where: {
        userId,
        isOpen: false,
        returnPct: { not: null },
      },
      orderBy: {
        entryDate: 'desc',
      },
    });

    if (trades.length === 0) {
      return NextResponse.json(
        { error: 'No closed trades found for analysis' },
        { status: 400 }
      );
    }

    console.log(`[Journal Analysis] Analyzing ${trades.length} closed trades`);

    // Build analysis context
    const winningTrades = trades.filter(t => (t.returnPct ?? 0) > 0);
    const losingTrades = trades.filter(t => (t.returnPct ?? 0) < 0);
    
    // Detect repeated profitable setups
    const repeatableSetups = detectRepeatableSetups(trades);
    
    // Detect early exits
    const earlyExits = detectEarlyExits(trades);

    // Analyze patterns in winning vs losing trades
    const context = buildAnalysisContext(trades, winningTrades, losingTrades, repeatableSetups, earlyExits);

    const result = await callLLM({
      messages: [
        {
          role: 'system',
          content: `You are an expert trading analyst specializing in identifying patterns and improving trading strategies. 
Your goal is to analyze a trader's journal and find:
1. **Repeated Profitable Setups** - Identify setups that have worked multiple times
2. **Early Exit Issues** - Flag trades where the user exited too early and left gains on the table
3. Common patterns in winning trades (what worked well)
4. Common patterns in losing trades (what to avoid)
5. Specific, actionable insights based on market conditions (ATR, RSI, EMA alignment)

🚨 CRITICAL: USE ONLY THE DATA PROVIDED 🚨
- Each trade shows "Entry: $XX.XX" and "Exit: $XX.XX" - use THESE prices ONLY
- Do NOT infer prices from notes or other fields
- Do NOT confuse stop loss/take profit targets with actual entry/exit prices
- When referencing a trade, cite the EXACT entry and exit prices shown in the data

Focus on:
- Repeatable setups with high success rates (format: "This setup has worked X of the last Y times")
- Early exits where maxPotential R was much higher than realized R
- Market conditions: High ATR days vs low ATR
- RSI levels at entry and exit
- EMA alignment (trend strength)
- Exit reasons and holding discipline
- Strategy effectiveness

Be specific, data-driven, and actionable. Use beginner-friendly language with confidence indicators.
Format your response in clear sections:
- **🎯 Repeat These Setups** (high-confidence patterns to prioritize)
- **⚠️ Holding Discipline Issues** (early exits that left money on table)
- **✅ Key Patterns in Winners**
- **❌ Key Patterns in Losers**
- **📊 Market Context Insights**
- **💡 Actionable Recommendations** (with confidence levels: High/Medium/Low)`
        },
        {
          role: 'user',
          content: context
        }
      ],
      temperature: 0.7,
      maxTokens: 1200,
    });

    const analysis = result.content;

    console.log(`[Journal Analysis] Generated AI analysis successfully`);

    return NextResponse.json({
      success: true,
      analysis,
      tradesAnalyzed: trades.length,
      summary: {
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: trades.length > 0 ? ((winningTrades.length / trades.length) * 100).toFixed(1) : '0',
        avgReturn: (trades.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / trades.length).toFixed(2),
        totalPL: trades.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0).toFixed(2),
      },
    });

  } catch (error: any) {
    console.error('[Journal Analysis] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

function detectRepeatableSetups(trades: any[]): Array<{
  strategy: string;
  conditions: string;
  winCount: number;
  totalCount: number;
  winRate: number;
  avgReturn: number;
  confidence: 'High' | 'Medium' | 'Low';
}> {
  const setups: Map<string, any[]> = new Map();
  
  // Group trades by strategy and similar conditions
  for (const trade of trades) {
    if (!trade.strategy || trade.strategy === 'Other') continue;
    
    // Create condition signature based on indicators
    const rsiZone = trade.entryRSI 
      ? trade.entryRSI < 30 ? 'oversold' : trade.entryRSI > 70 ? 'overbought' : 'neutral'
      : 'unknown';
    
    const emaAlignment = trade.entryEMA9 && trade.entryEMA20 && trade.entryEMA50
      ? trade.entryEMA9 > trade.entryEMA20 && trade.entryEMA20 > trade.entryEMA50 
        ? 'bullish' 
        : trade.entryEMA9 < trade.entryEMA20 && trade.entryEMA20 < trade.entryEMA50
          ? 'bearish'
          : 'mixed'
      : 'unknown';
    
    const atrLevel = trade.entryATR && trade.entryPrice
      ? (trade.entryATR / trade.entryPrice * 100) < 1.5 ? 'low' : 
        (trade.entryATR / trade.entryPrice * 100) > 2.5 ? 'high' : 'medium'
      : 'unknown';
    
    const key = `${trade.strategy}|${rsiZone}|${emaAlignment}|${atrLevel}`;
    const setupTrades = setups.get(key) || [];
    setupTrades.push(trade);
    setups.set(key, setupTrades);
  }
  
  // Analyze each setup
  const results: any[] = [];
  
  for (const [key, setupTrades] of setups.entries()) {
    const [strategy, rsiZone, emaAlignment, atrLevel] = key.split('|');
    const winCount = setupTrades.filter(t => (t.returnPct ?? 0) > 0).length;
    const totalCount = setupTrades.length;
    const winRate = (winCount / totalCount) * 100;
    const avgReturn = setupTrades.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / totalCount;
    
    // Only include setups with at least 3 occurrences and >60% win rate
    if (totalCount >= 3 && winRate >= 60) {
      let confidence: 'High' | 'Medium' | 'Low' = 'Low';
      
      if (totalCount >= 5 && winRate >= 75) confidence = 'High';
      else if (totalCount >= 4 && winRate >= 65) confidence = 'Medium';
      
      const conditions = [
        emaAlignment !== 'unknown' && `EMA ${emaAlignment}`,
        rsiZone !== 'unknown' && rsiZone !== 'neutral' && `RSI ${rsiZone}`,
        atrLevel !== 'unknown' && `ATR ${atrLevel}`,
      ].filter(Boolean).join(', ');
      
      results.push({
        strategy,
        conditions: conditions || 'Standard conditions',
        winCount,
        totalCount,
        winRate: parseFloat(winRate.toFixed(1)),
        avgReturn: parseFloat(avgReturn.toFixed(2)),
        confidence,
      });
    }
  }
  
  // Sort by confidence and win rate
  return results.sort((a, b) => {
    const confScore: Record<'High' | 'Medium' | 'Low', number> = { High: 3, Medium: 2, Low: 1 };
    const aScore = confScore[a.confidence as 'High' | 'Medium' | 'Low'];
    const bScore = confScore[b.confidence as 'High' | 'Medium' | 'Low'];
    if (aScore !== bScore) {
      return bScore - aScore;
    }
    return b.winRate - a.winRate;
  });
}

function detectEarlyExits(trades: any[]): Array<{
  ticker: string;
  entryDate: string;
  entryPrice: number;
  exitPrice: number;
  direction: string;
  realizedR: number;
  maxPotentialR: number;
  leftOnTable: number;
  exitReason: string | null;
}> {
  const earlyExits: any[] = [];
  
  for (const trade of trades) {
    if (trade.isOpen) continue;
    if (!trade.rMultiple || !trade.maxPotentialR) continue;
    
    const realizedR = trade.rMultiple;
    const maxPotentialR = trade.maxPotentialR;
    
    // Flag if exited before 1R when trade went to 2R+
    if (realizedR < 1 && maxPotentialR >= 2) {
      earlyExits.push({
        ticker: trade.ticker,
        entryDate: new Date(trade.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        direction: trade.direction,
        realizedR: parseFloat(realizedR.toFixed(2)),
        maxPotentialR: parseFloat(maxPotentialR.toFixed(2)),
        leftOnTable: parseFloat((maxPotentialR - realizedR).toFixed(2)),
        exitReason: trade.exitReason,
      });
    }
    // Also flag if exited at break-even or small win when much more was available
    else if (realizedR < 1.5 && maxPotentialR >= 3) {
      earlyExits.push({
        ticker: trade.ticker,
        entryDate: new Date(trade.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        direction: trade.direction,
        realizedR: parseFloat(realizedR.toFixed(2)),
        maxPotentialR: parseFloat(maxPotentialR.toFixed(2)),
        leftOnTable: parseFloat((maxPotentialR - realizedR).toFixed(2)),
        exitReason: trade.exitReason,
      });
    }
  }
  
  return earlyExits;
}

function buildAnalysisContext(
  allTrades: any[],
  winners: any[],
  losers: any[],
  repeatableSetups: any[],
  earlyExits: any[]
): string {
  let context = `# Trading Journal Analysis\n\n`;
  
  // Repeatable setups section
  if (repeatableSetups.length > 0) {
    context += `## 🎯 REPEATABLE SETUPS (Prioritize These!)\n\n`;
    context += `Found ${repeatableSetups.length} high-performing setup(s) with consistent results:\n\n`;
    
    repeatableSetups.forEach((setup, i) => {
      context += `### ${i + 1}. ${setup.strategy} - ${setup.conditions}\n`;
      context += `- **Performance**: ${setup.winCount} wins out of ${setup.totalCount} trades (${setup.winRate}% win rate)\n`;
      context += `- **Avg Return**: ${setup.avgReturn > 0 ? '+' : ''}${setup.avgReturn}%\n`;
      context += `- **Confidence**: ${setup.confidence} (based on sample size and consistency)\n`;
      context += `- **Recommendation**: ${setup.confidence === 'High' 
        ? '✅ This setup has proven itself—consider prioritizing it in your trading!' 
        : setup.confidence === 'Medium'
          ? '⚠️ Promising pattern, keep executing and tracking it.'
          : '💡 Early signal, needs more data to confirm.'}\n\n`;
    });
  }
  
  // Early exit section
  if (earlyExits.length > 0) {
    context += `## ⚠️ HOLDING DISCIPLINE ISSUES (Early Exits)\n\n`;
    context += `Identified ${earlyExits.length} trade(s) where you exited too early and left significant gains on the table:\n\n`;
    
    earlyExits.slice(0, 5).forEach((exit, i) => {
      context += `${i + 1}. **${exit.ticker}** (${exit.direction}, ${exit.entryDate})\n`;
      context += `   - Entry: $${exit.entryPrice.toFixed(2)}\n`;
      context += `   - Exit: $${exit.exitPrice.toFixed(2)}\n`;
      context += `   - Realized R: ${exit.realizedR}R\n`;
      context += `   - Max Potential R: ${exit.maxPotentialR}R\n`;
      context += `   - Left on table: ${exit.leftOnTable}R\n`;
      context += `   - Exit reason: ${exit.exitReason || 'Not specified'}\n\n`;
    });
    
    if (earlyExits.length > 5) {
      context += `... and ${earlyExits.length - 5} more early exits.\n\n`;
    }
    
    context += `**Key Insight**: Consider setting wider targets or using trailing stops to capture more of the move when trades work in your favor.\n\n`;
  }
  
  // Overall stats
  const winRate = allTrades.length > 0 ? ((winners.length / allTrades.length) * 100).toFixed(1) : '0';
  const avgReturn = (allTrades.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / allTrades.length).toFixed(2);
  const totalPL = allTrades.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0).toFixed(2);
  
  context += `## Overall Performance\n`;
  context += `- Total Trades: ${allTrades.length}\n`;
  context += `- Win Rate: ${winRate}%\n`;
  context += `- Winning Trades: ${winners.length}\n`;
  context += `- Losing Trades: ${losers.length}\n`;
  context += `- Average Return: ${avgReturn}%\n`;
  context += `- Total P/L: $${totalPL}\n\n`;

  // Analyze winning trades
  if (winners.length > 0) {
    context += `## Winning Trades (${winners.length} trades)\n\n`;
    
    const avgWinReturn = (winners.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / winners.length).toFixed(2);
    const avgWinDays = winners.filter(t => t.holdingDays).length > 0
      ? (winners.filter(t => t.holdingDays).reduce((sum, t) => sum + (t.holdingDays ?? 0), 0) / winners.filter(t => t.holdingDays).length).toFixed(1)
      : 'N/A';
    const avgWinR = winners.filter(t => t.rMultiple).length > 0
      ? (winners.filter(t => t.rMultiple).reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / winners.filter(t => t.rMultiple).length).toFixed(2)
      : 'N/A';
    
    context += `- Average Return: ${avgWinReturn}%\n`;
    context += `- Average Holding Period: ${avgWinDays} days\n`;
    context += `- Average R Multiple: ${avgWinR}\n`;
    
    // Market conditions in winners
    const winnersWithATR = winners.filter(t => t.entryATR);
    if (winnersWithATR.length > 0) {
      const avgATR = (winnersWithATR.reduce((sum, t) => sum + (t.entryATR ?? 0), 0) / winnersWithATR.length).toFixed(2);
      const avgATRPct = (winnersWithATR.reduce((sum, t) => sum + ((t.entryATR ?? 0) / t.entryPrice * 100), 0) / winnersWithATR.length).toFixed(2);
      context += `- Average Entry ATR: ${avgATR} (${avgATRPct}% of price)\n`;
    }
    
    const winnersWithRSI = winners.filter(t => t.entryRSI);
    if (winnersWithRSI.length > 0) {
      const avgRSI = (winnersWithRSI.reduce((sum, t) => sum + (t.entryRSI ?? 0), 0) / winnersWithRSI.length).toFixed(1);
      context += `- Average Entry RSI: ${avgRSI}\n`;
    }
    
    // Strategy breakdown
    const strategyStats = getStrategyBreakdown(winners);
    if (strategyStats.length > 0) {
      context += `\n### Winning Strategies:\n`;
      strategyStats.forEach(s => {
        context += `- ${s.strategy || 'No Strategy'}: ${s.count} trades, ${s.avgReturn}% avg return\n`;
      });
    }
    
    // Sample winning trades with full details
    const sampleWinners = winners.slice(0, 5);
    if (sampleWinners.length > 0) {
      context += `\n### Sample Winning Trades (with prices and context):\n`;
      sampleWinners.forEach((t, i) => {
        const entryDateStr = new Date(t.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const exitDateStr = t.exitDate ? new Date(t.exitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Open';
        context += `${i + 1}. **${t.ticker}** ${t.direction.toUpperCase()}\n`;
        context += `   - Entry: $${t.entryPrice.toFixed(2)} on ${entryDateStr}\n`;
        context += `   - Exit: $${t.exitPrice ? t.exitPrice.toFixed(2) : 'N/A'} on ${exitDateStr}\n`;
        context += `   - Return: +${(t.returnPct ?? 0).toFixed(2)}%\n`;
        context += `   - R Multiple: ${t.rMultiple ? t.rMultiple.toFixed(2) + 'R' : 'N/A'}\n`;
        if (t.holdingDays) context += `   - Held: ${t.holdingDays} days\n`;
        if (t.strategy) context += `   - Strategy: ${t.strategy}\n`;
        if (t.exitReason) context += `   - Exit Reason: ${t.exitReason}\n`;
        if (t.notes && t.notes.trim().length > 0) context += `   - Notes: "${t.notes}"\n`;
        context += `\n`;
      });
    }
    
    context += `\n`;
  }

  // Analyze losing trades
  if (losers.length > 0) {
    context += `## Losing Trades (${losers.length} trades)\n\n`;
    
    const avgLossReturn = (losers.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / losers.length).toFixed(2);
    const avgLossDays = losers.filter(t => t.holdingDays).length > 0
      ? (losers.filter(t => t.holdingDays).reduce((sum, t) => sum + (t.holdingDays ?? 0), 0) / losers.filter(t => t.holdingDays).length).toFixed(1)
      : 'N/A';
    const avgLossR = losers.filter(t => t.rMultiple).length > 0
      ? (losers.filter(t => t.rMultiple).reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / losers.filter(t => t.rMultiple).length).toFixed(2)
      : 'N/A';
    
    context += `- Average Return: ${avgLossReturn}%\n`;
    context += `- Average Holding Period: ${avgLossDays} days\n`;
    context += `- Average R Multiple: ${avgLossR}\n`;
    
    // Market conditions in losers
    const losersWithATR = losers.filter(t => t.entryATR);
    if (losersWithATR.length > 0) {
      const avgATR = (losersWithATR.reduce((sum, t) => sum + (t.entryATR ?? 0), 0) / losersWithATR.length).toFixed(2);
      const avgATRPct = (losersWithATR.reduce((sum, t) => sum + ((t.entryATR ?? 0) / t.entryPrice * 100), 0) / losersWithATR.length).toFixed(2);
      context += `- Average Entry ATR: ${avgATR} (${avgATRPct}% of price)\n`;
    }
    
    const losersWithRSI = losers.filter(t => t.entryRSI);
    if (losersWithRSI.length > 0) {
      const avgRSI = (losersWithRSI.reduce((sum, t) => sum + (t.entryRSI ?? 0), 0) / losersWithRSI.length).toFixed(1);
      context += `- Average Entry RSI: ${avgRSI}\n`;
    }
    
    // Strategy breakdown
    const strategyStats = getStrategyBreakdown(losers);
    if (strategyStats.length > 0) {
      context += `\n### Losing Strategies:\n`;
      strategyStats.forEach(s => {
        context += `- ${s.strategy || 'No Strategy'}: ${s.count} trades, ${s.avgReturn}% avg return\n`;
      });
    }
    
    // Sample losing trades with full details
    const sampleLosers = losers.slice(0, 5);
    if (sampleLosers.length > 0) {
      context += `\n### Sample Losing Trades (with prices and context):\n`;
      sampleLosers.forEach((t, i) => {
        const entryDateStr = new Date(t.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const exitDateStr = t.exitDate ? new Date(t.exitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Open';
        context += `${i + 1}. **${t.ticker}** ${t.direction.toUpperCase()}\n`;
        context += `   - Entry: $${t.entryPrice.toFixed(2)} on ${entryDateStr}\n`;
        context += `   - Exit: $${t.exitPrice ? t.exitPrice.toFixed(2) : 'N/A'} on ${exitDateStr}\n`;
        context += `   - Return: ${(t.returnPct ?? 0).toFixed(2)}%\n`;
        context += `   - R Multiple: ${t.rMultiple ? t.rMultiple.toFixed(2) + 'R' : 'N/A'}\n`;
        if (t.holdingDays) context += `   - Held: ${t.holdingDays} days\n`;
        if (t.strategy) context += `   - Strategy: ${t.strategy}\n`;
        if (t.exitReason) context += `   - Exit Reason: ${t.exitReason}\n`;
        if (t.notes && t.notes.trim().length > 0) context += `   - Notes: "${t.notes}"\n`;
        context += `\n`;
      });
    }
    
    context += `\n`;
  }

  // Direction analysis
  const longTrades = allTrades.filter(t => t.direction === 'long');
  const shortTrades = allTrades.filter(t => t.direction === 'short');
  
  if (longTrades.length > 0 && shortTrades.length > 0) {
    context += `## Direction Analysis\n\n`;
    const longWinRate = ((longTrades.filter(t => (t.returnPct ?? 0) > 0).length / longTrades.length) * 100).toFixed(1);
    const shortWinRate = ((shortTrades.filter(t => (t.returnPct ?? 0) > 0).length / shortTrades.length) * 100).toFixed(1);
    const longAvgReturn = (longTrades.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / longTrades.length).toFixed(2);
    const shortAvgReturn = (shortTrades.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / shortTrades.length).toFixed(2);
    
    context += `### Long Trades (${longTrades.length} trades)\n`;
    context += `- Win Rate: ${longWinRate}%\n`;
    context += `- Average Return: ${longAvgReturn}%\n\n`;
    
    context += `### Short Trades (${shortTrades.length} trades)\n`;
    context += `- Win Rate: ${shortWinRate}%\n`;
    context += `- Average Return: ${shortAvgReturn}%\n\n`;
  }

  context += `\n## Instructions\n`;
  context += `Based on the data above, identify specific patterns and provide actionable insights to help improve trading performance. Focus on market conditions (ATR, RSI, EMA), strategy effectiveness, and holding period patterns.`;

  return context;
}

function getStrategyBreakdown(trades: any[]): Array<{ strategy: string; count: number; avgReturn: string }> {
  const strategyMap = new Map<string, { count: number; totalReturn: number }>();
  
  trades.forEach(t => {
    const strategy = t.strategy || 'No Strategy';
    const existing = strategyMap.get(strategy) || { count: 0, totalReturn: 0 };
    strategyMap.set(strategy, {
      count: existing.count + 1,
      totalReturn: existing.totalReturn + (t.returnPct ?? 0),
    });
  });
  
  return Array.from(strategyMap.entries())
    .map(([strategy, data]) => ({
      strategy,
      count: data.count,
      avgReturn: (data.totalReturn / data.count).toFixed(2),
    }))
    .sort((a, b) => b.count - a.count);
}

