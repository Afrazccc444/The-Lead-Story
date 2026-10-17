// The Admin app (owner only): analytics, publishing requests, accounts,
// every article on the site, and the introduction and terms shown to applicants.
import { Router } from 'express';
import { z } from 'zod';
import * as analytics from '../analytics.js';
import * as editions from '../editions.js';
import { requireOwner } from '../middleware/auth.js';
import * as requests from '../requests.js';
import * as users from '../users.js';
import { usernameSchema } from './auth.js';

const router = Router();
router.use(requireOwner);

const idParam = z.coerce.number().int().positive();
const text = (max) => z.string().trim().max(max).default('');

router.get('/overview', (req, res) => {
  res.json(analytics.overview(30));
});

// ── Publishing requests ──────────────────────────────────────
router.get('/requests', (req, res) => {
  const status = z.enum(['pending', 'approved', 'rejected']).nullable().catch(null).parse(req.query.status ?? null);
  res.json({ requests: requests.listRequests(status) });
});

/** Approve: create the account and return a one-time link where the publisher chooses their password. */
router.post('/requests/:id/approve', (req, res) => {
  const id = idParam.parse(req.params.id);
  const request = requests.getRequest(id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status === 'approved') return res.status(409).json({ error: 'This request was already approved.' });
  const body = z
    .object({ username: usernameSchema, display_name: text(120), organisation: text(160), owner_note: text(2000) })
    .parse(req.body);
  const { user, token } = users.createEditor({
    username: body.username,
    display_name: body.display_name || request.name,
    organisation: body.organisation || request.organisation,
    email: request.email,
    request_id: id,
  });
  requests.reviewRequest(id, { status: 'approved', owner_note: body.owner_note, user_id: user.id });
  res.status(201).json({ user: users.publicUser(user), invite: `/admin/invite/${token}` });
});

router.post('/requests/:id/reject', (req, res) => {
  const { owner_note } = z.object({ owner_note: text(2000) }).parse(req.body);
  res.json({ request: requests.reviewRequest(idParam.parse(req.params.id), { status: 'rejected', owner_note }) });
});

router.post('/requests/:id/reopen', (req, res) => {
  res.json({ request: requests.reviewRequest(idParam.parse(req.params.id), { status: 'pending' }) });
});

router.delete('/requests/:id', (req, res) => {
  requests.deleteRequest(idParam.parse(req.params.id));
  res.json({ ok: true });
});

// ── Accounts ─────────────────────────────────────────────────
router.get('/accounts', (req, res) => {
  res.json({ accounts: users.listUsers() });
});

/** Create an account directly (e.g. for someone who contacted you another way). */
router.post('/accounts', (req, res) => {
  const body = z
    .object({ username: usernameSchema, display_name: text(120), organisation: text(160), email: z.string().trim().email().or(z.literal('')).default('') })
    .parse(req.body);
  const { user, token } = users.createEditor(body);
  res.status(201).json({ user: users.publicUser(user), invite: `/admin/invite/${token}` });
});

router.patch('/accounts/:id', (req, res) => {
  const changes = z
    .object({
      display_name: z.string().trim().max(120).optional(),
      organisation: z.string().trim().max(160).optional(),
      email: z.string().trim().email().or(z.literal('')).optional(),
      logo: z.literal('').optional(), // the owner can remove an unsuitable logo
      status: z.enum(['active', 'disabled']).optional(),
    })
    .parse(req.body);
  res.json({ user: users.publicUser(users.updateUser(idParam.parse(req.params.id), changes)) });
});

/** A new one-time link: for an editor who lost their invitation or forgot their password. */
router.post('/accounts/:id/invite', (req, res) => {
  const id = idParam.parse(req.params.id);
  const user = users.getUser(id);
  if (!user) return res.status(404).json({ error: 'Account not found' });
  if (user.role === 'owner') return res.status(400).json({ error: 'Change the owner password in the Editor’s desk settings.' });
  res.json({ invite: `/admin/invite/${users.newInvite(id)}` });
});

router.delete('/accounts/:id', (req, res) => {
  users.deleteUser(idParam.parse(req.params.id), req.user.id);
  res.json({ ok: true });
});

// ── Every article on the site (review / proof-check) ─────────
router.get('/editions', (req, res) => {
  res.json({ editions: editions.listAll(null) });
});

// ── Introduction and terms shown on the public "Publish with us" page ─
const publishingSchema = z.object({
  intro: z.string().max(4000),
  terms: z.string().max(30000),
});

router.get('/publishing', (req, res) => {
  res.json({ publishing: requests.getPublishing() });
});

router.put('/publishing', (req, res) => {
  res.json({ publishing: requests.setPublishing(publishingSchema.parse(req.body)) });
});

export default router;
