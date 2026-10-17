import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const seenKey = (slug) => `tls-suspended-ok:${slug}`;

function alreadyAccepted(slug) {
  try {
    return sessionStorage.getItem(seenKey(slug)) === '1';
  } catch {
    return false;
  }
}

/**
 * Shown instead of an article whose publisher's account has been suspended
 * (while the owner hasn't unpublished or deleted it): readers are warned and
 * choose whether to continue. The choice lasts for this browser tab session.
 * Renders the article (children) once accepted.
 */
export default function SuspendedGate({ edition, children }) {
  const [accepted, setAccepted] = useState(() => alreadyAccepted(edition.slug));
  const navigate = useNavigate();
  if (!edition.publisher_suspended || accepted) return children;

  function proceed() {
    try {
      sessionStorage.setItem(seenKey(edition.slug), '1');
    } catch {
      /* private mode: just continue */
    }
    setAccepted(true);
  }

  function leave() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/all');
  }

  return (
    <div className="suspended-gate" role="alertdialog" aria-labelledby="suspended-title" aria-describedby="suspended-text">
      <p className="suspended-gate__mark" aria-hidden="true">
        !
      </p>
      <p className="suspended-gate__label">Suspended account</p>
      <h1 id="suspended-title" className="suspended-gate__title">
        This account is suspended for wrongful information
      </h1>
      <p id="suspended-text" className="suspended-gate__text">
        <strong>{edition.publisher}</strong>, the publisher of “{edition.lead_headline || `Issue ${edition.issue_number}`}”, has
        been suspended by The Lead Story for publishing wrongful information. This article may contain false or misleading
        claims.
      </p>
      <p className="suspended-gate__question">Do you want to proceed?</p>
      <div className="suspended-gate__actions">
        <button type="button" className="btn btn--primary" onClick={leave} autoFocus>
          Don’t proceed
        </button>
        <button type="button" className="btn btn--ghost" onClick={proceed}>
          Proceed to the article
        </button>
      </div>
    </div>
  );
}

/** Small red label for lists and bylines. */
export function SuspendedChip() {
  return <span className="suspended-chip">Suspended account</span>;
}
