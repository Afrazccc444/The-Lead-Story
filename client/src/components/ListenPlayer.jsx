import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildScript, rankVoices, voiceLabel } from '../lib/readAloud.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
export const canListen = Boolean(synth && typeof window.SpeechSynthesisUtterance === 'function');

const SPEEDS = [0.85, 0.95, 1, 1.1, 1.25];
const store = {
  get(key, fallback) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode etc. */
    }
  },
};

/** Loads the browser's voices (they arrive asynchronously in Chrome/Edge). */
function useVoices() {
  const [voices, setVoices] = useState(() => (synth ? rankVoices(synth.getVoices()) : []));
  useEffect(() => {
    if (!synth) return undefined;
    const update = () => setVoices(rankVoices(synth.getVoices()));
    update();
    synth.addEventListener?.('voiceschanged', update);
    return () => synth.removeEventListener?.('voiceschanged', update);
  }, []);
  return voices;
}

const Icon = ({ d, filled }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d={d} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);
const ICONS = {
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M7 4h3.5v16H7zM13.5 4H17v16h-3.5z',
  back: 'M11 6l-6 6 6 6M19 6l-6 6 6 6',
  next: 'M13 6l6 6-6 6M5 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  speaker: 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
};

/**
 * "Listen" button + bottom player that reads the edition aloud in a calm
 * presenter style. Speech is spoken sentence by sentence (reliable in every
 * browser) with natural pauses between paragraphs and sections.
 */
export default function ListenPlayer({ edition }) {
  const script = useMemo(() => buildScript(edition), [edition]);
  const voices = useVoices();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [rate, setRate] = useState(() => Number(store.get('tls-voice-rate', '1')) || 1);
  const [voiceName, setVoiceName] = useState(() => store.get('tls-voice', ''));
  const run = useRef(0); // increments to cancel any speech in progress
  const timer = useRef(null);

  const voice = voices.find((v) => v.name === voiceName) ?? voices[0] ?? null;

  const stop = useCallback(() => {
    run.current++;
    clearTimeout(timer.current);
    synth?.cancel();
    setPlaying(false);
  }, []);

  const speakFrom = useCallback(
    (start) => {
      if (!synth || !script.length) return;
      stop();
      const token = ++run.current;
      setPlaying(true);
      const step = (i) => {
        if (token !== run.current) return;
        if (i >= script.length) {
          setPlaying(false);
          setIndex(0);
          return;
        }
        setIndex(i);
        const utter = new SpeechSynthesisUtterance(script[i].text);
        if (voice) {
          utter.voice = voice;
          utter.lang = voice.lang;
        } else {
          utter.lang = 'en-GB';
        }
        utter.rate = rate * 0.97; // a touch slower than default: unhurried, newsreader pace
        utter.pitch = 1;
        utter.onend = () => {
          if (token !== run.current) return;
          timer.current = setTimeout(() => step(i + 1), script[i].pause / rate);
        };
        utter.onerror = (e) => {
          if (token !== run.current || e.error === 'interrupted' || e.error === 'canceled') return;
          timer.current = setTimeout(() => step(i + 1), 200);
        };
        synth.speak(utter);
      };
      step(Math.max(0, Math.min(start, script.length - 1)));
    },
    [script, voice, rate, stop],
  );

  // Stop talking when leaving the page or switching edition.
  useEffect(() => stop, [stop, edition.id]);

  // Changing voice or speed mid-way restarts the current sentence with the new setting.
  const restartWith = useRef(false);
  const resumeAfterScrub = useRef(false);
  useEffect(() => {
    if (restartWith.current && playing) speakFrom(index);
    restartWith.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, rate]);

  if (!canListen || !script.length) return null;

  const resumeScrub = (value) => {
    if (!resumeAfterScrub.current) return;
    resumeAfterScrub.current = false;
    speakFrom(Number(value));
  };

  const section = script[index]?.section ?? '';
  const progress = script.length > 1 ? index / (script.length - 1) : 0;

  // Jump to the previous/next paragraph (the next item after a longer pause).
  const jump = (dir) => {
    let i = index;
    if (dir < 0) {
      i = Math.max(0, i - 1);
      while (i > 0 && script[i - 1].pause < 350) i--;
    } else {
      while (i < script.length - 1 && script[i].pause < 350) i++;
      i = Math.min(script.length - 1, i + 1);
    }
    setIndex(i);
    if (playing) speakFrom(i);
  };

  return (
    <>
      <button
        type="button"
        className="btn btn--ghost btn--small listen-btn"
        onClick={() => {
          setOpen(true);
          if (!playing) speakFrom(index);
        }}
        aria-label="Listen to this edition read aloud"
      >
        <Icon d={ICONS.speaker} />
        {playing ? 'Listening…' : 'Listen'}
      </button>

      {open && (
        <div className="listen-player" role="region" aria-label="Read-aloud player">
          {/* Scrub bar: drag or click to jump to any point in the edition */}
          <input
            type="range"
            className="listen-player__scrub"
            min={0}
            max={Math.max(0, script.length - 1)}
            step={1}
            value={index}
            style={{ '--progress': `${progress * 100}%` }}
            aria-label={`Position in the edition: ${section}`}
            aria-valuetext={`${Math.round(progress * 100)}% — ${section}`}
            onChange={(e) => {
              setIndex(Number(e.target.value));
              if (playing) {
                // Pause while dragging; resume from the new spot on release.
                resumeAfterScrub.current = true;
                stop();
              }
            }}
            onPointerUp={(e) => resumeScrub(e.currentTarget.value)}
            onKeyUp={(e) => resumeScrub(e.currentTarget.value)}
          />
          <div className="listen-player__inner">
            <div className="listen-player__now">
              <span className="listen-player__eyebrow">{playing ? 'Now reading' : 'Paused'}</span>
              <span className="listen-player__title">
                The Lead Story · Issue {edition.issue_number} — <em>{section}</em>
              </span>
            </div>

            <div className="listen-player__controls">
              <button type="button" className="listen-ctl" onClick={() => jump(-1)} aria-label="Previous paragraph">
                <Icon d={ICONS.back} />
              </button>
              <button
                type="button"
                className="listen-ctl listen-ctl--main"
                onClick={() => (playing ? stop() : speakFrom(index))}
                aria-label={playing ? 'Pause' : 'Play'}
              >
                <Icon d={playing ? ICONS.pause : ICONS.play} filled />
              </button>
              <button type="button" className="listen-ctl" onClick={() => jump(1)} aria-label="Next paragraph">
                <Icon d={ICONS.next} />
              </button>
            </div>

            <div className="listen-player__settings">
              <label>
                <span className="visually-hidden">Speed</span>
                <select
                  value={rate}
                  onChange={(e) => {
                    restartWith.current = true;
                    setRate(Number(e.target.value));
                    store.set('tls-voice-rate', e.target.value);
                  }}
                >
                  {SPEEDS.map((s) => (
                    <option key={s} value={s}>
                      {s}×
                    </option>
                  ))}
                </select>
              </label>
              {voices.length > 1 && (
                <label>
                  <span className="visually-hidden">Voice</span>
                  <select
                    value={voice?.name ?? ''}
                    onChange={(e) => {
                      restartWith.current = true;
                      setVoiceName(e.target.value);
                      store.set('tls-voice', e.target.value);
                    }}
                  >
                    {voices.slice(0, 12).map((v) => (
                      <option key={v.name} value={v.name}>
                        {voiceLabel(v)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="listen-ctl"
                onClick={() => {
                  stop();
                  setOpen(false);
                }}
                aria-label="Close player"
              >
                <Icon d={ICONS.close} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
