import { unlinkSync } from 'node:fs';
import express, { Router } from 'express';
import { z } from 'zod';
import { getSetting, setSetting } from '../db.js';
import * as editions from '../editions.js';
import { requireOwner, requireUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
import { IMAGE_URL_PATTERN, VIDEO_URL_PATTERN } from './uploads.js';
import { clearPdfCache, draftPdf } from '../pdf.js';
import * as template from '../template.js';

const router = Router();
router.use(requireUser);

const idParam = z.coerce.number().int().positive();

/**
 * The edition with this id — if the signed-in account may work on it.
 * Editors only ever see their own; the owner sees everything.
 * Someone else's edition answers "not found", so ids reveal nothing.
 */
function editionFor(req) {
  const edition = editions.getById(idParam.parse(req.params.id));
  if (!edition || (req.user.role !== 'owner' && edition.user_id !== req.user.id)) {
    throw new editions.HttpError(404, 'Edition not found');
  }
  return edition;
}

// ── Content validation ───────────────────────────────────────
const text = (max) => z.string().max(max).default('');
// Only images uploaded to this site may be used (keeps pages fast and safe).
const imageUrl = z
  .string()
  .regex(IMAGE_URL_PATTERN, 'Images must be uploaded through the editor')
  .or(z.literal(''))
  .default('');
const briefingItem = z.object({ headline: text(300), summary: text(3000), image: imageUrl });
// Links readers can click: only web and email addresses (blocks "javascript:" tricks).
const link = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === '' || /^(https?:\/\/|mailto:)/i.test(v), 'Links must start with https:// (or mailto: for email)')
  .default('');

const featureBlock = z.object({
  title: text(200),
  body_markdown: text(10000),
  image: imageUrl,
  cta_label: text(60),
  cta_url: link,
});

const contentSchema = z.object({
  lead_story: z.object({
    kicker: text(120),
    headline: text(300),
    subheadline: text(600),
    deck: text(1000),
    byline: text(200),
    image: z.object({ url: imageUrl, caption: text(500), credit: text(200) }).default({}),
    body_markdown: text(80000),
    key_metrics: z.array(z.object({ label: text(120), value: text(60), context: text(300) })).max(8).default([]),
    historical_context_markdown: text(15000),
    what_to_watch: z.array(z.string().max(500)).max(10).default([]),
    pull_quotes: z.array(z.string().max(300)).max(4).default([]),
    // Headline sections: each has a headline, the written response, and its own photos/videos.
    // When present, the article text (body_markdown) is built from them automatically.
    sections: z
      .array(
        z.object({
          headline: text(300),
          body_markdown: text(20000),
          media: z
            .array(
              z.object({
                type: z.enum(['image', 'video']),
                url: z.string().refine((v) => IMAGE_URL_PATTERN.test(v) || VIDEO_URL_PATTERN.test(v), 'Photos and videos must be uploaded through the editor'),
                caption: text(300),
              }),
            )
            .max(8)
            .default([]),
        }),
      )
      .max(30)
      .default([]),
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
        url: link,
        accessed: text(40),
      }),
    )
    .max(100)
    .default([]),

  // ── Layout & structural blocks ─────────────────────────────
  hero: z.object({ image: imageUrl, alt: text(300), caption: text(300), link }).default({}),
  features: z
    .array(
      z.object({
        title: text(200),
        layout: z.enum(['1', '2', '3']).default('2'),
        background: z.enum(['plain', 'tint', 'dark']).default('plain'),
        divider: z.enum(['line', 'double', 'space']).default('line'),
        blocks: z.array(featureBlock).max(12).default([]),
      }),
    )
    .max(8)
    .default([]),
  sidebar: z
    .object({
      title: text(120),
      links: z.array(z.object({ label: text(200), url: link })).max(20).default([]),
      sponsors: z.array(z.object({ name: text(120), url: link, logo: imageUrl })).max(10).default([]),
      note: text(1000),
    })
    .default({}),
  cta: z
    .object({
      heading: text(200),
      text: text(1000),
      button_label: text(60),
      button_url: link,
      style: z.enum(['solid', 'pill']).default('solid'),
    })
    .default({}),

  // ── Tags, promotion slot and reader poll ───────────────────
  tags: z.array(z.string().trim().min(1).max(30)).max(6).default([]),
  explainers: z.array(z.object({ title: text(160), body_markdown: text(3000) })).max(6).default([]),
  // Clips that play only in the video report, at a chosen story
  video_clips: z
    .array(
      z.object({
        target: text(220), // 'lead', 'section:<slug>', 'brief:<slug>' or 'feature:<slug>'
        url: z.string().regex(VIDEO_URL_PATTERN, 'Videos must be uploaded through the editor').or(z.literal('')).default(''),
        caption: text(200),
        play: z.enum(['before', 'wall']).default('before'),
      }),
    )
    .max(12)
    .default([]),
  promo: z.object({ image: imageUrl, link, label: text(120) }).default({}),
  poll: z
    .object({
      question: text(200),
      options: z.array(z.string().max(120)).max(6).default([]),
    })
    .default({}),
});

