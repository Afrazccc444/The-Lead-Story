import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { excerpt, formatDate } from '../../lib/format.js';

/* ═══════════ Back-to-top button ═══════════ */
/** Fades in after the reader scrolls past `threshold` pixels. */
export function BackToTop({ threshold = 900 }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      setShown(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [threshold]);

  return (
    <button
      type="button"
      className={`back-to-top${shown ? ' back-to-top--shown' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      tabIndex={shown ? 0 : -1}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
      </svg>
    </button>
  );
}

/* ═══════════ Lightbox ═══════════ */
/**
 * Click any picture in a published edition to see it full-screen, with the
 * rest of the page dimmed. Esc, the × button or a click outside closes it.
 */
export function Lightbox() {
  const [image, setImage] = useState(null);
  const closeBtn = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      const img = e.target.closest?.('.edition:not(.edition--preview) img');
      if (!img || img.closest('a') || img.closest('.social, .sidebar-frame__sponsors')) return;
      e.preventDefault();
      const figure = img.closest('figure, .prose-figure');
      const caption = figure?.querySelector('figcaption, .prose-figure__caption')?.textContent ?? img.alt ?? '';
      setImage({ src: img.currentSrc || img.src, alt: img.alt, caption });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!image) return undefined;
    const onKey = (e) => e.key === 'Escape' && setImage(null);
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [image]);

  if (!image) return null;
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer" onClick={() => setImage(null)}>
      <button ref={closeBtn} type="button" className="lightbox__close" onClick={() => setImage(null)} aria-label="Close image">
        ×
      </button>
      <figure className="lightbox__figure" onClick={(e) => e.stopPropagation()}>
        <img src={image.src} alt={image.alt} />
        {image.caption && <figcaption>{image.caption}</figcaption>}
      </figure>
    </div>
  );
}

/* ═══════════ Social share cluster ═══════════ */
const SHARE_ICONS = {
  x: <path d="M4 4l16 16M20 4L4 20" fill="none" stroke="currentColor" strokeWidth="2.2" />,
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10v7M8 7v.01M12 17v-7M12 13c0-2 1.2-3 2.6-3S17 11 17 13v4" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  facebook: <path d="M14 21v-8h3l.5-3.5H14V7.5c0-1 .4-1.7 1.8-1.7H18V2.7C17.4 2.6 16.3 2.5 15.2 2.5 12.6 2.5 11 4 11 6.9v2.6H8V13h3v8z" fill="currentColor" />,
  whatsapp: (
    <path d="M4 20l1.2-4A8 8 0 1 1 8 18.8zM9 8.5c0 3 3.4 6.5 6.5 6.5l1-1.5-2-1-1 1c-1-.4-2.2-1.6-2.6-2.6l1-1-1-2L9.4 8z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  ),
  email: (
    <>
      <rect x="2.5" y="5" width="19" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 6l9 7 9-7" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
};

/** X, LinkedIn, Facebook, WhatsApp, email and copy-link buttons for one edition. */
export function ShareCluster({ edition, title = 'Share this edition' }) {
  const [copied, setCopied] = useState(false);
  if (!edition?.slug) return null;
  const url = `${window.location.origin}/edition/${edition.slug}`;
  const text = `${edition.lead_headline || edition.content?.lead_story?.headline || 'The Lead Story'} — The Lead Story`;
  const e = encodeURIComponent;
  const links = [
    ['x', 'Share on X', `https://twitter.com/intent/tweet?url=${e(url)}&text=${e(text)}`],
    ['linkedin', 'Share on LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`],
    ['facebook', 'Share on Facebook', `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`],
    ['whatsapp', 'Share on WhatsApp', `https://wa.me/?text=${e(`${text} ${url}`)}`],
    ['email', 'Share by email', `mailto:?subject=${e(text)}&body=${e(url)}`],
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  return (
    <div className="share" role="group" aria-label={title}>
      <span className="share__title">{title}</span>
      <ul className="share__list">
        {links.map(([key, label, href]) => (
          <li key={key}>
            <a className="share__btn" href={href} target={key === 'email' ? undefined : '_blank'} rel="noopener noreferrer" aria-label={label} title={label}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                {SHARE_ICONS[key]}
              </svg>
            </a>
          </li>
        ))}
        <li>
          <button type="button" className="share__btn" onClick={copy} aria-label="Copy link" title="Copy link">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              {SHARE_ICONS.link}
            </svg>
          </button>
        </li>
      </ul>
      <span className="share__copied" aria-live="polite">
        {copied ? 'Link copied' : ''}
      </span>
    </div>
  );
}

/* ═══════════ Previous editions carousel ═══════════ */
/** The three editions published before this one, as a horizontal strip of thumbnails. */
export function PreviousEditions({ current }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let alive = true;
    api
      .get('/editions')
      .then(({ editions }) => {
        if (!alive) return;
        const index = editions.findIndex((e) => e.slug === current?.slug);
        setItems(editions.slice(index + 1, index + 4));
      })
      .catch(() => setItems([]));
    return () => {
      alive = false;
    };
  }, [current?.slug]);

  if (!items?.length) return null;
  return (
    <section className="prev-editions" aria-labelledby="prev-editions-title">
      <div className="prev-editions__head">
        <h2 id="prev-editions-title" className="prev-editions__title">
          Previous editions
        </h2>
        <Link to="/all" className="prev-editions__all">
          See all →
        </Link>
      </div>
      <ul className="prev-editions__strip">
        {items.map((e) => (
          <li key={e.id}>
            <Link to={`/edition/${e.slug}`} className="prev-card">
              <span className="prev-card__thumb">
                {e.thumbnail ? <img src={e.thumbnail} alt="" loading="lazy" decoding="async" /> : <span className="prev-card__mono">{e.issue_number}</span>}
              </span>
              <span className="prev-card__meta">
                Issue {e.issue_number} · {formatDate(e.publication_date, { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="prev-card__headline">{excerpt(e.lead_headline, 80)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ═══════════ Reader poll ═══════════ */
/** "Have your say": one vote per browser; results appear after voting. */
export function Poll({ edition, preview = false }) {
  const poll = edition.content?.poll;
  const options = (poll?.options ?? []).filter((o) => o.trim());
  const [results, setResults] = useState(null);
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const active = !preview && edition.slug && poll?.question && options.length >= 2;

  useEffect(() => {
    if (!active) return;
    api
      .get(`/editions/${edition.slug}/poll`)
      .then(setResults)
      .catch(() => setResults(null));
  }, [active, edition.slug]);

  if (!poll?.question || options.length < 2) return null;
  const voted = results?.myVote != null;

  async function vote(e) {
    e.preventDefault();
    if (choice == null) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await api.post(`/editions/${edition.slug}/poll`, { option: choice }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="poll" aria-labelledby="poll-title">
      <p className="poll__eyebrow">Have your say</p>
      <h2 id="poll-title" className="poll__question">
        {poll.question}
      </h2>
      {voted ? (
        <ul className="poll__results">
          {options.map((o, i) => {
            const pct = results.total ? Math.round((results.counts[i] / results.total) * 100) : 0;
            return (
              <li key={i} className={i === results.myVote ? 'is-mine' : ''}>
                <span className="poll__bar" style={{ width: `${pct}%` }} aria-hidden="true" />
                <span className="poll__label">
                  {o}
                  {i === results.myVote && <span className="poll__mine"> · your vote</span>}
                </span>
                <span className="poll__pct">{pct}%</span>
              </li>
            );
          })}
          <li className="poll__total">
            {results.total} {results.total === 1 ? 'vote' : 'votes'}
          </li>
        </ul>
      ) : (
        <form className="poll__form" onSubmit={vote}>
          <fieldset disabled={!active || busy}>
            <legend className="visually-hidden">{poll.question}</legend>
            {options.map((o, i) => (
              <label key={i} className="poll__option">
                <input type="radio" name={`poll-${edition.id}`} value={i} checked={choice === i} onChange={() => setChoice(i)} />
                <span>{o}</span>
              </label>
            ))}
          </fieldset>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn--primary btn--small" disabled={!active || choice == null || busy}>
            {busy ? 'Sending…' : preview ? 'Vote (disabled in preview)' : 'Vote'}
          </button>
        </form>
      )}
    </section>
  );
}

/* ═══════════ In-app browser banner ═══════════ */
const IN_APP = /(FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|TikTok|musical_ly|Snapchat|Twitter|; wv\)|GSA\/)/i;

/** Shown inside Instagram/LinkedIn/TikTok-style in-app browsers, offering to open the real browser. */
export function WebViewBanner() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem('tls-webview-dismissed') === '1';
    } catch {
      /* ignore */
    }
    setShow(IN_APP.test(navigator.userAgent) && !dismissed);
  }, []);
  if (!show) return null;

  const url = window.location.href;
  const android = /android/i.test(navigator.userAgent);
  const intent = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=${window.location.protocol.replace(':', '')};end`;

  const dismiss = () => {
    setShow(false);
    try {
      sessionStorage.setItem('tls-webview-dismissed', '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="webview-banner" role="region" aria-label="Open in your browser">
      <span>For the best reading experience, open The Lead Story in your browser.</span>
      {android ? (
        <a className="btn btn--small webview-banner__btn" href={intent}>
          Open in browser
        </a>
      ) : (
        <button
          type="button"
          className="btn btn--small webview-banner__btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              window.prompt('Copy this link and open it in Safari:', url);
            }
          }}
        >
          {copied ? 'Copied — paste in Safari' : 'Copy link'}
        </button>
      )}
      <button type="button" className="webview-banner__close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

/* ═══════════ Search box (in the top banner) ═══════════ */
export function SearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <form
      className="search-box"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <label htmlFor="site-search" className="visually-hidden">
        Search past editions
      </label>
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" className="search-box__icon">
        <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2" />
      </svg>
      <input id="site-search" type="search" placeholder="Search editions…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
    </form>
  );
}

