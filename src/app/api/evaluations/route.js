import { NextResponse } from 'next/server';
import { getEvaluations } from '@/lib/safeeval';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const tier = searchParams.get('tier') || undefined;

  const data = getEvaluations({ limit, offset, tier });
  return NextResponse.json(data);
}
