import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { invalidateApi } from '../../lib/useApi.js';

const CHECK_EVERY = 60 * 1000;

/**
 * Readers who already have the site open hear about a new edition within a
 * minute (and as soon as they come back to the tab), without refreshing.
 */
export default function NewEditionNotice() {
  const { pathname } = useLocation();
  const known = useRef(undefined); // slug of the newest edition when the visit started
  const [fresh, setFresh] = useState(null); // { slug, lead_headline }

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const res = await fetch('/api/editions/latest', { cache: 'no-store' });
        const latest = res.ok ? (await res.json()).edition : null;
        if (!alive) return;
        const slug = latest?.slug ?? null;
        if (known.current === undefined) known.current = slug;
        else if (slug && slug !== known.current) {
          known.current = slug;
          invalidateApi('/editions'); // lists and the front page reload with it
          setFresh({ slug, lead_headline: latest.lead_headline });
        }
      } catch {
        /* offline: try again later */
      }
    }
    check();
    const timer = setInterval(check, CHECK_EVERY);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Reading the new edition already: nothing to announce.
  useEffect(() => {
    if (fresh && pathname === `/edition/${fresh.slug}`) setFresh(null);
  }, [pathname, fresh]);

  if (!fresh) return null;
  return (
    <div className="new-edition" role="status">
      <span className="new-edition__label">New edition just published</span>
      <span className="new-edition__title">{fresh.lead_headline}</span>
      <Link to={`/edition/${fresh.slug}`} className="new-edition__go" onClick={() => setFresh(null)}>
        Read now →
      </Link>
      <button type="button" className="new-edition__close" onClick={() => setFresh(null)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
