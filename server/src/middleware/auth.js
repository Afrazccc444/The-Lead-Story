import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getSetting, setSetting } from '../db.js';

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

/** Changing the password rotates this value, which signs out every old session. */
function sessionVersion() {
  return getSetting('session_version') ?? '1';
}

export function rotateSessions() {
  setSetting('session_version', String(Number(sessionVersion()) + 1));
}

export function issueSession(res) {
  const token = jwt.sign({ role: 'admin', v: sessionVersion() }, jwtSecret(), { expiresIn: `${config.sessionDays}d` });
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

export function isAuthenticated(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return false;
  try {
    const payload = jwt.verify(token, jwtSecret());
    return payload.role === 'admin' && payload.v === sessionVersion();
  } catch {
    return false;
  }
}

export function requireAdmin(req, res, next) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Please sign in' });
  next();
}
