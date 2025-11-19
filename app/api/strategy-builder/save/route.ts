/**
 * API Route: Save/Update User Strategy
 * POST /api/strategy-builder/save - Create new strategy
 * PUT /api/strategy-builder/save - Update existing strategy
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createUserStrategy, updateUserStrategy } from '@/lib/strategy-builder/repository';

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
    const { id, dsl, name, description } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Strategy ID is required for updates' },
        { status: 400 }
      );
    }

    if (!dsl || !name) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Update strategy
    const result = await updateUserStrategy(
      session.user.id,
      id,
      {
        name,
        description,
        dsl,
      }
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
