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
`);

export function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}
