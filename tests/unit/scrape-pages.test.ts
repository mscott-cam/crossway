import { describe, expect, it } from 'vitest';
import { htmlToMarkdownDraft } from '../../scripts/lib/html-to-markdown';
import { parseScrapeArgs, pageUrl } from '../../scripts/lib/scrape-args';

const fixture = `<!DOCTYPE html><html><head><title>Culture</title>
<script>window.dataLayer = []; var tracker = 'SCRIPT_JUNK';</script>
<style>.cookie-banner { display: none }</style></head>
<body class="body-3">
<div class="navbar w-nav"><a href="/culture">NAV_JUNK Culture</a></div>
<nav><a href="/who-we-are">NAV_JUNK Our Leadership</a></nav>
<div class="sticky-div"><a href="/sermons">STICKY_JUNK Sermons</a></div>
<div id="cookie-consent">COOKIE_JUNK We use cookies</div>
<section class="section">
  <div class="banner-heading"><h1 class="section-heading">Networks</h1></div>
  <img src="https://cdn.prod.website-files.com/x.jpg" alt="">
  <div class="quote-wrapper">
    <div class="section-copy">Churches are <strong>not</strong> meant to be <em>alone</em>.<br><br>Second paragraph with a
      <a href="https://www.crosswaysa.org/sermons/example">relative link</a> and an
      <a href="https://example.org/out">external link</a> and a <a href="#https://www.gccollective.org/">wrapped link</a>.</div>
    <div class="section-subheading">A Pseudo Heading</div>
  </div>
  <h2>Real Heading</h2>
  <ul><li>First item</li><li>Second <a href="mailto:a@b.org">mail</a></li></ul>
  <ol><li>One</li><li>Two</li></ol>
  <h3>Nested heading</h3>
  <p>Zero&#8205;width&nbsp;and   spaces.</p>
  <div class="w-embed"><iframe src="https://player.vimeo.com/video/1"></iframe>EMBED_JUNK</div>
</section>
<section class="section footer">
  <div class="w-form"><form><label>Name:</label><input class="w-input"><input type="submit" value="FORM_JUNK"></form></div>
  <div class="modal-wrapper">MODAL_JUNK Have Questions? Need Prayer?</div>
  <footer>FOOTER_JUNK © 2024 Crossway Bible Church</footer>
</section>
<script src="https://example.org/x.js"></script>
</body></html>`;

describe('htmlToMarkdownDraft', () => {
  const md = htmlToMarkdownDraft(fixture);

  it('strips nav, footer, form, embeds, scripts, styles and cookie junk', () => {
    for (const junk of [
      'NAV_JUNK',
      'STICKY_JUNK',
      'COOKIE_JUNK',
      'SCRIPT_JUNK',
      'EMBED_JUNK',
      'FORM_JUNK',
      'MODAL_JUNK',
      'FOOTER_JUNK',
      'Have Questions',
      'dataLayer',
      'cookie-banner',
      '<',
    ]) {
      expect(md).not.toContain(junk);
    }
  });

  it('drops the page title h1 and never emits an h1', () => {
    expect(md).not.toMatch(/^# /m);
    expect(md).not.toContain('Networks');
  });

  it('starts at h2 and keeps heading hierarchy', () => {
    expect(md).toMatch(/^## Real Heading$/m);
    expect(md).toMatch(/^### Nested heading$/m);
    expect(md).toMatch(/^### A Pseudo Heading$/m);
    expect(md.trimStart().startsWith('Churches')).toBe(true);
  });

  it('keeps emphasis, paragraph breaks and lists', () => {
    expect(md).toContain('Churches are **not** meant to be *alone*.');
    expect(md).toMatch(/alone\*\.\n\nSecond paragraph/);
    expect(md).toMatch(/^- First item$/m);
    expect(md).toMatch(/^- Second \[mail\]\(mailto:a@b\.org\)$/m);
    expect(md).toMatch(/^1\. One$/m);
    expect(md).toMatch(/^2\. Two$/m);
  });

  it('makes internal links relative and cleans wrapped external links', () => {
    expect(md).toContain('[relative link](/sermons/example)');
    expect(md).toContain('[external link](https://example.org/out)');
    expect(md).toContain('[wrapped link](https://www.gccollective.org/)');
  });

  it('normalises whitespace and zero-width characters', () => {
    expect(md).toContain('Zerowidth and spaces.');
    expect(md).not.toMatch(/‍| /);
    expect(md).not.toMatch(/ {2,}/);
  });

  it('shifts headings so the shallowest becomes h2 when the page starts at h3', () => {
    const out = htmlToMarkdownDraft(
      '<body><h1>Title</h1><h3>Deep</h3><p>x</p><h4>Deeper</h4></body>',
    );
    expect(out).toMatch(/^## Deep$/m);
    expect(out).toMatch(/^### Deeper$/m);
  });

  it('returns an empty string for a page with no content', () => {
    expect(htmlToMarkdownDraft('<html><body><nav>x</nav></body></html>')).toBe(
      '',
    );
  });
});

describe('scrape-pages arguments', () => {
  it('builds the live URL from a path with or without a leading slash', () => {
    expect(pageUrl('culture')).toBe('https://crosswaysa.org/culture');
    expect(pageUrl('/culture')).toBe('https://crosswaysa.org/culture');
    expect(pageUrl('culture', 'https://www.crosswaysa.org/')).toBe(
      'https://www.crosswaysa.org/culture',
    );
  });

  it('parses a path, --out and --base', () => {
    expect(
      parseScrapeArgs(['networks', '--out', 'x.md', '--base', 'https://a.b']),
    ).toEqual({ path: 'networks', out: 'x.md', base: 'https://a.b' });
    expect(parseScrapeArgs(['networks'])).toEqual({ path: 'networks' });
  });

  it('rejects missing paths, unknown flags and flags without values', () => {
    expect(() => parseScrapeArgs([])).toThrow(/usage/i);
    expect(() => parseScrapeArgs(['a', '--nope'])).toThrow(/unknown option/i);
    expect(() => parseScrapeArgs(['a', '--out'])).toThrow(/--out/);
    expect(() => parseScrapeArgs(['a', 'b'])).toThrow(/usage/i);
  });
});
