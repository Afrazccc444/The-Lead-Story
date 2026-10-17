// The owner's recovery key: a long secret code kept in a file on the server's
// own disk (never sent anywhere). It is needed to create the owner account the
// first time, and it lets the owner get back in if they ever forget their
// username or password. Only someone with access to the computer can read it.
//
// The key is used once, then replaced by a new one. If the file is deleted,
// a fresh key is created the next time the server starts.
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { getSetting, setSetting } from './db.js';

export const KEY_FILE = path.join(config.dataDir, 'OWNER-RECOVERY-KEY.txt');
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I/L)
const digest = (key) => createHash('sha256').update(normalise(key)).digest();
const normalise = (key) => String(key).toUpperCase().replace(/[^A-Z0-9]/g, '');

function newKey() {
  const groups = Array.from({ length: 6 }, () => Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''));
  return groups.join('-'); // ~147 bits of randomness
}

/** Creates and saves a new key (the old one stops working). Returns it. */
export function rotateKey() {
  const key = newKey();
  setSetting('recovery_key_hash', digest(key).toString('hex'));
  writeFileSync(
    KEY_FILE,
    [
      'THE LEAD STORY — OWNER RECOVERY KEY',
      '',
      key,
      '',
      'Use this key on the sign-in page ("Set up or recover the owner account")',
      'to create the owner account, or to choose a new username and password',
      'if you ever forget them. Each key works once; a new one is then saved here.',
      '',
      'Keep it private. Anyone with this key can take over the Admin app.',
      `Created ${new Date().toISOString()}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  return key;
}

/** On server start: make sure a key exists and its file is present. */
export function ensureKey() {
  if (!getSetting('recovery_key_hash') || !existsSync(KEY_FILE)) rotateKey();
  return KEY_FILE;
}

export function checkKey(key) {
  const saved = getSetting('recovery_key_hash');
  if (!saved || !key) return false;
  const a = digest(key);
  const b = Buffer.from(saved, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
