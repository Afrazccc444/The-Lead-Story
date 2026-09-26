import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="page-narrow">
      <p className="section-label">Error 404</p>
      <h1 className="lead__headline">This page could not be found</h1>
      <p className="state-message">
        <Link to="/">Return to the latest edition</Link>
      </p>
    </div>
  );
}
