# SafeEval tests

Golden-prompt regression harness for the SafeEval engine.

## Layout

```
tests/
  golden/        # one JSON per canonical prompt
  runner.js      # node script that POSTs each golden to /api/evaluate
  README.md      # this file
```

## How to run

The runner assumes the Next.js app is running locally on port 3000.

```bash
# In one terminal:
npm run dev

# In another:
node tests/runner.js
```

### v4 mode (default)

Checks `response.typology` and `response.escalation_tier` against
`expected_v4` in each golden file.

```bash
node tests/runner.js
```

### v5 mode

Adds `?v5=1` to the request and additionally checks
`response.v5.classification.l1.value`,
`response.v5.classification.l2.value` (only when `expected_v5.l2` is
non-null in the golden), and `response.v5.disposition.action`.

```bash
TEST_V5=1 node tests/runner.js
```

### Pointing at a different host

```bash
TEST_BASE_URL=https://safeeval.vercel.app node tests/runner.js
TEST_V5=1 TEST_BASE_URL=https://safeeval.vercel.app node tests/runner.js
```

## Exit codes

- `0` -- every golden passed.
- `1` -- one or more goldens failed, or a request errored.

This makes the runner safe to wire into CI.

## Adding a new golden

1. Pick the next numeric prefix (`10-...`, `11-...`, etc.). The runner
   sorts files lexicographically; the prefix controls run order.
2. Each golden tests a specific decision boundary. If you can't write a
   one-paragraph `notes` field explaining what boundary it tests and
   what would go wrong if a stage broke, the prompt doesn't earn its
   slot. Keep the set tight.
3. Create `tests/golden/NN-short-slug.json` with this shape:

   ```json
   {
     "prompt": "...",
     "notes": "what boundary this tests, what we'd expect to go wrong if a stage broke",
     "expected_v4": {
       "typology": "ROMANCE | INVESTMENT | PHISHING | IMPERSONATION | ADVANCE_FEE | FRAUD_INFRASTRUCTURE | RECOVERY | ACCOUNT_TAKEOVER | AI_ENABLED_ABUSE | NONE",
       "escalation_tier": "ALLOW | REVIEW | BLOCK"
     },
     "expected_v5": {
       "l1": "benign | security_education | ambiguous_dual_use | deceptive_fraud | privacy_abuse | platform_abuse | cyber_intrusion",
       "l2": "<L2 string or null if ambiguous>",
       "disposition_action": "allow | safe_completion | human_review | block"
     }
   }
   ```

4. Prompt text should be plain ASCII -- no smart quotes, em dashes, or
   non-ASCII whitespace. The JSON file itself may be UTF-8 but staying
   ASCII keeps the Windows-mount round-trip safe.

## What probabilities are NOT tested -- and why

The engine returns `typology_probabilities`, `sub_typology_analysis[*].probability`,
`component_scores`, `aggregate_score`, `confidence`, and (in v5)
per-layer confidences. **None** of these are asserted in goldens. Two
reasons:

1. **They drift across model versions.** Sonnet 4.6 will not produce the
   same float as Sonnet 4.7 will not produce the same float as the
   eventual replacement model. Pinning probabilities turns model
   upgrades into mass test-rewriting exercises with no policy signal.
2. **They are not the contract.** The decision the system makes is a
   typology label + a tier (v4) or an L1/L2 + disposition action (v5).
   Those are the values downstream consumers and users see. Goldens
   guard the contract, not the implementation.

If you need to enforce a probability bound (e.g. "this prompt's
romance probability must be above 0.5"), open a separate calibration
test -- don't bury it in a golden.

## Roadmap

- Round 2: schema-keeper wires in `tests/schema/v5-envelope.schema.json`
  validation for the v5 response shape (TODO marker exists in
  `runner.js`).
- Future: per-stage trace assertions once the v5 pipeline returns trace
  metadata under `?debug=1`.
