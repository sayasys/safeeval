// Tests for the signup page's pure feedback logic (src/app/signup/feedback.ts).
// The repo has no DOM test environment (vitest runs under `node`, no
// @testing-library/react or jsdom), so we test the state-derivation and
// friendly-error mapping that drive every rendered state rather than mounting
// the component. Each assertion corresponds to one visible UI state in
// src/app/signup/page.js.

import { describe, it, expect } from 'vitest';

import { deriveSignupState, friendlyAuthError } from '../../src/app/signup/feedback';

describe('deriveSignupState', () => {
  it('maps a confirmation-pending success to the check-your-email state', () => {
    const state = deriveSignupState(
      { ok: true, pendingEmailConfirmation: true },
      'fresh@example.com',
    );
    expect(state.status).toBe('success-pending-confirmation');
    expect(state.message).toBe(
      'Check fresh@example.com for a confirmation link to finish signing up.',
    );
    expect(state.showLoginLink).toBe(false);
  });

  it('falls back to a generic address when the email is blank', () => {
    const state = deriveSignupState({ ok: true, pendingEmailConfirmation: true }, '   ');
    expect(state.message).toBe('Check your email for a confirmation link to finish signing up.');
  });

  it('maps an immediate-session success (no pending flag) to the redirect state', () => {
    const state = deriveSignupState({ ok: true }, 'fresh@example.com');
    expect(state.status).toBe('success-immediate');
    expect(state.message).toBeNull();
  });

  it('treats an explicit pendingEmailConfirmation=false as an immediate session', () => {
    const state = deriveSignupState(
      { ok: true, pendingEmailConfirmation: false },
      'fresh@example.com',
    );
    expect(state.status).toBe('success-immediate');
  });

  it('maps an error result to the error state with friendly copy', () => {
    const state = deriveSignupState(
      { ok: false, error: 'User already registered' },
      'taken@example.com',
    );
    expect(state.status).toBe('error');
    expect(state.message).toBe(
      'An account with this email already exists. Try logging in instead.',
    );
    expect(state.showLoginLink).toBe(true);
  });
});

describe('friendlyAuthError', () => {
  it('flags an existing account and surfaces the login link', () => {
    for (const raw of [
      'User already registered',
      'Email address has already been registered',
      'user_already_exists',
    ]) {
      const fe = friendlyAuthError(raw);
      expect(fe.text).toBe(
        'An account with this email already exists. Try logging in instead.',
      );
      expect(fe.showLoginLink).toBe(true);
    }
  });

  it('maps invalid-email errors', () => {
    const fe = friendlyAuthError('Unable to validate email address: invalid format');
    expect(fe.text).toBe('Please enter a valid email address.');
    expect(fe.showLoginLink).toBe(false);
  });

  it('maps short/weak password errors', () => {
    const fe = friendlyAuthError('Password should be at least 8 characters');
    expect(fe.text).toBe('Password must be at least 8 characters.');
  });

  it('maps network / 5xx errors to a retry message', () => {
    for (const raw of ['Failed to fetch', 'Service unavailable', 'Request returned 503']) {
      expect(friendlyAuthError(raw).text).toBe('Something went wrong. Please try again.');
    }
  });

  it('maps a missing message to the generic retry copy', () => {
    expect(friendlyAuthError(undefined).text).toBe('Something went wrong. Please try again.');
    expect(friendlyAuthError('').text).toBe('Something went wrong. Please try again.');
  });

  it('surfaces an unrecognized provider message verbatim', () => {
    const fe = friendlyAuthError('Signups are disabled for this project');
    expect(fe.text).toBe('Signups are disabled for this project');
    expect(fe.showLoginLink).toBe(false);
  });
});
