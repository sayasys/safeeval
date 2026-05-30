'use client';

// Top navigation for every signed-in page under /app/*. Mirrors the public
// landing nav (src/components/landing/Nav.js): a sticky cream bar with the
// SafeEval wordmark on the left and a thin sage underline. The difference is
// this version carries auth state -- the signed-in email and a Sign out
// button -- and collapses to a single menu button below the md breakpoint.

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut } from '@/lib/auth';
import { APP_NAV_LINKS } from './app-nav-links';

// A link is "current" when the path is exactly it or sits underneath it, so
// /app/classifiers/new still highlights the Classifiers tab. The dashboard tab
// only lights up on an exact match -- every /app/* page is technically under
// the app root, but the dashboard is its own destination, not a parent.
function isCurrent(pathname, href) {
  if (href === '/app/dashboard') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppNav({ email }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // Whether or not the provider call succeeds, the session cookie is
      // cleared by signOut, so send the user back to the public homepage.
      router.push('/');
      router.refresh();
    }
  }

  return (
    <nav className="sticky top-0 z-50 bg-cream-50/80 backdrop-blur-md border-b border-sage-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/app/dashboard"
          className="text-xl font-semibold tracking-tight text-slate-900"
        >
          SafeEval
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm">
          {APP_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                isCurrent(pathname, link.href)
                  ? 'text-slate-900 font-medium'
                  : 'text-slate-700 hover:text-slate-900 transition-colors'
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          {email && (
            <span
              className="max-w-[14rem] truncate text-sm text-slate-500"
              title={email}
            >
              {email}
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-full border border-sage-200 px-4 py-1.5 text-sm text-slate-700 hover:bg-cream-100 disabled:opacity-60"
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>

        <button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-cream-100"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-sage-100 bg-cream-50 px-6 py-4">
          <div className="flex flex-col gap-3 text-sm">
            {APP_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={
                  isCurrent(pathname, link.href)
                    ? 'text-slate-900 font-medium'
                    : 'text-slate-700 hover:text-slate-900'
                }
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-sage-100 pt-4">
            {email && (
              <span
                className="max-w-[12rem] truncate text-sm text-slate-500"
                title={email}
              >
                {email}
              </span>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-full border border-sage-200 px-4 py-1.5 text-sm text-slate-700 hover:bg-cream-100 disabled:opacity-60"
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
