import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const strategies = await prisma.strategy.findMany({
      where: { userId: session.user.id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { trades: true } } },
    });

    return NextResponse.json({ success: true, strategies });
  } catch (error: any) {
    console.error('[Strategies] GET error:', error);
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
    const { name, description, tradeType, criteria } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const strategy = await prisma.strategy.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        description: description?.trim() || null,
        tradeType: tradeType || 'intraday',
        criteria: criteria || null,
      },
    });

    return NextResponse.json({ success: true, strategy });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A strategy with this name already exists' }, { status: 409 });
    }
    console.error('[Strategies] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
