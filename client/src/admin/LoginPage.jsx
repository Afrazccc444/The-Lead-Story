import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { playIntro } from '../components/IntroSplash.jsx';
import { api } from '../lib/api.js';
import { useDocumentTitle } from '../lib/useApi.js';

/**
 * First visit: create the admin password (one time only).
 * Afterwards: sign in. Sessions last 30 days, so this is rarely needed.
 */
export default function LoginPage() {
  const [mode, setMode] = useState('loading'); // loading | setup | login | offline
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  useDocumentTitle('Editor sign-in');

  useEffect(() => {
    api
      .get('/auth/status')
      .then((s) => {
        if (s.authenticated) navigate('/admin', { replace: true });
        else setMode(s.setupRequired ? 'setup' : 'login');
      })
      .catch(() => setMode('offline'));
  }, [navigate]);

  async function submit(event) {
    event.preventDefault();
    setError(null);
    if (mode === 'setup' && password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.post(mode === 'setup' ? '/auth/setup' : '/auth/login', { password });
      navigate(location.state?.from ?? '/admin', { replace: true });
      playIntro(); // welcome animation after signing in
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (mode === 'loading') return <p className="state-message">Loading…</p>;
  if (mode === 'offline') {
    return <p className="state-message">Cannot reach the server. Make sure it is running (npm run dev), then refresh.</p>;
  }

  const setup = mode === 'setup';
  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <p className="section-label">Editor’s desk</p>
        <h1 className="login__title">The Lead Story</h1>
        {setup && (
          <p className="login__intro">
            Welcome! Create the admin password. You only do this once — afterwards you stay signed in on this browser
            for 30 days.
          </p>
        )}
        <label className="field">
          <span className="field__label">{setup ? 'New password (at least 8 characters)' : 'Password'}</span>
          <input
            type="password"
            className="input"
            autoComplete={setup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={setup ? 8 : undefined}
            autoFocus
            required
          />
        </label>
        {setup && (
          <label className="field">
            <span className="field__label">Repeat password</span>
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || !password}>
          {busy ? 'Please wait…' : setup ? 'Create password & start writing' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
