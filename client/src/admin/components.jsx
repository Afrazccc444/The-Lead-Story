import { useEffect, useRef } from 'react';

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

/** Confirmation text shown before an edition is deleted for good. */
export function deleteWarning(edition) {
  const name = `Issue ${edition.issue_number}${edition.lead_headline ? ` — “${edition.lead_headline}”` : ''}`;
  return edition.status === 'published'
    ? `${name} is LIVE on the website.\n\nDeleting it removes it from the site, the All page and your library, along with its photos. This cannot be undone.\n\nDelete it permanently?`
    : `Delete ${name} permanently? Its photos are removed too. This cannot be undone.`;
}

/**
 * Message strip. Success messages with a close handler fade away after a few
 * seconds unless `sticky` (e.g. the share link after publishing).
 */
export function Notice({ tone = 'info', children, onClose, sticky = false }) {
  const close = useRef(onClose);
  close.current = onClose;
  const autoHide = tone === 'good' && !sticky && Boolean(onClose);

  // Timer starts when the message appears (callers pass key={message text} so a
  // new message restarts it); typing elsewhere never resets it.
  useEffect(() => {
    if (!autoHide) return undefined;
    const timer = setTimeout(() => close.current?.(), 4000);
    return () => clearTimeout(timer);
  }, [autoHide]);

  if (!children) return null;
  return (
    <div className={`notice notice--${tone}${autoHide ? ' notice--auto' : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div>{children}</div>
      {onClose && (
        <button type="button" className="notice__close" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
