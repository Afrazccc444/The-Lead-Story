import { useEffect, useState } from 'react';

const KEY = 'tls-warm-light';

function savedChoice() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * "Warm light" (anti blue light): tints the whole page golden for readers who
 * find a warmer screen easier on the eyes, especially in the evening.
 * The choice is remembered on this device.
 */
export default function WarmLightToggle() {
  const [warm, setWarm] = useState(savedChoice);

  useEffect(() => {
    document.documentElement.classList.toggle('warm-light', warm);
    try {
      localStorage.setItem(KEY, warm ? '1' : '0');
    } catch {
      /* private mode: works for this visit only */
    }
  }, [warm]);

  return (
    <button
      type="button"
      className={`warm-toggle${warm ? ' is-on' : ''}`}
      onClick={() => setWarm((w) => !w)}
      aria-pressed={warm}
      aria-label={warm ? 'Turn off warm light' : 'Turn on warm light (reduces blue light)'}
      title={warm ? 'Warm light on — click to turn off' : 'Warm light: reduce blue light'}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </g>
      </svg>
      <span className="warm-toggle__label">{warm ? 'Warm on' : 'Warm light'}</span>
    </button>
  );
}
