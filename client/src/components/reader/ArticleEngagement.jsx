import { useEffect, useState } from 'react';
import { formatNumber } from '../../lib/format.js';

/**
 * Under each article: how many times it has been viewed, and a Like button
 * anyone can use without an account (one like per browser; the IP address is
 * recorded so the owner can check likes are genuine).
 */
export default function ArticleEngagement({ slug }) {
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    // A moment's delay so this visit's own view has been counted.
    const timer = setTimeout(() => {
      fetch(`/api/editions/${encodeURIComponent(slug)}/engagement`, { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => alive && data && setStats(data))
        .catch(() => {});
    }, 600);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [slug]);

  async function toggleLike() {
    if (!stats || busy) return;
    const next = !stats.liked;
    setBusy(true);
    setError(null);
    // Update straight away; the server's answer then confirms the real count.
    setStats({ ...stats, liked: next, likes: stats.likes + (next ? 1 : -1) });
    try {
      const res = await fetch(`/api/editions/${encodeURIComponent(slug)}/like`, { method: next ? 'POST' : 'DELETE', credentials: 'same-origin' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not save your like. Please try again.');
      setStats(data);
    } catch (err) {
      setStats(stats);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!stats) return null;
  return (
    <section className="engagement" aria-label="Views and likes">
      <span className="engagement__views" title="Times this article has been read or watched">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M12 5C6.5 5 2.4 9.1 1.2 12c1.2 2.9 5.3 7 10.8 7s9.6-4.1 10.8-7C21.6 9.1 17.5 5 12 5Zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Zm0-2.3a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" fill="currentColor" />
        </svg>
        <strong>{formatNumber(stats.views)}</strong> {stats.views === 1 ? 'view' : 'views'}
      </span>
      <button type="button" className={`engagement__like${stats.liked ? ' is-liked' : ''}`} onClick={toggleLike} disabled={busy} aria-pressed={stats.liked}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M12 20.5s-7.5-4.6-9.6-9.2C1 8.2 2.9 4.5 6.6 4.5c2.2 0 3.6 1.3 4.4 2.6.8-1.3 2.2-2.6 4.4-2.6 3.7 0 5.6 3.7 4.2 6.8-2.1 4.6-9.6 9.2-9.6 9.2Z"
            fill={stats.liked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        <span>{stats.liked ? 'Liked' : 'Like'}</span>
        <strong>{formatNumber(stats.likes)}</strong>
      </button>
      <p className="engagement__note">No account needed. To keep likes genuine, your IP address is recorded when you like.</p>
      {error && (
        <p className="engagement__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
