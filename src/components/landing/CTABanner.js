import Link from 'next/link';

export default function CTABanner() {
  return (
    <section className="px-6 my-12">
      <div className="max-w-7xl mx-auto bg-sage-100 rounded-3xl py-20 md:py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">
            Try the demo, or read the work.
          </h2>
          <p className="mt-6 text-lg text-slate-700 leading-relaxed">
            The evaluator runs on the live v5 classifier. The case study walks
            through eight real fixtures and what they surfaced.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/evaluator"
              className="inline-flex items-center justify-center rounded-full bg-coral-500 hover:bg-coral-600 px-8 py-3.5 text-base font-medium text-white transition-colors"
            >
              Try a demo
            </Link>
            <Link
              href="https://github.com/sayasys/safeeval/blob/main/docs/policy-reviews/index.md"
              className="inline-flex items-center justify-center rounded-full border-2 border-sage-300 text-slate-800 hover:bg-sage-50 px-8 py-3.5 text-base font-medium transition-colors"
            >
              Read the case study
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
