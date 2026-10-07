// Headline sections ⇄ article text. Each section is a headline, the written
// response underneath it, and its own photos and videos.

const IMAGE = /^\/uploads\/[\w-]+\.(jpg|png|gif|webp)$/i;
const VIDEO = /^\/uploads\/[\w-]+\.(mp4|webm|mov)$/i;

export const isVideoUrl = (url) => VIDEO.test(url ?? '');
export const isImageUrl = (url) => IMAGE.test(url ?? '');

export const emptySection = () => ({ headline: '', body_markdown: '', media: [] });

/** Must match the server's composeSections exactly. */
export function composeSections(sections = []) {
  const parts = [];
  for (const s of sections) {
    if (s.headline?.trim()) parts.push(`## ${s.headline.trim().replace(/\n+/g, ' ')}`);
    if (s.body_markdown?.trim()) parts.push(s.body_markdown.trim());
    for (const m of s.media ?? []) if (m.url) parts.push(`![${(m.caption ?? '').replace(/[[\]\n]/g, ' ').trim()}](${m.url})`);
  }
  return parts.join('\n\n');
}

/**
 * Turn a classic single-box article into headline sections. A new section
 * starts at every "## Heading" or short numbered line ("3. Europe on Edge");
 * photos/videos inside the text become that section's media.
 */
export function splitIntoSections(markdown = '') {
  const sections = [];
  let current = emptySection();
  const push = () => {
    current.body_markdown = current.body_markdown.trim();
    if (current.headline || current.body_markdown || current.media.length) sections.push(current);
  };
  for (const raw of String(markdown).split('\n')) {
    const line = raw.trim();
    const heading = /^#{1,6}\s+(.+)/.exec(line) ?? (/^\d+\.\s+\S/.test(line) && line.length < 100 && !/\.$/.test(line) ? /^\d+\.\s+(.+)/.exec(line) : null);
    const media = /^!\[([^\]]*)\]\((\/uploads\/[^)\s]+)\)$/.exec(line);
    if (heading) {
      push();
      current = { ...emptySection(), headline: heading[1].trim() };
    } else if (media && (isImageUrl(media[2]) || isVideoUrl(media[2]))) {
      current.media.push({ type: isVideoUrl(media[2]) ? 'video' : 'image', url: media[2], caption: media[1] });
    } else {
      current.body_markdown += `${raw}\n`;
    }
  }
  push();
  return sections.length ? sections : [emptySection()];
}
