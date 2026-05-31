export default function AuditStory() {
  return (
    <section className="py-24 bg-tool">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Every decision is traceable
        </div>
        <h2 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          Audit metadata
        </h2>
        <p className="mt-6 text-lg text-slate-700 leading-relaxed">
          Every classification carries audit metadata: the model that decided,
          the prompt version, the timestamp, and the policy version that was
          live when the decision happened. Every result is traceable. Every
          decision can be replayed.
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-white p-8 shadow-card border border-slate-200 transition-shadow hover:shadow-lift">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8h.01M11 12h1v4h1" />
              </svg>
            </span>
            <h3 className="mt-4 text-lg font-semibold text-slate-900 tracking-tight">
              Why it matters
            </h3>
            <p className="mt-3 text-base text-slate-700 leading-relaxed">
              A reviewer who wants to second-guess a decision can do that. The
              prompt, the policy that was live, and the analysis that fired
              are all logged in one place. Nothing is lost between the model's
              decision and the audit.
            </p>
          </div>
          <div className="rounded-3xl bg-white p-8 shadow-card border border-slate-200 transition-shadow hover:shadow-lift">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M8 9h8M8 13h8M8 17h5" />
              </svg>
            </span>
            <h3 className="mt-4 text-lg font-semibold text-slate-900 tracking-tight">
              What gets logged
            </h3>
            <ul className="mt-3 space-y-2 text-base text-slate-700 leading-relaxed">
              <li>The model that ran the analysis.</li>
              <li>The prompt as the model saw it.</li>
              <li>The timestamp.</li>
              <li>The policy version in effect.</li>
              <li>The structured result the model produced.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
