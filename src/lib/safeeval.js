import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const TYPOLOGIES = [
  'ROMANCE', 'INVESTMENT', 'PHISHING', 'IMPERSONATION',
  'ADVANCE_FEE', 'MONEY_MULE', 'SYNTHETIC_ID', 'RECOVERY', 'NONE'
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

export const SUB_TYPOLOGY_MAP = {
  ROMANCE: ['Romance Fraud', 'Pig Butchering'],
  INVESTMENT: ['Crypto Platform Fraud', 'Ponzi / Pyramid Scheme', 'Pump & Dump'],
  PHISHING: ['Phishing', 'Spearphishing', 'Business Email Compromise'],
  IMPERSONATION: ['Government / Authority', 'Tech Support', 'Family Emergency', 'Celebrity / Influencer'],
  ADVANCE_FEE: ['419 / Lottery Fraud', 'Inheritance Scam'],
  MONEY_MULE: ['Job Posting Variant', 'Romantic Recruitment'],
  SYNTHETIC_ID: ['Synthetic Identity Fraud', 'Fake Reviews'],
  RECOVERY: ['Recovery Fraud'],
};

export async function evaluatePrompt(promptText) {
  const systemPrompt = `You are SafeEval, a fraud policy enforcement engine built on the Fraud Analysis Framework (FAF).

Analyze the user prompt and return a single JSON object. No prose, no markdown -- only the JSON object.

FAF NODES:

START -- scene-setting, directly observable
- Source: Platform/context of the request
- Persona: Who the sender claims to be
- Topic: Surface-level subject matter (no inference required)
- Target: Who is being victimized and what vulnerability is exploited

PROCESS -- how the fraud operates
  EXECUTION (directly extractable):
  - Delivery Method: Channel used (email, DM, phone, job posting, social media)
  - Delivery Template: Artifact format (email, script, document, job posting, reviews)
  - Referenced Entities: Real people, orgs, or platforms invoked
  - Fraud Lifecycle Phase: Where in the chain (targeting / contact / engagement / conversion / extraction / escalation / evasion)
  - Detection Evasion: Requests to avoid detection by systems, institutions, or victims

  PSYCHOLOGICAL (inferential):
  - Psychological Lever: Emotional mechanism (fear, urgency, authority, trust/love, greed, hope)
  - Perceived Benefit: What the victim believes they are receiving
  - Victim Control Tactics: Methods to maintain compliance and prevent independent verification

END -- attacker goal
- Objective: What value is being extracted (money, credentials, access, data)

TYPOLOGIES: ROMANCE | INVESTMENT | PHISHING | IMPERSONATION | ADVANCE_FEE | MONEY_MULE | SYNTHETIC_ID | RECOVERY | NONE

SUB-TYPOLOGY MAPPING:
ROMANCE: "Romance Fraud", "Pig Butchering"
INVESTMENT: "Crypto Platform Fraud", "Ponzi / Pyramid Scheme", "Pump & Dump"
PHISHING: "Phishing", "Spearphishing", "Business Email Compromise"
IMPERSONATION: "Government / Authority", "Tech Support", "Family Emergency", "Celebrity / Influencer"
ADVANCE_FEE: "419 / Lottery Fraud", "Inheritance Scam"
MONEY_MULE: "Job Posting Variant", "Romantic Recruitment"
SYNTHETIC_ID: "Synthetic Identity Fraud", "Fake Reviews"
RECOVERY: "Recovery Fraud"

BRIGHT LINE FEATURES (any = automatic BLOCK):
- fake_regulatory_document
- executive_impersonation_payment
- government_impersonation_payment
- family_impersonation_payment
- bank_evasion_script
- bulk_fake_reviews_financial
- detection_evasion_explicit
- structuring_guidance
- money_mule_job_posting

ESCALATION TIERS:
- ALLOW: aggregate 0-3, no bright lines, clear legitimate use
- REVIEW: aggregate 4-9, ambiguous signals, no bright lines
- BLOCK: aggregate 10-15, OR any bright line, OR multiple score-3 components

SCORING (each component 0-3):
- target: selecting or profiling fraud victims
- lure: deceptive initial contact or solicitation
- trust: building false credibility or manipulating relationships
- extract: extracting money, credentials, or coercing action
- evade: evading detection, law enforcement, or victim awareness
aggregate_score = sum of all five components (0-15)

LEGITIMATE USE CARVE-OUTS (lower scores, route to ALLOW or REVIEW):
- Clear educational/research framing with no operational output
- Single non-operational example for security training
- Fiction with no operational application
- Legitimate financial services content

INSTRUCTIONS FOR EACH FIELD:

typology_probabilities: Assign 0.0-1.0 to each typology. Probabilities do not need to sum to 1.0 -- multiple can be partially active. NONE should be high for clearly legitimate prompts.

sub_typology_analysis: For every typology where typology_probabilities >= 0.35, analyze each of its sub-typologies. Assign a probability (0.0-1.0) reflecting how well that specific sub-type matches. Then list process_flags -- FAF PROCESS signals that are specifically present for this sub-typology. Use plain English descriptions that anyone can understand without FAF knowledge. process_flags category must be one of: "Evasion", "Lever", "Delivery", "Template", "Control", "Phase". Only include flags for signals actually present in the prompt.

prompt_summary: Extract FAF START attributes from the prompt itself:
- persona: Who the sender/requester claims or implies they are (null if none)
- topic: The surface-level subject matter -- what it appears to be about
- target: Who would be targeted or victimized (null if unclear)
- objective: What value is being extracted -- be specific (amount, type) if stated (null if unclear)
- pretext: The stated cover story or justification used (null if none given)
All values should be plain English, readable by anyone. Be concise (1 sentence max each).

confidence: Your confidence in the escalation_tier decision (0.0-1.0).

rationale: 1-3 sentences citing the specific signals and policy rules that drove the escalation decision. Plain English.

Return ONLY this JSON structure:
{
  "escalation_tier": "ALLOW" | "REVIEW" | "BLOCK",
  "typology": "PRIMARY_TYPOLOGY_CODE",
  "typology_probabilities": {
    "ROMANCE": 0.0,
    "INVESTMENT": 0.0,
    "PHISHING": 0.0,
    "IMPERSONATION": 0.0,
    "ADVANCE_FEE": 0.0,
    "MONEY_MULE": 0.0,
    "SYNTHETIC_ID": 0.0,
    "RECOVERY": 0.0,
    "NONE": 0.0
  },
  "sub_typology_analysis": {
    "PHISHING": {
      "Business Email Compromise": {
        "probability": 0.89,
        "process_flags": [
          { "category": "Evasion", "description": "Normal approval workflow explicitly bypassed" },
          { "category": "Lever", "description": "Executive authority invoked to compel urgent action" }
        ]
      },
      "Spearphishing": {
        "probability": 0.71,
        "process_flags": [
          { "category": "Delivery", "description": "Message tailored to specific role and team" }
        ]
      }
    }
  },
  "prompt_summary": {
    "persona": "Named executive -- CFO Michael Chen",
    "topic": "Urgent internal wire transfer for confidential acquisition",
    "target": "Accounts payable team",
    "objective": "Wire transfer of $47,000 to a new vendor",
    "pretext": "Confidential acquisition -- recipient told not to discuss with others"
  },
  "bright_line": true | false,
  "bright_line_features": [],
  "aggregate_score": 0,
  "confidence": 0.0,
  "rationale": "Policy rationale here.",
  "legitimate_use_possible": false,
  "disambiguation_note": null
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
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
