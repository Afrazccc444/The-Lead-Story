import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { db, getSetting } from '../db.js';
import * as editions from '../editions.js';
import { asyncHandler } from '../middleware/errors.js';
import { editionIdForPass, editionPdf } from '../pdf.js';

const router = Router();

/** Only what readers need. */
function present(edition) {
  return {
    id: edition.id,
    issue_number: edition.issue_number,
    slug: edition.slug,
    publication_date: edition.publication_date,
    lead_headline: edition.lead_headline,
    subheadline: edition.subheadline,
    editor_note: edition.editor_note,
    content: edition.content,
    reading_minutes: editions.readingMinutes(edition.content, edition.editor_note),
  };
}

/** Site-wide settings readers need (social links, logo, footer text). */
router.get('/site', (req, res) => {
  const raw = getSetting('site');
  res.set('Cache-Control', 'no-cache');
  res.json({ site: raw ? JSON.parse(raw) : { social: {} } });
});

router.get('/editions', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json({ editions: editions.listPublished() });
});

router.get('/editions/latest', (req, res) => {
  const edition = editions.getLatestPublished();
  if (!edition) return res.status(404).json({ error: 'No edition has been published yet' });
  res.set('Cache-Control', 'no-cache');
  res.json({ edition: present(edition) });
});

router.get('/editions/:slug', (req, res) => {
  const edition = editions.getPublishedBySlug(req.params.slug);
  if (!edition) return res.status(404).json({ error: 'Edition not found' });
  res.set('Cache-Control', 'no-cache');
  res.json({ edition: present(edition) });
});

/** Search every published edition. */
router.get('/search', (req, res) => {
  const q = z.string().trim().max(100).catch('').parse(req.query.q);
  if (q.length < 2) return res.json({ results: [] });
  res.json({ results: editions.searchPublished(q) });
});

/**
 * Download a published edition as a designed PDF.
 * ?inline=1 shows it inside the site's PDF viewer instead of downloading.
 */
router.get(
  '/editions/:slug/pdf',
  asyncHandler(async (req, res) => {
    const edition = editions.getPublishedBySlug(req.params.slug);
    if (!edition) return res.status(404).json({ error: 'Edition not found' });
    // Vite's dev proxy forwards the original address in x-forwarded-host.
    const file = await editionPdf(edition, req.get('x-forwarded-host') || req.get('host'));
    const name = `The-Lead-Story-Issue-${edition.issue_number}.pdf`;
    if (req.query.inline === '1') {
      // Allow this one response to be framed by our own pages (the inline viewer).
      res.set('Content-Security-Policy', "frame-ancestors 'self'");
      res.set('X-Frame-Options', 'SAMEORIGIN');
      res.set('Content-Disposition', `inline; filename="${name}"`);
      return res.sendFile(file);
    }
    res.download(file, name);
  }),
);

/** Used only by the PDF maker's hidden browser to read a draft via a one-time print pass. */
router.get('/print/:token', (req, res) => {
  const id = editionIdForPass(req.params.token);
  const edition = id && editions.getById(id);
  if (!edition) return res.status(404).json({ error: 'This print link has expired' });
  res.set('Cache-Control', 'no-store');
  res.json({ edition: present(edition) });
});

// ── Reader polls ───────────────────────────────────────────────
const VOTER_COOKIE = 'tls_voter';

function voterId(req, res) {
  let id = req.cookies?.[VOTER_COOKIE];
  if (!/^[a-f0-9]{32}$/.test(id ?? '')) {
    id = randomBytes(16).toString('hex');
    res.cookie(VOTER_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 365 * 864e5 });
  }
  return id;
}

function pollResults(edition, voter) {
  const options = edition.content.poll?.options ?? [];
  const counts = options.map(() => 0);
  for (const row of db.prepare('SELECT option, COUNT(*) AS n FROM poll_votes WHERE edition_id = ? GROUP BY option').all(edition.id)) {
    if (row.option < counts.length) counts[row.option] = row.n;
  }
  const mine = voter ? db.prepare('SELECT option FROM poll_votes WHERE edition_id = ? AND voter = ?').get(edition.id, voter) : null;
  return { counts, total: counts.reduce((a, b) => a + b, 0), myVote: mine?.option ?? null };
}

const voteLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });

router.get('/editions/:slug/poll', (req, res) => {
  const edition = editions.getPublishedBySlug(req.params.slug);
  if (!edition?.content.poll?.question) return res.status(404).json({ error: 'No poll' });
  res.set('Cache-Control', 'no-store');
  res.json(pollResults(edition, req.cookies?.[VOTER_COOKIE]));
});

router.post('/editions/:slug/poll', voteLimiter, (req, res) => {
  const edition = editions.getPublishedBySlug(req.params.slug);
  const options = edition?.content.poll?.options ?? [];
  if (!edition?.content.poll?.question || !options.length) return res.status(404).json({ error: 'No poll' });
  const option = z.number().int().min(0).max(options.length - 1).parse(req.body?.option);
  const voter = voterId(req, res);
  db.prepare('INSERT OR IGNORE INTO poll_votes (edition_id, option, voter, created_at) VALUES (?, ?, ?, ?)').run(
    edition.id,
    option,
    voter,
    new Date().toISOString(),
  );
  res.json(pollResults(edition, voter));
});

export default router;
