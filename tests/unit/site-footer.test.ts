import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import SiteFooter from '../../src/components/site-footer.astro';
import { formatFooterTimes } from '../../src/lib/format-times';

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

const render = (serviceTimes?: string[]) =>
  container.renderToString(SiteFooter, { props: { serviceTimes } });

const timesLine = (html: string) =>
  html
    .match(/<p class="site-footer__times">([\s\S]*?)<\/p>/)![1]
    .replace(/\s+/g, ' ')
    .trim();

describe('formatFooterTimes', () => {
  it('keeps the compact two-service wording', () => {
    expect(formatFooterTimes(['9:00', '10:45'])).toBe('9:00 & 10:45a');
  });

  it('lists three services', () => {
    expect(formatFooterTimes(['8:30', '10:00', '11:30'])).toBe(
      '8:30, 10:00 & 11:30a',
    );
  });

  it('leaves entries that carry their own meridiem alone', () => {
    expect(formatFooterTimes(['9:00 AM', '6:00 PM'])).toBe('9:00 AM & 6:00 PM');
  });
});

describe('SiteFooter service times', () => {
  it('shows the default times when none are passed', async () => {
    expect(timesLine(await render())).toBe('Meeting Sundays 9:00 &amp; 10:45a');
  });

  it('shows every time from the Sanity settings', async () => {
    expect(timesLine(await render(['8:30', '10:00', '11:30']))).toBe(
      'Meeting Sundays 8:30, 10:00 &amp; 11:30a',
    );
  });

  it('falls back to the defaults for an empty list', async () => {
    expect(timesLine(await render([]))).toBe(
      'Meeting Sundays 9:00 &amp; 10:45a',
    );
  });
});
