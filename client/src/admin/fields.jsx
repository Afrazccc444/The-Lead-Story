import { useEffect, useRef, useState } from 'react';

export function TextField({ label, value, onChange, hint, ...rest }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, value, onChange, hint, rows = 4, mono = false, ...rest }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <textarea
        className={`textarea${mono ? ' textarea--mono' : ''}`}
        rows={rows}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

/** Array of strings edited as one-per-line text. */
export function LinesField({ label, value = [], onChange, hint, rows = 4 }) {
  return (
    <TextArea
      label={label}
      hint={hint ?? 'One item per line.'}
      rows={rows}
      value={value.join('\n')}
      onChange={(text) => onChange(text.split('\n'))}
    />
  );
}

/** Generic list editor: add / remove / reorder items rendered by `renderItem`. */
export function ListEditor({ items = [], onChange, renderItem, makeItem, addLabel = 'Add item', itemLabel = 'Item', labelFor, max = 20 }) {
  const set = (index, item) => onChange(items.map((it, i) => (i === index ? item : it)));
  const remove = (index) => onChange(items.filter((_, i) => i !== index));
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="list-editor">
      {items.map((item, index) => (
        <div className="list-editor__item" key={index}>
          <div className="list-editor__bar">
            <span className="list-editor__label">{labelFor ? labelFor(index) : `${itemLabel} ${index + 1}`}</span>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
              ↑
            </button>
            <button type="button" className="icon-btn" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="Move down">
              ↓
            </button>
            <button type="button" className="icon-btn" onClick={() => remove(index)} aria-label={`Remove ${itemLabel.toLowerCase()}`}>
              ×
            </button>
          </div>
          {renderItem(item, (next) => set(index, next))}
        </div>
      ))}
      {items.length < max && (
        <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange([...items, makeItem()])}>
          + {addLabel}
        </button>
      )}
    </div>
  );
}

function pointsToText(points = []) {
  return points.map((p) => `${p.label} | ${p.value}`).join('\n');
}

function textToPoints(text) {
  return text
    .split('\n')
    .map((line) => {
      const i = line.lastIndexOf('|');
      if (i === -1) return null;
      const label = line.slice(0, i).trim();
      const value = Number(line.slice(i + 1).trim().replace(/,/g, ''));
      return label && Number.isFinite(value) ? { label, value } : null;
    })
    .filter(Boolean);
}

/** Chart data edited as "Label | value" lines; keeps the raw text while typing. */
export function DataPointsField({ points, onChange }) {
  const [text, setText] = useState(() => pointsToText(points));
  const lastEmitted = useRef(points);

  // Re-sync only when the points change from outside (e.g. discard or regenerate).
  useEffect(() => {
    if (points !== lastEmitted.current) {
      lastEmitted.current = points;
      setText(pointsToText(points));
    }
  }, [points]);

  const parsed = textToPoints(text);
  const badLines = text.split('\n').filter((l) => l.trim()).length - parsed.length;

  return (
    <label className="field">
      <span className="field__label">Data points</span>
      <textarea
        className="textarea textarea--mono"
        rows={Math.max(3, parsed.length + 1)}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const next = textToPoints(e.target.value);
          lastEmitted.current = next;
          onChange(next);
        }}
      />
      <span className="field__hint">
        One per line as <code>Label | value</code>, e.g. <code>Turnout 2021 | 76.6</code>.
        {badLines > 0 && <strong> {badLines} line(s) not understood.</strong>}
      </span>
    </label>
  );
}
