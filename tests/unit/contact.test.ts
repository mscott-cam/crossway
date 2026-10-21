import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  validateContact,
  type ContactInput,
} from '../../src/lib/contact/validate';
import {
  renderContactEmail,
  sendContactEmail,
  useTestTransport,
} from '../../src/lib/contact/email';
import { verifyTurnstile } from '../../src/lib/contact/turnstile';
import { handleContact, safeReturnTo } from '../../src/lib/contact/handle';
import * as route from '../../src/pages/api/contact';

const valid = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  heardFrom: 'A friend',
  message: 'Could you pray for my family?',
  turnstileToken: 'tok',
};

describe('validateContact', () => {
  it('accepts a complete message and trims fields', () => {
    const result = validateContact({
      ...valid,
      name: '  Ada  ',
      message: '  hello  ',
    });
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ name: 'Ada', message: 'hello' }),
    });
  });

  it('allows a missing heardFrom', () => {
    const { heardFrom: _omit, ...rest } = valid;
    expect(validateContact(rest).ok).toBe(true);
  });

  it('rejects a missing email', () => {
    const { email: _omit, ...rest } = valid;
    const result = validateContact(rest);
    expect(result).toEqual({
      ok: false,
      errors: { email: 'Please enter a valid email address.' },
    });
  });

  it.each(['a@', 'a@b', '@b.com', 'a b@c.com', 'a@b..com', 'a@b.c\r\nBcc: x'])(
    'rejects the email %j',
    (email) => {
      const result = validateContact({ ...valid, email });
      expect(result.ok).toBe(false);
    },
  );

  it('rejects an email longer than 254 characters', () => {
    const email = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.com`;
    expect(email.length).toBeGreaterThan(254);
    expect(validateContact({ ...valid, email }).ok).toBe(false);
  });

  it('rejects an empty or whitespace name', () => {
    for (const name of ['', '   ', undefined]) {
      expect(validateContact({ ...valid, name })).toEqual({
        ok: false,
        errors: { name: 'Please enter your name.' },
      });
    }
  });

  it('enforces the name boundary at 100 characters', () => {
    expect(validateContact({ ...valid, name: 'n'.repeat(100) }).ok).toBe(true);
    expect(validateContact({ ...valid, name: 'n'.repeat(101) })).toEqual({
      ok: false,
      errors: { name: 'Please keep your name under 100 characters.' },
    });
  });

  it('enforces the heardFrom boundary at 200 characters', () => {
    expect(validateContact({ ...valid, heardFrom: 'h'.repeat(200) }).ok).toBe(
      true,
    );
    const result = validateContact({ ...valid, heardFrom: 'h'.repeat(201) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.heardFrom).toBeTruthy();
  });

  it('requires a message', () => {
    expect(validateContact({ ...valid, message: '   ' })).toEqual({
      ok: false,
      errors: { message: 'Please write a message.' },
    });
  });

  it('enforces the message boundary at 5000 characters', () => {
    expect(validateContact({ ...valid, message: 'm'.repeat(5000) }).ok).toBe(
      true,
    );
    expect(validateContact({ ...valid, message: 'm'.repeat(5001) }).ok).toBe(
      false,
    );
  });

  it('rejects a 10,001-character message with the plain-English error', () => {
    const result = validateContact({ ...valid, message: 'm'.repeat(10001) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.message).toBe(
        'Please keep your message under 5,000 characters.',
      );
    }
  });

  it('reports every failing field at once', () => {
    const result = validateContact({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        'email',
        'message',
        'name',
      ]);
    }
  });

  it('treats non-object input and non-string fields as empty', () => {
    expect(validateContact(null).ok).toBe(false);
    expect(validateContact('x').ok).toBe(false);
    expect(validateContact({ ...valid, name: 42 }).ok).toBe(false);
  });

  it('keeps the honeypot value so the caller can flag spam', () => {
    const result = validateContact({ ...valid, contact_extra_note: 'Acme' });
    expect(result.ok && result.value.contact_extra_note).toBe('Acme');
  });
});

describe('renderContactEmail', () => {
  const base: ContactInput = {
    name: 'Ada',
    email: 'ada@example.com',
    heardFrom: 'Friend',
    message: 'Hello',
    turnstileToken: '',
  };

  it('escapes HTML in every user field', () => {
    const attack = '<script>alert(1)</script>';
    const { html, text } = renderContactEmail({
      ...base,
      name: attack,
      heardFrom: attack,
      message: attack,
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('</script>');
    expect(text).toContain(attack);
  });

  it('escapes quotes and ampersands', () => {
    const { html } = renderContactEmail({
      ...base,
      message: `"a" & 'b'`,
    });
    expect(html).toContain('&quot;a&quot; &amp; &#39;b&#39;');
  });

  it('builds the subject from the name and strips control characters', () => {
    const { subject } = renderContactEmail({
      ...base,
      name: 'Ada\r\nBcc: evil@example.com\u0000\u2028x',
    });
    expect(subject).toMatch(/^Website question\/prayer from Ada/);
    expect(subject).not.toMatch(/[\r\n\u0000\u2028]/);
  });

  it('truncates a long name in the subject', () => {
    const { subject } = renderContactEmail({ ...base, name: 'n'.repeat(100) });
    expect(subject.length).toBeLessThan(100);
    expect(subject.endsWith('…')).toBe(true);
  });

  it('includes name, email, how they heard and the message in both bodies', () => {
    const { html, text } = renderContactEmail(base);
    for (const part of ['Ada', 'ada@example.com', 'Friend', 'Hello']) {
      expect(html).toContain(part);
      expect(text).toContain(part);
    }
  });

  it('omits the how-they-heard row when blank', () => {
    const { text } = renderContactEmail({ ...base, heardFrom: undefined });
    expect(text).not.toMatch(/heard/i);
  });
});

describe('sendContactEmail', () => {
  const v: ContactInput = {
    name: 'Ada',
    email: 'ada@example.com',
    message: 'Hello',
    turnstileToken: '',
  };

  const clientWith = (result: unknown) => {
    const send = vi.fn(
      async (_payload: unknown) => result as { error?: unknown },
    );
    return { send, client: { emails: { send } } };
  };

  it('sends with reply-to, a recipient list and the configured from address', async () => {
    const { send, client } = clientWith({ data: { id: '1' }, error: null });
    await sendContactEmail(v, {
      client,
      env: {
        CONTACT_TO_EMAIL: 'a@church.org, b@church.org',
        CONTACT_FROM_EMAIL: 'Site <site@church.org>',
      },
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Site <site@church.org>',
        to: ['a@church.org', 'b@church.org'],
        replyTo: 'ada@example.com',
        subject: 'Website question/prayer from Ada',
        html: expect.any(String),
        text: expect.any(String),
      }),
    );
  });

  it('falls back to the Resend test sender only outside production', async () => {
    const dev = clientWith({ data: {}, error: null });
    await sendContactEmail(v, {
      client: dev.client,
      env: { CONTACT_TO_EMAIL: 'a@church.org' },
    });
    expect(dev.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Crossway Website <onboarding@resend.dev>',
      }),
    );

    const prod = clientWith({ data: {}, error: null });
    await expect(
      sendContactEmail(v, {
        client: prod.client,
        env: { CONTACT_TO_EMAIL: 'a@church.org', VERCEL_ENV: 'production' },
      }),
    ).rejects.toThrow();
    expect(prod.send).not.toHaveBeenCalled();
  });

  it('throws when Resend reports an error, carrying only its name and status', async () => {
    const { client } = clientWith({
      data: null,
      error: {
        name: 'validation_error',
        message: 'bad ada@example.com',
        statusCode: 422,
      },
    });
    const failure = (await sendContactEmail(v, {
      client,
      env: { CONTACT_TO_EMAIL: 'a@church.org' },
    }).catch((error: unknown) => error)) as Error & Record<string, unknown>;
    expect(failure).toBeInstanceOf(Error);
    expect(failure.code).toBe('validation_error');
    expect(failure.status).toBe(422);
    expect(failure.message).not.toContain('ada@example.com');
  });
});

describe('test transport guard', () => {
  it('activates only for the e2e build, a non-production env and the fake key', () => {
    const env = { RESEND_API_KEY: 'e2e-fake' };
    expect(useTestTransport(env, true)).toBe(true);
    expect(useTestTransport(env, false)).toBe(false);
    expect(useTestTransport({ ...env, VERCEL_ENV: 'production' }, true)).toBe(
      false,
    );
    expect(useTestTransport({ RESEND_API_KEY: 're_real' }, true)).toBe(false);
    expect(useTestTransport({}, true)).toBe(false);
  });

  it('is off in the unit-test build', async () => {
    const send = await import('../../src/lib/contact/email');
    expect(send.e2eBuild).toBe(false);
  });
});

describe('verifyTurnstile', () => {
  const ok = (body: unknown) => async () =>
    new Response(JSON.stringify(body), { status: 200 });

  it('posts the secret, token and ip as a form to siteverify', async () => {
    const fetchFn = vi.fn(ok({ success: true }));
    const result = await verifyTurnstile('tok', {
      secret: 'sec',
      remoteip: '1.2.3.4',
      fetch: fetchFn as unknown as typeof fetch,
    });
    expect(result).toBe(true);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    );
    expect(init.method).toBe('POST');
    const body = init.body as URLSearchParams;
    expect(body.get('secret')).toBe('sec');
    expect(body.get('response')).toBe('tok');
    expect(body.get('remoteip')).toBe('1.2.3.4');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('fails closed on success:false, HTTP errors, throws and empty tokens', async () => {
    const opts = (fetchFn: unknown) => ({
      secret: 's',
      fetch: fetchFn as typeof fetch,
    });
    expect(await verifyTurnstile('t', opts(ok({ success: false })))).toBe(
      false,
    );
    expect(
      await verifyTurnstile(
        't',
        opts(async () => new Response('x', { status: 500 })),
      ),
    ).toBe(false);
    expect(
      await verifyTurnstile(
        't',
        opts(async () => {
          throw new Error('network');
        }),
      ),
    ).toBe(false);
    const never = vi.fn(ok({ success: true }));
    expect(await verifyTurnstile('', opts(never))).toBe(false);
    expect(never).not.toHaveBeenCalled();
  });
});

describe('safeReturnTo', () => {
  it.each([
    '//evil.com',
    'https://x',
    '/\\evil',
    '/a\r\nLocation: x',
    '/a?b=1',
    '',
    'foo',
    '/a b',
  ])('rejects %j', (value) => {
    expect(safeReturnTo(value)).toBe('/');
  });

  it.each(['/', '/sermons', '/sermons/book/john', '/a_b-c.d'])(
    'accepts %j',
    (value) => {
      expect(safeReturnTo(value)).toBe(value);
    },
  );

  it('falls back for non-strings and overlong paths', () => {
    expect(safeReturnTo(undefined)).toBe('/');
    expect(safeReturnTo(`/${'a'.repeat(300)}`)).toBe('/');
  });
});

describe('handleContact', () => {
  const baseEnv = {
    RESEND_API_KEY: 're_secret_key',
    CONTACT_TO_EMAIL: 'x@y.org',
  };

  const make = (
    overrides: {
      env?: Record<string, string | undefined>;
      send?: (value: ContactInput) => Promise<void>;
      verify?: () => Promise<boolean>;
    } = {},
  ) => {
    const send = vi.fn(overrides.send ?? (async (_value: ContactInput) => {}));
    const verify = vi.fn(overrides.verify ?? (async () => true));
    return {
      send,
      verify,
      deps: {
        env: overrides.env ?? baseEnv,
        send,
        verifyTurnstile: verify,
      },
    };
  };

  const json = (body: unknown, init: RequestInit = {}) =>
    new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
      ...init,
    });

  const form = (fields: Record<string, string>, accept = 'text/html') =>
    new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept,
      },
      body: new URLSearchParams(fields),
    });

  const read = async (response: Response) => ({
    status: response.status,
    body: await response.json().catch(() => null),
  });

  afterEach(() => vi.restoreAllMocks());

  it('sends a valid JSON submission and answers 200 ok', async () => {
    const { deps, send } = make();
    const response = await handleContact(json(valid), deps);
    expect(await read(response)).toEqual({ status: 200, body: { ok: true } });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    });
  });

  it('accepts a form-encoded submission and maps the Turnstile field', async () => {
    const { deps, send, verify } = make({
      env: { ...baseEnv, TURNSTILE_SECRET_KEY: 'sec' },
    });
    const response = await handleContact(
      form(
        {
          name: 'Ada',
          email: 'ada@example.com',
          message: 'hi',
          'cf-turnstile-response': 'tok-1',
        },
        'application/json',
      ),
      deps,
    );
    expect(response.status).toBe(200);
    expect(verify).toHaveBeenCalledWith('tok-1', undefined);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('returns 400 with field errors and does not send', async () => {
    const { deps, send } = make();
    const response = await handleContact(json({ ...valid, email: 'a@' }), deps);
    const { status, body } = await read(response);
    expect(status).toBe(400);
    expect(body).toEqual({
      ok: false,
      errors: { email: 'Please enter a valid email address.' },
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('silently drops a honeypot hit with 200 and never sends', async () => {
    const { deps, send, verify } = make();
    const response = await handleContact(
      json({ ...valid, contact_extra_note: 'Acme' }),
      deps,
    );
    expect(await read(response)).toEqual({ status: 200, body: { ok: true } });
    expect(send).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it('answers 403 and does not send when Turnstile fails', async () => {
    const { deps, send } = make({
      env: { ...baseEnv, TURNSTILE_SECRET_KEY: 'sec' },
      verify: async () => false,
    });
    const response = await handleContact(json(valid), deps);
    expect(response.status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  it('skips Turnstile in non-production when no secret is set', async () => {
    const { deps, verify, send } = make();
    expect((await handleContact(json(valid), deps)).status).toBe(200);
    expect(verify).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalled();
  });

  it('answers 503 in production when the Turnstile secret is unset', async () => {
    const { deps, send } = make({
      env: {
        ...baseEnv,
        CONTACT_FROM_EMAIL: 'Site <site@church.org>',
        VERCEL_ENV: 'production',
      },
    });
    const response = await handleContact(json(valid), deps);
    expect(await read(response)).toEqual({ status: 503, body: { ok: false } });
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['RESEND_API_KEY', { CONTACT_TO_EMAIL: 'x@y.org' }],
    ['CONTACT_TO_EMAIL', { RESEND_API_KEY: 'k' }],
    ['both', {}],
  ])(
    'answers 503 when %s is unset and never claims success',
    async (_n, env) => {
      const { deps, send } = make({ env });
      const response = await handleContact(json(valid), deps);
      expect(response.status).toBe(503);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('treats blank env values as unset', async () => {
    const { deps } = make({
      env: { RESEND_API_KEY: '  ', CONTACT_TO_EMAIL: 'x@y.org' },
    });
    expect((await handleContact(json(valid), deps)).status).toBe(503);
  });

  it('answers 503 in production when CONTACT_FROM_EMAIL is unset, not 502', async () => {
    const { deps, send } = make({
      env: {
        ...baseEnv,
        TURNSTILE_SECRET_KEY: 'sec',
        VERCEL_ENV: 'production',
      },
    });
    const response = await handleContact(json(valid), deps);
    expect(response.status).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 403 with a distinct log line when the secret is set but the token is empty', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { deps, send, verify } = make({
      env: { ...baseEnv, TURNSTILE_SECRET_KEY: 'sec' },
    });
    const response = await handleContact(
      json({ ...valid, turnstileToken: '' }),
      deps,
    );
    expect(response.status).toBe(403);
    expect(send).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    expect(error.mock.calls.flat().join(' ')).toContain(
      'Turnstile token missing',
    );

    error.mockClear();
    const denied = make({
      env: { ...baseEnv, TURNSTILE_SECRET_KEY: 'sec' },
      verify: async () => false,
    });
    await handleContact(json(valid), denied.deps);
    const logged = error.mock.calls.flat().join(' ');
    expect(logged).toContain('Turnstile verification failed');
    expect(logged).not.toContain('token missing');
  });

  it('logs only a non-sensitive error code and status when Resend fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { deps } = make({
      send: async () => {
        throw Object.assign(new Error('secret re_secret_key ada@example.com'), {
          code: 'validation_error',
          status: 422,
        });
      },
    });
    const response = await handleContact(json(valid), deps);
    expect(response.status).toBe(502);
    const logged = error.mock.calls.flat().join(' ');
    expect(logged).toContain('validation_error');
    expect(logged).toContain('422');
    expect(logged).not.toContain('re_secret_key');
    expect(logged).not.toContain('ada@example.com');
  });

  it('answers 502 when Resend fails', async () => {
    const { deps } = make({
      send: async () => {
        throw new Error('resend down');
      },
    });
    const response = await handleContact(json(valid), deps);
    expect(await read(response)).toEqual({ status: 502, body: { ok: false } });
  });

  it('answers 413 for an oversized body, by header and by actual size', async () => {
    const { deps, send } = make();
    const big = json({ ...valid, message: 'm'.repeat(30000) });
    expect((await handleContact(big, deps)).status).toBe(413);

    const lying = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '10' },
      body: JSON.stringify({ ...valid, message: 'm'.repeat(30000) }),
    });
    expect((await handleContact(lying, deps)).status).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 405 with Allow: POST for other methods', async () => {
    const { deps } = make();
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await handleContact(
        new Request('http://localhost/api/contact', { method }),
        deps,
      );
      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('POST');
    }
  });

  it('answers 400 for malformed JSON and 415 for other content types', async () => {
    const { deps } = make();
    const bad = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{nope',
    });
    expect((await handleContact(bad, deps)).status).toBe(400);
    const odd = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hi',
    });
    expect((await handleContact(odd, deps)).status).toBe(415);
  });

  describe('plain HTML form posts', () => {
    const fields = {
      name: 'Ada',
      email: 'ada@example.com',
      message: 'hi',
      returnTo: '/sermons',
    };

    it('redirects 303 to returnTo with #questions-sent on success', async () => {
      const { deps } = make();
      const response = await handleContact(form(fields), deps);
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('/sermons#questions-sent');
    });

    it('redirects with #questions-error on any failure', async () => {
      const failing = make({
        send: async () => {
          throw new Error('x');
        },
      });
      const sendFail = await handleContact(form(fields), failing.deps);
      expect(sendFail.headers.get('location')).toBe('/sermons#questions-error');
      const invalid = await handleContact(
        form({ ...fields, email: '' }),
        make().deps,
      );
      expect(invalid.status).toBe(303);
      expect(invalid.headers.get('location')).toBe('/sermons#questions-error');
      const unconfigured = await handleContact(
        form(fields),
        make({ env: {} }).deps,
      );
      expect(unconfigured.headers.get('location')).toBe(
        '/sermons#questions-error',
      );
    });

    it('redirects a honeypot hit as a success', async () => {
      const { deps, send } = make();
      const response = await handleContact(
        form({ ...fields, contact_extra_note: 'Acme' }),
        deps,
      );
      expect(response.headers.get('location')).toBe('/sermons#questions-sent');
      expect(send).not.toHaveBeenCalled();
    });

    it('never redirects off-site', async () => {
      for (const returnTo of ['//evil.com', 'https://x', '/\\evil']) {
        const response = await handleContact(
          form({ ...fields, returnTo }),
          make().deps,
        );
        expect(response.headers.get('location')).toBe('/#questions-sent');
      }
    });

    it('keeps /.//evil on the same origin as a path-only redirect', async () => {
      const response = await handleContact(
        form({ ...fields, returnTo: '/.//evil' }),
        make().deps,
      );
      const location = response.headers.get('location')!;
      expect(location).toBe('/.//evil#questions-sent');
      const resolved = new URL(location, 'https://crosswaysa.org');
      expect(resolved.origin).toBe('https://crosswaysa.org');
      expect(location.startsWith('//')).toBe(false);
    });

    it('answers JSON, not a redirect, when the client prefers JSON', async () => {
      const response = await handleContact(
        form(fields, 'application/json, text/html'),
        make().deps,
      );
      expect(response.status).toBe(200);
    });
  });

  describe('logging', () => {
    it('never logs secrets, tokens or message bodies', async () => {
      const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
        (m) => vi.spyOn(console, m).mockImplementation(() => {}),
      );
      const secretBody = 'my-private-prayer-request';
      const secrets = ['re_secret_key', 'turnstile-secret', 'tok-private'];
      const failing = make({
        env: { ...baseEnv, TURNSTILE_SECRET_KEY: 'turnstile-secret' },
        send: async () => {
          throw new Error(`failed with re_secret_key ${secretBody}`);
        },
      });
      await handleContact(
        json({ ...valid, message: secretBody, turnstileToken: 'tok-private' }),
        failing.deps,
      );
      const denied = make({
        env: { ...baseEnv, TURNSTILE_SECRET_KEY: 'turnstile-secret' },
        verify: async () => false,
      });
      await handleContact(
        json({ ...valid, message: secretBody, turnstileToken: 'tok-private' }),
        denied.deps,
      );
      await handleContact(json(valid), make({ env: {} }).deps);

      const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
      expect(logged).not.toContain(secretBody);
      for (const secret of secrets) expect(logged).not.toContain(secret);
      expect(logged).not.toContain('ada@example.com');
    });
  });
});

describe('api route file', () => {
  it('is on demand and exposes only POST plus a 405 fallback', () => {
    expect(route.prerender).toBe(false);
    expect(typeof route.POST).toBe('function');
    expect(typeof route.ALL).toBe('function');
  });

  it('answers non-POST methods with 405 and Allow: POST', async () => {
    const response = await (
      route.ALL as unknown as (ctx: unknown) => Promise<Response>
    )({ request: new Request('http://localhost/api/contact') });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});
