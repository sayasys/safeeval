const SIGNALS = [
  {
    label: 'Schema',
    value: 'v5.1',
    sub: 'Ontology v5.2; closed-set L1/L2 vocabularies.',
  },
  {
    label: 'Tests',
    value: '177 passing',
    sub: 'Lockstep validator runs on every commit.',
  },
  {
    label: 'Audit metadata',
    value: 'On every eval',
    sub: 'Model, prompt version, timestamp, schema version.',
  },
  {
    label: 'PII posture',
    value: 'Zero-storage',
    sub: 'Evaluations are sanitized before persistence.',
  },
];

export default function TrustSignals() {
  return (
    <section className="py-20 md:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-12">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">
            Operator-credible by construction
          </h2>
          <p className="mt-4 text-lg text-slate-700 leading-relaxed">
            Real numbers only. Everything below is enforced in CI or in the
            commit history.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {SIGNALS.map(signal => (
            <div
              key={signal.label}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {signal.label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
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
