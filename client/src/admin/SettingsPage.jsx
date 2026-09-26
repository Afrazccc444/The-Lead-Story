import { useState } from 'react';
import { api } from '../lib/api.js';
import { useDocumentTitle } from '../lib/useApi.js';
import { Notice } from './components.jsx';

export default function SettingsPage() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  useDocumentTitle('Settings');

  async function submit(event) {
    event.preventDefault();
    if (next !== confirm) {
      setMessage({ tone: 'error', text: 'The new passwords do not match.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.post('/admin/password', { current, next });
      setCurrent('');
      setNext('');
      setConfirm('');
      setMessage({ tone: 'good', text: 'Password changed. Other devices have been signed out.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="page-head">
        <div>
          <p className="section-label">Editor’s desk</p>
          <h1 className="page-head__title">Settings</h1>
        </div>
      </header>
      <section className="panel settings-panel">
        <h2 className="panel__title">Change password</h2>
        <form onSubmit={submit}>
          <label className="field">
            <span className="field__label">Current password</span>
            <input type="password" className="input" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </label>
          <label className="field">
            <span className="field__label">New password (at least 8 characters)</span>
            <input type="password" className="input" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
          </label>
          <label className="field">
            <span className="field__label">Repeat new password</span>
            <input type="password" className="input" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </label>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </section>
    </div>
  );
}
