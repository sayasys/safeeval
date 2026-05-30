// Public, read-only threat-intelligence page. Surfaces the OSINT monitoring
// backend (src/lib/osint/) as a portfolio-facing feed. No auth gate; the
// auth-aware chrome lives in layout.js.
//
// The feed renders curated sample data (src/app/intelligence/sample-signals.ts)
// because the daily aggregation cron is not yet running -- the page is honest
// about that in the footer note. When the pipeline ships, this feed swaps to a
// live query without changing the page shape.
//
// Server component: no client interactivity, so no 'use client'. Dates are
// formatted from ISO parts (not toLocaleString) to keep server and client paint
// identical. ASCII-safe per repo convention: straight quotes, "--" not em dash.

import { Radio, ShieldCheck, ListChecks } from 'lucide-react';
import { SAMPLE_SIGNALS } from './sample-signals';

export const metadata = {
  title: 'Threat intelligence -- SafeEval',
  description:
    'SafeEval monitors public fraud-and-scams reporting and extracts tactics, techniques, and procedures into a closed-set vocabulary.',
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Format an ISO 8601 timestamp as "May 29, 2026" deterministically (no locale
// dependence, so server and client render the same string).
function formatDate(iso) {
  const [datePart] = iso.split('T');
  const [year, month, day] = datePart.split('-').map((n) => parseInt(n, 10));
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

// Classifier-verdict pill styling. known_ttp is the quiet sage default;
// new_ttp_proposed gets a coral accent (it routes to architect review);
// low_signal_dismissed is muted slate (the classifier filtered it out).
const CLASSIFICATION_CONFIG = {
  known_ttp: {
    label: 'Known TTP',
    className: 'bg-sage-100 text-sage-700',
  },
  new_ttp_proposed: {
    label: 'New TTP proposed',
    className: 'bg-coral-400/15 text-coral-600',
  },
  low_signal_dismissed: {
    label: 'Low signal',
    className: 'bg-slate-100 text-slate-500',
  },
};

const PIPELINE_STEPS = [
  {
    icon: Radio,
    title: 'Sources',
    body:
      'Seven public feeds -- CISA KEV, IC3, FTC, Krebs on Security, Bleeping Computer, and the r/scams and r/phishing subreddits -- are polled for fresh fraud-and-scams reporting.',
  },
  {
    icon: ShieldCheck,
    title: 'Classifier',
    body:
      'A Claude Haiku classifier reads each signal behind three layers of defensive prompting: untrusted content is framed as data, output is schema-constrained, and a post-check drops any reasoning showing instruction leakage -- so a scraped post cannot hijack the pipeline.',
  },
  {
    icon: ListChecks,
    title: 'Closed-set vocabulary',
    body:
      'Each signal maps to the same closed-set L3 vocabulary the policy framework uses -- a known technique, or a candidate proposed for human review. No free-text labels, no identities, no victim data.',
  },
];

export default function IntelligencePage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16 space-y-16">
      {/* Hero */}
      <header className="max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 leading-[1.1]">
          Threat intelligence
        </h1>
        <p className="mt-5 text-lg text-slate-700 leading-relaxed">
          SafeEval monitors public fraud-and-scams reporting from CISA, IC3, FTC,
          security press, and major subreddits. The classifier extracts tactics,
          techniques, and procedures (TTPs) from each signal -- not identities or
          victim data -- and feeds the closed-set vocabulary used by the policy
          framework.
        </p>
      </header>

      {/* What the pipeline does */}
      <section aria-labelledby="pipeline-heading" className="space-y-5">
        <h2
          id="pipeline-heading"
          className="text-xs font-semibold text-sage-700 uppercase tracking-wider"
        >
          What the pipeline does
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PIPELINE_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="bg-white border border-sage-200 rounded-xl p-5 shadow-soft"
              >
                <div className="flex items-center gap-2 text-sage-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-400">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  {step.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent signals feed */}
      <section aria-labelledby="feed-heading" className="space-y-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="feed-heading"
            className="text-xs font-semibold text-sage-700 uppercase tracking-wider"
          >
            Recent signals
          </h2>
          <span className="text-xs text-slate-400">
            {SAMPLE_SIGNALS.length} signals
          </span>
        </div>

        <div className="bg-white border border-sage-200 rounded-xl shadow-soft divide-y divide-sage-100">
          {SAMPLE_SIGNALS.map((signal, i) => {
            const verdict =
              CLASSIFICATION_CONFIG[signal.classification] ||
              CLASSIFICATION_CONFIG.known_ttp;
            return (
              <article key={i} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-sage-700 uppercase tracking-wider">
                      {signal.source}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatDate(signal.timestamp)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${verdict.className}`}
                  >
                    {verdict.label}
                  </span>
                </div>

                <h3 className="text-base font-medium text-slate-900 leading-snug">
                  {signal.title}
                </h3>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">TTP</span>
                  <code className="rounded bg-sage-50 px-2 py-0.5 text-xs font-mono text-sage-700">
                    {signal.ttp_type}
                  </code>
                </div>

                <p className="text-sm text-slate-500 leading-relaxed">
                  {signal.reasoning}
                </p>
              </article>
            );
          })}
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Daily aggregation pipeline coming in a future release. Today&apos;s feed
          shows the latest signals captured during integration testing.
        </p>
      </section>
    </main>
  );
}
