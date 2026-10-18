import Bibliography from '../components/newsletter/Bibliography.jsx';
import BarChart from '../components/newsletter/BarChart.jsx';
import Prose, { CitedText } from '../components/newsletter/Prose.jsx';
import { bylineName, formatLongDate, REGION_LABELS } from '../lib/format.js';

const REGIONS = ['americas', 'emea', 'apac', 'global_south'];
const has = (s) => Boolean(s && String(s).trim());

/**
 * Print-only layout of one weekly edition, designed for A4 paper / PDF:
 * masthead, lead story in two ruled columns, context panel, regional
 * briefing, features, data, editor's note and bibliography.
 */
export default function PrintEdition({ edition, onlineUrl }) {
  const c = edition.content ?? {};
  const lead = c.lead_story ?? {};
  const count = c.bibliography?.length ?? 0;
  const date = edition.publication_date ? formatLongDate(edition.publication_date) : 'Draft — not yet published';
  const metrics = (lead.key_metrics ?? []).filter((m) => has(m.value));
  const watch = (lead.what_to_watch ?? []).filter(has);
  const sideLinks = (c.sidebar?.links ?? []).filter((l) => has(l.label) && has(l.url));
  const regions = REGIONS.filter((k) => c.global_briefing?.[k]?.some((i) => has(i.headline) || has(i.summary)));
  const features = (c.features ?? []).filter((f) => f.blocks?.some((b) => has(b.title) || has(b.body_markdown)));
  const trends = (c.data_trends ?? []).filter((t) => has(t.title));
  const hasContext = has(lead.historical_context_markdown) || watch.length || sideLinks.length || has(c.sidebar?.note);

  return (
    <article className="pe">
      {/* ── Masthead ── */}
      <header className="pe-mast">
        <div className="pe-mast__strip">
          <span>Global politics · Weekly</span>
          <span>Issue No. {edition.issue_number}</span>
        </div>
        <h1 className="pe-mast__title">The Lead Story</h1>
        <p className="pe-mast__tagline">A weekly briefing on global politics</p>
        <div className="pe-mast__dateline">
          <span>{date}</span>
          <span>Edition {edition.issue_number}</span>
        </div>
      </header>

      {has(c.hero?.image) && (
        <figure className="pe-hero">
          <img src={c.hero.image} alt={c.hero.alt || ''} />
          {has(c.hero.caption) && <figcaption>{c.hero.caption}</figcaption>}
        </figure>
      )}

      {/* ── The Lead Story ── */}
      <section className="pe-lead">
        <p className="pe-label">The Lead Story</p>
        {has(lead.kicker) && <p className="pe-kicker">{lead.kicker}</p>}
        <h2 className="pe-lead__headline">{lead.headline || 'Untitled edition'}</h2>
        {has(lead.subheadline) && <p className="pe-lead__sub">{lead.subheadline}</p>}
        {has(lead.deck) && <p className="pe-lead__deck">{lead.deck}</p>}
        {has(lead.byline) && <p className="pe-lead__byline">By {bylineName(lead.byline)}</p>}

        {has(lead.image?.url) && (
          <figure className="pe-figure">
            <img src={lead.image.url} alt={lead.image.caption || ''} />
            {(has(lead.image.caption) || has(lead.image.credit)) && (
              <figcaption>
                {lead.image.caption}
                {has(lead.image.credit) && <span className="pe-credit">{lead.image.credit}</span>}
              </figcaption>
            )}
          </figure>
        )}

        {metrics.length > 0 && (
          <dl className="pe-metrics">
            {metrics.map((m, i) => (
              <div key={i}>
                <dt>{m.label}</dt>
                <dd className="pe-metrics__value">{m.value}</dd>
                {has(m.context) && (
                  <dd className="pe-metrics__ctx">
                    <CitedText text={m.context} count={count} />
                  </dd>
                )}
              </div>
            ))}
          </dl>
        )}

        <Prose markdown={lead.body_markdown} count={count} className="prose pe-body" />
      </section>

      {hasContext && (
        <aside className="pe-context">
          {has(lead.historical_context_markdown) && (
            <section>
              <h3 className="pe-h3">Historical context</h3>
              <Prose markdown={lead.historical_context_markdown} count={count} className="prose pe-small" />
            </section>
          )}
          {(watch.length > 0 || sideLinks.length > 0 || has(c.sidebar?.note)) && (
            <section>
              {watch.length > 0 && (
                <>
                  <h3 className="pe-h3">What to watch</h3>
                  <ol className="pe-watch">
                    {watch.map((w, i) => (
                      <li key={i}>
                        <CitedText text={w} count={count} />
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {sideLinks.length > 0 && (
                <>
                  <h3 className="pe-h3">{c.sidebar?.title || 'Further reading'}</h3>
                  <ul className="pe-links">
                    {sideLinks.map((l, i) => (
                      <li key={i}>
                        {l.label} <span className="pe-url">{l.url}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {has(c.sidebar?.note) && <p className="pe-note">{c.sidebar.note}</p>}
            </section>
          )}
        </aside>
      )}

      {/* ── Around the World ── */}
      {regions.length > 0 && (
        <section className="pe-section">
          <h2 className="pe-section__title">Around the World</h2>
          <div className="pe-regions">
            {regions.map((key) => (
              <section key={key} className="pe-region">
                <h3 className="pe-h3">{REGION_LABELS[key]}</h3>
                {c.global_briefing[key]
                  .filter((i) => has(i.headline) || has(i.summary))
                  .map((item, i) => (
                    <div key={i} className="pe-brief">
                      {has(item.headline) && <h4>{item.headline}</h4>}
                      {has(item.summary) && (
                        <p>
                          <CitedText text={item.summary} count={count} />
                        </p>
                      )}
                    </div>
                  ))}
              </section>
            ))}
          </div>
        </section>
      )}

      {/* ── Feature sections ── */}
      {features.map((f, i) => (
        <section key={i} className={`pe-section pe-feature pe-feature--${f.background || 'plain'}`}>
          {has(f.title) && <h2 className="pe-section__title">{f.title}</h2>}
          <div className={`pe-feature__grid pe-feature__grid--${f.layout === '1' ? '1' : '2'}`}>
            {f.blocks
              .filter((b) => has(b.title) || has(b.body_markdown))
              .map((b, j) => (
                <div key={j} className="pe-feature__block">
                  {has(b.image) && <img src={b.image} alt="" />}
                  {has(b.title) && <h3 className="pe-feature__title">{b.title}</h3>}
                  <Prose markdown={b.body_markdown} count={count} className="prose pe-small" />
                  {has(b.cta_label) && has(b.cta_url) && (
                    <p className="pe-cta-link">
                      {b.cta_label} → <span className="pe-url">{b.cta_url}</span>
                    </p>
                  )}
                </div>
              ))}
          </div>
        </section>
      ))}

      {/* ── Data & Trends ── */}
      {trends.length > 0 && (
        <section className="pe-section">
          <h2 className="pe-section__title">Data &amp; Trends</h2>
          <div className="pe-trends">
            {trends.map((t, i) => (
              <div key={i} className="pe-trend">
                <h3 className="pe-feature__title">{t.title}</h3>
                {t.chart_type === 'bar' && t.data_points?.length >= 2 && <BarChart points={t.data_points} unit={t.unit} title={t.title} />}
                {has(t.caption) && (
                  <p className="pe-small">
                    <CitedText text={t.caption} count={count} />
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Call to action ── */}
      {(has(c.cta?.heading) || has(c.cta?.button_label)) && (
        <aside className="pe-cta">
          {has(c.cta.heading) && <h3>{c.cta.heading}</h3>}
          {has(c.cta.text) && <p>{c.cta.text}</p>}
          {has(c.cta.button_label) && (
            <p className="pe-cta__action">
              {c.cta.button_label} → <span className="pe-url">{c.cta.button_url}</span>
            </p>
          )}
        </aside>
      )}

      {/* ── Editor's note ── */}
      {has(edition.editor_note) && (
        <aside className="pe-note-box">
          <h2>The Editor’s Note</h2>
          {edition.editor_note.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p className="pe-note-box__sign">— The Editor</p>
        </aside>
      )}

      {/* ── Bibliography ── */}
      <div className="pe-biblio">
        <Bibliography entries={c.bibliography} />
      </div>

      <footer className="pe-colophon">
        <p className="pe-colophon__brand">The Lead Story</p>
        <p>
          Issue No. {edition.issue_number} · {date} · Created by Afraz Muhammed Cheema
          {onlineUrl ? ` · Read online at ${onlineUrl}` : ''}
        </p>
      </footer>
    </article>
  );
}
