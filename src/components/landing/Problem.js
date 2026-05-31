export default function Problem() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue shadow-card">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 17l6-6 4 4 7-7" />
              <path d="M17 5h4v4" />
            </svg>
          </span>
          <h2 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            The problem
          </h2>
          <p className="mt-8 text-2xl md:text-3xl font-medium tracking-tight text-slate-800 leading-snug">
            Fraud is one of the clearest near-term harms that generative AI
            scales &mdash; and most trust and safety tools weren't built for it.
            SafeEval was.
          </p>
          <p className="mt-8 text-lg text-slate-700 leading-relaxed">
            Existing trust and safety frameworks were designed for platform
            abuse at scale, not for the kind of writing-and-talking work an AI
            does. SafeEval starts from a fraud policy, turns it into a working
            product, runs real cases through it, and treats every reviewer
            override as a signal the policy should learn from.
          </p>
        </div>
      </div>
    </section>
  );
}
