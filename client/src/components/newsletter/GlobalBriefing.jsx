import { REGION_LABELS } from '../../lib/format.js';
import { CitedText } from './Prose.jsx';

const ORDER = ['americas', 'emea', 'apac', 'global_south'];

export default function GlobalBriefing({ briefing, count }) {
  if (!briefing) return null;
  const regions = ORDER.filter((key) => briefing[key]?.some((item) => item.headline || item.summary));
  if (!regions.length) return null;

  return (
    <section className="briefing" aria-labelledby="briefing-title">
      <header className="section-head">
        <h2 id="briefing-title" className="section-head__title">
          Around the World
        </h2>
        <p className="section-head__dek">The week’s other developments, region by region</p>
      </header>
      <div className="briefing__grid">
        {regions.map((key) => (
          <section className="region" key={key} aria-labelledby={`region-${key}`}>
            <h3 id={`region-${key}`} className="region__title">
              {REGION_LABELS[key]}
            </h3>
            <ul className="region__list">
              {briefing[key]
                .filter((item) => item.headline || item.summary)
                .map((item, i) => (
                  <li className="brief" key={i}>
                    {item.headline && <h4 className="brief__headline">{item.headline}</h4>}
                    {item.summary && (
                      <p className="brief__summary">
                        <CitedText text={item.summary} count={count} />
                      </p>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
