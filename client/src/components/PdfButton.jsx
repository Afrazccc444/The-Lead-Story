import { useState } from 'react';
import { Spinner } from './ui.jsx';

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Downloads an edition as a PDF made by the server. If the server cannot make
 * PDFs (no Edge/Chrome installed there), it opens the printable page with the
 * browser's own "Save as PDF" dialog instead.
 *
 * @param {{ pdfUrl: string, fileName: string, printUrl?: string, before?: () => Promise<boolean|void>, label?: string, className?: string }} props
 */
export default function PdfButton({ pdfUrl, fileName, printUrl, before, label = 'Download PDF', className = 'btn btn--ghost btn--small' }) {
  const [state, setState] = useState('idle'); // idle | working | error

  async function download() {
    if (state === 'working') return;
    if (before && (await before()) === false) return;
    setState('working');
    try {
      const res = await fetch(pdfUrl, { credentials: 'same-origin' });
      if (res.status === 503 && printUrl) {
        window.open(`${printUrl}?print=1`, '_blank', 'noopener');
        setState('idle');
        return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'PDF failed');
      saveBlob(await res.blob(), fileName);
      setState('idle');
    } catch (err) {
      console.error(err);
      setState('error');
      setTimeout(() => setState('idle'), 4000);
    }
  }

  return (
    <button type="button" className={`pdf-btn ${className}`} onClick={download} disabled={state === 'working'} aria-live="polite">
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <path d="M12 3v12m0 0l-5-5m5 5l5-5M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      </svg>
      {state === 'working' ? <Spinner inline label="Preparing PDF…" /> : state === 'error' ? 'PDF failed — try again' : label}
    </button>
  );
}
