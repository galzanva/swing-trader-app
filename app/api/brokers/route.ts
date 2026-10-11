/**
 * API Route: Broker Accounts
 * GET  /api/brokers - List all broker accounts with P/L stats
 * POST /api/brokers - Create or update a broker account
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { firmDisplayName, inferFirmSlug, isPropAccountType } from '@/lib/prop-firms';

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

    const brokersWithStats = brokers.map(b => {
      const existingFirm = (b as { firmSlug?: string | null }).firmSlug;
      return {
        ...b,
        firmSlug: existingFirm || inferFirmSlug(b.slug, b.accountType),
        stats: statsMap[b.slug] || { totalTrades: 0, openTrades: 0, closedTrades: 0, wins: 0, losses: 0, totalPL: 0, winRate: 0 },
      };
    });

    // Include any brokers that have trades but no BrokerAccount record
    const registeredSlugs = new Set(brokers.map(b => b.slug));
    const orphanSlugs = Object.keys(statsMap).filter(slug => !registeredSlugs.has(slug));
    const orphanBrokers = orphanSlugs.map(slug => ({
      id: null,
      userId,
      slug,
      name: slug.charAt(0).toUpperCase() + slug.slice(1),
      accountType: 'cash',
      firmSlug: inferFirmSlug(slug),
      isActive: true,
      createdAt: null,
      updatedAt: null,
      stats: statsMap[slug],
    }));

    const allBrokers = [...brokersWithStats, ...orphanBrokers];
    let ledger: { firmSlug: string; type: string; amount: number }[] = [];
    try {
      ledger = await prisma.propLedgerEntry.findMany({
        where: { userId },
      });
    } catch (err) {
      console.warn('[Brokers] Prop ledger unavailable (restart dev server after prisma generate):', err);
    }

    const firmMap: Record<string, {
      firmSlug: string;
      name: string;
      evalCount: number;
      evalSpend: number;
      payouts: number;
      truePL: number;
      tradePL: number;
      trades: number;
      accounts: string[];
    }> = {};

    const ensureFirm = (slug: string) => {
      if (!firmMap[slug]) {
        firmMap[slug] = {
          firmSlug: slug,
          name: firmDisplayName(slug),
          evalCount: 0,
          evalSpend: 0,
          payouts: 0,
          truePL: 0,
          tradePL: 0,
          trades: 0,
          accounts: [],
        };
      }
      return firmMap[slug];
    };

    for (const b of allBrokers) {
      const slug = b.firmSlug || inferFirmSlug(b.slug, b.accountType);
      if (!slug) continue;
      const f = ensureFirm(slug);
      f.tradePL += b.stats.totalPL;
      f.trades += b.stats.totalTrades;
      f.accounts.push(b.slug);
    }
    for (const e of ledger) {
      const f = ensureFirm(e.firmSlug);
      if (e.type === 'eval_purchase') {
        f.evalCount += 1;
        f.evalSpend += e.amount;
      } else if (e.type === 'payout') {
        f.payouts += e.amount;
      }
    }
    for (const f of Object.values(firmMap)) {
      f.evalSpend = Math.round(f.evalSpend * 100) / 100;
      f.payouts = Math.round(f.payouts * 100) / 100;
      f.truePL = Math.round((f.payouts - f.evalSpend) * 100) / 100;
      f.tradePL = Math.round(f.tradePL * 100) / 100;
    }

    return NextResponse.json({
      success: true,
      brokers: allBrokers,
      firms: Object.values(firmMap),
      ledger,
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
    const { id, name, slug, accountType, isActive, firmSlug } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const type = accountType || 'cash';
    const resolvedFirm = isPropAccountType(type)
      ? (typeof firmSlug === 'string' && firmSlug
        ? firmSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
        : inferFirmSlug(normalizedSlug, type))
      : null;

    if (id) {
      const existing = await prisma.brokerAccount.findFirst({ where: { id, userId } });
      if (!existing) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }
      const broker = await prisma.brokerAccount.update({
        where: { id },
        data: {
          name,
          slug: normalizedSlug,
          accountType: type,
          firmSlug: resolvedFirm,
          isActive: isActive ?? true,
        },
      });
      if (existing.slug !== normalizedSlug) {
        await prisma.tradeJournal.updateMany({
          where: { userId, broker: existing.slug },
          data: { broker: normalizedSlug },
        });
      }
      return NextResponse.json({ success: true, broker });
    }

    const broker = await prisma.brokerAccount.create({
      data: {
        userId,
        name,
        slug: normalizedSlug,
        accountType: type,
        firmSlug: resolvedFirm,
        isActive: isActive ?? true,
      },
    });
    return NextResponse.json({ success: true, broker });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A broker account with this slug already exists' }, { status: 409 });
    }
    console.error('[Brokers] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
