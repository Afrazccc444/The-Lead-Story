import { Link, useParams } from 'react-router-dom';
import BroadcastPlayer from '../broadcast/BroadcastPlayer.jsx';
import { EditionSkeleton } from '../components/ui.jsx';
import { formatLongDate } from '../lib/format.js';
import { useApi, useDocumentTitle } from '../lib/useApi.js';

/** One edition's video report (loaded separately, so the 3D engine only downloads here). */
export default function VideoPage() {
  const { slug } = useParams();
  const { data, error, loading } = useApi(`/editions/${encodeURIComponent(slug)}`);
  const edition = data?.edition;
  useDocumentTitle(edition ? `Video: ${edition.lead_headline}` : 'Video report');

  if (loading) return <EditionSkeleton />;
  if (error) {
    return (
      <p className="state-message">
        {error.status === 404 ? 'This report does not exist.' : error.message} <Link to="/videos">All video reports</Link>
      </p>
    );
  }

  return (
    <div className="video-page">
      <header className="video-page__head">
        <p className="video-meta">
          <span className="beta-badge">Pre-beta</span> Video report · Issue {edition.issue_number} · {formatLongDate(edition.publication_date)}
        </p>
        <h1 className="video-page__title">{edition.lead_headline}</h1>
      </header>
      <BroadcastPlayer edition={edition} />
      <p className="video-page__links">
        <Link to={`/edition/${edition.slug}`}>Read the full edition and its sources →</Link>
        <Link to="/videos">All video reports</Link>
      </p>
    </div>
  );
}
