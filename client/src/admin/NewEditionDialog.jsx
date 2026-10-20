import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Notice } from './components.jsx';

const CODES = [
  ['A1–A6', 'About the edition: kicker, main headline, subheadline, deck, byline, tags'],
  ['H1, H2…', 'Each headline’s title'],
  ['R1, R2…', 'Each headline’s response — the full report'],
  ['C1–C3', 'Optional extras: historical context, what to watch, editor’s note'],
  ['S1', 'Sources / bibliography — one per line'],
  ['END', 'The end of the document'],
];

/**
 * "New edition": write it in the editor as usual, or use the question
 * template — download it, answer the coded questions in any document, upload
 * it, and the edition is laid out automatically (photos and videos are added
 * afterwards in the editor).
 */
export default function NewEditionDialog({ onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('choose'); // choose | template
  const [headlines, setHeadlines] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileInput = useRef(null);
  const dialog = useRef(null);

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function writeManually() {
    setBusy(true);
    setError(null);
    try {
      const { edition } = await api.post('/admin/editions');
      navigate(`/admin/editions/${edition.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/template/import', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
      navigate(`/admin/editions/${data.edition.id}`, { state: { imported: data.report } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  const count = Math.min(Math.max(1, Number(headlines) || 1), 20);
  const link = (format) => `/api/admin/template?headlines=${count}${format === 'txt' ? '&format=txt' : ''}`;

  // Rendered on <body>: inside the page's animated container it would sit under the top bar.
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div ref={dialog} className="modal new-edition-dialog" role="dialog" aria-modal="true" aria-labelledby="new-edition-title" tabIndex={-1}>
        <button type="button" className="modal__close" onClick={onClose} disabled={busy} aria-label="Close">
          ×
        </button>

        {step === 'choose' && (
          <>
            <p className="section-label">New edition</p>
            <h2 id="new-edition-title" className="modal__title">
              How would you like to create it?
            </h2>
            <div className="choice-grid">
              <button type="button" className="choice" onClick={writeManually} disabled={busy}>
                <span className="choice__icon" aria-hidden="true">
                  ✎
                </span>
                <span className="choice__title">Write it in the editor</span>
                <span className="choice__text">Type everything directly into the Editor’s desk, with a live preview.</span>
              </button>
              <button type="button" className="choice" onClick={() => setStep('template')} disabled={busy}>
                <span className="choice__icon" aria-hidden="true">
                  ☰
                </span>
                <span className="choice__title">Use the question template</span>
                <span className="choice__text">
                  Answer simple coded questions in Word, Google Docs or any document, upload it, and the article is laid out
                  for you.
                </span>
              </button>
            </div>
          </>
        )}

        {step === 'template' && (
          <>
            <p className="section-label">New edition · Question template</p>
            <h2 id="new-edition-title" className="modal__title">
              Create your edition from a template
            </h2>

            <ol className="template-steps">
              <li>
                <span className="template-steps__title">How many headlines will your article have?</span>
                <span className="template-steps__text">Each headline gets its own title and response in the template.</span>
                <input
                  type="number"
                  className="input template-steps__count"
                  min={1}
                  max={20}
                  value={headlines}
                  onChange={(e) => setHeadlines(e.target.value)}
                  aria-label="Number of headlines"
                />
              </li>
              <li>
                <span className="template-steps__title">Download the template</span>
                <span className="template-steps__text">
                  Every question has a code in square brackets. Write each answer on the lines under its code — in the
                  template itself, or in your own document with the codes copied in.
                </span>
                <div className="template-steps__buttons">
                  <a className="btn btn--primary btn--small" href={link('docx')} download>
                    Download Word template (.docx)
                  </a>
                  <a className="btn btn--ghost btn--small" href={link('txt')} download>
                    Plain text (.txt)
                  </a>
                </div>
                <table className="code-table">
                  <tbody>
                    {CODES.map(([code, text]) => (
                      <tr key={code}>
                        <th scope="row">{code}</th>
                        <td>{text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </li>
              <li>
                <span className="template-steps__title">Upload your answered template</span>
                <span className="template-steps__text">
                  Word (.docx), PDF or text. Your article is laid out automatically; you can then add photos and videos.
                </span>
                <label className={`btn btn--accent btn--small template-steps__upload${busy ? ' is-busy' : ''}`}>
                  {busy ? 'Reading your answers…' : 'Choose file and create edition'}
                  <input ref={fileInput} type="file" accept=".docx,.pdf,.txt,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} hidden />
                </label>
              </li>
            </ol>

            <button type="button" className="link-button" onClick={() => setStep('choose')} disabled={busy}>
              ← Back
            </button>
          </>
        )}

        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </div>,
    document.body,
  );
}
