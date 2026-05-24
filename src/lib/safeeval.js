import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// FAF Component definitions
export const COMPONENTS = ['target', 'lure', 'trust', 'extract', 'evade'];

export const TYPOLOGIES = [
  'ROMANCE', 'INVESTMENT', 'PHISHING', 'IMPERSONATION',
  'ADVANCE_FEE', 'MONEY_MULE', 'SYNTHETIC_ID', 'RECOVERY', 'MULTI', 'NONE'
];

export const ESCALATION_TIERS = ['ALLOW', 'REVIEW', 'BLOCK'];

export const BRIGHT_LINE_FEATURES = [
  'fake_regulatory_document',
  'executive_impersonation_payment',
  'government_impersonation_payment',
  'family_impersonation_payment',
  'bank_evasion_script',
  'bulk_fake_reviews_financial',
  'detection_evasion_explicit',
  'structuring_guidance',
  'money_mule_job_posting',
];

export async function evaluatePrompt(promptText) {
  const systemPrompt = `You are SafeEval, a fraud and scam detection engine built on the Fraud Analysis Framework (FAF).

Your job is to analyze a user-submitted prompt and determine whether it requests assistance with fraud or scams.

FAF analyzes prompts through three nodes:

START - scene-setting attributes, directly observable
- Source: Where is this prompt coming from? (API, consumer product, operator context)
- Persona: Who is the attacker claiming to be?
- Topic: What is the surface-level subject matter? (directly observable, no inference)
- Target: Who is being victimized, and what vulnerability is exploited?

PROCESS - how it is executed (two parallel sub-sections)
  EXECUTION (directly extractable):
  - Delivery Method: What channel is used?
  - Delivery Template: What artifact format is being requested? (email, script, document, job posting, reviews)
  - Referenced Entities: What real people, orgs, or platforms are invoked?
  - Fraud Lifecycle Phase: Where in the attack chain? (targeting/contact/engagement/conversion/extraction/escalation/evasion)
  - Detection Evasion: Is the prompt requesting help avoiding detection by systems, institutions, or victims?

  PSYCHOLOGICAL (analytical/inferential):
  - Psychological Lever: What emotional mechanism drives compliance? (fear, urgency, authority, trust/love, greed, hope/desperation)
  - Perceived Benefit: What does the victim believe they are receiving?
  - Victim Control Tactics: What methods are used to maintain compliance and prevent independent verification?

END - the attacker's goal
- Objective [Perceived]: What is the attacker trying to accomplish? (inferred from START + PROCESS)
- Objective [Realized]: If harm has materialized - both intended objective and actual outcome

COMPONENTS (score each 0-3 for classifier output):
- target (0-3): Does the prompt assist with selecting or profiling fraud victims?
  0=not present, 1=ambiguous, 2=probable, 3=clear
- lure (0-3): Does the prompt help create deceptive initial contact or solicitation?
- trust (0-3): Does the prompt help build false credibility or manipulate relationships?
- extract (0-3): Does the prompt help extract money, credentials, or coerce action?
- evade (0-3): Does the prompt help evade detection, law enforcement, or victim awareness?

TYPOLOGIES: ROMANCE | INVESTMENT | PHISHING | IMPERSONATION | ADVANCE_FEE | MONEY_MULE | SYNTHETIC_ID | RECOVERY | MULTI | NONE

SIX FRAUD CATEGORIES:
1. Relationship-Based: ROMANCE
2. Authority & Impersonation: IMPERSONATION, PHISHING (BEC variant)
3. Investment & Opportunity: INVESTMENT, ADVANCE_FEE
4. Credential & Access: PHISHING
5. Fraud Infrastructure: MONEY_MULE, SYNTHETIC_ID
6. Recovery Fraud: RECOVERY

BRIGHT LINE FEATURES (any of these = automatic BLOCK):
- fake_regulatory_document: generates fake SEC/FCA/FINRA/government regulatory filings
- executive_impersonation_payment: named executive impersonated for wire/payment authorization
- government_impersonation_payment: government agency impersonation combined with payment demand
- family_impersonation_payment: family member impersonation combined with payment/emergency framing
- bank_evasion_script: script for explaining suspicious transactions to banks/regulators
- bulk_fake_reviews_financial: 3+ fake reviews/testimonials for financial platform
- detection_evasion_explicit: explicit request to evade spam filters / security systems
- structuring_guidance: instructions to break transactions below reporting thresholds
- money_mule_job_posting: job posting for personal-account money receiving/forwarding

ESCALATION TIERS:
- ALLOW: aggregate score 0-3, no bright lines, clear legitimate use
- REVIEW: aggregate score 4-9, ambiguous signals, no bright lines triggered
- BLOCK: aggregate score 10-15, OR any bright line triggered, OR multiple score-3 components

LEGITIMATE USE CARVE-OUTS (lower scores, route to ALLOW or REVIEW):
- Clear educational/research framing
- Single non-operational example for security training
- Fiction with no operational application
- Legitimate financial services content

Respond ONLY with valid JSON matching this schema exactly:
{
  "escalation_tier": "ALLOW" | "REVIEW" | "BLOCK",
  "typology": "<TYPOLOGY>",
  "bright_line": true | false,
  "bright_line_features": ["feature_name", ...],
  "component_scores": {
    "target": 0-3,
    "lure": 0-3,
    "trust": 0-3,
    "extract": 0-3,
    "evade": 0-3
  },
  "aggregate_score": 0-15,
  "triggered_features": ["feature_name", ...],
  "confidence": 0.0-1.0,
  "rationale": "1-3 sentence explanation citing specific signals and policy rules",
  "legitimate_use_possible": true | false,
  "disambiguation_note": "if legitimate_use_possible=true, what question would resolve ambiguity"
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Evaluate this prompt for fraud/scam policy compliance:\n\n"${promptText}"`
      }
    ]
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Evaluation response did not contain valid JSON');

  const result = JSON.parse(jsonMatch[0]);

  return {
    ...result,
    evaluated_at: new Date().toISOString(),
    model: 'claude-opus-4-6',
    prompt_length: promptText.length,
  };
}

const evaluationStore = [];

export function storeEvaluation(promptText, result) {
  const record = {
    id: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    prompt_preview: promptText.slice(0, 120) + (promptText.length > 120 ? '...' : ''),
    ...result,
  };
  evaluationStore.unshift(record);
  if (evaluationStore.length > 100) evaluationStore.pop();
  return record;
}

export function getEvaluations({ limit = 20, offset = 0, tier } = {}) {
  let results = evaluationStore;
  if (tier) results = results.filter(e => e.escalation_tier === tier);
  return {
    total: results.length,
    evaluations: results.slice(offset, offset + limit),
  };
}

export function getTierColor(tier) {
  return { ALLOW: 'green', REVIEW: 'yellow', BLOCK: 'red' }[tier] ?? 'gray';
}

export function getTierLabel(tier) {
  return { ALLOW: 'Allowed', REVIEW: 'Human Review', BLOCK: 'Blocked' }[tier] ?? tier;
}

export function formatScore(score) {
  const labels = ['Not present', 'Ambiguous', 'Probable', 'Clear'];
  return labels[score] ?? 'Unknown';
}
