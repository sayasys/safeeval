import Link from 'next/link';

export default function Hero() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-slate-900 leading-[1.05]">
              An AI safeguard built like trust &amp; safety actually works.
            </h1>
            <p className="mt-8 text-xl text-slate-700 leading-relaxed max-w-2xl">
              Write a fraud policy. Ship it as a working product. Run real cases
              through it. Treat every reviewer override as a signal the policy
              should learn from.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/evaluator"
                className="inline-flex items-center justify-center rounded-full bg-brand-blue hover:bg-blue-700 px-8 py-3.5 text-base font-medium text-white transition-colors"
              >
                Try a demo
              </Link>
              <Link
                href="/case-study"
                className="inline-flex items-center justify-center rounded-full border-2 border-slate-300 text-slate-800 hover:border-brand-blue hover:text-brand-blue px-8 py-3.5 text-base font-medium transition-colors"
              >
                Read the case study
              </Link>
            </div>

            <p className="mt-8 text-sm text-slate-500">
              Evaluated against eight real fraud cases.
            </p>
          </div>

          <div className="md:col-span-5 hidden md:block">
            <HeroIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroIllustration() {
  return (
    <div className="relative aspect-square max-w-md mx-auto">
      <svg
        viewBox="0 0 400 400"
        className="w-full h-full"
        aria-hidden="true"
      >
        {/* Slate background card (frame) */}
        <rect
          x="20"
          y="20"
          width="360"
          height="360"
          rx="48"
          fill="#E2E8F0"
        />
        {/* Floating "prompt" card */}
        <rect
          x="60"
          y="70"
          width="200"
          height="60"
          rx="20"
          fill="#FFFFFF"
        />
        <rect x="80" y="90" width="120" height="6" rx="3" fill="#CBD5E1" />
        <rect x="80" y="106" width="80" height="6" rx="3" fill="#CBD5E1" />

        {/* Classifier core */}
        <circle cx="200" cy="200" r="56" fill="#2962E0" />
        <circle cx="200" cy="200" r="36" fill="#FFFFFF" />
        <circle cx="200" cy="200" r="16" fill="#2962E0" />

        {/* Floating "result" card */}
        <rect
          x="200"
          y="280"
          width="160"
          height="60"
          rx="20"
          fill="#FFFFFF"
        />
        <rect x="220" y="300" width="100" height="6" rx="3" fill="#94A3B8" />
        <rect x="220" y="316" width="60" height="6" rx="3" fill="#94A3B8" />

        {/* Connecting arcs */}
        <path
          d="M 160 130 Q 130 170 152 188"
          stroke="#94A3B8"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="6 8"
        />
        <path
          d="M 248 212 Q 280 250 250 280"
          stroke="#94A3B8"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="6 8"
        />

        {/* Audit badge */}
        <circle cx="320" cy="100" r="28" fill="#2962E0" />
        <circle cx="320" cy="100" r="16" fill="#FFFFFF" />
      </svg>
    </div>
  );
}
