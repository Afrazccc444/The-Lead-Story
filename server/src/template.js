// The question template: a publisher answers a list of coded questions in any
// document (Word, PDF or plain text), uploads it, and the edition is laid out
// automatically. Every question has a unique code — a letter and a number in
// square brackets, e.g. [A2] — written on the line above (or before) the answer.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export const MAX_HEADLINES = 20;

/** Every question, in order, for a template with `headlines` headline sections. */
export function questions(headlines) {
  const n = Math.min(Math.max(1, Math.round(headlines) || 1), MAX_HEADLINES);
  const list = [
    { section: 'A — ABOUT THE EDITION' },
    { code: 'A1', label: 'Kicker: a short topic label shown above the headline (e.g. "Middle East diplomacy")' },
    { code: 'A2', label: 'Main headline of the edition', required: true },
    { code: 'A3', label: 'Subheadline: one line that adds to the headline' },
    { code: 'A4', label: 'Deck: one or two sentences summarising the whole story' },
    { code: 'A5', label: 'Byline: the author name(s)' },
    { code: 'A6', label: 'Tags, separated by commas (e.g. diplomacy, conflict, economy)' },
    { section: 'B — YOUR HEADLINES AND THEIR RESPONSES' },
  ];
  for (let i = 1; i <= n; i++) {
    list.push({ code: `H${i}`, label: `Headline ${i}: the title of this part of the story` });
    list.push({ code: `R${i}`, label: `Response for Headline ${i}: the full report — as many paragraphs as you need` });
  }
  list.push(
    { section: 'C — EXTRAS (optional — leave empty or delete)' },
    { code: 'C1', label: 'Historical context: background that helps readers understand the story' },
    { code: 'C2', label: 'What to watch: upcoming events — one per line' },
    { code: 'C3', label: "Editor's note: a short personal note to readers" },
    { section: 'S — SOURCES / BIBLIOGRAPHY (after the last response)' },
    { code: 'S1', label: 'Sources — one per line: Author | Title | Publication | Date | Link' },
  );
  return list;
}

const INSTRUCTIONS = (n) => [
  'THE LEAD STORY — EDITION TEMPLATE',
  `For an edition with ${n} headline${n === 1 ? '' : 's'}.`,
  '',
  'HOW TO USE THIS TEMPLATE',
  '1. Every question has a code: a letter and a number in square brackets (for example A2 or R1, written with brackets).',
  '2. Write each answer directly UNDER its code. You can answer in this document, or in a new one — just copy the code (with its brackets) onto its own line, then write the answer under it.',
  '3. An answer ends where the next code begins. Paragraphs (empty lines) are kept.',
  '4. Lines starting with ## are guidance only and are ignored. The text after a code that starts with "—" is the question, and is ignored too.',
  '5. After the last response, the S1 code starts your sources (bibliography).',
  '6. The END code at the bottom marks the end of the document — keep it last.',
  '7. Save as Word (.docx), PDF or plain text, then upload it in the Editor’s desk.',
  '   Photos and videos are added afterwards in the editor.',
  '',
];

/** The template as plain text (also the source of the Word version). */
export function templateText(headlines) {
  const qs = questions(headlines);
  const n = qs.filter((q) => q.code?.startsWith('H')).length;
  const lines = [...INSTRUCTIONS(n)];
  for (const q of qs) {
    if (q.section) {
      lines.push('', `## ${q.section}`, '');
      continue;
    }
    lines.push(`[${q.code}] — ${q.label}${q.required ? ' (REQUIRED)' : ''}`, '', '');
  }
  lines.push('[END]', '');
  return lines.join('\n');
}

