import Link from 'next/link';

export default function CaseStudy() {
  return (
    <section className="py-24 bg-tool">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Case study
        </div>

        <div className="mt-8 rounded-3xl bg-white p-10 md:p-14 shadow-card border border-slate-200">
          <p className="text-2xl md:text-3xl font-medium tracking-tight text-slate-800 leading-snug">
            We ran eight real fraud cases through it. The review surfaced three
            things worth fixing. Two updates went live; one harder follow-up is
            still in progress.
          </p>
          <p className="mt-6 text-lg text-slate-700 leading-relaxed">
            The interesting policy work wasn't in the obvious wins. It was in a
            borderline case on a single example that surfaced a gap in what we
            were tracking, and the policy update closed it.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-slate-200 pt-8">
            <div>
              <div className="text-3xl font-semibold tracking-tight text-brand-blue">
                8
              </div>
              <div className="mt-1 text-sm text-slate-500">cases evaluated</div>
            </div>
            <div>
              <div className="text-3xl font-semibold tracking-tight text-brand-blue">
                2
              </div>
              <div className="mt-1 text-sm text-slate-500">updates shipped</div>
            </div>
            <div>
              <div className="text-3xl font-semibold tracking-tight text-brand-blue">
                1
              </div>
              <div className="mt-1 text-sm text-slate-500">
                follow-up in progress
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <Link
            href="/case-study"
            className="inline-flex items-center justify-center rounded-full bg-brand-blue hover:bg-blue-700 px-8 py-3.5 text-base font-medium text-white shadow-sm hover:shadow-md transition-all"
          >
            Read the case study
          </Link>
        </div>
      </div>
    </section>
  );
}
