import ReactMarkdown from 'react-markdown';
import { splitCitations } from '../../lib/format.js';

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
export default function Prose({ markdown, count = 0, className = 'prose' }) {
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
          h1: ({ children }) => <h3>{children}</h3>,
          h2: ({ children }) => <h3>{children}</h3>,
          img: () => null,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
