// Typed errors for the custom patterns + custom L3 classifiers persistence
// layer. Mirrors the PersistError style in ../persistence.ts: each error
// overrides `name`, carries a stable `code`, and reads cleanly in a log line.
//
// These are intentionally standalone (they do not extend the auth ErrorBase
// chain) so the data layer carries no runtime dependency on the auth provider.
// The action / route layer (Phase 2+) maps them to HTTP responses.

export type CustomPatternsErrorCode =
  | 'VALIDATION'
  | 'PATTERN_NOT_FOUND'
  | 'CLASSIFIER_NOT_FOUND'
  | 'INSUFFICIENT_EXAMPLES'
  | 'INSUFFICIENT_REVIEWERS'
  | 'ORG_CLASSIFIER_CAP_EXCEEDED'
  | 'RETIREMENT_FORBIDDEN'
  | 'INVALID_STATUS_TRANSITION';

export class CustomPatternsError extends Error {
  readonly code: CustomPatternsErrorCode;
  constructor(message: string, code: CustomPatternsErrorCode) {
    super(message);
    this.code = code;
  }
}

// A field-level validation failure mirroring an M13 CHECK constraint, raised at
// the application layer before the write reaches Postgres.
export class CustomPatternsValidationError extends CustomPatternsError {
  override readonly name = 'CustomPatternsValidationError';
  readonly field: string;
  constructor(field: string, message: string) {
    super(`${field}: ${message}`, 'VALIDATION');
    this.field = field;
  }
}

export class PatternNotFoundError extends CustomPatternsError {
  override readonly name = 'PatternNotFoundError';
  constructor(organization_id: string, pattern_id: string) {
    super(
      `pattern ${pattern_id} not found in organization ${organization_id}`,
      'PATTERN_NOT_FOUND',
    );
  }
}

export class ClassifierNotFoundError extends CustomPatternsError {
  override readonly name = 'ClassifierNotFoundError';
  constructor(organization_id: string, classifier_id: string) {
    super(
      `custom L3 classifier ${classifier_id} not found in organization ${organization_id}`,
      'CLASSIFIER_NOT_FOUND',
    );
  }
}

// promoteToShadow precondition (memo section 6.2): at least N examples of each
// kind. Carries the observed counts for a useful log / UI message.
export class InsufficientExamplesError extends CustomPatternsError {
  override readonly name = 'InsufficientExamplesError';
  readonly required: number;
  readonly positive: number;
  readonly negative: number;
  constructor(required: number, positive: number, negative: number) {
    super(
      `promotion to shadow requires >= ${required} positive and >= ${required} negative examples; have ${positive} positive, ${negative} negative`,
      'INSUFFICIENT_EXAMPLES',
    );
    this.required = required;
    this.positive = positive;
    this.negative = negative;
  }
}

// promoteToLive precondition (memo section 11 R5 / Q4): distinct-reviewer floor.
export class InsufficientReviewersError extends CustomPatternsError {
  override readonly name = 'InsufficientReviewersError';
  readonly required: number;
  readonly distinct: number;
  constructor(required: number, distinct: number) {
    super(
      `promotion to live requires >= ${required} distinct reviewers; have ${distinct}`,
      'INSUFFICIENT_REVIEWERS',
    );
    this.required = required;
    this.distinct = distinct;
  }
}

// promoteToLive precondition (memo Q9): per-org live-classifier cap.
export class OrgClassifierCapExceededError extends CustomPatternsError {
  override readonly name = 'OrgClassifierCapExceededError';
  readonly cap: number;
  readonly current: number;
  constructor(cap: number, current: number) {
    super(
      `organization already has ${current} live custom L3 classifiers; cap is ${cap}`,
      'ORG_CLASSIFIER_CAP_EXCEEDED',
    );
    this.cap = cap;
    this.current = current;
  }
}

// retireClassifier authority guard (memo Q13): only owner / admin may retire.
export class ClassifierRetirementForbiddenError extends CustomPatternsError {
  override readonly name = 'ClassifierRetirementForbiddenError';
  readonly actorRole: string;
  constructor(actorRole: string) {
    super(
      `retiring a custom L3 classifier requires the 'owner' or 'admin' role; caller has '${actorRole}'`,
      'RETIREMENT_FORBIDDEN',
    );
    this.actorRole = actorRole;
  }
}

// A lifecycle transition that the four-state machine does not permit (memo
// section 6). e.g. promoting a 'retired' classifier to 'live'.
export class InvalidStatusTransitionError extends CustomPatternsError {
  override readonly name = 'InvalidStatusTransitionError';
  readonly from: string;
  readonly to: string;
  constructor(from: string, to: string) {
    super(
      `invalid custom L3 classifier status transition: '${from}' -> '${to}'`,
      'INVALID_STATUS_TRANSITION',
    );
    this.from = from;
    this.to = to;
  }
}
