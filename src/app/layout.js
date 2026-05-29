import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'SafeEval -- AI trust & safety policy framework',
  description: 'An AI trust & safety policy framework, demonstrated through fraud and scams enforcement. Built on the Fraud Analysis Framework (FAF).',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-cream-50 text-slate-800 font-sans antialiased">{children}</body>
    </html>
  );
}
