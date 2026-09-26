import { formatDate } from '../../lib/format.js';

/** Dates may be typed as "2026-09-21" or free text like "Sept 2026"; format the first kind nicely. */
function niceDate(value) {
  if (!value) return '';
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value) : value;
}

/**
 * One reference, formatted in the spirit of APA 7:
 * Author. (Date). *Title*. Publication. URL (accessed …)
 */
function Reference({ entry }) {
  const author = entry.author?.trim();
  const date = niceDate(entry.date?.trim());
  return (
    <>
      {author && <span className="ref__author">{author}. </span>}
      <span className="ref__date">({date || 'n.d.'}). </span>
      {entry.title && <cite className="ref__title">{entry.title}. </cite>}
      {entry.publication && <span className="ref__pub">{entry.publication}. </span>}
      {entry.url && (
        <a className="ref__url" href={entry.url} target="_blank" rel="noopener noreferrer">
          {entry.url}
        </a>
      )}
      {entry.accessed && <span className="ref__accessed"> (accessed {niceDate(entry.accessed)})</span>}
    </>
  );
}

export default function Bibliography({ entries }) {
  // Every entry keeps its number (so "[3]" in the text always means entry 3).
  const list = entries ?? [];
  if (!list.length) return null;

  return (
    <section className="sources" aria-labelledby="bibliography-title">
      <h2 id="bibliography-title" className="sources__title">
        Bibliography
      </h2>
      <ol className="sources__list">
        {list.map((entry, i) => (
          <li key={i} id={`source-${i + 1}`} className="source">
            <Reference entry={entry} />
          </li>
        ))}
      </ol>
    </section>
  );
}
