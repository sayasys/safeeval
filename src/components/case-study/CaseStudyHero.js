export default function CaseStudyHero() {
  return (
    <section className="py-24 md:py-32 bg-tool">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-4xl">
          <div className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Case study
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.05]">
            We ran eight real fraud cases through SafeEval. Here's what we
            learned.
          </h1>
          <p className="mt-8 text-xl md:text-2xl text-slate-700 leading-relaxed">
            Every case surfaced something. Two settled into existing categories
            cleanly. Six pushed against the edges and motivated a concrete
            change to the policy.
          </p>
        </div>
      </div>
    </section>
  );
}
