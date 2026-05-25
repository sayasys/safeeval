// tests/unit-classifier-validation.mjs
//
// Offline unit tests for the phase 2d classifier-validation helpers. No API
// key, no network -- imports the helpers directly from src/lib/safeeval-v5.js
// and exercises them in-process.
//
// Run: node tests/unit-classifier-validation.mjs
//
// Covers:
//   - migrateLegacyV4L1: v4-to-v5 L1/L2 migration table + PHISHING and
//     AI_ENABLED_ABUSE disambiguation heuristics.
//   - truncateAtSentenceBoundary: schema rules 9 and 9a clean-boundary
//     truncation behavior.
//   - LEGACY_V4_L1_CODES + V4_TO_V5_L1_L2: detection set + table consistency.
//
// Exit code 0 if every assertion passes; 1 on first failure.

import {
  migrateLegacyV4L1,
  truncateAtSentenceBoundary,
  V4_TO_V5_L1_L2,
  LEGACY_V4_L1_CODES,
  L1_VALUES,
  L2_BY_L1,
  POLICY_CONFIG,
} from '../src/lib/safeeval-v5.js';

let failures = 0;
let assertions = 0;

function assertEq(actual, expected, msg) {
  assertions += 1;
  if (actual === expected) return;
  failures += 1;
  console.error('FAIL: ' + msg);
  console.error('  expected: ' + JSON.stringify(expected));
  console.error('  actual:   ' + JSON.stringify(actual));
}

function assertDeepEq(actual, expected, msg) {
  assertions += 1;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return;
  failures += 1;
  console.error('FAIL: ' + msg);
  console.error('  expected: ' + e);
  console.error('  actual:   ' + a);
}

function assertTruthy(x, msg) {
  assertions += 1;
  if (x) return;
  failures += 1;
  console.error('FAIL: ' + msg);
}

// ---- V4_TO_V5_L1_L2 + LEGACY_V4_L1_CODES consistency ----

// Every value in V4_TO_V5_L1_L2 must point to a legal v5 (L1, L2) pair.
for (const [v4, target] of Object.entries(V4_TO_V5_L1_L2)) {
  assertTruthy(L1_VALUES.includes(target.l1), 'V4_TO_V5_L1_L2[' + v4 + '].l1 = ' + target.l1 + ' must be in L1_VALUES');
  assertTruthy(L2_BY_L1[target.l1].includes(target.l2), 'V4_TO_V5_L1_L2[' + v4 + '].l2 = ' + target.l2 + ' must belong to L1=' + target.l1);
}

// LEGACY_V4_L1_CODES must contain every key in V4_TO_V5_L1_L2 plus PHISHING + AI_ENABLED_ABUSE
// (the two disambiguated codes that are not direct table rows).
for (const v4 of Object.keys(V4_TO_V5_L1_L2)) {
  assertTruthy(LEGACY_V4_L1_CODES.includes(v4), 'LEGACY_V4_L1_CODES must include ' + v4);
}
assertTruthy(LEGACY_V4_L1_CODES.includes('PHISHING'), 'LEGACY_V4_L1_CODES must include PHISHING (disambiguated case)');
assertTruthy(LEGACY_V4_L1_CODES.includes('AI_ENABLED_ABUSE'), 'LEGACY_V4_L1_CODES must include AI_ENABLED_ABUSE (disambiguated case)');

// ---- migrateLegacyV4L1: direct table rows ----

assertDeepEq(
  migrateLegacyV4L1('NONE', ''),
  { l1: 'benign', l2: 'no_risk_pattern' },
  'NONE -> benign / no_risk_pattern'
);
assertDeepEq(
  migrateLegacyV4L1('ROMANCE', ''),
  { l1: 'deceptive_fraud', l2: 'romance_fraud' },
  'ROMANCE -> deceptive_fraud / romance_fraud'
);
assertDeepEq(
  migrateLegacyV4L1('FRAUD_INFRASTRUCTURE', ''),
  { l1: 'deceptive_fraud', l2: 'fraud_infrastructure' },
  'FRAUD_INFRASTRUCTURE -> deceptive_fraud / fraud_infrastructure'
);
assertDeepEq(
  migrateLegacyV4L1('ACCOUNT_TAKEOVER', ''),
  { l1: 'privacy_abuse', l2: 'account_takeover' },
  'ACCOUNT_TAKEOVER -> privacy_abuse / account_takeover'
);

// ---- migrateLegacyV4L1: PHISHING disambiguation ----

