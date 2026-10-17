/**
 * "Published by" badge at the bottom of every article from an approved
 * company: their logo (if they uploaded one) and their name.
 */
export default function PublisherBadge({ name, logo, suspended = false }) {
  if (!name) return null;
  return (
    <aside className={`publisher-badge${suspended ? ' publisher-badge--suspended' : ''}`} aria-label={`Published by ${name}${suspended ? ' (suspended account)' : ''}`}>
      {logo ? (
        <img className="publisher-badge__logo" src={logo} alt="" />
      ) : (
        <span className="publisher-badge__initial" aria-hidden="true">
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span className="publisher-badge__text">
        <span className="publisher-badge__label">Published by</span>
        <span className="publisher-badge__name">{name}</span>
        {suspended ? (
          <span className="publisher-badge__note publisher-badge__note--bad">
            <strong>Suspended account</strong> — suspended for wrongful information
          </span>
        ) : (
          <span className="publisher-badge__note">An approved publisher on The Lead Story</span>
        )}
      </span>
    </aside>
  );
}
