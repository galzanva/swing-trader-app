import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { finalizeTrade, pasteFingerprint } from '@/lib/journal-paste-import';
import { syncTradeStrategies } from '@/lib/trade-strategies';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const rows = Array.isArray(body.trades) ? body.trades : [];
    const defaultBroker = typeof body.broker === 'string' && body.broker ? body.broker : 'webull';

    if (!rows.length) {
      return NextResponse.json({ error: 'No trades to import' }, { status: 400 });
    }
    if (rows.length > 200) {
      return NextResponse.json({ error: 'Max 200 trades per import' }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const raw of rows) {
      if (raw.skip || raw.duplicate) {
        skipped++;
        continue;
      }
      try {
        const side = raw.direction === 'short' ? 'short' : 'long';
        const trade = finalizeTrade({
          ticker: String(raw.ticker || ''),
          direction: side,
          tradeType: raw.tradeType === 'swing' ? 'swing' : 'intraday',
          entryPrice: Number(raw.entryPrice),
          exitPrice: raw.exitPrice != null ? Number(raw.exitPrice) : null,
          entryDate: String(raw.entryDate),
          exitDate: raw.exitDate || String(raw.entryDate),
          entryTime: raw.entryTime || null,
          exitTime: raw.exitTime || null,
          qty: raw.qty != null ? Number(raw.qty) : null,
          amount: raw.amount != null ? Number(raw.amount) : undefined,
          profitLoss: raw.profitLoss != null ? Number(raw.profitLoss) : null,
          strategy: raw.strategy || null,
          strategyId: raw.strategyId || null,
          notes: raw.notes || null,
          exitReason: raw.exitReason || null,
          broker: raw.broker || defaultBroker,
        }, defaultBroker);

        if (!trade.ticker || !trade.entryPrice || !trade.entryDate) {
          errors.push('Skipped a row with missing ticker, price, or date');
          skipped++;
          continue;
        }

        const externalOrderId = pasteFingerprint(trade);
        const exists = await prisma.tradeJournal.findFirst({
          where: { userId: session.user.id, externalOrderId },
          select: { id: true },
        });
        if (exists) {
          skipped++;
          continue;
        }

        const createdRow = await prisma.tradeJournal.create({
          data: {
            userId: session.user.id,
            ticker: trade.ticker.slice(0, 10),
            direction: trade.direction,
            tradeType: trade.tradeType,
            entryPrice: trade.entryPrice,
            exitPrice: trade.exitPrice,
            entryDate: new Date(`${trade.entryDate}T00:00:00.000Z`),
            exitDate: trade.exitDate ? new Date(`${trade.exitDate}T00:00:00.000Z`) : null,
            entryTime: trade.entryTime,
            exitTime: trade.exitTime,
            amount: trade.amount,
            strategy: trade.strategy,
            strategyId: trade.strategyId,
            notes: trade.notes,
            isOpen: trade.isOpen,
            exitReason: trade.exitReason,
            returnPct: trade.returnPct,
            holdingDays: trade.holdingDays,
            profitLoss: trade.profitLoss,
            source: 'manual',
            broker: trade.broker,
            filledQty: trade.qty,
            instrumentType: trade.instrumentType,
            externalOrderId,
          },
        });
        if (trade.strategyId) {
          await syncTradeStrategies(createdRow.id, [{ id: trade.strategyId, name: trade.strategy || '' }]);
        }
        created++;
      } catch (err: any) {
        errors.push(err?.message || 'Row failed');
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      errors,
    });
  } catch (error: any) {
    console.error('[Paste import confirm]', error);
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
