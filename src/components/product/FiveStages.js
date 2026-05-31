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
          {STAGES.map(stage => (
            <div
              key={stage.label}
              className="rounded-3xl bg-white p-8 shadow-card border border-slate-200 transition-shadow hover:shadow-lift"
            >
              <div className="md:flex md:items-start md:gap-8">
                <div className="md:w-48 md:flex-shrink-0">
                  <div className="text-xs font-semibold tracking-wide text-brand-blue uppercase">
                    {stage.label}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-slate-900 tracking-tight">
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
