const STAGES = [
  {
    label: 'Stage 0',
    title: 'Read the input',
    body: 'The product handles single prompts and back-and-forth conversations alike. Stage 0 cleans up the input and gets it ready for the next step. The reader does not need to know whether a conversation came in one piece or many.',
  },
  {
    label: 'Stage 1',
    title: 'Triage',
    body: 'A fast first pass that sorts the clearly safe and the clearly risky. Most prompts are obvious one way or the other. Triage handles them fast, so the deeper analysis runs only on the cases that need it.',
  },
  {
    label: 'Stage 2',
    title: 'Analyze',
    body: 'A deeper-analysis model walks the case through the fraud policy. It looks for the patterns the product never allows, scores the prompt against the policy categories, and writes down what it found.',
  },
  {
    label: 'Stage 3',
    title: 'Classify',
    body: 'The analysis turns into a structured result: tags picked from a fixed list describing what the case looks like, a recommended action, and reasons the reader can audit.',
  },
  {
    label: 'Stage 4',
    title: 'Decide',
    body: 'A simple rule pipeline reads the analysis and decides what to do. Most cases land cleanly on an action. Uncertain cases go to a human reviewer.',
  },
];

// One line glyph per stage, matched to its job: read, triage, analyze,
// classify, decide. Inline SVG (currentColor) -- house style, cool palette,
// no new dependency.
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
    <g key="0">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </g>,
    <path key="1" d="M4 5h16l-6 7v6l-4 2v-8z" />,
    <g key="2">
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4-4" />
    </g>,
    <g key="3">
      <path d="M4 13l7-7h7v7l-7 7z" />
      <circle cx="14.5" cy="9.5" r="1.2" />
    </g>,
    <g key="4">
      <circle cx="12" cy="12" r="8" />
      <path d="M9 12l2 2 4-4" />
    </g>,
  ];
  return <svg {...props}>{paths[index] || paths[0]}</svg>;
}

export default function FiveStages() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            How it reads a prompt
          </h2>
          <p className="mt-4 text-lg text-slate-700 leading-relaxed">
            Five stages, each with a defined job. The last stage is where the
            rules live; the earlier stages produce what the rules read.
          </p>
        </div>

        <div className="space-y-6">
          {STAGES.map((stage, i) => (
            <div
              key={stage.label}
              className="rounded-3xl bg-white p-8 shadow-card border border-slate-200 transition-shadow hover:shadow-lift"
            >
              <div className="md:flex md:items-start md:gap-8">
                <div className="md:w-48 md:flex-shrink-0">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
                    <StageIcon index={i} />
                  </span>
                  <div className="mt-3 text-xs font-semibold tracking-wide text-brand-blue uppercase">
                    {stage.label}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-slate-900 tracking-tight">
                    {stage.title}
                  </div>
                </div>
                <p className="mt-4 md:mt-0 text-base text-slate-700 leading-relaxed flex-1">
                  {stage.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
