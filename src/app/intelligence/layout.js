// Chrome for the public threat-intelligence page. Mirrors the evaluator layout:
// the page is reachable both signed out (a portfolio visitor) and signed in (an
// app user arriving from the dashboard), so this resolves the session and picks
// the matching top nav -- the landing Nav for visitors, the AppNav for signed-in
// users so they keep their navigation rail. Reading the session makes this
// request-time, never static.

import { getCurrentUser } from '@/lib/auth';
import Nav from '../../components/landing/Nav';
import Footer from '../../components/landing/Footer';
import AppNav from '../app/_components/AppNav';

export const dynamic = 'force-dynamic';

export default async function IntelligenceLayout({ children }) {
  // Fail-open: if the session cannot be resolved, fall back to the public Nav
  // rather than blocking the page. The page itself is public, so an anonymous
  // chrome is the safe default.
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-cream-50">
      {user ? <AppNav email={user.email} /> : <Nav current="/intelligence" />}
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
