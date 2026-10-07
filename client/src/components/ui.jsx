import { tagColour } from '../lib/format.js';

/** Small animated loading ring with an optional label. */
export function Spinner({ label = 'Loading…', inline = false }) {
  return (
    <span className={`spinner${inline ? ' spinner--inline' : ''}`} role="status">
      <span className="spinner__ring" aria-hidden="true" />
      {label && <span className="spinner__label">{label}</span>}
    </span>
  );
}

/** Grey shapes that mimic an edition while it loads (masthead, headline, paragraphs). */
export function EditionSkeleton() {
  return (
    <div className="skeleton-edition" aria-busy="true" aria-label="Loading the edition">
      <span className="sk sk--meta" />
      <span className="sk sk--masthead" />
      <span className="sk sk--rule" />
      <span className="sk sk--label" />
      <span className="sk sk--headline" />
      <span className="sk sk--headline sk--short" />
      <span className="sk sk--sub" />
      <div className="skeleton-edition__cols">
        {[0, 1].map((col) => (
          <div key={col}>
            {[100, 96, 98, 92, 97, 60].map((w, i) => (
              <span key={i} className="sk sk--line" style={{ width: `${w}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder cards for lists (All editions, search results). */
export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-list__row">
          <span className="sk sk--thumb" />
          <div>
            <span className="sk sk--label" />
            <span className="sk sk--title" />
            <span className="sk sk--line" style={{ width: '90%' }} />
            <span className="sk sk--line" style={{ width: '70%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Colour-coded category badges (colour fixed per topic). */
export function TagBadges({ tags }) {
  const list = (tags ?? []).filter((t) => t && t.trim());
  if (!list.length) return null;
  return (
    <span className="tag-list">
      {list.map((tag) => (
        <span key={tag} className="tag-badge" style={{ '--tag-color': tagColour(tag) }}>
          {tag}
        </span>
      ))}
    </span>
  );
}
