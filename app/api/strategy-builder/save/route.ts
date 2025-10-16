/**
 * API Route: Save User Strategy
 * POST /api/strategy-builder/save
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createUserStrategy } from '@/lib/strategy-builder/repository';

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
    const { dsl, name, description } = body;

    if (!dsl || !name) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Save strategy
    const result = await createUserStrategy(
      session.user.id,
      name,
      dsl,
      description
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Save strategy error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
