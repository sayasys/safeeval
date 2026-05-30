// First screen after signup: a short orientation, then two clear next steps.
// The middleware has already confirmed a session before this renders, so the
// page reads the current user only to run the one-time organization setup
// below. Reading the session means this page is request-time, never static.

import Link from 'next/link';
import { getCurrentUser, ensurePersonalOrganization } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AppWelcomePage() {
  // Make sure the new account has an organization to work in. This is safe to
  // run on every visit -- it creates the organization the first time and does
  // nothing on later visits -- and it never blocks the page if the data layer
  // is briefly unavailable.
  const user = await getCurrentUser();
  if (user) {
    await ensurePersonalOrganization(user);
  }

  return (
    <main className="min-h-screen bg-cream-50 text-slate-800 px-6 py-16">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-3xl font-semibold text-slate-900">
          Welcome to SafeEval.
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          You can define custom classifiers, compose patterns, and evaluate
          inputs against your organization&apos;s policy.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <NextStepCard
            title="Define a custom classifier"
            description="A classifier is one of your own tags added to SafeEval's evaluation output, so a result can flag the specific behavior your team watches for."
            cta="Create classifier"
            href="/app/classifiers/new"
          />
          <NextStepCard
            title="Compose a pattern"
            description="A pattern is a named set of tags. SafeEval labels a result with the pattern whenever all of those tags show up together in one evaluation."
            cta="Create pattern"
            href="/app/patterns/new"
          />
        </div>

        <div className="mt-10">
          <Link
            href="/app/dashboard"
            className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
          >
            Skip to dashboard &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}

function NextStepCard({ title, description, cta, href }) {
  return (
    <div className="flex flex-col rounded-lg border border-sage-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 flex-1 text-sm text-slate-600">{description}</p>
      <Link
        href={href}
        className="mt-5 inline-flex w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        {cta}
      </Link>
    </div>
  );
}
