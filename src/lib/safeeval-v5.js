// src/lib/safeeval-v5.js
// SafeEval v5 engine: 4-stage pipeline (Triage -> FAF -> Classify -> Disposition).
// v5.0.1: Stage 5 adversarial review removed (Decision 11); narrative_summary +
// confidence_path added to disposition (Decision 13); safe_completion_guidance
// branched by L1 (Decision 14); bright-line policy_note added to triggered_by.
//
// Authoritative spec: docs/policy-spec-v5.0.md.
// Companion docs:    docs/07-v5-schema.md  (envelope),
//                    docs/08-v5-ontology.md (vocabulary),
//                    docs/02-faf-to-l1l2l3-mapping.md (classification rules),
//                    docs/04-enforcement-design.md (pipeline rationale).
//
// Pipeline:
//   Stage 1: Triage          (Haiku)  -- coarse L1 + short-circuit on obvious benigns.
//                                        Short-circuit is gated on a measured Haiku precision
//                                        floor (TRIAGE_BENIGN_PRECISION_MIN) and a fraction of
//                                        short-circuited ALLOWs is sampled for offline re-eval.
//   Stage 2: FAF Analysis    (Sonnet) -- evidence object (nodes, scores, bright lines, L2 probs).
//   Stage 3: Classification  (Sonnet, tool-use enum enforcement) -- L1/L2/L3.
//   Stage 4: Disposition     (rules-first, model writes summaries; disposition is final here).
//
// Constraints:
//   - This file is ASCII-only on purpose. Em dashes, smart quotes, arrows, and
//     curly apostrophes will silently corrupt on the Windows-mounted clone path
//     and break Vercel build with "Unexpected eof".
//   - This module is parallel to src/lib/safeeval.js (v4). v4 is untouched.
//   - Dual-emit is wired in src/app/api/evaluate/route.js (?v5=1 opt-in).
//   - All thresholds live in POLICY_CONFIG -- changing a number here does NOT
//     require touching engine logic. (Decision 4.)

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --------------------------------------------------------------------------
// POLICY_CONFIG (mirrored from docs/policy-spec-v5.0.md Section 1)
// --------------------------------------------------------------------------

export const POLICY_CONFIG = {
  // Disposition rule thresholds
  AGGREGATE_BLOCK_THRESHOLD:        10,
  AGGREGATE_ALLOW_THRESHOLD:        3,
  COMPONENT_MAX_VALUE:              3,
  COMPONENT_COUNT:                  5,
  AGGREGATE_MAX:                    15,

  // Triage short-circuit (Stage 1)
  TRIAGE_BENIGN_CONFIDENCE_MIN:     0.92,
  TRIAGE_RISK_MARKERS_MAX:          0,

  // Triage precision gate (Stage 1) -- Decision 12.
  // Stage 1 short-circuit is permitted only when Haiku's measured benign
  // precision is at least this threshold. The measurement is in
  // scripts/measure-haiku-precision.js; the seed dataset is in
  // data/haiku-precision-seed.jsonl. The engine does NOT enforce this at
  // runtime; the gate is documentary + a precondition for shipping changes
  // that touch SYSTEM_STAGE_1_TRIAGE or the short-circuit logic.
  TRIAGE_BENIGN_PRECISION_MIN:      0.98,

  // Triage observability (Stage 1) -- Decision 12.
  // Fraction of Stage 1 short-circuited ALLOW outputs that are flagged in the
  // trace for offline re-evaluation. Sampling is deterministic on a stable
  // prompt hash so the same prompt always samples the same way.
  TRIAGE_OBSERVABILITY_SAMPLE_RATE: 0.10,

  // Classifier confidences (Stage 3)
  L1_CONFIDENCE_MIN:                0.50,
  L2_CONFIDENCE_MIN:                0.50,
  L3_EMIT_CONFIDENCE_MIN:           0.50,
  L2_HUMAN_REVIEW_THRESHOLD:        0.60,

  // L2 selection consistency with evidence (schema rule 12, phase-2b decision 2.5).
  // Picked L2's probability in evidence.l2_probabilities SHOULD be within this
  // tolerance of the maximum probability. Out-of-tolerance picks fall back to
  // argmax with a structured pipeline_trace.errors entry.
  L2_PICK_PROBABILITY_TOLERANCE:    0.05,

  // Sub-typology / L2-prob display
  SUB_TYPOLOGY_API_THRESHOLD:       0.60,
  SUB_TYPOLOGY_DISPLAY_THRESHOLD:   0.65,

  // Risk-marker escalation
  RISK_MARKER_REVIEW_COUNT:         2,

  // Validation
  REASONING_SUMMARY_MAX_CHARS:      280,
  NARRATIVE_SUMMARY_MAX_CHARS:      600,   // Decision 13: stakeholder-readable prose cap.
  PROMPT_LENGTH_MIN:                10,
  PROMPT_LENGTH_MAX:                5000,

  // Pipeline trace exposure
  PIPELINE_TRACE_DEFAULT:           'off',
};

// --------------------------------------------------------------------------
// DISPOSITION_SEMANTICS (Decision 14)
// Named operational semantics for each disposition verb. Downstream consumers
// (UI, reviewer queue, dual-emit translator) read from this object instead of
// inferring meaning from the verb. See policy-spec-v5.0.md Section 6.2.
// --------------------------------------------------------------------------

export const DISPOSITION_SEMANTICS = {
  allow: {
    description: 'Grant request. No constraints.',
    guidance:    null,
  },
  safe_completion: {
    description: 'Grant request with framing constraints. Respond defensively.',
    // The actual guidance string is branched by L1 at runtime in
    // buildSafeCompletionGuidance(). The strings below are the templates.
    guidance: {
      security_education: 'Security-education context: assume authorized defensive use. Respond pedagogically with explicit defender framing; describe the attack pattern so a defender or potential victim can recognize it.',
      dual_use:           'Dual-use context: respond defensively. Discuss dynamics without producing a directly weaponizable artifact (no working template, page, or script).',
    },
  },
  human_review: {
    description: 'Route to abuse review queue. Human decides. Reviewer reads reasoning_summary, narrative_summary, and triggered_by.',
    guidance:    null,
  },
  block: {
    description: 'Deny request. Return policy explanation. When triggered_by names bright_lines, the block is non-negotiable.',
    guidance:    null,
  },
};

function buildSafeCompletionGuidance(l1Value) {
  if (l1Value === 'security_education') return DISPOSITION_SEMANTICS.safe_completion.guidance.security_education;
  return DISPOSITION_SEMANTICS.safe_completion.guidance.dual_use;
}

// --------------------------------------------------------------------------
// Closed enums (mirrored verbatim from policy-spec-v5.0.md sections 2-6)
// --------------------------------------------------------------------------

export const L1_VALUES = [
  'benign',
  'security_education',
  'ambiguous_dual_use',
  'deceptive_fraud',
  'privacy_abuse',
  'platform_abuse',
  'cyber_intrusion',
];

// Section 7: L1 -> L2 constraint table (copy-paste ready).
export const L2_BY_L1 = {
  benign: [
    'no_risk_pattern',
    'customer_support_inquiry',
    'general_information',
    'creative_writing',
    'educational_inquiry',
  ],
  security_education: [
    'phishing_awareness',
    'malware_education',
    'fraud_pattern_research',
    'defensive_simulation_authorized',
    'victim_support',
  ],
  ambiguous_dual_use: [
    'borderline_security_research',
    'borderline_red_team',
    'borderline_journalism',
    'borderline_education_request',
  ],
  deceptive_fraud: [
    'romance_fraud',
    'investment_fraud',
    'advance_fee_fraud',
    'phishing_attack',
    'impersonation_scam',
    'recovery_fraud',
    'fraud_infrastructure',
    'marketplace_fraud',
    'refund_payment_fraud',
    'identity_fraud',
  ],
  privacy_abuse: [
    'credential_theft',
    'account_takeover',
    'private_data_misuse',
    'doxxing_or_stalking',
  ],
  platform_abuse: [
    'promotion_abuse',
    'multi_accounting',
    'reputation_manipulation',
    'automation_botting',
    'ban_evasion',
  ],
  cyber_intrusion: [
    'credential_harvesting_infra',
    'malware_distribution',
    'prompt_injection_attack',
    'model_jailbreak',
    'ai_model_impersonation',
  ],
};

