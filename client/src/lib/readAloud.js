// Turns an edition into a spoken "broadcast script" and picks the most
// natural-sounding voice the browser offers (Edge's "Natural" neural voices,
// Google's voices in Chrome, Apple's Enhanced/Premium voices on Mac/iPhone).
import { formatLongDate, REGION_LABELS } from './format.js';

const SPOKEN_REGIONS = {
  americas: 'In the Americas.',
  emea: 'In Europe, the Middle East and Africa.',
  apac: 'In Asia and the Pacific.',
  global_south: 'And across the Global South.',
};

/** Markdown / pasted text → clean, speakable prose. */
export function speakable(text = '') {
  return String(text)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]+)\]\((?:https?:|mailto:)[^)]*\)/g, '$1') // links → their words
    .replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '') // citation numbers [1] [2, 3]
    .replace(/https?:\/\/\S+|www\.\S+/g, '') // bare web addresses
    .replace(/(^|\s)\+\d+\b/g, '$1') // leftover "+4" from pasted sources
    .replace(/[*_`#>|]+/g, '') // formatting symbols
    .replace(/\s+[–—]\s+/g, ', ') // spaced dashes read as a natural pause
    .replace(/(\d)\s?[–—]\s?(\d)/g, '$1 to $2') // 2022–2026 → "2022 to 2026"
    .replace(/(\w)[–—](\w)/g, '$1 $2') // US–Canada → "US Canada"
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split long text into sentence-sized pieces (browsers stall on very long utterances). */
export function sentences(text, max = 230) {
  // Split only where a sentence really ends (punctuation + space + new sentence),
  // so "C$27.6 billion" or "U.S." never get cut in half.
  const parts = text.split(/(?<=[.!?]["”’)]*)\s+(?=["“‘(]?[A-Z0-9])/);
  const out = [];
  let current = '';
  for (const raw of parts) {
    const s = raw.trim();
    if (!s) continue;
    if ((current + ' ' + s).trim().length > max && current) {
      out.push(current);
      current = s;
    } else {
      current = `${current} ${s}`.trim();
    }
  }
  if (current) out.push(current);
  return out;
}

/** Lines that look like section titles ("2. Handshakes, Sea Bass…", "## Subheading"). */
function isHeadingLine(line) {
  // A heading may end in "?" or "!" ("4. Can Kyiv Keep the Lights On?") but not a full stop.
  return /^#{1,6}\s/.test(line) || (/^\d+\.\s+\S/.test(line) && line.length < 100 && !/\.$/.test(line.trim()));
}

/**
 * Build the spoken script. Each item: { section, text, pause } where pause
 * is the silence (ms) after it — longer after headings and sections.
 */
export function buildScript(edition) {
  const c = edition.content ?? {};
  const lead = c.lead_story ?? {};
  const items = [];
  const say = (section, text, pause = 380) => {
    let clean = speakable(text);
    if (!clean) return;
    // A closing full stop makes the voice land the line and breathe before the next.
    if (!/[.!?:;]["”’)]*$/.test(clean)) clean += '.';
    const pieces = sentences(clean);
    pieces.forEach((piece, i) => items.push({ section, text: piece, pause: i === pieces.length - 1 ? pause : 120 }));
  };
  const prose = (section, markdown) => {
    for (const block of String(markdown ?? '').split(/\n\s*\n/)) {
      for (const line of block.split('\n').filter((l) => l.trim())) {
        if (isHeadingLine(line.trim())) say(section, line.replace(/^#{1,6}\s+|^\d+\.\s+/, ''), 700);
      }
      const body = block
        .split('\n')
        .filter((l) => l.trim() && !isHeadingLine(l.trim()))
        .join(' ');
      say(section, body, 520);
    }
  };

  const date = edition.publication_date ? formatLongDate(edition.publication_date) : '';
  say('Opening', `This is The Lead Story, your weekly briefing on global politics. Issue ${edition.issue_number}${date ? `, ${date}` : ''}.`, 900);

  if (lead.headline) {
    say('The Lead Story', `Our lead story. ${lead.headline}.`, 500);
    if (lead.subheadline) say('The Lead Story', lead.subheadline, 400);
    if (lead.deck) say('The Lead Story', lead.deck, 400);
    if (lead.byline) say('The Lead Story', `Reporting by ${lead.byline}.`, 800);
    prose('The Lead Story', lead.body_markdown);
  }

  if (lead.historical_context_markdown) {
    say('Historical context', 'Some historical context.', 450);
    prose('Historical context', lead.historical_context_markdown);
  }

  const watch = (lead.what_to_watch ?? []).filter((w) => w.trim());
  if (watch.length) {
    say('What to watch', 'What to watch in the days ahead.', 450);
    watch.forEach((w) => say('What to watch', w, 450));
  }

  const regions = Object.keys(SPOKEN_REGIONS).filter((k) => c.global_briefing?.[k]?.some((i) => i.headline || i.summary));
  if (regions.length) {
    say('Around the World', 'Now, around the world.', 800);
    for (const key of regions) {
      say(REGION_LABELS[key], SPOKEN_REGIONS[key], 450);
      for (const item of c.global_briefing[key]) {
        if (item.headline) say(REGION_LABELS[key], `${item.headline}.`, 350);
        if (item.summary) say(REGION_LABELS[key], item.summary, 600);
      }
    }
  }

  for (const f of c.features ?? []) {
    const blocks = (f.blocks ?? []).filter((b) => b.title || b.body_markdown);
    if (!blocks.length) continue;
    const name = f.title || 'Features';
    if (f.title) say(name, `${f.title}.`, 700);
    for (const b of blocks) {
      if (b.title) say(name, `${b.title}.`, 400);
      prose(name, b.body_markdown);
    }
  }

  const trends = (c.data_trends ?? []).filter((t) => t.title);
  if (trends.length) {
    say('Data & Trends', 'The numbers behind the week.', 600);
    for (const t of trends) {
      say('Data & Trends', `${t.title}.`, 350);
      const unit = t.unit === '%' ? ' percent' : t.unit ? ` ${t.unit}` : '';
      if (t.chart_type === 'bar' && t.data_points?.length) {
        say('Data & Trends', t.data_points.map((p) => `${p.label}, ${p.value}${unit}`).join('; ') + '.', 400);
      }
      if (t.caption) say('Data & Trends', t.caption, 600);
    }
  }

  if (edition.editor_note?.trim()) {
    say('The Editor’s Note', 'And finally, a note from the editor.', 700);
    prose('The Editor’s Note', edition.editor_note);
  }

  say('Closing', 'That’s The Lead Story for this week. Thank you for listening.', 0);
  return items;
}

/** Rank voices: natural/neural English voices first, British English preferred. */
export function rankVoices(voices) {
  const score = (v) => {
    const name = v.name.toLowerCase();
    if (!/^en(-|_|$)/i.test(v.lang)) return -1000;
    let s = 0;
    if (name.includes('natural')) s += 100;
    if (name.includes('neural')) s += 90;
    if (name.includes('premium') || name.includes('enhanced')) s += 70;
    if (name.includes('online')) s += 30;
    if (name.includes('google')) s += 40;
    if (/^en[-_]gb/i.test(v.lang)) s += 20;
    else if (/^en[-_]us/i.test(v.lang)) s += 12;
    else s += 6;
    if (/(desktop|espeak|robot|novelty|bad news|bells|bubbles|cellos|whisper|zarvox|trinoids|albert)/.test(name)) s -= 200;
    return s;
  };
  return voices.filter((v) => score(v) > -1000).sort((a, b) => score(b) - score(a));
}

/** A friendlier label: "Microsoft Sonia Online (Natural) - English (United Kingdom)" → "Sonia (UK)". */
export function voiceLabel(v) {
  const short = v.name
    .replace(/^(Microsoft|Google|Apple)\s+/i, '')
    .replace(/\s*Online\s*/i, ' ')
    .replace(/\s*\((Natural|Enhanced|Premium)\)/i, '')
    .replace(/\s*-\s*English.*$/i, '')
    .trim();
  const region = /gb/i.test(v.lang) ? 'UK' : /us/i.test(v.lang) ? 'US' : /au/i.test(v.lang) ? 'AU' : /in/i.test(v.lang) ? 'IN' : v.lang;
  const quality = /natural|neural|premium|enhanced/i.test(v.name) ? ' ★' : '';
  return `${short} (${region})${quality}`;
}
