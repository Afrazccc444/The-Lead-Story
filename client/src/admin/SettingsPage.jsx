import { useEffect, useState } from 'react';
import { SocialIcon, SOCIAL_NETWORKS } from '../components/newsletter/SocialLinks.jsx';
import { api } from '../lib/api.js';
import { useDocumentTitle } from '../lib/useApi.js';
import { setSiteCache, useSite } from '../lib/useSite.js';
import { Notice } from './components.jsx';
import { ImageUpload, TextArea } from './fields.jsx';
import PublisherBadge from '../components/newsletter/PublisherBadge.jsx';
import { accountName, useSessionUser } from './session.js';

/** Logo (fixed slot in the top banner) and footer small print. */
function BrandingSettings() {
  const site = useSite();
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (site && form === null) setForm({ logo: site.logo ?? '', footer_text: site.footer_text ?? '' });
  }, [site, form]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const { site: saved } = await api.put('/admin/site', form);
      setSiteCache(saved);
      setMessage({ tone: 'good', text: 'Branding saved.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel settings-panel">
      <h2 className="panel__title">Branding</h2>
      {form === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <form onSubmit={save}>
          <ImageUpload
            label="Logo (square works best)"
            value={form.logo}
            onChange={(logo) => setForm((f) => ({ ...f, logo }))}
            hint="Shown in the fixed logo slot at the top-left of the site."
          />
          <TextArea
            label="Footer small print"
            rows={3}
            value={form.footer_text}
            onChange={(footer_text) => setForm((f) => ({ ...f, footer_text }))}
            hint="Contact details, school mailing address or any legal notice. Shown at the bottom of every page."
          />
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save branding'}
          </button>
        </form>
      )}
    </section>
  );
}

/** Social media links shown as icons in the footer and at the end of every edition. */
function SocialSettings() {
  const site = useSite();
  const [social, setSocial] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (site && social === null) setSocial({ ...site.social });
  }, [site, social]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    // Friendly fixes: add https:// to bare addresses and mailto: to plain emails.
    const cleaned = Object.fromEntries(
      Object.entries(social).map(([k, v]) => {
        let value = (v ?? '').trim();
        if (value && k === 'email' && !value.startsWith('mailto:')) value = `mailto:${value}`;
        else if (value && k !== 'email' && !/^https?:\/\//i.test(value)) value = `https://${value}`;
        return [k, value];
      }),
    );
    try {
      const { site: saved } = await api.put('/admin/site', { social: cleaned });
      setSocial({ ...saved.social });
      setSiteCache(saved);
      setMessage({ tone: 'good', text: 'Social links saved — they now appear in the footer and on every edition.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel settings-panel">
      <h2 className="panel__title">Social media</h2>
      <p className="panel__intro">Add your accounts. Only filled-in networks are shown to readers.</p>
      {social === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <form onSubmit={save}>
          {SOCIAL_NETWORKS.map((n) => (
            <label className="field social-field" key={n.key}>
              <span className="field__label">
                <SocialIcon network={n.key} /> {n.label}
              </span>
              <input
                className="input"
                value={social[n.key] ?? ''}
                placeholder={n.key === 'email' ? 'you@example.com' : n.placeholder}
                onChange={(e) => setSocial((s) => ({ ...s, [n.key]: e.target.value }))}
              />
            </label>
          ))}
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save social links'}
          </button>
        </form>
      )}
    </section>
  );
}

/** A publisher's company logo: shown in a badge at the bottom of each of their articles. */
function CompanySettings({ user }) {
  const [logo, setLogo] = useState(user.logo ?? '');
  const [message, setMessage] = useState(null);

  async function save(next) {
    setMessage(null);
    try {
      const { user: saved } = await api.put('/auth/profile', { logo: next });
      setLogo(saved.logo);
      setMessage({ tone: 'good', text: next ? 'Logo saved. It now appears on all your articles.' : 'Logo removed.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    }
  }

  return (
    <section className="panel settings-panel">
      <h2 className="panel__title">Your company</h2>
      <p className="panel__intro">
        Upload your company logo. Every article you publish ends with this badge. Your company name is set by The Lead
        Story — contact us to change it.
      </p>
      {message && (
        <Notice key={message.text} tone={message.tone} onClose={() => setMessage(null)}>
          {message.text}
        </Notice>
      )}
      <ImageUpload label="Company logo" value={logo} onChange={save} hint="A square or wide logo on a plain background works best (PNG, JPG or WebP)." />
      <p className="mini-title">Preview</p>
      <PublisherBadge name={accountName(user)} logo={logo} />
    </section>
  );
}

export default function SettingsPage() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const user = useSessionUser();
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
      await api.post('/auth/password', { current, next });
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
      {/* The site's logo, footer and social links belong to the owner. */}
      {user?.role === 'owner' && <BrandingSettings />}
      {user?.role === 'owner' && <SocialSettings />}
      {user?.role === 'editor' && <CompanySettings user={user} />}
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
