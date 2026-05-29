export default function FeedbackStory() {
  return (
    <section className="py-24 bg-cream-100">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-sm font-semibold tracking-wide text-sage-700 uppercase">
          Reviewer feedback
        </div>
        <h2 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          Overrides feed the next policy update
        </h2>
        <p className="mt-6 text-lg text-slate-700 leading-relaxed">
          When a reviewer disagrees with a decision the product made, the
          override is not just logged. It is turned into a signal that flows
          back into the policy. No separate retraining step. No hand-off to a
          different team. The same policy that wrote the rule is the place the
          reviewer's feedback lands.
        </p>

        <div className="mt-10 space-y-4">
          <FlowStep
            number="1"
            title="The product makes a call"
            body="A prompt comes in. The product runs the analysis, picks a recommended action, and writes down the reasons."
          />
          <FlowStep
            number="2"
            title="A reviewer disagrees"
            body="The reviewer reads the analysis and the reasons, and overrides the decision. The override is recorded against the original decision."
          />
          <FlowStep
            number="3"
            title="The override becomes a signal"
            body="The override gets written down in a way the policy can read. What did the reviewer see that the model missed? Was the policy too tight, too loose, or just wrong about this case?"
          />
          <FlowStep
            number="4"
            title="The policy updates"
            body="The signal feeds the next policy update. The rule the reviewer overrode gets revised, retired, or sharpened. The next prompt that looks similar gets the right call from the start."
          />
        </div>
      </div>
    </section>
  );
}

function FlowStep({ number, title, body }) {
  return (
    <div className="rounded-3xl bg-white p-6 md:p-8 shadow-soft border border-sage-100 flex items-start gap-6">
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-sage-100 text-sage-700 font-semibold text-lg flex items-center justify-center">
        {number}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
          {title}
        </h3>
        <p className="mt-2 text-base text-slate-700 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
