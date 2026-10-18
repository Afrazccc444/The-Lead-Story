import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Moving between pages inside the site (not a refresh — that has its own
 * intro): a sheet of paper covers the screen and unrolls like a scroll, its
 * roller gliding down to reveal the new page underneath.
 */
export default function PageUnroll() {
  const { pathname } = useLocation();
  const previous = useRef(pathname);
  const [run, setRun] = useState(null);

  useEffect(() => {
    if (previous.current === pathname) return; // first load or same page
    previous.current = pathname;
    setRun(Date.now()); // a new key restarts the animation on every page change
  }, [pathname]);

  if (!run) return null;
  return (
    <div key={run} className="page-unroll" aria-hidden="true">
      {/* The sheet always animates (a plain fade when motion is reduced), so it signals the end. */}
      <div className="page-unroll__sheet" onAnimationEnd={() => setRun(null)} />
      <div className="page-unroll__rod" />
    </div>
  );
}
