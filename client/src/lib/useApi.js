import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/** Fetch `path` on mount / when it changes. Returns { data, error, loading, reload }. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await api.get(path);
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — The Lead Story` : 'The Lead Story';
  }, [title]);
}
