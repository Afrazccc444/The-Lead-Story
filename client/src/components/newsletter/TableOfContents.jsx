import { plainText, slugify } from '../../lib/format.js';

/** Same rule the article uses: "## Heading" or a short numbered line ("3. Europe on Edge"). */
function headingsIn(markdown = '') {
  return String(markdown)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^#{1,6}\s+\S/.test(l) || (/^\d+\.\s+\S/.test(l) && l.length < 100 && !/\.$/.test(l)))
    .map((l) => plainText(l.replace(/^#{1,6}\s+|^\d+\.\s+/, '')))
    .filter(Boolean);
}

/** Every jump target in an edition, in page order. */
export function tocEntries(edition) {
  const c = edition.content ?? {};
  const entries = [];
  if (c.lead_story?.headline) entries.push({ id: 'lead-headline', label: c.lead_story.headline, main: true });
  for (const h of headingsIn(c.lead_story?.body_markdown)) entries.push({ id: slugify(h), label: h, sub: true });
  if (Object.values(c.global_briefing ?? {}).some((items) => items?.some((i) => i.headline || i.summary))) {
    entries.push({ id: 'around-the-world', label: 'Around the World' });
  }
  for (const f of c.features ?? []) if (f.title && f.blocks?.length) entries.push({ id: slugify(f.title), label: f.title });
  if ((c.data_trends ?? []).some((t) => t.title)) entries.push({ id: 'data-trends', label: 'Data & Trends' });
  if (c.poll?.question && (c.poll.options ?? []).filter((o) => o.trim()).length >= 2) entries.push({ id: 'have-your-say', label: 'Have your say' });
  if (edition.editor_note?.trim()) entries.push({ id: 'editors-note', label: 'The Editor’s Note' });
  if (c.bibliography?.length) entries.push({ id: 'bibliography', label: 'Bibliography' });
  return entries;
}

/** "In this edition" index with deep links to every heading. */
export default function TableOfContents({ edition }) {
  const entries = tocEntries(edition);
  if (entries.length < 3) return null;
  return (
    <nav className="toc" aria-label="In this edition">
      <details open>
        <summary className="toc__title">In this edition</summary>
        <ol className="toc__list">
          {entries.map((e) => (
            <li key={e.id} className={e.sub ? 'toc__item toc__item--sub' : e.main ? 'toc__item toc__item--main' : 'toc__item'}>
              <a href={`#${e.id}`}>{e.label}</a>
            </li>
          ))}
        </ol>
      </details>
    </nav>
  );
}
