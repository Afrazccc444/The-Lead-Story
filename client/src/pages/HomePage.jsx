import { Link } from 'react-router-dom';
import EditionView from '../components/newsletter/EditionView.jsx';
import Masthead from '../components/newsletter/Masthead.jsx';
import { useApi, useDocumentTitle } from '../lib/useApi.js';

export default function HomePage() {
  const { data, error, loading } = useApi('/editions/latest');
  const edition = data?.edition;
  useDocumentTitle(edition?.lead_headline ?? null);

  if (loading) return <p className="state-message">Loading the latest edition…</p>;

  if (error?.status === 404) {
    return (
      <div className="page-narrow">
        <Masthead />
        <p className="state-message">
          The first edition is in preparation. Please check back soon.
        </p>
      </div>
    );
  }
  if (error) return <p className="state-message">The edition could not be loaded. {error.message}</p>;

  return (
    <>
      <EditionView edition={edition} />
      <p className="archive-cta">
        <Link to="/all">See all past editions →</Link>
      </p>
    </>
  );
}
