import { gsap } from 'gsap';

const motionAllowed = () =>
  !document.documentElement.classList.contains('reduced');

const CLEAR = 'height,opacity,paddingBottom,overflow';

function setup(item: HTMLDetailsElement) {
  const summary = item.querySelector<HTMLElement>('summary');
  const answer = item.querySelector<HTMLElement>('.faq-answer');
  if (!summary || !answer) return;

  const padding = getComputedStyle(answer).paddingBottom;
  let closing = false;

  const open = () => {
    const fromClosed = !item.open;
    closing = false;
    item.open = true;
    const target = {
      height: 'auto',
      opacity: 1,
      paddingBottom: padding,
      duration: 0.4,
      ease: 'power3.out',
      overwrite: true,
      onComplete: () => gsap.set(answer, { clearProps: CLEAR }),
    };
    if (fromClosed) {
      gsap.fromTo(
        answer,
        { height: 0, opacity: 0, paddingBottom: 0, overflow: 'hidden' },
        target,
      );
    } else {
      gsap.to(answer, { ...target, overflow: 'hidden' });
    }
  };

  const close = () => {
    closing = true;
    gsap.to(answer, {
      height: 0,
      opacity: 0,
      paddingBottom: 0,
      overflow: 'hidden',
      duration: 0.28,
      ease: 'power3.inOut',
      overwrite: true,
      onComplete: () => {
        item.open = false;
        closing = false;
        gsap.set(answer, { clearProps: CLEAR });
      },
    });
  };

  summary.addEventListener('click', (event) => {
    if (!motionAllowed()) return;
    event.preventDefault();
    if (item.open && !closing) close();
    else open();
  });
}

document.querySelectorAll<HTMLDetailsElement>('[data-faq-item]').forEach(setup);
