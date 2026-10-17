// Accounts: the owner (runs the Admin app) and editors (publishers the owner
// has approved). Editors set their own password through a one-time
// invitation link, so the owner never knows it.
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { HttpError } from './editions.js';

const INVITE_DAYS = 14;
const now = () => new Date().toISOString();
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
let dummyHash = null; // compared against when a username doesn't exist, so timing doesn't reveal which usernames do

/** The fields that are safe to send to a browser. */
export function publicUser(row) {
  if (!row) return null;
  const { id, username, display_name, organisation, email, logo, role, status, created_at, last_login_at } = row;
  return { id, username, display_name, organisation, email, logo, role, status, created_at, last_login_at };
}

export const getUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
export const getUserByUsername = (username) => db.prepare('SELECT * FROM users WHERE username = ?').get(username);
export const hasUsers = () => Boolean(db.prepare('SELECT 1 FROM users LIMIT 1').get());

/** Accounts with how much they have published and how often it has been read. */
export function listUsers() {
  return db
    .prepare(
      `SELECT u.*,
              (SELECT COUNT(*) FROM editions e WHERE e.user_id = u.id) AS editions,
              (SELECT COUNT(*) FROM editions e WHERE e.user_id = u.id AND e.status = 'published') AS published,
              (SELECT COALESCE(SUM(v.count), 0) FROM edition_views v JOIN editions e ON e.id = v.edition_id WHERE e.user_id = u.id) AS views
       FROM users u
       ORDER BY u.role = 'owner' DESC, u.created_at DESC`,
    )
    .all()
    .map((row) => ({ ...publicUser(row), editions: row.editions, published: row.published, views: row.views }));
}

export async function createOwner({ username, display_name, password }) {
  if (hasUsers()) throw new HttpError(409, 'The owner account already exists. Please sign in.');
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO users (username, display_name, role, status, password_hash, created_at)
       VALUES (?, ?, 'owner', 'active', ?, ?)`,
    )
    .run(username, display_name, await bcrypt.hash(password, 12), now());
  return getUser(Number(lastInsertRowid));
}

/**
 * Recovery (with the owner's recovery key): sets the owner's username and
 * password — creating the owner account on a brand-new site. Signs out every
 * old owner session.
 */
export async function recoverOwner({ username, display_name, password }) {
  const owner = db.prepare(`SELECT * FROM users WHERE role = 'owner' ORDER BY id LIMIT 1`).get();
  const clash = getUserByUsername(username);
  if (clash && clash.id !== owner?.id) throw new HttpError(409, `The username “${username}” belongs to a publisher. Choose another.`);
  if (!owner) return createOwner({ username, display_name, password });
  const hash = await bcrypt.hash(password, 12);
  db.prepare(
    `UPDATE users SET username = ?, display_name = COALESCE(NULLIF(?, ''), display_name), password_hash = ?, status = 'active',
            session_version = session_version + 1, last_login_at = ?
     WHERE id = ?`,
  ).run(username, display_name, hash, now(), owner.id);
  return getUser(owner.id);
}

/** Creates an editor account and returns it with its one-time setup token. */
export function createEditor({ username, display_name, organisation = '', email = '', request_id = null }) {
  if (getUserByUsername(username)) throw new HttpError(409, `The username “${username}” is already taken.`);
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO users (username, display_name, organisation, email, role, status, request_id, created_at)
       VALUES (?, ?, ?, ?, 'editor', 'invited', ?, ?)`,
    )
    .run(username, display_name, organisation, email, request_id, now());
  const id = Number(lastInsertRowid);
  return { user: getUser(id), token: newInvite(id) };
}

/** A fresh invitation (or password-reset) link token; any older link stops working. */
export function newInvite(id) {
  const token = randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + INVITE_DAYS * 864e5).toISOString();
  db.prepare('UPDATE users SET invite_hash = ?, invite_expires = ? WHERE id = ?').run(hashToken(token), expires, id);
  return token;
}

export function getByInvite(token) {
  const user = db.prepare('SELECT * FROM users WHERE invite_hash = ?').get(hashToken(String(token)));
  if (!user || user.invite_expires < now()) return null;
  return user;
}

/** The editor chooses their password; signs out any older sessions. */
export async function acceptInvite(token, password) {
  const user = getByInvite(token);
  if (!user) throw new HttpError(404, 'This link has expired or was already used. Ask for a new one.');
  if (user.status === 'disabled') throw new HttpError(403, 'This account is suspended.');
  db.prepare(
    `UPDATE users SET password_hash = ?, status = 'active', invite_hash = NULL, invite_expires = NULL,
            session_version = session_version + 1, last_login_at = ?
     WHERE id = ?`,
  ).run(await bcrypt.hash(password, 12), now(), user.id);
  return getUser(user.id);
}

export async function checkLogin(username, password) {
  const user = getUserByUsername(username);
  dummyHash ??= await bcrypt.hash('not-a-real-password', 12);
  const ok = await bcrypt.compare(password, user?.password_hash ?? dummyHash);
  if (!user || !user.password_hash || !ok) throw new HttpError(401, 'Incorrect username or password');
  if (user.status === 'disabled') throw new HttpError(403, 'This account is suspended. Please contact The Lead Story.');
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now(), user.id);
  return user;
}

export async function changePassword(id, current, next) {
  const user = getUser(id);
  if (!user?.password_hash || !(await bcrypt.compare(current, user.password_hash))) {
    throw new HttpError(401, 'Your current password is incorrect');
  }
  db.prepare('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?').run(
    await bcrypt.hash(next, 12),
    id,
  );
  return getUser(id);
}

export function updateUser(id, changes) {
  const user = getUser(id);
  if (!user) throw new HttpError(404, 'Account not found');
  if (user.role === 'owner' && changes.status === 'disabled') throw new HttpError(400, 'The owner account cannot be suspended.');
  const next = { ...user, ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) };
  // Suspending an account signs it out everywhere at once.
  const bump = changes.status === 'disabled' && user.status !== 'disabled' ? 1 : 0;
  // A reactivated editor who never set a password goes back to "invited".
  if (next.status === 'active' && !user.password_hash) next.status = 'invited';
  db.prepare(
    `UPDATE users SET display_name = ?, organisation = ?, email = ?, logo = ?, status = ?,
            session_version = session_version + ?
     WHERE id = ?`,
  ).run(next.display_name, next.organisation, next.email, next.logo, next.status, bump, id);
  return getUser(id);
}

/** Deletes an editor. Their articles are kept and handed to the owner. */
export function deleteUser(id, ownerId) {
  const user = getUser(id);
  if (!user) throw new HttpError(404, 'Account not found');
  if (user.role === 'owner') throw new HttpError(400, 'The owner account cannot be deleted.');
  db.prepare('UPDATE editions SET user_id = ? WHERE user_id = ?').run(ownerId, id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}
