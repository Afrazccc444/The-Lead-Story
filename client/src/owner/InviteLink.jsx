import { useState } from 'react';

/**
 * The one-time link an approved publisher opens to choose their password.
 * Shown once — the owner copies it or emails it straight away.
 */
export default function InviteLink({ path, account, onDone }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${path}`;
  const name = account?.display_name || account?.organisation || account?.username;
  const mail = account?.email
    ? `mailto:${account.email}?subject=${encodeURIComponent('Your The Lead Story publishing account')}&body=${encodeURIComponent(
        `Hello ${name},\n\nYour request to publish on The Lead Story has been approved.\n\nYour username: ${account.username}\n\nOpen this link to choose your password (it works once and expires in 14 days):\n${url}\n\nAfterwards, sign in at ${window.location.origin}/admin\n\nWelcome aboard,\nThe Lead Story`,
      )}`
    : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  return (
    <div className="invite-box" role="status">
      <p className="invite-box__title">
        Account ready{account?.username ? <> — username <strong>{account.username}</strong></> : null}
      </p>
      <p className="invite-box__hint">
        Send this one-time link to the publisher. They open it, choose their own password, and can start writing. It
        works once and expires in 14 days. For safety it is shown only now.
      </p>
      <div className="invite-box__row">
        <input className="input invite-box__url" value={url} readOnly onFocus={(e) => e.target.select()} aria-label="Setup link" />
        <button type="button" className="btn btn--primary btn--small" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
        {mail && (
          <a className="btn btn--ghost btn--small" href={mail}>
            Email it
          </a>
        )}
      </div>
      {onDone && (
        <button type="button" className="btn btn--ghost btn--small" onClick={onDone}>
          Done
        </button>
      )}
    </div>
  );
}
