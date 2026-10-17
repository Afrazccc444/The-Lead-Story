import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { playIntro } from '../components/IntroSplash.jsx';
import { api } from '../lib/api.js';
import { useDocumentTitle } from '../lib/useApi.js';

const KEY_FILE = 'OWNER-RECOVERY-KEY.txt';

/**
 * Sign in to the Editor's desk (publishers) or the Admin app (owner).
 *
 * The owner account is created — and can always be recovered — with the
 * recovery key kept in a file on the server's own disk, so nobody else can
 * claim it, and a forgotten username or password never locks the owner out.
 */
export default function LoginPage() {
  const [mode, setMode] = useState('loading'); // loading | login | setup | recover | offline
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const toAdminApp = location.state?.from?.startsWith('/owner');
  useDocumentTitle(toAdminApp ? 'Admin sign-in' : 'Editor sign-in');

  useEffect(() => {
    api
      .get('/auth/status')
      .then((s) => {
        if (s.authenticated) navigate(location.state?.from ?? '/admin', { replace: true });
        else setMode(s.setupRequired ? 'setup' : 'login');
      })
      .catch(() => setMode('offline'));
  }, [navigate, location.state]);

  function switchTo(next) {
    setMode(next);
    setError(null);
    setPassword('');
    setConfirm('');
  }

  async function submit(event) {
    event.preventDefault();
    setError(null);
    const creating = mode === 'setup' || mode === 'recover';
    if (creating && password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (creating) {
        await api.post('/auth/recover', { key, username, display_name: displayName, password });
        navigate('/owner', { replace: true });
      } else {
        const { user } = await api.post('/auth/login', { username, password });
        navigate(location.state?.from ?? (user.role === 'owner' ? '/owner' : '/admin'), { replace: true });
      }
      playIntro(); // welcome animation after signing in
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (mode === 'loading') return <p className="state-message">Loading…</p>;
  if (mode === 'offline') {
    return <p className="state-message">Cannot reach the server. Make sure it is running, then refresh.</p>;
  }

  const creating = mode === 'setup' || mode === 'recover';
  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <p className="section-label">{creating || toAdminApp ? 'Admin' : 'Editor’s desk'}</p>
        <h1 className="login__title">{mode === 'setup' ? 'Set up the owner account' : mode === 'recover' ? 'Recover owner access' : 'The Lead Story'}</h1>

        {creating && (
          <div className="login__intro">
            <p>
              {mode === 'setup'
                ? 'Choose the username and password you will use for the Admin app. To prove this is your site, enter the recovery key first.'
                : 'Forgot the owner username or password? Enter the recovery key and choose new ones. All other devices are signed out.'}
            </p>
            <p className="login__where">
              <strong>Where is the key?</strong> On the computer running the site, open the file{' '}
              <code>server/data/{KEY_FILE}</code>. It changes after each use, and a new one is saved in the same file. Keep
              it private.
            </p>
          </div>
        )}

        {creating && (
          <label className="field">
            <span className="field__label">Recovery key</span>
            <input
              className="input input--key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
              required
            />
          </label>
        )}
        <label className="field">
          <span className="field__label">{creating ? 'Choose a username' : 'Username'}</span>
          <input
            className="input"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            spellCheck={false}
            autoFocus={!creating}
            minLength={creating ? 3 : undefined}
            required
          />
          {creating && <span className="form-hint">Letters, numbers, dots, dashes or underscores.</span>}
        </label>
        {mode === 'setup' && (
          <label className="field">
            <span className="field__label">Your name</span>
            <input className="input" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span className="field__label">{creating ? 'Choose a password (at least 8 characters)' : 'Password'}</span>
          <input
            type="password"
            className="input"
            autoComplete={creating ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={creating ? 8 : undefined}
            required
          />
        </label>
        {creating && (
          <label className="field">
            <span className="field__label">Repeat password</span>
            <input type="password" className="input" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || !password || !username || (creating && !key)}>
          {busy ? 'Please wait…' : mode === 'setup' ? 'Create owner account' : mode === 'recover' ? 'Save & sign in' : 'Sign in'}
        </button>

        {mode === 'login' && (
          <div className="login__foot">
            <p>
              <button type="button" className="link-button" onClick={() => switchTo('recover')}>
                Owner: forgot your username or password?
              </button>
            </p>
            <p>Publishers: ask The Lead Story for a new setup link.</p>
            <p>
              Want to publish here? <Link to="/publish">Apply for an account</Link>
            </p>
          </div>
        )}
        {mode === 'recover' && (
          <p className="login__foot">
            <button type="button" className="link-button" onClick={() => switchTo('login')}>
              ← Back to sign in
            </button>
          </p>
        )}
      </form>
    </div>
  );
}