/* ── Word (.docx) version ─────────────────────────────────────── */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function paragraph(text, { bold = false, size = 22, color = null, shade = null } = {}) {
  const runProps = `${bold ? '<w:b/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}<w:sz w:val="${size}"/>`;
  const paraProps = shade ? `<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="${shade}"/><w:spacing w:before="160" w:after="60"/></w:pPr>` : '';
  return `<w:p>${paraProps}<w:r><w:rPr>${runProps}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

export function templateDocx(headlines) {
  const body = templateText(headlines)
    .split('\n')
    .map((line, i) => {
      if (i === 0) return paragraph(line, { bold: true, size: 32, color: '8B0000' });
      if (line.startsWith('## ')) return paragraph(line, { bold: true, size: 24, color: '444444' });
      if (/^\[[A-Z]\d+\]|^\[END\]/.test(line)) return paragraph(line, { bold: true, color: '8B0000', shade: 'F4E9E6' });
      return paragraph(line);
    })
    .join('');
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  };
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))));
}

/* ── Reading an answered template ─────────────────────────────── */
const decodeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');

/** Plain text of a Word document: one line per paragraph. */
function docxText(buffer) {
  const files = unzipSync(new Uint8Array(buffer), { filter: (f) => f.name === 'word/document.xml' });
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('This Word file has no document text.');
  // In each paragraph, keep the text runs, tabs and line breaks — in order.
  const piece = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br[^>]*\/>/g;
  return strFromU8(xml)
    .split(/<\/w:p>/)
    .map((p) =>
      decodeXml(
        [...p.matchAll(piece)].map((m) => (m[1] !== undefined ? m[1] : m[0].startsWith('<w:tab') ? '\t' : '\n')).join(''),
      ),
    )
    .join('\n');
}

async function pdfText(buffer) {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

/** Text of an uploaded file, whatever its format. */
export async function extractText(buffer, fileName = '') {
  const name = fileName.toLowerCase();
  if (buffer.subarray(0, 4).toString('latin1') === '%PDF' || name.endsWith('.pdf')) return pdfText(buffer);
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) return docxText(buffer); // a ZIP: Word .docx
  if (name.endsWith('.doc')) throw new Error('Old Word (.doc) files are not supported — please save as .docx, PDF or text.');
  return buffer.toString('utf8').replace(/^﻿/, '');
}

// A code counts only at the start of a line, so a code mentioned inside a sentence is just text.
const CODE = /^[ \t]*\[\s*([A-Z]\d{1,2}|END)\s*\]/gim;

/** Splits text into { CODE: answer } using the [X1] markers. Text before the first code is ignored. */
export function readAnswers(text) {
  const clean = text.replace(/\r\n?/g, '\n').replace(/ /g, ' ');
  const marks = [...clean.matchAll(CODE)];
  const answers = {};
  const unknown = [];
  for (let i = 0; i < marks.length; i++) {
    const code = marks[i][1].toUpperCase();
    if (code === 'END') break;
    const start = marks[i].index + marks[i][0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : clean.length;
    let body = clean.slice(start, end);
    // Same-line text starting with a dash is the question itself (from the template).
    body = body.replace(/^[ \t]*[—–-][^\n]*/, '');
    body = body
      .split('\n')
      .filter((line) => !line.trim().startsWith('##'))
      .join('\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!/^(A[1-6]|H\d{1,2}|R\d{1,2}|C[1-3]|S1)$/.test(code)) unknown.push(code);
    else if (body) answers[code] = answers[code] ? `${answers[code]}\n\n${body}` : body;
  }
  return { answers, unknown: [...new Set(unknown)] };
}

const lines = (s = '') => s.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean);

/** One bibliography line → a source. "Author | Title | Publication | Date | Link" (missing parts are fine). */
function source(line) {
  const url = line.match(/https?:\/\/[^\s|]+/i)?.[0] ?? '';
  const parts = line.replace(url, '').split('|').map((p) => p.trim());
  const [author = '', title = '', publication = '', date = ''] = parts.length > 1 ? parts : ['', parts[0]];
  return { author, title: title || line.replace(url, '').trim(), publication, date, url: url.replace(/[.,;)]+$/, ''), accessed: '' };
}

/**
 * Turns answers into edition content (on top of an empty edition).
 * Returns { content, editorNote, report } — the report says what was filled in.
 */
export function buildContent(answers, base) {
  const content = structuredClone(base);
  const lead = content.lead_story;
  const set = (code, apply) => answers[code] !== undefined && apply(answers[code]);
  set('A1', (v) => (lead.kicker = v.split('\n')[0].slice(0, 200)));
  set('A2', (v) => (lead.headline = v.replace(/\s*\n\s*/g, ' ').slice(0, 300)));
  set('A3', (v) => (lead.subheadline = v.replace(/\s*\n\s*/g, ' ').slice(0, 500)));
  set('A4', (v) => (lead.deck = v.slice(0, 1000)));
  set('A5', (v) => (lead.byline = v.split('\n')[0].replace(/^by\s+/i, '').slice(0, 200)));
  set('A6', (v) =>
    (content.tags = [...new Set(v.split(/[,\n;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8).map((t) => t.slice(0, 40))),
  );

  const numbers = [...new Set(Object.keys(answers).filter((k) => /^[HR]\d+$/.test(k)).map((k) => Number(k.slice(1))))].sort((a, b) => a - b);
  lead.sections = numbers
    .map((i) => ({ headline: (answers[`H${i}`] ?? '').replace(/\s*\n\s*/g, ' ').slice(0, 300), body_markdown: (answers[`R${i}`] ?? '').slice(0, 20000), media: [] }))
    .filter((s) => s.headline || s.body_markdown)
    .slice(0, 30);

  set('C1', (v) => (lead.historical_context_markdown = v.slice(0, 20000)));
  set('C2', (v) => (lead.what_to_watch = lines(v).slice(0, 12).map((l) => l.slice(0, 500))));
  set('S1', (v) => (content.bibliography = lines(v).slice(0, 100).map(source)));
  const editorNote = (answers.C3 ?? '').slice(0, 8000);

  const missing = [];
  if (!lead.headline) missing.push('A2 (main headline)');
  for (const i of numbers) {
    if (!answers[`H${i}`]) missing.push(`H${i} (headline ${i})`);
    if (!answers[`R${i}`]) missing.push(`R${i} (response ${i})`);
  }
  return {
    content,
    editorNote,
    report: {
      filled: Object.keys(answers).sort(),
      headlines: lead.sections.length,
      sources: content.bibliography.length,
      missing,
    },
  };
}
