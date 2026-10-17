import { Link } from 'react-router-dom';
import { Notice } from '../admin/components.jsx';
import { formatDate, formatNumber } from '../lib/format.js';
import { useApi, useDocumentTitle } from '../lib/useApi.js';

function Stat({ label, value, note, to }) {
  const body = (
    <>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{formatNumber(value)}</span>
      {note && <span className="stat__note">{note}</span>}
    </>
  );
  return to ? (
    <Link to={to} className="owner-stat owner-stat--link">
      {body}
    </Link>
  ) : (
    <div className="owner-stat">{body}</div>
  );
}

/** Views per day for the last 30 days: one column per day, one colour. */
function DailyViews({ series }) {
  const max = Math.max(1, ...series.map((d) => d.reads + d.videos));
  const total = series.reduce((n, d) => n + d.reads + d.videos, 0);
  return (
    <figure className="views-chart">
      <figcaption className="views-chart__title">
        Views per day <span>· last 30 days · {formatNumber(total)} in total</span>
      </figcaption>
      <div className="views-chart__plot" role="img" aria-label={`Views per day over the last 30 days, ${total} in total`}>
        {series.map((d) => {
          const n = d.reads + d.videos;
          const label = `${formatDate(d.day, { day: 'numeric', month: 'short' })}: ${n} ${n === 1 ? 'view' : 'views'} (${d.reads} read, ${d.videos} video)`;
          return (
            <span key={d.day} className="views-chart__col" title={label}>
              <span className="views-chart__bar" style={{ height: `${(n / max) * 100}%` }} />
            </span>
          );
        })}
      </div>
      <div className="views-chart__axis" aria-hidden="true">
        <span>{formatDate(series[0].day, { day: 'numeric', month: 'short' })}</span>
        <span>Today</span>
      </div>
    </figure>
  );
}

export default function OverviewPage() {
  const { data, error, loading } = useApi('/owner/overview');
  useDocumentTitle('Admin overview');
  const t = data?.totals;

  return (
    <div className="admin-page">
      <header className="page-head">
        <div>
          <p className="section-label">Admin</p>
          <h1 className="page-head__title">Overview</h1>
          <p className="page-head__dek">Readers, publishers and requests across The Lead Story.</p>
        </div>
      </header>
      {loading && <p className="state-message">Loading…</p>}
      {error && <Notice tone="error">{error.message}</Notice>}
      {t && (
        <>
          {t.pending_requests > 0 && (
            <Notice tone="warn">
              <strong>{t.pending_requests}</strong> publishing {t.pending_requests === 1 ? 'request is' : 'requests are'} waiting for
              your review. <Link to="/owner/requests">Review now →</Link>
            </Notice>
          )}
          <section className="owner-stats" aria-label="Key numbers">
            <Stat label="Views today" value={t.views_today} />
            <Stat label="Last 7 days" value={t.views_7_days} />
            <Stat label="Last 30 days" value={t.views_30_days} note={`${formatNumber(t.video_views_30_days)} of them video`} />
            <Stat label="All time" value={t.views_all_time} />
            <Stat label="Published articles" value={t.published} note={`${t.drafts} in draft`} to="/owner/articles" />
            <Stat label="Publisher accounts" value={t.accounts} to="/owner/accounts" />
            <Stat label="Pending requests" value={t.pending_requests} to="/owner/requests" />
          </section>

          <section className="panel">
            <DailyViews series={data.series} />
          </section>

          <section className="panel">
            <h2 className="panel__title">Most-read articles</h2>
            {data.topEditions.length === 0 ? (
              <p className="panel__intro">No views yet. Views are counted when readers open an article or its video report.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Article</th>
                      <th scope="col">Publisher</th>
                      <th scope="col" className="num">Reads</th>
                      <th scope="col" className="num">Video</th>
                      <th scope="col" className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topEditions.map((e) => (
                      <tr key={e.id}>
                        <td className="table__headline">
                          {e.status === 'published' ? (
                            <a href={`/edition/${e.slug}`} target="_blank" rel="noopener noreferrer">
                              {e.lead_headline || `Issue ${e.issue_number}`} ↗
                            </a>
                          ) : (
                            <>
                              {e.lead_headline || `Issue ${e.issue_number}`} <span className="muted">(unpublished)</span>
                            </>
                          )}
                        </td>
                        <td>{e.author || '—'}</td>
                        <td className="num">{formatNumber(e.reads)}</td>
                        <td className="num">{formatNumber(e.videos)}</td>
                        <td className="num">
                          <strong>{formatNumber(e.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
