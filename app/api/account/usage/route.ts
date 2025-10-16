/**
 * API Route: Get Account Usage Statistics
 * GET /api/account/usage
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get strategies created count
    const strategiesCreated = await prisma.userStrategy.count({
      where: { userId: session.user.id },
    });

    // Get analyses ran (we'll track this later, for now return 0)
    const analysesRan = 0;

    // Get scanners ran (we'll track this later, for now return 0)
    const scannersRan = 0;

    return NextResponse.json({
      strategiesCreated,
      analysesRan,
      scannersRan,
    });
  } catch (error) {
    console.error('Get usage stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
