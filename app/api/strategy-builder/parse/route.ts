/**
 * API Route: Parse Strategy from Plain English
 * POST /api/strategy-builder/parse
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { parseStrategyFromText } from '@/lib/strategy-builder/parser';
import { parseStrategyWithLLM } from '@/lib/strategy-builder/llm-parser';

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
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid text parameter' },
        { status: 400 }
      );
    }

    // Try LLM parser first (if OpenAI key available)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (openaiApiKey) {
      console.log('[Strategy Parser] Using LLM parser');
      const llmResult = await parseStrategyWithLLM(text, openaiApiKey);
      
      if (llmResult.success) {
        console.log('[Strategy Parser] LLM parsing succeeded!');
        return NextResponse.json(llmResult);
      }
      
      console.warn('[Strategy Parser] LLM parsing failed:', llmResult.errors);
      console.warn('[Strategy Parser] Falling back to deterministic parser');
    } else {
      console.log('[Strategy Parser] No OpenAI key found, using deterministic parser');
    }

    // Fallback to deterministic parser
    console.log('[Strategy Parser] Using deterministic parser');
    const result = await parseStrategyFromText(text);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Parse strategy error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
