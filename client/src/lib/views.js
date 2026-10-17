import { useEffect } from 'react';

/**
 * Counts an anonymous view of an edition for the owner's analytics —
 * at most once per browser, per edition, per kind, per day.
 * kind: 'read' (the article) or 'video' (the video report).
 */
export function useTrackView(slug, kind) {
  useEffect(() => {
    if (!slug) return;
    const key = `tls-view:${kind}:${slug}`;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
    } catch {
      /* private mode: count anyway */
    }
    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, kind }),
      keepalive: true,
    }).catch(() => {});
  }, [slug, kind]);
}
