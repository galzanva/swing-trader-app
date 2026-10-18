import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

const MAX_SHOTS = 4;
const MAX_CHARS = 1_400_000;

async function ownedTrade(userId: string, tradeId: string) {
  return prisma.tradeJournal.findFirst({
    where: { id: tradeId, userId },
    select: { id: true },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const trade = await ownedTrade(session.user.id, id);
  if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 });

  const screenshots = await prisma.tradeScreenshot.findMany({
    where: { tradeId: id, userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, data: true, createdAt: true },
  });
  return NextResponse.json({ success: true, screenshots });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const trade = await ownedTrade(session.user.id, id);
  if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data = typeof body.data === 'string' ? body.data : '';
  if (!data.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Attach a JPEG or PNG image' }, { status: 400 });
  }
  if (data.length > MAX_CHARS) {
    return NextResponse.json({ error: 'Image is too large. Try a smaller screenshot.' }, { status: 400 });
  }

  const count = await prisma.tradeScreenshot.count({ where: { tradeId: id } });
  if (count >= MAX_SHOTS) {
    return NextResponse.json({ error: `Up to ${MAX_SHOTS} screenshots per trade` }, { status: 400 });
  }

  const screenshot = await prisma.tradeScreenshot.create({
    data: { tradeId: id, userId: session.user.id, data },
    select: { id: true, data: true, createdAt: true },
  });
  return NextResponse.json({ success: true, screenshot });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const shotId = new URL(request.url).searchParams.get('shotId');
  if (!shotId) return NextResponse.json({ error: 'Missing screenshot' }, { status: 400 });
  await prisma.tradeScreenshot.deleteMany({
    where: { id: shotId, tradeId: id, userId: session.user.id },
  });
  return NextResponse.json({ success: true });
}
