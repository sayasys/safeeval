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
                <div className="text-xs font-semibold tracking-wide text-brand-blue uppercase">
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
