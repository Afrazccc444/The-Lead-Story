import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteWarning, EditionStatus, Notice } from '../admin/components.jsx';
import { api } from '../lib/api.js';
import { formatDate, formatDateTime, formatNumber } from '../lib/format.js';
import { invalidateApi, useApi, useDocumentTitle } from '../lib/useApi.js';

const authorOf = (e) => e.author_org || e.author_name || e.author_username || 'Unknown';

/** Every article on the site, from every publisher: read, proof-check, take down. */
export default function ArticlesPage() {
  const { data, error, loading, reload } = useApi('/owner/editions');
  const [publisher, setPublisher] = useState('');
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  useDocumentTitle('All articles');

  const all = data?.editions ?? [];
  const publishers = useMemo(() => [...new Set(all.map(authorOf))].sort(), [all]);
  const list = all.filter((e) => (!publisher || authorOf(e) === publisher) && (!status || e.status === status));

  async function run(e, action) {
    if (action === 'delete' && !window.confirm(deleteWarning(e))) return;
    if (action === 'unpublish' && !window.confirm(`Take “${e.lead_headline || `Issue ${e.issue_number}`}” off the website? The publisher keeps it as a draft.`)) return;
    setBusy(e.id);
    setNotice(null);
    try {
      if (action === 'delete') await api.del(`/admin/editions/${e.id}`);
      else await api.post(`/admin/editions/${e.id}/${action}`);
      setNotice({ tone: 'good', text: action === 'delete' ? `Issue ${e.issue_number} was deleted.` : `Issue ${e.issue_number} was ${action}ed.` });
      invalidateApi('/');
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-page">
      <header className="page-head">
        <div>
          <p className="section-label">Admin</p>
          <h1 className="page-head__title">All articles</h1>
          <p className="page-head__dek">Every edition from every publisher. Read and proof-check them; take down anything that breaks the terms.</p>
        </div>
      </header>

      <div className="filters">
        <label className="field">
          <span className="field__label">Publisher</span>
          <select className="select" value={publisher} onChange={(e) => setPublisher(e.target.value)}>
            <option value="">All publishers</option>
            {publishers.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Status</span>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>
      </div>

      {notice && (
        <Notice key={notice.text} tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      {loading && <p className="state-message">Loading…</p>}
      {error && <Notice tone="error">{error.message}</Notice>}
      {data && list.length === 0 && (
        <section className="panel">
          <p className="panel__intro">No articles match.</p>
        </section>
      )}
      {list.length > 0 && (
        <div className="table-wrap panel">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Issue</th>
                <th scope="col">Headline</th>
                <th scope="col">Publisher</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">Views</th>
                <th scope="col">Last edited</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td>No. {e.issue_number}</td>
                  <td className="table__headline">
                    {e.lead_headline || <span className="muted">Untitled draft</span>}
                    {e.status === 'published' && <div className="muted small">Published {formatDate(e.publication_date)}</div>}
                  </td>
                  <td>{authorOf(e)}</td>
                  <td>
                    <EditionStatus status={e.status} />
                  </td>
                  <td className="num">{formatNumber(e.views)}</td>
                  <td>{formatDateTime(e.updated_at)}</td>
                  <td className="table__actions">
                    {e.status === 'published' ? (
                      <a className="btn btn--ghost btn--small" href={`/edition/${e.slug}`} target="_blank" rel="noopener noreferrer">
                        Read ↗
                      </a>
                    ) : null}
                    <Link className="btn btn--ghost btn--small" to={`/admin/editions/${e.id}`}>
                      Open in desk
                    </Link>
                    {e.status === 'published' && (
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => run(e, 'unpublish')} disabled={busy !== null}>
                        Unpublish
                      </button>
                    )}
                    <button type="button" className="btn btn--ghost btn--small btn--danger" onClick={() => run(e, 'delete')} disabled={busy !== null}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
