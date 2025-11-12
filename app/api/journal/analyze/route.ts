/**
 * API Route: AI Journal Analysis
 * POST /api/journal/analyze - Analyze trading patterns with AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

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
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
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

    // Analyze patterns in winning vs losing trades
    const context = buildAnalysisContext(trades, winningTrades, losingTrades);

    // Call OpenAI for pattern analysis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert trading analyst specializing in identifying patterns and improving trading strategies. 
Your goal is to analyze a trader's journal and find:
1. Common patterns in winning trades (what worked well)
2. Common patterns in losing trades (what to avoid)
3. Specific, actionable insights based on market conditions (ATR, RSI, EMA alignment)
4. Strategy recommendations to improve win rate and R multiple

Focus on:
- Market conditions: High ATR days vs low ATR
- RSI levels at entry and exit
- EMA alignment (trend strength)
- Holding period patterns
- Strategy effectiveness
- Notes and user observations

Be specific, data-driven, and actionable. Format your response in clear sections:
- **Key Patterns in Winners**
- **Key Patterns in Losers**
- **Market Context Insights**
- **Actionable Recommendations**`
          },
          {
            role: 'user',
            content: context
          }
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      console.error('[Journal Analysis] OpenAI API error:', response.statusText);
      return NextResponse.json(
        { error: 'Failed to generate AI analysis' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

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

function buildAnalysisContext(
  allTrades: any[],
  winners: any[],
  losers: any[]
): string {
  let context = `# Trading Journal Analysis\n\n`;
  
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
    
    // Sample winning trades with notes
    const winnersWithNotes = winners.filter(t => t.notes && t.notes.trim().length > 0).slice(0, 3);
    if (winnersWithNotes.length > 0) {
      context += `\n### Sample Winning Trade Notes:\n`;
      winnersWithNotes.forEach((t, i) => {
        context += `${i + 1}. ${t.ticker} ${t.direction}: +${(t.returnPct ?? 0).toFixed(2)}% - "${t.notes}"\n`;
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
    
    // Sample losing trades with notes
    const losersWithNotes = losers.filter(t => t.notes && t.notes.trim().length > 0).slice(0, 3);
    if (losersWithNotes.length > 0) {
      context += `\n### Sample Losing Trade Notes:\n`;
      losersWithNotes.forEach((t, i) => {
        context += `${i + 1}. ${t.ticker} ${t.direction}: ${(t.returnPct ?? 0).toFixed(2)}% - "${t.notes}"\n`;
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

