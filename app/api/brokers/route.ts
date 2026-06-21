/**
 * API Route: Broker Accounts
 * GET  /api/brokers - List all broker accounts with P/L stats
 * POST /api/brokers - Create or update a broker account
 */

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

    const userId = session.user.id;

    const brokers = await prisma.brokerAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    // Get trade stats per broker (group by broker slug)
    const trades = await prisma.tradeJournal.findMany({
      where: { userId },
      select: {
        broker: true,
        isOpen: true,
        returnPct: true,
        profitLoss: true,
      },
    });

    const statsMap: Record<string, {
      totalTrades: number;
      openTrades: number;
      closedTrades: number;
      wins: number;
      losses: number;
      totalPL: number;
      winRate: number;
    }> = {};

    for (const t of trades) {
      const slug = t.broker || 'webull';
      if (!statsMap[slug]) {
        statsMap[slug] = { totalTrades: 0, openTrades: 0, closedTrades: 0, wins: 0, losses: 0, totalPL: 0, winRate: 0 };
      }
      const s = statsMap[slug];
      s.totalTrades++;
      if (t.isOpen) {
        s.openTrades++;
      } else if (t.returnPct !== null) {
        s.closedTrades++;
        s.totalPL += t.profitLoss ?? 0;
        if ((t.profitLoss ?? 0) > 0) s.wins++;
        else if ((t.profitLoss ?? 0) < 0) s.losses++;
      }
    }

    for (const s of Object.values(statsMap)) {
      s.winRate = s.closedTrades > 0 ? Math.round((s.wins / s.closedTrades) * 10000) / 100 : 0;
      s.totalPL = Math.round(s.totalPL * 100) / 100;
    }

    const brokersWithStats = brokers.map(b => ({
      ...b,
      stats: statsMap[b.slug] || { totalTrades: 0, openTrades: 0, closedTrades: 0, wins: 0, losses: 0, totalPL: 0, winRate: 0 },
    }));

    // Include any brokers that have trades but no BrokerAccount record
    const registeredSlugs = new Set(brokers.map(b => b.slug));
    const orphanSlugs = Object.keys(statsMap).filter(slug => !registeredSlugs.has(slug));
    const orphanBrokers = orphanSlugs.map(slug => ({
      id: null,
      userId,
      slug,
      name: slug.charAt(0).toUpperCase() + slug.slice(1),
      accountType: 'cash',
      isActive: true,
      createdAt: null,
      updatedAt: null,
      stats: statsMap[slug],
    }));

    return NextResponse.json({
      success: true,
      brokers: [...brokersWithStats, ...orphanBrokers],
    });
  } catch (error: any) {
    console.error('[Brokers] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { id, name, slug, accountType, isActive } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    if (id) {
      // Update existing
      const broker = await prisma.brokerAccount.update({
        where: { id, userId },
        data: {
          name,
          slug: normalizedSlug,
          accountType: accountType || 'cash',
          isActive: isActive ?? true,
        },
      });

      // If slug changed, update all trades with the old slug
      const oldBroker = await prisma.brokerAccount.findUnique({ where: { id } });
      if (oldBroker && oldBroker.slug !== normalizedSlug) {
        await prisma.tradeJournal.updateMany({
          where: { userId, broker: oldBroker.slug },
          data: { broker: normalizedSlug },
        });
      }

      return NextResponse.json({ success: true, broker });
    } else {
      // Create new
      const broker = await prisma.brokerAccount.create({
        data: {
          userId,
          name,
          slug: normalizedSlug,
          accountType: accountType || 'cash',
          isActive: isActive ?? true,
        },
      });
      return NextResponse.json({ success: true, broker });
    }
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A broker account with this slug already exists' }, { status: 409 });
    }
    console.error('[Brokers] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
