// Shared chrome for every signed-in page under /app/*. The route middleware
// has already confirmed a session before any of these pages render, so the
// layout's only job is to resolve the current email for the nav and frame the
// page below it. Reading the session means this layout is request-time, never
// static.

import { getCurrentUser } from '@/lib/auth';
import AppNav from './_components/AppNav';
import PolicySubNav from './_components/PolicySubNav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }) {
  // Fail-open: if the session cannot be resolved (for example a deployment
  // without auth configured), render the nav without an email rather than
  // blocking the whole signed-in area.
  const user = await getCurrentUser();

  return (
    <>
      <AppNav email={user?.email ?? null} />
      <PolicySubNav />
      {children}
    </>
  );
}