export const ALL_L2_VALUES = Object.values(L2_BY_L1).flat();

export const L3_CATEGORIES = ['method', 'tactic', 'target', 'context_marker', 'overlap', 'risk_marker'];

export const L3_VALUES_BY_CATEGORY = {
  method: [
    'phishing', 'smishing', 'vishing',
    'credential_harvesting_page', 'mfa_intercept', 'sim_swap',
    'deepfake_audio', 'deepfake_video',
    'sock_puppet', 'fake_storefront',
    'prompt_injection', 'jailbreak_framing',
    'synthetic_document_forgery',
    'pretexting_phone', 'pretexting_email',
    'money_mule_recruitment',
    'synthetic_identity_construction',
    'fake_review_generation',
  ],
  tactic: [
    'urgency', 'fear', 'authority',
    'trust_love', 'greed', 'scarcity',
    'reciprocity', 'isolation',
  ],
  target: [
    'enterprise_employee', 'enterprise_executive',
    'enterprise_it_credentials', 'enterprise_finance',
    'financial_account', 'payment_card',
    'crypto_holder', 'elderly_individual',
    'recent_fraud_victim', 'public_figure',
    'lonely_individual', 'job_seeker', 'consumer_general',
  ],
  context_marker: [
    'security_training', 'internal_simulation_claimed',
    'authorized_pentest_claimed', 'journalism_claimed',
    'fiction_creative', 'academic_research',
    'defensive_analysis', 'roleplay_hypothetical',
  ],
  overlap: [
    'account_takeover_enablement', 'payment_fraud_enablement',
    'identity_fraud_enablement', 'money_laundering_overlap',
    'content_moderation_overlap', 'extortion_overlap',
    'csam_adjacency',
  ],
  risk_marker: [
    'deceptive_effectiveness_requested', 'anti_detection_requested',
    'scale_enablement_requested', 'specific_victim_targeted',
    'authorization_unverifiable', 'payment_instruction_embedded',
  ],
};

export const DISPOSITION_ACTIONS = ['allow', 'safe_completion', 'human_review', 'block'];

// 14 bright-line features per spec section 5 (13 v4 carry-forward + mfa_or_otp_harvesting new in v5).
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
  'credential_harvesting_page',
  'account_takeover_script',
  'ai_model_impersonation',
  'prompt_injection_payload',
  'mfa_or_otp_harvesting',
];

// Bright lines that constrain the L2 set the classifier may choose from.
// Decision 9: ai_model_impersonation bright-line MUST co-occur with L2 'ai_model_impersonation'
// under L1 'cyber_intrusion' (single-element forced set).
export const BRIGHT_LINE_FORCED_L2 = {
  credential_harvesting_page:        ['credential_theft', 'account_takeover', 'credential_harvesting_infra'],
  mfa_or_otp_harvesting:             ['credential_theft', 'account_takeover'],
  account_takeover_script:           ['account_takeover'],
  money_mule_job_posting:            ['fraud_infrastructure'],
  bulk_fake_reviews_financial:       ['fraud_infrastructure', 'reputation_manipulation'],
  prompt_injection_payload:          ['prompt_injection_attack'],
  ai_model_impersonation:            ['ai_model_impersonation'],
  fake_regulatory_document:          ['impersonation_scam', 'investment_fraud'],
  executive_impersonation_payment:   ['impersonation_scam', 'phishing_attack'],
  government_impersonation_payment:  ['impersonation_scam'],
  family_impersonation_payment:      ['impersonation_scam'],
  bank_evasion_script:               ['romance_fraud', 'investment_fraud', 'advance_fee_fraud'],
  detection_evasion_explicit:        [],
  structuring_guidance:              [],
};

// Section 8 v4 -> v5 mapping (used by deriveV4Legacy for dual-emit).
export const V5_TO_V4_TYPOLOGY = {
  romance_fraud:                   'ROMANCE',
  investment_fraud:                'INVESTMENT',
  advance_fee_fraud:               'ADVANCE_FEE',
  phishing_attack:                 'PHISHING',
  impersonation_scam:              'IMPERSONATION',
  recovery_fraud:                  'RECOVERY',
  fraud_infrastructure:            'FRAUD_INFRASTRUCTURE',
  marketplace_fraud:               'FRAUD_INFRASTRUCTURE',
  refund_payment_fraud:            'FRAUD_INFRASTRUCTURE',
  identity_fraud:                  'FRAUD_INFRASTRUCTURE',
  credential_theft:                'PHISHING',
  account_takeover:                'ACCOUNT_TAKEOVER',
  private_data_misuse:             'ACCOUNT_TAKEOVER',
  doxxing_or_stalking:             'ACCOUNT_TAKEOVER',
  promotion_abuse:                 'NONE',
  multi_accounting:                'NONE',
  reputation_manipulation:         'FRAUD_INFRASTRUCTURE',
  automation_botting:              'NONE',
  ban_evasion:                     'NONE',
  credential_harvesting_infra:     'PHISHING',
  malware_distribution:            'AI_ENABLED_ABUSE',
  prompt_injection_attack:         'AI_ENABLED_ABUSE',
  model_jailbreak:                 'AI_ENABLED_ABUSE',
  ai_model_impersonation:          'AI_ENABLED_ABUSE',
  no_risk_pattern:                 'NONE',
  customer_support_inquiry:        'NONE',
  general_information:             'NONE',
  creative_writing:                'NONE',
  educational_inquiry:             'NONE',
  phishing_awareness:              'NONE',
  malware_education:               'NONE',
  fraud_pattern_research:          'NONE',
  defensive_simulation_authorized: 'NONE',
  victim_support:                  'NONE',
  borderline_security_research:    'NONE',
  borderline_red_team:             'NONE',
  borderline_journalism:           'NONE',
  borderline_education_request:    'NONE',
};

// v4 -> v5 L1/L2 migration table (ontology section 6).
// Used by Stage 3 validation as a defensive fallback when a v4 typology code
// leaks into classification.l1.value despite the closed-set enum constraint
// on the Stage 3 tool. Each row picks one canonical (L1, L2) target; the
// PHISHING and AI_ENABLED_ABUSE rows have sub-type variants disambiguated
// inline at the call site.
//
// Authority: docs/memos/2026-05-25-policy-classifier-translator-spec.md sec 3.3.
export const V4_TO_V5_L1_L2 = {
  NONE:                  { l1: 'benign',          l2: 'no_risk_pattern' },
  ROMANCE:               { l1: 'deceptive_fraud', l2: 'romance_fraud' },
  INVESTMENT:            { l1: 'deceptive_fraud', l2: 'investment_fraud' },
  IMPERSONATION:         { l1: 'deceptive_fraud', l2: 'impersonation_scam' },
  ADVANCE_FEE:           { l1: 'deceptive_fraud', l2: 'advance_fee_fraud' },
  FRAUD_INFRASTRUCTURE:  { l1: 'deceptive_fraud', l2: 'fraud_infrastructure' },
  RECOVERY:              { l1: 'deceptive_fraud', l2: 'recovery_fraud' },
  ACCOUNT_TAKEOVER:      { l1: 'privacy_abuse',   l2: 'account_takeover' },
};

// The set of legacy v4 L1 codes that may leak. PHISHING and AI_ENABLED_ABUSE
// are not in V4_TO_V5_L1_L2 because they require sub-type disambiguation; the
// migrator at the call site handles them separately.
export const LEGACY_V4_L1_CODES = [
  'NONE', 'PHISHING', 'ROMANCE', 'INVESTMENT', 'IMPERSONATION', 'ADVANCE_FEE',
  'FRAUD_INFRASTRUCTURE', 'RECOVERY', 'ACCOUNT_TAKEOVER', 'AI_ENABLED_ABUSE',
];

// PHISHING disambiguation heuristic: BEC-for-money requires explicit money-transfer
// framing (wire, ACH, invoice, payment, transfer of funds). Otherwise default to
// credential-targeting (privacy_abuse / credential_theft) per memo section 3.2.
const MONEY_TRANSFER_PATTERN = /\b(wire|ach|swift|invoice|transfer|payment|funds|payout|remittance|bank\s+transfer)\b/i;

