import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { getSetting, setSetting } from '../db.js';
import * as editions from '../editions.js';
import { issueSession, requireAdmin, rotateSessions } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
import { passwordSchema } from './auth.js';

const router = Router();
router.use(requireAdmin);

const idParam = z.coerce.number().int().positive();

// ── Content validation ───────────────────────────────────────
const text = (max) => z.string().max(max).default('');
const briefingItem = z.object({ headline: text(300), summary: text(3000) });

const contentSchema = z.object({
  lead_story: z.object({
    kicker: text(120),
    headline: text(300),
    subheadline: text(600),
    deck: text(1000),
    byline: text(200),
    body_markdown: text(80000),
    key_metrics: z.array(z.object({ label: text(120), value: text(60), context: text(300) })).max(8).default([]),
    historical_context_markdown: text(15000),
    what_to_watch: z.array(z.string().max(500)).max(10).default([]),
  }),
  global_briefing: z.object({
    americas: z.array(briefingItem).max(15).default([]),
    emea: z.array(briefingItem).max(15).default([]),
    apac: z.array(briefingItem).max(15).default([]),
    global_south: z.array(briefingItem).max(15).default([]),
  }),
  data_trends: z
    .array(
      z.object({
        title: text(200),
        caption: text(1000),
        unit: text(30),
        chart_type: z.enum(['bar', 'none']).default('none'),
        data_points: z.array(z.object({ label: z.string().max(120), value: z.number().finite() })).max(30).default([]),
      }),
    )
    .max(6)
    .default([]),
  bibliography: z
    .array(
      z.object({
        author: text(300),
        title: text(500),
        publication: text(200),
        date: text(40),
        url: text(2000),
        accessed: text(40),
      }),
    )
    .max(100)
    .default([]),
});

const editionPatch = z.object({
  content: contentSchema.optional(),
  editor_note: z.string().max(8000).optional(),
  issue_number: z.number().int().min(1).max(100000).optional(),
  publication_date: z.string().datetime().nullable().optional(),
});

// ── Editions ─────────────────────────────────────────────────
router.get('/editions', (req, res) => {
  res.json({ editions: editions.listAll() });
});

router.post('/editions', (req, res) => {
  res.status(201).json({ edition: editions.create() });
});

router.get('/editions/:id', (req, res) => {
  const edition = editions.getById(idParam.parse(req.params.id));
  if (!edition) return res.status(404).json({ error: 'Edition not found' });
  res.json({ edition });
});

router.patch('/editions/:id', (req, res) => {
  const body = editionPatch.parse(req.body);
  res.json({ edition: editions.update(idParam.parse(req.params.id), body) });
});

router.post('/editions/:id/publish', (req, res) => {
  res.json({ edition: editions.publish(idParam.parse(req.params.id)) });
});

router.post('/editions/:id/unpublish', (req, res) => {
  res.json({ edition: editions.unpublish(idParam.parse(req.params.id)) });
});

router.delete('/editions/:id', (req, res) => {
  editions.remove(idParam.parse(req.params.id));
  res.json({ ok: true });
});

// ── Password ─────────────────────────────────────────────────
router.post(
  '/password',
  asyncHandler(async (req, res) => {
    const { current, next } = z.object({ current: z.string().max(200), next: passwordSchema }).parse(req.body);
    if (!(await bcrypt.compare(current, getSetting('password_hash')))) {
      return res.status(401).json({ error: 'Your current password is incorrect' });
    }
    setSetting('password_hash', await bcrypt.hash(next, 12));
    rotateSessions(); // sign out every other device
    issueSession(res); // keep this browser signed in
    res.json({ ok: true });
  }),
);

export default router;
