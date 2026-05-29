import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold tracking-tight text-slate-900">
          SafeEval
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-slate-700">
          <Link href="/evaluator" className="hover:text-slate-900">
            Product
          </Link>
          <Link
            href="https://github.com/sayasys/safeeval/tree/main/docs"
            className="hover:text-slate-900"
          >
            Docs
          </Link>
          <Link
            href="https://github.com/sayasys/safeeval/blob/main/docs/policy-reviews/index.md"
            className="hover:text-slate-900"
          >
            Case study
          </Link>
          <Link
            href="https://github.com/sayasys/safeeval"
            className="hover:text-slate-900"
          >
            GitHub
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Sign up CTA placeholder per landing scoping memo section 3.1 --
              visible but unwired; signup stub deferred until SaaS Phase 1+2 ships. */}
          <span
            className="hidden md:inline-block text-sm text-slate-400 cursor-not-allowed select-none"
            aria-disabled="true"
            title="Sign up arrives with SaaS Phase 1"
          >
            Sign up
          </span>
        </div>
      </div>
    </nav>
  );
}
