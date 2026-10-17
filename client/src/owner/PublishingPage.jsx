import { useEffect, useState } from 'react';
import { Notice } from '../admin/components.jsx';
import { api } from '../lib/api.js';
import { invalidateApi, useApi, useDocumentTitle } from '../lib/useApi.js';

/** What applicants see on the public "Publish with us" page: the introduction and the terms. */
export default function PublishingPage() {
  const { data, error } = useApi('/owner/publishing');
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  useDocumentTitle('Publishing settings');

  useEffect(() => {
    if (data && !form) setForm(data.publishing);
  }, [data, form]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const { publishing } = await api.put('/owner/publishing', form);
      setForm(publishing);
      invalidateApi('/publishing');
      setNotice({ tone: 'good', text: 'Saved. The “Publish with us” page now shows this introduction and these terms.' });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="page-head">
        <div>
          <p className="section-label">Admin</p>
          <h1 className="page-head__title">Publishing</h1>
          <p className="page-head__dek">The introduction and terms shown to people who apply to publish.</p>
        </div>
        <a className="btn btn--ghost" href="/publish" target="_blank" rel="noopener noreferrer">
          View the public page ↗
        </a>
      </header>
      {error && <Notice tone="error">{error.message}</Notice>}
      {notice && (
        <Notice key={notice.text} tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      {form && (
        <form className="admin-page" onSubmit={save}>
          <section className="panel">
            <h2 className="panel__title">Introduction</h2>
            <textarea className="textarea" rows={4} value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} />
          </section>

          <section className="panel">
            <h2 className="panel__title">Terms and conditions</h2>
            <p className="panel__intro">
              Applicants must accept these before sending a request. Use **bold** and numbered lines (1. 2. 3.) for
              structure. Consider having them checked by someone with legal knowledge.
            </p>
            <textarea className="textarea" rows={16} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
          </section>

          <div>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save publishing settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
