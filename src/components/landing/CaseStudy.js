import Link from 'next/link';

export default function CaseStudy() {
  return (
    <section className="py-20 md:py-24">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Case study
        </div>
        <p className="mt-4 text-2xl md:text-3xl font-medium tracking-tight text-slate-800 leading-tight">
          Eight real fraud cases, run through the v5 ontology. Three policy
          improvements flagged. Two shipped as ontology 5.2; one structural
          follow-up open.
        </p>
        <p className="mt-6 text-lg text-slate-700 leading-relaxed">
          The interesting policy work was not at the bright headlines but in
          the L2 drift on a single fixture that surfaced a vocabulary gap the
          v5.2 amendment closed.
        </p>
        <div className="mt-10">
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
