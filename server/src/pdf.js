// Turns an edition into a PDF by printing the site's dedicated print layout
// (/print/:slug) with a headless copy of Edge or Chrome that is already
// installed on the computer — no extra downloads needed.
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { HttpError } from './editions.js';

const cacheDir = path.join(config.dataDir, 'pdf-cache');
const profileDir = path.join(config.dataDir, 'pdf-browser-profile');

const CANDIDATES = [
  process.env.PDF_BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
].filter(Boolean);

let browserPath;
export function findBrowser() {
  if (browserPath === undefined) browserPath = CANDIDATES.find((p) => existsSync(p)) ?? null;
  return browserPath;
}

const builtIndex = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist/index.html');

/** Changes every time the website is rebuilt (so PDFs pick up design changes). */
function buildStamp() {
  try {
    return String(statSync(builtIndex).mtimeMs);
  } catch {
    return 'no-build';
  }
}

const inFlight = new Map(); // one render per edition version at a time

function render(url, outFile) {
  return new Promise((resolve, reject) => {
    execFile(
      findBrowser(),
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--no-pdf-header-footer', // our own running headers/page numbers are in the print CSS
        `--user-data-dir=${profileDir}`, // separate profile: never touches the user's own browser
        '--virtual-time-budget=15000', // let fonts and images finish loading
        `--print-to-pdf=${outFile}`,
        url,
      ],
      { timeout: 60000, windowsHide: true },
      (error) => {
        if (existsSync(outFile) && statSync(outFile).size > 1000) resolve(outFile);
        else reject(error ?? new Error('The browser did not produce a PDF'));
      },
    );
  });
}

/**
 * Returns the path of a PDF for this (published) edition, generating it the
 * first time and re-using it until the edition is edited again.
 */
export async function editionPdf(edition, siteHost = '') {
  if (!findBrowser()) {
    throw new HttpError(503, 'PDF export needs Microsoft Edge or Google Chrome installed on the server.');
  }
  mkdirSync(cacheDir, { recursive: true });
  // The address readers use (e.g. "localhost:4000" or your domain), printed as "Read online at …".
  const site = /^[\w.-]+(:\d{1,5})?$/.test(siteHost) ? siteHost : '';
  // Re-make the PDF when the edition changes OR the site's design is rebuilt.
  const version = createHash('sha1')
    .update(`${edition.updated_at}|${edition.publication_date}|${site}|${buildStamp()}`)
    .digest('hex')
    .slice(0, 10);
  const file = path.join(cacheDir, `${edition.slug}-${version}.pdf`);
  if (existsSync(file)) return file;

  if (!inFlight.has(file)) {
    const url = `http://127.0.0.1:${config.port}/print/${edition.slug}${site ? `?site=${encodeURIComponent(site)}` : ''}`;
    const job = render(url, file)
      .then((result) => {
        // Remove older versions of this edition's PDF.
        for (const old of readdirSync(cacheDir)) {
          if (old.startsWith(`${edition.slug}-`) && path.join(cacheDir, old) !== file) {
            try {
              unlinkSync(path.join(cacheDir, old));
            } catch {
              /* ignore */
            }
          }
        }
        return result;
      })
      .finally(() => inFlight.delete(file));
    inFlight.set(file, job);
  }
  try {
    return await inFlight.get(file);
  } catch (err) {
    console.error('[pdf] generation failed:', err.message);
    throw new HttpError(500, 'The PDF could not be created. Please try again.');
  }
}

// ── Drafts ─────────────────────────────────────────────────────
// The headless browser cannot sign in, so a draft is printed through a
// short-lived, random one-time "print pass" that only reveals that one draft.
const printPasses = new Map(); // token → { editionId, expires }
const PASS_TTL_MS = 2 * 60 * 1000;

export function editionIdForPass(token) {
  const pass = printPasses.get(token);
  if (!pass || pass.expires < Date.now()) {
    printPasses.delete(token);
    return null;
  }
  return pass.editionId;
}

/** Render a draft (or any edition) for a signed-in editor. Returns a temp file path to send and delete. */
export async function draftPdf(edition) {
  if (!findBrowser()) {
    throw new HttpError(503, 'PDF export needs Microsoft Edge or Google Chrome installed on the server.');
  }
  mkdirSync(cacheDir, { recursive: true });
  const token = randomBytes(24).toString('hex');
  printPasses.set(token, { editionId: edition.id, expires: Date.now() + PASS_TTL_MS });
  const file = path.join(cacheDir, `draft-${edition.id}-${token.slice(0, 8)}.pdf`);
  try {
    return await render(`http://127.0.0.1:${config.port}/print/draft/${token}`, file);
  } catch (err) {
    console.error('[pdf] draft generation failed:', err.message);
    throw new HttpError(500, 'The PDF could not be created. Please try again.');
  } finally {
    printPasses.delete(token);
  }
}

/** Remove cached PDFs for an edition (after it is edited, unpublished or deleted). */
export function clearPdfCache(slug) {
  if (!existsSync(cacheDir)) return;
  for (const f of readdirSync(cacheDir)) {
    if (!slug || f.startsWith(`${slug}-`)) {
      try {
        unlinkSync(path.join(cacheDir, f));
      } catch {
        /* ignore */
      }
    }
  }
}
