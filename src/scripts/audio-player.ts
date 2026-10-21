import {
  formatTime,
  nextSpeed,
  resumePosition,
} from '../lib/audio/player-utils';

const SAVE_INTERVAL_MS = 5000;
const SKIP_SECONDS = 15;
const UNKNOWN_TOTAL = '–:––';

const playIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
const pauseIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>';

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function storageRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    return;
  }
}

function setup(root: HTMLElement) {
  const audio = root.querySelector('audio');
  const src = root.dataset.src;
  if (!audio || !src || root.classList.contains('is-ready')) return;
  const key = `cw-audio:${src}`;

  audio.removeAttribute('controls');
  audio.preload = 'none';

  const ui = document.createElement('div');
  ui.className = 'audio-player__ui';
  ui.innerHTML = `
    <div class="audio-player__controls">
      <button type="button" class="audio-player__button audio-player__button--play" data-play aria-label="Play">${playIcon}</button>
      <button type="button" class="audio-player__button" data-back aria-label="Back 15 seconds">−15</button>
      <button type="button" class="audio-player__button" data-forward aria-label="Forward 15 seconds">+15</button>
      <span class="audio-player__spacer"></span>
      <button type="button" class="audio-player__button" data-speed></button>
    </div>
    <div class="audio-player__timeline">
      <span class="audio-player__time" data-elapsed>0:00</span>
      <input class="audio-player__scrubber" type="range" min="0" max="0" step="1" value="0" disabled aria-label="Seek" data-scrubber />
      <span class="audio-player__time" data-total>${UNKNOWN_TOTAL}</span>
    </div>
    <p class="audio-player__message" role="status"></p>
    <span class="sr-only" role="status" aria-live="polite" data-announce></span>
  `;
  root.append(ui);

  const $ = <T extends HTMLElement>(selector: string) =>
    ui.querySelector(selector) as T;
  const playButton = $<HTMLButtonElement>('[data-play]');
  const backButton = $<HTMLButtonElement>('[data-back]');
  const forwardButton = $<HTMLButtonElement>('[data-forward]');
  const speedButton = $<HTMLButtonElement>('[data-speed]');
  const elapsed = $<HTMLElement>('[data-elapsed]');
  const total = $<HTMLElement>('[data-total]');
  const scrubber = $<HTMLInputElement>('[data-scrubber]');
  const message = $<HTMLElement>('.audio-player__message');
  const announce = $<HTMLElement>('[data-announce]');

  let resumeFrom = resumePosition(storageGet(key), NaN) || null;
  let explicitSeek: number | null = null;
  let loadRequested = false;
  let scrubbing = false;
  let shownSecond = -1;
  let saveTimer: number | undefined;

  const hasMetadata = () =>
    audio.readyState >= 1 && Number.isFinite(audio.duration);

  const position = () => {
    if (hasMetadata()) return audio.currentTime;
    return explicitSeek ?? resumeFrom ?? 0;
  };

  const render = (force = false) => {
    const now = position();
    const second = Math.floor(now);
    if (!force && second === shownSecond) return;
    shownSecond = second;
    elapsed.textContent = formatTime(now);
    if (!scrubbing) scrubber.value = String(now);
    scrubber.setAttribute(
      'aria-valuetext',
      hasMetadata()
        ? `${formatTime(now)} of ${formatTime(audio.duration)}`
        : formatTime(now),
    );
  };

  const save = () => {
    if (hasMetadata()) storageSet(key, String(Math.floor(audio.currentTime)));
  };

  const ensureLoaded = () => {
    if (hasMetadata() || loadRequested) return;
    loadRequested = true;
    audio.preload = 'metadata';
    audio.load();
  };

  const seekTo = (seconds: number) => {
    if (hasMetadata()) {
      audio.currentTime = Math.min(Math.max(seconds, 0), audio.duration);
      render(true);
      return;
    }
    explicitSeek = Math.max(seconds, 0);
    ensureLoaded();
    render(true);
  };

  const setSpeed = (speed: number) => {
    audio.defaultPlaybackRate = speed;
    audio.playbackRate = speed;
    speedButton.textContent = `${speed}×`;
    speedButton.setAttribute('aria-label', `Playback speed ${speed}×`);
  };

  const onMetadata = () => {
    scrubber.max = String(audio.duration);
    scrubber.disabled = false;
    total.textContent = formatTime(audio.duration);
    const target =
      explicitSeek ??
      (resumeFrom === null
        ? 0
        : resumePosition(String(resumeFrom), audio.duration));
    explicitSeek = null;
    resumeFrom = null;
    if (target > 0) audio.currentTime = Math.min(target, audio.duration);
    render(true);
  };

  const setPlaying = (playing: boolean) => {
    playButton.innerHTML = playing ? pauseIcon : playIcon;
    playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  };

  setSpeed(1);
  audio.addEventListener('loadedmetadata', onMetadata);
  audio.addEventListener('durationchange', () => {
    if (hasMetadata()) {
      scrubber.max = String(audio.duration);
      total.textContent = formatTime(audio.duration);
    }
  });
  audio.addEventListener('timeupdate', () => render());
  audio.addEventListener('seeked', () => render(true));
  audio.addEventListener('play', () => {
    message.textContent = '';
    setPlaying(true);
    window.clearInterval(saveTimer);
    saveTimer = window.setInterval(save, SAVE_INTERVAL_MS);
  });
  audio.addEventListener('pause', () => {
    window.clearInterval(saveTimer);
    setPlaying(false);
    if (!audio.ended) save();
  });
  audio.addEventListener('ended', () => {
    window.clearInterval(saveTimer);
    setPlaying(false);
    storageRemove(key);
    render(true);
  });
  audio.addEventListener('error', () => {
    window.clearInterval(saveTimer);
    setPlaying(false);
    message.textContent = 'This audio could not be loaded. Please try again.';
  });

  playButton.addEventListener('click', () => {
    if (audio.paused) {
      message.textContent = '';
      audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  });
  backButton.addEventListener('click', () => seekTo(position() - SKIP_SECONDS));
  forwardButton.addEventListener('click', () =>
    seekTo(position() + SKIP_SECONDS),
  );
  speedButton.addEventListener('click', () => {
    const speed = nextSpeed(audio.playbackRate);
    setSpeed(speed);
    announce.textContent = `Playback speed ${speed}×`;
  });

  scrubber.addEventListener('pointerdown', () => {
    scrubbing = true;
  });
  const endScrub = () => {
    scrubbing = false;
  };
  scrubber.addEventListener('pointerup', endScrub);
  scrubber.addEventListener('pointercancel', endScrub);
  scrubber.addEventListener('change', endScrub);
  scrubber.addEventListener('input', () => {
    if (hasMetadata()) {
      audio.currentTime = Number(scrubber.value);
      render(true);
    }
  });

  root.classList.add('is-ready');
  if (hasMetadata()) onMetadata();
  else render(true);
}

document
  .querySelectorAll<HTMLElement>('[data-audio-player]')
  .forEach((root) => setup(root));
