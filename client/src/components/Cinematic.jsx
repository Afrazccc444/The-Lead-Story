import { useEffect, useRef, useState } from 'react';

export function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// Elements that glide into view as the reader scrolls. The admin live preview
// is excluded so it stays perfectly still while the writer types.
const REVEAL_SELECTOR = [
  '.masthead',
  '.hero',
  '.lead__header',
  '.lead__figure',
  '.metrics',
  '.prose--lead > *',
  '.lead__aside > *',
  '.section-head',
  '.region',
  '.trend',
  '.feature__block',
  '.cta-banner',
  '.editors-note',
  '.sources',
  '.social--edition',
  '.all-group__title',
  '.all-card',
  '.archive-cta',
].join(',');

/**
 * One observer for the whole app: tags matching elements with `.reveal`, then
 * adds `.is-visible` (once) as each scrolls into view, staggering elements
 * that arrive together. New elements (route changes) are picked up automatically.
 */
export function RevealObserver() {
  useEffect(() => {
    if (reducedMotion() || !('IntersectionObserver' in window)) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        let i = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          el.style.setProperty('--reveal-delay', `${Math.min(i++ * 60, 240)}ms`);
          el.classList.add('is-visible');
          io.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    // Safety net: anything on screen (or already scrolled past) that is still
    // hidden gets revealed, so content can never stay invisible.
    let fallback = 0;
    const revealStragglers = () => {
      document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('is-visible');
          io.unobserve(el);
        }
      });
    };

    const scan = () => {
      document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
        if (el.dataset.revealBound || el.closest('.edition--preview, .pe')) return;
        el.dataset.revealBound = '1';
        el.classList.add('reveal');
        io.observe(el);
      });
      clearTimeout(fallback);
      fallback = setTimeout(revealStragglers, 1500);
    };

    let queued = false;
    const mo = new MutationObserver((records) => {
      // Typing in the admin editor changes the DOM constantly — nothing there needs revealing.
      if (records.every((r) => r.target.closest?.('.admin'))) return;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        scan();
      });
    });
    scan();
    mo.observe(document.body, { childList: true, subtree: true });
    // Also check once the intro curtain has lifted.
    const bodyWatcher = new MutationObserver(() => {
      if (!document.body.classList.contains('intro-playing')) setTimeout(revealStragglers, 900);
    });
    bodyWatcher.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => {
      clearTimeout(fallback);
      bodyWatcher.disconnect();
      mo.disconnect();
      io.disconnect();
    };
  }, []);
  return null;
}

/** Thin accent line that fills as the reader scrolls down the page. */
export function ReadingProgress() {
  const bar = useRef(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return <span ref={bar} className="reading-progress" aria-hidden="true" />;
}

/**
 * Counts the number inside a figure like "62%", "$4.1bn" or "1,200 seats" up
 * from zero when it scrolls into view. Text without a number is shown as-is.
 */
export function CountUp({ value, still = false }) {
  const ref = useRef(null);
  const match = /^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/s.exec(value ?? '');
  const [shown, setShown] = useState(() => (match && !still && !reducedMotion() ? null : value));

  useEffect(() => {
    if (!match || still || reducedMotion()) {
      setShown(value);
      return undefined;
    }
    const [, prefix, numText, suffix] = match;
    const target = Number(numText.replace(/,/g, ''));
    const decimals = (numText.split('.')[1] ?? '').length;
    const grouped = numText.includes(',');
    const format = (n) =>
      prefix +
      n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped }) +
      suffix;

    let frame = 0;
    setShown(format(0));
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now() + 100;
        const duration = 900;
        const tick = (now) => {
          const t = Math.min(1, Math.max(0, (now - start) / duration));
          const eased = 1 - (1 - t) ** 4;
          setShown(t >= 1 ? value : format(target * eased));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, still]);

  return <span ref={ref}>{shown ?? value}</span>;
}
