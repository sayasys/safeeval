import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'SafeEval -- AI trust & safety policy framework',
  description: 'An AI safeguard for fraud and scams. Write the policy. Ship a working classifier. Run real cases. Turn reviewer feedback into the next policy update.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-cream-50 text-slate-800 font-sans antialiased">{children}</body>
    </html>
  );
}
