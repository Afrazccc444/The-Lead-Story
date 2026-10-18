import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, statfsSync, writeFileSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import path from 'node:path';
import express, { Router } from 'express';
import { config } from '../config.js';
import { requireUser } from '../middleware/auth.js';

export const uploadsDir = path.join(config.dataDir, 'uploads');
mkdirSync(uploadsDir, { recursive: true });

/** Public image URLs always look like /uploads/<uuid>.<ext>. */
export const IMAGE_URL_PATTERN = /^\/uploads\/[a-f0-9-]{36}\.(jpg|png|gif|webp)$/;

/** Identify the image type from its first bytes (never trust the file name). SVG is refused on purpose. */
function detectType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'png';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

const router = Router();

/** POST /api/admin/images — body is the raw image file. Returns { url }. */
router.post(
  '/',
  requireUser,
  express.raw({ type: 'image/*', limit: '12mb' }),
  (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'No image received.' });
    }
    const ext = detectType(req.body);
    if (!ext) return res.status(415).json({ error: 'Please upload a JPG, PNG, GIF or WebP image.' });
    const name = `${randomUUID()}.${ext}`;
    writeFileSync(path.join(uploadsDir, name), req.body);
    res.status(201).json({ url: `/uploads/${name}` });
  },
);

// ── Video clips (used only by the video reports) ──────────────
export const VIDEO_URL_PATTERN = /^\/uploads\/[a-f0-9-]{36}\.(mp4|webm|mov)$/;
// No size limit for videos: the only limit is the free space on the server's disk.
const GB = (bytes) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

/** Free space on the disk the videos are saved to. */
function uploadBudget() {
  try {
    const disk = statfsSync(uploadsDir);
    return disk.bavail * disk.bsize;
  } catch {
    return Infinity; // cannot measure (unusual system): don't block uploads
  }
}
const noSpace = (budget) =>
  `This video is larger than the free space left on the server (${GB(Math.max(0, budget))}). Ask the site owner to free up space, then try again.`;

/** Identify the video type from its first bytes. */
function detectVideo(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  if (buf.toString('ascii', 4, 8) === 'ftyp') return buf.toString('ascii', 8, 10) === 'qt' ? 'mov' : 'mp4';
  return null;
}

/**
 * POST /api/admin/videos — body is the raw video file. Streamed straight to
 * disk (never held in memory), checked by its first bytes. Any size that fits
 * on the server's disk.
 */
export const videoRouter = Router();
videoRouter.post('/', requireUser, (req, res) => {
  const declared = Number(req.get('content-length') || 0);
  let budget = uploadBudget();
  if (declared > budget) return res.status(507).json({ error: noSpace(budget) });

  const tmp = path.join(uploadsDir, `upload-${randomUUID()}.part`);
  const out = createWriteStream(tmp);
  let size = 0;
  let head = Buffer.alloc(0);
  let failed = false;
  const fail = (status, error) => {
    if (failed) return;
    failed = true;
    req.unpipe(out);
    out.destroy();
    rm(tmp, { force: true }).catch(() => {});
    if (!res.headersSent) res.status(status).json({ error });
  };

  let nextCheck = 256 * 1024 ** 2;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (head.length < 16) head = Buffer.concat([head, chunk]).subarray(0, 16);
    // Re-measure the disk every 256 MB (other uploads may be running at the same time).
    if (size >= nextCheck) {
      budget = uploadBudget() + size;
      nextCheck += 256 * 1024 ** 2;
    }
    if (size > budget) fail(507, noSpace(budget - size));
  });
  req.on('aborted', () => fail(400, 'Upload was cancelled.'));
  out.on('error', (err) => {
    // Disk full: the partial file is deleted at once, so the site keeps running.
    if (err.code === 'ENOSPC') return fail(507, 'The server’s disk is full, so the video could not be saved. Ask the site owner to free up space.');
    console.error('[upload] video could not be saved', err);
    fail(500, 'The video could not be saved.');
  });
  out.on('finish', async () => {
    if (failed) return;
    const ext = detectVideo(head);
    if (!size || !ext) return fail(415, 'Please upload an MP4, WebM or MOV video.');
    const name = `${randomUUID()}.${ext}`;
    try {
      await rename(tmp, path.join(uploadsDir, name));
      res.status(201).json({ url: `/uploads/${name}`, size });
    } catch (err) {
      fail(500, 'The video could not be saved.');
    }
  });
  req.pipe(out);
});

export default router;
