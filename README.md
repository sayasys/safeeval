# SafeEval

A working fraud and scams prompt-evaluation system built as a portfolio project for the Anthropic Safeguards Enforcement Analyst and Fraud & Scams Policy Analyst roles. SafeEval submits a prompt to a structured analysis pipeline built around a custom policy framework (the Fraud Analysis Framework, or FAF), and returns a layered classification, an enforcement disposition, and the underlying evidence that justifies both. The portfolio artifact is the policy and architecture work; the running app is the existence proof that the framework is buildable end to end.

**Live app:** https://safeeval.vercel.app
**Author:** Steven Sayasy (sayasysteven@gmail.com)
**Target roles:** Safeguards Enforcement Analyst, Fraud & Scams Policy Analyst (Anthropic)

---

## Framework summary

The Fraud Analysis Framework describes any fraud-relevant prompt as three nodes (CONTEXT, PROCESS, OBJECTIVE) with structured attributes for each, on top of which sit nine active fraud typologies (romance, investment, phishing, impersonation, advance-fee, fraud infrastructure, recovery, account takeover, AI-enabled abuse) and a closed list of thirteen bright-line features that force a block regardless of aggregate score. The v4.0 system is a single-call classifier built around this framework. The v5 system, currently rolling out, replaces it with a four-stage multi-pipeline (Haiku triage, Sonnet deep analysis, Sonnet classification, rules-plus-Sonnet disposition) and an optional fifth adversarial-review stage. The v5 envelope separates classification (L1 domain, L2 risk pattern, multi-valued L3 tags) from disposition (allow, safe_completion, human_review, block) and preserves the full FAF evidence underneath both.

---

## Where to read more

The docs are layered to match how a reviewer is likely to read them. The shortest path through the artifact is to skim the README, then the framework spec, then the stakeholder brief, then the enforcement design.

| Doc | What it covers |
|---|---|
| `docs/01-framework.md` | The Fraud Analysis Framework: node structure, attributes, typology list. |
| `docs/03-master-policy.md` | The master fraud and scams policy: definitions, prohibited content, legitimate-use carve-outs. |
| `docs/04-enforcement-design.md` | The v5 enforcement architecture: four-stage pipeline, bright-line overrides, failure-mode design. |
| `docs/05-classifier-guidance.md` | Operator-facing guidance for the classifier prompt and signal vocabulary. |
| `docs/06-stakeholder-brief.md` | Portfolio-facing brief: what SafeEval demonstrates about policy-to-technical translation. |
| `docs/threat-models/` | Per-typology threat models (romance, investment, phishing, impersonation, advance-fee, fraud infrastructure, recovery, account takeover, AI-enabled abuse). |
| `v5-design-memo.md` (local) | Full design memo for the v5 redesign: rejected alternatives, open decisions, migration path. Not in the repo; lives alongside it. |

The v5 docs and code are in flight. The framework spec, master policy, classifier guidance, and threat models are at v4.0 and reflect the running app's behavior today; the enforcement design and the stakeholder brief are at v5.0 and describe the architecture the project is migrating to.

---

## Tech stack

- Next.js 15 (App Router) and React 19
- Tailwind CSS
- Anthropic SDK (`@anthropic-ai/sdk`)
- Model: `claude-sonnet-4-6` (v4.0); v5 adds `claude-haiku-4-5` for the triage stage
- Deployed on Vercel; auto-deploys from the `main` branch

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

The v4.0 system is live at https://safeeval.vercel.app and is the version a reviewer is currently interacting with. The v5 redesign (multi-stage pipeline, L1/L2/L3 envelope, separated disposition) is documented in `docs/04-enforcement-design.md` and `docs/06-stakeholder-brief.md` and is being rolled out in stages; see the v5 design memo for the full migration plan. The framework spec, master policy, classifier guidance, and threat models will be bumped to v5 in a later round once the new ontology spec lands.

---

## Contact

Steven Sayasy - sayasysteven@gmail.com
