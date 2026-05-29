const STAGES = [
  {
    label: 'Stage 0',
    title: 'Turn parser',
    body: 'Normalizes single prompts and multi-turn conversations into a stage-1 input.',
  },
  {
    label: 'Stage 1',
    title: 'Triage',
    body: 'L1 domain triage on Haiku; fast path for clearly benign and clearly risky cases.',
  },
  {
    label: 'Stage 2',
    title: 'FAF analysis',
    body: 'Sonnet runs the Fraud Analysis Framework -- node attributes, component scores, bright-line indicators.',
  },
  {
    label: 'Stage 3',
    title: 'Classification',
    body: 'Closed-set L3 tag set; disposition recommendation; structured reason codes.',
  },
  {
    label: 'Stage 4',
    title: 'Cascade',
    body: 'Deterministic rule cascade adjudicates the disposition; uncertain cases route to human review.',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 md:py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-12">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">
            How it works
          </h2>
          <p className="mt-4 text-lg text-slate-700 leading-relaxed">
            Five stages, each with a defined job. The cascade at the end is the
            policy surface; the stages before it produce the evidence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {STAGES.map((stage, i) => (
            <div key={stage.label} className="relative">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 h-full">
                <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {stage.label}
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {stage.title}
                </div>
                <p className="mt-3 text-sm text-slate-700 leading-relaxed">
                  {stage.body}
                </p>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className="hidden md:block absolute top-1/2 -right-2 -translate-y-1/2 text-slate-400 text-2xl select-none"
                  aria-hidden="true"
                >
                  &rarr;
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
