import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatDate } from '../../lib/format.js';
import { ShareCluster } from '../reader/ReaderTools.jsx';
import { hasSidebarContent, SidebarFrame } from './Blocks.jsx';
import Prose, { CitedText } from './Prose.jsx';
import { tocEntries } from './TableOfContents.jsx';

/** Insert pull-quote markers evenly between the article's paragraphs. */
function withPullQuotes(markdown = '', quotes = []) {
  if (!quotes.length) return markdown;
  const blocks = markdown.split(/\n\s*\n/);
  const out = [...blocks];
  // Insert from the end so earlier positions stay valid.
  for (let i = quotes.length - 1; i >= 0; i--) {
    const after = Math.max(1, Math.round(((i + 1) * blocks.length) / (quotes.length + 1)));
    out.splice(Math.min(after, out.length), 0, `> ::pq${i}::`);
  }
  return out.join('\n\n');
}

/** Bibliography numbers in the order they are first cited in the article. */
function citedInOrder(markdown = '', count = 0) {
  const seen = [];
  for (const m of markdown.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g)) {
    for (const n of m[1].split(',').map((x) => Number(x.trim()))) {
      if (n >= 1 && n <= count && !seen.includes(n)) seen.push(n);
    }
  }
  return seen;
}

/** Short reference for a margin note: "BBC News · Smith, J. · 21 Sep 2026". */
function noteText(entry = {}) {
  const date = /^\d{4}-\d{2}-\d{2}/.test(entry.date ?? '') ? formatDate(entry.date, { day: 'numeric', month: 'short', year: 'numeric' }) : entry.date;
  return { title: entry.title || entry.publication || entry.url || 'Source', meta: [entry.publication && entry.title ? entry.publication : '', entry.author, date].filter(Boolean).join(' · '), url: entry.url };
}

/**
 * Lays out the lead story. On wide screens (edition ≥ 1180px):
 *   left rail  — sticky "In this edition" (current section highlighted),
 *                "Also this week" headlines and share buttons
 *   centre     — the article; inline photos stretch into the right margin
 *   right rail — context boxes, then margin notes for sources and pull quotes,
 *                each placed beside the line it belongs to without overlapping
 * On narrower screens everything falls back to a single readable column.
 */
