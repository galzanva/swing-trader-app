/**
 * API Route: Single Trade Details
 * GET /api/journal/[id] - Get detailed trade with enriched data
 * DELETE /api/journal/[id] - Delete trade
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tradeId } = await params;
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    console.log(`[Journal Detail] Fetching trade ${tradeId} for user ${userId}`);

    // Fetch trade with all fields (including enriched data)
    const trade = await prisma.tradeJournal.findUnique({
      where: {
        id: tradeId,
        userId, // Ensure user owns the trade
      },
    });

    if (!trade) {
      return NextResponse.json(
        { error: 'Trade not found' },
        { status: 404 }
      );
    }

    console.log(`[Journal Detail] Found trade: ${trade.ticker} ${trade.direction}`);

    return NextResponse.json({
      success: true,
      trade,
    });

  } catch (error: any) {
    console.error('[Journal Detail] Error fetching trade:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tradeId } = await params;
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    console.log(`[Journal Delete] Deleting trade ${tradeId} for user ${userId}`);

    // Delete trade (ensure user owns it)
    await prisma.tradeJournal.delete({
      where: {
        id: tradeId,
        userId,
      },
    });

    console.log(`[Journal Delete] Successfully deleted trade ${tradeId}`);

    return NextResponse.json({
      success: true,
      message: 'Trade deleted successfully',
    });

  } catch (error: any) {
    console.error('[Journal Delete] Error deleting trade:', error);
    
    // Handle not found
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Trade not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

