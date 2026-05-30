// The signed-in app's primary navigation targets. Kept as plain data so both
// the AppNav component and its test read from one source -- a renamed label or
// moved route surfaces in both places at once. Evaluator points at the public
// demo route, which is reachable signed in or out.

export interface AppNavLink {
  label: string;
  href: string;
}

export const APP_NAV_LINKS: readonly AppNavLink[] = [
  { label: 'Dashboard', href: '/app/dashboard' },
  { label: 'Classifiers', href: '/app/classifiers' },
  { label: 'Patterns', href: '/app/patterns' },
  { label: 'Evaluator', href: '/evaluator' },
];
