import { describe, expect, it } from 'vitest';
import { renderInlineMarkdown } from '../../src/lib/inline-markdown';

describe('renderInlineMarkdown', () => {
  it('wraps plain text in a paragraph', () => {
    expect(renderInlineMarkdown('Hello there')).toBe('<p>Hello there</p>');
  });

  it('splits blank-line separated text into paragraphs', () => {
    expect(renderInlineMarkdown('One\n\nTwo')).toBe('<p>One</p><p>Two</p>');
  });

  it('renders bold, emphasis and links', () => {
    const html = renderInlineMarkdown(
      'A **bold** and *soft* [link](https://example.com/a?b=1&c=2).',
    );
    expect(html).toBe(
      '<p>A <strong>bold</strong> and <em>soft</em> <a href="https://example.com/a?b=1&amp;c=2">link</a>.</p>',
    );
  });

  it('keeps mailto links with a subject', () => {
    const html = renderInlineMarkdown(
      '([Scott@CrosswaySA.org](mailto:Scott@CrosswaySA.org?subject=Questions%20about%20ENTRUSTED))',
    );
    expect(html).toContain(
      '<a href="mailto:Scott@CrosswaySA.org?subject=Questions%20about%20ENTRUSTED">Scott@CrosswaySA.org</a>',
    );
  });

  it('escapes raw HTML so it can never run', () => {
    const html = renderInlineMarkdown('<script>alert(1)</script> <b>x</b> &');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('drops links with unsafe schemes but keeps their text', () => {
    const html = renderInlineMarkdown('[click](javascript:alert(1)) now');
    expect(html).not.toContain('href');
    expect(html).not.toContain('javascript');
    expect(html).toContain('click');
  });

  it('does not treat dollar amounts or asterisk-free text as markup', () => {
    expect(renderInlineMarkdown('$1.7 million is $3.4 million')).toBe(
      '<p>$1.7 million is $3.4 million</p>',
    );
  });
});
