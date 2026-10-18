import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

function ymdOk(raw: unknown): raw is string {
  return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw);
}

function clock(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0');
  const mm = String(Math.min(59, parseInt(m[2], 10))).padStart(2, '0');
  return `${hh}:${mm}`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const date = request.nextUrl.searchParams.get('date');
  if (!ymdOk(date)) return NextResponse.json({ error: 'Date required' }, { status: 400 });

  const notes = await prisma.sessionNote.findMany({
    where: {
      userId: session.user.id,
      date: new Date(`${date}T00:00:00.000Z`),
    },
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json({ success: true, notes });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!ymdOk(body.date)) return NextResponse.json({ error: 'Date required' }, { status: 400 });

  let strategyId: string | null = null;
  if (typeof body.strategyId === 'string' && body.strategyId) {
    const owned = await prisma.strategy.findFirst({
      where: { id: body.strategyId, userId: session.user.id },
      select: { id: true },
    });
    strategyId = owned?.id ?? null;
  }

  const note = await prisma.sessionNote.create({
    data: {
      userId: session.user.id,
      date: new Date(`${body.date}T00:00:00.000Z`),
      time: clock(body.time),
      strategyId,
      checks: Array.isArray(body.checks) ? body.checks.filter((x: unknown) => typeof x === 'string') : [],
      body: typeof body.body === 'string' ? body.body.slice(0, 8000) : '',
    },
  });
  return NextResponse.json({ success: true, note });
}
