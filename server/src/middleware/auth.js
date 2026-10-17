import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getSetting, setSetting } from '../db.js';
import { getUser } from '../users.js';

export const SESSION_COOKIE = 'tls_session';

let secret = null;
function jwtSecret() {
  if (secret) return secret;
  secret = config.jwtSecret ?? getSetting('jwt_secret');
  if (!secret) {
    secret = randomBytes(48).toString('hex');
    setSetting('jwt_secret', secret);
  }
  return secret;
}

/** Signs this browser in as `user`. Changing the password or suspending the account invalidates it. */
export function issueSession(res, user) {
  const token = jwt.sign({ uid: user.id, v: user.session_version }, jwtSecret(), { expiresIn: `${config.sessionDays}d` });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProd,
    maxAge: config.sessionDays * 24 * 3600 * 1000,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/', sameSite: 'strict', secure: config.isProd, httpOnly: true });
}

/** The signed-in, active account for this request — or null. Checked against the database every time. */
export function sessionUser(req) {
  if (req.user !== undefined) return req.user;
  req.user = null;
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret());
    const user = getUser(payload.uid);
    if (user && user.status === 'active' && user.session_version === payload.v) req.user = user;
  } catch {
    /* expired or tampered */
  }
  return req.user;
}

/** Any signed-in account (owner or editor): the Editor's desk. */
export function requireUser(req, res, next) {
  if (!sessionUser(req)) return res.status(401).json({ error: 'Please sign in' });
  next();
}

/** The owner only: the Admin app. */
export function requireOwner(req, res, next) {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in' });
  if (user.role !== 'owner') return res.status(403).json({ error: 'Only the owner can do this' });
  next();
}
