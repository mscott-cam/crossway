import { SEEK_GRACE_MS, readyToReveal } from '../lib/video/hero-reveal';

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

const mayPlay = () =>
  !reduceMotion.matches &&
  !saveData() &&
  document.visibilityState === 'visible';

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

  const sync = () => {
    if (!mayPlay()) {
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

  document.addEventListener('visibilitychange', sync);
  reduceMotion.addEventListener('change', sync);
  sync();
}

function init() {
  document.querySelectorAll<HTMLElement>('[data-hero-video]').forEach(setup);
}

if (document.readyState === 'complete') init();
else window.addEventListener('load', init, { once: true });
