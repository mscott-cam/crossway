import { SEEK_GRACE_MS, readyToReveal } from '../lib/video/hero-reveal';
import {
  HERO_PAUSED_KEY,
  controlLabel,
  readStoredPause,
  serializePause,
  shouldPlay,
  showsControl,
  type PlaybackInput,
} from '../lib/video/hero-playback';

interface VideoSource {
  src: string;
  type: string;
  media?: string;
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const saveData = () =>
  Boolean(
    (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData,
  );

function loadPaused() {
  try {
    return readStoredPause(sessionStorage.getItem(HERO_PAUSED_KEY));
  } catch {
    return false;
  }
}

function storePaused(paused: boolean) {
  try {
    const value = serializePause(paused);
    if (value === null) sessionStorage.removeItem(HERO_PAUSED_KEY);
    else sessionStorage.setItem(HERO_PAUSED_KEY, value);
  } catch {
    return;
  }
}

const PAUSE_ICON =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3.5 2h3v12h-3zM9.5 2h3v12h-3z"/></svg>';
const PLAY_ICON =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 2.2v11.6a.4.4 0 0 0 .6.35l9.4-5.8a.4.4 0 0 0 0-.7L4.6 1.85A.4.4 0 0 0 4 2.2z"/></svg>';

function createToggle(host: HTMLElement) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hero-video-toggle';
  button.hidden = true;
  host.append(button);
  return button;
}

function attachSources(video: HTMLVideoElement, start: number) {
  const sources: VideoSource[] = JSON.parse(video.dataset.sources ?? '[]');
  for (const { src, type, media } of sources) {
    if (media && !window.matchMedia(media).matches) continue;
    const el = document.createElement('source');
    el.src = src;
    el.type = type;
    video.append(el);
  }
  if (start > 0) {
    video.addEventListener(
      'loadedmetadata',
      () => {
        video.currentTime = start;
      },
      { once: true },
    );
  }
  video.load();
}

function setup(root: HTMLElement) {
  const video = root.querySelector('video');
  if (!video) return;
  let attached = false;
  const start = Math.max(0, parseFloat(video.dataset.start ?? '') || 0);
  let userPaused = loadPaused();
  let hasPlayed = false;
  let interacted = false;
  const toggle = createToggle(root.closest<HTMLElement>('[data-hero]') ?? root);
  const input = (): PlaybackInput => ({
    reduceMotion: reduceMotion.matches,
    saveData: saveData(),
    visible: document.visibilityState === 'visible',
    userPaused,
    hasPlayed,
    interacted,
  });
  const renderToggle = () => {
    const hidden = !showsControl(input());
    if (toggle.hidden !== hidden) toggle.hidden = hidden;
    toggle.setAttribute('aria-label', controlLabel(userPaused));
    toggle.innerHTML = userPaused ? PLAY_ICON : PAUSE_ICON;
  };

  let revealed = false;
  let waitStart = performance.now();
  const reveal = () => {
    if (revealed) return;
    const ready = readyToReveal({
      start,
      currentTime: video.currentTime,
      waitedMs: performance.now() - waitStart,
      playing: !video.paused && !video.seeking,
    });
    if (!ready) return;
    revealed = true;
    root.classList.add('is-playing');
  };
  for (const type of ['playing', 'seeked', 'timeupdate'])
    video.addEventListener(type, reveal);
  video.addEventListener('playing', () => {
    hasPlayed = true;
    renderToggle();
  });

  const sync = () => {
    renderToggle();
    if (!shouldPlay(input())) {
      video.pause();
      if (reduceMotion.matches) {
        revealed = false;
        root.classList.remove('is-playing');
      }
      return;
    }
    if (!attached) {
      attached = true;
      waitStart = performance.now();
      attachSources(video, start);
      if (start > 0) window.setTimeout(reveal, SEEK_GRACE_MS + 50);
    }
    video.play().catch(() => {});
  };

  toggle.addEventListener('click', () => {
    interacted = true;
    userPaused = !userPaused;
    storePaused(userPaused);
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  reduceMotion.addEventListener('change', sync);
  sync();
}

function init() {
  document.querySelectorAll<HTMLElement>('[data-hero-video]').forEach(setup);
}

if (document.readyState === 'complete') init();
else window.addEventListener('load', init, { once: true });
