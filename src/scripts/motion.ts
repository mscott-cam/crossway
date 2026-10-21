import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

const START = 'top 85%';
const FONT_WAIT_MS = 2500;

type Play = () => void;

function delayOf(el: HTMLElement | SVGElement) {
  const value = parseFloat(el.dataset.revealDelay ?? '');
  return Number.isFinite(value) ? value : 0;
}

function arm(el: Element, play: Play) {
  if (el.getBoundingClientRect().top < window.innerHeight) {
    play();
    return;
  }
  ScrollTrigger.create({
    trigger: el,
    start: START,
    once: true,
    onEnter: play,
  });
}

function revealFade(el: HTMLElement) {
  const tween = gsap.from(el, {
    opacity: 0,
    y: 14,
    duration: 0.9,
    ease: 'power2.out',
    delay: delayOf(el),
    paused: true,
    clearProps: 'opacity,transform',
  });
  arm(el, () => tween.play());
}

function revealUp(el: HTMLElement) {
  const tween = gsap.from(el, {
    opacity: 0,
    y: 80,
    duration: 1.2,
    ease: 'expo.out',
    delay: delayOf(el),
    paused: true,
    clearProps: 'opacity,transform',
  });
  arm(el, () => tween.play());
}

function revealLines(el: HTMLElement) {
  let tween: gsap.core.Tween | undefined;
  let armed = false;
  let play = false;

  SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    autoSplit: true,
    onSplit(self) {
      gsap.set(el, { opacity: 1 });
      tween = gsap.from(self.lines, {
        yPercent: 110,
        duration: 1.2,
        ease: 'expo.out',
        stagger: 0.12,
        delay: delayOf(el),
        paused: !play,
      });
      if (!armed) {
        armed = true;
        arm(el, () => {
          play = true;
          tween?.play();
        });
      }
      return tween;
    },
  });
}

function drawMark(el: SVGElement) {
  const tween = gsap.fromTo(
    el,
    { clipPath: 'inset(0% 0% 100% 0%)' },
    {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.4,
      ease: 'expo.out',
      delay: delayOf(el),
      paused: true,
      clearProps: 'clipPath',
    },
  );
  arm(el, () => tween.play());
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
  return Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS)),
  ]);
}

export async function initMotion() {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) root.classList.add('reduced');
  if (reduced || !root.classList.contains('js')) return;

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

  gsap.registerPlugin(ScrollTrigger, SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const lines = reveals.filter((el) => el.dataset.reveal === 'lines');
  const rest = reveals.filter((el) => el.dataset.reveal !== 'lines');

  try {
    for (const el of lines) gsap.set(el, { opacity: 0 });
    for (const el of rest) {
      if (el.dataset.reveal === 'up') revealUp(el);
      else revealFade(el);
    }
    for (const el of marks) drawMark(el);
    for (const el of drifts) parallax(el);

    if (lines.length) {
      await fontsReady();
      for (const el of lines) revealLines(el);
    }
  } catch {
    gsap.set([...reveals, ...marks, ...drifts], { clearProps: 'all' });
  }
}

initMotion();
