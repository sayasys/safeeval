# SafeEval

**An AI trust & safety policy framework, demonstrated through fraud and scams enforcement.**

SafeEval is a portfolio project in AI trust & safety policy design and implementation. It pairs a custom policy framework (the Fraud Analysis Framework, or FAF) with a working four-stage enforcement pipeline that runs against a frontier model and returns a structured, auditable decision for each prompt. The artifact most worth attention is the layered set of policy and architecture decisions sitting underneath the running app. The app is the existence proof that the framework is buildable end-to-end and produces outputs that match the spec; the policy and architecture are the work.

**Live app:** https://safeeval.vercel.app
**Stakeholder brief (start here if you have ten minutes):** [`docs/06-stakeholder-brief.md`](docs/06-stakeholder-brief.md)

---

## What this project demonstrates

A senior policy-design role in AI trust & safety asks one person to do several things that don't usually live together: define a policy that is precise enough to litigate against, decompose it into structured evidence a model can be asked to extract, design an enforcement architecture that converts that evidence into actions a platform can take, anticipate the failure modes of every stage, and translate the result for engineering, legal, GTM, and external stakeholders without losing the policy in any of the translations.

SafeEval is one person's attempt to produce the full stack of those artifacts as a single coherent system, in the open, against real model behavior. Specifically it demonstrates:

- **A custom policy framework.** The Fraud Analysis Framework decomposes any fraud-relevant prompt into three nodes (CONTEXT, PROCESS, OBJECTIVE) with structured attributes per node, on top of which sit nine fraud typologies and a closed list of fourteen bright-line features that force a block regardless of aggregate score. The framework is attribute-first: typology is the output of analysis, not the prerequisite for it, which is what lets it generalize to novel and hybrid attack patterns.
- **A multi-stage enforcement architecture.** The v5 pipeline is four stages: Haiku triage, Sonnet deep analysis under FAF, Sonnet classification into a closed-enum envelope, and a rules-first disposition step (Sonnet adjudicates only the unhandled cases). Each stage has a narrow remit, a narrow output schema, and explicit failure-mode design.
- **A separated classification-and-disposition envelope.** v5 keeps four things orthogonal that the v4 single-call classifier conflated: the L1 domain a prompt sits in, the L2 risk pattern, the multi-valued L3 tag set, and the disposition the platform should take (one of four verbs: allow, safe_completion, human_review, block). The FAF evidence is preserved verbatim underneath all four. This is the same shape mature fraud teams at payment processors and ad networks converge on, and for the same reason: disposition policy changes more often than the underlying ontology, and the data layout should make the more frequent operation cheap.
- **Per-typology threat models.** Nine typology-specific threat models in `docs/threat-models/` enumerate attack mechanisms, AI-enablement deltas, and the enforcement signals the classifier should hook on. They are written for a fraud-policy reviewer, not a security engineer.
- **An audit trail.** The project's evolution is documented in design memos under `docs/memos/` and live-app audits under `docs/ux/audits/` and `docs/qa/audits/`. The audit history is part of the artifact — it is what a senior policy hire's work *actually looks like* week-to-week, including the false starts, the reversals, and the design decisions that were tested against the live deployment and then corrected.
- **A parallel-tracks coordination workflow.** SafeEval is built across five Cowork "tracks" (policy, ops, design, qa, orchestrator) plus a tracks-architect identity and a VS Code execution venue. The workflow is documented in `docs/memos/2026-05-24-parallel-cowork-tracks.md` and amended through a sequence of explicit "atomic amendment" dispatches. The workflow is itself a portfolio artifact: it demonstrates the operational shape of running a single-author policy program at depth.

---

## The four-stage cascade

The v5 enforcement pipeline is the load-bearing architecture decision. The full design is in [`docs/04-enforcement-design.md`](docs/04-enforcement-design.md); the short version is below.

1. **Stage 1 — Triage (Haiku).** A cheap routing pass that decides whether the prompt looks plainly benign, plainly worth a deeper look, or somewhere in between. Stage 1 is never allowed to block. The short-circuit-to-allow path is gated on a measured Haiku benign-precision floor and a 10% offline-sampling audit hook so the cost story is testable rather than assumed.
2. **Stage 2 — FAF Deep Analysis (Sonnet).** The substantive policy call. CONTEXT / PROCESS / OBJECTIVE node attributes are populated, component scores are assigned, bright lines are flagged, and L2 probabilities are produced. This is the closest analogue to the entire v4 system.
3. **Stage 3 — Classification (Sonnet).** Evidence is translated into the v5 envelope: an L1 domain (closed seven-value vocabulary), an L2 risk pattern (closed, constrained by L1), and a multi-valued L3 tag set (open, categorized as `method:` / `tactic:` / `target:` / `context_marker:` / `overlap:` / `risk_marker:`). The model is constrained by tool-use schemas so it literally cannot emit an L2 value that doesn't exist. This eliminates a class of parsing errors that no single-call architecture can prevent.
4. **Stage 4 — Disposition (rules first, then Sonnet on unhandled cases).** Deterministic rules run against the evidence and choose one of four actions: `allow`, `safe_completion`, `human_review`, or `block`. When a rule decides, the reasoning summary is generated from the rule plus the evidence — no second "did the rule decide correctly?" model loop. When no rule fires, the model adjudicates. Disposition is final at Stage 4.