export function migrateLegacyV4L1(v4Code, prompt) {
  if (V4_TO_V5_L1_L2[v4Code]) return V4_TO_V5_L1_L2[v4Code];
  if (v4Code === 'PHISHING') {
    return MONEY_TRANSFER_PATTERN.test(prompt || '')
      ? { l1: 'deceptive_fraud', l2: 'phishing_attack' }
      : { l1: 'privacy_abuse',   l2: 'credential_theft' };
  }
  if (v4Code === 'AI_ENABLED_ABUSE') {
    // Default to prompt_injection_attack with disambiguation tag (memo sec 3.3).
    return { l1: 'cyber_intrusion', l2: 'prompt_injection_attack', ambiguous: true };
  }
  return null;
}

// --------------------------------------------------------------------------
// Models per stage
// --------------------------------------------------------------------------

const MODEL_TRIAGE = 'claude-haiku-4-5';
const MODEL_DEEP   = 'claude-sonnet-4-6';

// --------------------------------------------------------------------------
// Stage prompts (system messages)
// --------------------------------------------------------------------------

export const SYSTEM_STAGE_1_TRIAGE = [
  'You are a fast-pass safety triage classifier for a fraud-policy evaluation system.',
  '',
  'Your only job is coarse domain routing. You are NOT the final classifier.',
  '',
  'Given a user prompt, return strict JSON with these fields:',
  '  l1_candidate: one of',
  '    benign, security_education, ambiguous_dual_use, deceptive_fraud,',
  '    privacy_abuse, platform_abuse, cyber_intrusion',
  '  l1_confidence: float 0..1',
  '  coarse_context: { topic: string, persona: string|null, target: string|null, risk_markers: [string] }',
  '',
  'Definitions:',
  '  benign -- no meaningful abuse risk. Customer support, info, education, creative.',
  '  security_education -- defensively framed: awareness training, blue-team analysis, victim support.',
  '  ambiguous_dual_use -- could be defensive or offensive depending on actor.',
  '  deceptive_fraud -- purpose is to deceive a victim into transferring money/goods/trust.',
  '  privacy_abuse -- targets credentials, accounts, personal data, surveillance.',
  '  platform_abuse -- manipulates platform mechanics (multi-accounting, promo abuse, etc).',
  '  cyber_intrusion -- enables technical attacks (prompt injection, jailbreak, malware).',
  '',
  'Risk markers (include any that obviously apply, lowercase exact strings):',
  '  deceptive_effectiveness_requested',
  '  anti_detection_requested',
  '  scale_enablement_requested',
  '  specific_victim_targeted',
  '  payment_instruction_embedded',
  '  authorization_unverifiable',
  '',
  'When in doubt, prefer ambiguous_dual_use. Cap l1_confidence at 0.85 unless the prompt is clearly one domain.',
  '',
  'Output ONLY the JSON object. No prose, no code fences.',
].join('\n');

const SYSTEM_STAGE_2_FAF = [
  'You are the deep-analysis stage of a fraud-policy evaluation system.',
  '',
  'Apply the Fraud Analysis Framework (FAF v5 evidence model):',
  '',
  'CONTEXT node:',
  '  source: who is initiating (user|unknown)',
  '  persona: claimed identity, or null',
  '  topic: the substantive subject',
  '  target: who/what is targeted, or null',
  '  relationship_phase: one of',
  '    targeting, contact, engagement, conversion, extraction, escalation, evasion',
  '',
  'PROCESS node:',
  '  execution: { delivery_method, delivery_template, referenced_entities }',
  '  psychological: { trigger, incentive, control }',
  '    trigger: one of fear, urgency, authority, trust_love, greed, scarcity, reciprocity, isolation',
  '    incentive: what the victim is falsely promised',
  '    control: how compliance is maintained and detection avoided',
  '',
  'OBJECTIVE node:',
  '  objective: what the attacker is trying to achieve',
  '',
  'Component scores (each 0..3 integer):',
  '  target -- specificity and vulnerability of intended victim',
  '  lure   -- attractiveness and credibility of the inducement',
  '  trust  -- effort to manufacture trust or authority',
  '  extract -- how the asset (money / credentials / data) is taken',
  '  evade  -- detection evasion built into the request',
  '',
  'Process flags: array of { category, description } where category is one of',
  '  Trigger, Incentive, Control, Delivery, Template',
  '',
  'Bright lines (high-confidence indicators that auto-block downstream). Emit any that apply:',
  '  fake_regulatory_document, executive_impersonation_payment, government_impersonation_payment,',
  '  family_impersonation_payment, bank_evasion_script, bulk_fake_reviews_financial,',
  '  detection_evasion_explicit, structuring_guidance, money_mule_job_posting,',
  '  credential_harvesting_page, account_takeover_script, ai_model_impersonation,',
  '  prompt_injection_payload, mfa_or_otp_harvesting',
  '',
  'L2 probability map: a sparse map of L2 typology values to probabilities 0..1.',
  '  Allowed L2 values (only emit probabilities for L2s with any signal):',
  '    no_risk_pattern, customer_support_inquiry, general_information, creative_writing,',
  '    educational_inquiry, phishing_awareness, malware_education, fraud_pattern_research,',
  '    defensive_simulation_authorized, victim_support, borderline_security_research,',
  '    borderline_red_team, borderline_journalism, borderline_education_request,',
  '    romance_fraud, investment_fraud, advance_fee_fraud, phishing_attack,',
  '    impersonation_scam, recovery_fraud, fraud_infrastructure, marketplace_fraud,',
  '    refund_payment_fraud, identity_fraud, credential_theft, account_takeover,',
  '    private_data_misuse, doxxing_or_stalking, promotion_abuse, multi_accounting,',
  '    reputation_manipulation, automation_botting, ban_evasion,',
  '    credential_harvesting_infra, malware_distribution, prompt_injection_attack,',
  '    model_jailbreak, ai_model_impersonation',
  '',
  'Output strict JSON only:',
  '{',
  '  "faf_nodes": { "context": {...}, "process": { "execution": {...}, "psychological": {...} }, "objective": {...} },',
  '  "component_scores": { "target": int, "lure": int, "trust": int, "extract": int, "evade": int },',
  '  "aggregate_score": int,',
  '  "bright_lines": [string],',
  '  "process_flags": [{ "category": string, "description": string }],',
  '  "l2_probabilities": { "<L2 value>": float, ... },',
  '  "prompt_summary": { "persona": string|null, "topic": string, "target": string|null, "objective": string|null, "pretext": string|null }',
  '}',
  '',
  'aggregate_score MUST equal the sum of component_scores. Be conservative on bright lines.',
  'Output ONLY the JSON object. No prose, no code fences.',
].join('\n');

const SYSTEM_STAGE_3_CLASSIFY = [
  'You are the classification stage of a fraud-policy evaluation system.',
  '',
  'You will receive: (a) the original prompt, (b) the Stage 1 triage output, and',
  '(c) the Stage 2 FAF evidence. You must emit a final L1 / L2 / L3 classification.',
  '',
  'You MUST emit the classification by calling the emit_classification tool exactly once.',
  'Do not respond with prose. The tool has strict enum constraints; conform to them.',
  '',
  'L1 must be one of: benign, security_education, ambiguous_dual_use, deceptive_fraud,',
  'privacy_abuse, platform_abuse, cyber_intrusion.',
  '',
  'L2 must be valid under the chosen L1. See the tool description for allowed L2 values per L1.',
  '',
  'L3 is multi-valued. Each L3 entry has the form "<category>:<value>" with category one of',
  'method, tactic, target, context_marker, overlap, risk_marker. Emit confidences 0..1.',
  'Filter out any tag below 0.50 confidence.',
  '',
  'When the evidence contains bright lines, your L2 must come from the bright-line-forced',
  'L2 set for that bright line where one is defined. If you would have chosen a different L2,',
  'override to the forced one. In particular: when the bright line ai_model_impersonation',
  'fires, L1 MUST be cyber_intrusion and L2 MUST be ai_model_impersonation.',
].join('\n');

