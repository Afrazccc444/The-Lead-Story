import { Link, useParams } from 'react-router-dom';
import EditionActions from '../components/EditionActions.jsx';
import EditionView from '../components/newsletter/EditionView.jsx';
import { PreviousEditions } from '../components/reader/ReaderTools.jsx';
import { EditionSkeleton } from '../components/ui.jsx';
import SuspendedGate from '../components/reader/SuspendedGate.jsx';
import { useApi, useDocumentTitle } from '../lib/useApi.js';
import { useTrackView } from '../lib/views.js';

export default function EditionPage() {
  const { slug } = useParams();
  const { data, error, loading } = useApi(`/editions/${encodeURIComponent(slug)}`);
  const edition = data?.edition;
  useDocumentTitle(edition?.lead_headline ?? null);
  useTrackView(edition?.slug, 'read');

  if (loading) return <EditionSkeleton />;
  if (error) {
    return (
      <p className="state-message">
        {error.status === 404 ? 'This edition does not exist or has not been published.' : error.message}{' '}
        <Link to="/all">See all editions</Link>
      </p>
    );
  }
  return (
    <SuspendedGate key={edition.slug} edition={edition}>
      <EditionActions edition={edition} />
      <EditionView edition={edition} />
      <PreviousEditions current={edition} />
    </SuspendedGate>
  );
}
