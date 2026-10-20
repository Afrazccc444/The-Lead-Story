import { unlinkSync } from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { uploadsDir } from './routes/uploads.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** The structure of a new, empty edition. */
export function emptyContent() {
  return {
    lead_story: {
      kicker: '',
      headline: '',
      subheadline: '',
      deck: '',
      byline: '',
      image: { url: '', caption: '', credit: '' },
      body_markdown: '',
      key_metrics: [],
      historical_context_markdown: '',
      what_to_watch: [],
      pull_quotes: [],
      sections: [],
    },
    global_briefing: { americas: [], emea: [], apac: [], global_south: [] },
    data_trends: [],
    bibliography: [],
    hero: { image: '', alt: '', caption: '', link: '' },
    features: [],
    sidebar: { title: '', links: [], sponsors: [], note: '' },
    cta: { heading: '', text: '', button_label: '', button_url: '', style: 'solid' },
    tags: [],
    explainers: [],
    video_clips: [],
    promo: { image: '', link: '', label: '' },
    poll: { question: '', options: [] },
  };
}

function toEdition(row) {
  if (!row) return null;
  return { ...row, content: JSON.parse(row.content) };
}

// The publishing account's public name. House editions (by the owner) carry no
// separate credit; editions by approved publishers show their organisation —
// and, if the owner has suspended that account, a warning to readers.
const PUBLISHER = "CASE WHEN u.role = 'editor' THEN COALESCE(NULLIF(u.organisation, ''), NULLIF(u.display_name, ''), u.username) END AS publisher, CASE WHEN u.role = 'editor' THEN NULLIF(u.logo, '') END AS publisher_logo, CASE WHEN u.role = 'editor' AND u.status = 'disabled' THEN 1 ELSE 0 END AS publisher_suspended";
const WITH_PUBLISHER = `SELECT e.*, ${PUBLISHER} FROM editions e LEFT JOIN users u ON u.id = e.user_id`;

const now = () => new Date().toISOString();
const slugFor = (issue) => `issue-${issue}`;

/** Editions for the Editor's desk: one account's own, or every edition (userId = null, for the owner). */
export function listAll(userId = null) {
  return db
    .prepare(
      `SELECT e.id, e.issue_number, e.slug, e.status, e.publication_date, e.lead_headline, e.subheadline, e.updated_at,
              e.user_id, u.display_name AS author_name, u.organisation AS author_org, u.username AS author_username,
              (SELECT COALESCE(SUM(v.count), 0) FROM edition_views v WHERE v.edition_id = e.id) AS views,
              (SELECT COUNT(*) FROM edition_likes l WHERE l.edition_id = e.id) AS likes
         FROM editions e LEFT JOIN users u ON u.id = e.user_id
        WHERE ?1 IS NULL OR e.user_id = ?1
        ORDER BY e.issue_number DESC`,
    )
    .all(userId);
}

