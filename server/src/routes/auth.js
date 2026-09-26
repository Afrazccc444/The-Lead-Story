import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getSetting, setSetting } from '../db.js';
import { clearSession, isAuthenticated, issueSession } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
});

const passwordSchema = z.string().min(8, 'Use at least 8 characters').max(200);

/** Tells the client whether a password has been created yet, and whether this browser is signed in. */
router.get('/status', (req, res) => {
  res.json({ setupRequired: !getSetting('password_hash'), authenticated: isAuthenticated(req) });
});

/** One-time setup: create the admin password. Only works while no password exists. */
router.post(
  '/setup',
  limiter,
  asyncHandler(async (req, res) => {
    if (getSetting('password_hash')) return res.status(409).json({ error: 'A password has already been created. Please sign in.' });
    const password = passwordSchema.parse(req.body?.password);
    setSetting('password_hash', await bcrypt.hash(password, 12));
    issueSession(res);
    res.status(201).json({ ok: true });
  }),
);

router.post(
  '/login',
  limiter,
  asyncHandler(async (req, res) => {
    const hash = getSetting('password_hash');
    if (!hash) return res.status(409).json({ error: 'No password has been created yet.' });
    const password = z.string().max(200).parse(req.body?.password ?? '');
    if (!(await bcrypt.compare(password, hash))) return res.status(401).json({ error: 'Incorrect password' });
    issueSession(res);
    res.json({ ok: true });
  }),
);

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

export { passwordSchema };
export default router;
