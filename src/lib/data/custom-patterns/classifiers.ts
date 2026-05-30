// Persistence helpers for org-defined Custom L3 Classifiers (Phase 1).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 3.3 / 3.4 / 5 / 6 / 7 + the section 13 adjudications. Every helper is
// organization-scoped (orgId-first). The four-state lifecycle
// (proposed -> shadow -> live -> retired) is enforced here at the application
// layer; the M13 schema only constrains the status to the closed set.
//
// Phase 1 boundary: the inference path that actually evaluates classifiers
// against input (Q8 independent-pass, Q10 concurrency cap) is NOT built here --
// it is Phase 4. The constants for it live in ./constants.ts so the Phase 4
// integration reads them from one place. The promotion gate's precision-proxy
// computation (memo section 6.3) is likewise Phase 4; promoteToLive here takes
// the reviewer set as an argument and enforces the distinct-reviewer floor (Q4 /
// R5) plus the per-org live cap (Q9), which are the structural guards that must
// exist before any live classifier can be written.

import {
  resolveStore,
  type CustomPatternsOptions,
} from './patterns';
import type { InsertExampleRow } from './store';
import {
  L3_GROUP_NAMES,
  EXAMPLE_KINDS,
  type NewCustomL3Classifier,
  type NewCustomL3Example,
  type CustomL3Classifier,
  type CustomL3ClassifierWithExamples,
  type ClassifierStatus,
} from './types';
import {
  TAG_NAME_PATTERN,
  DEFINITION_MIN_LENGTH,
  DEFINITION_MAX_LENGTH,
  EXAMPLE_MIN_LENGTH,
  EXAMPLE_MAX_LENGTH,
  MIN_EXAMPLES_PER_KIND,
  MIN_DISTINCT_REVIEWERS,
  LIVE_CLASSIFIER_CAP,
  ASCII_PRINTABLE_PATTERN,
  BRIGHT_LINE_MIN_LENGTH,
  BRIGHT_LINE_MAX_LENGTH,
  BRIGHT_LINE_INDICATORS_MAX,
  CONFLICTS_WITH_MAX,
} from './constants';
import {
  CustomPatternsValidationError,
  ClassifierNotFoundError,
  InsufficientExamplesError,
  InsufficientReviewersError,
  OrgClassifierCapExceededError,
  ClassifierRetirementForbiddenError,
  InvalidStatusTransitionError,
} from './errors';
// Type-only import: keeps the data layer free of any runtime dependency on the
// auth provider while reusing the canonical OrgRole vocabulary. The retirement
// authority predicate (owner/admin) mirrors roleSatisfies(actorRole, 'admin')
// from src/lib/auth/roles.ts; the route layer additionally calls requireOrgRole
// on the session in Phase 2+.
import type { OrgRole } from '../../auth/types';

const nowIso = (): string => new Date().toISOString();

function validateExample(e: NewCustomL3Example, label: string): void {
  if (!EXAMPLE_KINDS.includes(e.kind)) {
    throw new CustomPatternsValidationError(`${label}.kind`, `must be one of ${EXAMPLE_KINDS.join(', ')}`);
  }
  if (typeof e.text !== 'string' || e.text.length < EXAMPLE_MIN_LENGTH || e.text.length > EXAMPLE_MAX_LENGTH) {
    throw new CustomPatternsValidationError(
      `${label}.text`,
      `must be ${EXAMPLE_MIN_LENGTH}-${EXAMPLE_MAX_LENGTH} chars`,
    );
  }
}

// bright_line_indicators[] (memo 5.5): printable ASCII, 1--200 chars, capped
// entry count. Optional -- an omitted / empty array is valid.
function validateBrightLineIndicators(values: string[] | undefined): void {
  if (values === undefined) return;
  if (!Array.isArray(values)) {
    throw new CustomPatternsValidationError('bright_line_indicators', 'must be an array');
  }
  if (values.length > BRIGHT_LINE_INDICATORS_MAX) {
    throw new CustomPatternsValidationError(
      'bright_line_indicators',
      `must have at most ${BRIGHT_LINE_INDICATORS_MAX} entries`,
    );
  }
  values.forEach((v, i) => {
    if (typeof v !== 'string' || v.length < BRIGHT_LINE_MIN_LENGTH || v.length > BRIGHT_LINE_MAX_LENGTH) {
      throw new CustomPatternsValidationError(
        `bright_line_indicators[${i}]`,
        `must be ${BRIGHT_LINE_MIN_LENGTH}-${BRIGHT_LINE_MAX_LENGTH} chars`,
      );
    }
    if (!ASCII_PRINTABLE_PATTERN.test(v)) {
      throw new CustomPatternsValidationError(
        `bright_line_indicators[${i}]`,
        'must be printable ASCII only',
      );
    }
  });
}

