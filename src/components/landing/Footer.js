import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="py-16 bg-slate-100 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-slate-500">
        <Link
          href="https://github.com/sayasys/safeeval"
          className="hover:text-brand-blue transition-colors"
        >
          GitHub
        </Link>
        <p className="text-center md:text-left">
          Built end-to-end with Claude and Cursor.
        </p>
        <p>(c) 2026 Steven Sayasy. SafeEval is portfolio work, not a published standard.</p>
      </div>
    </footer>
  );
}
