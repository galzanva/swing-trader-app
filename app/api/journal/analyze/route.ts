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

    // Parse optional date range from request body
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let periodLabel = 'All Time';
    try {
      const body = await request.json();
      if (body.startDate) startDate = new Date(body.startDate);
      if (body.endDate) endDate = new Date(body.endDate);
      if (body.periodLabel) periodLabel = body.periodLabel;
    } catch {
      // No body or invalid JSON — analyze all trades
    }

    console.log(`[Journal Analysis] Analyzing trades for user ${userId} (period: ${periodLabel})`);

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const trades = await prisma.tradeJournal.findMany({
      where: {
        userId,
        isOpen: false,
        returnPct: { not: null },
        ...(startDate || endDate ? { entryDate: dateFilter } : {}),
      },
      orderBy: {
        entryDate: 'desc',
      },
    });

    if (trades.length === 0) {
      return NextResponse.json(
        { error: `No closed trades found for ${periodLabel}` },
        { status: 400 }
      );
    }

    console.log(`[Journal Analysis] Analyzing ${trades.length} closed trades (${periodLabel})`);

    // Build analysis context
    const winningTrades = trades.filter(t => (t.returnPct ?? 0) > 0);
    const losingTrades = trades.filter(t => (t.returnPct ?? 0) < 0);
    
    // Detect repeated profitable setups
    const repeatableSetups = detectRepeatableSetups(trades);
    
    // Detect early exits
    const earlyExits = detectEarlyExits(trades);

    const context = buildAnalysisContext(trades, winningTrades, losingTrades, repeatableSetups, earlyExits, periodLabel);

    const result = await callLLM({
      messages: [
        {
          role: 'system',
          content: `You are an expert trading mentor writing a detailed performance review of a trader's journal. This is a WRITTEN REPORT — not a conversation. Never ask questions, never offer to do more, never say "if you want" or "I can also". Just deliver the analysis.

## YOUR TASK
Produce a thorough, data-driven performance report for the period: "${periodLabel}" (${trades.length} closed trades).

## REPORT FORMAT (use these exact sections)

**📊 Period Performance Summary**
Open with key stats: win rate, average winner vs average loser, best and worst trade, total P/L, average R-multiple. Compare longs vs shorts if both exist.

**🎯 Repeatable Setups That Worked**
Identify strategy + market condition combos that won consistently. Cite specifics: "EMA Pullback in bullish alignment won 4 of 5 times with avg +3.2% return." If sample is too small, say so explicitly.

**⚠️ Holding Discipline & Exit Analysis**
Flag trades where maxPotentialR was significantly higher than realizedR — the trader left money on the table. Name the ticker, entry/exit prices, what R was captured vs what was available, and what exit rule would have captured more.

**✅ What Worked Well**
Patterns across winning trades: which strategies, market conditions (ATR level, RSI zone, EMA alignment), holding periods, and exit reasons led to profits.

**❌ What Did Not Work**
Patterns across losing trades: common mistakes, bad conditions, premature entries, ignored signals. Be specific — cite tickers and numbers.

**📈 Market Condition Insights**
Analyze how ATR levels, RSI zones at entry, and EMA alignment correlated with outcomes. Example: "Entries with RSI 40-60 and bullish EMA alignment had 78% win rate vs 33% when RSI > 70."

**💡 Specific Improvements**
Concrete, numbered action items. Each must be testable:
  1. "[Action] because [evidence from this data]. Confidence: High/Medium/Low."
  2. ...

## CRITICAL RULES
- Use ONLY the data provided. Never invent trades or numbers.
- Entry/exit prices: use the EXACT "$XX.XX" values shown in each trade.
- Do NOT confuse stop loss / take profit TARGETS with actual entry/exit prices.
- Be a mentor: direct, honest, specific. Praise what deserves praise, critique what needs it.
- Every claim must cite actual trade data (ticker, prices, dates, R-multiples).
- End with the Improvements section. Do NOT add any follow-up offers, questions, or "let me know if you want" text. The report is complete after Improvements.
- Confidence legend at the end: "Confidence: High = strong pattern in data (5+ trades); Medium = reasonable signal (3-4 trades); Low = limited sample (1-2 trades)."
- Max token budget is generous — use it for depth, not filler.`
        },
        {
          role: 'user',
          content: context
        }
      ],
      temperature: 0.7,
      maxTokens: 2500,
    });

    const analysis = result.content;

    console.log(`[Journal Analysis] Generated AI analysis successfully`);

    return NextResponse.json({
      success: true,
      analysis,
      tradesAnalyzed: trades.length,
      periodLabel,
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
  earlyExits: any[],
  periodLabel: string = 'All Time'
): string {
  let context = `# Trading Journal Analysis — ${periodLabel}\n\n`;
  
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
  context += `Write the performance report for the "${periodLabel}" period using ONLY the ${allTrades.length} trades above. Cite specific tickers, prices, and R-multiples. End with actionable improvements — do NOT ask follow-up questions or offer additional services.`;

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