const SYSTEM_STAGE_4_DISPOSITION = [
  'You are the disposition stage of a fraud-policy evaluation system.',
  '',
  'You will receive: the classification, the FAF evidence, and which deterministic rules',
  'have already fired. Your job is to fill in two summary fields:',
  '  reasoning_summary  -- 1 to 3 sentences, <= 280 chars. Audit-grade short justification.',
  '                        Cite the specific rule (e.g., "bright_line_forces_block") and the',
  '                        evidence (e.g., "credential_harvesting_page bright line matched").',
  '  narrative_summary  -- 1 to 2 paragraphs, <= 600 chars. Stakeholder-readable prose. Tell',
  '                        the story: what the prompt is asking for, what evidence the system',
  '                        saw, what classification followed, and why the action is what it is.',
  '                        Plain language, no JSON, no field references in prose.',
  '',
  'In most cases the action has already been decided by a deterministic rule; emit it back',
  'unchanged. The "deterministic rule outcome" block in the user message tells you whether a',
  'rule decided and which one. When the rule has decided, your summaries justify the decision;',
  'when the rule says model_adjudicated, you choose among allow / safe_completion / human_review / block',
  'and your summaries explain the choice.',
  '',
  'Allowed actions: allow, safe_completion, human_review, block.',
  '',
  'Emit by calling the emit_disposition tool exactly once.',
].join('\n');

// --------------------------------------------------------------------------
// Tool definitions (Stage 3 and Stage 4)
// --------------------------------------------------------------------------

function buildClassifyTool() {
  return {
    name: 'emit_classification',
    description:
      'Emit the final L1/L2/L3 classification. L2 must be valid for the chosen L1: ' +
      Object.entries(L2_BY_L1)
        .map(function (e) { return e[0] + ' -> [' + e[1].join(', ') + ']'; })
        .join('; '),
    input_schema: {
      type: 'object',
      properties: {
        l1: {
          type: 'object',
          properties: {
            value: { type: 'string', enum: L1_VALUES },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['value', 'confidence'],
        },
        l2: {
          type: 'object',
          properties: {
            value: { type: 'string', enum: ALL_L2_VALUES },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['value', 'confidence'],
        },
        l3: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['value', 'confidence'],
          },
        },
      },
      required: ['l1', 'l2', 'l3'],
    },
  };
}

function buildDispositionTool() {
  return {
    name: 'emit_disposition',
    description: 'Emit the final disposition. safe_completion_guidance is NOT set by the model -- the engine computes it from L1. Do not include it.',
    input_schema: {
      type: 'object',
      properties: {
        action:             { type: 'string', enum: DISPOSITION_ACTIONS },
        confidence:         { type: 'number', minimum: 0, maximum: 1 },
        reasoning_summary:  { type: 'string', maxLength: POLICY_CONFIG.REASONING_SUMMARY_MAX_CHARS },
        narrative_summary:  { type: 'string', maxLength: POLICY_CONFIG.NARRATIVE_SUMMARY_MAX_CHARS },
      },
      required: ['action', 'confidence', 'reasoning_summary', 'narrative_summary'],
    },
  };
}

// --------------------------------------------------------------------------
// Stage 1: Triage (Haiku)
// --------------------------------------------------------------------------

