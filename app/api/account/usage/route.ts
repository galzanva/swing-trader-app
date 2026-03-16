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

    // Strategy feature removed - strategiesCreated always 0
    const strategiesCreated = 0;
    const analysesRan = 0;
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
