import { useState } from 'react';
import { Notice } from '../admin/components.jsx';
import { api } from '../lib/api.js';
import { formatDate, formatDateTime, formatNumber } from '../lib/format.js';
import { invalidateApi, useApi, useDocumentTitle } from '../lib/useApi.js';
import InviteLink from './InviteLink.jsx';

const STATUS = {
  active: { icon: '●', label: 'Active', tone: 'good' },
  invited: { icon: '◌', label: 'Invited — no password yet', tone: 'warn' },
  disabled: { icon: '■', label: 'Suspended', tone: 'bad' },
};

function AccountStatus({ status }) {
  const s = STATUS[status];
  return (
    <span className={`chip chip--${s.tone}`}>
      <span aria-hidden="true">{s.icon}</span> {s.label}
    </span>
  );
}

/** For people who contacted you another way: create an account without a request. */
function NewAccountForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ username: '', display_name: '', organisation: '', email: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onCreated(await api.post('/owner/accounts', form));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="panel approve-form" onSubmit={submit}>
      <h2 className="panel__title">New publisher account</h2>
      <div className="grid-2">
        <label className="field">
          <span className="field__label">Username</span>
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
        <label className="field">
          <span className="field__label">Email</span>
          <input type="email" className="input" value={form.email} onChange={set('email')} />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="approve-form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AccountsPage() {
  const { data, error, loading, reload } = useApi('/owner/accounts');
  const [creating, setCreating] = useState(false);
  const [invite, setInvite] = useState(null); // { invite, user }
  const [notice, setNotice] = useState(null);
  useDocumentTitle('Accounts');

  async function run(fn, success) {
    setNotice(null);
    try {
      await fn();
      if (success) setNotice({ tone: 'good', text: success });
      invalidateApi('/owner/');
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    }
  }

  function setStatus(a, status) {
    const name = a.organisation || a.username;
    if (
      status === 'disabled' &&
      !window.confirm(
        `Suspend ${name}?

They are signed out and can't sign in. Their published articles stay online but are marked “Suspended account”, and readers are warned (“suspended for wrongful information”) before opening them.

To take an article down completely, unpublish or delete it in Articles.`,
      )
    ) {
      return;
    }
    run(
      () => api.patch(`/owner/accounts/${a.id}`, { status }),
      status === 'disabled'
        ? `${name} is suspended. Their articles now carry a warning for readers.`
        : `${name} is active again; the warning on their articles is gone.`,
    );
  }

  async function newLink(a) {
    setNotice(null);
    try {
      const { invite: path } = await api.post(`/owner/accounts/${a.id}/invite`);
      setInvite({ invite: path, user: a });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    }
  }

  function remove(a) {
    if (!window.confirm(`Delete the account “${a.username}”?\n\nThey can no longer sign in. Their ${a.editions} article(s) are kept and moved to you, so you can unpublish or delete them in Articles.`)) return;
    run(() => api.del(`/owner/accounts/${a.id}`), `${a.username} was deleted. Their articles are now listed under you.`);
  }

  const accounts = data?.accounts ?? [];

  return (
    <div className="admin-page">
      <header className="page-head">
        <div>
          <p className="section-label">Admin</p>
          <h1 className="page-head__title">Accounts</h1>
          <p className="page-head__dek">Everyone who can publish. Publishers choose their own passwords through a one-time link.</p>
        </div>
        {!creating && (
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            + New account
          </button>
        )}
      </header>

      {notice && (
        <Notice key={notice.text} tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      {invite && <InviteLink path={invite.invite} account={invite.user} onDone={() => setInvite(null)} />}
      {creating && (
        <NewAccountForm
          onCancel={() => setCreating(false)}
          onCreated={(result) => {
            setCreating(false);
            setInvite(result);
            invalidateApi('/owner/');
            reload();
          }}
        />
      )}

      {loading && <p className="state-message">Loading…</p>}
      {error && <Notice tone="error">{error.message}</Notice>}
      {accounts.length > 0 && (
        <div className="table-wrap panel">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Status</th>
                <th scope="col">Logo</th>
                <th scope="col" className="num">Articles</th>
                <th scope="col" className="num">Views</th>
                <th scope="col">Last sign-in</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.organisation || a.display_name || a.username}</strong>
                    {a.role === 'owner' && <span className="chip chip--owner">Owner</span>}
                    <div className="muted small">
                      {a.username}
                      {a.email && <> · <a href={`mailto:${a.email}`}>{a.email}</a></>} · since {formatDate(a.created_at)}
                    </div>
                  </td>
                  <td>
                    <AccountStatus status={a.status} />
                  </td>
                  <td>
                    {a.logo ? (
                      <span className="account-logo">
                        <img src={a.logo} alt={`${a.organisation || a.username} logo`} />
                        <button
                          type="button"
                          className="link-button small"
                          onClick={() => window.confirm(`Remove ${a.organisation || a.username}'s logo from all their articles?`) && run(() => api.patch(`/owner/accounts/${a.id}`, { logo: '' }), 'Logo removed.')}
                        >
                          Remove
                        </button>
                      </span>
                    ) : (
                      <span className="muted">{a.role === 'owner' ? '—' : 'None yet'}</span>
                    )}
                  </td>
                  <td className="num">
                    {a.published} / {a.editions}
                    <div className="muted small">published</div>
                  </td>
                  <td className="num">{formatNumber(a.views)}</td>
                  <td>{a.last_login_at ? formatDateTime(a.last_login_at) : <span className="muted">Never</span>}</td>
                  <td className="table__actions">
                    {a.role !== 'owner' && (
                      <>
                        {a.status === 'disabled' ? (
                          <button type="button" className="btn btn--ghost btn--small" onClick={() => setStatus(a, 'active')}>
                            Reactivate
                          </button>
                        ) : (
                          <button type="button" className="btn btn--ghost btn--small" onClick={() => setStatus(a, 'disabled')}>
                            Suspend
                          </button>
                        )}
                        <button type="button" className="btn btn--ghost btn--small" onClick={() => newLink(a)} title="For a lost invitation or a forgotten password">
                          New setup link
                        </button>
                        <button type="button" className="btn btn--ghost btn--small btn--danger" onClick={() => remove(a)}>
                          Delete
                        </button>
                      </>
                    )}
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
