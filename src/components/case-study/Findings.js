export default function Findings() {
  return (
    <section className="py-24 bg-cream-50">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          What we found
        </h2>
        <p className="mt-6 text-lg text-slate-700 leading-relaxed">
          Every case in the set surfaced a gap, big or small. Two were small
          enough that the existing policy could absorb them with better
          documentation. Six pushed against the categories hard enough that
          they motivated a concrete change.
        </p>

        <div className="mt-12 space-y-8">
          <Finding
            number="01"
            title="Romance and investment scams"
            body="The two romance-and-investment cases settled into the existing categories cleanly. The policy already had a place for them. The harder question was whether the policy could represent the long-running back-and-forth shape of these scams, not just any single message."
          />
          <Finding
            number="02"
            title="Advance-fee fraud"
            body="A textbook advance-fee case classified cleanly. The policy held. The interesting question was whether the rule that fired was the right one for the right reason, not just the right answer by coincidence."
          />
          <Finding
            number="03"
            title="The deepfake-CFO case"
            body="In a live deepfake video conference impersonating a CFO, an employee was deceived into authorizing roughly $25 million in transfers. The existing policy blocked the case correctly, but it treated a live deepfake call the same as a forged email. Those are not the same attack. A reviewer who would have caught the email by calling the executive cannot catch the deepfake the same way -- the deepfake is on the call. The policy needed a sharper rule for the live-synthetic-media case."
          />
          <Finding
            number="04"
            title="The credential market case"
            body="A multi-year criminal operation that sold access to compromised accounts. The case did not fit cleanly under any single domain: the infrastructure was a cyber problem; the account takeovers were a privacy problem; the downstream use of the stolen accounts was a fraud problem. Each surface classified fine. The case as a whole had no single category, because the policy did not have a way to classify a case that spans domains."
          />
          <Finding
            number="05"
            title="Government-impersonation recovery fraud"
            body="An attacker contacts a fraud victim, pretends to be a government agent, and offers to recover the stolen money for a fee. The structural fact that makes the attack work is that the attacker already knows the victim was defrauded -- usually because they bought the victim list from another fraudster. The policy could describe the victim's status but not the attacker's knowledge. That distinction matters."
          />
          <Finding
            number="06"
            title="The cross-operator chain"
            body="A composite case followed one victim through three different operators sharing a victim-list pipeline. Each conversation classified fine in isolation. The chain across the three did not classify at all -- the policy had no way to represent a case that crosses operators against the same victim. The most consequential policy observation in the whole set."
          />
          <Finding
            number="07"
            title="AI voice-clone scams"
            body="An AI-generated voice call impersonating a grandchild asking for emergency money. The case classified cleanly under the existing categories. The question was whether the case motivated adding voice-specific tags to the policy -- and on review, it did not. The deepfake-CFO change already covered the underlying pattern."
          />
        </div>
      </div>
    </section>
  );
}

function Finding({ number, title, body }) {
  return (
    <div className="md:flex md:items-start md:gap-8">
      <div className="md:w-24 md:flex-shrink-0">
        <div className="text-3xl font-semibold tracking-tight text-sage-500">
          {number}
        </div>
      </div>
      <div className="mt-4 md:mt-0 flex-1">
        <h3 className="text-2xl font-semibold text-slate-900 tracking-tight">
          {title}
        </h3>
        <p className="mt-3 text-base text-slate-700 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
