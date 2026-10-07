// Sets (or resets) the admin password from the server's terminal, so a fresh
// online server never sits waiting for "whoever opens /admin first".
// Usage (from the server folder):  printf '%s' 'new password' | node src/tools/set-password.js
import bcrypt from 'bcryptjs';
import { db, setSetting } from '../db.js';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const password = input.replace(/\r?\n$/, '');

if (password.length < 8 || password.length > 200) {
  console.error('The password must be 8 to 200 characters long.');
  process.exit(1);
}

setSetting('password_hash', await bcrypt.hash(password, 12));
db.close();
console.info('Admin password saved.');
