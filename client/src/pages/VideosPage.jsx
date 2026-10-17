import { Link } from 'react-router-dom';
import Masthead from '../components/newsletter/Masthead.jsx';
import { SuspendedChip } from '../components/reader/SuspendedGate.jsx';
import { ListSkeleton, TagBadges } from '../components/ui.jsx';
import { excerpt, formatDate } from '../lib/format.js';
import { useApi, useDocumentTitle } from '../lib/useApi.js';

/** Every edition automatically has a video report — this tab lists them all. */
export default function VideosPage() {
  const { data, error, loading } = useApi('/editions');
  useDocumentTitle('Video Reports');
  const editions = data?.editions ?? [];
  const [latest, ...older] = editions;

  return (
    <div className="videos-page">
      <Masthead />
      <header className="section-head">
        <h1 className="section-head__title">
          Video Reports <span className="beta-badge beta-badge--large">Pre-beta</span>
        </h1>
        <p className="section-head__dek">Every edition as a newscast from our robot anchor — headlines first, then each story in detail</p>
        <p className="beta-note">This section is in pre-beta: the video reports are still being built and may change or have rough edges.</p>
      </header>

      {loading && <ListSkeleton rows={2} />}
      {error && <p className="state-message">The video reports could not be loaded. {error.message}</p>}
      {!loading && !error && !editions.length && <p className="state-message">No editions have been published yet.</p>}

      {latest && (
        <Link to={`/videos/${latest.slug}`} className="video-hero">
          <span className="video-thumb video-thumb--large">
            {latest.thumbnail && <img src={latest.thumbnail} alt="" decoding="async" />}
            <span className="video-thumb__play" aria-hidden="true">
              ▶
            </span>
            <span className="video-thumb__badge">Latest · Issue {latest.issue_number}</span>
          </span>
          <span className="video-hero__text">
            <span className="video-meta">
              {formatDate(latest.publication_date)} · about {Math.max(2, Math.round(latest.reading_minutes * 1.5))} min
            </span>
            {Boolean(latest.publisher_suspended) && <SuspendedChip />}
            <span className="video-hero__title">{latest.lead_headline}</span>
            {latest.deck && <span className="video-hero__deck">{excerpt(latest.deck, 150)}</span>}
            <TagBadges tags={latest.tags} />
          </span>
        </Link>
      )}

      {older.length > 0 && (
        <>
          <h2 className="videos-page__sub">Past reports</h2>
          <ul className="video-grid">
            {older.map((e) => (
              <li key={e.id}>
                <Link to={`/videos/${e.slug}`} className="video-card">
                  <span className="video-thumb">
                    {e.thumbnail && <img src={e.thumbnail} alt="" loading="lazy" decoding="async" />}
                    <span className="video-thumb__play" aria-hidden="true">
                      ▶
                    </span>
                    <span className="video-thumb__badge">Issue {e.issue_number}</span>
                  </span>
                  <span className="video-meta">
                    {formatDate(e.publication_date)} · about {Math.max(2, Math.round(e.reading_minutes * 1.5))} min
                  </span>
                  {Boolean(e.publisher_suspended) && <SuspendedChip />}
                  <span className="video-card__title">{excerpt(e.lead_headline, 90)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
