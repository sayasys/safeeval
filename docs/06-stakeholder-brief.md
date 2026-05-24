# SafeEval - Stakeholder Brief
**Document 06 of 06**
*Version 5.0 - May 2026*

**Live app:** https://safeeval.vercel.app
**Repo:** https://github.com/sayasys/safeeval
**Author:** Steven Sayasy (sayasysteven@gmail.com)

---

## What this is

SafeEval is a working fraud and scams enforcement system, built end to end by Steven Sayasy as a portfolio piece for the Anthropic Safeguards Enforcement Analyst and Fraud & Scams Policy Analyst roles. The artifact most worth your attention is not the running web app (though that exists and is linked above). It is the layered set of policy and architecture decisions sitting underneath it. SafeEval is an answer to the question "what would a fraud-policy analyst, asked to design the enforcement layer themselves, actually produce?" The thesis is that the answer should look more like a careful taxonomy and a multi-stage decision pipeline than like a single black-box classifier, and that the most senior thing a candidate for this role can demonstrate is the ability to translate policy intent into structure that an engineer can build against without losing the policy.

The two pieces of the artifact that are worth reading first are the Fraud Analysis Framework, which is the policy spec, and the v5 enforcement design, which is the architecture spec. Both are linked from the README. Everything else (typology threat models, classifier guidance, the running app) is downstream of those two.

---

## The policy framework

The Fraud Analysis Framework, or FAF, is a structured way to describe any fraudulent or fraud-adjacent prompt as three nodes: CONTEXT (who is being addressed, by whom, with what relationship), PROCESS (how is the deception mechanically executed and what psychological lever is being used), and OBJECTIVE (what is the fraudster trying to extract). Each node has a small set of attributes, and the attributes are designed so that a human reviewer and a model classifier can both populate them from the same prompt and end up at the same place. The PROCESS node specifically separates execution (delivery method, template, referenced entities) from psychological pressure (trigger, incentive, control), because in practice the same template gets reused across psychological framings and the same psychological lever gets reused across templates, and conflating them produces a classifier that overfits to surface features.

On top of the FAF nodes sit nine active typologies (romance, investment, phishing, impersonation, advance-fee, fraud infrastructure, recovery, account takeover, AI-enabled abuse) and a closed set of thirteen bright-line features that force a block regardless of context. The choice to keep the typology list short and the bright-line list explicit is deliberate. A long typology list is a sign that the underlying framework is doing less work than it should; a short list backed by a rich evidence model is what lets a single analyst keep the whole policy in their head.

The full FAF spec lives in `docs/01-framework.md` and the master policy in `docs/03-master-policy.md`. The point relevant to this brief is that FAF is the load-bearing piece. The enforcement architecture, the typology threat models, and the running app are all derived from it.

---

## The v5 enforcement design

SafeEval v5 replaces the v4.0 single-call classifier with a four-stage pipeline (triage on Haiku, deep analysis on Sonnet, classification on Sonnet, disposition on rules-plus-Sonnet) and an optional fifth adversarial-review stage that runs only on borderline cases. The full architecture is in `docs/04-enforcement-design.md`. What matters for this brief is the trade-off space the architecture is choosing to occupy, because that is where the policy-versus-engineering judgment shows up.

The pipeline pays more on suspicious traffic than the v4.0 baseline did, and less on benign traffic. The first Haiku stage is cheap, and it short-circuits a meaningful fraction of clearly-benign prompts before any Sonnet call happens. The suspicious slice of traffic, in exchange, gets a much deeper look: a substantive policy call (Stage 2) that produces full FAF evidence and component scores, a constrained classification call (Stage 3) that emits the closed-enum L1/L2/L3 envelope through tool-use schemas the model cannot violate, and a rules-first disposition step (Stage 4) where deterministic rules choose the enforcement action before the model gets to speak. This is the right shape for a fraud system, where the cost of being wrong on the suspicious slice is real harm to victims or to legitimate users, and the cost of being slow is acceptable.

