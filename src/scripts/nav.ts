import { gsap } from 'gsap';

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const motionAllowed = () =>
  !document.documentElement.classList.contains('reduced');

function initDropdowns(header: HTMLElement) {
  const items = Array.from(
    header.querySelectorAll<HTMLElement>('[data-nav-item]'),
  );

  const parts = (item: HTMLElement) => ({
    trigger: item.querySelector<HTMLButtonElement>('[data-dropdown-trigger]')!,
    panel: item.querySelector<HTMLElement>('[data-dropdown-panel]')!,
  });

  const setOpen = (item: HTMLElement, open: boolean) => {
    const { trigger, panel } = parts(item);
    trigger.setAttribute('aria-expanded', String(open));
    if (!motionAllowed()) {
      panel.hidden = !open;
      return;
    }
    if (open) {
      panel.hidden = false;
      gsap.fromTo(
        panel,
        { opacity: 0, y: -8, scale: 0.98, transformOrigin: 'top left' },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.28,
          ease: 'power3.out',
          overwrite: true,
          clearProps: 'opacity,transform,transformOrigin',
        },
      );
      gsap.from(panel.children, {
        opacity: 0,
        y: -6,
        duration: 0.3,
        ease: 'power3.out',
        stagger: 0.03,
        delay: 0.04,
        clearProps: 'opacity,transform',
      });
    } else if (!panel.hidden) {
      gsap.killTweensOf(panel.children);
      gsap.set(panel.children, { clearProps: 'opacity,transform' });
      gsap.to(panel, {
        opacity: 0,
        y: -4,
        duration: 0.14,
        ease: 'power2.in',
        overwrite: true,
        onComplete: () => {
          panel.hidden = true;
          gsap.set(panel, { clearProps: 'opacity,transform,transformOrigin' });
        },
      });
    }
  };

  const isOpen = (item: HTMLElement) =>
    parts(item).trigger.getAttribute('aria-expanded') === 'true';

  const closeAll = (except?: HTMLElement) => {
    for (const item of items) if (item !== except) setOpen(item, false);
  };

  for (const item of items) {
    const { trigger } = parts(item);

    trigger.addEventListener('click', () => {
      const open = !isOpen(item);
      closeAll(item);
      setOpen(item, open);
    });

    item.addEventListener('focusout', (event) => {
      const next = event.relatedTarget as Node | null;
      if (next && !item.contains(next)) setOpen(item, false);
    });
  }

  document.addEventListener('click', (event) => {
    const target = event.target as Node;
    for (const item of items) {
      if (isOpen(item) && !item.contains(target)) setOpen(item, false);
    }
  });

  header.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    for (const item of items) {
      if (!isOpen(item)) continue;
      const hadFocus = item.contains(document.activeElement);
      setOpen(item, false);
      if (hadFocus) parts(item).trigger.focus();
      event.stopPropagation();
    }
  });
}

function initMenu(header: HTMLElement) {
  const toggle = header.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = header.querySelector<HTMLElement>('[data-mobile-menu]');
  if (!toggle || !menu) return;

  const root = document.documentElement;
  const bar = header.querySelector<HTMLElement>('.site-header__bar');
  const outside = () =>
    Array.from(document.body.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement &&
        el !== header &&
        !el.contains(header) &&
        el.tagName !== 'SCRIPT',
    );

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  const setOpen = (open: boolean, returnFocus = false) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.toggleAttribute('data-open', open);
    header.toggleAttribute('data-menu-open', open);
    root.classList.toggle('menu-open', open);
    for (const el of outside()) el.inert = open;
    if (open) {
      menu
        .querySelector<HTMLElement>(FOCUSABLE)
        ?.focus({ preventScroll: true });
      if (motionAllowed()) {
        gsap.fromTo(
          menu.querySelectorAll('.mobile-menu__list > li, .mobile-menu__cta'),
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power3.out',
            stagger: 0.035,
            delay: 0.05,
            overwrite: 'auto',
            clearProps: 'opacity,transform',
          },
        );
      }
    } else if (returnFocus) toggle.focus();
  };

  const trapSet = () =>
    Array.from(header.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === toggle,
    );

  toggle.addEventListener('click', () => setOpen(!isOpen()));

  menu.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a')) setOpen(false);
  });

  header.addEventListener('keydown', (event) => {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false, true);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = trapSet();
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const isDesktop = () => getComputedStyle(toggle).display === 'none';
  let settle = 0;
  const closeOnDesktop = () => {
    if (!isOpen() || !isDesktop()) return;
    cancelAnimationFrame(settle);
    settle = requestAnimationFrame(() => {
      settle = requestAnimationFrame(() => {
        if (isOpen() && isDesktop()) setOpen(false);
      });
    });
  };
  if (bar) new ResizeObserver(closeOnDesktop).observe(bar);

  window.addEventListener('pageshow', (event) => {
    if (event.persisted && isOpen()) setOpen(false);
  });
}

export function initNav() {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!header) return;
  initDropdowns(header);
  initMenu(header);
}
