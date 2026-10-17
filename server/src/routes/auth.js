import path from 'node:path';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { clearSession, issueSession, requireUser, sessionUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
import * as users from '../users.js';
import * as recovery from '../recovery.js';
import { IMAGE_URL_PATTERN } from './uploads.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
});

export const passwordSchema = z.string().min(8, 'Use at least 8 characters').max(200);
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Use at least 3 characters')
  .max(40)
  .regex(/^[a-z0-9._-]+$/i, 'Use only letters, numbers, dots, dashes and underscores');

/** Whether the owner account exists yet, and who (if anyone) is signed in on this browser. */
router.get('/status', (req, res) => {
  const user = sessionUser(req);
  res.json({ setupRequired: !users.hasUsers(), authenticated: Boolean(user), user: users.publicUser(user) });
});

// Very few tries: the recovery key is long, and this keeps guessing hopeless.
const recoverLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
});

/**
 * Owner setup and recovery, protected by the recovery key from the server's
 * disk: creates the owner account on a new site, or sets a new owner username
 * and password. The key then changes, so each one works only once.
 */
router.post(
  '/recover',
  recoverLimiter,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        key: z.string().max(100),
        username: usernameSchema,
        display_name: z.string().trim().max(120).default(''),
        password: passwordSchema,
      })
      .parse(req.body);
    if (!recovery.checkKey(body.key)) {
      return res.status(401).json({ error: `That recovery key is not correct. Find the current one in ${path.basename(recovery.KEY_FILE)} on the server.` });
    }
    const user = await users.recoverOwner(body);
    recovery.rotateKey();
    issueSession(res, user);
    res.json({ user: users.publicUser(user) });
  }),
);

router.post(
  '/login',
  limiter,
  asyncHandler(async (req, res) => {
    const { username, password } = z
      .object({ username: z.string().trim().max(40), password: z.string().max(200) })
      .parse(req.body ?? {});
    const user = await users.checkLogin(username, password);
    issueSession(res, user);
    res.json({ user: users.publicUser(user) });
  }),
);

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

/** Invitation links: an approved publisher opens theirs and chooses a password. */
router.get('/invite/:token', (req, res) => {
  const user = users.getByInvite(req.params.token);
  if (!user || user.status === 'disabled') return res.status(404).json({ error: 'This link has expired or was already used.' });
  res.json({ user: { username: user.username, display_name: user.display_name, organisation: user.organisation } });
});

router.post(
  '/invite/:token',
  limiter,
  asyncHandler(async (req, res) => {
    const { password } = z.object({ password: passwordSchema }).parse(req.body);
    const user = await users.acceptInvite(req.params.token, password);
    issueSession(res, user);
    res.json({ user: users.publicUser(user) });
  }),
);

/** A publisher's own company logo (an image uploaded through the desk). */
router.put('/profile', requireUser, (req, res) => {
  const { logo } = z
    .object({ logo: z.string().regex(IMAGE_URL_PATTERN, 'Upload the logo through the Editor’s desk').or(z.literal('')) })
    .parse(req.body);
  res.json({ user: users.publicUser(users.updateUser(req.user.id, { logo })) });
});

router.post(
  '/password',
  requireUser,
  asyncHandler(async (req, res) => {
    const { current, next } = z.object({ current: z.string().max(200), next: passwordSchema }).parse(req.body);
    const user = await users.changePassword(req.user.id, current, next);
    issueSession(res, user); // other devices are signed out; this one stays in
    res.json({ ok: true });
  }),
);

export default router;
