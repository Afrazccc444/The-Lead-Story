import { Link } from 'react-router-dom';
import { formatLongDate } from '../../lib/format.js';

export default function Masthead({ edition, linkHome = true }) {
  const dateLine = edition
    ? edition.publication_date
      ? formatLongDate(edition.publication_date)
      : 'Draft — not yet published'
    : formatLongDate(new Date());

  return (
    <header className="masthead">
      <div className="masthead__meta">
        <span>{dateLine}</span>
        {edition && (
          // Newsletter volume tagging: Vol. = year of publication since 2026, No. = issue number
          <span className="volume-tag">
            Vol. {Math.max(1, new Date(edition.publication_date ?? Date.now()).getFullYear() - 2025)} · No. {edition.issue_number}
          </span>
        )}
      </div>
      {linkHome ? (
        <Link className="masthead__title" to="/">
          The Lead Story
        </Link>
      ) : (
        <span className="masthead__title">The Lead Story</span>
      )}
      <p className="masthead__tagline">A weekly briefing on global politics</p>
    </header>
  );
}
