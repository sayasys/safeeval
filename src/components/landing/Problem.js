const PROBLEM_CARDS = [
  {
    title: 'Fraud is the clearest near-term harm AI scales.',
    body: 'Generative AI lowers the cost of writing convincing scam copy, building synthetic identities, and running multi-turn pretexting at scale. The victim arc is legible and the dollar harm is countable -- which makes fraud the right surface to design AI safety policy against.',
  },
  {
    title: "Existing T&S frameworks don't translate cleanly.",
    body: 'Platform trust and safety operates on aggregate-scored evidence and behavioral signals. AI policy needs bright-line indicators, ontology stability, an adversarial corpus rather than a clean test set, and a separation between disposition policy and the typology vocabulary underneath it.',
  },
  {
    title: 'SafeEval bridges the gap.',
    body: 'Closed-set vocabularies that survive policy revisions. Lockstep verification that keeps the docs and the classifier in sync. Audit metadata on every evaluation. A policy-to-product loop that turns reviewer overrides into the next ontology amendment.',
  },
];

export default function Problem() {
  return (
    <section className="py-24 bg-cream-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            The problem
          </h2>
          <p className="mt-4 text-lg text-slate-700 leading-relaxed">
            Three things have to be true at once for AI safety policy to do real
            work in the fraud domain. None of them are.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PROBLEM_CARDS.map(card => (
            <div
              key={card.title}
              className="rounded-3xl bg-white p-8 shadow-soft border border-sage-100"
            >
              <h3 className="text-xl font-semibold text-slate-900 tracking-tight">
                {card.title}
              </h3>
              <p className="mt-4 text-base text-slate-700 leading-relaxed">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
