/**
 * API Route: Delete User Strategy
 * DELETE /api/strategy-builder/delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { deleteUserStrategy } from '@/lib/strategy-builder/repository';

export async function DELETE(request: NextRequest) {
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
    const strategyId = searchParams.get('id');

    if (!strategyId) {
      return NextResponse.json(
        { success: false, error: 'Missing strategyId' },
        { status: 400 }
      );
    }

    const result = await deleteUserStrategy(session.user.id, strategyId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Delete strategy error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
