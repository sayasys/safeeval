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
                className="inline-flex items-center justify-center rounded-full bg-brand-blue hover:bg-blue-700 px-8 py-3.5 text-base font-medium text-white shadow-sm hover:shadow-md transition-all"
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

// A stylized SafeEval evaluation-in-progress: a prompt flows through the
// classifier core into a result card with a disposition, L3 tags, confidence,
// and audit metadata. Built as a white elevated card so it floats on the
// tinted hero. Cool fills only -- slate-200 #E2E8F0 dotted backdrop and the
// brand-blue #2962E0 classifier glyph keep the palette guard green; the red
// "Block" pill is the allowed danger accent.
function HeroIllustration() {
  return (
    <div className="relative mx-auto max-w-md">
      {/* Soft brand glow for depth behind the card */}
      <div
        className="absolute -inset-6 rounded-[2.5rem] bg-brand-blue/5 blur-2xl"
        aria-hidden="true"
      />

      {/* Decorative dotted-grid backdrop (slate-200) peeking from the corner */}
      <svg
        className="absolute -right-5 -top-5 h-24 w-24"
        viewBox="0 0 96 96"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="hero-dots"
            x="0"
            y="0"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="2" fill="#E2E8F0" />
          </pattern>
        </defs>
        <rect width="96" height="96" fill="url(#hero-dots)" />
      </svg>

      {/* The product mockup card */}
      <div className="relative rounded-3xl bg-white border border-slate-200 shadow-float p-6">
        {/* window chrome */}
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="ml-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            Evaluation
          </span>
        </div>

        {/* the prompt being evaluated */}
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Prompt
          </div>
          <div className="mt-2 rounded-xl bg-slate-50 border border-slate-100 p-3">
            <div className="h-2 w-3/4 rounded-full bg-slate-200" />
            <div className="mt-2 h-2 w-1/2 rounded-full bg-slate-200" />
          </div>
        </div>

        {/* the classifier core + flow connectors */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-200" />
          <svg className="h-10 w-10" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="18" fill="#2962E0" fillOpacity="0.1" />
            <circle cx="20" cy="20" r="12" fill="#2962E0" fillOpacity="0.2" />
            <circle cx="20" cy="20" r="6" fill="#2962E0" />
          </svg>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-200" />
        </div>

        {/* the result */}
        <div className="mt-4 rounded-xl border border-slate-200 p-3 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Disposition
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Block
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              advance-fee
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              impersonation
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              urgency
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
              <span>Confidence</span>
              <span className="text-brand-blue">0.94</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[94%] rounded-full bg-brand-blue" />
            </div>
          </div>
        </div>

        {/* audit metadata footer */}
        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-400">
          <svg
            className="h-3 w-3 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z"
              strokeLinejoin="round"
            />
          </svg>
          claude-sonnet-4-6 / logged / traceable
        </div>
      </div>
    </div>
  );
}
