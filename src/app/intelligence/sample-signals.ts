// Sample threat-signal feed for the public /intelligence page.
//
// THIS IS SAMPLE DATA. The OSINT monitoring backend (src/lib/osint/) is real --
// 7 source modules, a Haiku classifier with 3-layer defensive prompting, and the
// M9 persistence schema all exist -- but the daily aggregation cron is not yet
// running, so production has no live feed to query. Until that ships (a future
// release), the public page renders this curated set of representative signals.
// Each row is an honest illustration of what the classifier produces: a source,
// an observation timestamp, the closed-set L3 method it maps the signal to, the
// classifier's verdict, and a concise evidence-anchored reasoning line.
//
// The `ttp_type` values are drawn verbatim from the L3 method closed set
// (L3_VALUES_BY_CATEGORY.method in src/lib/safeeval-v5.js) -- the same closed
// vocabulary the policy framework uses. The `classification` values are the
// ClassificationVerdict closed set from src/lib/osint/types.ts. Keeping both
// aligned to the real vocabularies is the point: the feed shows the closed-set
// discipline in action, not invented marketing labels.
//
// ASCII-safe: straight quotes, "--" not em dashes.

// Display-source labels. These map to the seven wired OSINT source modules in
// src/lib/osint/sources/ (ic3, ftc, cisa_kev, krebs, bleeping_computer,
// reddit_scams, reddit_phishing).
export type SignalSource =
  | 'CISA KEV'
  | 'IC3'
  | 'FTC'
  | 'Krebs on Security'
  | 'Bleeping Computer'
  | 'Reddit r/scams'
  | 'Reddit r/phishing';

// Closed set mirrored from ClassificationVerdict in src/lib/osint/types.ts.
export type SignalClassification =
  | 'known_ttp'
  | 'new_ttp_proposed'
  | 'low_signal_dismissed';

export interface SampleSignal {
  // Human-readable source label (see SignalSource).
  source: SignalSource;
  // Signal headline as the source published it (paraphrased for the sample set).
  title: string;
  // ISO 8601 observation timestamp. Sample dates sit within the two weeks
  // before the page was authored (late May 2026).
  timestamp: string;
  // Closed-set L3 method token (verbatim, underscore form) the classifier maps
  // the signal to. Drawn from L3_VALUES_BY_CATEGORY.method in safeeval-v5.js.
  ttp_type: string;
  // Classifier verdict (closed set; see SignalClassification).
  classification: SignalClassification;
  // 1-2 sentence evidence-anchored extraction, in the classifier's voice:
  // concise, grounded in what the source said, no breathless language.
  reasoning: string;
}

