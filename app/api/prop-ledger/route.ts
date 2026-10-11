import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { firmDisplayName } from '@/lib/prop-firms';

const TYPES = new Set(['eval_purchase', 'payout']);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const entries = await prisma.propLedgerEntry.findMany({
      where: { userId: session.user.id },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const firms: Record<string, {
      firmSlug: string;
      name: string;
      evalCount: number;
      evalSpend: number;
      payouts: number;
      truePL: number;
    }> = {};

    for (const e of entries) {
      if (!firms[e.firmSlug]) {
        firms[e.firmSlug] = {
          firmSlug: e.firmSlug,
          name: firmDisplayName(e.firmSlug),
          evalCount: 0,
          evalSpend: 0,
          payouts: 0,
          truePL: 0,
        };
      }
      const f = firms[e.firmSlug];
      if (e.type === 'eval_purchase') {
        f.evalCount += 1;
        f.evalSpend += e.amount;
      } else if (e.type === 'payout') {
        f.payouts += e.amount;
      }
    }
    for (const f of Object.values(firms)) {
      f.evalSpend = Math.round(f.evalSpend * 100) / 100;
      f.payouts = Math.round(f.payouts * 100) / 100;
      f.truePL = Math.round((f.payouts - f.evalSpend) * 100) / 100;
    }

    return NextResponse.json({
      success: true,
      entries,
      firms: Object.values(firms),
    });
  } catch (error: any) {
    console.error('[Prop ledger GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const firmSlug = String(body.firmSlug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const type = String(body.type || '');
    const amount = Number(body.amount);
    const dateStr = String(body.date || '');
    const notes = body.notes ? String(body.notes) : null;

    if (!firmSlug) return NextResponse.json({ error: 'Firm is required' }, { status: 400 });
    if (!TYPES.has(type)) return NextResponse.json({ error: 'Type must be eval_purchase or payout' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'Date must be YYYY-MM-DD' }, { status: 400 });
    }

    const entry = await prisma.propLedgerEntry.create({
      data: {
        userId: session.user.id,
        firmSlug,
        type,
        amount: Math.round(amount * 100) / 100,
        date: new Date(`${dateStr}T00:00:00.000Z`),
        notes,
      },
    });

    return NextResponse.json({ success: true, entry });
  } catch (error: any) {
    console.error('[Prop ledger POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await prisma.propLedgerEntry.deleteMany({
      where: { id, userId: session.user.id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Prop ledger DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