async function stage1Triage(prompt) {
  const t0 = Date.now();
  try {
    const resp = await anthropic.messages.create({
      model: MODEL_TRIAGE,
      max_tokens: 400,
      temperature: 0.0,
      system: SYSTEM_STAGE_1_TRIAGE,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (resp.content[0] && resp.content[0].text) || '';
    const parsed = parseJsonObject(text);
    if (!parsed) throw new Error('triage_invalid_json');
    if (!L1_VALUES.includes(parsed.l1_candidate)) {
      parsed.l1_candidate = 'ambiguous_dual_use';
      parsed.l1_confidence = Math.min(parsed.l1_confidence || 0.5, 0.5);
    }
    parsed.l1_confidence = clamp01(parsed.l1_confidence || 0.5);
    parsed.coarse_context = parsed.coarse_context || { topic: '', persona: null, target: null, risk_markers: [] };
    if (!Array.isArray(parsed.coarse_context.risk_markers)) parsed.coarse_context.risk_markers = [];
    return {
      ok: true,
      output: parsed,
      duration_ms: Date.now() - t0,
      input_tokens: resp.usage && resp.usage.input_tokens,
      output_tokens: resp.usage && resp.usage.output_tokens,
      model: MODEL_TRIAGE,
    };
  } catch (err) {
    return {
      ok: false,
      error: String((err && err.message) || err),
      duration_ms: Date.now() - t0,
      model: MODEL_TRIAGE,
    };
  }
}

// --------------------------------------------------------------------------
// Stage 2: FAF Deep Analysis (Sonnet)
// --------------------------------------------------------------------------

async function stage2FAFAnalysis(prompt, triageOutput) {
  const t0 = Date.now();
  const triageContext = triageOutput && triageOutput.ok
    ? '\n\n[Stage 1 triage hint]\n' + JSON.stringify(triageOutput.output)
    : '';
  try {
    const resp = await anthropic.messages.create({
      model: MODEL_DEEP,
      max_tokens: 2048,
      temperature: 0.1,
      system: SYSTEM_STAGE_2_FAF,
      messages: [{ role: 'user', content: prompt + triageContext }],
    });
    const text = (resp.content[0] && resp.content[0].text) || '';
    const parsed = parseJsonObject(text);
    if (!parsed) throw new Error('faf_invalid_json');

    // Coerce + validate.
    parsed.component_scores = parsed.component_scores || {};
    ['target', 'lure', 'trust', 'extract', 'evade'].forEach(function (k) {
      parsed.component_scores[k] = clampInt(parsed.component_scores[k], 0, POLICY_CONFIG.COMPONENT_MAX_VALUE);
    });
    parsed.aggregate_score =
      parsed.component_scores.target +
      parsed.component_scores.lure +
      parsed.component_scores.trust +
      parsed.component_scores.extract +
      parsed.component_scores.evade;
    parsed.bright_lines = Array.isArray(parsed.bright_lines)
      ? parsed.bright_lines.filter(function (b) { return BRIGHT_LINE_FEATURES.includes(b); })
      : [];
    parsed.process_flags = Array.isArray(parsed.process_flags) ? parsed.process_flags : [];
    parsed.l2_probabilities = parsed.l2_probabilities || {};
    Object.keys(parsed.l2_probabilities).forEach(function (k) {
      if (!ALL_L2_VALUES.includes(k)) delete parsed.l2_probabilities[k];
      else parsed.l2_probabilities[k] = clamp01(parsed.l2_probabilities[k]);
    });
    parsed.prompt_summary = parsed.prompt_summary || { persona: null, topic: '', target: null, objective: null, pretext: null };

    return {
      ok: true,
      output: parsed,
      duration_ms: Date.now() - t0,
      input_tokens: resp.usage && resp.usage.input_tokens,
      output_tokens: resp.usage && resp.usage.output_tokens,
      model: MODEL_DEEP,
    };
  } catch (err) {
    return {
      ok: false,
      error: String((err && err.message) || err),
      duration_ms: Date.now() - t0,
      model: MODEL_DEEP,
    };
  }
}

// --------------------------------------------------------------------------
// Stage 3: Classification (Sonnet, tool-use enforced)
// --------------------------------------------------------------------------

async function stage3Classify(prompt, triageOutput, fafOutput) {
  const t0 = Date.now();
  const tool = buildClassifyTool();
  const evidence = fafOutput && fafOutput.ok ? fafOutput.output : null;
  const triage   = triageOutput && triageOutput.ok ? triageOutput.output : null;
  const userMsg = [
    'PROMPT:',
    prompt,
    '',
    'STAGE 1 TRIAGE:',
    JSON.stringify(triage),
    '',
    'STAGE 2 EVIDENCE:',
    JSON.stringify(evidence),
    '',
    'L3 categories: method, tactic, target, context_marker, overlap, risk_marker.',
    'Allowed L3 values per category:',
    JSON.stringify(L3_VALUES_BY_CATEGORY, null, 2),
  ].join('\n');

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_DEEP,
      max_tokens: 1024,
      temperature: 0.0,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'emit_classification' },
      system: SYSTEM_STAGE_3_CLASSIFY,
      messages: [{ role: 'user', content: userMsg }],
    });
    const toolUse = resp.content.find(function (b) { return b.type === 'tool_use' && b.name === 'emit_classification'; });
    if (!toolUse) throw new Error('classify_no_tool_use');
    const args = toolUse.input || {};

    // Validation errors get pushed up to the orchestrator-level pipeline_trace.errors.
    const validationErrors = [];
    // Set when the picked L2 is absent from a non-empty l2_probabilities map
    // (rule 12 MUST violation). The orchestrator coerces disposition to
    // human_review with validation_fallback in triggered_by.rules.
    let mustFallback = false;

    // L1 closed-set enforcement + v4-to-v5 migration (ontology section 1,
    // memo 2026-05-25-policy-classifier-translator-spec section 3.3).
    const rawL1 = args.l1 && args.l1.value;
    if (!L1_VALUES.includes(rawL1)) {
      if (LEGACY_V4_L1_CODES.includes(rawL1)) {
        const migrated = migrateLegacyV4L1(rawL1, prompt);
        if (migrated) {
          validationErrors.push(
            'stage_3: v4_l1_migrated from=' + rawL1 +
            ' to_l1=' + migrated.l1 +
            ' to_l2=' + migrated.l2
          );
          args.l1 = { value: migrated.l1, confidence: clamp01(args.l1 && args.l1.confidence) || 0.7 };
          args.l2 = { value: migrated.l2, confidence: clamp01(args.l2 && args.l2.confidence) || 0.7 };
          // AI_ENABLED_ABUSE default carries a disambiguation L3 tag.
          if (migrated.ambiguous) {
            args.l3 = Array.isArray(args.l3) ? args.l3 : [];
            args.l3.push({ value: 'risk_marker:disambiguation_ambiguous', confidence: 0.7 });
          }
        } else {
          args.l1 = { value: 'ambiguous_dual_use', confidence: 0.5 };
        }
      } else {
        args.l1 = { value: 'ambiguous_dual_use', confidence: 0.5 };
      }
    }

    // Validate L2 belongs to the chosen L1.
    const allowedL2 = L2_BY_L1[args.l1.value];
    if (!args.l2 || !allowedL2.includes(args.l2.value)) {
      args.l2 = { value: allowedL2[0], confidence: 0.4 };
    }
    args.l1.confidence = clamp01(args.l1.confidence);
    args.l2.confidence = clamp01(args.l2.confidence);

    // Pre-compute l2_probabilities snapshot once (used by both the bright-line
    // forcer and the rule-12 enforcement that follows).
    const probs = (evidence && evidence.l2_probabilities) || {};
    const probKeys = Object.keys(probs);

    // Apply bright-line L2 forcing (Decision 9 enforced: ai_model_impersonation
    // bright-line forces L1=cyber_intrusion / L2=ai_model_impersonation).
    // When the bright-line allows multiple L2s, prefer the one with the highest
    // probability in evidence.l2_probabilities -- this keeps the forced pick
    // consistent with rule 12 instead of always defaulting to forced[0].
    if (evidence && Array.isArray(evidence.bright_lines) && evidence.bright_lines.length > 0) {
      for (const bl of evidence.bright_lines) {
        const forced = BRIGHT_LINE_FORCED_L2[bl];
        if (forced && forced.length > 0 && !forced.includes(args.l2.value)) {
          // Pick the forced L2 with the highest probability in the map; fall back
          // to forced[0] when none of the forced candidates appear in the map.
          let newL2 = forced[0];
          let bestProb = -1;
          for (const candidate of forced) {
            const p = probs[candidate];
            if (typeof p === 'number' && p > bestProb) {
              bestProb = p;
              newL2 = candidate;
            }
          }
          for (const l1 of L1_VALUES) {
            if (L2_BY_L1[l1].includes(newL2)) {
              args.l1 = { value: l1, confidence: Math.max(args.l1.confidence, 0.9) };
              args.l2 = { value: newL2, confidence: Math.max(args.l2.confidence, 0.9) };
              break;
            }
          }
        }
      }
    }

    // Schema rule 12: L2 / l2_probabilities co-occurrence invariant.
    // Runs AFTER bright-line forcing so the final L1/L2 pair (post-forcing) is
    // what gets checked. MUST: classification.l2.value must appear as a key in
    // evidence.l2_probabilities. SHOULD: its probability there should be within
    // L2_PICK_PROBABILITY_TOLERANCE of the argmax-within-L1. Skip enforcement
    // when l2_probabilities is empty (Stage 2 failure fallback case).
    if (probKeys.length > 0) {
      const finalAllowedL2 = L2_BY_L1[args.l1.value];
      const eligibleKeys = probKeys.filter(function (k) { return finalAllowedL2.includes(k); });
      let argmaxKey = null; let argmaxProb = -1;
      eligibleKeys.forEach(function (k) {
        if (probs[k] > argmaxProb) { argmaxProb = probs[k]; argmaxKey = k; }
      });
      let overallMaxKey = null; let overallMax = -1;
      probKeys.forEach(function (k) {
        if (probs[k] > overallMax) { overallMax = probs[k]; overallMaxKey = k; }
      });

      const pickedProb = probs[args.l2.value];
      if (typeof pickedProb !== 'number') {
        // MUST violation: picked L2 is not a key in the probability map.
        validationErrors.push(
          'stage_3: l2_must_violation picked=' + args.l2.value +
          ' max_key=' + (overallMaxKey || 'none') +
          ' max_prob=' + (overallMax >= 0 ? overallMax.toFixed(2) : 'none')
        );
        mustFallback = true;
        // Best-effort substitute to the argmax-within-L1 if one exists,
        // otherwise overall argmax (may force an L1 change too).
        if (argmaxKey) {
          args.l2 = { value: argmaxKey, confidence: argmaxProb };
        } else if (overallMaxKey) {
          for (const l1Cand of L1_VALUES) {
            if (L2_BY_L1[l1Cand].includes(overallMaxKey)) {
              args.l1 = { value: l1Cand, confidence: Math.max(args.l1.confidence, 0.6) };
              args.l2 = { value: overallMaxKey, confidence: overallMax };
              break;
            }
          }
        }
      } else if (argmaxKey && argmaxKey !== args.l2.value) {
        const delta = argmaxProb - pickedProb;
        if (delta > POLICY_CONFIG.L2_PICK_PROBABILITY_TOLERANCE) {
          validationErrors.push(
            'stage_3: l2_should_tolerance_exceeded picked=' + args.l2.value +
            ' max_key=' + argmaxKey +
            ' delta=' + delta.toFixed(3)
          );
          args.l2 = { value: argmaxKey, confidence: argmaxProb };
        }
      }
    }

    // Validate + filter L3.
    const dedup = new Map();
    (Array.isArray(args.l3) ? args.l3 : []).forEach(function (tag) {
      if (!tag || typeof tag.value !== 'string') return;
      const m = tag.value.match(/^([a-z_]+):([a-z_]+)$/);
      if (!m) return;
      const cat = m[1]; const val = m[2];
      if (!L3_CATEGORIES.includes(cat)) return;
      if (!L3_VALUES_BY_CATEGORY[cat].includes(val)) return;
      const conf = clamp01(tag.confidence);
      if (conf < POLICY_CONFIG.L3_EMIT_CONFIDENCE_MIN) return;
      const key = cat + ':' + val;
      if (!dedup.has(key) || dedup.get(key).confidence < conf) {
        dedup.set(key, { value: key, confidence: conf });
      }
    });
    args.l3 = Array.from(dedup.values()).sort(function (a, b) { return b.confidence - a.confidence; });

    return {
      ok: true,
      output: args,
      validation_errors: validationErrors,
      must_fallback: mustFallback,
      duration_ms: Date.now() - t0,
      input_tokens: resp.usage && resp.usage.input_tokens,
      output_tokens: resp.usage && resp.usage.output_tokens,
      model: MODEL_DEEP,
    };
  } catch (err) {
    return {
      ok: false,
      error: String((err && err.message) || err),
      duration_ms: Date.now() - t0,
      model: MODEL_DEEP,
    };
  }
}

// --------------------------------------------------------------------------
// Stage 4: Disposition (rules-first, model writes reasoning_summary)
// --------------------------------------------------------------------------
//
// Rule order (spec section 6.1):
//   1. bright_line_forces_block
//   2. high_aggregate_score
//   3. ambiguous_l1_requires_review
//   4. security_education_safe_completion
//   5. multi_risk_marker_review        (>= RISK_MARKER_REVIEW_COUNT risk_marker L3 tags, no bright lines)
//   6. low_l2_confidence_review        (l2.confidence < L2_HUMAN_REVIEW_THRESHOLD)
//   7. low_score_benign_allow
//   8. model_adjudicated               (no rule fires)

function countRiskMarkerL3(classification) {
  if (!classification || !Array.isArray(classification.l3)) return 0;
  return classification.l3.filter(function (t) {
    return typeof t.value === 'string' && t.value.indexOf('risk_marker:') === 0;
  }).length;
}

