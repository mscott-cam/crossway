import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const fixture = (page: Page, name: string) =>
  page.locator(`[data-fixture="${name}"]`);

const audioKey = (suffix: string) => `cw-audio:/dev/silence.mp3?${suffix}`;

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function open(page: Page) {
  await page.route(/vimeo\.com|vimeocdn\.com/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>stub</title>',
    }),
  );
  await page.goto('/dev/media');
  await page.waitForLoadState('load');
}

const playButton = (root: Locator) =>
  root.getByRole('button', { name: /^(Play|Pause)$/ });
const speedButton = (root: Locator) =>
  root.getByRole('button', { name: /Playback speed/ });
const scrubber = (root: Locator) => root.getByRole('slider');
const currentTime = (root: Locator) =>
  root.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime);

test.describe('sermon media toggle', () => {
  test('both media: Watch is selected first, with a facade and no iframe', async ({
    page,
  }) => {
    await open(page);
    const both = fixture(page, 'both');
    const tabs = both.getByRole('tab');
    await expect(tabs).toHaveText(['Watch', 'Listen']);
    await expect(both.getByRole('tab', { name: 'Watch' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(both.getByRole('tab', { name: 'Listen' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    await expect(both.getByRole('tablist')).toHaveCount(1);
    await expect(both.locator('[data-vimeo-facade]')).toBeVisible();
    await expect(both.locator('iframe')).toHaveCount(0);
    await expect(both.locator('[data-audio-player]')).toBeHidden();
  });

  test('clicking Listen shows the audio player and hides the video', async ({
    page,
  }) => {
    await open(page);
    const both = fixture(page, 'both');
    await both.getByRole('tab', { name: 'Listen' }).click();
    await expect(both.locator('[data-audio-player]')).toBeVisible();
    await expect(both.locator('[data-vimeo-facade]')).toBeHidden();
    await expect(both.getByRole('tab', { name: 'Listen' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(both.getByRole('tabpanel')).toHaveCount(1);
    await both.getByRole('tab', { name: 'Watch' }).click();
    await expect(both.locator('[data-vimeo-facade]')).toBeVisible();
    await expect(both.locator('[data-audio-player]')).toBeHidden();
  });

  test('tabs link to panels and the hidden panel is not focusable', async ({
    page,
  }) => {
    await open(page);
    const both = fixture(page, 'both');
    const listen = both.getByRole('tab', { name: 'Listen' });
    const panelId = await listen.getAttribute('aria-controls');
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toHaveAttribute('role', 'tabpanel');
    await expect(panel).toHaveAttribute(
      'aria-labelledby',
      (await listen.getAttribute('id'))!,
    );
    await expect(panel).toBeHidden();
    await expect(panel).toHaveAttribute('hidden', '');
    await expect(listen).toHaveAttribute('tabindex', '-1');
  });

  test('arrow keys, Home and End move between tabs', async ({ page }) => {
    await open(page);
    const both = fixture(page, 'both');
    const watch = both.getByRole('tab', { name: 'Watch' });
    const listen = both.getByRole('tab', { name: 'Listen' });
    await watch.focus();
    await page.keyboard.press('ArrowRight');
    await expect(listen).toBeFocused();
    await expect(listen).toHaveAttribute('aria-selected', 'true');
    await expect(both.locator('[data-audio-player]')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(watch).toBeFocused();
    await expect(watch).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(listen).toBeFocused();
    await page.keyboard.press('Home');
    await expect(watch).toBeFocused();
    await page.keyboard.press('End');
    await expect(listen).toBeFocused();
    await expect(listen).toHaveAttribute('aria-selected', 'true');
  });

  test('switching away from Listen pauses the audio', async ({ page }) => {
    await open(page);
    const both = fixture(page, 'both');
    await both.getByRole('tab', { name: 'Listen' }).click();
    await playButton(both).click();
    await expect.poll(() => currentTime(both)).toBeGreaterThan(0);
    await both.getByRole('tab', { name: 'Watch' }).click();
    expect(
      await both.locator('audio').evaluate((a: HTMLAudioElement) => a.paused),
    ).toBe(true);
  });
});

test.describe('vimeo facade', () => {
  test('has no iframe until activated, then injects the player and focuses it', async ({
    page,
  }) => {
    await open(page);
    const video = fixture(page, 'video');
    await expect(video.locator('iframe')).toHaveCount(0);

    await video
      .getByRole('button', { name: 'Play video: Video Only Sermon' })
      .click();
    const iframe = video.locator('iframe');
    await expect(iframe).toHaveCount(1);
    await expect(iframe).toHaveAttribute(
      'src',
      'https://player.vimeo.com/video/76979871?autoplay=1&dnt=1',
    );
    await expect(iframe).toHaveAttribute(
      'allow',
      'autoplay; fullscreen; picture-in-picture',
    );
    await expect(iframe).toHaveAttribute('title', 'Video Only Sermon');
    await expect(iframe).toHaveAttribute('allowfullscreen', '');
    await expect(iframe).toBeFocused();
    await expect(video.getByRole('button')).toHaveCount(0);
  });

  test('shows a lazy 16:9 decorative poster when a thumbnail exists', async ({
    page,
  }) => {
    await open(page);
    const poster = fixture(page, 'poster');
    const img = poster.locator('[data-vimeo-facade] img');
    await expect(img).toHaveAttribute('alt', '');
    await expect(img).toHaveAttribute('width', '1280');
    await expect(img).toHaveAttribute('height', '720');
    await expect(img).toHaveAttribute('loading', 'lazy');
    await expect(
      poster.getByRole('button', { name: 'Play video: Poster Sermon' }),
    ).toBeVisible();
    await expect(poster.locator('iframe')).toHaveCount(0);
    const box = (await poster.locator('[data-vimeo-facade]').boundingBox())!;
    expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.02);
    await poster.getByRole('button', { name: /^Play video:/ }).click();
    await expect(poster.locator('iframe')).toHaveCount(1);
    await expect(poster.locator('img')).toHaveCount(0);
  });

  test('passes the private hash to the iframe', async ({ page }) => {
    await open(page);
    const both = fixture(page, 'both');
    await both.getByRole('button', { name: /^Play video:/ }).click();
    await expect(both.locator('iframe')).toHaveAttribute(
      'src',
      'https://player.vimeo.com/video/76979871?autoplay=1&dnt=1&h=abc123def4',
    );
  });

  test('without a thumbnail it shows a placeholder block that still activates', async ({
    page,
  }) => {
    await open(page);
    const video = fixture(page, 'video');
    const facade = video.locator('[data-vimeo-facade]');
    await expect(facade.locator('img')).toHaveCount(0);
    const box = await facade.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.width / box!.height - 16 / 9)).toBeLessThan(0.02);
    const before = box!.height;
    await video.getByRole('button', { name: /^Play video:/ }).click();
    const after = (await facade.boundingBox())!.height;
    expect(Math.abs(after - before)).toBeLessThan(1);
  });

  test('activates from the keyboard', async ({ page }) => {
    await open(page);
    const video = fixture(page, 'video');
    await video.getByRole('button', { name: /^Play video:/ }).focus();
    await page.keyboard.press('Enter');
    await expect(video.locator('iframe')).toHaveCount(1);
  });
});

test.describe('audio player', () => {
  test('cycles playback speed through the whole loop', async ({ page }) => {
    await open(page);
    const audio = fixture(page, 'audio');
    const speed = speedButton(audio);
    await expect(speed).toHaveText('1×');
    await speed.click();
    await expect(speed).toHaveText('1.25×');
    expect(
      await audio
        .locator('audio')
        .evaluate((a: HTMLAudioElement) => a.playbackRate),
    ).toBe(1.25);
    await speed.click();
    await expect(speed).toHaveText('1.5×');
    await speed.click();
    await expect(speed).toHaveText('2×');
    await speed.click();
    await expect(speed).toHaveText('1×');
  });

  test('starts with a hidden preload-none native element and a labelled scrubber', async ({
    page,
  }) => {
    await open(page);
    const audio = fixture(page, 'audio');
    const native = audio.locator('audio');
    await expect(native).toHaveAttribute('preload', 'none');
    await expect(native).toBeHidden();
    await expect(audio.getByRole('slider')).toHaveAccessibleName(/seek/i);
    await expect(audio.locator('[data-elapsed]')).toHaveText('0:00');
  });

  test('plays, shows time and skips by 15 seconds', async ({ page }) => {
    await open(page);
    const audio = fixture(page, 'audio');
    await playButton(audio).click();
    await expect(
      audio.getByRole('button', { name: 'Pause', exact: true }),
    ).toBeVisible();
    await expect(audio.locator('[data-total]')).toHaveText('0:40');
    await expect(scrubber(audio)).toBeEnabled();
    await audio.getByRole('button', { name: /Forward 15/ }).click();
    await expect.poll(() => currentTime(audio)).toBeGreaterThanOrEqual(15);
    await audio.getByRole('button', { name: /Back 15/ }).click();
    await expect.poll(() => currentTime(audio)).toBeLessThan(15);
    await playButton(audio).click();
  });

  test('stores the position on pause and restores it after reload', async ({
    page,
  }) => {
    await open(page);
    const audio = fixture(page, 'audio');
    await playButton(audio).click();
    await expect(scrubber(audio)).toBeEnabled();
    await scrubber(audio).fill('20');
    await expect.poll(() => currentTime(audio)).toBeGreaterThanOrEqual(20);
    await playButton(audio).click();
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), audioKey('b')),
      )
      .toMatch(/^2\d$/);

    await page.reload();
    await page.waitForLoadState('load');
    const again = fixture(page, 'audio');
    await expect(again.locator('[data-elapsed]')).toHaveText('0:20');
    await playButton(again).click();
    await expect.poll(() => currentTime(again)).toBeGreaterThanOrEqual(20);
  });

  test('ignores a stored position near the end', async ({ page }) => {
    await open(page);
    await page.evaluate(
      (key) => localStorage.setItem(key, '38'),
      audioKey('b'),
    );
    await page.reload();
    const audio = fixture(page, 'audio');
    await playButton(audio).click();
    await expect(scrubber(audio)).toBeEnabled();
    await expect.poll(() => currentTime(audio)).toBeLessThan(10);
  });

  test('clears the stored position when playback ends', async ({ page }) => {
    await open(page);
    const audio = fixture(page, 'audio');
    await playButton(audio).click();
    await expect(scrubber(audio)).toBeEnabled();
    await scrubber(audio).fill('40');
    await expect
      .poll(() =>
        audio.locator('audio').evaluate((a: HTMLAudioElement) => a.ended),
      )
      .toBe(true);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), audioKey('b')),
    ).toBeNull();
    await expect(
      audio.getByRole('button', { name: 'Play', exact: true }),
    ).toBeVisible();
  });

  test('keeps working when localStorage throws', async ({ page }) => {
    const errors = trackErrors(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
    });
    await open(page);
    const audio = fixture(page, 'audio');
    await playButton(audio).click();
    await expect(scrubber(audio)).toBeEnabled();
    await playButton(audio).click();
    await speedButton(audio).click();
    await expect(speedButton(audio)).toHaveText('1.25×');
    expect(errors).toEqual([]);
  });

  test('controls are at least 44px and show focus', async ({ page }) => {
    await open(page);
    const audio = fixture(page, 'audio');
    for (const button of await audio.getByRole('button').all()) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(43.5);
      expect(box.height).toBeGreaterThanOrEqual(43.5);
    }
    await playButton(audio).focus();
    await page.keyboard.press('Tab');
    await expect(audio.getByRole('button', { name: /Back 15/ })).toBeFocused();
    const outline = await audio
      .getByRole('button', { name: /Back 15/ })
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });
});

