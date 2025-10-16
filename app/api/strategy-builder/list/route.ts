/**
 * API Route: List User Strategies
 * GET /api/strategy-builder/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getUserStrategies } from '@/lib/strategy-builder/repository';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const strategies = await getUserStrategies(session.user.id, activeOnly);

    return NextResponse.json({
      success: true,
      strategies,
    });
  } catch (error) {
    console.error('List strategies error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
