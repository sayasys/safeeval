import Link from 'next/link';

export default function ProductCTA() {
  return (
    <section className="px-6 my-12">
      <div className="max-w-7xl mx-auto bg-slate-100 rounded-3xl py-20 md:py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">
            Try it, or read the work.
          </h2>
          <p className="mt-6 text-lg text-slate-700 leading-relaxed">
            The evaluator runs the live classifier. The code is open. The case
            study walks through eight real fraud cases.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/evaluator"
              className="inline-flex items-center justify-center rounded-full bg-brand-blue hover:bg-blue-700 px-8 py-3.5 text-base font-medium text-white transition-colors"
            >
              Try the evaluator
            </Link>
            <Link
              href="/case-study"
              className="inline-flex items-center justify-center rounded-full border-2 border-slate-300 text-slate-800 hover:border-brand-blue hover:text-brand-blue px-8 py-3.5 text-base font-medium transition-colors"
            >
              Read the case study
            </Link>
            <Link
              href="https://github.com/sayasys/safeeval"
              className="inline-flex items-center justify-center rounded-full border-2 border-slate-300 text-slate-800 hover:border-brand-blue hover:text-brand-blue px-8 py-3.5 text-base font-medium transition-colors"
            >
              See the code
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
