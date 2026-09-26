import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatDate, formatDateTime } from '../lib/format.js';
import { useApi, useDocumentTitle } from '../lib/useApi.js';
import { EditionStatus, Notice } from './components.jsx';

export default function EditionsPage() {
  const { data, error, loading } = useApi('/admin/editions');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const navigate = useNavigate();
  useDocumentTitle('Editions');

  async function createEdition() {
    setCreating(true);
    setCreateError(null);
    try {
      const { edition } = await api.post('/admin/editions');
      navigate(`/admin/editions/${edition.id}`);
    } catch (err) {
      setCreateError(err.message);
      setCreating(false);
    }
  }

  const editions = data?.editions ?? [];

  return (
    <div className="admin-page">
      <header className="page-head">
        <div>
          <p className="section-label">Editor’s desk</p>
          <h1 className="page-head__title">Editions</h1>
          <p className="page-head__dek">Write each week’s newsletter, preview it, and publish when it’s ready.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={createEdition} disabled={creating}>
          {creating ? 'Creating…' : '+ New edition'}
        </button>
      </header>

      {createError && <Notice tone="error">{createError}</Notice>}
      {loading && <p className="state-message">Loading…</p>}
      {error && <Notice tone="error">{error.message}</Notice>}

      {data && editions.length === 0 && (
        <section className="panel">
          <h2 className="panel__title">No editions yet</h2>
          <p className="panel__intro">Click “New edition” to start writing your first issue.</p>
        </section>
      )}

      {editions.length > 0 && (
        <div className="table-wrap panel">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Issue</th>
                <th scope="col">Lead headline</th>
                <th scope="col">Status</th>
                <th scope="col">Published</th>
                <th scope="col">Last edited</th>
              </tr>
            </thead>
            <tbody>
              {editions.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/admin/editions/${e.id}`}>No. {e.issue_number}</Link>
                  </td>
                  <td className="table__headline">
                    <Link to={`/admin/editions/${e.id}`}>{e.lead_headline || <span className="muted">Untitled draft</span>}</Link>
                  </td>
                  <td>
                    <EditionStatus status={e.status} />
                  </td>
                  <td>
                    {e.status === 'published' ? (
                      <a href={`/edition/${e.slug}`} target="_blank" rel="noopener noreferrer">
                        {formatDate(e.publication_date)} ↗
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{formatDateTime(e.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
