import Link from 'next/link';

export default function CaseStudy() {
  return (
    <section className="py-24 bg-cream-100">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-sm font-semibold tracking-wide text-sage-700 uppercase">
          Case study
        </div>

        <div className="mt-8 rounded-3xl bg-sage-50 p-10 md:p-14 border border-sage-100">
          <p className="text-2xl md:text-3xl font-medium tracking-tight text-slate-800 leading-snug">
            Eight real fraud cases, run through the v5 ontology. Three policy
            improvements flagged. Two shipped as ontology 5.2; one structural
            follow-up open.
          </p>
          <p className="mt-6 text-lg text-slate-700 leading-relaxed">
            The interesting policy work was not at the bright headlines but in
            the L2 drift on a single fixture that surfaced a vocabulary gap the
            v5.2 amendment closed.
          </p>
        </div>

        <div className="mt-10">
          <Link
            href="https://github.com/sayasys/safeeval/blob/main/docs/policy-reviews/index.md"
            className="inline-flex items-center justify-center rounded-full bg-coral-500 hover:bg-coral-600 px-8 py-3.5 text-base font-medium text-white transition-colors"
          >
            Read the case study
          </Link>
        </div>
      </div>
    </section>
  );
}
