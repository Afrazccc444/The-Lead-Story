import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function int(value, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

const env = process.env.NODE_ENV ?? 'development';

export const config = {
  env,
  isProd: env === 'production',
  port: int(process.env.PORT, 4000),
  dataDir: path.resolve(process.env.DATA_DIR || path.join(here, '..', 'data')),
  jwtSecret: process.env.JWT_SECRET || null, // falls back to a generated secret stored in the database
  sessionDays: int(process.env.SESSION_DAYS, 30),
};
