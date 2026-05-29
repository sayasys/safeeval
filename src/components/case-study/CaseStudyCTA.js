import Link from 'next/link';

export default function CaseStudyCTA() {
  return (
    <section className="px-6 my-12">
      <div className="max-w-7xl mx-auto bg-sage-100 rounded-3xl py-20 md:py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">
            See it in the live product.
          </h2>
          <p className="mt-6 text-lg text-slate-700 leading-relaxed">
            The evaluator runs the live classifier. The product page walks
            through how a decision gets made.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/evaluator"
              className="inline-flex items-center justify-center rounded-full bg-coral-500 hover:bg-coral-600 px-8 py-3.5 text-base font-medium text-white transition-colors"
            >
              Try the evaluator
            </Link>
            <Link
              href="/product"
              className="inline-flex items-center justify-center rounded-full border-2 border-sage-300 text-slate-800 hover:bg-sage-50 px-8 py-3.5 text-base font-medium transition-colors"
            >
              How the product works
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