Auditability is the second reason for the multi-stage shape. Each stage emits its own output with its own confidence, and the final response includes a `triggered_by` block that names the rule and the evidence that produced the disposition. A reviewer asked to defend a block decision has the chain of reasoning available to them, attributed to specific signals, rather than a single model summary they would have to either trust or override. This is what the Safeguards Enforcement Analyst role actually does on a daily basis, and the v5 architecture is built to make that work easier rather than harder.

The optional fifth stage, adversarial review, is calibration insurance. It runs only when the disposition is borderline (low-confidence human-review, blocks against prompts with a plausible legitimate use, ambiguous_dual_use that did not get human review). It argues the strongest case that the disposition is wrong, and it can only downgrade the action, never escalate. The asymmetry is intentional. Confident wrong blocks against legitimate users are the failure mode that costs you trusted developers and shows up in support tickets, and they are hard to detect post-hoc because the user is already gone. Catching them inline is worth a Sonnet call on the small slice of traffic that triggers the condition.

The full design is in `docs/04-enforcement-design.md` and the underlying memo (with the trade-off analysis and the rejected alternatives) is in `v5-design-memo.md`.

---

## The L1/L2/L3 plus separated-disposition envelope

The v5 response envelope separates four things that v4.0 conflated: the domain the prompt sits in (L1, a closed seven-value vocabulary), the primary risk pattern (L2, constrained per L1), the multi-valued set of methods, tactics, targets, contextual markers, and overlaps (L3, open and categorized by prefix), and the enforcement action the platform should take (disposition, a closed four-verb vocabulary: allow, safe_completion, human_review, block). The FAF evidence sits underneath all four as a separate `evidence` block, preserved verbatim.

The reason this matters for a downstream consumer is that the layers are orthogonal axes answering different questions. "What space is this in?" is not the same question as "what action should we take?" and a system that fuses them (as v4.0 does) cannot change enforcement policy without re-running the model. Separating them means disposition policy can be tuned in code, classification can be re-derived from preserved evidence when the ontology version bumps, and an analyst comparing two policy positions can hold the evidence constant and vary only the disposition rules. This is the same pattern that mature fraud teams at payment processors and ad networks converge on, and the reason is the same in every case: you change disposition policy more often than you change your understanding of what fraud is, and the data layout should make the more frequent operation cheap.

The L3 layer is categorized by prefix (`method:`, `tactic:`, `target:`, `context_marker:`, `overlap:`, `risk_marker:`) for a related reason. A prompt can legitimately carry both `method:phishing` and `context_marker:security_training` without contradiction, and the prefix tells the consumer which fact each tag is asserting. This eliminates a class of vocabulary collisions that flat tag lists produce as they grow.

---

## What Steven did, specifically

The thing being demonstrated here is policy-to-technical translation, not engineering output. The framework design, the policy spec, the threat models for each typology, the bright-line feature list, the v5 enforcement architecture, and the L1/L2/L3 envelope are all original work by Steven. They are the artifact. The Next.js web app exists as proof that the framework actually runs end to end against a production model and produces structured outputs that match the spec; it is the demonstration that the framework is buildable, not the demonstration itself. A reviewer who reads the FAF spec and the v5 enforcement design has seen the most senior thing Steven is offering. The app is the existence proof.

Steven's working method on this project is also relevant. The v5 design memo (`v5-design-memo.md`) documents how a proposed classification schema was received, evaluated, partially adopted, and partially rejected with reasons. That document is the closest analogue in the repo to the kind of policy review note a fraud and scams analyst writes for an internal stakeholder, and it is worth reading in full if the question on your mind is "can this person reason about trade-offs in front of an engineering team."

---

## How to read the rest of the repo

The order of reading that lands fastest, if you have an hour:

1. The README, for the one-paragraph what-and-why.
2. `docs/01-framework.md`, the FAF spec.
3. This document and `docs/04-enforcement-design.md` together, for the v5 architecture.
4. One or two of the typology threat models in `docs/threat-models/` (romance and AI-enabled abuse are the most illustrative).
5. The running app at https://safeeval.vercel.app, for the existence proof.

The v5 design memo (`v5-design-memo.md`, local-only) is worth reading after the four docs above, when the question becomes "why this design and not the obvious alternative."

---

*Previous: [05 - Classifier Guidance](./05-classifier-guidance.md) | [Return to README](../README.md)*
