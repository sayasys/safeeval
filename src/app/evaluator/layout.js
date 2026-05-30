// Chrome for the public evaluator. The evaluator is reachable both signed out
// (the portfolio demo any visitor can try) and signed in (an app destination a
// user reaches from the dashboard), so this layout resolves the session and
// picks the matching top nav: the landing Nav for visitors, the AppNav for
// signed-in users so they keep their Dashboard / Classifiers / Patterns rail.
// Reading the session makes this request-time, never static.

import { getCurrentUser } from '@/lib/auth';
import Nav from '../../components/landing/Nav';
import Footer from '../../components/landing/Footer';
import AppNav from '../app/_components/AppNav';

export const dynamic = 'force-dynamic';

export default async function EvaluatorLayout({ children }) {
  // Fail-open: if the session cannot be resolved (e.g. a deployment without
  // auth configured), fall back to the public Nav rather than blocking the
  // page. The evaluator itself is public, so an anonymous chrome is the safe
  // default.
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-tool">
      {user ? <AppNav email={user.email} /> : <Nav current="/evaluator" />}
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
