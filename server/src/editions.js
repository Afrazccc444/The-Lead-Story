import { db } from './db.js';

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
      body_markdown: '',
      key_metrics: [],
      historical_context_markdown: '',
      what_to_watch: [],
    },
    global_briefing: { americas: [], emea: [], apac: [], global_south: [] },
    data_trends: [],
    bibliography: [],
  };
}

function toEdition(row) {
  if (!row) return null;
  return { ...row, content: JSON.parse(row.content) };
}

const now = () => new Date().toISOString();
const slugFor = (issue) => `issue-${issue}`;

export function listAll() {
  return db
    .prepare(
      `SELECT id, issue_number, slug, status, publication_date, lead_headline, subheadline, updated_at
         FROM editions ORDER BY issue_number DESC`,
    )
    .all();
}

export function listPublished() {
  return db
    .prepare(
      `SELECT id, issue_number, slug, publication_date, lead_headline, subheadline,
              json_extract(content, '$.lead_story.kicker') AS kicker,
              json_extract(content, '$.lead_story.deck')   AS deck,
              json_extract(content, '$.lead_story.byline') AS byline,
              json_array_length(content, '$.bibliography') AS source_count
         FROM editions WHERE status = 'published'
        ORDER BY publication_date DESC, issue_number DESC`,
    )
    .all();
}

export function getById(id) {
  return toEdition(db.prepare('SELECT * FROM editions WHERE id = ?').get(id));
}

export function getPublishedBySlug(slug) {
  return toEdition(db.prepare(`SELECT * FROM editions WHERE slug = ? AND status = 'published'`).get(slug));
}

export function getLatestPublished() {
  return toEdition(
    db
      .prepare(`SELECT * FROM editions WHERE status = 'published' ORDER BY publication_date DESC, issue_number DESC LIMIT 1`)
      .get(),
  );
}

export function create() {
  const next = (db.prepare('SELECT MAX(issue_number) AS n FROM editions').get().n ?? 0) + 1;
  const stamp = now();
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO editions (issue_number, slug, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(next, slugFor(next), JSON.stringify(emptyContent()), stamp, stamp);
  return getById(Number(lastInsertRowid));
}

export function update(id, { content, editor_note, publication_date, issue_number }) {
  const edition = getById(id);
  if (!edition) throw new HttpError(404, 'Edition not found');

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
  if (edition.status === 'published') throw new HttpError(409, 'Unpublish the edition before deleting it.');
  db.prepare('DELETE FROM editions WHERE id = ?').run(id);
}
