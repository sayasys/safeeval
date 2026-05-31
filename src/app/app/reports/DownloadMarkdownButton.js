'use client';

// Client-only "Download markdown" action for the report detail view. Builds a
// Blob from the report markdown and triggers a browser download -- no server
// round-trip, no new export endpoint (markdown is the only export format in
// scope). Cool palette: brand-blue outline button on the slate detail chrome.

import { useCallback } from 'react';

export default function DownloadMarkdownButton({ markdown, filename }) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([markdown ?? ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'report.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Release the object URL on the next tick so the click has resolved.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [markdown, filename]);

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="inline-flex items-center gap-2 rounded-md border border-brand-blue px-4 py-2 text-sm font-medium text-brand-blue hover:bg-brand-blue hover:text-white transition-colors"
    >
      Download markdown
    </button>
  );
}
