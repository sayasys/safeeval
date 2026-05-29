import Link from 'next/link';

export default function CTABanner() {
  return (
    <section className="py-24 md:py-32 bg-orange-50 border-y border-orange-100">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">
          Try the demo, or read the work.
        </h2>
        <p className="mt-4 text-lg text-slate-700 leading-relaxed">
          The evaluator runs on the live v5 classifier. The case study walks
          through eight real fixtures and what they surfaced.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/evaluator"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-8 py-3 text-base font-medium text-white hover:bg-slate-800"
          >
            Try a demo
          </Link>
          <Link
            href="https://github.com/sayasys/safeeval/blob/main/docs/policy-reviews/index.md"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-8 py-3 text-base font-medium text-slate-900 hover:bg-slate-50"
          >
            Read the case study
          </Link>
        </div>
      </div>
    </section>
  );
}
