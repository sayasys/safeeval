import Nav from '../../components/landing/Nav';
import Footer from '../../components/landing/Footer';
import CaseStudyHero from '../../components/case-study/CaseStudyHero';
import Setup from '../../components/case-study/Setup';
import Findings from '../../components/case-study/Findings';
import WhatChanged from '../../components/case-study/WhatChanged';
import StillOpen from '../../components/case-study/StillOpen';
import CaseStudyCTA from '../../components/case-study/CaseStudyCTA';

export const metadata = {
  title: 'Case study -- SafeEval',
  description:
    'Eight real fraud cases run through SafeEval. What surfaced, what we changed, and what is still in progress.',
};

export default function CaseStudyPage() {
  return (
    <main className="min-h-screen bg-cream-50 text-slate-800">
      <Nav />
      <CaseStudyHero />
      <Setup />
      <Findings />
      <WhatChanged />
      <StillOpen />
      <CaseStudyCTA />
      <Footer />
    </main>
  );
}
