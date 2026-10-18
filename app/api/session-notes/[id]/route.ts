import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

function clock(raw: unknown): string | null {
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0');
  const mm = String(Math.min(59, parseInt(m[2], 10))).padStart(2, '0');
  return `${hh}:${mm}`;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.sessionNote.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  let strategyId: string | null = existing.strategyId;
  if (body.strategyId === null || body.strategyId === '') strategyId = null;
  else if (typeof body.strategyId === 'string') {
    const owned = await prisma.strategy.findFirst({
      where: { id: body.strategyId, userId: session.user.id },
      select: { id: true },
    });
    strategyId = owned?.id ?? null;
  }

  const note = await prisma.sessionNote.update({
    where: { id },
    data: {
      ...(body.time !== undefined && { time: clock(body.time) }),
      ...(body.strategyId !== undefined && { strategyId }),
      ...(Array.isArray(body.checks) && {
        checks: body.checks.filter((x: unknown) => typeof x === 'string').slice(0, 80),
      }),
      ...(typeof body.body === 'string' && { body: body.body.slice(0, 8000) }),
    },
  });
  return NextResponse.json({ success: true, note });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await prisma.sessionNote.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ success: true });
}
