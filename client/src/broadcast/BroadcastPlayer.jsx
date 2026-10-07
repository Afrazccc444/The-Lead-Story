import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatLongDate } from '../lib/format.js';
import { createMusic } from './music.js';
import { buildBroadcast, pickAnchorVoice } from './script.js';
import { createStudio } from './studio.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const canSpeak = Boolean(synth && window.SpeechSynthesisUtterance);

function useVoices() {
  const [voices, setVoices] = useState(() => synth?.getVoices() ?? []);
  useEffect(() => {
    if (!synth) return undefined;
    const update = () => setVoices(synth.getVoices());
    update();
    synth.addEventListener?.('voiceschanged', update);
    return () => synth.removeEventListener?.('voiceschanged', update);
  }, []);
  return voices;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * The video report: a live-rendered 3D newsroom where a robot anchor reads
 * the edition — opening titles with music, the headlines, then every story
 * in detail — with TV graphics, captions and chapter controls.
 */
export default function BroadcastPlayer({ edition }) {
  // Rebuild only when the edition itself changes (not on background data refreshes).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const show = useMemo(() => buildBroadcast(edition), [edition.id, edition.updated_at]);
  const voices = useVoices();
  const englishVoices = useMemo(() => voices.filter((v) => /^en/i.test(v.lang)), [voices]);
  const [voiceName, setVoiceName] = useState('');
  const voice = englishVoices.find((v) => v.name === voiceName) ?? pickAnchorVoice(englishVoices);

  const [phase, setPhase] = useState('poster'); // poster | intro | live | paused | ended
  const [index, setIndex] = useState(0);
  const [lower, setLower] = useState(null);
  const [caption, setCaption] = useState('');
  const [captionsOn, setCaptionsOn] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.8);
  const [flash, setFlash] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const clock = useClock();

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const clipRef = useRef(null);
  const [activeClip, setActiveClip] = useState(null);
  const musicVolumeRef = useRef(0.8);
  const studioRef = useRef(null);
  const musicRef = useRef(null);
  const run = useRef(0);
  const timer = useRef(null);
  const speaking = useRef(false);
  const lastWord = useRef(0);
  const date = edition.publication_date ? formatLongDate(edition.publication_date) : '';
  const stillShot = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('shot') : null;

  // ── Build the 3D studio once ──
  useEffect(() => {
    let studio;
    try {
      studio = createStudio(canvasRef.current);
    } catch (err) {
      console.error(err);
      setWebglError(true);
      return undefined;
    }
    studioRef.current = studio;
    studio.setMeta({ issue: `Issue ${edition.issue_number}`, date });
    studio.setScreen(show.cues[0]?.screen);
    if (stillShot) studio.setShot(stillShot);
    // The robot's mouth follows the voice: a burst on every word, a gentle level while speaking.
    studio.setTalkSource(() => {
      if (!speaking.current) return 0;
      const sinceWord = performance.now() - lastWord.current;
      return 0.35 + 0.65 * Math.max(0, 1 - sinceWord / 240);
    });
    return () => {
      run.current++;
      clearTimeout(timer.current);
      synth?.cancel();
      speaking.current = false;
      musicRef.current?.close();
      musicRef.current = null;
      studio.dispose();
      studioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const stopSpeech = useCallback(() => {
    run.current++;
    clearTimeout(timer.current);
    synth?.cancel();
    speaking.current = false;
    clipRef.current?.pause();
  }, []);

  const showCue = useCallback(
    (i) => {
      const cue = show.cues[i];
      if (!cue) return;
      const studio = studioRef.current;
      studio?.setScreen(cue.screen);
      if (cue.shot) studio?.setShot(cue.shot);
      setLower(cue.lower);
      setCaption(cue.type === 'clip' ? '' : cue.text);
      setActiveClip(cue.type === 'clip' ? cue.clip : null);
      setIndex(i);
    },
    [show],
  );

  const speakFrom = useCallback(
    (start, { resume = false } = {}) => {
      stopSpeech();
      const token = run.current;
      setPhase('live');
      const step = (i) => {
        if (token !== run.current) return;
        if (i >= show.cues.length) {
          speaking.current = false;
          setPhase('ended');
          musicRef.current?.stopBed();
          musicRef.current?.sting();
          studioRef.current?.setShot('wide');
          return;
        }
        // A short musical hit whenever a new story begins
        const newStory = i > start && show.cues[i].story !== show.cues[i - 1].story;
        if (newStory) musicRef.current?.sting();
        showCue(i);
        const cue = show.cues[i];
        const next = () => {
          speaking.current = false;
          if (token !== run.current) return;
          timer.current = setTimeout(() => step(i + 1), cue.pause + (show.cues[i + 1] && show.cues[i + 1].story !== cue.story ? 700 : 0));
        };
        if (cue.type === 'clip') {
          // Editor-uploaded footage: full screen, with sound; the music bed dips underneath.
          const video = clipRef.current;
          if (!video) return next();
          const sameClip = video.getAttribute('src') === cue.clip.url;
          if (!sameClip) video.setAttribute('src', cue.clip.url);
          if (!(resume && sameClip && i === start)) video.currentTime = 0;
          musicRef.current?.setVolume(musicVolumeRef.current * 0.2);
          const finish = () => {
            video.onended = null;
            video.onerror = null;
            musicRef.current?.setVolume(musicVolumeRef.current);
            next();
          };
          video.onended = finish;
          video.onerror = finish;
          video.play().catch(finish);
          return;
        }
        if (!canSpeak) {
          // No speech engine: keep the show moving at reading pace, captions on.
          speaking.current = true;
          timer.current = setTimeout(next, Math.max(1600, cue.text.split(/\s+/).length * 380));
          return;
        }
        const utter = new SpeechSynthesisUtterance(cue.text);
        if (voice) {
          utter.voice = voice;
          utter.lang = voice.lang;
        } else utter.lang = 'en-GB';
        // Measured newsreader pace, varied a little line to line so it never sounds mechanical.
        utter.rate = 0.94 + Math.random() * 0.05 + (/\?$/.test(cue.text) ? 0.02 : 0);
        utter.pitch = 0.93 + Math.random() * 0.04;
        // Gestures that suit the line
        if (newStory || i === start) studioRef.current?.gesture('open', 2.4);
        else if (/\?/.test(cue.text)) studioRef.current?.gesture('spread', 2.2);
        else if (/\d/.test(cue.text) && Math.random() < 0.5) studioRef.current?.gesture('point', 1.8);
        utter.onstart = () => {
          speaking.current = true;
          lastWord.current = performance.now();
        };
        utter.onboundary = () => {
          lastWord.current = performance.now();
        };
        utter.onend = next;
        utter.onerror = (e) => {
          if (e.error === 'interrupted' || e.error === 'canceled') return;
          next();
        };
        synth.speak(utter);
      };
      step(start);
    },
    [show, voice, showCue, stopSpeech],
  );

  async function start() {
    if (webglError) return;
    stopSpeech();
    musicRef.current?.close();
    const music = createMusic();
    music.setVolume(musicVolume);
    musicRef.current = music;
    setPhase('intro');
    setLower(null);
    setCaption('');
    studioRef.current?.setMode('intro');
    await music.playIntro();
    if (musicRef.current !== music) return; // closed meanwhile
    setFlash(true);
    setTimeout(() => setFlash(false), 650);
    studioRef.current?.setMode('studio');
    music.startBed(0.045);
    speakFrom(0);
  }

  function pause() {
    stopSpeech();
    studioRef.current?.setPaused(true);
    musicRef.current?.suspend();
    setPhase('paused');
  }

  function resume() {
    musicRef.current?.resume();
    studioRef.current?.setPaused(false);
    speakFrom(index, { resume: true });
  }

  function jumpToStory(storyIndex) {
    const i = show.cues.findIndex((c) => c.story === storyIndex);
    if (i < 0) return;
    if (phase === 'poster' || phase === 'intro') {
      if (!musicRef.current) {
        const music = createMusic();
        music.setVolume(musicVolume);
        musicRef.current = music;
      }
      studioRef.current?.setMode('studio');
      musicRef.current.startBed(0.045);
    }
    musicRef.current?.resume();
    speakFrom(i);
  }

  const currentStory = show.cues[index]?.story ?? 0;

  function toggleFullscreen() {
    const el = wrapRef.current;
    if (!document.fullscreenElement) el?.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }

  // Keyboard: space = play/pause, → = next story, ← = previous, f = fullscreen, c = captions
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, select, textarea, button')) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (phase === 'poster' || phase === 'ended') start();
        else if (phase === 'live') pause();
        else if (phase === 'paused') resume();
      } else if (e.key === 'ArrowRight') jumpToStory(Math.min(show.stories.length - 1, currentStory + 1));
      else if (e.key === 'ArrowLeft') jumpToStory(Math.max(0, currentStory - 1));
      else if (e.key === 'f') toggleFullscreen();
      else if (e.key === 'c') setCaptionsOn((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const progress = show.cues.length > 1 ? index / (show.cues.length - 1) : 0;

  return (
    <div className="broadcast">
      <div ref={wrapRef} className={`broadcast__stage broadcast__stage--${phase}`}>
        <canvas ref={canvasRef} className="broadcast__canvas" aria-label="3D newsroom with a robot news anchor" />
        {/* Editor-uploaded footage plays here, full screen, at its story */}
        <video ref={clipRef} className={`bc-clip${activeClip && (phase === 'live' || phase === 'paused') ? ' is-on' : ''}`} playsInline preload="auto" />
        {activeClip && (phase === 'live' || phase === 'paused') && <span className="bc-clip__badge">VIDEO REPORT</span>}

        {webglError && (
          <div className="broadcast__fallback">
            <p>Your browser can’t show the 3D studio (WebGL is turned off). Try Microsoft Edge or Google Chrome.</p>
          </div>
        )}

        {/* Station graphics */}
        {(phase === 'live' || phase === 'paused' || phase === 'ended') && (
          <>
            <div className="bc-bug">
              <span className="bc-bug__live">
                <span className="bc-bug__dot" /> LIVE
              </span>
              <span className="bc-bug__brand">
                <span className="bc-bug__mark">L</span>The Lead Story
              </span>
            </div>
            <div className="bc-clock">{clock}</div>
          </>
        )}

        {lower && (phase === 'live' || phase === 'paused') && (
          <div key={`${lower.tag}${lower.title}`} className="bc-lower">
            <span className="bc-lower__tag">{lower.tag}</span>
            <span className="bc-lower__title">{lower.title}</span>
            {lower.sub && <span className="bc-lower__sub">{lower.sub}</span>}
          </div>
        )}

        {captionsOn && caption && (phase === 'live' || phase === 'paused') && <div className="bc-caption">{caption}</div>}

        {(phase === 'live' || phase === 'paused') && (
          <div className="bc-ticker" aria-hidden="true">
            <span className="bc-ticker__label">HEADLINES</span>
            <div className="bc-ticker__track">
              <span>{[...show.headlines, ...show.headlines].join('   •   ')}</span>
            </div>
          </div>
        )}

        {/* Opening titles (over the 3D intro) */}
        {phase === 'intro' && (
          <div className="bc-intro" aria-hidden="true">
            <p className="bc-intro__kicker">Weekly briefing · Issue {edition.issue_number}</p>
            <h2 className="bc-intro__title">
              {'The Lead Story'.split('').map((ch, i) => (
                <span key={i} style={{ animationDelay: `${1.2 + i * 0.08}s` }}>
                  {ch === ' ' ? ' ' : ch}
                </span>
              ))}
            </h2>
            <p className="bc-intro__date">{date}</p>
          </div>
        )}
        {flash && <div className="bc-flash" />}

        {/* Poster / end screen */}
        {(phase === 'poster' || phase === 'ended') && !webglError && !stillShot && (
          <div className="bc-poster">
            <p className="bc-poster__kicker">{phase === 'ended' ? 'That was' : 'Video report'} · Issue {edition.issue_number}</p>
            <h2 className="bc-poster__title">{edition.content?.lead_story?.headline || edition.lead_headline || 'The Lead Story'}</h2>
            <button type="button" className="bc-play" onClick={start} aria-label={phase === 'ended' ? 'Watch again' : 'Play the video report'}>
              <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </button>
            <p className="bc-poster__meta">
              {phase === 'ended' ? 'Watch again' : `About ${show.estimateMinutes} min · ${Math.max(1, show.stories.length - 3)} ${show.stories.length - 3 === 1 ? 'story' : 'stories'} · sound on`}
            </p>
          </div>
        )}

        {phase === 'paused' && (
          <button type="button" className="bc-paused" onClick={resume} aria-label="Resume">
            ❚❚ Paused — click to resume
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="bc-controls">
        <div className="bc-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
        <div className="bc-controls__row">
          {phase === 'live' ? (
            <button type="button" className="bc-btn bc-btn--main" onClick={pause} aria-label="Pause">
              ❚❚
            </button>
          ) : (
            <button type="button" className="bc-btn bc-btn--main" onClick={phase === 'paused' ? resume : start} aria-label="Play">
              ▶
            </button>
          )}
          <button type="button" className="bc-btn" onClick={() => jumpToStory(Math.max(0, currentStory - 1))} aria-label="Previous story">
            ⏮
          </button>
          <button type="button" className="bc-btn" onClick={() => jumpToStory(Math.min(show.stories.length - 1, currentStory + 1))} aria-label="Next story">
            ⏭
          </button>
          <span className="bc-now">{show.stories[currentStory]}</span>
          <label className="bc-volume">
            <span>Music</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVolume}
              onChange={(e) => {
                setMusicVolume(Number(e.target.value));
                musicVolumeRef.current = Number(e.target.value);
                musicRef.current?.setVolume(Number(e.target.value));
              }}
            />
          </label>
          <button type="button" className={`bc-btn${captionsOn ? ' is-on' : ''}`} onClick={() => setCaptionsOn((v) => !v)} aria-pressed={captionsOn}>
            CC
          </button>
          {englishVoices.length > 1 && (
            <select className="bc-voice" value={voice?.name ?? ''} onChange={(e) => setVoiceName(e.target.value)} aria-label="Anchor voice">
              {englishVoices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name.replace(/^Microsoft |^Google /, '').replace(/ - English.*$/, '')}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="bc-btn" onClick={toggleFullscreen} aria-label="Full screen">
            ⛶
          </button>
        </div>
      </div>

      {/* Chapters */}
      <ol className="bc-chapters">
        {show.stories.map((s, i) => (
          <li key={i} className={i === currentStory && phase !== 'poster' ? 'is-current' : ''}>
            <button type="button" onClick={() => jumpToStory(i)}>
              <span className="bc-chapters__num">{String(i + 1).padStart(2, '0')}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      {!canSpeak && <p className="bc-note">This browser has no speech voice, so the report plays with captions only.</p>}
    </div>
  );
}
