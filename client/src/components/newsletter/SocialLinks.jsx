import { useSite } from '../../lib/useSite.js';

// Simple monochrome icons drawn in the text colour (24×24 grid).
const ICONS = {
  x: (
    <path d="M4 4l16 16M20 4L4 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10v7M8 7v.01M12 17v-7M12 13c0-2 1.2-3 2.6-3S17 11 17 13v4" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
    </>
  ),
  facebook: (
    <path d="M14 21v-8h3l.5-3.5H14V7.5c0-1 .4-1.7 1.8-1.7H18V2.7C17.4 2.6 16.3 2.5 15.2 2.5 12.6 2.5 11 4 11 6.9v2.6H8V13h3v8z" fill="currentColor" />
  ),
  youtube: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 9l5 3-5 3z" fill="currentColor" />
    </>
  ),
  tiktok: (
    <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.6 2.3 4.3 5 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  ),
  email: (
    <>
      <rect x="2.5" y="5" width="19" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 6l9 7 9-7" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
};

export const SOCIAL_NETWORKS = [
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/yourname' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/yourname' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/yourname' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://www.facebook.com/yourpage' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://www.youtube.com/@yourchannel' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://www.tiktok.com/@yourname' },
  { key: 'email', label: 'Email', placeholder: 'mailto:you@example.com' },
];

export function SocialIcon({ network }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      {ICONS[network]}
    </svg>
  );
}

/**
 * Cluster of social media icons linking to the accounts set in Admin → Settings.
 * In the admin preview, unset networks show as faint placeholders.
 */
export default function SocialLinks({ title, preview = false, className = '' }) {
  const site = useSite();
  const social = site?.social ?? {};
  const networks = SOCIAL_NETWORKS.filter((n) => social[n.key] || preview);
  if (!networks.length) return null;

  return (
    <div className={`social ${className}`}>
      {title && <p className="social__title">{title}</p>}
      <ul className="social__list">
        {networks.map((n) => (
          <li key={n.key}>
            {social[n.key] ? (
              <a
                className="social__link"
                href={social[n.key]}
                target={n.key === 'email' ? undefined : '_blank'}
                rel="noopener noreferrer"
                aria-label={n.label}
                title={n.label}
              >
                <SocialIcon network={n.key} />
              </a>
            ) : (
              <span className="social__link social__link--placeholder" title={`${n.label} — add the link in Settings`}>
                <SocialIcon network={n.key} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
