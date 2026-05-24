# SafeEval

**A fraud and scam detection framework for AI platforms, built on the Universal Fraud Analysis Framework (UFAF)**

[Live Demo →](https://safeeval.vercel.app) · [Policy Framework →](./docs/01-framework.md) · [Master Policy →](./docs/03-master-policy.md)

---

## What this is

SafeEval is a portfolio project demonstrating fraud policy design, enforcement architecture, and policy-to-technical translation for AI platforms — built to show the analytical approach I'd bring to Anthropic's Fraud & Scams team.

It's structured around four pillars that map directly to the Fraud & Scams Analyst role:

| Pillar | What's here |
|---|---|
| **Policy Design & Ownership** | [Universal framework](./docs/01-framework.md), [7 threat models](./docs/threat-models/), [master policy](./docs/03-master-policy.md) with versioning and gap analysis process |
| **Enforcement Strategy** | [Escalation tiers, precision/recall design, human review workflow, feedback loops](./docs/04-enforcement-design.md) |
| **Technical Collaboration** | [Classifier guidance](./docs/05-classifier-guidance.md), [labeled dataset](./data/seed-prompts.json), working [evaluation API](./src/app/api/evaluate/route.js) |
| **Stakeholder Alignment** | [Cross-functional brief](./docs/06-stakeholder-brief.md) covering Legal, Policy, GTM, and external communications |

---

## The Core Idea: Universal Fraud Analysis Framework (UFAF)

Most fraud detection is typology-specific — it recognizes known patterns after they've been catalogued. UFAF is different: it decomposes any fraud into five structural components present in every scheme regardless of surface.

```
TARGET → LURE → TRUST → EXTRACT → EVADE
```

This matters for AI platform fraud because **the threat surface evolves faster than typology-specific playbooks can be written**. An analyst who understands *why* pig butchering works can recognize its mechanics in a novel AI-assisted variant before that variant has been named.

My ecommerce fraud background (account takeover, seller fraud, return abuse, malicious reviews) maps directly to AI fraud:
- **ATO mechanics** → romance scam trust exploitation
- **Seller fraud** → investment fraud (same fake-legitimacy-then-extract pattern)
- **Return abuse** → adversarial prompting (policy exploitation mindset is identical)
- **Malicious reviews** → synthetic identity fraud (fake social proof at scale)

---

## Document Structure

```
docs/
├── 01-framework.md              ← UFAF: the five-component methodology
├── 02-threat-models/            ← One document per typology
│   ├── 01-romance-pig-butchering.md
│   ├── 02-investment-fraud.md
│   ├── 03-phishing-spearphishing.md
│   ├── 04-impersonation-scams.md
│   ├── 05-advance-fee-fraud.md
│   ├── 06-money-mule-recruitment.md
│   └── 07-synthetic-identity-fraud.md
├── 03-master-policy.md          ← Enforceable policy language
├── 04-enforcement-design.md     ← Escalation, precision/recall, workflows
├── 05-classifier-guidance.md    ← Policy → technical translation
└── 06-stakeholder-brief.md      ← Executive/cross-functional summary

data/
└── seed-prompts.json            ← 18 labeled examples with rationale

src/
└── app/
    ├── page.js                  ← Interactive evaluation demo
    └── api/
        ├── evaluate/route.js    ← POST /api/evaluate
        └── evaluations/route.js ← GET /api/evaluations
```

---

## Running Locally

```bash
# Clone the repo
git clone https://github.com/stevensayasy/safeeval.git
cd safeeval

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

```bash
npm install -g vercel
vercel --prod
```

Set `ANTHROPIC_API_KEY` in your Vercel project environment variables.

---

## API Reference

### POST /api/evaluate

Evaluate a prompt against the fraud policy.

**Request:**
```json
{ "prompt": "string (10–5000 chars)" }
```

**Response:**
```json
{
  "escalation_tier": "ALLOW | REVIEW | BLOCK",
  "typology": "ROMANCE | INVESTMENT | PHISHING | ...",
  "bright_line": false,
  "bright_line_features": [],
  "component_scores": { "target": 0, "lure": 1, "trust": 0, "extract": 0, "evade": 0 },
  "aggregate_score": 1,
  "triggered_features": ["relationship_simulation"],
  "confidence": 0.91,
  "rationale": "...",
  "legitimate_use_possible": true,
  "disambiguation_note": "..."
}
```

### GET /api/evaluations

Retrieve recent evaluations.

**Query params:** `limit` (max 100), `offset`, `tier` (ALLOW|REVIEW|BLOCK)

---

## About

Built by [Steven Sayasy](https://linkedin.com/in/steven-sayasy) — Trust & Safety and AI enforcement operations, with expertise in LLM evaluation frameworks, fraud typology analysis, and policy-to-technical translation.
