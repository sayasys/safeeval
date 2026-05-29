export default function WhatChanged() {
  return (
    <section className="py-24 bg-cream-100">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          What changed
        </h2>
        <p className="mt-6 text-lg text-slate-700 leading-relaxed">
          Two policy updates went live the same week the review finished. Both
          came directly from cases the review surfaced.
        </p>

        <div className="mt-12 space-y-8">
          <Change
            title="A sharper rule for live deepfake impersonation"
            body="The deepfake-CFO case showed that a live synthetic-media call is a different attack from a forged email, and the policy was treating them the same. The product now has a separate rule for live synthetic media impersonating an executive. The recommended action is the same in both cases, but the rule that fires now matches what a reviewer needs to know to defend against the attack."
          />
          <Change
            title="Vocabulary for chain-of-fraud cases"
            body="Recovery-fraud cases work because the attacker has the victim list. The policy now has a way to mark cases where the attacker has shown they know the victim was previously defrauded -- and a way to mark cases where one attack exploits a previous attack against the same person. A reviewer can now see, at a glance, that a case is part of a chain."
          />
        </div>
      </div>
    </section>
  );
}

function Change({ title, body }) {
  return (
    <div className="rounded-3xl bg-white p-8 md:p-10 shadow-soft border border-sage-100">
      <h3 className="text-2xl font-semibold text-slate-900 tracking-tight">
        {title}
      </h3>
      <p className="mt-4 text-base text-slate-700 leading-relaxed">{body}</p>
    </div>
  );
}