// conflicts_with[] (memo 5.6): tag-name references (closed-set or org-custom),
// each validated against the snake_case ASCII 1--40 tag-name shape. Not FKs;
// existence is not checked. Optional -- an omitted / empty array is valid.
function validateConflictsWith(values: string[] | undefined): void {
  if (values === undefined) return;
  if (!Array.isArray(values)) {
    throw new CustomPatternsValidationError('conflicts_with', 'must be an array');
  }
  if (values.length > CONFLICTS_WITH_MAX) {
    throw new CustomPatternsValidationError(
      'conflicts_with',
      `must have at most ${CONFLICTS_WITH_MAX} entries`,
    );
  }
  values.forEach((v, i) => {
    if (typeof v !== 'string' || !TAG_NAME_PATTERN.test(v)) {
      throw new CustomPatternsValidationError(
        `conflicts_with[${i}]`,
        'must be a snake_case ASCII tag name, 1-40 chars',
      );
    }
  });
}

function validateNewClassifier(classifier: NewCustomL3Classifier, examples: NewCustomL3Example[]): void {
  if (!L3_GROUP_NAMES.includes(classifier.group_name)) {
    throw new CustomPatternsValidationError('group_name', `must be one of ${L3_GROUP_NAMES.join(', ')}`);
  }
  if (typeof classifier.tag_name !== 'string' || !TAG_NAME_PATTERN.test(classifier.tag_name)) {
    throw new CustomPatternsValidationError(
      'tag_name',
      'must be snake_case ASCII, start with a lowercase letter, and be 1-40 chars',
    );
  }
  if (
    typeof classifier.definition !== 'string' ||
    classifier.definition.length < DEFINITION_MIN_LENGTH ||
    classifier.definition.length > DEFINITION_MAX_LENGTH
  ) {
    throw new CustomPatternsValidationError(
      'definition',
      `must be ${DEFINITION_MIN_LENGTH}-${DEFINITION_MAX_LENGTH} chars`,
    );
  }
  if (typeof classifier.created_by_user_id !== 'string' || classifier.created_by_user_id.length === 0) {
    throw new CustomPatternsValidationError('created_by_user_id', 'must be a non-empty string');
  }
  if (!Array.isArray(examples)) {
    throw new CustomPatternsValidationError('examples', 'must be an array');
  }
  examples.forEach((e, i) => validateExample(e, `examples[${i}]`));
  validateBrightLineIndicators(classifier.bright_line_indicators);
  validateConflictsWith(classifier.conflicts_with);
}

// Create a Custom L3 Classifier in 'proposed' status plus any supplied examples.
// The >= 2-of-each-kind example requirement is NOT enforced here -- a proposed
// classifier is a draft the customer iterates on; the example floor is the gate
// to 'shadow' (memo sections 5 + 6.2). Inserts the parent first, then examples;
// rolls the parent back (best effort) if the example insert fails.
export async function createCustomClassifier(
  orgId: string,
  classifier: NewCustomL3Classifier,
  examples: NewCustomL3Example[] = [],
  options?: CustomPatternsOptions,
): Promise<CustomL3ClassifierWithExamples> {
  validateNewClassifier(classifier, examples);
  const store = resolveStore(options);

  const created = await store.insertClassifier({
    organization_id: orgId,
    group_name: classifier.group_name,
    tag_name: classifier.tag_name,
    definition: classifier.definition,
    status: 'proposed',
    // Default to [] when omitted (defensive; the M14 column DEFAULT '{}' also
    // covers this). Validation above has already bounded any supplied entries.
    bright_line_indicators: classifier.bright_line_indicators ?? [],
    conflicts_with: classifier.conflicts_with ?? [],
    created_by_user_id: classifier.created_by_user_id,
  });

  let savedExamples;
  try {
    const rows: InsertExampleRow[] = examples.map((e) => ({
      classifier_id: created.id,
      kind: e.kind,
      text: e.text,
    }));
    savedExamples = await store.insertExamples(rows);
  } catch (err) {
    try {
      await store.deleteClassifier(orgId, created.id);
    } catch {
      /* best effort */
    }
    throw err;
  }

  return { ...created, examples: savedExamples };
}

export async function getCustomClassifier(
  orgId: string,
  classifierId: string,
  options?: CustomPatternsOptions,
): Promise<CustomL3ClassifierWithExamples | null> {
  const store = resolveStore(options);
  const classifier = await store.getClassifierById(orgId, classifierId);
  if (!classifier) return null;
  const examples = await store.getExamples(classifier.id);
  return { ...classifier, examples };
}

