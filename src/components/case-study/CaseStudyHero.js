export default function CaseStudyHero() {
  return (
    <section className="py-24 md:py-32 bg-tool">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-4xl">
          <div className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Case study
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.05]">
            We ran eight real fraud cases through SafeEval. Here's what we
            learned.
          </h1>
          <p className="mt-8 text-xl md:text-2xl text-slate-700 leading-relaxed">
            Every case surfaced something. Two settled into existing categories
            cleanly. Six pushed against the edges and motivated a concrete
            change to the policy.
          </p>

          {/* Anchor data point for the page: the three numbers that frame the
              whole study, at hero scale. */}
          <dl className="mt-12 grid grid-cols-3 gap-6 sm:gap-10 max-w-2xl border-t border-slate-200 pt-10">
            <div>
              <dt className="sr-only">Cases evaluated</dt>
              <dd className="text-6xl font-semibold tracking-tight text-brand-blue leading-none">
                8
              </dd>
              <p className="mt-3 text-sm text-slate-500">cases evaluated</p>
            </div>
            <div>
              <dt className="sr-only">Updates shipped</dt>
              <dd className="text-6xl font-semibold tracking-tight text-brand-blue leading-none">
                2
              </dd>
              <p className="mt-3 text-sm text-slate-500">updates shipped</p>
            </div>
            <div>
              <dt className="sr-only">Follow-up in progress</dt>
              <dd className="text-6xl font-semibold tracking-tight text-brand-blue leading-none">
                1
              </dd>
              <p className="mt-3 text-sm text-slate-500">follow-up in progress</p>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
