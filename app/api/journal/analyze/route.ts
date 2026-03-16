/**
 * API Route: AI Journal Analysis
 * POST /api/journal/analyze - Run analysis (does NOT auto-save)
 * GET  /api/journal/analyze - List saved analyses
 * PUT  /api/journal/analyze - Save an analysis
 * DELETE /api/journal/analyze - Delete a saved analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { callLLM } from '@/lib/llm/client';
import { isLLMConfigured } from '@/lib/llm/config';

// GET: list saved analyses
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const analyses = await prisma.journalAnalysis.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ success: true, analyses });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// PUT: save an analysis
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const saved = await prisma.journalAnalysis.create({
      data: {
        userId: session.user.id,
        periodLabel: body.periodLabel || 'Unknown',
        typeFilter: body.typeFilter ?? null,
        tradesAnalyzed: body.tradesAnalyzed || 0,
        intradayCount: body.intradayCount || 0,
        swingCount: body.swingCount || 0,
        winRate: body.winRate ?? null,
        totalPL: body.totalPL ?? null,
        analysis: body.analysis || '',
      },
    });
    return NextResponse.json({ success: true, id: saved.id });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// DELETE: remove a saved analysis
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await prisma.journalAnalysis.deleteMany({ where: { id, userId: session.user.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// POST: run analysis (does NOT save — user decides)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    if (!isLLMConfigured()) {
      return NextResponse.json({ error: 'LLM API key not configured' }, { status: 500 });
    }

    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let periodLabel = 'All Time';
    let typeFilter: 'all' | 'intraday' | 'swing' = 'all';
    try {
      const body = await request.json();
      if (body.startDate) startDate = new Date(body.startDate);
      if (body.endDate) endDate = new Date(body.endDate);
      if (body.periodLabel) periodLabel = body.periodLabel;
      if (body.typeFilter) typeFilter = body.typeFilter;
    } catch { /* */ }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const allTrades = await prisma.tradeJournal.findMany({
      where: {
        userId,
        isOpen: false,
        returnPct: { not: null },
        ...(startDate || endDate ? { entryDate: dateFilter } : {}),
      },
      orderBy: { entryDate: 'desc' },
    });

    // Apply type filter — tradeType is authoritative; use holdingDays only for legacy (null) records
    const trades = typeFilter === 'all' ? allTrades : allTrades.filter(t => {
      const isIntraday = t.tradeType === 'intraday' || (t.tradeType !== 'swing' && (t.holdingDays ?? -1) === 0);
      return typeFilter === 'intraday' ? isIntraday : !isIntraday;
    });

    if (trades.length === 0) {
      const typeLabel = typeFilter === 'all' ? '' : ` (${typeFilter})`;
      return NextResponse.json({ error: `No closed${typeLabel} trades found for ${periodLabel}` }, { status: 400 });
    }

    const intradayTrades = trades.filter(t => t.tradeType === 'intraday' || t.holdingDays === 0);
    const swingTrades = trades.filter(t => t.tradeType !== 'intraday' && (t.holdingDays ?? 1) > 0);
    const winners = trades.filter(t => (t.returnPct ?? 0) > 0);
    const losers = trades.filter(t => (t.returnPct ?? 0) < 0);
    const repeatableSetups = detectRepeatableSetups(trades);
    const earlyExits = detectEarlyExits(trades);

    // Find the most recent saved analysis that matches this type filter (for progress vs prior)
    const priorWhere: any = { userId };
    if (typeFilter === 'intraday') {
      priorWhere.OR = [
        { typeFilter: 'intraday' },
        { swingCount: 0, intradayCount: { gt: 0 } },
      ];
    } else if (typeFilter === 'swing') {
      priorWhere.OR = [
        { typeFilter: 'swing' },
        { intradayCount: 0, swingCount: { gt: 0 } },
      ];
    }
    const priorAnalysis = await prisma.journalAnalysis.findFirst({
      where: priorWhere,
      orderBy: { createdAt: 'desc' },
      select: { periodLabel: true, typeFilter: true, createdAt: true, analysis: true, tradesAnalyzed: true, winRate: true, totalPL: true },
    });

    const context = buildAnalysisContext(trades, winners, losers, intradayTrades, swingTrades, repeatableSetups, earlyExits, periodLabel, priorAnalysis);

    const typeLabel = typeFilter === 'intraday' ? 'intraday/day trading' : typeFilter === 'swing' ? 'swing trading' : (
      intradayTrades.length > 0 && swingTrades.length > 0
        ? `mixed (${intradayTrades.length} intraday, ${swingTrades.length} swing)`
        : intradayTrades.length > 0 ? 'intraday/day trading' : 'swing trading'
    );

    const result = await callLLM({
      messages: [
        { role: 'system', content: buildSystemPrompt(periodLabel, trades.length, typeLabel, !!priorAnalysis) },
        { role: 'user', content: context },
      ],
      temperature: 0.6,
      maxTokens: 3000,
    });

    const analysis = result.content;
    const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;
    const totalPL = trades.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0);

    return NextResponse.json({
      success: true,
      analysis,
      tradesAnalyzed: trades.length,
      periodLabel,
      typeFilter,
      summary: {
        totalTrades: trades.length,
        intradayTrades: intradayTrades.length,
        swingTrades: swingTrades.length,
        winningTrades: winners.length,
        losingTrades: losers.length,
        winRate: parseFloat(winRate.toFixed(1)),
        totalPL: parseFloat(totalPL.toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error('[Journal Analysis] Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

function buildSystemPrompt(periodLabel: string, tradeCount: number, composition: string, hasPrior: boolean): string {
  return `You are an expert trading mentor writing a concise performance review. This is a WRITTEN REPORT — never ask questions or offer follow-ups.

## TASK
Performance report for "${periodLabel}" (${tradeCount} closed trades, ${composition}).

## REPORT SECTIONS (use exactly these headings, keep each focused)

**Performance Overview**
Key stats in a compact format: win rate, avg win vs avg loss, total P/L, best/worst trade. 3-4 lines max.

${composition.includes('intraday') ? `**Day Trading Analysis**
For intraday trades ONLY. Focus on: entry timing, execution speed, position sizing relative to intraday ATR, VWAP interaction, momentum (MACD), and same-day exit discipline. Daily RSI and multi-day EMA alignment are NOT relevant for intraday. Focus on: price vs VWAP, intraday momentum, volume at entry.
` : ''}
${composition.includes('swing') ? `**Swing Trading Analysis**
For swing trades ONLY. Focus on: RSI zone at entry, EMA alignment (9/20/50), ATR-based sizing, holding period optimization, multi-day trend following.
` : ''}
**Setups That Worked**
Strategy + condition combos that won consistently. Cite specifics with ticker, return, count. If <3 occurrences, note low confidence.

**Key Mistakes**
The 2-3 most costly or repeated mistakes. Cite the specific trade(s). Be direct.

${hasPrior ? `**Progress vs Prior Analysis**
Compare this period against the prior analysis summary provided. Did the trader fix previously identified mistakes? Are they still making the same errors? Note specific improvements or regressions.
` : ''}
**Action Items**
3-5 numbered, testable improvements. Format: "[Action] — [evidence]. Confidence: High/Medium/Low."

## RULES
- Use ONLY the data provided. Never invent trades.
- Do NOT repeat the same insight in multiple sections.
- Keep the report under 800 words — density over length.
- For intraday: VWAP, momentum, volume, execution speed matter. Daily RSI/EMA are NOT relevant.
- For swing: RSI, EMA alignment, ATR, holding period matter.
- End after Action Items. No closing pleasantries.
- Confidence: High = 5+ trades; Medium = 3-4; Low = 1-2.`;
}

function detectRepeatableSetups(trades: any[]) {
  const setups: Map<string, any[]> = new Map();
  for (const trade of trades) {
    if (!trade.strategy || trade.strategy === 'Other') continue;
    const rsiZone = trade.entryRSI ? trade.entryRSI < 30 ? 'oversold' : trade.entryRSI > 70 ? 'overbought' : 'neutral' : 'unknown';
    const emaAlignment = trade.entryEMA9 && trade.entryEMA20 && trade.entryEMA50
      ? trade.entryEMA9 > trade.entryEMA20 && trade.entryEMA20 > trade.entryEMA50 ? 'bullish'
        : trade.entryEMA9 < trade.entryEMA20 && trade.entryEMA20 < trade.entryEMA50 ? 'bearish' : 'mixed'
      : 'unknown';
    const key = `${trade.strategy}|${rsiZone}|${emaAlignment}`;
    const arr = setups.get(key) || [];
    arr.push(trade);
    setups.set(key, arr);
  }
  const results: any[] = [];
  for (const [key, arr] of setups.entries()) {
    const [strategy, rsiZone, emaAlignment] = key.split('|');
    const winCount = arr.filter(t => (t.returnPct ?? 0) > 0).length;
    const total = arr.length;
    const winRate = (winCount / total) * 100;
    const avgReturn = arr.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / total;
    if (total >= 2 && winRate >= 50) {
      const confidence = total >= 5 && winRate >= 75 ? 'High' : total >= 3 && winRate >= 60 ? 'Medium' : 'Low';
      const conditions = [emaAlignment !== 'unknown' && `EMA ${emaAlignment}`, rsiZone !== 'unknown' && rsiZone !== 'neutral' && `RSI ${rsiZone}`].filter(Boolean).join(', ');
      results.push({ strategy, conditions: conditions || 'Standard', winCount, totalCount: total, winRate: parseFloat(winRate.toFixed(1)), avgReturn: parseFloat(avgReturn.toFixed(2)), confidence });
    }
  }
  return results.sort((a, b) => b.winRate - a.winRate);
}

function detectEarlyExits(trades: any[]) {
  return trades
    .filter(t => !t.isOpen && t.rMultiple && t.maxPotentialR && ((t.rMultiple < 1 && t.maxPotentialR >= 2) || (t.rMultiple < 1.5 && t.maxPotentialR >= 3)))
    .slice(0, 5)
    .map(t => ({ ticker: t.ticker, direction: t.direction, entryPrice: t.entryPrice, exitPrice: t.exitPrice, realizedR: parseFloat((t.rMultiple ?? 0).toFixed(2)), maxPotentialR: parseFloat((t.maxPotentialR ?? 0).toFixed(2)), leftOnTable: parseFloat(((t.maxPotentialR ?? 0) - (t.rMultiple ?? 0)).toFixed(2)), exitReason: t.exitReason }));
}

function formatTrade(t: any, i: number): string {
  const type = t.tradeType === 'intraday' || t.holdingDays === 0 ? 'INTRADAY' : 'SWING';
  const entryDate = new Date(t.entryDate).toISOString().slice(0, 10);
  let line = `${i + 1}. [${type}] ${t.ticker} ${t.direction.toUpperCase()} | Entry: $${t.entryPrice.toFixed(2)} (${entryDate})`;
  if (t.exitPrice) line += ` → Exit: $${t.exitPrice.toFixed(2)}`;
  line += ` | Return: ${(t.returnPct ?? 0) > 0 ? '+' : ''}${(t.returnPct ?? 0).toFixed(2)}%`;
  if (t.profitLoss !== null) line += ` | P/L: $${t.profitLoss.toFixed(2)}`;
  if (t.rMultiple) line += ` | ${t.rMultiple.toFixed(2)}R`;
  if (t.holdingDays !== null && t.holdingDays !== undefined) line += ` | ${t.holdingDays}d`;
  if (t.strategy) line += ` | ${t.strategy}`;
  if (t.exitReason) line += ` | exit: ${t.exitReason}`;
  const indicators: string[] = [];
  if (t.entryRSI) indicators.push(`RSI=${t.entryRSI.toFixed(0)}`);
  if (t.entryEMA9) indicators.push(`EMA9=$${t.entryEMA9.toFixed(2)}`);
  if (t.entryEMA20) indicators.push(`EMA20=$${t.entryEMA20.toFixed(2)}`);
  if (t.entryATR) indicators.push(`ATR=$${t.entryATR.toFixed(2)} (${(t.entryATR / t.entryPrice * 100).toFixed(1)}%)`);
  if (indicators.length > 0) line += `\n   Indicators: ${indicators.join(', ')}`;
  if (t.notes?.trim()) line += `\n   Notes: "${t.notes.trim()}"`;
  return line;
}

function buildAnalysisContext(
  all: any[], winners: any[], losers: any[],
  intraday: any[], swing: any[],
  setups: any[], earlyExits: any[],
  periodLabel: string,
  priorAnalysis: { periodLabel: string; createdAt: Date; analysis: string; tradesAnalyzed: number; winRate: number | null; totalPL: number | null } | null,
): string {
  let ctx = `# Trading Journal — ${periodLabel}\n`;
  ctx += `Total: ${all.length} closed trades (${intraday.length} intraday, ${swing.length} swing)\n`;
  ctx += `Win rate: ${all.length > 0 ? ((winners.length / all.length) * 100).toFixed(1) : 0}% | `;
  ctx += `Total P/L: $${all.reduce((s, t) => s + (t.profitLoss ?? 0), 0).toFixed(2)}\n\n`;

  if (intraday.length > 0) {
    const iWin = intraday.filter(t => (t.returnPct ?? 0) > 0);
    ctx += `## INTRADAY TRADES (${intraday.length}, WR ${intraday.length > 0 ? ((iWin.length / intraday.length) * 100).toFixed(0) : 0}%)\n`;
    intraday.forEach((t, i) => { ctx += formatTrade(t, i) + '\n'; });
    ctx += '\n';
  }
  if (swing.length > 0) {
    const sWin = swing.filter(t => (t.returnPct ?? 0) > 0);
    ctx += `## SWING TRADES (${swing.length}, WR ${swing.length > 0 ? ((sWin.length / swing.length) * 100).toFixed(0) : 0}%)\n`;
    swing.forEach((t, i) => { ctx += formatTrade(t, i) + '\n'; });
    ctx += '\n';
  }
  if (setups.length > 0) {
    ctx += `## REPEATABLE SETUPS\n`;
    setups.forEach(s => { ctx += `- ${s.strategy} (${s.conditions}): ${s.winCount}/${s.totalCount} wins (${s.winRate}%), avg ${s.avgReturn > 0 ? '+' : ''}${s.avgReturn}% [${s.confidence}]\n`; });
    ctx += '\n';
  }
  if (earlyExits.length > 0) {
    ctx += `## EARLY EXITS\n`;
    earlyExits.forEach(e => { ctx += `- ${e.ticker} ${e.direction}: Realized ${e.realizedR}R, Max ${e.maxPotentialR}R (left ${e.leftOnTable}R). Exit: ${e.exitReason || 'unspecified'}\n`; });
    ctx += '\n';
  }
  const longs = all.filter(t => t.direction === 'long');
  const shorts = all.filter(t => t.direction === 'short');
  if (longs.length > 0 && shorts.length > 0) {
    ctx += `Direction: Longs ${longs.length} (${((longs.filter(t => (t.returnPct ?? 0) > 0).length / longs.length) * 100).toFixed(0)}% WR) | Shorts ${shorts.length} (${((shorts.filter(t => (t.returnPct ?? 0) > 0).length / shorts.length) * 100).toFixed(0)}% WR)\n\n`;
  }

  // Include prior analysis summary for progress tracking
  if (priorAnalysis) {
    const priorDate = new Date(priorAnalysis.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    ctx += `## PRIOR ANALYSIS (${priorAnalysis.periodLabel}, ${priorDate}, ${priorAnalysis.tradesAnalyzed} trades)\n`;
    ctx += `WR: ${priorAnalysis.winRate?.toFixed(1) ?? '?'}% | P/L: $${priorAnalysis.totalPL?.toFixed(2) ?? '?'}\n`;
    // Include the last ~600 chars of the prior analysis (action items section)
    const priorText = priorAnalysis.analysis;
    const actionIdx = priorText.lastIndexOf('**Action Items');
    if (actionIdx >= 0) {
      ctx += `Prior action items:\n${priorText.slice(actionIdx, actionIdx + 600)}\n`;
    } else {
      ctx += `Prior summary (last 400 chars):\n...${priorText.slice(-400)}\n`;
    }
    ctx += '\nCompare current performance against these prior findings. Note improvements and regressions.\n\n';
  }

  ctx += `Analyze the above ${all.length} trades. End with actionable improvements.`;
  return ctx;
}
