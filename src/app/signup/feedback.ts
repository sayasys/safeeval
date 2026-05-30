// Pure presentation logic for the signup page. Kept out of page.js so it can
// be unit-tested under a node environment without a DOM (the repo has no
// @testing-library/react or jsdom). page.js renders whatever these functions
// derive; all the branching and copy decisions live here.
//
// The shape consumed here is the provider-agnostic AuthActionResult envelope
// from src/lib/auth/actions.ts ({ ok, error?, pendingEmailConfirmation? }) --
// NOT the raw Supabase { data, session } shape. The migration-readiness rule
// keeps Supabase types inside src/lib/auth, so the page only ever sees this
// envelope.

export type SignupStatus =
  | 'idle'
  | 'submitting'
  | 'success-pending-confirmation'
  | 'success-immediate'
  | 'error';

export interface SignupResultLike {
  ok: boolean;
  error?: string;
  pendingEmailConfirmation?: boolean;
}

export interface SignupUiState {
  status: SignupStatus;
  // Human-facing message for success/error states; null when there is nothing
  // to show (idle, submitting, or the immediate-session redirect path).
  message: string | null;
  // When true the error message should be accompanied by a link to /login --
  // used for the "account already exists" case.
  showLoginLink: boolean;
}

export interface FriendlyError {
  text: string;
  showLoginLink: boolean;
}

// Map a raw provider error message onto friendly copy. Unknown messages fall
// through to the raw text so we never swallow a real provider error.
export function friendlyAuthError(raw?: string): FriendlyError {
  if (!raw) {
    return { text: 'Something went wrong. Please try again.', showLoginLink: false };
  }
  const msg = raw.toLowerCase();

  if (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('user_already_exists') ||
    msg.includes('already exists')
  ) {
    return {
      text: 'An account with this email already exists. Try logging in instead.',
      showLoginLink: true,
    };
  }

  if (msg.includes('email') && (msg.includes('invalid') || msg.includes('valid'))) {
    return { text: 'Please enter a valid email address.', showLoginLink: false };
  }

  if (
    msg.includes('password') &&
    (msg.includes('at least') ||
      msg.includes('too short') ||
      msg.includes('should be') ||
      msg.includes('characters') ||
      msg.includes('weak'))
  ) {
    return { text: 'Password must be at least 8 characters.', showLoginLink: false };
  }

  if (
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout') ||
    msg.includes('internal server') ||
    msg.includes('service unavailable') ||
    /\b5\d\d\b/.test(msg)
  ) {
    return { text: 'Something went wrong. Please try again.', showLoginLink: false };
  }

  // Fallback: surface the provider's message verbatim.
  return { text: raw, showLoginLink: false };
}

// Derive the next UI state from an auth action result. The page handles the
// 'success-immediate' side effect (router.push) itself; this function just
// reports the status.
export function deriveSignupState(result: SignupResultLike, email: string): SignupUiState {
  if (!result.ok) {
    const friendly = friendlyAuthError(result.error);
    return { status: 'error', message: friendly.text, showLoginLink: friendly.showLoginLink };
  }

  if (result.pendingEmailConfirmation) {
    const target = email.trim() || 'your email';
    return {
      status: 'success-pending-confirmation',
      message: `Check ${target} for a confirmation link to finish signing up.`,
      showLoginLink: false,
    };
  }

  return { status: 'success-immediate', message: null, showLoginLink: false };
}