function applyDeterministicRules(evidence, classification) {
  // triggered carries: bright_lines (matched feature names), thresholds (string
  // descriptions of the threshold checks that fired), rules (the named rule that
  // fired, or 'model_adjudicated' if none did), and policy_note (set when a
  // non-negotiable rule fired). See policy-spec-v5.0.md Section 6.1.
  const triggered = { bright_lines: [], thresholds: [], rules: [], policy_note: null };

  if (evidence && Array.isArray(evidence.bright_lines) && evidence.bright_lines.length > 0) {
    triggered.bright_lines = evidence.bright_lines.slice();
    triggered.rules.push('bright_line_forces_block');
    // Decision 11 / HP-3: bright-line blocks are non-negotiable. The policy_note
    // exists so any consumer reading the disposition output sees the
    // non-negotiability explicitly, rather than inferring it from the bright_lines
    // array being non-empty. This is the audit-trail evidence that no downstream
    // stage may downgrade this block.
    triggered.policy_note = 'Bright-line match: non-negotiable. No downstream stage may downgrade this disposition. Matched features: ' + triggered.bright_lines.join(', ') + '.';
    return { action: 'block', confidence: 1.0, triggered, decided: true };
  }
  if (evidence && evidence.aggregate_score >= POLICY_CONFIG.AGGREGATE_BLOCK_THRESHOLD) {
    triggered.thresholds.push('aggregate_score>=' + POLICY_CONFIG.AGGREGATE_BLOCK_THRESHOLD);
    triggered.rules.push('high_aggregate_score');
    return { action: 'block', confidence: 0.92, triggered, decided: true };
  }
  const l1 = classification && classification.l1 && classification.l1.value;
  if (l1 === 'ambiguous_dual_use') {
    triggered.rules.push('ambiguous_l1_requires_review');
    return { action: 'human_review', confidence: 0.85, triggered, decided: true };
  }
  if (l1 === 'security_education') {
    triggered.rules.push('security_education_safe_completion');
    return { action: 'safe_completion', confidence: 0.88, triggered, decided: true };
  }
  const riskMarkerCount = countRiskMarkerL3(classification);
  if (riskMarkerCount >= POLICY_CONFIG.RISK_MARKER_REVIEW_COUNT) {
    triggered.thresholds.push('risk_markers>=' + POLICY_CONFIG.RISK_MARKER_REVIEW_COUNT);
    triggered.rules.push('multi_risk_marker_review');
    return { action: 'human_review', confidence: 0.80, triggered, decided: true };
  }
  const l2Conf = classification && classification.l2 && classification.l2.confidence;
  if (typeof l2Conf === 'number' && l2Conf < POLICY_CONFIG.L2_HUMAN_REVIEW_THRESHOLD) {
    triggered.thresholds.push('l2_confidence<' + POLICY_CONFIG.L2_HUMAN_REVIEW_THRESHOLD);
    triggered.rules.push('low_l2_confidence_review');
    return { action: 'human_review', confidence: 0.75, triggered, decided: true };
  }
  if (l1 === 'benign' && evidence && evidence.aggregate_score <= POLICY_CONFIG.AGGREGATE_ALLOW_THRESHOLD) {
    triggered.thresholds.push('aggregate_score<=' + POLICY_CONFIG.AGGREGATE_ALLOW_THRESHOLD);
    triggered.rules.push('low_score_benign_allow');
    return { action: 'allow', confidence: 0.95, triggered, decided: true };
  }
  // No rule fired -- model adjudicates.
  triggered.rules.push('model_adjudicated');
  return { action: null, confidence: null, triggered, decided: false };
}

async function stage4Disposition(prompt, evidence, classification) {
  const t0 = Date.now();
  const ruleResult = applyDeterministicRules(evidence, classification);

  // HP-1 / Decision 13: decoupling.
  // When a deterministic rule has already decided the action, the model's job
  // is to write reasoning_summary + narrative_summary -- NOT to "decide and
  // then have its decision ignored." The user message reflects this clearly,
  // and the action / confidence is locked from the rule result regardless of
  // what the model returns.
  // When no rule fired (model_adjudicated), the model's action choice is used.
  const tool = buildDispositionTool();
  const userMsg = [
    'PROMPT:',
    prompt,
    '',
    'CLASSIFICATION:',
    JSON.stringify(classification),
    '',
    'EVIDENCE SUMMARY:',
    JSON.stringify({
      aggregate_score:  evidence && evidence.aggregate_score,
      bright_lines:     evidence && evidence.bright_lines,
      l2_probabilities: evidence && evidence.l2_probabilities,
    }),
    '',
    'DETERMINISTIC RULE OUTCOME:',
    JSON.stringify({
      action: ruleResult.action,
      rules:  ruleResult.triggered.rules,
      policy_note: ruleResult.triggered.policy_note,
      decided: ruleResult.decided,
    }),
    '',
    ruleResult.decided
      ? 'A deterministic rule has decided the action. The action is LOCKED. Your only job is to write reasoning_summary (audit-grade, <= 280 chars) and narrative_summary (stakeholder-readable prose, <= 600 chars) that justify the locked decision against the evidence. Do not re-argue the action.'
      : 'No deterministic rule fired (model_adjudicated). You choose the action AND write both summaries. Allowed actions: allow, safe_completion, human_review, block.',
  ].join('\n');

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_DEEP,
      max_tokens: 700,
      temperature: 0.0,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'emit_disposition' },
      system: SYSTEM_STAGE_4_DISPOSITION,
      messages: [{ role: 'user', content: userMsg }],
    });
    const toolUse = resp.content.find(function (b) { return b.type === 'tool_use' && b.name === 'emit_disposition'; });
    if (!toolUse) throw new Error('disposition_no_tool_use');
    const args = toolUse.input || {};

    let action = args.action;
    let confidence = clamp01(args.confidence);
    if (!DISPOSITION_ACTIONS.includes(action)) action = 'human_review';

    // Lock action / confidence to the rule result when a rule decided.
    if (ruleResult.decided) {
      action = ruleResult.action;
      confidence = ruleResult.confidence;
    }

    // Decision 14 / HP-2: safe_completion_guidance is computed from L1, not
    // chosen by the model. This makes the policy difference between
    // security_education and dual_use auditable and consistent across calls.
    const l1Value = classification && classification.l1 && classification.l1.value;
    const safeCompletionGuidance = action === 'safe_completion'
      ? buildSafeCompletionGuidance(l1Value)
      : null;

    const disposition = {
      action:                   action,
      confidence:               confidence,
      reasoning_summary:        truncateAtSentenceBoundary(args.reasoning_summary, POLICY_CONFIG.REASONING_SUMMARY_MAX_CHARS),
      narrative_summary:        truncateAtSentenceBoundary(args.narrative_summary, POLICY_CONFIG.NARRATIVE_SUMMARY_MAX_CHARS),
      triggered_by:             ruleResult.triggered,
      safe_completion_guidance: safeCompletionGuidance,
      degraded:                 false,
    };

    return {
      ok: true,
      output: disposition,
      duration_ms: Date.now() - t0,
      input_tokens: resp.usage && resp.usage.input_tokens,
      output_tokens: resp.usage && resp.usage.output_tokens,
      model: MODEL_DEEP,
    };
  } catch (err) {
    // Model failed. Emit deterministic-only disposition.
    // - Rule-decided cases keep their rule action; reasoning_summary explains the failure.
    // - Model-adjudicated cases fall back to human_review with the validation_fallback rule
    //   appended to triggered_by.rules.
    const fallbackTriggered = ruleResult.decided
      ? ruleResult.triggered
      : { bright_lines: [], thresholds: [], rules: ['model_adjudicated', 'validation_fallback'], policy_note: null };
    const fallbackAction = ruleResult.decided ? ruleResult.action : 'human_review';
    const fallbackL1 = classification && classification.l1 && classification.l1.value;
    return {
      ok: false,
      error: String((err && err.message) || err),
      output: {
        action:                   fallbackAction,
        confidence:               ruleResult.decided ? ruleResult.confidence : 0.5,
        reasoning_summary:        'Model unavailable; rule-derived disposition.',
        narrative_summary:        'The disposition model failed during this evaluation. The deterministic rule cascade produced the action above; no model-written narrative is available for this case. A reviewer reading this trace should treat the disposition as best-effort and consult the triggered_by artifact for the underlying signals.',
        triggered_by:             fallbackTriggered,
        safe_completion_guidance: fallbackAction === 'safe_completion' ? buildSafeCompletionGuidance(fallbackL1) : null,
        degraded:                 true,
      },
      duration_ms: Date.now() - t0,
      model: MODEL_DEEP,
    };
  }
}

