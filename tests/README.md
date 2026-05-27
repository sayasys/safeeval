# SafeEval tests

Golden-prompt regression harness for the SafeEval v5 engine.

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

The runner POSTs each golden prompt to `/api/evaluate` and checks the v5
response against `expected_v5` in the golden file:

- `response.classification.l1.value` vs `expected_v5.l1` (or `expected_v5.l1_any_of`)
- `response.classification.l2.value` vs `expected_v5.l2` (or `expected_v5.l2_any_of`), only when non-null
- `response.disposition.action` vs `expected_v5.disposition_action` (or `expected_v5.disposition_action_any_of`)

Plus universal envelope invariants (disposition.degraded is a boolean,
reasoning_summary / narrative_summary end at sentence-final punctuation,
rule-12 MUST half on l2_probabilities). Probabilities are not asserted --
see "What probabilities are NOT tested" below.

### Pointing at a different host

```bash
TEST_BASE_URL=https://safeeval.vercel.app node tests/runner.js
```

## Exit codes

- `0` -- every golden passed.
- `1` -- one or more goldens failed, or a request errored.

This makes the runner safe to wire into CI.

## Adding a new golden

1. Pick the next numeric prefix (`13-...`, `14-...`, etc.). The runner
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
     "expected_v5": {
       "l1": "benign | security_education | ambiguous_dual_use | deceptive_fraud | privacy_abuse | platform_abuse | cyber_intrusion",
       "l2": "<L2 string or null if ambiguous>",
       "disposition_action": "allow | safe_completion | human_review | block"
     }
   }
   ```

   For non-deterministic outputs, use the set-valued form `l1_any_of` /
   `l2_any_of` / `disposition_action_any_of` (array of allowed values).
   Single-value and `_any_of` forms are mutually exclusive per field.

4. Prompt text should be plain ASCII -- no smart quotes, em dashes, or
   non-ASCII whitespace. The JSON file itself may be UTF-8 but staying
   ASCII keeps the Windows-mount round-trip safe.

## What probabilities are NOT tested -- and why

The engine returns `l2_probabilities`, `component_scores`, `aggregate_score`,
per-stage confidences, and the `confidence_path`. **None** of these are
asserted in goldens. Two reasons:

1. **They drift across model versions.** Sonnet 4.6 will not produce the
   same float as Sonnet 4.7 will not produce the same float as the
   eventual replacement model. Pinning probabilities turns model
   upgrades into mass test-rewriting exercises with no policy signal.
2. **They are not the contract.** The decision the system makes is an
   L1/L2 label plus a disposition action. Those are the values
   downstream consumers and users see. Goldens guard the contract, not
   the implementation.

If you need to enforce a probability bound (e.g. "this prompt's
romance_fraud L2 probability must be above 0.5"), open a separate
calibration test -- don't bury it in a golden.

## Roadmap

- Round 2: schema-keeper wires in `tests/schema/v5-envelope.schema.json`
  validation for the v5 response shape (TODO marker exists in
  `runner.js`).
- Future: per-stage trace assertions once the v5 pipeline returns trace
  metadata under `?debug=1`.
