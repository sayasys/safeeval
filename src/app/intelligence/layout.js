// Chrome for the public threat-intelligence page -- a portfolio surface any
// visitor can read. The signed-in product navigation is a SaaS-side surface
// that ships only in the private safeeval-saas repo, so this public portfolio
// cut renders the landing Nav for everyone.

import Nav from '../../components/landing/Nav';
import Footer from '../../components/landing/Footer';

export default function IntelligenceLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-tool">
      <Nav current="/intelligence" />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