test.describe('missing and invalid media', () => {
  test('video only renders the facade with no toggle and no audio player', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await open(page);
    const video = fixture(page, 'video');
    await expect(video.locator('[data-vimeo-facade]')).toBeVisible();
    await expect(video.getByRole('tablist')).toHaveCount(0);
    await expect(video.locator('[data-audio-player]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('audio only renders the player with no toggle and no video', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await open(page);
    const audio = fixture(page, 'audio');
    await expect(audio.locator('[data-audio-player]')).toBeVisible();
    await expect(audio.getByRole('tablist')).toHaveCount(0);
    await expect(audio.locator('[data-vimeo-facade]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('no media renders nothing at all', async ({ page }) => {
    const errors = trackErrors(page);
    await open(page);
    const none = fixture(page, 'none');
    await expect(none.locator('[data-sermon-media]')).toHaveCount(0);
    await expect(none.locator('[data-audio-player]')).toHaveCount(0);
    await expect(none.locator('[data-vimeo-facade]')).toHaveCount(0);
    await expect(none.getByRole('tablist')).toHaveCount(0);
    await expect(none.locator('iframe, audio, button')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('an invalid Vimeo URL with audio is audio only', async ({ page }) => {
    const errors = trackErrors(page);
    await open(page);
    const invalid = fixture(page, 'invalid');
    await expect(invalid.locator('[data-audio-player]')).toBeVisible();
    await expect(invalid.getByRole('tablist')).toHaveCount(0);
    await expect(invalid.locator('[data-vimeo-facade]')).toHaveCount(0);
    await expect(invalid.locator('iframe')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('the whole page logs no console errors through normal use', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await open(page);
    const both = fixture(page, 'both');
    await both.getByRole('tab', { name: 'Listen' }).click();
    await both.getByRole('tab', { name: 'Watch' }).click();
    await both.getByRole('button', { name: /^Play video:/ }).click();
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
  });
});

test.describe('javascript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('both media are visible, stacked, with a native audio fallback', async ({
    page,
  }) => {
    await open(page);
    const both = fixture(page, 'both');
    await expect(both.getByRole('tablist')).toBeHidden();
    await expect(both.locator('[data-vimeo-facade]')).toBeVisible();
    const native = both.locator('audio');
    await expect(native).toBeVisible();
    await expect(native).toHaveAttribute('controls', '');
    await expect(native).toHaveAttribute('preload', 'none');
    const facadeBox = (await both
      .locator('[data-vimeo-facade]')
      .boundingBox())!;
    const audioBox = (await native.boundingBox())!;
    expect(audioBox.y).toBeGreaterThanOrEqual(facadeBox.y + facadeBox.height);
    await expect(
      both.getByRole('link', { name: /Watch on Vimeo/ }),
    ).toHaveAttribute('href', /^https:\/\/vimeo\.com\/76979871/);
  });
});

test.describe('accessibility', () => {
  test('has no axe violations', async ({ page }) => {
    await open(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations on the Listen tab and after activating the video', async ({
    page,
  }) => {
    await open(page);
    const both = fixture(page, 'both');
    await both.getByRole('tab', { name: 'Listen' }).click();
    await page.addStyleTag({ content: '*{transition:none!important}' });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await both.getByRole('tab', { name: 'Watch' }).click();
    await both.getByRole('button', { name: /^Play video:/ }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
