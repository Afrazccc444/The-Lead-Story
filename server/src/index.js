import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { db } from './db.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { ensureKey } from './recovery.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import ownerRoutes from './routes/owner.js';
import publicRoutes from './routes/public.js';
import uploadRoutes, { uploadsDir, videoRouter } from './routes/uploads.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

const app = express();
app.disable('x-powered-by');
if (config.isProd) app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        // Only force https when actually deployed; on http://localhost it would break loading.
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));
// Uploaded images: file names are random and never reused, so they can be cached for a long time.
// fallthrough: false → a missing image is a real 404, not the website's index page.
app.use('/uploads', express.static(uploadsDir, { maxAge: '30d', immutable: true, index: false, fallthrough: false }));
app.use('/api/admin/images', uploadRoutes);
app.use('/api/admin/videos', videoRouter);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api', publicRoutes);
app.use('/api', notFound);

// Serve the built React app (after `npm run build`). In development Vite serves it on :5173.
if (existsSync(clientDist)) {
  // Built files have content hashes in their names, so browsers may keep them for a year.
  app.use(
    '/assets',
    express.static(path.join(clientDist, 'assets'), { maxAge: '1y', immutable: true, index: false, fallthrough: false }),
  );
  app.use(express.static(clientDist, { index: false, maxAge: '1d' }));
  app.get('*', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) =>
    res.type('text').send('The Lead Story API is running. In development, open the site at http://localhost:5173'),
  );
}

app.use(errorHandler);

const server = app.listen(config.port, config.host, () => {
  console.info(`The Lead Story server: http://localhost:${config.port}  (data: ${config.dataDir})`);
  // The owner's recovery key lives only on this computer (see recovery.js).
  console.info(`Owner recovery key: ${ensureKey()}`);
});

function shutdown() {
  server.close();
  db.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
