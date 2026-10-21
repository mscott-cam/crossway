export {};

function activate(root: HTMLElement) {
  const { vimeoId, vimeoHash, title } = root.dataset;
  if (!vimeoId || root.querySelector('iframe')) return;

  const params = new URLSearchParams({ autoplay: '1', dnt: '1' });
  if (vimeoHash) params.set('h', vimeoHash);

  const iframe = document.createElement('iframe');
  iframe.src = `https://player.vimeo.com/video/${vimeoId}?${params}`;
  iframe.allow = 'autoplay; fullscreen; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.title = title ?? 'Sermon video';

  root.replaceChildren(iframe);
  iframe.focus();
}

document
  .querySelectorAll<HTMLElement>('[data-vimeo-facade]')
  .forEach((root) => {
    root
      .querySelector('.vimeo-facade__play')
      ?.addEventListener('click', () => activate(root));
  });
