/**
 * API Route: Toggle Strategy Active Status
 * POST /api/strategy-builder/toggle
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { toggleStrategyActive } from '@/lib/strategy-builder/repository';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { strategyId } = body;

    if (!strategyId) {
      return NextResponse.json(
        { success: false, error: 'Missing strategyId' },
        { status: 400 }
      );
    }

    const result = await toggleStrategyActive(session.user.id, strategyId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Toggle strategy error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
