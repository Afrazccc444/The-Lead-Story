import { Link } from 'react-router-dom';
import ListenPlayer from './ListenPlayer.jsx';
import PdfButton from './PdfButton.jsx';
import PdfViewer from './PdfViewer.jsx';

/** Slim bar above an edition: listen, view/download the designed PDF, or print. */
export default function EditionActions({ edition }) {
  if (!edition?.slug) return null;
  return (
    <div className="edition-actions">
      <span className="edition-actions__label">Read, listen or take this week’s edition with you</span>
      <Link to={`/videos/${edition.slug}`} className="btn btn--ghost btn--small watch-btn">
        ▶ Watch
      </Link>
      <ListenPlayer edition={edition} />
      <PdfViewer edition={edition} />
      <Link to={`/print/${edition.slug}`} className="btn btn--ghost btn--small">
        Printable version
      </Link>
      <PdfButton
        pdfUrl={`/api/editions/${edition.slug}/pdf`}
        printUrl={`/print/${edition.slug}`}
        fileName={`The-Lead-Story-Issue-${edition.issue_number}.pdf`}
        className="btn btn--primary btn--small"
      />
    </div>
  );
}
