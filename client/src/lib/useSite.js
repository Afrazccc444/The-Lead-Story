import { useEffect, useState } from 'react';
import { api } from './api.js';

// Site settings are shared by the footer and every edition, so fetch them once per page load.
let cache = null;
let pending = null;
const listeners = new Set();

function load() {
  pending ??= api
    .get('/site')
    .then(({ site }) => {
      cache = site;
      listeners.forEach((fn) => fn(site));
      return site;
    })
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}

/** Call after saving settings so every component shows the new values. */
export function setSiteCache(site) {
  cache = site;
  listeners.forEach((fn) => fn(site));
}

export function useSite() {
  const [site, setSite] = useState(cache);
  useEffect(() => {
    listeners.add(setSite);
    if (!cache) load();
    return () => listeners.delete(setSite);
  }, []);
  return site;
}
