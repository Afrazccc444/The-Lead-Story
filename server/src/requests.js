// "Publish with us": requests from the public site, and the introduction and
// terms the owner sets for them. Any arrangements are made privately afterwards.
import { db, getSetting, setSetting } from './db.js';
import { HttpError } from './editions.js';

const now = () => new Date().toISOString();

/** The owner edits all of this in the Admin app (Publishing tab). */
export const DEFAULT_PUBLISHING = {
  intro:
    'The Lead Story publishes independent, fact-checked reporting. Organisations and journalists without a platform of their own can apply to publish here. Every account is reviewed personally, and every article must meet our standards for accuracy and fairness.',
  terms: `By applying to publish on The Lead Story, you agree that:

1. **Truthful reporting only.** Everything you publish must be accurate, based on evidence, and fairly presented. Propaganda, deliberate misinformation, hate speech and personal attacks are not allowed.
2. **Sources.** Factual claims must be supported by sources listed in the article's bibliography.
3. **Review and removal.** The owner may review, unpublish or remove any article, and suspend any account, that breaks these terms — at any time and without refund for the affected content.
4. **Responsibility.** You are responsible for what you publish and confirm you have the right to use every text, photo and video you upload.
5. **Approval.** Sending a request does not guarantee an account. We will contact you by email to discuss it, and any arrangements are agreed privately before an account is created.
6. **Accounts.** Your login is personal. Keep your password private; you choose it yourself when your account is created.
7. **Changes.** These terms may be updated; continuing to publish means you accept the current version.`,
};

export function getPublishing() {
  const saved = JSON.parse(getSetting('publishing') ?? 'null') ?? {};
  return { intro: saved.intro ?? DEFAULT_PUBLISHING.intro, terms: saved.terms ?? DEFAULT_PUBLISHING.terms };
}

export function setPublishing(next) {
  setSetting('publishing', JSON.stringify(next));
  return getPublishing();
}

export function createRequest(data) {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO access_requests (name, email, organisation, about, message, agreed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(data.name, data.email, data.organisation, data.about, data.message, now(), now());
  return Number(lastInsertRowid);
}

export function listRequests(status = null) {
  return db
    .prepare(
      `SELECT r.*, u.username FROM access_requests r LEFT JOIN users u ON u.id = r.user_id
        WHERE ?1 IS NULL OR r.status = ?1 ORDER BY r.created_at DESC`,
    )
    .all(status);
}

export function getRequest(id) {
  return db.prepare('SELECT * FROM access_requests WHERE id = ?').get(id);
}

export function reviewRequest(id, { status, owner_note = '', user_id = null }) {
  const request = getRequest(id);
  if (!request) throw new HttpError(404, 'Request not found');
  db.prepare('UPDATE access_requests SET status = ?, owner_note = ?, user_id = COALESCE(?, user_id), reviewed_at = ? WHERE id = ?').run(
    status,
    owner_note,
    user_id,
    now(),
    id,
  );
  return getRequest(id);
}

export function deleteRequest(id) {
  db.prepare('DELETE FROM access_requests WHERE id = ?').run(id);
}
