import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// In-memory cache: pages you have already opened render instantly, then
// refresh quietly in the background ("stale-while-revalidate").
const cache = new Map();

/** Forget cached responses (e.g. after publishing or deleting). */
export function invalidateApi(prefix = '') {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}

/**
 * Fetch `path`. Returns { data, error, loading, reload }.
 * `loading` is only true when there is nothing to show yet.
 */
export function useApi(path) {
  const [state, setState] = useState(() => ({
    data: cache.get(path) ?? null,
    error: null,
    loading: !cache.has(path),
  }));
  const latest = useRef(path);

  const load = useCallback(async () => {
    if (!path) return;
    latest.current = path;
    setState((s) => ({ ...s, loading: !cache.has(path) && !s.data }));
    try {
      const data = await api.get(path);
      cache.set(path, data);
      if (latest.current === path) setState({ data, error: null, loading: false });
    } catch (error) {
      cache.delete(path);
      if (latest.current === path) setState({ data: null, error, loading: false });
    }
  }, [path]);

  useEffect(() => {
    setState({ data: cache.get(path) ?? null, error: null, loading: !cache.has(path) });
    load();
  }, [path, load]);

  return { ...state, reload: load };
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — The Lead Story` : 'The Lead Story';
  }, [title]);
}
