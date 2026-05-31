const SIGNALS = [
  {
    label: 'Stable categories',
    value: 'Same vocabulary',
    sub: 'The categories the product uses stay stable across releases.',
    icon: 'layers',
  },
  {
    label: 'Tests',
    value: '177 passing',
    sub: 'A CI check keeps the policy document and the live product in sync on every commit.',
    icon: 'check',
  },
  {
    label: 'Every decision is traceable',
    value: 'On every evaluation',
    sub: 'We log the model that decided, the prompt version, the timestamp, and the schema version.',
    icon: 'trace',
  },
  {
    label: 'No PII stored',
    value: 'Zero retention',
    sub: 'Evaluations are sanitized before they are written down.',
    icon: 'shield',
  },
];

// Small line glyph per trust signal -- house-style inline SVG (currentColor),
// cool palette, no dependency.
function SignalIcon({ name }) {
  const props = {
    className: 'h-5 w-5',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (name === 'check') {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }
  if (name === 'trace') {
    return (
      <svg {...props}>
        <path d="M5 12h14" />
        <circle cx="5" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
      </svg>
    );
  }
  if (name === 'shield') {
    return (
      <svg {...props}>
        <path d="M12 3l7 3v6c0 4-3 6.5-7 8-4-1.5-7-4-7-8V6z" />
      </svg>
    );
  }
  // layers
  return (
    <svg {...props}>
      <path d="M12 3l8 4-8 4-8-4z" />
      <path d="M4 12l8 4 8-4" />
      <path d="M4 16l8 4 8-4" />
    </svg>
  );
}

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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {SIGNALS.map(signal => (
            <div
              key={signal.label}
              className="rounded-2xl bg-white p-6 shadow-card border border-slate-200 transition-shadow hover:shadow-lift"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
                <SignalIcon name={signal.icon} />
              </span>
              <div className="mt-4 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {signal.label}
              </div>
              <div className="mt-2 text-xl font-semibold text-brand-blue tracking-tight">
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
