export {};

function pauseVideo(panel: HTMLElement) {
  panel
    .querySelector('iframe')
    ?.contentWindow?.postMessage(
      JSON.stringify({ method: 'pause' }),
      'https://player.vimeo.com',
    );
}

function setup(root: HTMLElement) {
  const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));
  if (tabs.length < 2) return;
  const panels = new Map<HTMLElement, HTMLElement>();
  for (const tab of tabs) {
    const panel = document.getElementById(
      tab.getAttribute('aria-controls') ?? '',
    );
    if (panel) panels.set(tab, panel);
  }

  const select = (selected: HTMLElement, focus: boolean) => {
    for (const tab of tabs) {
      const active = tab === selected;
      const panel = panels.get(tab);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (!panel) continue;
      if (!active && !panel.hidden) {
        pauseVideo(panel);
        panel.querySelector('audio')?.pause();
      }
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    }
    if (focus) selected.focus();
  };

  select(tabs[0], false);

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab, false));
    tab.addEventListener('keydown', (event) => {
      const last = tabs.length - 1;
      let target: number | null = null;
      if (event.key === 'ArrowRight') target = index === last ? 0 : index + 1;
      else if (event.key === 'ArrowLeft')
        target = index === 0 ? last : index - 1;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = last;
      if (target === null) return;
      event.preventDefault();
      select(tabs[target], true);
    });
  });
}

document
  .querySelectorAll<HTMLElement>('[data-sermon-media]')
  .forEach((root) => setup(root));