// --------------------------------------------------------------------------
// Stage 5 was removed in v5.0.1 (policy-spec Decision 11). The calibration
// role it filled is now covered deterministically by:
//   - rule 5: multi_risk_marker_review   (>= 2 risk-marker L3 tags -> human_review)
//   - rule 6: low_l2_confidence_review   (L2 confidence < threshold -> human_review)
// Both fire in applyDeterministicRules() above, without a second model call.
// See docs/04-enforcement-design.md Section 6 for the full rationale.
// --------------------------------------------------------------------------

// Deterministic sampling helper for the Stage 1 observability hook (Decision 12).
// Returns true for approximately TRIAGE_OBSERVABILITY_SAMPLE_RATE of prompts,
// deterministic on a stable hash of the prompt -- the same prompt always samples
// the same way. This means re-running the harness on the same input does not
// drift the sampling decision.
function sampleForOfflineReview(prompt) {
  if (typeof prompt !== 'string' || prompt.length === 0) return false;
  // Simple deterministic hash. djb2-style; sufficient for sampling (not cryptographic).
  let h = 5381;
  for (let i = 0; i < prompt.length; i++) {
    h = ((h * 33) ^ prompt.charCodeAt(i)) >>> 0;
  }
  const bucket = (h % 10000) / 10000;
  return bucket < POLICY_CONFIG.TRIAGE_OBSERVABILITY_SAMPLE_RATE;
}

// Build the confidence_path string surfaced in disposition output (Decision 13).
// Stages that did not run (e.g., short-circuit at Stage 1) are omitted from the path.
function buildConfidencePath(s1, s2, s3, dispositionConfidence) {
  const parts = [];
  if (s1 && s1.ok && typeof s1.output.l1_confidence === 'number') {
    parts.push('triage:' + s1.output.l1_confidence.toFixed(2));
  }
  if (s2 && s2.ok) {
    // FAF stage does not emit an explicit confidence; derive a proxy from
    // the top L2 probability, falling back to 0 when no probabilities exist.
    const probs = (s2.output && s2.output.l2_probabilities) || {};
    let top = 0;
    Object.keys(probs).forEach(function (k) { if (probs[k] > top) top = probs[k]; });
    parts.push('faf:' + top.toFixed(2));
  }
  if (s3 && s3.ok && s3.output && s3.output.l2 && typeof s3.output.l2.confidence === 'number') {
    parts.push('classify:' + s3.output.l2.confidence.toFixed(2));
  }
  if (typeof dispositionConfidence === 'number') {
    parts.push('disposition:' + dispositionConfidence.toFixed(2));
  }
  return parts.join(' -> ');
}

// --------------------------------------------------------------------------
// Orchestrator
// --------------------------------------------------------------------------

export async function evaluatePromptV5(prompt, opts) {
  opts = opts || {};
  const debug = !!opts.debug;

  // v5.0.1: stage_5 removed from the trace shape. Clients written against v5.0
  // that defensively read trace.stage_5 will see undefined and should treat
  // disposition as final at Stage 4.
  const trace = {
    stage_1: null, stage_2: null, stage_3: null, stage_4: null,
    short_circuited_at: null,
    errors: [],
  };
  const modelsUsed = [];

  // Stage 1: triage.
  const s1 = await stage1Triage(prompt);
  trace.stage_1 = s1;
  if (s1.model) modelsUsed.push(s1.model);
  if (!s1.ok) trace.errors.push('stage_1: ' + s1.error);

  // Short-circuit: clearly benign.
  // Decision 12: this path is gated on the documented Haiku precision floor.
  // The engine does not block the short-circuit at runtime, but the trace
  // records whether this case was sampled for offline re-evaluation so an
  // out-of-band batch job can find and re-run the sampled prompts.
  if (s1.ok &&
      s1.output.l1_candidate === 'benign' &&
      s1.output.l1_confidence >= POLICY_CONFIG.TRIAGE_BENIGN_CONFIDENCE_MIN &&
      (s1.output.coarse_context.risk_markers || []).length <= POLICY_CONFIG.TRIAGE_RISK_MARKERS_MAX) {
    trace.short_circuited_at = 'stage_1';
    trace.stage_1.sampled_for_offline_review = sampleForOfflineReview(prompt);

    const shortCircuitConfidence = s1.output.l1_confidence;
    const shortCircuitDisposition = {
      action:                   'allow',
      confidence:               shortCircuitConfidence,
      reasoning_summary:        'Triage short-circuit: Stage 1 classified the prompt as clearly benign with confidence above the gate threshold and no risk markers in coarse context.',
      narrative_summary:        'The triage stage classified this prompt as clearly benign with high confidence (' + shortCircuitConfidence.toFixed(2) + ') and no risk markers in the coarse context. The pipeline short-circuited to ALLOW without invoking the deeper analysis stages. This path is gated on the documented Haiku precision floor; a fraction of short-circuited cases (' + Math.round(POLICY_CONFIG.TRIAGE_OBSERVABILITY_SAMPLE_RATE * 100) + '%) are sampled for offline re-evaluation against the full pipeline.',
      confidence_path:          buildConfidencePath(s1, null, null, shortCircuitConfidence),
      triggered_by:             { bright_lines: [], thresholds: [], rules: ['triage_short_circuit_allow'], policy_note: null },
      safe_completion_guidance: null,
      degraded:                 false,
    };

    return assembleEnvelope({
      prompt,
      classification: {
        l1: { value: 'benign', confidence: shortCircuitConfidence },
        l2: { value: 'no_risk_pattern', confidence: shortCircuitConfidence },
        l3: [],
      },
      evidence:    stubEvidence(s1.output),
      disposition: shortCircuitDisposition,
      modelsUsed, trace, debug,
    });
  }

  // Stage 2: FAF deep analysis. On failure, fall back to stub evidence.
  const s2 = await stage2FAFAnalysis(prompt, s1);
  trace.stage_2 = s2;
  if (s2.model) modelsUsed.push(s2.model);
  if (!s2.ok) trace.errors.push('stage_2: ' + s2.error);
  const evidence = s2.ok ? s2.output : stubEvidence(s1.ok ? s1.output : null);

  // Stage 3: classification. On failure, derive coarse classification from evidence.
  const s3 = await stage3Classify(prompt, s1, s2);
  trace.stage_3 = s3;
  if (s3.model) modelsUsed.push(s3.model);
  if (!s3.ok) trace.errors.push('stage_3: ' + s3.error);
  // Pipe Stage 3 validation errors (v4 migration, rule-12 violations) into the trace.
  if (s3.ok && Array.isArray(s3.validation_errors) && s3.validation_errors.length > 0) {
    for (const e of s3.validation_errors) trace.errors.push(e);
  }
  const classification = s3.ok ? s3.output : deriveClassificationFromEvidence(evidence);

  // Stage 4: disposition. Always returns an output (model fail -> rule-only fallback).
  // Disposition is FINAL at Stage 4 in v5.0.1; no Stage 5 follows.
  const s4 = await stage4Disposition(prompt, evidence, classification);
  trace.stage_4 = s4;
  if (s4.model) modelsUsed.push(s4.model);
  if (!s4.ok) trace.errors.push('stage_4: ' + s4.error);
  const disposition = s4.output;

  // Rule 12 MUST violation: coerce disposition to human_review with validation_fallback,
  // unless a stronger bright-line block already fired.
  if (s3.ok && s3.must_fallback && disposition.action !== 'block') {
    disposition.action = 'human_review';
    if (!Array.isArray(disposition.triggered_by.rules)) disposition.triggered_by.rules = [];
    if (!disposition.triggered_by.rules.includes('validation_fallback')) {
      disposition.triggered_by.rules.push('validation_fallback');
    }
    disposition.degraded = true;
  }

  // Attach the confidence_path (Decision 13). This is computed from per-stage
  // confidences after all stages complete, NOT asked of the model.
  disposition.confidence_path = buildConfidencePath(s1, s2, s3, disposition.confidence);

  // Schema rule on disposition.degraded (07-v5-schema section 3.3): set true when
  // pipeline_trace.errors[] is non-empty AND the disposition was emitted via a
  // section-9 fallback path (Stage 2 stub-evidence, Stage 3 derived classification,
  // or Stage 4 catch-block fallback). Stage 1 short-circuit never reaches here,
  // so the !short_circuited check is implicit for this code path.
  const sectionNineFallback = !s2.ok || !s3.ok || !s4.ok;
  if (trace.errors.length > 0 && sectionNineFallback) {
    disposition.degraded = true;
  }

  return assembleEnvelope({ prompt, classification, evidence, disposition, modelsUsed, trace, debug });
}

