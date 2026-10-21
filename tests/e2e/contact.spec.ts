import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/sermons', '/events'];
const TURNSTILE = 'https://challenges.cloudflare.com/**';
const SUCCESS = "Thank you! We'll get back to you soon.";
const FAILURE =
  'Something went wrong sending your message. Please try again, or email us directly.';

async function stubTurnstile(page: Page) {
  await page.route(TURNSTILE, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile={render:function(el,o){setTimeout(function(){o.callback('stub-token')},0);return 'w1'},reset:function(){},remove:function(){}};`,
    }),
  );
}

async function fillForm(page: Page, overrides: Record<string, string> = {}) {
  const values = {
    Name: 'Ada Lovelace',
    Email: 'ada@example.com',
    "How'd you hear about us?": 'A friend',
    'Question // Prayer Request': 'Could you pray for my family?',
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
}

const send = (page: Page) =>
  page.locator('#questions').getByRole('button', { name: 'Send' });

test.describe('questions form placement', () => {
  for (const url of PAGES) {
    test(`appears once on ${url} with an h2`, async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('#questions')).toHaveCount(1);
      await expect(
        page.locator('#questions').getByRole('heading', {
          level: 2,
          name: 'Have questions? Need prayer?',
        }),
      ).toBeVisible();
    });

    test(`sits between main and the footer on ${url}`, async ({ page }) => {
      await page.goto(url);
      const order = await page.evaluate(() =>
        [...document.body.children].map((el) => el.id || el.tagName),
      );
      const questions = order.indexOf('questions');
      expect(questions).toBeGreaterThan(order.indexOf('main'));
      expect(questions).toBeLessThan(order.indexOf('FOOTER'));
    });

    test(`axe passes on ${url}`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState('load');
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });

    test(`has no horizontal overflow at 320px on ${url}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(url);
      await page.waitForLoadState('load');
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('the dev fixture pages opt out', async ({ page }) => {
    await page.goto('/dev/motion');
    await expect(page.locator('#questions')).toHaveCount(0);
  });
});