v5.0 originally reserved an optional fifth adversarial-review stage; v5.0.1 removed it after a policy contradiction was identified — a stage that re-argues a bright-line block has, in effect, made the bright line negotiable. The role Stage 5 was filling (re-routing borderline cases) is now covered by two deterministic rules at Stage 4 (`multi_risk_marker_review` and `low_l2_confidence_review`) that send uncertain cases to human review without a second model call. The full reasoning is in [`docs/04-enforcement-design.md`](docs/04-enforcement-design.md) section 6.

Each stage emits its own output with its own confidence, and the final response includes a `triggered_by` block naming the rule and the evidence that produced the disposition, plus a `policy_note` field flagging non-negotiable rules so bright-line blocks cannot be silently downgraded by anything downstream. A reviewer asked to defend a block decision reads a chain of reasoning attributed to specific signals, not a single model summary they have to either trust or override.

---

## The classification envelope

The v5 response envelope separates four things that v4 conflated. The schema lives in [`docs/07-v5-schema.md`](docs/07-v5-schema.md); the closed vocabularies in [`docs/08-v5-ontology.md`](docs/08-v5-ontology.md).

- **L1 — Domain.** Closed seven-value vocabulary answering "what space is this prompt in?" Values include `deceptive_fraud`, `privacy_abuse`, `security_education`, `ambiguous_dual_use`, `benign`, and others.
- **L2 — Risk pattern.** Closed vocabulary, constrained by L1. For `deceptive_fraud` this is the nine-typology fraud taxonomy: romance, investment, phishing, impersonation, advance-fee, recovery, fraud infrastructure, marketplace, BEC. For `privacy_abuse` it splits into credential-theft phishing and identity-document fraud. Each L1 has its own closed L2 set.
- **L3 — Multi-valued tags.** Open, categorized by prefix. `method:` is the technique (e.g., `method:phishing`). `tactic:` is the psychological lever (e.g., `tactic:authority_impersonation`). `target:` is the victim relationship. `context_marker:` is what the prompt is *in*, separate from what it *does* (e.g., `context_marker:security_training`). `overlap:` flags cross-typology hybrids. `risk_marker:` flags individual concerning signals. The prefix tells the consumer which fact each tag is asserting, which eliminates a class of vocabulary collisions that flat tag lists produce as they grow.
- **Disposition.** Closed four-verb vocabulary: `allow`, `safe_completion`, `human_review`, `block`. Disposition is *separate* from classification: an `L1: deceptive_fraud` prompt does not automatically `block`. The disposition rules in `src/lib/safeeval-v5.js` decide that, and they can be tuned in code without re-running classification on historical evidence.

The FAF evidence sits under all four as a preserved `evidence` block — the substantive analysis is never thrown away.

---

## How to read this repo

The docs are layered to match how a reviewer is likely to read them. A reading order that lands fastest in about an hour:

| Order | Doc | What it covers |
|---|---|---|
| 1 | [`README.md`](README.md) (this file) | The one-page what-and-why. |
| 2 | [`docs/06-stakeholder-brief.md`](docs/06-stakeholder-brief.md) | The stakeholder-readable framing of what SafeEval demonstrates and why the architecture is shaped this way. |
| 3 | [`docs/01-framework.md`](docs/01-framework.md) | The Fraud Analysis Framework: node structure, attributes, typology list, bright-line features. The policy spec. |
| 4 | [`docs/04-enforcement-design.md`](docs/04-enforcement-design.md) | The v5 enforcement architecture: four-stage pipeline, bright-line overrides, failure-mode design. The architecture spec. |
| 5 | One or two threat models in [`docs/threat-models/`](docs/threat-models/) | Romance / pig-butchering and AI-enabled abuse are the most illustrative. Each is a ~150-line walk-through of one typology's attack mechanics, AI-enablement delta, and enforcement signals. |
| 6 | Live app at https://safeeval.vercel.app | The existence proof. Submit a prompt and inspect the four-stage trace + the v5 envelope. |

For a deeper read:

| Doc | Role |
|---|---|
| [`docs/02-faf-to-l1l2l3-mapping.md`](docs/02-faf-to-l1l2l3-mapping.md) | How FAF evidence (CONTEXT/PROCESS/OBJECTIVE) maps to the L1/L2/L3 envelope, including the credential-phishing disambiguation rule. |
| [`docs/03-master-policy.md`](docs/03-master-policy.md) | The master fraud and scams policy: definitions, prohibited content, legitimate-use carve-outs. |
| [`docs/05-classifier-guidance.md`](docs/05-classifier-guidance.md) | Operator-facing guidance for the classifier prompt and signal vocabulary. |
| [`docs/07-v5-schema.md`](docs/07-v5-schema.md) | The v5 output schema with field-by-field shape. |
| [`docs/08-v5-ontology.md`](docs/08-v5-ontology.md) | The closed L1/L2 vocabulary and the L3 prefix categories. |
| [`docs/policy-spec-v5.0.md`](docs/policy-spec-v5.0.md) | The authoritative v5 policy spec. When schema docs disagree, this wins. |
| [`docs/memos/`](docs/memos/) | Design memos and decision records. Each memo evaluates alternatives and records why a specific direction was chosen. The dated filenames are a rough timeline of the project's evolution. |
| [`docs/ux/audits/`](docs/ux/audits/), [`docs/qa/audits/`](docs/qa/audits/) | Audits of the live app. UX audits drove design-system and copy fixes; QA audits verified post-fix on the live deploy and against accessibility / mobile / keyboard-input criteria. |
| [`docs/ops/reviewer-sops/`](docs/ops/reviewer-sops/) | Reviewer SOPs — how a human in the `human_review` queue actually walks a case. |
| [`docs/threat-models/`](docs/threat-models/) | The nine per-typology threat models. |

The v5 code is the running app. The v5 enforcement design and the stakeholder brief are at v5.0/5.0.1/5.1 and describe the architecture in production. The framework spec, master policy, classifier guidance, and threat models still carry v4.0 typology language anchored in the FAF nodes; their reconciliation to the v5 L1/L2/L3 ontology is tracked as a separate policy-track rewrite.

---

## The parallel-tracks workflow

A note on the operational shape of this project, because it is itself part of what the artifact demonstrates.

SafeEval is run across five Cowork conversation "tracks" plus a tracks-architect identity and a VS Code execution venue. Each track has a narrow remit and a non-overlapping ownership boundary:

- **`policy`** — FAF spec, threat models, typology decisions, ontology, classifier specs, stakeholder-facing policy prose.
- **`ops`** — enforcement design, reviewer SOPs, Stage-4 rule cascade, disposition postmortems.
- **`design`** — design system, microcopy specs, IA recommendations, README. Authors specs; does not run audits.
- **`qa`** — acceptance audits, WCAG re-audits, fixture-runner side checks. Recommends-only — never edits the artifact it audits.
- **`orchestrator`** — multi-track goal decomposition, dispatch, verification, sequencing.
- **`tracks-architect`** — amends the coordination spec, designs new tracks, runs atomic amendments. Rare.
- **`vscode`** — build/test/deploy, edits to hot JS files, anything needing `ANTHROPIC_API_KEY` live, git operations.

The boundary is enforced through a handoff workflow: tracks write handoff briefs to a shared board, the orchestrator dispatches them, and VS Code executes against `handoff/CURRENT.md`. The full spec is in `docs/memos/2026-05-24-parallel-cowork-tracks.md`, with iterative amendments captured in subsequent memos.

The workflow is gitignored in its detailed form (`handoff/` is local-only) because internal coordination scaffolding doesn't belong in the public history. The amendments — what tracks exist, what owns what — are committed memos because they are part of the policy-design record.

---

## Tech stack

- Next.js 15 (App Router) and React 19
- Tailwind CSS
- Anthropic SDK (`@anthropic-ai/sdk`) — the project's frontier-model substrate happens to be Claude
- Models: `claude-haiku-4-5` for Stage 1 triage; `claude-sonnet-4-6` for Stages 2-4 (deep analysis, classification, disposition)
- Deployed on Vercel; auto-deploys from the `main` branch
- No database, no auth, no `vercel.json` — the app is stateless and intentionally narrow

---

## Running locally

```
git clone https://github.com/sayasys/safeeval.git
cd safeeval
npm install
cp .env.example .env.local
# Set ANTHROPIC_API_KEY in .env.local
npm run dev
```

The app listens on `http://localhost:3000`. The single API route is `POST /api/evaluate` and takes `{ prompt: string }`; see `src/app/api/evaluate/route.js` for the shape.

On Windows with OneDrive, run `git config core.filemode false` after cloning to suppress phantom executable-bit flips in `git status`. The setting is per-clone and can't be tracked via `.gitattributes`.

---

## Project status

The v5 system is live at https://safeeval.vercel.app and is the only running surface; the v4 single-call classifier was sunset in May 2026. The v5 architecture (four-stage pipeline, L1/L2/L3 classification envelope, separated disposition vocabulary) is documented in `docs/04-enforcement-design.md` and `docs/06-stakeholder-brief.md`. The framework spec, master policy, classifier guidance, and threat models still carry v4.0 typology language; their reconciliation to the v5 ontology is a separate policy-track follow-up.

Conversation evaluation (multi-turn inputs) shipped 2026-05-28 as an additive v5.1 extension. The schema additions are dual-emit (backward-compatible with v5.0.1 consumers) and documented in `docs/memos/2026-05-28-policy-conversation-eval-vocabulary.md`.

---

## License

The code in this repository is portfolio work and is not currently published under an open-source license. The policy documents under `docs/` describe a policy framework authored for this project; they are demonstrative artifacts, not a published standard.
