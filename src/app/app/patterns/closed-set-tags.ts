// Closed-set L3 tag vocabulary for the pattern composer (Phase 3 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 3.2 + 4.1 + 12.3. The composer lets an org compose a Pattern from
// (a) these architect-owned closed-set L3 tags and (b) the org's own custom L3
// classifiers (Phase 1/2). This file is the (a) half.
//
// SOURCE OF TRUTH. These six arrays mirror, value-for-value, the prompt-mode
// categories of `L3_VALUES_BY_CATEGORY` in src/lib/safeeval-v5.js (the engine
// constant the classifier emits), which in turn mirrors docs/08-v5-ontology.md
// sections 3.1 (method), 3.2 (tactic), 3.3 (target), 3.4 (context_marker),
// 3.5 (overlap), and 3.8 (risk_marker). The two conversation-mode categories
// (arc 3.6, cadence 3.7) are intentionally excluded: they are not part of the
// L3_GROUP_NAMES pattern-composition vocabulary (src/lib/data/custom-patterns/
// types.ts) and do not fire on the single-prompt envelope a Pattern matches.
//
// WHY HARDCODED rather than imported from the engine: this module is imported by
// the client composer component, and importing the (large, server-oriented)
// engine module into the client bundle is both wasteful and risky. The repo's
// tsconfig also sets allowJs:false, so a .ts module cannot cleanly import the
// .js engine. The static copy is kept honest by tests/data/patterns-closed-set-
// tags.test.ts, which reads BOTH this file and the engine source as text and
// asserts per-group set equality -- the same lockstep discipline scripts/
// check-lockstep.js applies to the other engine/doc closed sets. If the engine
// vocabulary changes, that test fails until this copy is updated.

import type { L3GroupName } from '@/lib/data/custom-patterns';

// LOCKSTEP-ANCHOR closed-set-tags (do not rename; the drift test keys on this).
export const CLOSED_SET_TAGS_BY_GROUP: Record<L3GroupName, readonly string[]> = {
  method: [
    'phishing',
    'smishing',
    'vishing',
    'credential_harvesting_page',
    'mfa_intercept',
    'sim_swap',
    'deepfake_audio',
    'deepfake_video',
    'sock_puppet',
    'fake_storefront',
    'prompt_injection',
    'jailbreak_framing',
    'synthetic_document_forgery',
    'pretexting_phone',
    'pretexting_email',
    'realtime_synthetic_media',
    'advance_fee_inheritance',
    'advance_fee_lottery',
    'advance_fee_customs',
    'advance_fee_business_partnership',
    'advance_fee_lawyer_fee',
    'money_mule_recruitment',
    'synthetic_identity_construction',
    'fake_review_generation',
  ],
  tactic: [
    'urgency',
    'fear',
    'authority',
    'trust_love',
    'greed',
    'scarcity',
    'reciprocity',
    'isolation',
  ],
  target: [
    'enterprise_employee',
    'enterprise_executive',
    'enterprise_it_credentials',
    'enterprise_finance',
    'financial_account',
    'payment_card',
    'crypto_holder',
    'elderly_individual',
    'recent_fraud_victim',
    'public_figure',
    'lonely_individual',
    'job_seeker',
    'consumer_general',
    'affinity_community',
  ],
  context_marker: [
    'security_training',
    'internal_simulation_claimed',
    'authorized_pentest_claimed',
    'journalism_claimed',
    'fiction_creative',
    'academic_research',
    'defensive_analysis',
    'roleplay_hypothetical',
    'victim_list_purchased',
    'ai_pretext_claimed',
  ],
  overlap: [
    'account_takeover_enablement',
    'payment_fraud_enablement',
    'identity_fraud_enablement',
    'money_laundering_overlap',
    'content_moderation_overlap',
    'extortion_overlap',
    'csam_adjacency',
    'secondary_victimization',
  ],
  risk_marker: [
    'deceptive_effectiveness_requested',
    'anti_detection_requested',
    'scale_enablement_requested',
    'specific_victim_targeted',
    'authorization_unverifiable',
    'payment_instruction_embedded',
  ],
};
