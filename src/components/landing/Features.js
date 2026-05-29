import Link from 'next/link';

const FEATURES = [
  {
    title: 'A policy you can ship',
    body: "The fraud policy and the live product never drift apart. An automated check enforces it on every commit, and every classification is traceable back to the rule that fired.",
    href: '/product',
    linkLabel: 'How the product works',
    icon: 'shield',
  },
  {
    title: 'Live cases shape the next update',
    body: 'Write the policy. Ship the product. Run real cases. Improvements come from what real cases surfaced, not from a neat textbook set.',
    href: '/case-study',
    linkLabel: 'Read the case study',
    icon: 'loop',
  },
  {
    title: 'Reviewer feedback feeds the policy',
    body: 'Every override becomes a signal we can learn from. Reviewer feedback flows back into the policy without a separate retraining step.',
    href: '/product',
    linkLabel: 'How feedback works',
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
            Three properties you can see in the live product.
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
