// SQLite database using Node's built-in driver: no installation or account needed.
// The whole newsletter lives in one file: <DATA_DIR>/lead-story.db
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

mkdirSync(config.dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(config.dataDir, 'lead-story.db'));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS editions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_number     INTEGER NOT NULL UNIQUE,
    slug             TEXT    NOT NULL UNIQUE,
    status           TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    publication_date TEXT,
    lead_headline    TEXT    NOT NULL DEFAULT '',
    subheadline      TEXT    NOT NULL DEFAULT '',
    editor_note      TEXT    NOT NULL DEFAULT '',
    content          TEXT    NOT NULL DEFAULT '{}',
    created_at       TEXT    NOT NULL,
    updated_at       TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS editions_published_idx ON editions (status, publication_date DESC);

  -- Reader poll votes: one vote per browser per edition (voter = random cookie id).
  CREATE TABLE IF NOT EXISTS poll_votes (
    edition_id INTEGER NOT NULL,
    option     INTEGER NOT NULL,
    voter      TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    PRIMARY KEY (edition_id, voter)
  );

  -- Accounts. The owner runs the Admin app; editors (publishers the owner has
  -- approved) write in the Editor's desk. Editors choose their own password
  -- through a one-time invitation link (invite_hash = SHA-256 of the token).
  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    display_name    TEXT    NOT NULL DEFAULT '',
    organisation    TEXT    NOT NULL DEFAULT '',
    email           TEXT    NOT NULL DEFAULT '',
    plan            TEXT    NOT NULL DEFAULT '',
    role            TEXT    NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor')),
    status          TEXT    NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
    password_hash   TEXT,
    invite_hash     TEXT,
    invite_expires  TEXT,
    session_version INTEGER NOT NULL DEFAULT 1,
    request_id      INTEGER,
    created_at      TEXT    NOT NULL,
    last_login_at   TEXT
  );

  -- "Publish with us" requests sent from the public site.
  CREATE TABLE IF NOT EXISTS access_requests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    email        TEXT    NOT NULL,
    organisation TEXT    NOT NULL DEFAULT '',
    website      TEXT    NOT NULL DEFAULT '',
    phone        TEXT    NOT NULL DEFAULT '',
    country      TEXT    NOT NULL DEFAULT '',
    plan         TEXT    NOT NULL DEFAULT '',
    message      TEXT    NOT NULL DEFAULT '',
    agreed_at    TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    owner_note   TEXT    NOT NULL DEFAULT '',
    user_id      INTEGER,
    created_at   TEXT    NOT NULL,
    reviewed_at  TEXT
  );

  -- Reader analytics: one counter per edition, per day, per kind (read / video).
  CREATE TABLE IF NOT EXISTS edition_views (
    edition_id INTEGER NOT NULL,
    day        TEXT    NOT NULL,
    kind       TEXT    NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (edition_id, day, kind)
  );
`);

export function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}

/* ── Upgrades for databases created by earlier versions ───────── */
// Every edition now belongs to an account.
const hasColumn = (table, column) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
if (!hasColumn('editions', 'user_id')) db.exec('ALTER TABLE editions ADD COLUMN user_id INTEGER');
// A publisher's company logo, shown as a badge under each of their articles.
if (!hasColumn('users', 'logo')) db.exec("ALTER TABLE users ADD COLUMN logo TEXT NOT NULL DEFAULT ''");
// "About you" on publishing requests.
if (!hasColumn('access_requests', 'about')) db.exec("ALTER TABLE access_requests ADD COLUMN about TEXT NOT NULL DEFAULT ''");
// The old single admin password becomes the owner account (username "admin").
const legacyHash = getSetting('password_hash');
if (legacyHash && !db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  db.prepare(
    `INSERT INTO users (username, display_name, role, status, password_hash, created_at)
     VALUES ('admin', 'Owner', 'owner', 'active', ?, ?)`,
  ).run(legacyHash, new Date().toISOString());
}
// Editions without an account belong to the owner.
const owner = db.prepare(`SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1`).get();
if (owner) db.prepare('UPDATE editions SET user_id = ? WHERE user_id IS NULL').run(owner.id);
