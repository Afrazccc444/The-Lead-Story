import { useState } from 'react';
import { Link } from 'react-router-dom';
import Prose from '../components/newsletter/Prose.jsx';
import { api } from '../lib/api.js';
import { useApi, useDocumentTitle } from '../lib/useApi.js';

/**
 * "Publish with us": organisations and journalists without a platform ask to
 * publish on The Lead Story. Just contact details, a few words about them and
 * their request — every request is reviewed personally and we contact them
 * afterwards; any arrangements are made privately.
 */
export default function PublishPage() {
  const { data, error, loading } = useApi('/publishing');
  const [form, setForm] = useState({ name: '', email: '', organisation: '', about: '', message: '', agreed: false, fax: '' });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sent, setSent] = useState(false);
  useDocumentTitle('Publish with us');
  const pub = data?.publishing;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setSendError(null);
    try {
      await api.post('/requests', form);
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSendError(err.message);
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="publish-page">
        <section className="publish-done">
          <p className="publish-done__mark" aria-hidden="true">
            ✓
          </p>
          <h1 className="publish-done__title">Your request has been sent</h1>
          <p>
            Thank you, {form.name.split(' ')[0]}. Your request will be reviewed personally, and we will contact you at{' '}
            <strong>{form.email}</strong>.
          </p>
          <p>If it is approved, you will receive a private link to choose your password and start publishing.</p>
          <Link to="/" className="btn btn--primary">
            Back to the latest edition
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="publish-page">
      <header className="section-head">
        <h1 className="section-head__title">Publish with us</h1>
        <p className="section-head__dek">Truthful reporting deserves a platform</p>
      </header>

      {loading && <p className="state-message">Loading…</p>}
      {error && <p className="state-message">This page could not be loaded. {error.message}</p>}

      {pub && (
        <>
          <p className="publish-page__intro">{pub.intro}</p>

          <form className="publish-form" onSubmit={submit}>
            <section className="publish-form__part" aria-labelledby="contact-title">
              <h2 id="contact-title" className="publish-page__sub">
                Your email
              </h2>
              <div className="publish-form__grid">
                <label className="field">
                  <span className="field__label">Your name *</span>
                  <input className="input" autoComplete="name" value={form.name} onChange={set('name')} required minLength={2} />
                </label>
                <label className="field">
                  <span className="field__label">Email *</span>
                  <input type="email" className="input" autoComplete="email" value={form.email} onChange={set('email')} required />
                </label>
              </div>
            </section>

            <section className="publish-form__part" aria-labelledby="about-title">
              <h2 id="about-title" className="publish-page__sub">
                About you
              </h2>
              <label className="field">
                <span className="field__label">Company or organisation (if any)</span>
                <input className="input" autoComplete="organization" value={form.organisation} onChange={set('organisation')} />
              </label>
              <label className="field">
                <span className="field__label">Tell us about yourself *</span>
                <textarea
                  className="textarea"
                  rows={4}
                  minLength={10}
                  value={form.about}
                  onChange={set('about')}
                  placeholder="Who you are, your organisation, and the kind of reporting you do."
                  required
                />
              </label>
            </section>

            <section className="publish-form__part" aria-labelledby="request-title">
              <h2 id="request-title" className="publish-page__sub">
                Your request
              </h2>
              <label className="field">
                <span className="field__label">What would you like to publish? *</span>
                <textarea
                  className="textarea"
                  rows={5}
                  minLength={20}
                  value={form.message}
                  onChange={set('message')}
                  placeholder="The topics you cover and how often you would like to publish."
                  required
                />
              </label>
            </section>

            <section aria-labelledby="terms-title">
              <h2 id="terms-title" className="publish-page__sub">
                Terms and conditions
              </h2>
              <div className="publish-terms">
                <Prose markdown={pub.terms} className="prose prose--small" />
              </div>
            </section>

            {/* Hidden from people; automated spam bots fill it in. */}
            <label className="publish-form__trap" aria-hidden="true">
              Fax
              <input tabIndex={-1} autoComplete="off" value={form.fax} onChange={set('fax')} />
            </label>
            <label className="publish-form__agree">
              <input type="checkbox" checked={form.agreed} onChange={set('agreed')} required />
              <span>I have read and accept the terms and conditions above.</span>
            </label>
            {sendError && (
              <p className="form-error" role="alert">
                {sendError}
              </p>
            )}
            <button type="submit" className="btn btn--primary" disabled={sending || !form.agreed}>
              {sending ? 'Sending…' : 'Send my request'}
            </button>
            <p className="publish-page__small">We will review your request and contact you by email.</p>
          </form>
        </>
      )}
    </div>
  );
}
