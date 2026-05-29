const SIGNALS = [
  {
    label: 'Stable categories',
    value: 'Same vocabulary',
    sub: 'The categories the product uses stay stable across releases.',
  },
  {
    label: 'Tests',
    value: '177 passing',
    sub: 'A CI check keeps the policy document and the live product in sync on every commit.',
  },
  {
    label: 'Every decision is traceable',
    value: 'On every evaluation',
    sub: 'We log the model that decided, the prompt version, the timestamp, and the schema version.',
  },
  {
    label: 'No PII stored',
    value: 'Zero retention',
    sub: 'Evaluations are sanitized before they are written down.',
  },
];

export default function TrustSignals() {
  return (
    <section className="py-16 bg-cream-50">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {SIGNALS.map(signal => (
            <div
              key={signal.label}
              className="rounded-2xl bg-white p-6 shadow-soft border border-sage-100"
            >
              <div className="text-xs font-semibold tracking-wide text-sage-700 uppercase">
                {signal.label}
              </div>
              <div className="mt-2 text-xl font-semibold text-sage-700 tracking-tight">
                {signal.value}
              </div>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {signal.sub}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
