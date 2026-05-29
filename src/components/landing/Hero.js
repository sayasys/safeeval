import Link from 'next/link';

export default function Hero() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-4xl">
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-slate-900">
            An AI safeguard built like trust &amp; safety actually works.
          </h1>
          <p className="mt-6 text-xl md:text-2xl text-slate-700 leading-relaxed">
            Write the fraud policy, ship it as a versioned classifier, run real
            cases through it, and turn every reviewer override into a structured
            improvement.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
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

          <p className="mt-6 text-sm text-slate-500">
            Evaluated against eight real fraud cases.
          </p>
        </div>
      </div>
    </section>
  );
}
