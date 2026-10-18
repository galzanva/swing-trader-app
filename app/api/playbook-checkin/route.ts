import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

function ymdOk(raw: unknown): raw is string {
  return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw);
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const date = request.nextUrl.searchParams.get('date');
  const playbookId = request.nextUrl.searchParams.get('playbookId');
  if (!ymdOk(date)) return NextResponse.json({ error: 'Date required' }, { status: 400 });

  const playbook = await prisma.playbook.findFirst({
    where: playbookId
      ? { id: playbookId, userId: session.user.id }
      : { userId: session.user.id, isActive: true },
    include: { rules: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!playbook) return NextResponse.json({ success: true, playbook: null, day: null });

  const day = await prisma.playbookDay.findUnique({
    where: { playbookId_date: { playbookId: playbook.id, date: new Date(`${date}T00:00:00.000Z`) } },
    include: { checks: true },
  });
  return NextResponse.json({
    success: true,
    playbook: { id: playbook.id, name: playbook.name, rules: playbook.rules },
    day: day
      ? {
          followedAll: day.followedAll,
          note: day.note,
          checks: Object.fromEntries(day.checks.map((c) => [c.ruleId, c.followed])),
        }
      : null,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!ymdOk(body.date)) return NextResponse.json({ error: 'Date required' }, { status: 400 });

  const playbook = await prisma.playbook.findFirst({
    where: body.playbookId
      ? { id: String(body.playbookId), userId: session.user.id }
      : { userId: session.user.id, isActive: true },
    include: { rules: true },
  });
  if (!playbook) return NextResponse.json({ error: 'No active playbook' }, { status: 400 });

  const checksIn = body.checks && typeof body.checks === 'object' ? body.checks as Record<string, boolean> : {};
  const followedAll = playbook.rules.length > 0 && playbook.rules.every((r) => checksIn[r.id] === true);
  const when = new Date(`${body.date}T00:00:00.000Z`);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) || null : null;

  const day = await prisma.playbookDay.upsert({
    where: { playbookId_date: { playbookId: playbook.id, date: when } },
    create: {
      playbookId: playbook.id,
      userId: session.user.id,
      date: when,
      followedAll,
      note,
    },
    update: { followedAll, note },
  });

  await prisma.playbookDayCheck.deleteMany({ where: { dayId: day.id } });
  const rows = playbook.rules
    .filter((r) => r.id in checksIn)
    .map((r) => ({ dayId: day.id, ruleId: r.id, followed: checksIn[r.id] === true }));
  if (rows.length) await prisma.playbookDayCheck.createMany({ data: rows });

  return NextResponse.json({ success: true, followedAll });
}
