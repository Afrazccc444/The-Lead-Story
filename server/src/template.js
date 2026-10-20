// The question template: a publisher answers a list of coded questions in any
// document (Word, PDF or plain text), uploads it, and the edition is laid out
// automatically. Every question has a unique code — a letter and a number in
// square brackets, e.g. [A2] — written on the line above (or before) the answer.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/** Every question, in order, for a template with `headlines` headline sections. */
export function questions(headlines) {
  const n = Math.max(1, Math.round(headlines) || 1);
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

/** OpenDocument text (.odt, from LibreOffice / OpenOffice): one line per paragraph or heading. */
function odtText(buffer) {
  const files = unzipSync(new Uint8Array(buffer), { filter: (f) => f.name === 'content.xml' });
  const xml = files['content.xml'];
  if (!xml) throw new Error('This document has no text.');
  return decodeXml(
    strFromU8(xml)
      .replace(/<text:line-break\/>/g, '\n')
      .replace(/<text:tab\/>/g, '\t')
      .replace(/<text:s(?:\s+text:c="(\d+)")?\/>/g, (_, n) => ' '.repeat(Number(n) || 1))
      .replace(/<\/text:(p|h)>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

/** Rich Text Format (.rtf): text with paragraphs, special characters decoded. */
function rtfText(buffer) {
  let rtf = buffer.toString('latin1');
  // Drop groups that hold no readable text (fonts, colours, styles, pictures, hidden metadata).
  for (let pass = 0; pass < 6; pass++) {
    rtf = rtf.replace(/\{\\(?:\*|fonttbl|colortbl|stylesheet|info|pict|listtable|listoverridetable|rsidtbl|generator)[^{}]*\}/g, '');
  }
  return rtf
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode((Number(n) + 65536) % 65536))
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => Buffer.from([parseInt(h, 16)]).toString('latin1'))
    .replace(/\\(par|line)\b ?/g, '\n')
    .replace(/\\tab\b ?/g, '\t')
    .replace(/\\([{}\\])/g, '$1')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '');
}

/** A web page (.html): block elements become lines; tags and scripts are removed. */
function htmlText(buffer) {
  return decodeXml(
    buffer
      .toString('utf8')
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre|section|article)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' '),
  );
}

/**
 * Old Word (.doc, Word 97–2003): the text is stored as runs of characters inside
 * a binary file. Readable runs are collected in order — enough for the codes and
 * answers. (Saving as .docx is still more exact.)
 */
