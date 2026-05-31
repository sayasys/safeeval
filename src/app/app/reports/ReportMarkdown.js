// Renders parsed report markdown into React elements with cool-palette prose
// styling (slate body text, brand-blue links, slate code/quote chrome). No
// hooks and no dangerouslySetInnerHTML, so it is safe by construction and works
// in both server (detail view) and client (result-card panel) trees.

import { parseBlocks, parseInline, isSafeHref } from './markdown-parse';

function Inline({ text }) {
  const tokens = parseInline(text);
  return tokens.map((t, i) => {
    switch (t.type) {
      case 'bold':
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {t.value}
          </strong>
        );
      case 'italic':
        return (
          <em key={i} className="italic">
            {t.value}
          </em>
        );
      case 'code':
        return (
          <code
            key={i}
            className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800"
          >
            {t.value}
          </code>
        );
      case 'link':
        return isSafeHref(t.href) ? (
          <a
            key={i}
            href={t.href}
            className="text-brand-blue underline underline-offset-2 hover:no-underline"
            rel="noopener noreferrer"
          >
            {t.value}
          </a>
        ) : (
          // Unsafe href: render the visible text only, never a navigable link.
          <span key={i}>{t.value}</span>
        );
      default:
        return <span key={i}>{t.value}</span>;
    }
  });
}

export default function ReportMarkdown({ markdown }) {
  const blocks = parseBlocks(markdown);
  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-700">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading': {
            const sizes = {
              1: 'text-xl font-semibold text-slate-900',
              2: 'text-lg font-semibold text-slate-900',
              3: 'text-base font-semibold text-slate-900',
            };
            const cls = sizes[block.level] || 'text-sm font-semibold text-slate-900';
            const Tag = `h${Math.min(block.level + 1, 6)}`;
            return (
              <Tag key={i} className={`${cls} mt-2`}>
                <Inline text={block.text} />
              </Tag>
            );
          }
          case 'paragraph':
            return (
              <p key={i}>
                <Inline text={block.text} />
              </p>
            );
          case 'ul':
            return (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {block.items.map((item, j) => (
                  <li key={j}>
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="list-decimal space-y-1 pl-5">
                {block.items.map((item, j) => (
                  <li key={j}>
                    <Inline text={item} />
                  </li>
                ))}
              </ol>
            );
          case 'blockquote':
            return (
              <blockquote
                key={i}
                className="border-l-2 border-slate-300 pl-4 italic text-slate-600"
              >
                <Inline text={block.text} />
              </blockquote>
            );
          case 'code':
            return (
              <pre
                key={i}
                className="overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800"
              >
                <code>{block.text}</code>
              </pre>
            );
          case 'hr':
            return <hr key={i} className="border-slate-200" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