export default function LeadLayout({ lead, edition, sidebar, count, still }) {
  const quotes = useMemo(() => (lead.pull_quotes ?? []).map((q) => q.trim()).filter(Boolean), [lead.pull_quotes]);
  const body = useMemo(() => withPullQuotes(lead.body_markdown, quotes), [lead.body_markdown, quotes]);
  const cited = useMemo(() => citedInOrder(lead.body_markdown, count), [lead.body_markdown, count]);
  const bibliography = edition?.content?.bibliography ?? [];
  const explainers = (edition?.content?.explainers ?? []).filter((e) => e.title || e.body_markdown);
  const watch = (lead.what_to_watch ?? []).filter((w) => w.trim());
  const hasBoxes = Boolean(lead.historical_context_markdown) || watch.length > 0 || explainers.length > 0 || hasSidebarContent(sidebar);

  const layoutRef = useRef(null);
  const mainRef = useRef(null);
  const railRef = useRef(null);

  // ── Place margin items beside their anchors, never overlapping ──
  useLayoutEffect(() => {
    const rail = railRef.current;
    const main = mainRef.current;
    if (!rail || !main) return undefined;

    let frame = 0;
    const place = () => {
      frame = 0;
      const items = [...rail.querySelectorAll('[data-anchor]')];
      items.forEach((el) => (el.style.display = ''));
      const active = getComputedStyle(rail).getPropertyValue('--rails-active').trim() === '1';
      if (!active) {
        items.forEach((el) => (el.style.top = ''));
        rail.style.minHeight = '';
        return;
      }
      const railTop = rail.getBoundingClientRect().top;
      const boxes = rail.querySelector('.lead-rail__boxes');
      let cursor = boxes && boxes.offsetHeight ? boxes.offsetHeight + 32 : 0;
      // Wide photos reach into the margin: nothing may sit beside them.
      const blocked = [...main.querySelectorAll('.prose-figure-block')].map((f) => {
        const r = f.getBoundingClientRect();
        return [r.top - railTop - 12, r.bottom - railTop + 12];
      });
      const placed = items
        .map((el) => {
          const anchor = main.querySelector(el.dataset.anchor);
          return { el, desired: anchor ? anchor.getBoundingClientRect().top - railTop - 4 : Infinity };
        })
        .filter((x) => Number.isFinite(x.desired))
        .sort((a, b) => a.desired - b.desired);
      for (const { el, desired } of placed) {
        const h = el.offsetHeight;
        let top = Math.max(desired, cursor);
        for (let moved = true; moved; ) {
          moved = false;
          for (const [from, to] of blocked) {
            if (top < to && top + h > from) {
              top = to;
              moved = true;
            }
          }
        }
        el.style.top = `${Math.round(top)}px`;
        cursor = top + h + 18;
      }
      items.filter((el) => !placed.some((p) => p.el === el)).forEach((el) => (el.style.display = 'none'));
      rail.style.minHeight = `${Math.ceil(cursor)}px`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };

    place();
    const ro = new ResizeObserver(schedule);
    ro.observe(main);
    ro.observe(layoutRef.current);
    window.addEventListener('resize', schedule);
    document.fonts?.ready.then(schedule);
    main.querySelectorAll('img').forEach((img) => img.complete || img.addEventListener('load', schedule, { once: true }));
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [body, cited, quotes, hasBoxes]);

  return (
    <div className="lead-layout" ref={layoutRef}>
      {/* ── Left rail (wide screens only) ── */}
      {!still && (
        <aside className="lead-rail lead-rail--left" aria-label="Edition navigation">
          <div className="lead-rail__sticky">
            <RailContents edition={edition} />
            <AlsoThisWeek briefing={edition?.content?.global_briefing} />
            {edition?.slug && <ShareCluster edition={edition} title="Share" />}
          </div>
        </aside>
      )}

      {/* ── The article ── */}
      <div className="lead-main" ref={mainRef}>
        <Prose markdown={body} count={count} className="prose prose--lead" pullQuotes={quotes} />
      </div>

      {/* ── Right rail: context boxes, then margin notes & pull quotes ── */}
      <aside className="lead-rail lead-rail--right" ref={railRef} aria-label="Context and sources">
        {hasBoxes && (
          <div className="lead-rail__boxes">
            {lead.historical_context_markdown && (
              <section className="aside-block">
                <h2 className="aside-block__title">Historical context</h2>
                <Prose markdown={lead.historical_context_markdown} count={count} className="prose prose--small" />
              </section>
            )}
            {explainers.map((e, i) => (
              <section key={i} className="explainer">
                <p className="explainer__eyebrow">Explainer</p>
                {e.title && <h2 className="explainer__title">{e.title}</h2>}
                <Prose markdown={e.body_markdown} count={count} className="prose prose--small" />
              </section>
            ))}
            {watch.length > 0 && (
              <section className="aside-block">
                <h2 className="aside-block__title">What to watch</h2>
                <ol className="watch-list">
                  {watch.map((item, i) => (
                    <li key={i}>
                      <span>
                        <CitedText text={item} count={count} />
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            <SidebarFrame sidebar={sidebar} />
          </div>
        )}

        {quotes.map((q, i) => (
          <figure key={`pq${i}`} className="rail-pullquote" data-anchor={`#pq-${i}`} aria-hidden="true">
            <blockquote>“{q}”</blockquote>
          </figure>
        ))}

        {cited.map((n) => {
          const note = noteText(bibliography[n - 1]);
          return (
            <aside key={`n${n}`} className="sidenote" data-anchor={`.prose--lead sup.cite a[href="#source-${n}"]`}>
              <span className="sidenote__num">{n}</span>
              <span className="sidenote__body">
                <a href={`#source-${n}`} className="sidenote__title">
                  {note.title}
                </a>
                {note.meta && <span className="sidenote__meta">{note.meta}</span>}
              </span>
            </aside>
          );
        })}
      </aside>
    </div>
  );
}

/** Contents list for the sticky rail, highlighting the section on screen. */
function RailContents({ edition }) {
  const entries = useMemo(() => (edition ? tocEntries(edition) : []), [edition]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const targets = entries.map((e) => document.getElementById(e.id)).filter(Boolean);
    if (!targets.length) return undefined;
    const io = new IntersectionObserver(
      (records) => {
        const visible = records.filter((r) => r.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-90px 0px -65% 0px' },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [entries]);

  if (entries.length < 2) return null;
  return (
    <nav className="rail-toc" aria-label="In this edition">
      <p className="rail-title">In this edition</p>
      <ol>
        {entries.map((e) => (
          <li key={e.id} className={`${e.sub ? 'is-sub' : ''} ${active === e.id ? 'is-active' : ''}`}>
            <a href={`#${e.id}`} aria-current={active === e.id ? 'location' : undefined}>
              {e.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The week's other headlines (from Around the World), linking down to them. */
function AlsoThisWeek({ briefing }) {
  const items = Object.values(briefing ?? {})
    .flat()
    .filter((i) => i?.headline)
    .slice(0, 6);
  if (!items.length) return null;
  return (
    <div className="rail-also">
      <p className="rail-title">Also this week</p>
      <ul>
        {items.map((item, i) => (
          <li key={i}>
            <a href="#around-the-world">{item.headline}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
