import { Router } from 'express';
import * as editions from '../editions.js';

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
  };
}

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

export default router;
