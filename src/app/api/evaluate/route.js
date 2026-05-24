import { NextResponse } from 'next/server';
import { evaluatePrompt, storeEvaluation } from '@/lib/safeeval';

export async function POST(request) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'prompt is required and must be a string' },
        { status: 400 }
      );
    }

    if (prompt.trim().length < 10) {
      return NextResponse.json(
        { error: 'prompt must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (prompt.length > 5000) {
      return NextResponse.json(
        { error: 'prompt must be 5000 characters or fewer' },
        { status: 400 }
      );
    }

    const result = await evaluatePrompt(prompt);
    const record = storeEvaluation(prompt, result);

    return NextResponse.json({ id: record.id, ...result });
  } catch (error) {
    console.error('Evaluation error:', error);
    return NextResponse.json(
      { error: 'Evaluation failed', details: error.message },
      { status: 500 }
    );
  }
}
