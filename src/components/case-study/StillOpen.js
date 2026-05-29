export default function StillOpen() {
  return (
    <section className="py-24 bg-cream-50">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          What is still open
        </h2>
        <p className="mt-6 text-lg text-slate-700 leading-relaxed">
          The credential-market case and the cross-operator chain both pointed
          at the same harder problem: the product is built to classify one
          prompt at a time. Some cases are not one prompt. They are a chain of
          prompts across many operators, or a whole criminal operation that
          spans different kinds of harm.
        </p>
        <p className="mt-6 text-lg text-slate-700 leading-relaxed">
          Adding a way to classify a case as a whole -- not just the prompts
          inside it -- is a bigger structural change. It is the next piece of
          work and it is still in progress. The two policy updates that did
          ship are the smaller, sharper changes that did not have to wait.
        </p>

        <div className="mt-10 rounded-3xl bg-sage-50 p-8 md:p-10 border border-sage-100">
          <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
            Why not ship a half-version
          </h3>
          <p className="mt-3 text-base text-slate-700 leading-relaxed">
            We could have written a partial version of the structural change to
            ship something. We chose not to. A partial version of a
            case-spanning classifier would have left the policy in a worse
            state than not having one at all -- it would have looked like it
            handled chains, while only handling the easy ones. The harder fix
            is in flight; it ships when it is ready.
          </p>
        </div>
      </div>
    </section>
  );
}
