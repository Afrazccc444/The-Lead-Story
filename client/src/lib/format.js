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

/** Plain text → at most `max` characters, cut at a word boundary, with an ellipsis. */
export function excerpt(text, max = 150) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : max).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/** Markdown → plain words. */
export function plainText(markdown = '') {
  return String(markdown)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '')
    .replace(/[*_`#>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Estimated reading time for a whole edition (220 words per minute). */
export function readingMinutes(edition) {
  const c = edition?.content ?? {};
  const lead = c.lead_story ?? {};
  const parts = [lead.headline, lead.subheadline, lead.deck, lead.body_markdown, lead.historical_context_markdown, ...(lead.what_to_watch ?? [])];
  for (const items of Object.values(c.global_briefing ?? {})) for (const i of items ?? []) parts.push(i.headline, i.summary);
  for (const f of c.features ?? []) for (const b of f.blocks ?? []) parts.push(b.title, b.body_markdown);
  for (const t of c.data_trends ?? []) parts.push(t.title, t.caption);
  parts.push(edition?.editor_note);
  const words = plainText(parts.filter(Boolean).join(' ')).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Stable anchor id for a heading, e.g. "Europe on Edge" → "s-europe-on-edge". */
export function slugify(text) {
  return `s-${plainText(text)
    .toLowerCase()
    .replace(/^\d+\.\s+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)}`;
}

/** Fixed colour per topic for category badges. */
const TAG_COLOURS = [
  [/polit|government|parliament|power/i, 'politics'],
  [/diplom|summit|treaty|un\b|united nations|nato/i, 'diplomacy'],
  [/war|conflict|security|military|defen[cs]e|strike/i, 'conflict'],
  [/econom|trade|tariff|finance|market|money/i, 'economy'],
  [/election|vote|poll|campaign/i, 'elections'],
  [/climate|energy|environment|green/i, 'climate'],
  [/tech|ai\b|cyber|digital|science/i, 'tech'],
];
export function tagColour(tag) {
  const match = TAG_COLOURS.find(([re]) => re.test(tag));
  return `var(--tag-${match ? match[1] : 'default'})`;
}
