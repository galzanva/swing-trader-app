import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { replacePlaybookRules, replacePlaybookStrategies, setActivePlaybook } from '@/lib/playbooks';

const include = {
  rules: { orderBy: { sortOrder: 'asc' as const } },
  strategies: { include: { strategy: { select: { id: true, name: true } } } },
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.playbook.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (body.activate === true) {
    await setActivePlaybook(session.user.id, id);
  } else {
    const data: { name?: string; tickers?: string | null } = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 120);
    if (typeof body.tickers === 'string') data.tickers = body.tickers.trim().slice(0, 300) || null;
    if (Object.keys(data).length) await prisma.playbook.update({ where: { id }, data });
    if (Array.isArray(body.rules)) {
      const rules = body.rules.map((r: unknown) => String(r).trim()).filter(Boolean).slice(0, 40);
      await replacePlaybookRules(id, rules);
    }
    if (Array.isArray(body.strategyIds)) {
      await replacePlaybookStrategies(
        id,
        session.user.id,
        body.strategyIds.filter((s: unknown) => typeof s === 'string'),
      );
    }
    if (body.isActive === true) await setActivePlaybook(session.user.id, id);
  }

  const playbook = await prisma.playbook.findUnique({ where: { id }, include });
  return NextResponse.json({ success: true, playbook });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await prisma.playbook.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ success: true });
}
