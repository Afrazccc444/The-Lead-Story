import Prose, { CitedText } from './Prose.jsx';

export default function LeadStory({ lead, count }) {
  if (!lead?.headline) return null;
  const metrics = lead.key_metrics?.filter((m) => m.value) ?? [];
  const watch = lead.what_to_watch?.filter((w) => w.trim()) ?? [];
  const hasAside = lead.historical_context_markdown || watch.length > 0;

  return (
    <article className="lead" aria-labelledby="lead-headline">
      <header className="lead__header">
        <p className="section-label">The Lead Story</p>
        {lead.kicker && <p className="kicker">{lead.kicker}</p>}
        <h1 id="lead-headline" className="lead__headline">
          {lead.headline}
        </h1>
        {lead.subheadline && <p className="lead__subheadline">{lead.subheadline}</p>}
        {lead.deck && <p className="lead__deck">{lead.deck}</p>}
        {lead.byline && <p className="lead__byline">By {lead.byline}</p>}
      </header>

      {metrics.length > 0 && (
        <dl className="metrics" aria-label="Key figures">
          {metrics.map((metric, i) => (
            <div className="metric" key={i}>
              <dt className="metric__label">{metric.label}</dt>
              <dd className="metric__value">{metric.value}</dd>
              {metric.context && (
                <dd className="metric__context">
                  <CitedText text={metric.context} count={count} />
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}

      <div className={`lead__grid${hasAside ? '' : ' lead__grid--single'}`}>
        <Prose markdown={lead.body_markdown} count={count} className="prose prose--lead" />

        {hasAside && (
          <aside className="lead__aside">
            {lead.historical_context_markdown && (
              <section className="aside-block">
                <h2 className="aside-block__title">Historical context</h2>
                <Prose markdown={lead.historical_context_markdown} count={count} className="prose prose--small" />
              </section>
            )}
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
          </aside>
        )}
      </div>
    </article>
  );
}
