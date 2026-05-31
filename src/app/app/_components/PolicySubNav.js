'use client';

// Secondary navigation for the Policy IA bucket. Renders a thin tab rail below
// the AppNav with "Classifiers" and "Patterns" tabs whenever the user is on a
// policy-section route (/app/policy, /app/classifiers/*, /app/patterns/*) and
// stays hidden everywhere else. This is the parent-bucket-with-sub-pages
// convention the IA research cites from Sift / Stripe Radar / Splunk: the
// top-nav Policy tab owns the bucket, and the sub-page nav lives inside it.
//
// Mounted unconditionally in the app layout (src/app/app/layout.js); it returns
// null off the policy section, so a single mount covers every entry path
// without the server layout needing to know the pathname.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isPolicySectionPath } from './app-nav-links';

// The two sub-pages. The landing page (/app/policy) is reachable from the
// top-nav Policy tab itself, so it is not duplicated as a sub-tab; the sub-tabs
// are the two destinations a user moves between while working in the bucket.
const SUB_TABS = [
  { label: 'Classifiers', href: '/app/classifiers' },
  { label: 'Patterns', href: '/app/patterns' },
];

// A sub-tab is current when the path is exactly it or sits underneath it, so
// /app/classifiers/new and /app/patterns/[id] still highlight their tab.
function isCurrent(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PolicySubNav() {
  const pathname = usePathname() || '';
  if (!isPolicySectionPath(pathname)) return null;

  return (
    <nav
      aria-label="Policy sections"
      className="border-b border-slate-200 bg-tool/60 backdrop-blur-sm"
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center gap-6 text-sm">
        {SUB_TABS.map((tab) => {
          const current = isCurrent(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={current ? 'page' : undefined}
              className={
                current
                  ? 'relative py-3 font-medium text-brand-blue after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-brand-blue'
                  : 'py-3 text-slate-600 hover:text-slate-900 transition-colors'
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
