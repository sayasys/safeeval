export default function Problem() {
  return (
    <section className="py-24 bg-cream-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            The problem
          </h2>
          <p className="mt-8 text-2xl md:text-3xl font-medium tracking-tight text-slate-800 leading-snug">
            Fraud is one of the clearest near-term harms generative AI scales.
            Most trust and safety tooling wasn't built for it. SafeEval is.
          </p>
          <p className="mt-8 text-lg text-slate-700 leading-relaxed">
            Existing trust and safety frameworks were designed for platform
            abuse at scale, not for the kind of writing-and-talking work an AI
            does. SafeEval starts from a fraud policy, turns it into a working
            product, runs real cases through it, and treats every reviewer
            override as a signal the policy should learn from.
          </p>
        </div>
      </div>
    </section>
  );
}
