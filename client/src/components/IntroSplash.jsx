import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { formatLongDate } from '../lib/format.js';

export const INTRO_EVENT = 'lead-story:intro';

/** Replay the intro (e.g. right after an editor signs in). */
export function playIntro() {
  window.dispatchEvent(new Event(INTRO_EVENT));
}

const TITLE = 'Lead Story';
const HOLD_MS = 3200; // time on screen before the curtain lifts (long enough to read the credit)
const LIFT_MS = 900; // curtain lift duration (matches CSS)

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Full-screen opening animation shown on every page load / refresh and after
 * signing in: accent rule draws, masthead letters rise, tagline and date fade
 * in, then the dark curtain lifts to reveal the page. Click, tap or press any
 * key to skip.
 */
export default function IntroSplash() {
  const location = useLocation();
  const [phase, setPhase] = useState('playing'); // playing | lifting | done
  const [run, setRun] = useState(0); // bump to replay
  const timers = useRef([]);
  const editor = location.pathname.startsWith('/admin');

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const lift = useCallback(() => {
    clearTimers();
    setPhase('lifting');
    timers.current.push(setTimeout(() => setPhase('done'), prefersReducedMotion() ? 250 : LIFT_MS));
  }, []);

  // Start (or restart) the sequence.
  useEffect(() => {
    setPhase('playing');
    timers.current.push(setTimeout(lift, prefersReducedMotion() ? 700 : HOLD_MS));
    return clearTimers;
  }, [run, lift]);

  // Replays requested elsewhere (after login).
  useEffect(() => {
    const replay = () => setRun((n) => n + 1);
    window.addEventListener(INTRO_EVENT, replay);
    return () => window.removeEventListener(INTRO_EVENT, replay);
  }, []);

  // While the intro plays, page reveals are held back so they play as the curtain lifts.
  useEffect(() => {
    document.body.classList.toggle('intro-playing', phase === 'playing');
    return () => document.body.classList.remove('intro-playing');
  }, [phase]);

  // Skip on any key; keep the page from scrolling underneath.
  useEffect(() => {
    if (phase === 'done') return undefined;
    const onKey = () => phase === 'playing' && lift();
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [phase, lift]);

  if (phase === 'done') return null;

  return (
    <div
      key={run}
      className={`intro intro--${phase}${prefersReducedMotion() ? ' intro--reduced' : ''}`}
      onClick={() => phase === 'playing' && lift()}
      role="presentation"
    >
      <div className="intro__stage" aria-hidden="true">
        <p className="intro__kicker">{editor ? 'Editor’s desk' : 'Global politics · Weekly'}</p>
        <span className="intro__rule intro__rule--top" />
        <p className="intro__the">The</p>
        <h1 className="intro__title">
          {TITLE.split('').map((ch, i) => (
            <span key={i} className="intro__letter" style={{ animationDelay: `${0.55 + i * 0.05}s` }}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </h1>
        <span className="intro__rule intro__rule--double" />
        <p className="intro__tagline">{editor ? 'Welcome back — the newsroom is ready' : 'We bring you the latest news'}</p>
        <p className="intro__date">{formatLongDate(new Date())}</p>
      </div>
      <div className="intro__footer" aria-hidden="true">
        <p className="intro__credit">
          by <span>Afraz Muhammed Cheema</span>
        </p>
        <p className="intro__skip">Click or press any key to skip</p>
      </div>
      <span className="visually-hidden" role="status">
        The Lead Story — {editor ? 'editor’s desk loading' : 'loading the latest edition'}
      </span>
    </div>
  );
}
