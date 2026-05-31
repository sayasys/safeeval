// The signed-in app's primary navigation targets. Kept as plain data so both
// the AppNav component and its test read from one source -- a renamed label or
// moved route surfaces in both places at once. Evaluator and Intelligence point
// at public routes, which are reachable signed in or out.
//
// IA note (2026-05-30 reorg): the customization surfaces -- custom L3
// classifiers and the named patterns that compose them -- collapse under a
// single "Policy" parent. /app/policy is the landing page; /app/classifiers
// and /app/patterns keep their URLs and gain a secondary tab nav (PolicySubNav)
// when active. Reports are intentionally NOT a top-level destination; they are
// reached from an evaluation's result card, the dashboard widget, and
// /app/reports. The Policy tab lights up for any of the three policy-section
// routes (see POLICY_SECTION_PREFIXES + isPolicySectionPath).

export interface AppNavLink {
  label: string;
  href: string;
}

export const APP_NAV_LINKS: readonly AppNavLink[] = [
  { label: 'Dashboard', href: '/app/dashboard' },
  { label: 'Policy', href: '/app/policy' },
  { label: 'Evaluator', href: '/evaluator' },
  { label: 'Intelligence', href: '/intelligence' },
];

// The routes that live under the Policy IA bucket. The Policy top-nav tab is
// "current" whenever the path is the policy landing page or sits under either
// sub-page; the PolicySubNav renders for exactly this same set.
export const POLICY_SECTION_PREFIXES: readonly string[] = [
  '/app/policy',
  '/app/classifiers',
  '/app/patterns',
];

// True when `pathname` is within the Policy IA bucket -- the landing page or
// any classifiers/patterns route (including nested detail and /new routes).
export function isPolicySectionPath(pathname: string): boolean {
  return POLICY_SECTION_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
