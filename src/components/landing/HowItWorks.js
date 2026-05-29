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
    <section className="py-24 bg-cream-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            How it works
          </h2>
          <p className="mt-4 text-lg text-slate-700 leading-relaxed">
            Five stages, each with a defined job. The cascade at the end is the
            policy surface; the stages before it produce the evidence.
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:items-stretch gap-4 md:gap-3">
          {STAGES.map((stage, i) => (
            <div
              key={stage.label}
              className="relative flex md:flex-1 flex-col md:flex-row items-stretch"
            >
              <div className="flex-1 rounded-2xl bg-white p-6 shadow-soft border border-sage-100">
                <div className="text-xs font-semibold tracking-wide text-sage-700 uppercase">
                  {stage.label}
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900 tracking-tight">
                  {stage.title}
                </div>
                <p className="mt-3 text-sm text-slate-700 leading-relaxed">
                  {stage.body}
                </p>
              </div>
              {i < STAGES.length - 1 && (
                <>
                  <div
                    className="hidden md:flex items-center justify-center px-1 text-sage-400 text-2xl select-none"
                    aria-hidden="true"
                  >
                    &rarr;
                  </div>
                  <div
                    className="md:hidden flex items-center justify-center py-2 text-sage-400 text-2xl select-none"
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
