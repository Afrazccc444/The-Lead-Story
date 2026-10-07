import { ZodError } from 'zod';
import { HttpError } from '../editions.js';

/** Wrap async route handlers so errors reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Some fields are not valid',
      details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  if (err?.status === 404 || err?.statusCode === 404) return res.status(404).json({ error: 'Not found' }); // e.g. missing image
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Too large — images can be up to 12 MB' });
  console.error('[api] unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
}