test.describe('questions form fields', () => {
  test('every control has an associated visible label', async ({ page }) => {
    await page.goto('/');
    const form = page.locator('#questions form');
    const missing = await form.evaluate((el) =>
      [...el.querySelectorAll('input:not([type=hidden]), textarea')]
        .filter((control) => {
          const field = control as HTMLInputElement;
          return (
            field.name !== 'contact_extra_note' && field.labels?.length === 0
          );
        })
        .map((control) => (control as HTMLInputElement).name),
    );
    expect(missing).toEqual([]);

    await expect(page.getByLabel('Name', { exact: true })).toHaveAttribute(
      'autocomplete',
      'name',
    );
    await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute(
      'autocomplete',
      'email',
    );
    await expect(
      page.getByLabel('Question // Prayer Request', { exact: true }),
    ).toHaveJSProperty('tagName', 'TEXTAREA');
  });

  test('controls are at least 44px tall', async ({ page }) => {
    await page.goto('/');
    for (const label of ['Name', 'Email', "How'd you hear about us?"]) {
      const box = await page.getByLabel(label, { exact: true }).boundingBox();
      expect(box!.height, label).toBeGreaterThanOrEqual(44);
    }
    expect((await send(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test('the honeypot is hidden from assistive tech and the tab order', async ({
    page,
  }) => {
    await page.goto('/');
    const honeypot = page.locator(
      '#questions input[name="contact_extra_note"]',
    );
    await expect(honeypot).toHaveAttribute('tabindex', '-1');
    await expect(honeypot).toHaveAttribute('autocomplete', 'off');
    await expect(
      page.locator(
        '#questions [aria-hidden="true"] input[name="contact_extra_note"]',
      ),
    ).toHaveCount(1);
  });
});

test.describe('questions form submission', () => {
  test.beforeEach(async ({ page }) => {
    await stubTurnstile(page);
  });

  test('shows the thank-you and clears the form on success', async ({
    page,
  }) => {
    let body: Record<string, string> = {};
    await page.route('**/api/contact', async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({ status: 200, json: { ok: true } });
    });
    await page.goto('/');
    await fillForm(page);
    await send(page).click();
    await expect(page.locator('#questions [data-status]')).toHaveText(SUCCESS);
    expect(body).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      heardFrom: 'A friend',
      message: 'Could you pray for my family?',
      turnstileToken: 'stub-token',
    });
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
  });

  test('shows the failure copy and keeps the typed text on a 502', async ({
    page,
  }) => {
    await page.route('**/api/contact', (route) =>
      route.fulfill({ status: 502, json: { ok: false } }),
    );
    await page.goto('/');
    await fillForm(page);
    await send(page).click();
    await expect(page.locator('#questions [data-status]')).toContainText(
      FAILURE,
    );
    await expect(
      page.getByLabel('Question // Prayer Request', { exact: true }),
    ).toHaveValue('Could you pray for my family?');
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(
      'Ada Lovelace',
    );
  });

  test('shows the failure copy when the network request fails', async ({
    page,
  }) => {
    await page.route('**/api/contact', (route) => route.abort());
    await page.goto('/');
    await fillForm(page);
    await send(page).click();
    await expect(page.locator('#questions [data-status]')).toContainText(
      FAILURE,
    );
  });

  test('shows an inline error without a network call when email is empty', async ({
    page,
  }) => {
    let calls = 0;
    await page.route('**/api/contact', (route) => {
      calls += 1;
      return route.fulfill({ status: 200, json: { ok: true } });
    });
    await page.goto('/');
    await fillForm(page, { Email: '' });
    await send(page).click();
    const email = page.getByLabel('Email', { exact: true });
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#questions-email-error')).toHaveText(
      'Please enter a valid email address.',
    );
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute(
      'aria-describedby',
      /questions-email-error/,
    );
    expect(calls).toBe(0);
  });

  test('shows server-side field errors from a 400', async ({ page }) => {
    await page.route('**/api/contact', (route) =>
      route.fulfill({
        status: 400,
        json: { ok: false, errors: { name: 'Please enter your name.' } },
      }),
    );
    await page.goto('/');
    await fillForm(page);
    await send(page).click();
    await expect(page.locator('#questions-name-error')).toHaveText(
      'Please enter your name.',
    );
  });

  test('does not shift the layout when the thank-you appears', async ({
    page,
  }) => {
    await page.route('**/api/contact', (route) =>
      route.fulfill({ status: 200, json: { ok: true } }),
    );
    await page.goto('/');
    await fillForm(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const before = await page.evaluate(() => document.body.scrollHeight);
    await send(page).click();
    await expect(page.locator('#questions [data-status]')).toHaveText(SUCCESS);
    const after = await page.evaluate(() => document.body.scrollHeight);
    expect(after).toBe(before);
  });

  test('the failure message includes the contact fallback placeholder', async ({
    page,
  }) => {
    await page.route('**/api/contact', (route) =>
      route.fulfill({ status: 502, json: { ok: false } }),
    );
    await page.goto('/');
    await fillForm(page);
    await send(page).click();
    await expect(
      page.locator('#questions [data-status] [data-placeholder]'),
    ).toContainText('public contact email');
  });

  test('shows the thank-you after a fragment redirect and cleans the URL', async ({
    page,
  }) => {
    await page.goto('/sermons#questions-sent');
    await expect(page.locator('#questions [data-status]')).toHaveText(SUCCESS);
    await expect(page).toHaveURL(/\/sermons#questions$/);
    await expect(page.locator('#questions-sent')).toBeHidden();
  });

  test('shows the failure copy after an error fragment redirect', async ({
    page,
  }) => {
    await page.goto('/#questions-error');
    await expect(page.locator('#questions [data-status]')).toContainText(
      FAILURE,
    );
    await expect(page).toHaveURL(/\/#questions$/);
    await expect(page.locator('#questions-error')).toBeHidden();
  });

  test('the static no-JS blocks and noscript note are never visible with JS', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#questions-sent')).toBeHidden();
    await expect(page.locator('#questions-error')).toBeHidden();
    await expect(page.locator('#questions noscript')).toHaveCount(1);
    await expect(page.locator('#questions .questions__noscript')).toHaveCount(
      0,
    );
  });
});

test.describe('Turnstile loading', () => {
  test('is not requested on page load and is requested after focusing a field', async ({
    page,
  }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('challenges.cloudflare.com')) {
        requested.push(request.url());
      }
    });
    await stubTurnstile(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    expect(requested).toEqual([]);

    await page.getByLabel('Name', { exact: true }).focus();
    await expect.poll(() => requested.length).toBe(1);
    expect(requested[0]).toContain('/turnstile/v0/api.js');

    await page.getByLabel('Email', { exact: true }).focus();
    await page.waitForTimeout(300);
    expect(requested.length).toBe(1);
  });

  test('loads at submit time when the user never focused a field first', async ({
    page,
  }) => {
    await stubTurnstile(page);
    await page.route('**/api/contact', (route) =>
      route.fulfill({ status: 200, json: { ok: true } }),
    );
    await page.goto('/');
    await page.evaluate(() => {
      const form = document.querySelector('#questions form') as HTMLFormElement;
      for (const [name, value] of Object.entries({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'hi',
      })) {
        (form.elements.namedItem(name) as HTMLInputElement).value = value;
      }
      form.requestSubmit();
    });
    await expect(page.locator('#questions [data-status]')).toHaveText(SUCCESS);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('success shows the visible thank-you from the real endpoint', async ({
    page,
  }) => {
    await page.goto('/sermons');
    await expect(page.locator('#questions-sent')).toBeHidden();
    await expect(page.locator('#questions-error')).toBeHidden();
    await fillForm(page);
    await send(page).click();
    await expect(page).toHaveURL(/\/sermons#questions-sent$/);
    const sent = page.locator('#questions-sent');
    await expect(sent).toBeVisible();
    await expect(sent).toHaveText(SUCCESS);
    await expect(sent).toBeInViewport();
    await expect(page.locator('#questions-error')).toBeHidden();
  });

  test('a server rejection shows the visible failure copy with the fallback', async ({
    page,
  }) => {
    await page.goto('/events');
    await fillForm(page, { Email: 'ada@localhost' });
    await send(page).click();
    await expect(page).toHaveURL(/\/events#questions-error$/);
    const failed = page.locator('#questions-error');
    await expect(failed).toBeVisible();
    await expect(failed).toContainText(FAILURE);
    await expect(failed.locator('[data-placeholder]')).toBeVisible();
    await expect(failed).toBeInViewport();
    await expect(page.locator('#questions-sent')).toBeHidden();
  });

  test('shows the noscript note about the spam check and contact', async ({
    page,
  }) => {
    await page.goto('/');
    const note = page.locator('#questions .questions__noscript');
    await expect(note).toBeVisible();
    await expect(note).toContainText('spam check');
    await expect(note.locator('[data-placeholder]')).toBeVisible();
  });
});
