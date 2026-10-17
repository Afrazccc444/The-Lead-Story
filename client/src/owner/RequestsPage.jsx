import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Notice } from '../admin/components.jsx';
import { api } from '../lib/api.js';
import { formatDateTime, slugify } from '../lib/format.js';
import { invalidateApi, useApi, useDocumentTitle } from '../lib/useApi.js';
import InviteLink from './InviteLink.jsx';

const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

/** Approving creates the account; the form suggests a username from the organisation. */
function ApproveForm({ request, onApproved, onCancel }) {
  const [form, setForm] = useState({
    username: slugify(request.organisation || request.name).replace(/-/g, '').slice(0, 30),
    display_name: request.name,
    organisation: request.organisation,
    owner_note: '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post(`/owner/requests/${request.id}/approve`, form);
      onApproved(result);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="approve-form" onSubmit={submit}>
      <p className="approve-form__title">Create the publishing account</p>
      <div className="grid-2">
        <label className="field">
          <span className="field__label">Username (they sign in with this)</span>
          <input className="input" value={form.username} onChange={set('username')} required minLength={3} autoFocus />
        </label>
        <label className="field">
          <span className="field__label">Contact name</span>
          <input className="input" value={form.display_name} onChange={set('display_name')} />
        </label>
        <label className="field">
          <span className="field__label">Organisation (shown on their articles)</span>
          <input className="input" value={form.organisation} onChange={set('organisation')} />
        </label>
      </div>
      <label className="field">
        <span className="field__label">Private note (only you see this)</span>
        <input className="input" value={form.owner_note} onChange={set('owner_note')} />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="approve-form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Creating…' : 'Approve & create account'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RequestCard({ request, onChanged }) {
  const [approving, setApproving] = useState(false);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);

  async function act(path, body, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    try {
      if (path === 'delete') await api.del(`/owner/requests/${request.id}`);
      else await api.post(`/owner/requests/${request.id}/${path}`, body);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reject() {
    const note = window.prompt(`Reject the request from ${request.name}? Optional private note (reason):`, '');
    if (note === null) return;
    act('reject', { owner_note: note });
  }

  return (
    <article className="request-card panel">
      <header className="request-card__head">
        <div>
          <h2 className="request-card__name">{request.organisation || request.name}</h2>
          <p className="request-card__meta">
            {request.organisation && <>{request.name} · </>}
            <a href={`mailto:${request.email}`}>{request.email}</a>
          </p>
        </div>
        <div className="request-card__side">
          <span className="muted">{formatDateTime(request.created_at)}</span>
        </div>
      </header>
      {request.about && (
        <div>
          <p className="request-card__label">About them</p>
          <blockquote className="request-card__message">{request.about}</blockquote>
        </div>
      )}
      <div>
        <p className="request-card__label">Their request</p>
        <blockquote className="request-card__message">{request.message}</blockquote>
      </div>
      {request.owner_note && <p className="request-card__note">Note: {request.owner_note}</p>}
      {error && <Notice tone="error">{error}</Notice>}

      {invite ? (
        <InviteLink path={invite.invite} account={invite.user} onDone={onChanged} />
      ) : approving ? (
        <ApproveForm request={request} onApproved={setInvite} onCancel={() => setApproving(false)} />
      ) : (
        <div className="request-card__actions">
          {request.status === 'pending' && (
            <>
              <button type="button" className="btn btn--primary btn--small" onClick={() => setApproving(true)}>
                Approve…
              </button>
              <button type="button" className="btn btn--ghost btn--small btn--danger" onClick={reject}>
                Reject
              </button>
            </>
          )}
          {request.status === 'approved' && (
            <span className="muted">
              Account created{request.username ? <> as <strong>{request.username}</strong></> : ''} ·{' '}
              <Link to="/owner/accounts">Manage accounts</Link>
            </span>
          )}
          {request.status === 'rejected' && (
            <>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => act('reopen')}>
                Move back to pending
              </button>
              <button type="button" className="btn btn--ghost btn--small btn--danger" onClick={() => act('delete', undefined, 'Delete this request permanently?')}>
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export default function RequestsPage() {
  const [tab, setTab] = useState('pending');
  const { data, error, loading, reload } = useApi(`/owner/requests?status=${tab}`);
  useDocumentTitle('Publishing requests');
  const list = data?.requests ?? [];

  function changed() {
    invalidateApi('/owner/');
    reload();
  }

  return (
    <div className="admin-page">
      <header className="page-head">
        <div>
          <p className="section-label">Admin</p>
          <h1 className="page-head__title">Publishing requests</h1>
          <p className="page-head__dek">People who applied on the “Publish with us” page. Contact them by email, then approve to create their account.</p>
        </div>
      </header>
      <div className="tabs" role="tablist" aria-label="Request status">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tabs__tab${tab === t.id ? ' is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {loading && <p className="state-message">Loading…</p>}
      {error && <Notice tone="error">{error.message}</Notice>}
      {data && list.length === 0 && (
        <section className="panel">
          <p className="panel__intro">
            {tab === 'pending' ? 'No requests waiting. New applications from the “Publish with us” page appear here.' : `No ${tab} requests.`}
          </p>
        </section>
      )}
      {list.map((r) => (
        <RequestCard key={r.id} request={r} onChanged={changed} />
      ))}
    </div>
  );
}
