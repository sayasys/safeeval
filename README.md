# SafeEval

A working fraud and scams prompt-evaluation system. SafeEval submits a prompt to a structured analysis pipeline built around a custom policy framework (the Fraud Analysis Framework, or FAF), and returns a layered classification, an enforcement disposition, and the underlying evidence that justifies both. The core artifact is the policy and architecture work; the running app is the existence proof that the framework is buildable end to end.

**Live app:** https://safeeval.vercel.app

---

## Framework summary

The Fraud Analysis Framework describes any fraud-relevant prompt as three nodes (CONTEXT, PROCESS, OBJECTIVE) with structured attributes for each, on top of which sit nine fraud typologies (romance, investment, phishing, impersonation, advance-fee, fraud infrastructure, recovery, account takeover, AI-enabled abuse) and a closed list of fourteen bright-line features that force a block regardless of aggregate score. SafeEval runs the v5 system: a four-stage pipeline (Haiku triage, Sonnet deep analysis, Sonnet classification, rules-plus-Sonnet disposition). The v5 envelope separates classification (L1 domain, L2 risk pattern, multi-valued L3 tags) from disposition (allow, safe_completion, human_review, block) and preserves the full FAF evidence underneath both.

---

## Where to read more

The docs are layered to match how a reviewer is likely to read them. The shortest path through the artifact is to skim the README, then the framework spec, then the stakeholder brief, then the enforcement design.

| Doc | What it covers |
|---|---|
| `docs/01-framework.md` | The Fraud Analysis Framework: node structure, attributes, typology list. |
| `docs/03-master-policy.md` | The master fraud and scams policy: definitions, prohibited content, legitimate-use carve-outs. |
| `docs/04-enforcement-design.md` | The v5 enforcement architecture: four-stage pipeline, bright-line overrides, failure-mode design. |
| `docs/05-classifier-guidance.md` | Operator-facing guidance for the classifier prompt and signal vocabulary. |
| `docs/06-stakeholder-brief.md` | Stakeholder brief: what SafeEval demonstrates about policy-to-technical translation. |
| `docs/02-faf-to-l1l2l3-mapping.md` | The classification mapping: how FAF evidence (CONTEXT/PROCESS/OBJECTIVE) maps to L1/L2/L3, with the credential-phishing disambiguation rule. |
| `docs/threat-models/` | Per-typology threat models (romance, investment, phishing, impersonation, advance-fee, fraud infrastructure, recovery, account takeover, AI-enabled abuse). |

The v5 code is the running app. The enforcement design and the stakeholder brief are at v5.0 and describe the architecture in production. The framework spec, master policy, classifier guidance, and threat models still carry v4.0 typology language anchored in the FAF nodes; their reconciliation to the v5 L1/L2/L3 ontology is tracked as a separate policy-track rewrite.

---

## Tech stack

- Next.js 15 (App Router) and React 19
- Tailwind CSS
- Anthropic SDK (`@anthropic-ai/sdk`)
- Models: `claude-haiku-4-5` for Stage 1 triage; `claude-sonnet-4-6` for Stages 2-4 (deep analysis, classification, disposition)
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

The v5 system is live at https://safeeval.vercel.app and is the only running surface; the v4 single-call classifier was sunset in May 2026. The v5 architecture (four-stage pipeline, L1/L2/L3 classification envelope, separated disposition vocabulary) is documented in `docs/04-enforcement-design.md` and `docs/06-stakeholder-brief.md`. The framework spec, master policy, classifier guidance, and threat models still carry v4.0 typology language; their reconciliation to the v5 ontology is a separate policy-track follow-up.
