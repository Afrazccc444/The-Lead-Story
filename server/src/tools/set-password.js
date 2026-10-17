// Sets (or resets) the owner's password from the server's terminal — for a
// fresh online server, or if the owner forgets it. Creates the owner account
// (username "admin") if there isn't one yet. Signs out the owner's old sessions.
// Usage (from the server folder):  printf '%s' 'new password' | node src/tools/set-password.js
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const password = input.replace(/\r?\n$/, '');

if (password.length < 8 || password.length > 200) {
  console.error('The password must be 8 to 200 characters long.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const owner = db.prepare(`SELECT id, username FROM users WHERE role = 'owner' ORDER BY id LIMIT 1`).get();
if (owner) {
  db.prepare(`UPDATE users SET password_hash = ?, status = 'active', session_version = session_version + 1 WHERE id = ?`).run(hash, owner.id);
  console.info(`Password saved for the owner account “${owner.username}”.`);
} else {
  db.prepare(
    `INSERT INTO users (username, display_name, role, status, password_hash, created_at) VALUES ('admin', 'Owner', 'owner', 'active', ?, ?)`,
  ).run(hash, new Date().toISOString());
  console.info('Owner account “admin” created.');
}
db.close();
