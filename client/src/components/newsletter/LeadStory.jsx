import { Fragment } from 'react';
import { formatDate, readingMinutes } from '../../lib/format.js';
import { CountUp } from '../Cinematic.jsx';
import { ShareCluster } from '../reader/ReaderTools.jsx';
import { SuspendedChip } from '../reader/SuspendedGate.jsx';
import { TagBadges } from '../ui.jsx';
import { CitedText } from './Prose.jsx';
import LeadLayout from './LeadLayout.jsx';
import TableOfContents from './TableOfContents.jsx';

/** `still` turns off motion (used by the admin live preview). */
export default function LeadStory({ lead, sidebar, count, edition, still = false }) {
  if (!lead?.headline) return null;
  const metrics = lead.key_metrics?.filter((m) => m.value) ?? [];

  return (
    <article className="lead" aria-labelledby="lead-headline">
      <header className="lead__header">
        <p className="section-label">The Lead Story</p>
        {lead.kicker && <p className="kicker">{lead.kicker}</p>}
        <h1 id="lead-headline" className="lead__headline" aria-label={lead.headline}>
          {/* Words rise one by one, like the intro */}
          {/* Spaces sit BETWEEN the word boxes: a space inside an inline-block is dropped by the browser */}
          {lead.headline
            .split(/\s+/)
            .filter(Boolean)
            .map((word, i) => (
              <Fragment key={i}>
                {i > 0 && ' '}
                <span className="lead__word-mask" aria-hidden="true">
                  <span className="lead__word" style={{ '--w': i }}>
                    {word}
                  </span>
                </span>
              </Fragment>
            ))}
        </h1>
        {lead.subheadline && <p className="lead__subheadline">{lead.subheadline}</p>}
        {lead.deck && <p className="lead__deck">{lead.deck}</p>}

        {/* Byline separation frame: author · date · reading time · topics */}
        <div className="byline-frame">
          {lead.byline && (
            <span>
              By <strong>{lead.byline}</strong>
            </span>
          )}
          {lead.byline && <span className="byline-frame__sep" aria-hidden="true" />}
          {/* Articles by approved outside publishers name them clearly */}
          {edition?.publisher && (
            <>
              <span className="publisher-credit">
                Published by <strong>{edition.publisher}</strong>
              </span>
              {edition.publisher_suspended && <SuspendedChip />}
              <span className="byline-frame__sep" aria-hidden="true" />
            </>
          )}
          <time dateTime={edition?.publication_date ?? undefined}>
            {edition?.publication_date ? formatDate(edition.publication_date) : 'Draft'}
          </time>
          <span className="byline-frame__sep" aria-hidden="true" />
          <span className="reading-time">{readingMinutes(edition)} min read</span>
          {edition?.content?.tags?.length > 0 && (
            <>
              <span className="byline-frame__sep" aria-hidden="true" />
              <TagBadges tags={edition.content.tags} />
            </>
          )}
        </div>
      </header>

      {lead.image?.url && (
        <figure className="lead__figure">
          <img src={lead.image.url} alt={lead.image.caption || ''} className="lead__image" decoding="async" />
          {(lead.image.caption || lead.image.credit) && (
            <figcaption className="lead__caption">
              {lead.image.caption}
              {lead.image.credit && <span className="lead__credit">{lead.image.credit}</span>}
            </figcaption>
          )}
        </figure>
      )}

      {metrics.length > 0 && (
        <dl className="metrics" aria-label="Key figures">
          {metrics.map((metric, i) => (
            <div className="metric" key={i}>
              <dt className="metric__label">{metric.label}</dt>
              <dd className="metric__value">
                <CountUp value={metric.value} still={still} />
              </dd>
              {metric.context && (
                <dd className="metric__context">
                  <CitedText text={metric.context} count={count} />
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}

      {/* Contents box for narrow screens; on wide screens it moves into the sticky left rail */}
      {edition && (
        <div className="toc-inline">
          <TableOfContents edition={edition} />
        </div>
      )}

      <LeadLayout lead={lead} edition={edition} sidebar={sidebar} count={count} still={still} />

      {!still && edition?.slug && <ShareCluster edition={edition} title="Share this story" />}
    </article>
  );
}
