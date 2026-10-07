import ReactMarkdown from 'react-markdown';
import { slugify, splitCitations } from '../../lib/format.js';

/** All the text inside a markdown syntax-tree node. */
function textOf(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

/** Superscript links to bibliography entries. */
export function Cites({ numbers }) {
  return numbers.map((n) => (
    <sup className="cite" key={n}>
      <a href={`#source-${n}`} aria-label={`Bibliography entry ${n}`}>
        {n}
      </a>
    </sup>
  ));
}

/** Plain text where "[1]" or "[1, 3]" become citation links. */
export function CitedText({ text, count }) {
  if (!text) return null;
  return splitCitations(text, count).map((part, i) =>
    typeof part === 'string' ? <span key={i}>{part}</span> : <Cites key={i} numbers={part.cite} />,
  );
}

/**
 * Renders the writer's Markdown. "[2]" cites bibliography entry 2.
 * Raw HTML in the Markdown is never rendered.
 */
export default function Prose({ markdown, count = 0, className = 'prose', pullQuotes = [] }) {
  if (!markdown) return null;
  // "[2]" or "[1, 3]" (not followed by "(" — that would be a normal link) → footnote links.
  const processed = markdown.replace(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, (whole, inner) => {
    const numbers = inner.split(',').map((n) => Number(n.trim())).filter((n) => n >= 1 && n <= count);
    return numbers.length ? numbers.map((n) => `[${n}](#source-${n})`).join('') : whole;
  });

  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          // "> ::pq0::" markers (inserted by the lead layout) become pull quotes:
          // shown inline on narrow screens; on wide screens this stays as an
          // invisible anchor and the quote appears in the right margin.
          blockquote({ node, children }) {
            const marker = /^::pq(\d+)::$/.exec(textOf(node).trim());
            if (!marker) return <blockquote>{children}</blockquote>;
            const quote = pullQuotes[Number(marker[1])];
            if (!quote) return null;
            return (
              <aside id={`pq-${marker[1]}`} className="pullquote" aria-label="Pull quote">
                <p>“{quote}”</p>
              </aside>
            );
          },
          a({ href = '', children }) {
            if (href.startsWith('#source-')) {
              return (
                <sup className="cite">
                  <a href={href} aria-label={`Bibliography entry ${children}`}>
                    {children}
                  </a>
                </sup>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          // Headings get stable ids so the "In this edition" index can link to them.
          h1: ({ node, children }) => <h3 id={slugify(textOf(node))}>{children}</h3>,
          h2: ({ node, children }) => <h3 id={slugify(textOf(node))}>{children}</h3>,
          h3: ({ node, children }) => <h3 id={slugify(textOf(node))}>{children}</h3>,
          // Short numbered lines ("3. Europe on Edge") act as section titles → anchor them too.
          li({ node, children }) {
            const text = textOf(node);
            const heading = text.length < 100 && !/\.$/.test(text.trim());
            return <li id={heading ? slugify(text) : undefined}>{children}</li>;
          },
          // Photos inserted in the editor: ![caption](/uploads/…) → captioned figure.
          img({ src = '', alt = '' }) {
            // Videos attached to a headline section play inline in the written article.
            if (/^\/uploads\/[\w-]+\.(mp4|webm|mov)$/.test(src)) {
              return (
                <span className="prose-figure prose-figure--video">
                  <video src={src} controls preload="metadata" playsInline aria-label={alt || 'Video'} />
                  {alt && <span className="prose-figure__caption">{alt}</span>}
                </span>
              );
            }
            if (!/^\/uploads\/[\w-]+\.(jpg|png|gif|webp)$/.test(src)) return null;
            return (
              <span className="prose-figure">
                <img src={src} alt={alt} loading="lazy" decoding="async" />
                {alt && <span className="prose-figure__caption">{alt}</span>}
              </span>
            );
          },
          // A paragraph containing only an image becomes a block figure instead of a <p>.
          p({ node, children }) {
            const only = node?.children?.length === 1 && node.children[0].tagName === 'img';
            return only ? <figure className="prose-figure-block">{children}</figure> : <p>{children}</p>;
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
