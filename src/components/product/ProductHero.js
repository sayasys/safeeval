import Link from 'next/link';

export default function ProductHero() {
  return (
    <section className="py-24 md:py-32 bg-cream-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-4xl">
          <div className="text-sm font-semibold tracking-wide text-sage-700 uppercase">
            The product
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.05]">
            What SafeEval does.
          </h1>
          <p className="mt-8 text-xl md:text-2xl text-slate-700 leading-relaxed">
            SafeEval is a working trust-and-safety product for fraud. You write
            the fraud policy. SafeEval turns it into a live classifier that
            reads prompts, scores them against the policy, and recommends an
            action. Every decision is traceable. Reviewer overrides feed back
            into the next policy update.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link
              href="/evaluator"
              className="inline-flex items-center justify-center rounded-full bg-coral-500 hover:bg-coral-600 px-8 py-3.5 text-base font-medium text-white transition-colors"
            >
              Try a demo
            </Link>
            <Link
              href="/case-study"
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
