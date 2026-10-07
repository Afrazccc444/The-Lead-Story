import { useEffect, useRef, useState } from 'react';
import { uploadImage, uploadVideo } from '../lib/upload.js';

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

function firstImage(list) {
  return [...(list ?? [])].find((f) => f.type?.startsWith('image/')) ?? null;
}

/** Pick, drop or replace a single image. `value` is its URL ('' when empty). */
export function ImageUpload({ label = 'Image', value, onChange, hint }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [over, setOver] = useState(false);

  async function handle(file) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div
        className={`image-drop${over ? ' image-drop--over' : ''}${value ? ' image-drop--filled' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(firstImage(e.dataTransfer.files));
        }}
      >
        {value ? <img src={value} alt="" className="image-drop__preview" /> : <span className="image-drop__empty">Drag a photo here, or</span>}
        <div className="image-drop__actions">
          <button type="button" className="btn btn--ghost btn--small" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? 'Uploading…' : value ? 'Replace image' : 'Choose image'}
          </button>
          {value && !busy && (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange('')}>
              Remove
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          hidden
          onChange={(e) => {
            handle(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {error && <span className="form-error">{error}</span>}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

/**
 * Markdown textarea with an "Insert image" button. Images can also be pasted
 * or dropped straight into the text; they are inserted at the cursor as
 * ![caption](/uploads/…) and appear as captioned photos in the article.
 */
export function MarkdownField({ label, value, onChange, hint, rows = 12 }) {
  const area = useRef(null);
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function insert(file) {
    if (!file) return;
    const el = area.current;
    const start = el?.selectionStart ?? (value ?? '').length;
    const end = el?.selectionEnd ?? start;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      const text = value ?? '';
      const before = text.slice(0, start);
      const snippet = `${before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''}![Write a caption here](${url})\n\n`;
      onChange(before + snippet + text.slice(end));
      // Select the placeholder caption so the writer can type over it.
      requestAnimationFrame(() => {
        if (!el) return;
        const captionStart = before.length + snippet.indexOf('[') + 1;
        el.focus();
        el.setSelectionRange(captionStart, captionStart + 'Write a caption here'.length);
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <div className="field__row">
        <span className="field__label">{label}</span>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : '🖼 Insert image'}
        </button>
      </div>
      <textarea
        ref={area}
        className="textarea textarea--mono"
        rows={rows}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          const file = firstImage(e.clipboardData?.files);
          if (file) {
            e.preventDefault();
            insert(file);
          }
        }}
        onDrop={(e) => {
          const file = firstImage(e.dataTransfer?.files);
          if (file) {
            e.preventDefault();
            insert(file);
          }
        }}
      />
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        hidden
        onChange={(e) => {
          insert(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error && <span className="form-error">{error}</span>}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

/** Pick or drop a video clip; shows upload progress and a small preview. */
export function VideoUpload({ label = 'Video clip', value, onChange, hint }) {
  const input = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  async function handle(file) {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      onChange(await uploadVideo(file, setProgress));
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div
        className={`image-drop${value ? ' image-drop--filled' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handle([...(e.dataTransfer.files ?? [])].find((f) => f.type.startsWith('video/')));
        }}
      >
        {value ? (
          <video src={value} className="video-drop__preview" controls preload="metadata" />
        ) : (
          <span className="image-drop__empty">Drag a video here, or</span>
        )}
        <div className="image-drop__actions">
          <button type="button" className="btn btn--ghost btn--small" onClick={() => input.current?.click()} disabled={progress !== null}>
            {progress !== null ? `Uploading… ${Math.round(progress * 100)}%` : value ? 'Replace video' : 'Choose video'}
          </button>
          {value && progress === null && (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange('')}>
              Remove
            </button>
          )}
        </div>
        {progress !== null && (
          <div className="upload-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mov,.m4v"
          hidden
          onChange={(e) => {
            handle(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {error && <span className="form-error">{error}</span>}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}
