import { useEffect, useRef, useState } from 'react';
import { Spinner } from './ui.jsx';

/**
 * "View PDF" button + modal window that shows the edition's PDF inside the
 * page using the browser's built-in, sandboxed PDF viewer.
 */
export default function PdfViewer({ edition }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const closeBtn = useRef(null);
  const src = `/api/editions/${edition.slug}/pdf?inline=1`;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn btn--ghost btn--small"
        onClick={() => {
          setLoaded(false);
          setOpen(true);
        }}
      >
        View PDF
      </button>
      {open && (
        <div className="pdf-modal" role="dialog" aria-modal="true" aria-label={`Issue ${edition.issue_number} as PDF`} onClick={() => setOpen(false)}>
          <div className="pdf-modal__window" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-modal__bar">
              <span>The Lead Story · Issue {edition.issue_number} (PDF)</span>
              <a className="btn btn--small pdf-modal__btn" href={`/api/editions/${edition.slug}/pdf`}>
                Download
              </a>
              <button ref={closeBtn} type="button" className="pdf-modal__close" onClick={() => setOpen(false)} aria-label="Close PDF viewer">
                ×
              </button>
            </div>
            <div className="pdf-modal__body">
              {!loaded && (
                <div className="pdf-modal__loading">
                  <Spinner label="Preparing the PDF…" />
                </div>
              )}
              <iframe title={`Issue ${edition.issue_number} PDF`} src={src} onLoad={() => setLoaded(true)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
