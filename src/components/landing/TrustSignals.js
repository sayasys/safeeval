// Number-led proof strip (Stripe/Anthropic style): each item leads with the
// strong fact, supporting line underneath. No card chrome -- this should read
// as one confident proof line, not four chips. Cool palette only.
const SIGNALS = [
  {
    value: '908',
    sub: 'Tests passing on every commit',
  },
  {
    value: 'Zero',
    sub: 'PII retained from evaluations',
  },
  {
    value: 'Every classification',
    sub: 'Traceable to the rule that fired',
  },
  {
    value: 'Stable',
    sub: "Categories don't drift across releases",
  },
];

export default function TrustSignals() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            Credible to people who do this work
          </h2>
          <p className="mt-4 text-lg text-slate-700 leading-relaxed">
            Real claims only. Everything below is enforced in CI or in the
            commit history.
          </p>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10">
          {SIGNALS.map(signal => (
            <div key={signal.sub}>
              <dt className="text-5xl md:text-6xl font-semibold tracking-tight text-brand-blue leading-tight">
                {signal.value}
              </dt>
              <dd className="mt-3 text-sm text-slate-600 leading-relaxed">
                {signal.sub}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
