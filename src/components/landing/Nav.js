import Link from 'next/link';

// `current` is an optional pathname (e.g. "/evaluator"). When it matches a
// nav target, that link renders in the highlighted "current tab" state instead
// of the default muted-with-hover treatment. Pages that pass nothing (landing,
// product, case study) keep every link in the resting state.
const NAV_LINKS = [
  { href: '/product', label: 'Product' },
  { href: '/evaluator', label: 'Evaluator' },
  { href: '/case-study', label: 'Case study' },
  { href: 'https://github.com/sayasys/safeeval', label: 'GitHub' },
];

export default function Nav({ current }) {
  return (
    <nav className="sticky top-0 z-50 bg-cream-50/80 backdrop-blur-md border-b border-sage-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-xl font-semibold tracking-tight text-slate-900"
        >
          SafeEval
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current === link.href ? 'page' : undefined}
              className={
                current === link.href
                  ? 'text-slate-900 font-medium'
                  : 'text-slate-700 hover:text-slate-900 transition-colors'
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Sign up CTA placeholder per landing scoping memo section 3.1 --
              visible but unwired; signup stub deferred until SaaS Phase 1+2 ships. */}
          <span
            className="hidden md:inline-block bg-slate-100 text-slate-400 rounded-full px-5 py-2 text-sm cursor-not-allowed select-none"
            aria-disabled="true"
            title="Sign up coming soon"
          >
            Sign up
          </span>
        </div>
      </div>
    </nav>
  );
}
