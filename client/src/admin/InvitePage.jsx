import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { playIntro } from '../components/IntroSplash.jsx';
import { api } from '../lib/api.js';
import { useDocumentTitle } from '../lib/useApi.js';

/**
 * The one-time link the owner sends to an approved publisher: they choose
 * their own password here (the owner never sees it), then land in the desk.
 * The same kind of link resets a forgotten password.
 */
export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | invalid
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useDocumentTitle('Set up your account');

  useEffect(() => {
    api
      .get(`/auth/invite/${encodeURIComponent(token)}`)
      .then((d) => {
        setAccount(d.user);
        setState('ready');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      await api.post(`/auth/invite/${encodeURIComponent(token)}`, { password });
      navigate('/admin', { replace: true });
      playIntro();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (state === 'loading') return <p className="state-message">Loading…</p>;
  if (state === 'invalid') {
    return (
      <div className="login">
        <div className="login__card">
          <p className="section-label">Editor’s desk</p>
          <h1 className="login__title">Link expired</h1>
          <p className="login__intro">
            This link has expired or was already used. Please ask The Lead Story for a new one, or sign in if you have
            already chosen your password.
          </p>
          <Link to="/admin/login" className="btn btn--primary btn--block">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <p className="section-label">Editor’s desk</p>
        <h1 className="login__title">Welcome{account.organisation ? `, ${account.organisation}` : ''}</h1>
        <p className="login__intro">
          Your publishing account has been approved. Choose your password — only you will know it.
        </p>
        <label className="field">
          <span className="field__label">Username</span>
          <input className="input" value={account.username} autoComplete="username" readOnly />
        </label>
        <label className="field">
          <span className="field__label">Password (at least 8 characters)</span>
          <input type="password" className="input" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
        </label>
        <label className="field">
          <span className="field__label">Repeat password</span>
          <input type="password" className="input" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || !password}>
          {busy ? 'Please wait…' : 'Save password & start writing'}
        </button>
      </form>
    </div>
  );
}
