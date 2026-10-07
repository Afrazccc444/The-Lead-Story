// Where in a video report a clip can play. Used by the editor (to offer the
// list of stories) and by the broadcast (to know when to play each clip).
import { plainText, REGION_LABELS, slugify } from './format.js';

/** Section headings inside the lead article ("## Europe on Edge", "3. Europe on Edge"). */
function articleHeadings(markdown = '') {
  return String(markdown)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^#{1,6}\s+\S/.test(l) || (/^\d+\.\s+\S/.test(l) && l.length < 100 && !/\.$/.test(l)))
    .map((l) => plainText(l.replace(/^#{1,6}\s+|^\d+\.\s+/, '')))
    .filter(Boolean);
}

export const targetFor = {
  lead: () => 'lead',
  section: (heading) => `section:${slugify(heading)}`,
  brief: (headline) => `brief:${slugify(headline)}`,
  feature: (title) => `feature:${slugify(title)}`,
};

/** Every story in the edition a clip can be attached to, in broadcast order. */
export function clipTargets(content = {}) {
  const out = [];
  const lead = content.lead_story ?? {};
  if (lead.headline) out.push({ value: targetFor.lead(), label: `Lead story — ${lead.headline}` });
  for (const h of articleHeadings(lead.body_markdown)) out.push({ value: targetFor.section(h), label: `   Lead story section — ${h}` });
  for (const [key, label] of Object.entries(REGION_LABELS)) {
    for (const item of content.global_briefing?.[key] ?? []) {
      if (item.headline) out.push({ value: targetFor.brief(item.headline), label: `${label} — ${item.headline}` });
    }
  }
  for (const f of content.features ?? []) if (f.title) out.push({ value: targetFor.feature(f.title), label: `Feature — ${f.title}` });
  return out;
}
