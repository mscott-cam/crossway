import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

const START = 'top 88%';
const FONT_DEADLINE_MS = 800;
const STAGGER = 0.07;
const STAGGER_CAP = 4;
const NAVIGATION_HANDOFF = 0.1;

type Play = (extra: number) => void;

let pending: Play[] = [];
let flushQueued = false;

function delayOf(el: HTMLElement | SVGElement) {
  const value = parseFloat(el.dataset.revealDelay ?? '');
  return Number.isFinite(value) ? value : 0;
}

function arrivedFromSite() {
  try {
    return new URL(document.referrer).origin === location.origin;
  } catch {
    return false;
  }
}

function flush() {
  flushQueued = false;
  const batch = pending;
  pending = [];
  batch.forEach((play, index) => play(Math.min(index, STAGGER_CAP) * STAGGER));
}

function enqueue(play: Play) {
  pending.push(play);
  if (flushQueued) return;
  flushQueued = true;
  requestAnimationFrame(flush);
}

function arm(el: Element, play: Play, handoff: number) {
  if (el.getBoundingClientRect().top < window.innerHeight) {
    play(handoff);
    return;
  }
  ScrollTrigger.create({
    trigger: el,
    start: START,
    once: true,
    onEnter: () => enqueue(play),
  });
}

function revealFade(el: HTMLElement, handoff: number) {
  const base = delayOf(el);
  const tween = gsap.fromTo(
    el,
    { opacity: 0, y: 20 },
    {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power3.out',
      delay: base,
      paused: true,
      clearProps: 'opacity,transform',
    },
  );
  arm(el, (extra) => tween.delay(base + extra).play(), handoff);
}

function revealUp(el: HTMLElement, handoff: number) {
  const base = delayOf(el);
  const tween = gsap.fromTo(
    el,
    { opacity: 0, y: 48 },
    {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: 'power4.out',
      delay: base,
      paused: true,
      clearProps: 'opacity,transform',
    },
  );
  arm(el, (extra) => tween.delay(base + extra).play(), handoff);
}

function revealLines(el: HTMLElement, handoff: number) {
  let tween: gsap.core.Tween | undefined;
  let armed = false;
  let play = false;
  const base = delayOf(el);

  SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    autoSplit: true,
    onSplit(self) {
      gsap.set(el, { opacity: 1 });
      tween = gsap.from(self.lines, {
        yPercent: 110,
        duration: 0.9,
        ease: 'expo.out',
        stagger: 0.08,
        delay: base,
        paused: !play,
      });
      if (!armed) {
        armed = true;
        arm(
          el,
          (extra) => {
            play = true;
            tween?.delay(base + extra).play();
          },
          handoff,
        );
      }
      return tween;
    },
  });
}

function drawMark(el: SVGElement, handoff: number) {
  const base = delayOf(el);
  const tween = gsap.fromTo(
    el,
    { clipPath: 'inset(0% 0% 100% 0%)' },
    {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1,
      ease: 'power3.out',
      delay: base,
      paused: true,
      clearProps: 'clipPath',
    },
  );
  arm(el, (extra) => tween.delay(base + extra).play(), handoff);
}

function parallax(el: HTMLElement) {
  const amount = Math.min(
    Math.max(parseFloat(el.dataset.parallax ?? '0.1') || 0, 0),
    0.3,
  );
  if (!amount) return;
  const trigger = el.parentElement ?? el;
  const travel = () => (trigger.offsetHeight + window.innerHeight) * amount;
  gsap.fromTo(
    el,
    { y: () => -travel() / 2 },
    {
      y: () => travel() / 2,
      ease: 'none',
      scrollTrigger: {
        trigger,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
        invalidateOnRefresh: true,
      },
    },
  );
}

function fontsReady() {
  const remaining = Math.max(0, FONT_DEADLINE_MS - performance.now());
  return Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, remaining)),
  ]);
}

export async function initMotion() {
  const root = document.documentElement;
  if (!root.classList.contains('js') || root.classList.contains('reduced'))
    return;

  const reveals = Array.from(
    document.querySelectorAll<HTMLElement>('[data-reveal]'),
  );
  const marks = Array.from(
    document.querySelectorAll<SVGElement>('[data-draw]'),
  );
  const drifts = Array.from(
    document.querySelectorAll<HTMLElement>('[data-parallax]'),
  );
  if (!reveals.length && !marks.length && !drifts.length) return;

  const lines = reveals.filter((el) => el.dataset.reveal === 'lines');
  const rest = reveals.filter((el) => el.dataset.reveal !== 'lines');
  const handoff = arrivedFromSite() ? NAVIGATION_HANDOFF : 0;

  try {
    gsap.registerPlugin(ScrollTrigger, SplitText);
    ScrollTrigger.config({ ignoreMobileResize: true });

    for (const el of lines) gsap.set(el, { opacity: 0 });
    for (const el of rest) {
      if (el.dataset.reveal === 'up') revealUp(el, handoff);
      else revealFade(el, handoff);
    }
    for (const el of marks) drawMark(el, handoff);
    for (const el of drifts) parallax(el);
    root.classList.add('motion-ready');

    if (lines.length) {
      await fontsReady();
      for (const el of lines) revealLines(el, handoff);
    }
  } catch {
    gsap.set([...reveals, ...marks, ...drifts], { clearProps: 'all' });
    root.classList.add('motion-ready');
  }
}

initMotion();