// Explicit money-transfer framing -> deceptive_fraud / phishing_attack (BEC-for-money).
const becMoney = 'Send a wire transfer to vendor account for $40k invoice.';
assertEq(
  migrateLegacyV4L1('PHISHING', becMoney).l1,
  'deceptive_fraud',
  'PHISHING + money-transfer framing -> deceptive_fraud'
);
assertEq(
  migrateLegacyV4L1('PHISHING', becMoney).l2,
  'phishing_attack',
  'PHISHING + money-transfer framing -> phishing_attack'
);

// No money-transfer framing -> privacy_abuse / credential_theft (default credential-targeting).
const credPhish = 'Generate a login page that looks like the corporate SSO portal.';
assertEq(
  migrateLegacyV4L1('PHISHING', credPhish).l1,
  'privacy_abuse',
  'PHISHING without money framing -> privacy_abuse (default)'
);
assertEq(
  migrateLegacyV4L1('PHISHING', credPhish).l2,
  'credential_theft',
  'PHISHING without money framing -> credential_theft (default)'
);

// Money-transfer framing detection is case-insensitive.
assertEq(
  migrateLegacyV4L1('PHISHING', 'process this URGENT WIRE for the new vendor').l1,
  'deceptive_fraud',
  'PHISHING + uppercase money framing -> deceptive_fraud'
);

// ---- migrateLegacyV4L1: AI_ENABLED_ABUSE disambiguation ----

const aiResult = migrateLegacyV4L1('AI_ENABLED_ABUSE', 'jailbreak this model');
assertEq(aiResult.l1, 'cyber_intrusion', 'AI_ENABLED_ABUSE -> cyber_intrusion');
assertEq(aiResult.l2, 'prompt_injection_attack', 'AI_ENABLED_ABUSE -> prompt_injection_attack (default)');
assertEq(aiResult.ambiguous, true, 'AI_ENABLED_ABUSE migration carries ambiguous flag');

// ---- migrateLegacyV4L1: unknown codes return null ----

assertEq(migrateLegacyV4L1('NOT_A_V4_CODE', ''), null, 'Unknown v4 code returns null');
assertEq(migrateLegacyV4L1('', ''), null, 'Empty code returns null');

// ---- truncateAtSentenceBoundary ----

// Under cap -> returned unchanged.
assertEq(
  truncateAtSentenceBoundary('Short.', 100),
  'Short.',
  'Under-cap string returned unchanged'
);

// Over cap, last period in window -> truncate at period.
const twoSentences = 'First sentence. Second sentence is much longer than the cap allows.';
assertEq(
  truncateAtSentenceBoundary(twoSentences, 20),
  'First sentence.',
  'Two sentences with cap mid-second: truncate at first sentence end'
);

// Over cap with ! or ?.
assertEq(
  truncateAtSentenceBoundary('Wait! This part overruns.', 6),
  'Wait!',
  'Exclamation mark counts as sentence boundary'
);
assertEq(
  truncateAtSentenceBoundary('Is it? This part overruns.', 7),
  'Is it?',
  'Question mark counts as sentence boundary'
);

// Over cap with no sentence boundary in window -> fall back to last whitespace + period.
const noBoundary = 'This is a single sentence that runs much much longer than the small cap with no boundary punctuation in window';
const out = truncateAtSentenceBoundary(noBoundary, 30);
assertTruthy(out.length <= 30, 'Whitespace-fallback truncation stays at or below cap (got len ' + out.length + ')');
assertTruthy(out.endsWith('.'), 'Whitespace-fallback truncation ends with period');

// Empty / null / undefined inputs.
assertEq(truncateAtSentenceBoundary('', 100), '', 'Empty string -> empty');
assertEq(truncateAtSentenceBoundary(null, 100), '', 'Null -> empty');
assertEq(truncateAtSentenceBoundary(undefined, 100), '', 'Undefined -> empty');

// Real-world spec caps.
const longReason = 'A'.repeat(POLICY_CONFIG.REASONING_SUMMARY_MAX_CHARS - 10) + '. Trailing sentence that pushes well past the cap.';
const outReason = truncateAtSentenceBoundary(longReason, POLICY_CONFIG.REASONING_SUMMARY_MAX_CHARS);
assertTruthy(outReason.length <= POLICY_CONFIG.REASONING_SUMMARY_MAX_CHARS, 'Reasoning-summary truncation respects cap (got len ' + outReason.length + ')');
assertTruthy(/[.!?]$/.test(outReason), 'Reasoning-summary truncation ends with sentence-final punctuation');

// ---- Summary ----

console.log(assertions + ' assertions, ' + failures + ' failures');
process.exit(failures > 0 ? 1 : 0);
