export default function Setup() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          What we did
        </h2>
        <p className="mt-6 text-lg text-slate-700 leading-relaxed">
          We picked eight real fraud cases from public sources: FBI alerts,
          unsealed court filings, FTC consumer warnings, and investigative
          reporting. Each case had enough detail to read end to end. We chose
          cases that we expected to be hard, on purpose. A neat textbook set
          would not have told us where the policy was weak.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <SetupCard
            title="Why eight"
            icon="count"
            body="Few enough to read carefully; many enough to cover the range. The eight cases span romance and investment scams, business-email compromise, credential markets, government-impersonation recovery fraud, and AI-voice-clone scams."
          />
          <SetupCard
            title="Why public sources"
            icon="public"
            body="Public cases can be cited and revisited. Anyone reading this can go to the source. No anonymous internal data, no proprietary fixtures."
          />
          <SetupCard
            title="Why hard cases"
            icon="target"
            body="A policy that only handles clean cases will fail on the cases that matter. We deliberately picked cases we thought would push the categories. Five of the eight were chosen because we expected the framework to strain."
          />
          <SetupCard
            title="What we did not do"
            icon="exclude"
            body="We did not run the cases through the live classifier. We walked each case through the policy by hand. The question we were asking was: does the policy as written have a place to put this case?"
          />
        </div>
      </div>
    </section>
  );
}

function SetupCard({ title, body, icon }) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-card border border-slate-200 transition-shadow hover:shadow-lift">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
        <SetupIcon name={icon} />
      </span>
      <h3 className="mt-4 text-xl font-semibold text-slate-900 tracking-tight">
        {title}
      </h3>
      <p className="mt-3 text-base text-slate-700 leading-relaxed">{body}</p>
    </div>
  );
}

// Small line glyph per setup rationale -- house-style inline SVG
// (currentColor), cool palette, no dependency.
function SetupIcon({ name }) {
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
  if (name === 'public') {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
      </svg>
    );
  }
  if (name === 'target') {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (name === 'exclude') {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M6 6l12 12" />
      </svg>
    );
  }
  // count
  return (
    <svg {...props}>
      <path d="M9 4L7 20M17 4l-2 16M5 9h15M4 15h15" />
    </svg>
  );
}
