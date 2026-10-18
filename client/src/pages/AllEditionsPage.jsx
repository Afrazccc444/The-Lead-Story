import { Link } from 'react-router-dom';
import Masthead from '../components/newsletter/Masthead.jsx';
import { SuspendedChip } from '../components/reader/SuspendedGate.jsx';
import { ListSkeleton, TagBadges } from '../components/ui.jsx';
import { bylineName, excerpt, formatDate, formatLongDate } from '../lib/format.js';
import { useApi, useDocumentTitle } from '../lib/useApi.js';

/** Group editions (already newest-first) under "September 2026"-style headings. */
function groupByMonth(editions) {
  const groups = [];
  for (const edition of editions) {
    const label = formatDate(edition.publication_date, { month: 'long', year: 'numeric' }) || 'Undated';
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(edition);
    else groups.push({ label, items: [edition] });
  }
  return groups;
}

export default function AllEditionsPage() {
  const { data, error, loading } = useApi('/editions');
  useDocumentTitle('All editions');
  const editions = data?.editions ?? [];
  // Same as the front page: the newest edition that isn't from a suspended account.
  const latestId = editions.find((e) => !e.publisher_suspended)?.id;

  return (
    <div className="page-narrow">
      <Masthead />
      <header className="section-head">
        <h1 className="section-head__title">All Editions</h1>
        <p className="section-head__dek">
          {editions.length > 0
            ? `${editions.length} weekly newsletter${editions.length === 1 ? '' : 's'}, most recent first`
            : 'Every weekly newsletter, most recent first'}
        </p>
      </header>

      {loading && <ListSkeleton rows={3} />}
      {error && <p className="state-message">The editions could not be loaded. {error.message}</p>}
      {!loading && !error && editions.length === 0 && <p className="state-message">No editions have been published yet.</p>}

      {groupByMonth(editions).map((group) => (
        <section key={group.label} className="all-group" aria-labelledby={`month-${group.label}`}>
          <h2 id={`month-${group.label}`} className="all-group__title">
            {group.label}
          </h2>
          <ol className="all-list">
            {group.items.map((edition) => (
              <li key={edition.id} className="all-card">
                <div className="all-card__meta">
                  <time dateTime={edition.publication_date}>{formatLongDate(edition.publication_date)}</time>
                  <span>Issue No. {edition.issue_number}</span>
                  <span className="reading-time">{edition.reading_minutes} min read</span>
                  {edition.id === latestId && <span className="all-card__latest">Latest</span>}
                  {Boolean(edition.publisher_suspended) && <SuspendedChip />}
                </div>
                <div className="all-card__body">
                  {edition.thumbnail && (
                    <Link to={`/edition/${edition.slug}`} className="all-card__thumb" tabIndex={-1} aria-hidden="true">
                      <img src={edition.thumbnail} alt="" decoding="async" />
                    </Link>
                  )}
                  <TagBadges tags={edition.tags} />
                  {edition.kicker && <p className="all-card__kicker">{edition.kicker}</p>}
                  <h3 className="all-card__headline">
                    <Link to={`/edition/${edition.slug}`}>{edition.lead_headline}</Link>
                  </h3>
                  {edition.subheadline && <p className="all-card__sub">{edition.subheadline}</p>}
                  {edition.deck && <p className="all-card__deck">{excerpt(edition.deck, 150)}</p>}
                  <p className="all-card__foot">
                    {[edition.byline && `By ${bylineName(edition.byline)}`, edition.source_count > 0 && `${edition.source_count} source${edition.source_count === 1 ? '' : 's'}`]
                      .filter(Boolean)
                      .join(' · ')}
                    <Link to={`/edition/${edition.slug}`} className="all-card__read">
                      Read this edition →
                    </Link>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
