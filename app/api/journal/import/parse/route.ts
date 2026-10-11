import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { callLLM } from '@/lib/llm/client';
import { isLLMConfigured } from '@/lib/llm/config';
import {
  applyStrategyAndBroker,
  llmParsePrompt,
  parseDeterministic,
  pasteFingerprint,
  tradesFromLlmJson,
  type ParseResult,
} from '@/lib/journal-paste-import';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const defaultBroker = typeof body.broker === 'string' && body.broker ? body.broker : 'webull';
    const preferLlm = body.preferLlm !== false;

    if (!text || text.length < 8) {
      return NextResponse.json({ error: 'Paste is empty' }, { status: 400 });
    }
    if (text.length > 40000) {
      return NextResponse.json({ error: 'Paste is too long (40k character limit)' }, { status: 400 });
    }

    const [strategies, brokers] = await Promise.all([
      prisma.strategy.findMany({
        where: { userId: session.user.id, isActive: true },
        select: { id: true, name: true },
      }),
      prisma.brokerAccount.findMany({
        where: { userId: session.user.id },
        select: { slug: true, name: true },
      }),
    ]);

    const year = new Date().getFullYear();
    const det = parseDeterministic(text, defaultBroker, strategies, year);
    let result: ParseResult = det;
    let llmError: string | null = null;

    const messy = det.trades.length === 0 || /===\s*MNQ|T\d+\s+\d{1,2}:\d{2}/i.test(text);
    if (preferLlm && isLLMConfigured() && (messy || det.trades.length === 0)) {
      try {
        const prompt = llmParsePrompt({ text, brokers, strategies, defaultBroker, year });
        const llm = await callLLM({
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          temperature: 0.1,
          maxTokens: 6000,
          jsonMode: true,
        });
        const fromLlm = tradesFromLlmJson(llm.content, defaultBroker, strategies);
        if (fromLlm.trades.length >= det.trades.length) {
          result = {
            ...fromLlm,
            parser: det.trades.length ? 'hybrid' : 'llm',
            warnings: [...fromLlm.warnings, ...(det.trades.length && fromLlm.trades.length !== det.trades.length
              ? [`AI found ${fromLlm.trades.length} trades (structured parse found ${det.trades.length}).`]
              : [])],
          };
        } else if (fromLlm.trades.length > 0 && det.trades.length === 0) {
          result = fromLlm;
        } else if (fromLlm.inferredBroker && !det.inferredBroker) {
          result = { ...det, inferredBroker: fromLlm.inferredBroker, parser: 'hybrid' };
        }
      } catch (err: any) {
        llmError = err?.message || 'AI parse failed';
        if (!det.trades.length) {
          return NextResponse.json({ error: `AI parse failed: ${llmError}` }, { status: 502 });
        }
        result.warnings.push(`AI parse skipped: ${llmError}`);
      }
    }

    const broker = result.inferredBroker || defaultBroker;
    result.trades = applyStrategyAndBroker(result.trades, strategies, broker);

    const fingerprints = result.trades.map(pasteFingerprint);
    const existing = fingerprints.length
      ? await prisma.tradeJournal.findMany({
          where: { userId: session.user.id, externalOrderId: { in: fingerprints } },
          select: { externalOrderId: true },
        })
      : [];
    const existingSet = new Set(existing.map((e) => e.externalOrderId));

    const preview = result.trades.map((t, i) => ({
      ...t,
      fingerprint: fingerprints[i],
      duplicate: existingSet.has(fingerprints[i]),
    }));

    return NextResponse.json({
      success: true,
      parser: result.parser,
      inferredBroker: result.inferredBroker,
      defaultTicker: result.defaultTicker,
      sessionNotes: result.sessionNotes,
      warnings: result.warnings,
      llmError,
      llmConfigured: isLLMConfigured(),
      trades: preview,
      totals: {
        count: preview.length,
        duplicates: preview.filter((t) => t.duplicate).length,
        pnl: Math.round(preview.reduce((s, t) => s + (t.profitLoss ?? 0), 0) * 100) / 100,
      },
    });
  } catch (error: any) {
    console.error('[Paste import parse]', error);
    return NextResponse.json({ error: error.message || 'Parse failed' }, { status: 500 });
  }
}
