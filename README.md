# SafeEval

SafeEval is an end-to-end fraud safeguard evaluation system — a versioned policy schema, a five-stage classifier, and an enforcement cascade — built to apply the evaluation methodology I've been operating in trust & safety for five years to AI safety policy in the fraud domain.

Built to demonstrate the policy-to-classifier-to-product loop a fraud policy analyst owns: write the policy, translate it into reviewable artifacts, run real cases through it, ship improvements grounded in what the cases surfaced, and re-evaluate when the next pass shows the fix didn't propagate the way you thought it did.

**Start here:** [Policy review case study — eight real fraud cases run through the v5 ontology; three improvements flagged, two shipped, one structural follow-up open](./docs/policy-reviews/index.md)

**Live app:** [safeeval.vercel.app](https://safeeval.vercel.app) — the home page is a landing surface; the v5 evaluator UI lives at [/evaluator](https://safeeval.vercel.app/evaluator).

Mechanically, each input runs through five stages: Stage 0 turn parser (normalizing single prompts and multi-turn conversations), Stage 1 L1 domain triage on Haiku, Stage 2 FAF deep analysis on Sonnet (node attributes, component scores, bright-line indicators), Stage 3 L3 tag set plus disposition and reason codes, and Stage 4 a deterministic rule cascade that adjudicates dispositions and routes uncertain cases to human review. Schema v5.1, ontology v5.2: closed-set L1/L2 vocabularies, prefix-categorized L3 tags, fifteen bright-line indicators, four-verb disposition vocabulary (`allow`, `safe_completion`, `human_review`, `block`).

Generative AI scales fraud — one of the clearest near-term harms, with the most legible victim arc. The interesting policy work here is not at the bright headlines but in deciding what counts as bright-line versus aggregate-scored evidence, how to keep ontology stable while disposition policy evolves, and which gaps a real adversarial corpus surfaces that a clean test set won't. The same evaluation motion I have run for five years in trust & safety and risk control, written here against an AI safety surface area — the analytical work is the same.

SafeEval is built as a parallel-tracks framework: policy, design, engineering, QA, and architect each operate as separate sessions with their own briefs, handing off through inbox files and a global state document. The framework memo, the atomic amendments (seven shipped as numbered amendments within the framework memo itself), and the cross-cutting policy memos (PII zero-storage, OSINT monitoring, audience-tailored reports, synthetic media detection, classifier-edits feedback loop) are all in `docs/memos/`. The implementation work was done end-to-end with Claude and Cursor as the engineering surface, named here because this is an AI policy domain and fluency with that tooling is part of the work.

---

## Further reading

1. [Policy review case study](./docs/policy-reviews/index.md) — eight real fraud cases run through the v5 ontology; the case-study-driven amendments that shipped as ontology 5.2 and the one structural follow-up the QA pass surfaced.
2. [Parallel-tracks framework memo](./docs/memos/2026-05-24-parallel-cowork-tracks.md) — the coordination spec the project runs on. The seven shipped atomic amendments are recorded as numbered amendments within the memo itself; each amendment has an originating scoping memo cross-linked from the changelog.
3. [Four-dimension ontology-separation memo](./docs/memos/2026-05-27-four-dimension-ontology-separation.md) — splits the PROMPT_SUMMARY card into four orthogonal closed-set dimensions (typology, persona, pretext, contact context) with explicit IC3 / FTC / NIST alignment.
4. [Policy spec](./docs/policy-spec-v5.0.md) and [per-typology threat models](./docs/threat-models/) — the authoritative v5 policy spec plus the nine typology-specific threat models that drive Stage 2 evidence extraction.
5. [OSINT monitoring scoping memo](./docs/memos/2026-05-28-osint-monitoring-scoping.md) — the threat-intel watcher's scoping memo: where emerging-TTP signal comes from, what the retention posture is, how it feeds candidate L3 vocabulary.

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

The app listens on `http://localhost:3000` -- the home page is the marketing landing surface; the v5 evaluator UI is at `http://localhost:3000/evaluator`. The single API route is `POST /api/evaluate` and takes `{ prompt: string }`; see `src/app/api/evaluate/route.js` for the shape. The classifier engine is `src/lib/safeeval-v5.js`; the docs/code lockstep validator is `scripts/check-lockstep.js` and runs in CI.

On Windows with OneDrive, run `git config core.filemode false` after cloning to suppress phantom executable-bit flips in `git status`.

---

## Project status

The v5 system is live at [safeeval.vercel.app](https://safeeval.vercel.app); the v4 single-call classifier was sunset in May 2026. Schema is v5.1 — multi-turn conversation evaluation shipped 2026-05-28 as an additive dual-emit extension (backward-compatible with v5.0.1 consumers). Ontology is v5.2 — one new bright-line (`realtime_synthetic_media_executive_impersonation`, case 4 / Arup) plus ten new L3 values covering AI-enabled fraud, chain-of-fraud markers, and advance-fee pretext variants shipped 2026-05-27 under the case-study Tier 1 improvements goal.

The framework spec, master policy, classifier guidance, and threat models still carry v4.0 typology language anchored in the FAF nodes; their reconciliation to the v5 L1/L2/L3 ontology is tracked as a separate policy-track rewrite.

---

## License

The code in this repository is portfolio work and is not currently published under an open-source license. The policy documents under `docs/` describe a policy framework authored for this project; they are demonstrative artifacts, not a published standard.
