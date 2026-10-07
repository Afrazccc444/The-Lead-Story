// Daily backup: a consistent copy of the database plus the uploaded photos and
// videos, kept for 14 days in <DATA_DIR>/backups/<date>/.
// Photos are hard-linked, not copied, so backups take almost no extra space —
// and a photo deleted from the site stays recoverable from the backup.
// Usage (from the server folder):  node src/tools/backup.js
import { existsSync, linkSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db.js';

const KEEP_DAYS = 14;
const root = path.join(config.dataDir, 'backups');
const stamp = new Date().toISOString().slice(0, 10);
const target = path.join(root, stamp);

rmSync(target, { recursive: true, force: true }); // re-running on the same day replaces that day's copy
mkdirSync(path.join(target, 'uploads'), { recursive: true });

db.exec(`VACUUM INTO '${path.join(target, 'lead-story.db').replaceAll("'", "''")}'`);
db.close();

const uploads = path.join(config.dataDir, 'uploads');
if (existsSync(uploads)) {
  for (const name of readdirSync(uploads)) {
    const file = path.join(uploads, name);
    if (statSync(file).isFile()) linkSync(file, path.join(target, 'uploads', name));
  }
}

const cutoff = Date.now() - KEEP_DAYS * 864e5;
for (const name of readdirSync(root)) {
  const day = Date.parse(name);
  if (Number.isFinite(day) && day < cutoff) rmSync(path.join(root, name), { recursive: true, force: true });
}

console.info(`Backup saved to ${target}`);
