// Turns an edition into a TV-style running order: headlines first, then each
// story in detail, then a sign-off. Every spoken line ("cue") also says what
// the studio should show: video-wall content, lower-third strap and camera shot.
import { formatLongDate, plainText, REGION_LABELS } from '../lib/format.js';
import { sentences, speakable } from '../lib/readAloud.js';
import { targetFor } from '../lib/clipTargets.js';

const REGION_INTRO = {
  americas: 'In the Americas',
  emea: 'In Europe, the Middle East and Africa',
  apac: 'In Asia and the Pacific',
  global_south: 'Across the Global South',
};

const SHOTS = ['close', 'wide', 'angle', 'close', 'screen'];

/** Split markdown into paragraphs, recognising "## Heading" and "3. Heading" lines. */
function paragraphs(markdown = '') {
  const out = [];
  for (const block of String(markdown).split(/\n\s*\n/)) {
    for (const raw of block.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const heading = /^#{1,6}\s+(.+)/.exec(line) ?? (/^\d+\.\s+(.+)/.test(line) && line.length < 100 && !/\.$/.test(line) ? /^\d+\.\s+(.+)/.exec(line) : null);
      if (heading) out.push({ heading: plainText(heading[1]) });
    }
    const text = block
      .split('\n')
      .filter((l) => l.trim() && !/^#{1,6}\s/.test(l.trim()) && !(/^\d+\.\s+\S/.test(l.trim()) && l.trim().length < 100 && !/\.$/.test(l.trim())))
      .join(' ');
    if (speakable(text)) out.push({ text });
  }
  return out;
}

/**
 * @returns {{ cues: Array<{text:string, pause:number, story:number, screen:object, lower:object, shot:string, caption?:string}>,
 *             stories: string[], headlines: string[], estimateMinutes: number }}
 */
export function buildBroadcast(edition) {
  const c = edition.content ?? {};
  const lead = c.lead_story ?? {};
  const date = edition.publication_date ? formatLongDate(edition.publication_date) : '';
  const heroImage = c.hero?.image || lead.image?.url || '';
  const cues = [];
  const stories = [];
  let story = -1;
  let shotTurn = 0;
  const nextShot = () => SHOTS[shotTurn++ % SHOTS.length];

  // Editor-uploaded clips that play only in the video report.
  const clips = (c.video_clips ?? []).filter((clip) => clip.url && clip.target);
  let wallVideo = '';
  /** Queue full-screen clips for this story and pick up any video-wall clip. */
  const attach = (target, label, { keepWall = false } = {}) => {
    const mine = clips.filter((clip) => clip.target === target);
    const wall = mine.find((clip) => clip.play === 'wall');
    if (wall) wallVideo = wall.url;
    else if (!keepWall) wallVideo = '';
    for (const clip of mine.filter((m) => m.play !== 'wall')) {
      cues.push({ type: 'clip', clip, text: clip.caption || '', pause: 450, story, screen: null, lower: { tag: 'VIDEO REPORT', title: clip.caption || label }, shot: null });
    }
  };

  const say = (text, { screen, lower, shot, pause = 380 } = {}) => {
    const clean = speakable(text);
    if (!clean) return;
    const finished = /[.!?:;]["”’)]*$/.test(clean) ? clean : `${clean}.`;
    const parts = sentences(finished);
    parts.forEach((part, i) =>
      cues.push({
        text: part,
        pause: i === parts.length - 1 ? pause : 140,
        story,
        screen: { ...screen, body: screen?.body ?? part, video: wallVideo || undefined },
        lower,
        shot: i === 0 ? shot ?? nextShot() : null,
      }),
    );
  };
  const beginStory = (label) => {
    story += 1;
    stories.push(label);
    wallVideo = ''; // each story starts with the normal video wall unless it has its own clip
  };

  // ── Opening ─────────────────────────────────────────────
  beginStory('Opening');
  const openScreen = { kicker: 'THE LEAD STORY', title: `Issue ${edition.issue_number}${date ? ` · ${date}` : ''}`, body: 'Your weekly briefing on global politics', image: heroImage };
  const openLower = { tag: 'WEEKLY BRIEFING', title: 'The Lead Story', sub: date };
  say(`Good evening, and welcome to The Lead Story, your weekly briefing on global politics.`, { screen: openScreen, lower: openLower, shot: 'wide', pause: 500 });
  say(`This is issue ${edition.issue_number}${date ? `, for ${date}` : ''}. Here are this week's headlines.`, { screen: openScreen, lower: openLower, shot: 'close', pause: 900 });

  // ── Headlines ───────────────────────────────────────────
  beginStory('Headlines');
  const headlines = [];
  // Same order as the detailed part: lead story, its sections, the world, features.
  if (lead.headline) headlines.push({ kicker: lead.kicker || 'THE LEAD STORY', title: lead.headline, line: lead.subheadline || lead.deck || '' });
  if (lead.sections?.length) {
    for (const sec of lead.sections) if (sec.headline?.trim()) headlines.push({ kicker: 'THE LEAD STORY', title: sec.headline.trim(), line: '' });
  } else {
    for (const p of paragraphs(lead.body_markdown)) if (p.heading) headlines.push({ kicker: 'THE LEAD STORY', title: p.heading, line: '' });
  }
  for (const key of Object.keys(REGION_INTRO)) {
    for (const item of c.global_briefing?.[key] ?? []) {
      if (item.headline) headlines.push({ kicker: REGION_LABELS[key].toUpperCase(), title: item.headline, line: '' });
    }
  }
  for (const f of c.features ?? []) if (f.title && f.blocks?.length) headlines.push({ kicker: 'FEATURE', title: f.title, line: '' });
  headlines.slice(0, 8).forEach((h, i) => {
    const end = /[.!?]$/.test(h.title) ? '' : '.';
    say(`${h.title}${end}${h.line ? ` ${h.line}` : ''}`, {
      screen: { kicker: `HEADLINE ${i + 1}`, title: h.title, body: h.line || h.kicker, image: i === 0 ? heroImage : '' },
      lower: { tag: 'HEADLINES', title: h.title, sub: h.kicker },
      shot: i % 2 ? 'screen' : 'close',
      pause: 650,
    });
  });

  // ── The lead story in detail ────────────────────────────
  if (lead.headline) {
    beginStory(lead.headline);
    attach(targetFor.lead(), lead.headline);
    const leadWall = wallVideo;
    const leadLower = { tag: 'THE LEAD STORY', title: lead.headline, sub: lead.byline ? `Reporting by ${lead.byline}` : '' };
    let section = lead.headline;
    say(`Now, our lead story in detail. ${lead.headline}.`, { screen: { kicker: 'THE LEAD STORY', title: lead.headline, body: lead.deck || lead.subheadline, image: lead.image?.url || heroImage }, lower: leadLower, shot: 'close', pause: 600 });
    if (lead.subheadline) say(lead.subheadline, { screen: { kicker: 'THE LEAD STORY', title: lead.headline, body: lead.subheadline }, lower: leadLower, pause: 450 });
    if (lead.sections?.length) {
      // Headline sections: each is its own story — its photo on the video wall,
      // its videos played full screen at that headline, then the report read out.
      lead.sections.forEach((sec, n) => {
        const title = sec.headline?.trim() || (n === 0 ? lead.headline : `Part ${n + 1}`);
        const photo = (sec.media ?? []).find((m) => m.type === 'image' && m.url)?.url;
        const screenFor = (body) => ({ kicker: 'THE LEAD STORY', title, body, image: photo });
        if (sec.headline?.trim()) {
          section = title;
          beginStory(title);
          wallVideo = leadWall;
          attach(targetFor.section(title), title, { keepWall: true });
        }
        for (const m of (sec.media ?? []).filter((x) => x.type === 'video' && x.url)) {
          cues.push({ type: 'clip', clip: { url: m.url, caption: m.caption, play: 'before' }, text: m.caption || '', pause: 450, story, screen: null, lower: { tag: 'VIDEO REPORT', title: m.caption || title }, shot: null });
        }
        if (sec.headline?.trim()) say(title, { screen: screenFor(''), lower: { ...leadLower, title }, shot: photo ? 'screen' : 'close', pause: 650 });
        for (const p of paragraphs(sec.body_markdown)) {
          if (p.text) say(p.text, { screen: screenFor(), lower: { ...leadLower, title }, pause: 520 });
        }
      });
    }
    for (const p of lead.sections?.length ? [] : paragraphs(lead.body_markdown)) {
      if (p.heading) {
        section = p.heading;
        beginStory(p.heading);
        wallVideo = leadWall;
        attach(targetFor.section(p.heading), p.heading, { keepWall: true });
        say(p.heading, { screen: { kicker: 'THE LEAD STORY', title: p.heading, body: '' }, lower: { ...leadLower, title: p.heading }, shot: 'screen', pause: 650 });
      } else {
        say(p.text, { screen: { kicker: 'THE LEAD STORY', title: section }, lower: { ...leadLower, title: section }, pause: 520 });
      }
    }
    if (lead.historical_context_markdown) {
      say('Some historical context.', { screen: { kicker: 'CONTEXT', title: 'Historical context', body: '' }, lower: { ...leadLower, title: 'Historical context' }, shot: 'angle', pause: 450 });
      for (const p of paragraphs(lead.historical_context_markdown)) if (p.text) say(p.text, { screen: { kicker: 'CONTEXT', title: 'Historical context' }, lower: { ...leadLower, title: 'Historical context' } });
    }
    const watch = (lead.what_to_watch ?? []).filter((w) => w.trim());
    if (watch.length) {
      say('What to watch in the days ahead.', { screen: { kicker: 'WHAT TO WATCH', title: 'The days ahead', body: '' }, lower: { ...leadLower, title: 'What to watch' }, shot: 'screen', pause: 450 });
      watch.forEach((w) => say(w, { screen: { kicker: 'WHAT TO WATCH', title: 'The days ahead' }, lower: { ...leadLower, title: 'What to watch' }, pause: 450 }));
    }
  }

  // ── Around the world, story by story ────────────────────
  for (const key of Object.keys(REGION_INTRO)) {
    const items = (c.global_briefing?.[key] ?? []).filter((i) => i.headline || i.summary);
    if (!items.length) continue;
    beginStory(REGION_LABELS[key]);
    const tag = REGION_LABELS[key].toUpperCase();
    say(`${REGION_INTRO[key]}.`, { screen: { kicker: 'AROUND THE WORLD', title: REGION_LABELS[key], body: '' }, lower: { tag: 'AROUND THE WORLD', title: REGION_LABELS[key] }, shot: 'wide', pause: 500 });
    for (const item of items) {
      const lower = { tag, title: item.headline || REGION_LABELS[key] };
      if (item.headline) attach(targetFor.brief(item.headline), item.headline);
      else wallVideo = '';
      if (item.headline) say(item.headline, { screen: { kicker: tag, title: item.headline, body: item.summary, image: item.image }, lower, shot: 'close', pause: 400 });
      if (item.summary) say(item.summary, { screen: { kicker: tag, title: item.headline || REGION_LABELS[key], image: item.image }, lower, pause: 650 });
    }
  }

  // ── Features ────────────────────────────────────────────
  for (const f of c.features ?? []) {
    const blocks = (f.blocks ?? []).filter((b) => b.title || b.body_markdown);
    if (!blocks.length) continue;
    beginStory(f.title || 'Features');
    attach(f.title ? targetFor.feature(f.title) : '', f.title || 'Features');
    for (const b of blocks) {
      const lower = { tag: (f.title || 'FEATURE').toUpperCase(), title: b.title || f.title };
      if (b.title) say(b.title, { screen: { kicker: lower.tag, title: b.title, body: '', image: b.image }, lower, shot: 'screen', pause: 450 });
      for (const p of paragraphs(b.body_markdown)) if (p.text) say(p.text, { screen: { kicker: lower.tag, title: b.title || f.title, image: b.image }, lower });
    }
  }

  // ── Editor's note & sign-off ────────────────────────────
  wallVideo = '';
  if (edition.editor_note?.trim()) {
    beginStory('The Editor’s Note');
    say('And finally, a note from the editor.', { screen: { kicker: 'THE EDITOR’S NOTE', title: 'From the editor', body: '' }, lower: { tag: 'AND FINALLY', title: 'The Editor’s Note' }, shot: 'close', pause: 600 });
    for (const p of paragraphs(edition.editor_note)) if (p.text) say(p.text, { screen: { kicker: 'THE EDITOR’S NOTE', title: 'From the editor' }, lower: { tag: 'AND FINALLY', title: 'The Editor’s Note' } });
  }
  beginStory('Sign-off');
  say('That’s The Lead Story for this week. Thank you for watching, and goodnight.', {
    screen: { kicker: 'THE LEAD STORY', title: 'Thank you for watching', body: 'Read the full edition and its sources online', image: heroImage },
    lower: { tag: 'THE LEAD STORY', title: 'See you next week', sub: 'Created by Afraz Muhammed Cheema' },
    shot: 'wide',
    pause: 0,
  });

  // Only spoken lines count towards the running time (clips have their own length).
  const words = cues.reduce((n, cue) => n + (cue.type === 'clip' ? 0 : cue.text.split(/\s+/).length), 0);
  return {
    cues,
    stories,
    headlines: headlines.map((h) => h.title),
    estimateMinutes: Math.max(1, Math.round(words / 150 + 0.25)),
  };
}

/** Prefer a natural British male newsreader voice. */
export function pickAnchorVoice(voices) {
  const male = /(ryan|thomas|george|oliver|alfie|elliot|noah|arthur|harry|daniel|brian|\bmale)/i;
  const female = /(sonia|libby|maisie|hazel|susan|bella|mia|abbi|hollie|olivia|female|kate|serena|martha)/i;
  const score = (v) => {
    const name = v.name.toLowerCase();
    if (!/^en/i.test(v.lang)) return -1000;
    let s = 0;
    if (/^en[-_]gb/i.test(v.lang)) s += 50;
    if (male.test(name)) s += 40;
    if (female.test(name)) s -= 60;
    if (/natural|neural|premium|enhanced/.test(name)) s += 45;
    if (/online/.test(name)) s += 10;
    if (/google uk english male/.test(name)) s += 30;
    return s;
  };
  return [...voices].filter((v) => score(v) > -1000).sort((a, b) => score(b) - score(a))[0] ?? null;
}
