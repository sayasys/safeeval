'use client';

// Result-card affordance for turning a finished text/conversation evaluation
// into an audience-tailored report. Lives at the bottom of the Evaluator result
// card (prompt + conversation only -- image/audio results have a different
// shape and no report path).
//
// Flow:
//   1. "Generate report" opens an inline audience picker (Reviewer / Trust &
//      Safety lead / Executive summary / Legal). Legal is grayed unless the
//      caller holds the pii_reviewer role -- resolved from /api/app/session-role
//      on first open, so a public/anon visitor sees it disabled with the
//      runbook tooltip rather than a failed POST.
//   2. Generate POSTs to /api/app/reports/:evaluation_id/:audience. The route
//      persists and returns the report markdown.
//   3. On success the report renders inline below the card (the route returns
//      markdown, not an id, so there is no detail-page redirect) with a link to
//      /app/reports. On error the message is surfaced -- the disabled-feature
//      state in particular is rendered plainly for portfolio-demo honesty.
//
// Prerequisite: a report needs a persisted evaluation. evaluationId is present
// only when SAFEEVAL_PERSIST_EVALUATIONS is on (the evaluate route attaches the
// DB id to the response then). When it is absent the panel explains why rather
// than POSTing to a dead id. Cool palette throughout: brand-blue CTA, slate
// chrome, muted-slate info/disabled states (never red -- these are info, not
// danger).

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  AUDIENCE_ORDER,
  AUDIENCE_LABELS,
  AUDIENCE_DESCRIPTIONS,
} from './audience';
import ReportMarkdown from './ReportMarkdown';

const LEGAL_TOOLTIP = 'Requires PII reviewer role -- see ops runbook.';

const ERROR_MESSAGES = {
  report_gen_disabled:
    "Report generation isn't enabled for this project yet. Ask the admin to set SAFEEVAL_REPORT_GEN_LIVE=true.",
  legal_access_denied:
    'Legal-audience reports require the PII reviewer role, granted manually by ops per the runbook. This attempt was recorded for security review.',
  evaluation_not_found:
    "This evaluation isn't saved yet, so it can't be turned into a report.",
  unauthorized: 'Sign in to generate reports.',
};

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-blue"
    />
  );
}

export default function GenerateReportPanel({ evaluationId, inputKind }) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState('reviewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null); // { markdown, audience }
  // null = not yet resolved; boolean once /api/app/session-role answers.
  const [isPiiReviewer, setIsPiiReviewer] = useState(null);

  // Image/audio results have no report path. Defensive: the caller already
  // gates on this, but the panel refuses to render for other kinds.
  if (inputKind !== 'prompt' && inputKind !== 'conversation') return null;

  const hasEvaluation = typeof evaluationId === 'string' && evaluationId.length > 0;

  const resolveRole = useCallback(async () => {
    if (isPiiReviewer !== null) return;
    try {
      const res = await fetch('/api/app/session-role', { credentials: 'same-origin' });
      if (!res.ok) {
        setIsPiiReviewer(false);
        return;
      }
      const data = await res.json();
      setIsPiiReviewer(Boolean(data?.is_pii_reviewer));
    } catch {
      setIsPiiReviewer(false);
    }
  }, [isPiiReviewer]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setError(null);
    void resolveRole();
  }, [resolveRole]);

  const handleGenerate = useCallback(async () => {
    if (!hasEvaluation) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(
        `/api/app/reports/${encodeURIComponent(evaluationId)}/${encodeURIComponent(audience)}`,
        { method: 'POST', credentials: 'same-origin' },
      );
      if (res.ok) {
        const markdown = await res.text();
        setReport({ markdown, audience });
        return;
      }
      let code = null;
      let message = null;
      try {
        const data = await res.json();
        code = data?.code ?? null;
        message = data?.error ?? null;
      } catch {
        /* non-JSON error body */
      }
      setError(
        (code && ERROR_MESSAGES[code]) ||
          message ||
          `Report generation failed (HTTP ${res.status}).`,
      );
    } catch {
      setError('Could not reach the report service. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [audience, evaluationId, hasEvaluation]);

  const audienceLabelFor = (a) => AUDIENCE_LABELS[a] ?? a;

  return (
    <div className="mt-6 border-t border-slate-200 pt-4">
      {!open ? (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-blue hover:text-brand-blue"
        >
          Generate report
        </button>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Generate a report
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>

          {!hasEvaluation ? (
            <p className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
              This evaluation isn&apos;t saved, so there&apos;s nothing to turn
              into a report yet. Enable{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-800">
                SAFEEVAL_PERSIST_EVALUATIONS
              </code>{' '}
              to store evaluations and unlock report generation.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-slate-500">
                Pick an audience. The summary is tailored to that reader.
              </p>
              <fieldset className="mt-3 space-y-2" disabled={loading}>
                {AUDIENCE_ORDER.map((a) => {
                  const isLegal = a === 'legal';
                  const legalLocked = isLegal && isPiiReviewer !== true;
                  const selected = audience === a;
                  return (
                    <label
                      key={a}
                      title={legalLocked ? LEGAL_TOOLTIP : undefined}
                      className={[
                        'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2',
                        legalLocked
                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-60'
                          : selected
                            ? 'border-brand-blue bg-white ring-1 ring-brand-blue'
                            : 'border-slate-200 bg-white hover:border-slate-300',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="report-audience"
                        value={a}
                        checked={selected}
                        disabled={legalLocked}
                        onChange={() => setAudience(a)}
                        className="mt-1 accent-brand-blue"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900">
                          {audienceLabelFor(a)}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {legalLocked ? LEGAL_TOOLTIP : AUDIENCE_DESCRIPTIONS[a]}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Spinner />
                      Generating {audienceLabelFor(audience)} report...
                    </>
                  ) : (
                    'Generate'
                  )}
                </button>
              </div>
            </>
          )}

          {error && (
            <div
              role="status"
              className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
            >
              {error}
            </div>
          )}

          {report && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {audienceLabelFor(report.audience)} report
                </span>
                <Link
                  href="/app/reports"
                  className="text-xs font-medium text-brand-blue hover:underline"
                >
                  All reports &rarr;
                </Link>
              </div>
              <ReportMarkdown markdown={report.markdown} />
              <p className="mt-3 text-xs text-slate-400">
                Saved to your reports.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
