import Nav from '../components/landing/Nav';
import Hero from '../components/landing/Hero';
import Problem from '../components/landing/Problem';
import HowItWorks from '../components/landing/HowItWorks';
import Features from '../components/landing/Features';
import CaseStudy from '../components/landing/CaseStudy';
import TrustSignals from '../components/landing/TrustSignals';
import CTABanner from '../components/landing/CTABanner';
import Footer from '../components/landing/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-tool text-slate-800">
      <Nav />
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <CaseStudy />
      <TrustSignals />
      <CTABanner />
      <Footer />
    </main>
  );
}
