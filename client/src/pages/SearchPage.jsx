import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Masthead from '../components/newsletter/Masthead.jsx';
import { ListSkeleton } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { useDocumentTitle } from '../lib/useApi.js';

/** Wrap every occurrence of the search words in <mark>. */
function Highlight({ text, terms }) {
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const lower = terms.map((t) => t.toLowerCase());
  return text
    .split(re)
    .map((part, i) => (lower.includes(part.toLowerCase()) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>));
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [input, setInput] = useState(q);
  const [state, setState] = useState({ results: null, error: null });
  useDocumentTitle(q ? `Search: ${q}` : 'Search');

  useEffect(() => {
    setInput(q);
    if (q.trim().length < 2) {
      setState({ results: [], error: null });
      return undefined;
    }
    let alive = true;
    setState({ results: null, error: null });
    api
      .get(`/search?q=${encodeURIComponent(q)}`)
      .then(({ results }) => alive && setState({ results, error: null }))
      .catch((error) => alive && setState({ results: [], error }));
    return () => {
      alive = false;
    };
  }, [q]);

  const terms = q.split(/\s+/).filter((t) => t.length > 1);

  return (
    <div className="page-narrow">
      <Masthead />
      <header className="section-head">
        <h1 className="section-head__title">Search the archive</h1>
        <p className="section-head__dek">Every published edition — headlines, articles, briefings and notes</p>
      </header>

      <form
        className="search-page__form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(input.trim() ? { q: input.trim() } : {});
        }}
      >
        <label htmlFor="search-page-input" className="visually-hidden">
          Search
        </label>
        <input id="search-page-input" className="input" type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. NATO, Taiwan, ceasefire" autoFocus maxLength={100} />
        <button type="submit" className="btn btn--primary">
          Search
        </button>
      </form>

      {state.results === null && <ListSkeleton rows={3} />}
      {state.error && <p className="state-message">Search failed: {state.error.message}</p>}
      {state.results && q.trim().length >= 2 && (
        <p className="search-page__count">
          {state.results.length} {state.results.length === 1 ? 'edition' : 'editions'} mention “{q}”
        </p>
      )}

      <ol className="search-results">
        {state.results?.map((r) => (
          <li key={r.slug} className="search-result">
            <Link to={`/edition/${r.slug}`} className="search-result__link">
              <span className="search-result__meta">
                Issue {r.issue_number} · {formatDate(r.publication_date)}
              </span>
              <span className="search-result__headline">
                <Highlight text={r.lead_headline} terms={terms} />
              </span>
              <span className="search-result__snippet">
                <Highlight text={r.snippet} terms={terms} />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
