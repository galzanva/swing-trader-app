import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.strategy.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, tradeType, criteria, isActive } = body;

    const strategy = await prisma.strategy.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(tradeType !== undefined && { tradeType }),
        ...(criteria !== undefined && { criteria }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ success: true, strategy });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A strategy with this name already exists' }, { status: 409 });
    }
    console.error('[Strategies] PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.strategy.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Unlink trades that reference this strategy, then delete
    await prisma.tradeJournal.updateMany({
      where: { strategyId: id },
      data: { strategyId: null },
    });

    await prisma.strategy.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Strategies] DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
