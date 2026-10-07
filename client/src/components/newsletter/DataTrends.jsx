import BarChart from './BarChart.jsx';
import { CitedText } from './Prose.jsx';

export default function DataTrends({ panels, count }) {
  const visible = (panels ?? []).filter((p) => p.title);
  if (!visible.length) return null;

  return (
    <section id="data-trends" className="trends" aria-labelledby="trends-title">
      <header className="section-head">
        <h2 id="trends-title" className="section-head__title">
          Data &amp; Trends
        </h2>
        <p className="section-head__dek">The numbers behind the week</p>
      </header>
      <div className="trends__grid">
        {visible.map((panel, i) => (
          <article className="trend" key={i}>
            <h3 className="trend__title">{panel.title}</h3>
            {panel.chart_type === 'bar' && panel.data_points?.length >= 2 && (
              <BarChart points={panel.data_points} unit={panel.unit} title={panel.title} />
            )}
            {panel.caption && (
              <p className="trend__caption">
                <CitedText text={panel.caption} count={count} />
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
