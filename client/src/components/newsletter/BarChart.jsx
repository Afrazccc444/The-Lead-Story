import { useId } from 'react';
import { formatNumber } from '../../lib/format.js';

function formatValue(value, unit) {
  const n = formatNumber(value, { maximumFractionDigits: 2 });
  if (!unit) return n;
  return unit === '%' ? `${n}%` : `${n} ${unit}`;
}

/**
 * Single-series horizontal bar chart built from HTML, so it reflows with the
 * page. One colour (the accent) — the title names the series, so no legend.
 * Bars grow from a shared zero line; negative values extend to its left.
 */
export default function BarChart({ points, unit, title }) {
  const tableId = useId();
  if (!points?.length) return null;

  const maxAbs = Math.max(...points.map((p) => Math.abs(p.value)), 0) || 1;
  const hasNegative = points.some((p) => p.value < 0);
  const span = hasNegative ? 50 : 100;

  return (
    <figure className="chart">
      <div className="chart__plot" role="img" aria-label={`${title}: ${points.map((p) => `${p.label} ${formatValue(p.value, unit)}`).join('; ')}`}>
        {points.map((point, i) => {
          const width = (Math.abs(point.value) / maxAbs) * span;
          const left = hasNegative ? (point.value < 0 ? 50 - width : 50) : 0;
          return (
            <div className="chart__row" key={i} title={`${point.label}: ${formatValue(point.value, unit)}`}>
              <span className="chart__label">{point.label}</span>
              <span className="chart__track">
                {hasNegative && <span className="chart__zero" aria-hidden="true" />}
                <span
                  className="chart__bar"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 0.5)}%`,
                    // Bars grow outward from the zero line when the chart scrolls into view.
                    transformOrigin: point.value < 0 ? 'right center' : 'left center',
                    '--i': i,
                  }}
                />
              </span>
              <span className="chart__value">{formatValue(point.value, unit)}</span>
            </div>
          );
        })}
      </div>
      <details className="chart__table">
        <summary aria-controls={tableId}>View as table</summary>
        <table id={tableId}>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Value{unit ? ` (${unit})` : ''}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, i) => (
              <tr key={i}>
                <td>{point.label}</td>
                <td>{formatNumber(point.value, { maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
