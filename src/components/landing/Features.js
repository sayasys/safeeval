import Link from 'next/link';

const FEATURES = [
  {
    title: 'Versioned classifier',
    body: 'Closed-set vocabularies, lockstep-verified policy-to-code surface, audit metadata on every evaluation. The classifier is the policy in executable form.',
    href:
      'https://github.com/sayasys/safeeval/blob/main/docs/memos/2026-05-24-parallel-cowork-tracks.md',
    linkLabel: 'Framework memo',
  },
  {
    title: 'Policy-to-product loop',
    body: 'Write the policy. Ship the classifier. Run real cases. Ship improvements grounded in what the cases surfaced -- not what a clean test set predicted.',
    href: 'https://github.com/sayasys/safeeval/blob/main/docs/policy-reviews/index.md',
    linkLabel: 'Read the case study',
  },
  {
    title: 'Reviewer feedback',
    body: 'Every override becomes structured supervision signal. The classifier-feedback loop closes back into the policy track without a separate retraining pipeline.',
    href:
      'https://github.com/sayasys/safeeval/blob/main/docs/memos/2026-05-28-classifier-feedback-loop-scoping.md',
    linkLabel: 'Feedback-loop scoping',
  },
];

export default function Features() {
  return (
    <section className="py-20 md:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-12">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">
            What it gives you
          </h2>
          <p className="mt-4 text-lg text-slate-700 leading-relaxed">
            Three load-bearing properties, each tied to an artifact you can
            inspect.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map(feature => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-8 flex flex-col"
            >
              <h3 className="text-xl font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-4 text-base text-slate-700 leading-relaxed flex-1">
                {feature.body}
              </p>
              <Link
                href={feature.href}
                className="mt-6 text-sm font-medium text-slate-900 hover:text-slate-700"
              >
                {feature.linkLabel} &rarr;
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
