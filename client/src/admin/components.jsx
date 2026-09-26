const EDITION_STATUS = {
  draft: { icon: '○', label: 'Draft', tone: 'warn' },
  published: { icon: '●', label: 'Published', tone: 'good' },
};

/** Status chip: shape + label, never colour alone. */
export function EditionStatus({ status }) {
  const spec = EDITION_STATUS[status];
  if (!spec) return null;
  return (
    <span className={`chip chip--${spec.tone}`}>
      <span aria-hidden="true">{spec.icon}</span> {spec.label}
    </span>
  );
}

export function Notice({ tone = 'info', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div>{children}</div>
      {onClose && (
        <button type="button" className="notice__close" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
