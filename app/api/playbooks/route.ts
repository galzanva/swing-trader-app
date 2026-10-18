import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { replacePlaybookRules, replacePlaybookStrategies, setActivePlaybook } from '@/lib/playbooks';

const include = {
  rules: { orderBy: { sortOrder: 'asc' as const } },
  strategies: { include: { strategy: { select: { id: true, name: true } } } },
};

function lines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => String(r).trim()).filter(Boolean).slice(0, 40);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const playbooks = await prisma.playbook.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include,
  });
  return NextResponse.json({ success: true, playbooks });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const playbook = await prisma.playbook.create({
    data: {
      userId: session.user.id,
      name: name.slice(0, 120),
      tickers: typeof body.tickers === 'string' ? body.tickers.trim().slice(0, 300) || null : null,
      isActive: false,
    },
  });
  await replacePlaybookRules(playbook.id, lines(body.rules));
  await replacePlaybookStrategies(
    playbook.id,
    session.user.id,
    Array.isArray(body.strategyIds) ? body.strategyIds.filter((id: unknown) => typeof id === 'string') : [],
  );
  if (body.isActive) await setActivePlaybook(session.user.id, playbook.id);

  const full = await prisma.playbook.findUnique({ where: { id: playbook.id }, include });
  return NextResponse.json({ success: true, playbook: full });
}