/** Markdown / rich text → plain words (for word counts, search snippets and excerpts). */
export function plainText(markdown = '') {
  return String(markdown)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '')
    .replace(/[*_`#>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every piece of readable text in an edition, in reading order. */
export function editionText(content = {}, editorNote = '') {
  const lead = content.lead_story ?? {};
  const parts = [lead.headline, lead.subheadline, lead.deck, lead.body_markdown, lead.historical_context_markdown, ...(lead.what_to_watch ?? [])];
  for (const items of Object.values(content.global_briefing ?? {})) for (const i of items ?? []) parts.push(i.headline, i.summary);
  for (const f of content.features ?? []) for (const b of f.blocks ?? []) parts.push(b.title, b.body_markdown);
  for (const t of content.data_trends ?? []) parts.push(t.title, t.caption);
  parts.push(editorNote);
  return plainText(parts.filter(Boolean).join('\n'));
}

/** "X min read" at an average 220 words per minute. */
export function readingMinutes(content, editorNote) {
  const words = editionText(content, editorNote).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** The stories a video report covers: lead-story sections, then the regional headlines. */
function storyTitles(content = {}) {
  const lead = content.lead_story ?? {};
  const titles = [];
  if (lead.sections?.length) {
    for (const s of lead.sections) if (s.headline?.trim()) titles.push(s.headline.trim());
  } else {
    for (const line of String(lead.body_markdown ?? '').split('\n')) {
      const l = line.trim();
      const m = /^#{1,6}\s+(.+)/.exec(l) ?? (/^\d+\.\s+\S/.test(l) && l.length < 100 && !/\.$/.test(l) ? /^\d+\.\s+(.+)/.exec(l) : null);
      if (m) titles.push(plainText(m[1]));
    }
  }
  for (const items of Object.values(content.global_briefing ?? {})) for (const i of items ?? []) if (i.headline) titles.push(i.headline);
  return titles;
}

export function listPublished() {
  const rows = db
    .prepare(
      `SELECT e.id, e.issue_number, e.slug, e.publication_date, e.lead_headline, e.subheadline, e.editor_note, e.content, ${PUBLISHER}
         FROM editions e LEFT JOIN users u ON u.id = e.user_id WHERE e.status = 'published'
        ORDER BY e.publication_date DESC, e.issue_number DESC`,
    )
    .all();
  return rows.map(({ content, editor_note, ...row }) => {
    const c = JSON.parse(content);
    const lead = c.lead_story ?? {};
    return {
      ...row,
      kicker: lead.kicker ?? '',
      deck: lead.deck ?? '',
      byline: lead.byline ?? '',
      tags: c.tags ?? [],
      thumbnail: c.hero?.image || lead.image?.url || '',
      source_count: c.bibliography?.length ?? 0,
      reading_minutes: readingMinutes(c, editor_note),
      story_titles: storyTitles(c),
    };
  });
}

/** Full-text search across published editions (headlines, articles, briefings, notes). */
export function searchPublished(query, limit = 20) {
  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const rows = db
    .prepare(
      `SELECT id, issue_number, slug, publication_date, lead_headline, editor_note, content
         FROM editions WHERE status = 'published' ORDER BY publication_date DESC`,
    )
    .all();
  const results = [];
  for (const row of rows) {
    const text = editionText(JSON.parse(row.content), row.editor_note);
    const lower = text.toLowerCase();
    if (!terms.every((t) => lower.includes(t))) continue;
    const at = lower.indexOf(terms[0]);
    const start = Math.max(0, at - 70);
    const snippet = `${start > 0 ? '…' : ''}${text.slice(start, at + 150).trim()}${at + 150 < text.length ? '…' : ''}`;
    const score = terms.reduce((s, t) => s + lower.split(t).length - 1 + (row.lead_headline.toLowerCase().includes(t) ? 5 : 0), 0);
    results.push({ slug: row.slug, issue_number: row.issue_number, publication_date: row.publication_date, lead_headline: row.lead_headline, snippet, score });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit).map(({ score, ...r }) => r);
}

export function getById(id) {
  return toEdition(db.prepare('SELECT * FROM editions WHERE id = ?').get(id));
}

export function getPublishedBySlug(slug) {
  return toEdition(db.prepare(`${WITH_PUBLISHER} WHERE e.slug = ? AND e.status = 'published'`).get(slug));
}

export function getLatestPublished() {
  return toEdition(
    db
      .prepare(
        `${WITH_PUBLISHER} WHERE e.status = 'published' AND NOT COALESCE(u.role = 'editor' AND u.status = 'disabled', 0)
          ORDER BY e.publication_date DESC, e.issue_number DESC LIMIT 1`,
      )
      .get(),
  );
}

export function create(userId) {
  const next = (db.prepare('SELECT MAX(issue_number) AS n FROM editions').get().n ?? 0) + 1;
  const stamp = now();
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO editions (issue_number, slug, content, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(next, slugFor(next), JSON.stringify(emptyContent()), userId, stamp, stamp);
  return getById(Number(lastInsertRowid));
}

/**
 * Build the article text from headline sections:
 *   ## Headline
 *   The written response…
 *   ![caption](/uploads/photo.webp)   ← photos and videos, in order
 */
export function composeSections(sections = []) {
  const parts = [];
  for (const s of sections) {
    if (s.headline?.trim()) parts.push(`## ${s.headline.trim().replace(/\n+/g, ' ')}`);
    if (s.body_markdown?.trim()) parts.push(s.body_markdown.trim());
    for (const m of s.media ?? []) if (m.url) parts.push(`![${(m.caption ?? '').replace(/[[\]\n]/g, ' ').trim()}](${m.url})`);
  }
  return parts.join('\n\n');
}

