/**
 * API Route: Export Trading Journal as CSV
 * GET /api/journal/export?from=&to=&type=&strategy=&source=
 *
 * Returns a downloadable CSV with every column per trade.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

interface OHLCBar {
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  return escapeCSV(String(val));
}

const CSV_COLUMNS = [
  'Ticker',
  'Direction',
  'Trade Type',
  'Entry Price',
  'Entry Date',
  'Entry Time',
  'Exit Price',
  'Exit Date',
  'Exit Time',
  'Amount ($)',
  'Is Open',
  'Strategy',
  'Exit Reason',
  'Return %',
  'R Multiple',
  'Holding Days',
  'Profit/Loss ($)',
  'Max Potential R',
  'Notes',
  'Source',
  'Broker',
  'External Order ID',
  'Filled Qty',
  'Avg Fill Price',
  'Order Type',
  'Instrument Type',
  'Sector',
  'Industry',
  'Market Cap (M)',
  'Float Shares (M)',
  'Shares Outstanding (M)',
  'Short %',
  'Avg Volume',
  'Beta',
  'Entry Open',
  'Entry High',
  'Entry Low',
  'Entry Close',
  'Entry Volume',
  'Exit Open',
  'Exit High',
  'Exit Low',
  'Exit Close',
  'Exit Volume',
  'Entry EMA9',
  'Entry EMA20',
  'Entry EMA50',
  'Entry RSI',
  'Entry ATR',
  'Exit EMA9',
  'Exit EMA20',
  'Exit EMA50',
  'Exit RSI',
  'Exit ATR',
  'Analysis Report ID',
  'Created At',
  'Updated At',
] as const;

function tradeToRow(t: any): string[] {
  const entryOHLC = (t.entryOHLC ?? {}) as OHLCBar;
  const exitOHLC = (t.exitOHLC ?? {}) as OHLCBar;

  return [
    t.ticker,
    t.direction,
    t.tradeType,
    t.entryPrice,
    t.entryDate,
    t.entryTime,
    t.exitPrice,
    t.exitDate,
    t.exitTime,
    t.amount,
    t.isOpen,
    t.strategy,
    t.exitReason,
    t.returnPct,
    t.rMultiple,
    t.holdingDays,
    t.profitLoss,
    t.maxPotentialR,
    t.notes,
    t.source,
    t.broker,
    t.externalOrderId,
    t.filledQty,
    t.avgFillPrice,
    t.orderType,
    t.instrumentType,
    t.sector,
    t.industry,
    t.marketCap,
    t.floatShares,
    t.sharesOutstanding,
    t.shortPercent,
    t.avgVolume,
    t.beta,
    entryOHLC.open,
    entryOHLC.high,
    entryOHLC.low,
    entryOHLC.close,
    entryOHLC.volume,
    exitOHLC.open,
    exitOHLC.high,
    exitOHLC.low,
    exitOHLC.close,
    exitOHLC.volume,
    t.entryEMA9,
    t.entryEMA20,
    t.entryEMA50,
    t.entryRSI,
    t.entryATR,
    t.exitEMA9,
    t.exitEMA20,
    t.exitEMA50,
    t.exitRSI,
    t.exitATR,
    t.analysisReportId,
    t.createdAt,
    t.updatedAt,
  ].map(formatCell);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const tradeType = searchParams.get('type');
    const strategy = searchParams.get('strategy');
    const source = searchParams.get('source');
    const broker = searchParams.get('broker');

    const where: any = { userId };

    if (from && from !== '2000-01-01') {
      where.entryDate = { ...(where.entryDate ?? {}), gte: new Date(`${from}T00:00:00.000Z`) };
    }
    if (to) {
      where.entryDate = { ...(where.entryDate ?? {}), lte: new Date(`${to}T23:59:59.999Z`) };
    }
    if (tradeType && tradeType !== 'all') {
      where.tradeType = tradeType;
    }
    if (strategy === '__none__') {
      where.OR = [{ strategy: null }, { strategy: '' }];
    } else if (strategy) {
      where.strategy = { equals: strategy, mode: 'insensitive' };
    }
    if (source && source !== 'all') {
      where.source = source;
    }
    if (broker && broker !== 'all') {
      where.broker = broker;
    }

    const trades = await prisma.tradeJournal.findMany({
      where,
      orderBy: [
        { exitDate: { sort: 'desc', nulls: 'last' } },
        { entryDate: 'desc' },
      ],
    });

    const headerRow = CSV_COLUMNS.join(',');
    const dataRows = trades.map((t) => tradeToRow(t).join(','));
    const csv = [headerRow, ...dataRows].join('\r\n');

    const dateLabel = from && from !== '2000-01-01' ? `${from}_to_${to}` : 'all-time';
    const typeLabel = tradeType && tradeType !== 'all' ? `_${tradeType}` : '';
    const filename = `trades_${dateLabel}${typeLabel}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[Journal Export] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 },
    );
  }
}
