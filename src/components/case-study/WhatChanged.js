export default function WhatChanged() {
  return (
    <>
      <section className="py-24 bg-tool">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            What worked
          </h2>
          <p className="mt-6 text-lg text-slate-700 leading-relaxed">
            Two policy updates went live the same week the review finished. Both
            were small, well-scoped changes, and both shipped because they were
            the right size for the evidence the cases gave us.
          </p>

          <div className="mt-12 space-y-8">
            <Change
              title="A sharper rule for live deepfake impersonation"
              body="The deepfake-CFO case showed that a live synthetic-media call is a different attack from a forged email, and the policy was treating them the same. The product now has a separate rule for live synthetic media impersonating an executive. The recommended action is the same in both cases, but the rule that fires now matches what a reviewer needs to know to defend against the attack."
            />
            <Change
              title="Vocabulary for chain-of-fraud cases"
              body="Recovery fraud works for the attacker because they already hold the victim list. The policy now has a way to mark cases where the attacker has shown they know the victim was previously defrauded &mdash; and a way to mark cases where one attack exploits a previous attack against the same person. A reviewer can now see, at a glance, that a case is part of a chain."
            />
          </div>
        </div>
      </section>

      <section className="py-24 bg-tool">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            What didn&apos;t work
          </h2>
          <p className="mt-6 text-lg text-slate-700 leading-relaxed">
            Not everything fit. The credential-market and cross-operator-chain
            cases both surfaced the same structural problem: SafeEval classifies
            one prompt at a time, but real fraud is often a chain across
            operators, or a whole criminal operation that spans several kinds of
            harm.
          </p>
          <p className="mt-6 text-lg text-slate-700 leading-relaxed">
            The cases revealed the gap clearly, and the tool was not shaped to
            handle it. That is exactly what an evaluation is for &mdash; finding
            the places where the product does not fit the problem. This is a real
            limitation, not a roadmap item dressed up as a finding.
          </p>
        </div>
      </section>

      <section className="py-24 bg-tool">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            What changed
          </h2>

          <div className="mt-12 space-y-8">
            <Outcome label="shipped">
              Two changes landed. The deepfake rule now separates a live
              synthetic-media impersonation from a forged email. The
              chain-of-fraud vocabulary now marks when an attacker knows their
              target was already defrauded, and when one attack builds on another
              against the same person.
            </Outcome>
            <Outcome label="deferred">
              The structural change &mdash; classifying a case as a whole, not
              just the prompts inside it &mdash; did not ship, and that was a
              deliberate call. A partial case-spanning classifier would have
              looked like it handled chains while only handling the easy ones,
              which is worse than having none at all. Choosing not to ship it is
              itself a finding: the evaluation showed the problem is bigger than a
              quick fix, and the honest response is to build the real thing rather
              than a convincing partial one. The harder fix is in flight; it ships
              when it is ready.
            </Outcome>
          </div>
        </div>
      </section>
    </>
  );
}

function Change({ title, body }) {
  return (
    <div className="rounded-3xl bg-white p-8 md:p-10 shadow-soft border border-slate-200">
      <h3 className="text-2xl font-semibold text-slate-900 tracking-tight">
        {title}
      </h3>
      <p className="mt-4 text-base text-slate-700 leading-relaxed">{body}</p>
    </div>
  );
}

function Outcome({ label, children }) {
  return (
    <div className="rounded-3xl bg-white p-8 md:p-10 shadow-soft border border-slate-200">
      <span className="text-xs font-semibold tracking-widest text-brand-blue">
        {label}
      </span>
      <p className="mt-4 text-base text-slate-700 leading-relaxed">{children}</p>
    </div>
  );
}
