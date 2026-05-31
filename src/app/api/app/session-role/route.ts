// GET /api/app/session-role
//
// Minimal session-role probe for client surfaces that must gate UI on the
// caller's role without threading server auth through a large client tree --
// notably the Evaluator result card's Generate-report picker, which grays the
// legal audience unless the caller holds the pii_reviewer role.
//
// Gated under /api/app/: src/middleware.ts returns 401 JSON for an
// unauthenticated request before this handler runs (the handler re-checks
// defensively). Returns only the coarse role signal the picker needs -- never
// PII or evaluation content.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { PII_REVIEWER_ROLE } from '@/lib/report-generators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.', code: 'unauthorized' },
      { status: 401 },
    );
  }
  const role = user.role ?? null;
  return NextResponse.json({
    role,
    is_pii_reviewer: role === PII_REVIEWER_ROLE,
  });
}
