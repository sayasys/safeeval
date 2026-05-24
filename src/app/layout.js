import './globals.css';

export const metadata = {
  title: 'SafeEval -- AI Fraud Detection Framework',
  description: 'A policy-driven fraud and scam evaluation framework for AI platforms, built on the Universal Fraud Analysis Framework (UFAF).',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
