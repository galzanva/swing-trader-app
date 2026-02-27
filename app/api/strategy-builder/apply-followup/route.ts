/**
 * API Route: Apply Follow-up Answer
 * POST /api/strategy-builder/apply-followup
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { applyFollowUpAnswerLLM } from '@/lib/strategy-builder/llm-parser';
import { validateStrategyDsl } from '@/lib/strategy-builder/dsl-schema';

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
    const { dsl, followUp, answer } = body;

    if (!dsl || !followUp || !answer) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const updatedDsl = applyFollowUpAnswerLLM(dsl, followUp, answer);

    // Validate updated DSL
    const validation = validateStrategyDsl(updatedDsl);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: `Invalid strategy: ${validation.errors?.join(', ')}`,
      });
    }

    return NextResponse.json({
      success: true,
      dsl: validation.data,
    });
  } catch (error) {
    console.error('Apply follow-up error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
