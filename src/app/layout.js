import './globals.css';

export const metadata = {
  title: 'SafeEval -- AI trust & safety policy framework',
  description: 'An AI trust & safety policy framework, demonstrated through fraud and scams enforcement. Built on the Fraud Analysis Framework (FAF).',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
