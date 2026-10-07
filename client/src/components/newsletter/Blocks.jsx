import { slugify } from '../../lib/format.js';
import Prose from './Prose.jsx';

/** A clickable call-to-action button: solid rectangle or pill. */
export function CtaButton({ label, url, style = 'solid', tone = 'accent' }) {
  if (!label || !url) return null;
  const external = /^https?:\/\//i.test(url);
  return (
    <a
      className={`cta-btn cta-btn--${style} cta-btn--${tone}`}
      href={url}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {label}
      <span aria-hidden="true"> →</span>
    </a>
  );
}

/** Wide banner at the very top of the edition. Shows a placeholder box in the admin preview. */
export function HeroBanner({ hero, preview }) {
  if (!hero?.image) {
    return preview ? (
      <div className="hero hero--placeholder" aria-hidden="true">
        <span>Hero image placeholder — add a wide banner in “Hero banner”</span>
      </div>
    ) : null;
  }
  const img = <img src={hero.image} alt={hero.alt || ''} className="hero__image" decoding="async" />;
  return (
    <figure className="hero">
      {hero.link ? (
        <a href={hero.link} target="_blank" rel="noopener noreferrer">
          {img}
        </a>
      ) : (
        img
      )}
      {hero.caption && <figcaption className="hero__caption">{hero.caption}</figcaption>}
    </figure>
  );
}

/**
 * Modular content sections: each is a 1-, 2- or 3-column grid of blocks with
 * its own divider style and background shade.
 */
export function FeatureSections({ sections, count }) {
  const visible = (sections ?? []).filter((s) => s.title || s.blocks?.some((b) => b.title || b.body_markdown || b.image));
  if (!visible.length) return null;

  return visible.map((section, i) => (
    <section
      id={section.title ? slugify(section.title) : undefined}
      key={i}
      className={`feature feature--${section.background || 'plain'} feature--divider-${section.divider || 'line'}`}
      aria-label={section.title || 'Feature'}
    >
      {section.title && (
        <header className="section-head feature__head">
          <h2 className="section-head__title">{section.title}</h2>
        </header>
      )}
      <div className={`feature__grid feature__grid--${section.layout || '2'}`}>
        {section.blocks
          .filter((b) => b.title || b.body_markdown || b.image)
          .map((block, j) => (
            <article key={j} className="feature__block">
              {block.image && <img src={block.image} alt="" className="feature__image" loading="lazy" decoding="async" />}
              {block.title && <h3 className="feature__title">{block.title}</h3>}
              <Prose markdown={block.body_markdown} count={count} className="prose prose--small" />
              <CtaButton label={block.cta_label} url={block.cta_url} style="solid" tone={section.background === 'dark' ? 'light' : 'accent'} />
            </article>
          ))}
      </div>
    </section>
  ));
}

/**
 * Pre-sized promotion slot (728 × 90 leaderboard proportions) for school
 * events, clubs or sponsors. Empty slots only show as a placeholder in the
 * admin preview.
 */
export function PromoSlot({ promo, preview }) {
  if (!promo?.image) {
    return preview ? (
      <div className="promo promo--placeholder" aria-hidden="true">
        <span>Promotion slot · 728 × 90 — add one in “Promotion slot”</span>
      </div>
    ) : null;
  }
  const img = <img src={promo.image} alt={promo.label || 'Promotion'} className="promo__image" loading="lazy" decoding="async" />;
  return (
    <aside className="promo" aria-label="Promotion">
      <span className="promo__label">{promo.label || 'Promotion'}</span>
      {promo.link ? (
        <a href={promo.link} target="_blank" rel="noopener noreferrer sponsored">
          {img}
        </a>
      ) : (
        img
      )}
    </aside>
  );
}

/** Full-width call-to-action banner (e.g. “Subscribe”, “Join the club”, “Send us your views”). */
export function CtaBanner({ cta }) {
  if (!cta?.heading && !cta?.button_label) return null;
  return (
    <aside className="cta-banner" aria-label={cta.heading || 'Call to action'}>
      <div className="cta-banner__text">
        {cta.heading && <h2 className="cta-banner__heading">{cta.heading}</h2>}
        {cta.text && <p>{cta.text}</p>}
      </div>
      <CtaButton label={cta.button_label} url={cta.button_url} style={cta.style} tone="light" />
    </aside>
  );
}

function sidebarParts(sidebar) {
  return {
    links: (sidebar?.links ?? []).filter((l) => l.label && l.url),
    sponsors: (sidebar?.sponsors ?? []).filter((s) => s.name || s.logo),
  };
}

export function hasSidebarContent(sidebar) {
  const { links, sponsors } = sidebarParts(sidebar);
  return links.length > 0 || sponsors.length > 0 || Boolean(sidebar?.note);
}

/** Narrow side panel: further-reading links, sponsors and a short note. */
export function SidebarFrame({ sidebar }) {
  if (!hasSidebarContent(sidebar)) return null;
  const { links, sponsors } = sidebarParts(sidebar);

  return (
    <section className="sidebar-frame" aria-label={sidebar.title || 'More'}>
      <h2 className="aside-block__title">{sidebar.title || 'Further reading'}</h2>
      {links.length > 0 && (
        <ul className="sidebar-frame__links">
          {links.map((l, i) => (
            <li key={i}>
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      {sidebar.note && <p className="sidebar-frame__note">{sidebar.note}</p>}
      {sponsors.length > 0 && (
        <div className="sidebar-frame__sponsors">
          <p className="sidebar-frame__label">Supported by</p>
          <ul>
            {sponsors.map((s, i) => {
              const inner = s.logo ? <img src={s.logo} alt={s.name || 'Sponsor'} /> : <span>{s.name}</span>;
              return (
                <li key={i}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer sponsored">
                      {inner}
                    </a>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
