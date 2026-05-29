// Next.js App Router middleware enforcing the public / gated surface
// boundary from scoping memo 2026-05-28 section 2.3.
//
// Matcher restricts firing to /app/:path* and /api/app/:path* -- the
// public surface (/, /evaluator, /product, /case-study, existing
// /api/evaluate and /api/evaluations) is untouched.
//
// Phase 1 behavior:
//   * unauthenticated /app/*       -> 302 redirect to /signup
//   * unauthenticated /api/app/*   -> 401 JSON
//   * authenticated request         -> pass through
//
// The session check delegates to the auth module's
// getCurrentUserFromRequest -- the middleware itself never imports the
// Supabase SDK directly, preserving the migration-readiness rule.

import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth';

const SIGNUP_PATH = '/signup';
const API_APP_PREFIX = '/api/app';
const APP_PREFIX = '/app';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromRequest(request);
  if (user) return NextResponse.next();

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith(API_APP_PREFIX)) {
    return NextResponse.json(
      {
        error: 'Authentication required.',
        code: 'unauthorized',
      },
      { status: 401 },
    );
  }

  if (pathname.startsWith(APP_PREFIX)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = SIGNUP_PATH;
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Defensive default: anything reaching here that the matcher accidentally
  // surfaced (matcher misconfiguration regression) is a pass-through.
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/api/app/:path*'],
};
