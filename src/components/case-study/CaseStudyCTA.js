import Link from 'next/link';

export default function CaseStudyCTA() {
  return (
    <section className="px-6 my-12">
      <div className="max-w-7xl mx-auto bg-brand-blue rounded-3xl py-20 md:py-24 px-6 shadow-float">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">
            See it in the live product.
          </h2>
          <p className="mt-6 text-lg text-blue-100 leading-relaxed">
            The evaluator runs the live classifier. The product page walks
            through how a decision gets made.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/evaluator"
              className="inline-flex items-center justify-center rounded-full bg-white hover:bg-blue-50 px-8 py-3.5 text-base font-medium text-brand-blue shadow-sm hover:shadow-md transition-all"
            >
              Try the evaluator
            </Link>
            <Link
              href="/product"
              className="inline-flex items-center justify-center rounded-full border-2 border-white/40 text-white hover:border-white hover:bg-white/10 px-8 py-3.5 text-base font-medium transition-all"
            >
              How the product works
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