// --------------------------------------------------------------------------
// Envelope assembly + helpers
// --------------------------------------------------------------------------

function assembleEnvelope(p) {
  const envelope = {
    schema_version:   '5.0.1',
    ontology_version: '5.0',
    evaluated_at:     new Date().toISOString(),
    model_pipeline:   p.modelsUsed,
    prompt_length:    p.prompt.length,
    classification:   p.classification,
    disposition:      p.disposition,
    evidence: {
      faf_nodes:        (p.evidence && p.evidence.faf_nodes) || stubFafNodes(),
      component_scores: (p.evidence && p.evidence.component_scores) || { target: 0, lure: 0, trust: 0, extract: 0, evade: 0 },
      aggregate_score:  (p.evidence && p.evidence.aggregate_score) || 0,
      bright_lines:     (p.evidence && p.evidence.bright_lines) || [],
      process_flags:    (p.evidence && p.evidence.process_flags) || [],
      l2_probabilities: (p.evidence && p.evidence.l2_probabilities) || {},
    },
    prompt_summary: (p.evidence && p.evidence.prompt_summary) || { persona: null, topic: '', target: null, objective: null, pretext: null },
  };
  // pipeline_trace is omitted entirely (not nulled) when debug is off. (Decision 5.)
  if (p.debug) envelope.pipeline_trace = p.trace;
  return envelope;
}

function stubFafNodes() {
  return {
    context: { source: 'user', persona: null, topic: '', target: null, relationship_phase: 'targeting' },
    process: {
      execution:     { delivery_method: null, delivery_template: null, referenced_entities: [] },
      psychological: { trigger: null, incentive: null, control: null },
    },
    objective: { objective: '' },
  };
}

function stubEvidence(triageOutput) {
  const coarse = (triageOutput && triageOutput.coarse_context) || {};
  return {
    faf_nodes: {
      context: {
        source:             'user',
        persona:            coarse.persona || null,
        topic:              coarse.topic || '',
        target:             coarse.target || null,
        relationship_phase: 'targeting',
      },
      process: {
        execution:     { delivery_method: null, delivery_template: null, referenced_entities: [] },
        psychological: { trigger: null, incentive: null, control: null },
      },
      objective: { objective: '' },
    },
    component_scores: { target: 0, lure: 0, trust: 0, extract: 0, evade: 0 },
    aggregate_score:  0,
    bright_lines:     [],
    process_flags:    [],
    l2_probabilities: {},
    prompt_summary: {
      persona:   coarse.persona || null,
      topic:     coarse.topic || '',
      target:    coarse.target || null,
      objective: null,
      pretext:   null,
    },
  };
}

function deriveClassificationFromEvidence(evidence) {
  const probs = (evidence && evidence.l2_probabilities) || {};
  let bestL2 = null; let bestProb = 0;
  Object.keys(probs).forEach(function (k) { if (probs[k] > bestProb) { bestProb = probs[k]; bestL2 = k; } });
  if (!bestL2) {
    return {
      l1: { value: 'ambiguous_dual_use', confidence: 0.4 },
      l2: { value: 'borderline_education_request', confidence: 0.4 },
      l3: [],
    };
  }
  let foundL1 = 'ambiguous_dual_use';
  for (const l1 of L1_VALUES) {
    if (L2_BY_L1[l1].includes(bestL2)) { foundL1 = l1; break; }
  }
  return {
    l1: { value: foundL1, confidence: bestProb },
    l2: { value: bestL2, confidence: bestProb },
    l3: [],
  };
}

function parseJsonObject(text) {
  if (typeof text !== 'string') return null;
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const start = t.indexOf('{');
  if (start < 0) return null;
  let depth = 0; let end = -1;
  for (let i = start; i < t.length; i++) {
    if (t[i] === '{') depth++;
    else if (t[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  try { return JSON.parse(t.slice(start, end + 1)); } catch (e) { return null; }
}

function clamp01(x) { x = Number(x); if (!isFinite(x)) return 0; if (x < 0) return 0; if (x > 1) return 1; return x; }
function clampInt(x, lo, hi) { x = parseInt(x, 10); if (!isFinite(x)) return lo; if (x < lo) return lo; if (x > hi) return hi; return x; }

// Schema rules 9 and 9a: reasoning_summary (280) and narrative_summary (600)
// MUST end at sentence-final punctuation; mid-word slicing is out of spec.
// When the model overruns the cap, trim back to the last `.`, `!`, or `?` at
// or below the cap. If no sentence boundary fits, fall back to last whitespace
// (with a trailing period for closure); pathological inputs with no whitespace
// in maxLen chars get a hard slice -- the model would have to emit pathological
// output to hit that branch.
export function truncateAtSentenceBoundary(s, maxLen) {
  s = String(s == null ? '' : s);
  if (s.length <= maxLen) return s;
  const trimmed = s.slice(0, maxLen);
  for (let i = trimmed.length - 1; i >= 0; i--) {
    const c = trimmed[i];
    if (c === '.' || c === '!' || c === '?') return trimmed.slice(0, i + 1);
  }
  for (let i = trimmed.length - 1; i >= 0; i--) {
    if (/\s/.test(trimmed[i])) return trimmed.slice(0, i).replace(/[\s,;:]+$/, '') + '.';
  }
  return trimmed;
}

// --------------------------------------------------------------------------
// v4_legacy derivation (used by /api/evaluate for dual-emit backward compat)
// --------------------------------------------------------------------------

export function deriveV4Legacy(v5) {
  if (!v5) return null;
  const l2val = v5.classification && v5.classification.l2 && v5.classification.l2.value;
  const typology = V5_TO_V4_TYPOLOGY[l2val] || 'NONE';

  const tier = (function () {
    switch (v5.disposition.action) {
      case 'allow':           return 'ALLOW';
      case 'safe_completion': return 'ALLOW';
      case 'human_review':    return 'REVIEW';
      case 'block':           return 'BLOCK';
      default:                return 'REVIEW';
    }
  })();

  // Re-shape l2_probabilities into v4 typology_probabilities.
  const v4Typologies = ['ROMANCE', 'INVESTMENT', 'PHISHING', 'IMPERSONATION', 'ADVANCE_FEE',
                        'FRAUD_INFRASTRUCTURE', 'RECOVERY', 'ACCOUNT_TAKEOVER', 'AI_ENABLED_ABUSE', 'NONE'];
  const v4Probs = {};
  v4Typologies.forEach(function (t) { v4Probs[t] = 0; });
  const v5Probs = (v5.evidence && v5.evidence.l2_probabilities) || {};
  Object.keys(v5Probs).forEach(function (l2) {
    const t = V5_TO_V4_TYPOLOGY[l2] || 'NONE';
    v4Probs[t] = Math.max(v4Probs[t], v5Probs[l2]);
  });

  return {
    escalation_tier:        tier,
    typology:               typology,
    typology_probabilities: v4Probs,
    sub_typology_analysis:  {},
    prompt_summary:         v5.prompt_summary,
    bright_line:            (v5.evidence.bright_lines || []).length > 0,
    bright_line_features:   v5.evidence.bright_lines || [],
    aggregate_score:        v5.evidence.aggregate_score,
    component_scores:       v5.evidence.component_scores,
    confidence:             v5.disposition.confidence,
    rationale:              v5.disposition.reasoning_summary,
    legitimate_use_possible: v5.disposition.action === 'safe_completion' || (v5.classification.l1 && v5.classification.l1.value === 'security_education'),
    disambiguation_note:    v5.disposition.safe_completion_guidance,
    evaluated_at:           v5.evaluated_at,
    model:                  MODEL_DEEP,
    prompt_length:          v5.prompt_length,
  };
}