export function update(id, { content, editor_note, publication_date, issue_number }) {
  const edition = getById(id);
  if (!edition) throw new HttpError(404, 'Edition not found');
  // Headline sections are the source of truth for the article whenever they are used.
  if (content?.lead_story?.sections?.length) {
    content.lead_story.body_markdown = composeSections(content.lead_story.sections);
  }

  const next = {
    content: content ?? edition.content,
    editor_note: editor_note ?? edition.editor_note,
    publication_date: publication_date === undefined ? edition.publication_date : publication_date,
    issue_number: issue_number ?? edition.issue_number,
  };

  // Changing the issue number changes the public link, so only allow it before publishing.
  if (next.issue_number !== edition.issue_number) {
    if (edition.status === 'published') throw new HttpError(409, 'Unpublish the edition before changing its issue number.');
    const taken = db.prepare('SELECT id FROM editions WHERE issue_number = ? AND id <> ?').get(next.issue_number, id);
    if (taken) throw new HttpError(409, `Issue ${next.issue_number} already exists.`);
  }

  db.prepare(
    `UPDATE editions
        SET content = ?, editor_note = ?, publication_date = ?, issue_number = ?, slug = ?,
            lead_headline = ?, subheadline = ?, updated_at = ?
      WHERE id = ?`,
  ).run(
    JSON.stringify(next.content),
    next.editor_note,
    next.publication_date,
    next.issue_number,
    slugFor(next.issue_number),
    next.content.lead_story?.headline ?? '',
    next.content.lead_story?.subheadline ?? '',
    now(),
    id,
  );
  return getById(id);
}

export function publish(id) {
  const edition = getById(id);
  if (!edition) throw new HttpError(404, 'Edition not found');
  if (!edition.content.lead_story?.headline?.trim()) {
    throw new HttpError(409, 'Add a lead story headline before publishing.');
  }
  db.prepare(
    `UPDATE editions SET status = 'published', publication_date = COALESCE(publication_date, ?), updated_at = ? WHERE id = ?`,
  ).run(now(), now(), id);
  return getById(id);
}

export function unpublish(id) {
  const edition = getById(id);
  if (!edition) throw new HttpError(404, 'Edition not found');
  db.prepare(`UPDATE editions SET status = 'draft', updated_at = ? WHERE id = ?`).run(now(), id);
  return getById(id);
}

export function remove(id) {
  const edition = getById(id);
  if (!edition) throw new HttpError(404, 'Edition not found');
  // Published or draft: deleting removes it from the site and the library for good.
  db.prepare('DELETE FROM editions WHERE id = ?').run(id);
  db.prepare('DELETE FROM poll_votes WHERE edition_id = ?').run(id);
  db.prepare('DELETE FROM edition_views WHERE edition_id = ?').run(id);
  db.prepare('DELETE FROM edition_likes WHERE edition_id = ?').run(id);

  // Also delete its uploaded photos, unless another edition still uses them.
  // Photos and video clips used only by this edition are deleted with it.
  const images = new Set(JSON.stringify(edition.content).match(/\/uploads\/[a-f0-9-]{36}\.(?:jpg|png|gif|webp|mp4|webm|mov)/g) ?? []);
  // …or it is a company logo or the site's own logo.
  const stillUsed = db.prepare(
    `SELECT 1 FROM editions WHERE content LIKE ?1
     UNION ALL SELECT 1 FROM users WHERE logo = ?2
     UNION ALL SELECT 1 FROM settings WHERE value LIKE ?1 LIMIT 1`,
  );
  let removedImages = 0;
  for (const url of images) {
    if (stillUsed.get(`%${url}%`, url)) continue;
    try {
      unlinkSync(path.join(uploadsDir, path.basename(url)));
      removedImages++;
    } catch {
      // Already gone — nothing to do.
    }
  }
  return { removedImages };
}
