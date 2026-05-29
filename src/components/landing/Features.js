import Link from 'next/link';

const FEATURES = [
  {
    title: 'Versioned classifier',
    body: 'Closed-set vocabularies, lockstep-verified policy-to-code surface, audit metadata on every evaluation. The classifier is the policy in executable form.',
    href:
      'https://github.com/sayasys/safeeval/blob/main/docs/memos/2026-05-24-parallel-cowork-tracks.md',
    linkLabel: 'Framework memo',
    icon: 'shield',
  },
  {
    title: 'Policy-to-product loop',
    body: 'Write the policy. Ship the classifier. Run real cases. Ship improvements grounded in what the cases surfaced -- not what a clean test set predicted.',
    href: 'https://github.com/sayasys/safeeval/blob/main/docs/policy-reviews/index.md',
    linkLabel: 'Read the case study',
    icon: 'loop',
  },
  {
    title: 'Reviewer feedback',
    body: 'Every override becomes structured supervision signal. The classifier-feedback loop closes back into the policy track without a separate retraining pipeline.',
    href:
      'https://github.com/sayasys/safeeval/blob/main/docs/memos/2026-05-28-classifier-feedback-loop-scoping.md',
    linkLabel: 'Feedback-loop scoping',
    icon: 'spark',
  },
];

function FeatureIcon({ name }) {
  if (name === 'shield') {
    return (
      <svg viewBox="0 0 64 64" className="w-12 h-12" aria-hidden="true">
        <rect x="4" y="4" width="56" height="56" rx="20" fill="#DCE8DE" />
        <path
          d="M32 18 L46 24 V34 C46 42 32 48 32 48 C32 48 18 42 18 34 V24 Z"
          fill="#52835D"
        />
        <circle cx="32" cy="32" r="5" fill="#F46E54" />
      </svg>
    );
  }
  if (name === 'loop') {
    return (
      <svg viewBox="0 0 64 64" className="w-12 h-12" aria-hidden="true">
        <rect x="4" y="4" width="56" height="56" rx="20" fill="#DCE8DE" />
        <path
          d="M22 32 A10 10 0 1 1 32 42"
          stroke="#52835D"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M42 32 A10 10 0 1 1 32 22"
          stroke="#F46E54"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  // spark
  return (
    <svg viewBox="0 0 64 64" className="w-12 h-12" aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="20" fill="#DCE8DE" />
      <circle cx="32" cy="32" r="10" fill="#52835D" />
      <circle cx="20" cy="20" r="4" fill="#F46E54" />
      <circle cx="44" cy="44" r="4" fill="#F46E54" />
      <circle cx="44" cy="20" r="3" fill="#8AB592" />
      <circle cx="20" cy="44" r="3" fill="#8AB592" />
    </svg>
  );
}

export default function Features() {
  return (
    <section className="py-24 bg-cream-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
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
              className="rounded-3xl bg-white p-8 shadow-soft border border-sage-100 flex flex-col"
            >
              <FeatureIcon name={feature.icon} />
              <h3 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-base text-slate-700 leading-relaxed flex-1">
                {feature.body}
              </p>
              <Link
                href={feature.href}
                className="mt-6 text-sm font-medium text-sage-600 hover:text-sage-700 transition-colors"
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
