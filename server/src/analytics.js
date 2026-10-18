// Reader analytics: anonymous view counts per edition and per day.
// No cookies or personal data — the browser only reports "someone read this".
import { db } from './db.js';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

/** Counts one view of a published edition. kind: 'read' (the article) or 'video' (the video report). */
export function recordView(slug, kind) {
  const edition = db.prepare(`SELECT id FROM editions WHERE slug = ? AND status = 'published'`).get(slug);
  if (!edition) return false;
  db.prepare(
    `INSERT INTO edition_views (edition_id, day, kind, count) VALUES (?, ?, ?, 1)
     ON CONFLICT (edition_id, day, kind) DO UPDATE SET count = count + 1`,
  ).run(edition.id, today(), kind);
  return true;
}

/** What readers see under an article: total views and likes, and whether this browser liked it. */
export function engagement(editionId, voter) {
  const views = db.prepare('SELECT COALESCE(SUM(count), 0) AS n FROM edition_views WHERE edition_id = ?').get(editionId).n;
  const likes = db.prepare('SELECT COUNT(*) AS n FROM edition_likes WHERE edition_id = ?').get(editionId).n;
  const liked = voter ? Boolean(db.prepare('SELECT 1 FROM edition_likes WHERE edition_id = ? AND voter = ?').get(editionId, voter)) : false;
  return { views, likes, liked };
}

// One network can't flood an article with likes (a school or office shares one address).
const MAX_LIKES_PER_ADDRESS = 50;

/** Records a like (once per browser), with the address it came from. Returns false if this network hit the cap. */
export function like(editionId, voter, ip, userAgent) {
  if (db.prepare('SELECT 1 FROM edition_likes WHERE edition_id = ? AND voter = ?').get(editionId, voter)) return true;
  const fromAddress = db.prepare('SELECT COUNT(*) AS n FROM edition_likes WHERE edition_id = ? AND ip = ?').get(editionId, ip).n;
  if (fromAddress >= MAX_LIKES_PER_ADDRESS) return false;
  db.prepare('INSERT INTO edition_likes (edition_id, voter, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?)').run(
    editionId,
    voter,
    ip,
    String(userAgent ?? '').slice(0, 300),
    new Date().toISOString(),
  );
  return true;
}

export function unlike(editionId, voter) {
  db.prepare('DELETE FROM edition_likes WHERE edition_id = ? AND voter = ?').run(editionId, voter);
}

/** The like log for one edition (owner only): when, from which address and browser. */
export function likeLog(editionId) {
  return db
    .prepare('SELECT ip, user_agent, created_at FROM edition_likes WHERE edition_id = ? ORDER BY created_at DESC LIMIT 500')
    .all(editionId);
}

/** Everything the Admin app's overview shows. */
export function overview(days = 30) {
  const since = daysAgo(days - 1);
  const sum = (where = '', ...args) =>
    db.prepare(`SELECT COALESCE(SUM(count), 0) AS n FROM edition_views ${where}`).get(...args).n;

  const daily = db
    .prepare(
      `SELECT day, SUM(CASE WHEN kind = 'read' THEN count ELSE 0 END) AS reads,
                   SUM(CASE WHEN kind = 'video' THEN count ELSE 0 END) AS videos
         FROM edition_views WHERE day >= ? GROUP BY day`,
    )
    .all(since);
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = daysAgo(days - 1 - i);
    return { day, reads: byDay.get(day)?.reads ?? 0, videos: byDay.get(day)?.videos ?? 0 };
  });

  const topEditions = db
    .prepare(
      `SELECT e.id, e.slug, e.issue_number, e.lead_headline, e.status,
              COALESCE(NULLIF(u.organisation, ''), u.display_name, u.username) AS author,
              SUM(CASE WHEN v.kind = 'read' THEN v.count ELSE 0 END) AS reads,
              SUM(CASE WHEN v.kind = 'video' THEN v.count ELSE 0 END) AS videos,
              SUM(v.count) AS total,
              (SELECT COUNT(*) FROM edition_likes l WHERE l.edition_id = e.id) AS likes
         FROM edition_views v JOIN editions e ON e.id = v.edition_id LEFT JOIN users u ON u.id = e.user_id
        GROUP BY e.id ORDER BY total DESC LIMIT 10`,
    )
    .all();

  const count = (sql) => db.prepare(sql).get().n;
  return {
    totals: {
      views_all_time: sum(),
      views_today: sum('WHERE day = ?', today()),
      views_7_days: sum('WHERE day >= ?', daysAgo(6)),
      views_30_days: sum('WHERE day >= ?', since),
      video_views_30_days: sum(`WHERE day >= ? AND kind = 'video'`, since),
      likes: count('SELECT COUNT(*) AS n FROM edition_likes'),
      published: count(`SELECT COUNT(*) AS n FROM editions WHERE status = 'published'`),
      drafts: count(`SELECT COUNT(*) AS n FROM editions WHERE status = 'draft'`),
      accounts: count(`SELECT COUNT(*) AS n FROM users WHERE role = 'editor' AND status <> 'disabled'`),
      pending_requests: count(`SELECT COUNT(*) AS n FROM access_requests WHERE status = 'pending'`),
    },
    series,
    topEditions,
  };
}
