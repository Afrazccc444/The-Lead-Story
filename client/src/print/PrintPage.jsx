import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useDocumentTitle } from '../lib/useApi.js';
import PrintEdition from './PrintEdition.jsx';

/** Wait for web fonts and every image so nothing is missing from the PDF. */
async function whenAssetsReady() {
  await document.fonts?.ready;
  const pending = [...document.querySelectorAll('.pe img')].filter((img) => !img.complete);
  await Promise.all(
    pending.map(
      (img) =>
        new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }),
    ),
  );
}

/**
 * /print/:slug          — a published edition laid out for A4 / PDF
 * /print/draft/:token   — a draft, opened by the PDF maker with a one-time pass
 * Add ?print=1 to open the browser's print dialog automatically.
 */
export default function PrintPage() {
  const { slug, token } = useParams();
  const [params] = useSearchParams();
  const [state, setState] = useState({ edition: null, error: null });
  useDocumentTitle(state.edition ? `Issue ${state.edition.issue_number} (PDF)` : 'PDF');

  useEffect(() => {
    document.body.classList.add('print-mode');
    return () => document.body.classList.remove('print-mode');
  }, []);

  useEffect(() => {
    const path = token ? `/print/${encodeURIComponent(token)}` : `/editions/${encodeURIComponent(slug)}`;
    api
      .get(path)
      .then(({ edition }) => setState({ edition, error: null }))
      .catch((error) => setState({ edition: null, error }));
  }, [slug, token]);

  useEffect(() => {
    if (!state.edition) return;
    let cancelled = false;
    whenAssetsReady().then(() => {
      if (cancelled) return;
      document.body.dataset.printReady = '1';
      if (params.get('print') === '1') window.print();
    });
    return () => {
      cancelled = true;
    };
  }, [state.edition, params]);

  if (state.error) {
    return (
      <p className="state-message">
        {state.error.message} <Link to="/">Back to the newsletter</Link>
      </p>
    );
  }
  if (!state.edition) return <p className="state-message">Preparing the printable edition…</p>;

  // The PDF maker passes the address readers actually use (?site=…); otherwise use this page's own.
  const site = /^[\w.-]+(:\d{1,5})?$/.test(params.get('site') ?? '') ? params.get('site') : window.location.host;
  const onlineUrl = state.edition.slug && !token ? `${site}/edition/${state.edition.slug}` : '';

  return (
    <div className="print-shell">
      <div className="print-toolbar">
        <Link to={token ? '/' : `/edition/${state.edition.slug}`} className="btn btn--ghost btn--small">
          ← Back
        </Link>
        <span>Printable edition · A4</span>
        <button type="button" className="btn btn--primary btn--small" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>
      <div className="print-paper">
        <PrintEdition edition={state.edition} onlineUrl={onlineUrl} />
      </div>
    </div>
  );
}
