/**
 * API Route: Update User Strategy
 * PUT /api/strategy-builder/update
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { updateUserStrategy } from '@/lib/strategy-builder/repository';

export async function PUT(request: NextRequest) {
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
    const { strategyId, ...updates } = body;

    if (!strategyId) {
      return NextResponse.json(
        { success: false, error: 'Missing strategyId' },
        { status: 400 }
      );
    }

    const result = await updateUserStrategy(
      session.user.id,
      strategyId,
      updates
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Update strategy error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