// Fifteen representative signals across the seven-source mix. Ordered
// most-recent-first so the page can render them in array order.
export const SAMPLE_SIGNALS: SampleSignal[] = [
  {
    source: 'Bleeping Computer',
    title: 'Threat actors clone executive voices to authorize fraudulent wire transfers',
    timestamp: '2026-05-29T14:20:00Z',
    ttp_type: 'realtime_synthetic_media',
    classification: 'known_ttp',
    reasoning:
      'Report describes near-real-time voice cloning of a finance executive on a live call to direct an urgent wire, defeating callback verification. Maps to the existing realtime_synthetic_media method with an enterprise_finance target.',
  },
  {
    source: 'Reddit r/scams',
    title: 'Lost $40k to a crypto trading site I was introduced to on a dating app',
    timestamp: '2026-05-29T02:11:00Z',
    ttp_type: 'fake_storefront',
    classification: 'known_ttp',
    reasoning:
      'First-person account of a months-long relationship build that funneled the victim onto an invite-only trading platform showing fabricated returns. Consistent with the fake_storefront method paired with a trust_love tactic.',
  },
  {
    source: 'Reddit r/phishing',
    title: 'Got a "USPS package held" text with a link to pay a $1.95 redelivery fee',
    timestamp: '2026-05-28T19:45:00Z',
    ttp_type: 'smishing',
    classification: 'known_ttp',
    reasoning:
      'SMS lure impersonating a parcel carrier and routing to a card-capture page for a small "redelivery fee." Standard smishing pattern targeting consumer_general; the small fee is a card-harvesting pretext, not the objective.',
  },
  {
    source: 'Krebs on Security',
    title: 'Inside a SIM-swapping crew that bribed carrier-store employees',
    timestamp: '2026-05-28T11:30:00Z',
    ttp_type: 'sim_swap',
    classification: 'known_ttp',
    reasoning:
      'Long-form investigation into a crew porting victim numbers via insider access at retail carrier stores to intercept one-time codes. Maps cleanly to the sim_swap method enabling downstream account takeover.',
  },
  {
    source: 'IC3',
    title: 'Public service announcement on continued business email compromise losses',
    timestamp: '2026-05-27T16:00:00Z',
    ttp_type: 'pretexting_email',
    classification: 'known_ttp',
    reasoning:
      'Advisory reiterates BEC actors impersonating vendors and executives over email to redirect invoice payments. Maps to pretexting_email with an enterprise_finance target; no new technique relative to existing coverage.',
  },
  {
    source: 'Bleeping Computer',
    title: 'New phishing kit auto-generates pixel-perfect bank login clones',
    timestamp: '2026-05-27T09:15:00Z',
    ttp_type: 'credential_harvesting_page',
    classification: 'known_ttp',
    reasoning:
      'Kit templatizes look-alike banking login pages and relays captured credentials in real time. Maps to credential_harvesting_page; the real-time relay is an account_takeover_enablement overlap rather than a distinct method.',
  },
  {
    source: 'Reddit r/scams',
    title: 'A "recovery agent" contacted me about money I lost last year and wants a fee',
    timestamp: '2026-05-26T22:05:00Z',
    ttp_type: 'advance_fee_lawyer_fee',
    classification: 'known_ttp',
    reasoning:
      'Poster who previously reported an investment loss is now approached by a supposed recovery service demanding an upfront legal fee to release "frozen" funds. Recovery framing targeting a recent_fraud_victim; maps to advance_fee_lawyer_fee with a secondary_victimization overlap.',
  },
  {
    source: 'FTC',
    title: 'Consumer alert: prize and lottery scams ask winners to pay fees first',
    timestamp: '2026-05-26T13:40:00Z',
    ttp_type: 'advance_fee_lottery',
    classification: 'known_ttp',
    reasoning:
      'Consumer education notice describing notifications of a lottery or sweepstakes win conditioned on paying taxes or processing fees up front. Textbook advance_fee_lottery; no novel mechanics.',
  },
  {
    source: 'Reddit r/phishing',
    title: 'QR code taped over the real one on a parking meter went to a fake payment portal',
    timestamp: '2026-05-25T18:22:00Z',
    ttp_type: 'credential_harvesting_page',
    classification: 'new_ttp_proposed',
    reasoning:
      'Physical-world QR overlay ("quishing") redirecting to a payment and card-capture portal. The credential_harvesting_page endpoint is covered, but the in-person QR-overlay delivery vector is not well represented; proposed as a candidate L3 refinement for architect review.',
  },
  {
    source: 'Krebs on Security',
    title: 'OTP-relay bot services lower the bar for draining MFA-protected accounts',
    timestamp: '2026-05-25T08:50:00Z',
    ttp_type: 'mfa_intercept',
    classification: 'known_ttp',
    reasoning:
      'Coverage of subscription bots that auto-call victims to phish one-time passcodes during a live login. Maps to mfa_intercept; the as-a-service packaging is a distribution detail, not a new technique.',
  },
  {
    source: 'Reddit r/scams',
    title: 'Got "hired" for a payment-processing role that forwards money through my account',
    timestamp: '2026-05-24T20:10:00Z',
    ttp_type: 'money_mule_recruitment',
    classification: 'known_ttp',
    reasoning:
      'Job offer asks the applicant to receive client payments into a personal account and forward them, keeping a commission. Defining money_mule_recruitment shape targeting a job_seeker; a money_laundering_overlap is implied.',
  },
  {
    source: 'Bleeping Computer',
    title: 'Attackers hide instructions in emails to hijack AI inbox assistants',
    timestamp: '2026-05-23T15:05:00Z',
    ttp_type: 'prompt_injection',
    classification: 'new_ttp_proposed',
    reasoning:
      'Report documents emails carrying hidden text that coaxes an AI mail assistant into forwarding data or auto-replying with attacker content. Maps to prompt_injection, but the fraud-specific framing of AI inbox agents as the target is proposed for new L3 coverage.',
  },
  {
    source: 'Reddit r/phishing',
    title: 'Caller claimed to be my bank fraud team and walked me to "secure" my account',
    timestamp: '2026-05-22T11:48:00Z',
    ttp_type: 'vishing',
    classification: 'known_ttp',
    reasoning:
      'Voice call impersonating a bank fraud department and coaching the victim to move funds to a "safe" account. Maps to vishing with an authority tactic targeting a financial_account holder.',
  },
  {
    source: 'IC3',
    title: 'Alert on inheritance and estate-settlement advance-fee solicitations',
    timestamp: '2026-05-20T17:30:00Z',
    ttp_type: 'advance_fee_inheritance',
    classification: 'known_ttp',
    reasoning:
      'Advisory on unsolicited messages claiming the recipient is heir to an overseas estate, gated behind processing and notarization fees. Maps to advance_fee_inheritance; an elderly_individual target is over-represented in the reported complaints.',
  },
  {
    source: 'CISA KEV',
    title: 'Software vulnerability added to the Known Exploited Vulnerabilities catalog',
    timestamp: '2026-05-18T10:00:00Z',
    ttp_type: 'phishing',
    classification: 'low_signal_dismissed',
    reasoning:
      'Catalog entry describes an actively exploited software vulnerability with no associated social-engineering or fraud TTP. Outside the fraud-and-scams scope of this framework; recorded but dismissed as low signal for L3 vocabulary purposes.',
  },
];
