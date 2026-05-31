const STAGES = [
  {
    label: 'Stage 0',
    title: 'Read the input',
    body: 'Handles single prompts and back-and-forth conversations, and gets them ready for the next step.',
  },
  {
    label: 'Stage 1',
    title: 'Triage',
    body: 'A fast first pass that sorts the clearly safe and clearly risky cases.',
  },
  {
    label: 'Stage 2',
    title: 'Analyze',
    body: 'A deeper model walks the case through the fraud policy and scores it against the patterns the product never allows.',
  },
  {
    label: 'Stage 3',
    title: 'Classify',
    body: 'Picks tags from a fixed list, names a recommended action, and writes down the reasons.',
  },
  {
    label: 'Stage 4',
    title: 'Decide',
    body: 'A simple rule pipeline reads the analysis and decides what to do. Uncertain cases go to a human reviewer.',
  },
];

// One line glyph per stage, matched to its job: read, triage, analyze,
// classify, decide. Inline SVG (currentColor) keeps the house style from
// Features.FeatureIcon and stays on the cool palette with no new dependency.
function StageIcon({ index }) {
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
  const paths = [
    // read the input -- a document with text lines
    <g key="0">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </g>,
    // triage -- a funnel
    <path key="1" d="M4 5h16l-6 7v6l-4 2v-8z" />,
    // analyze -- a magnifier
    <g key="2">
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4-4" />
    </g>,
    // classify -- a tag
    <g key="3">
      <path d="M4 13l7-7h7v7l-7 7z" />
      <circle cx="14.5" cy="9.5" r="1.2" />
    </g>,
    // decide -- a check inside a circle
    <g key="4">
      <circle cx="12" cy="12" r="8" />
      <path d="M9 12l2 2 4-4" />
    </g>,
  ];
  return <svg {...props}>{paths[index] || paths[0]}</svg>;
}

export default function HowItWorks() {
  return (
    <section className="py-24 bg-tool">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            How it works
          </h2>
          <p className="mt-4 text-lg text-slate-700 leading-relaxed">
            Each stage has a defined job. The earlier stages parse the input
            and extract signals. The final stage applies the rules to those
            signals.
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:items-stretch gap-4 md:gap-3">
          {STAGES.map((stage, i) => (
            <div
              key={stage.label}
              className="relative flex md:flex-1 flex-col md:flex-row items-stretch"
            >
              <div className="flex-1 rounded-2xl bg-white p-6 shadow-card border border-slate-200 transition-shadow hover:shadow-lift">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
                  <StageIcon index={i} />
                </span>
                <div className="mt-4 text-xs font-semibold tracking-wide text-brand-blue uppercase">
                  {stage.label}
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900 tracking-tight">
                  {stage.title}
                </div>
                <p className="mt-3 text-sm text-slate-700 leading-relaxed">
                  {stage.body}
                </p>
              </div>
              {i < STAGES.length - 1 && (
                <>
                  <div
                    className="hidden md:flex items-center justify-center px-1 text-slate-400 text-2xl select-none"
                    aria-hidden="true"
                  >
                    &rarr;
                  </div>
                  <div
                    className="md:hidden flex items-center justify-center py-2 text-slate-400 text-2xl select-none"
                    aria-hidden="true"
                  >
                    &darr;
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
