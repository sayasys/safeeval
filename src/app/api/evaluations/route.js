import { NextResponse } from 'next/server';
import { getEvaluations } from '@/lib/safeeval-v5';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const action = searchParams.get('action') || undefined;

  const data = getEvaluations({ limit, offset, action });
  return NextResponse.json(data);
}
