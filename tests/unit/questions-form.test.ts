import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import ContactFallback from '../../src/components/contact-fallback.astro';
import QuestionsForm from '../../src/components/questions-form.astro';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const original = process.env.CONTACT_PUBLIC_EMAIL;
afterEach(() => {
  if (original === undefined) delete process.env.CONTACT_PUBLIC_EMAIL;
  else process.env.CONTACT_PUBLIC_EMAIL = original;
});

const render = (props: Record<string, unknown> = {}) =>
  container.renderToString(ContactFallback, { props });

const renderForm = () =>
  container.renderToString(QuestionsForm, {
    request: new Request('http://localhost/sermons'),
  });

describe('contact fallback', () => {
  it('renders a mailto link for a valid public address', async () => {
    const html = await render({ email: 'office@example.org' });
    expect(html).toContain('href="mailto:office@example.org"');
    expect(html).not.toContain('data-placeholder');
  });

  it.each([undefined, '', 'not an email', 'a@"><script>'])(
    'renders the placeholder and never invents an address for %j',
    async (email) => {
      const html = await render({ email });
      expect(html).toContain('data-placeholder');
      expect(html).toContain('public contact email');
      expect(html).not.toContain('mailto:');
    },
  );
});

describe('questions form markup', () => {
  it('has the static no-JS result blocks with the exact copy', async () => {
    delete process.env.CONTACT_PUBLIC_EMAIL;
    const html = await renderForm();
    expect(html).toContain('id="questions-sent"');
    expect(html.replaceAll('&#39;', "'")).toContain(
      "Thank you! We'll get back to you soon.",
    );
    expect(html).toContain('id="questions-error"');
    expect(html.replace(/\s+/g, ' ')).toContain(
      'Something went wrong sending your message. Please try again, or email us directly.',
    );
  });

  it('puts the placeholder in the failure block and noscript note when no address is set', async () => {
    delete process.env.CONTACT_PUBLIC_EMAIL;
    const html = await renderForm();
    const error = html.slice(html.indexOf('id="questions-error"'));
    expect(error.slice(0, error.indexOf('<form'))).toContain(
      'data-placeholder',
    );
    const noscript = html.slice(html.indexOf('<noscript>'));
    expect(noscript.slice(0, noscript.indexOf('</noscript>'))).toContain(
      'data-placeholder',
    );
    expect(html).not.toContain('mailto:');
  });

  it('uses the owner-supplied address in both places when set', async () => {
    process.env.CONTACT_PUBLIC_EMAIL = 'office@example.org';
    const html = await renderForm();
    expect(html.match(/mailto:office@example\.org/g)).toHaveLength(2);
    expect(html).not.toContain('data-placeholder');
  });

  it('uses a non-autofillable honeypot', async () => {
    const html = await renderForm();
    expect(html).toContain('name="contact_extra_note"');
    expect(html).toContain('Leave this field empty');
    expect(html).not.toMatch(/name="company"/);
    expect(html).toContain('tabindex="-1"');
  });
});
