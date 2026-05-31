import Nav from '../../components/landing/Nav';
import Footer from '../../components/landing/Footer';
import ProductHero from '../../components/product/ProductHero';
import FiveStages from '../../components/product/FiveStages';
import AuditStory from '../../components/product/AuditStory';
import FeedbackStory from '../../components/product/FeedbackStory';
import ProductCTA from '../../components/product/ProductCTA';

export const metadata = {
  title: 'Product -- SafeEval',
  description:
    'How SafeEval works: five stages that read a prompt, score it against the fraud policy, and recommend an action. Every decision is traceable; reviewer overrides feed the next policy update.',
};

export default function ProductPage() {
  return (
    <main className="min-h-screen bg-tool text-slate-800">
      <Nav />
      <ProductHero />
      <FiveStages />
      <AuditStory />
      <FeedbackStory />
      <ProductCTA />
      <Footer />
    </main>
  );
}
