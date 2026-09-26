const LOCALE = 'en-GB';

export function formatDate(value, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(LOCALE, options);
}

export function formatLongDate(value) {
  return formatDate(value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toLocaleString(LOCALE, options);
}

export const REGION_LABELS = {
  americas: 'The Americas',
  emea: 'Europe, Middle East & Africa',
  apac: 'Asia-Pacific',
  global_south: 'The Global South',
};

/**
 * Text written as "…as reported [2]." cites bibliography entry 2.
 * Splits a string into plain-text and citation parts (only numbers that exist are cited).
 */
export function splitCitations(text, count) {
  const parts = [];
  const pattern = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text ?? '')) !== null) {
    const numbers = match[1].split(',').map((n) => Number(n.trim())).filter((n) => n >= 1 && n <= count);
    if (!numbers.length) continue;
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ cite: numbers });
    last = match.index + match[0].length;
  }
  if (last < (text ?? '').length) parts.push(text.slice(last));
  return parts;
}