const SOCIAL_KEYS = ['x', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok', 'email'];
const siteSchema = z.object({
  social: z.object(Object.fromEntries(SOCIAL_KEYS.map((k) => [k, link]))).default({}),
  logo: imageUrl, // reserved logo slot in the header
  footer_text: text(800), // contact / mailing address / legal small print
});

const editionPatch = z.object({
  content: contentSchema.optional(),
  editor_note: z.string().max(8000).optional(),
  issue_number: z.number().int().min(1).max(100000).optional(),
  publication_date: z.string().datetime().nullable().optional(),
});

// ── Site-wide settings (social media links) ──────────────────
router.put('/site', requireOwner, (req, res) => {
  // Merge, so saving one part of Settings (e.g. social links) never wipes another (e.g. the logo).
  const current = JSON.parse(getSetting('site') ?? '{}');
  const changes = siteSchema.partial().parse(req.body);
  const site = siteSchema.parse({ ...current, ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) });
  setSetting('site', JSON.stringify(site));
  res.json({ site });
});

// ── Editions ─────────────────────────────────────────────────
router.get('/editions', (req, res) => {
  res.json({ editions: editions.listAll(req.user.role === 'owner' ? null : req.user.id) });
});

// ── Question template: create an edition from an answered document ──
/** Download the template for N headlines, as Word (.docx) or plain text. */
router.get('/template', (req, res) => {
  const headlines = z.coerce.number().int().min(1).max(template.MAX_HEADLINES).catch(3).parse(req.query.headlines);
  const name = `The-Lead-Story-template-${headlines}-headline${headlines === 1 ? '' : 's'}`;
  if (req.query.format === 'txt') {
    res.type('text/plain; charset=utf-8').attachment(`${name}.txt`).send(template.templateText(headlines));
  } else {
    res
      .type('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .attachment(`${name}.docx`)
      .send(template.templateDocx(headlines));
  }
});

/** Upload an answered template (Word, PDF or text): the edition is created and laid out automatically. */
router.post(
  '/template/import',
  express.raw({ type: () => true, limit: '25mb' }),
  asyncHandler(async (req, res) => {
    if (!req.body?.length) return res.status(400).json({ error: 'Please choose your answered template file.' });
    const fileName = decodeURIComponent(req.get('x-file-name') ?? '');
    let text;
    try {
      text = await template.extractText(req.body, fileName);
    } catch (err) {
      return res.status(422).json({ error: err.message?.startsWith('Old Word') ? err.message : 'This file could not be read. Please upload a Word (.docx), PDF or text file.' });
    }
    const { answers, unknown } = template.readAnswers(text);
    if (!Object.keys(answers).length) {
      return res.status(422).json({ error: 'No answers were found. Make sure each answer is written under its code, like [A2] or [R1].' });
    }
    const { content, editorNote, report } = template.buildContent(answers, editions.emptyContent());
    const patch = editionPatch.parse({ content, editor_note: editorNote }); // checked before anything is created
    const created = editions.create(req.user.id);
    const edition = editions.update(created.id, patch);
    res.status(201).json({ edition, report: { ...report, unknown } });
  }),
);

router.post('/editions', (req, res) => {
  res.status(201).json({ edition: editions.create(req.user.id) });
});

router.get('/editions/:id', (req, res) => {
  res.json({ edition: editionFor(req) });
});

router.patch('/editions/:id', (req, res) => {
  const { id } = editionFor(req);
  res.json({ edition: editions.update(id, editionPatch.parse(req.body)) });
});

router.post('/editions/:id/publish', (req, res) => {
  res.json({ edition: editions.publish(editionFor(req).id) });
});

router.post('/editions/:id/unpublish', (req, res) => {
  res.json({ edition: editions.unpublish(editionFor(req).id) });
});

/** PDF of any edition, including unpublished drafts (editor only). */
router.get(
  '/editions/:id/pdf',
  asyncHandler(async (req, res) => {
    const edition = editionFor(req);
    const file = await draftPdf(edition);
    const name = `The-Lead-Story-Issue-${edition.issue_number}${edition.status === 'published' ? '' : '-DRAFT'}.pdf`;
    res.download(file, name, () => {
      try {
        unlinkSync(file); // drafts are never cached
      } catch {
        /* ignore */
      }
    });
  }),
);

router.delete('/editions/:id', (req, res) => {
  const edition = editionFor(req);
  const { removedImages } = editions.remove(edition.id);
  clearPdfCache(edition.slug);
  res.json({ ok: true, removedImages });
});

export default router;