function docText(buffer) {
  const runs = [];
  // Word stores text either as 2-byte (UTF-16) or 1-byte (Latin) characters.
  const utf16 = buffer.toString('utf16le').match(/[\p{L}\p{N}\p{P}\p{Zs}\t\r\n|$+<>=^`~]{4,}/gu) ?? [];
  const latin = buffer.toString('latin1').match(/[\x20-\x7e\xa0-\xff\t\r\n]{4,}/g) ?? [];
  // The encoding that yields more [A2]-style codes is the one the text is in.
  const codes = (list) => list.join('\n').match(/\[\s*([A-Z]\d{1,3}|END)\s*\]/gi)?.length ?? 0;
  runs.push(...(codes(utf16) >= codes(latin) ? utf16 : latin));
  return runs.join('\n').replace(/\r/g, '\n');
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
  const start = buffer.subarray(0, 8);
  if (start.subarray(0, 4).toString('latin1') === '%PDF' || name.endsWith('.pdf')) return pdfText(buffer);
  if (start[0] === 0x50 && start[1] === 0x4b) {
    // A ZIP: Word .docx or OpenDocument .odt — look inside to tell them apart.
    const names = Object.keys(unzipSync(new Uint8Array(buffer), { filter: (f) => f.name === 'word/document.xml' || f.name === 'content.xml' }));
    return names.includes('word/document.xml') ? docxText(buffer) : odtText(buffer);
  }
  if (start.toString('hex') === 'd0cf11e0a1b11ae1' || name.endsWith('.doc')) return docText(buffer); // Word 97–2003
  const text = buffer.toString('utf8').replace(/^﻿/, '');
  if (text.startsWith('{\\rtf') || name.endsWith('.rtf')) return rtfText(buffer);
  if (/^\s*<(!doctype html|html|body|p|div)/i.test(text) || /\.html?$/.test(name)) return htmlText(buffer);
  // Text saved as UTF-16 (some Windows editors do this).
  if (start[0] === 0xff && start[1] === 0xfe) return buffer.toString('utf16le').replace(/^﻿/, '');
  return text;
}

// A code counts only at the start of a line, so a code mentioned inside a sentence is just text.
const CODE = /^[ \t]*\[\s*([A-Z]\d+|END)\s*\]/gim;

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
    if (!/^(A[1-6]|H\d+|R\d+|C[1-3]|S1)$/.test(code)) unknown.push(code);
    else if (body) answers[code] = answers[code] ? `${answers[code]}\n\n${body}` : body;
  }
  return { answers, unknown: [...new Set(unknown)] };
}

/** The template code an edition field came from — for error messages ("S1 (sources), line 2"). */
export function codeForPath(path = []) {
  const p = path.join('.');
  const fixed = {
    'content.lead_story.kicker': 'A1 (kicker)',
    'content.lead_story.headline': 'A2 (main headline)',
    'content.lead_story.subheadline': 'A3 (subheadline)',
    'content.lead_story.deck': 'A4 (deck)',
    'content.lead_story.byline': 'A5 (byline)',
    'content.lead_story.historical_context_markdown': 'C1 (historical context)',
    editor_note: "C3 (editor's note)",
  };
  if (fixed[p]) return fixed[p];
  if (p.startsWith('content.tags')) return 'A6 (tags)';
  if (p.startsWith('content.lead_story.what_to_watch')) return 'C2 (what to watch)';
  const section = /^content\.lead_story\.sections\.(\d+)\.(headline|body_markdown)/.exec(p);
  if (section) return `${section[2] === 'headline' ? 'H' : 'R'}${Number(section[1]) + 1}`;
  const src = /^content\.bibliography\.(\d+)/.exec(p);
  if (src) return `S1 (sources), line ${Number(src[1]) + 1}`;
  return p || 'the document';
}

const lines = (s = '') => s.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean);

/** One bibliography line → a source. "Author | Title | Publication | Date | Link" (missing parts are fine). */
function source(line) {
  // A link with or without https:// ("www.bbc.com/news" works too).
  const found = line.match(/https?:\/\/[^\s|]+|(?:www\.)?[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}(?:\/[^\s|]*)?/i);
  const looksLikeLink = found && (/^https?:\/\//i.test(found[0]) || /^www\./i.test(found[0]) || found[0].includes('/'));
  const raw = looksLikeLink ? found[0] : '';
  const url = raw ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).replace(/[.,;)]+$/, '') : '';
  const rest = raw ? line.replace(raw, '') : line;
  const parts = rest.split('|').map((p) => p.trim());
  while (parts.length > 1 && !parts[parts.length - 1]) parts.pop(); // the emptied link column
  const [author = '', title = '', publication = '', date = ''] = parts.length > 1 ? parts : ['', parts[0]];
  return { author, title: title || rest.trim(), publication, date, url, accessed: '' };
}

/**
 * Turns answers into edition content (on top of an empty edition).
 * Returns { content, editorNote, report } — the report says what was filled in.
 */
export function buildContent(answers, base) {
  const content = structuredClone(base);
  const lead = content.lead_story;
  const set = (code, apply) => answers[code] !== undefined && apply(answers[code]);
  set('A1', (v) => (lead.kicker = v.split('\n')[0]));
  set('A2', (v) => (lead.headline = v.replace(/\s*\n\s*/g, ' ')));
  set('A3', (v) => (lead.subheadline = v.replace(/\s*\n\s*/g, ' ')));
  set('A4', (v) => (lead.deck = v));
  set('A5', (v) => (lead.byline = v.split('\n')[0].replace(/^by\s+/i, '')));
  set('A6', (v) =>
    (content.tags = [...new Set(v.split(/[,\n;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean))]),
  );

  const numbers = [...new Set(Object.keys(answers).filter((k) => /^[HR]\d+$/.test(k)).map((k) => Number(k.slice(1))))].sort((a, b) => a - b);
  lead.sections = numbers
    .map((i) => ({ headline: (answers[`H${i}`] ?? '').replace(/\s*\n\s*/g, ' '), body_markdown: answers[`R${i}`] ?? '', media: [] }))
    .filter((s) => s.headline || s.body_markdown);

  set('C1', (v) => (lead.historical_context_markdown = v));
  set('C2', (v) => (lead.what_to_watch = lines(v)));
  set('S1', (v) => (content.bibliography = lines(v).map(source)));
  const editorNote = answers.C3 ?? '';

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