export async function listCustomClassifiers(
  orgId: string,
  status?: ClassifierStatus,
  options?: CustomPatternsOptions,
): Promise<CustomL3Classifier[]> {
  const store = resolveStore(options);
  return store.listClassifiers(orgId, status);
}

// proposed -> shadow. Requires >= MIN_EXAMPLES_PER_KIND of each example kind
// (memo section 6.2). Sets shadow_started_at.
export async function promoteToShadow(
  orgId: string,
  classifierId: string,
  options?: CustomPatternsOptions,
): Promise<CustomL3Classifier> {
  const store = resolveStore(options);
  const classifier = await store.getClassifierById(orgId, classifierId);
  if (!classifier) throw new ClassifierNotFoundError(orgId, classifierId);
  if (classifier.status !== 'proposed') {
    throw new InvalidStatusTransitionError(classifier.status, 'shadow');
  }

  const examples = await store.getExamples(classifier.id);
  const positive = examples.filter((e) => e.kind === 'positive').length;
  const negative = examples.filter((e) => e.kind === 'negative').length;
  if (positive < MIN_EXAMPLES_PER_KIND || negative < MIN_EXAMPLES_PER_KIND) {
    throw new InsufficientExamplesError(MIN_EXAMPLES_PER_KIND, positive, negative);
  }

  const updated = await store.updateClassifier(orgId, classifierId, {
    status: 'shadow',
    shadow_started_at: nowIso(),
  });
  if (!updated) throw new ClassifierNotFoundError(orgId, classifierId);
  return updated;
}

// shadow -> live. Enforces the distinct-reviewer floor (Q4 / memo R5) and the
// per-org live cap (Q9) BEFORE writing. Sets promoted_at. The precision-proxy
// computation that gates the in-app "Ready to promote" banner is Phase 4; this
// helper is the structural guard that no live classifier is written without the
// reviewer-diversity and cap checks passing.
export async function promoteToLive(
  orgId: string,
  classifierId: string,
  reviewerIds: string[],
  options?: CustomPatternsOptions,
): Promise<CustomL3Classifier> {
  const store = resolveStore(options);
  const classifier = await store.getClassifierById(orgId, classifierId);
  if (!classifier) throw new ClassifierNotFoundError(orgId, classifierId);
  if (classifier.status !== 'shadow') {
    throw new InvalidStatusTransitionError(classifier.status, 'live');
  }

  const distinctReviewers = new Set(reviewerIds ?? []).size;
  if (distinctReviewers < MIN_DISTINCT_REVIEWERS) {
    throw new InsufficientReviewersError(MIN_DISTINCT_REVIEWERS, distinctReviewers);
  }

  // Q9: the cap counts classifiers already in 'live' status for this org. The
  // proposed insert would make liveCount + 1, so reject when the existing count
  // already meets the cap.
  const liveCount = await store.countLiveClassifiers(orgId);
  if (liveCount >= LIVE_CLASSIFIER_CAP) {
    throw new OrgClassifierCapExceededError(LIVE_CLASSIFIER_CAP, liveCount);
  }

  const updated = await store.updateClassifier(orgId, classifierId, {
    status: 'live',
    promoted_at: nowIso(),
  });
  if (!updated) throw new ClassifierNotFoundError(orgId, classifierId);
  return updated;
}

// Retire a classifier (memo section 6.5, Q13). Authority is restricted to the
// org owner or admin -- a reviewer cannot retire, because retirement is a
// configuration change, not a reviewer activity. The predicate mirrors
// roleSatisfies(actorRole, 'admin') from src/lib/auth/roles.ts. Retirement is
// allowed from any non-retired state; retiring an already-retired classifier is
// an idempotent no-op.
export async function retireClassifier(
  orgId: string,
  classifierId: string,
  actorRole: OrgRole,
  options?: CustomPatternsOptions,
): Promise<CustomL3Classifier> {
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    throw new ClassifierRetirementForbiddenError(actorRole);
  }

  const store = resolveStore(options);
  const classifier = await store.getClassifierById(orgId, classifierId);
  if (!classifier) throw new ClassifierNotFoundError(orgId, classifierId);
  if (classifier.status === 'retired') return classifier;

  const updated = await store.updateClassifier(orgId, classifierId, {
    status: 'retired',
    retired_at: nowIso(),
  });
  if (!updated) throw new ClassifierNotFoundError(orgId, classifierId);
  return updated;
}
