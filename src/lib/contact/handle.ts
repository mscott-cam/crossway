import { validateContact, type ContactInput } from './validate';

export const MAX_BODY_BYTES = 20 * 1024;

type Env = Record<string, string | undefined>;

export type ContactDeps = {
  env: Env;
  send: (value: ContactInput) => Promise<void>;
  verifyTurnstile: (token: string, remoteip?: string) => Promise<boolean>;
};

const RETURN_TO = /^\/[A-Za-z0-9/_\-.]*$/;

export function safeReturnTo(value: unknown): string {
  if (
    typeof value === 'string' &&
    value.length <= 200 &&
    RETURN_TO.test(value) &&
    !value.startsWith('//')
  ) {
    return value;
  }
  return '/';
}

const present = (value: string | undefined) => !!value && value.trim() !== '';

class BodyTooLarge extends Error {}

async function readLimited(request: Request): Promise<string> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new BodyTooLarge();
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function fieldsFrom(
  contentType: string,
  raw: string,
): Record<string, unknown> | null {
  if (contentType.includes('application/json')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

function wantsHtml(request: Request): boolean {
  const accept = request.headers.get('accept') ?? '';
  return accept.includes('text/html') && !accept.includes('application/json');
}

const JSON_HEADERS = { 'Cache-Control': 'no-store' };

function respondJson(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: JSON_HEADERS });
}

export async function handleContact(
  request: Request,
  deps: ContactDeps,
  clientIp?: string,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(null, {
      status: 405,
      headers: { Allow: 'POST', ...JSON_HEADERS },
    });
  }

  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  const isJson = contentType.includes('application/json');
  const isForm = contentType.includes('application/x-www-form-urlencoded');
  if (!isJson && !isForm) return respondJson(415, { ok: false });

  let raw: string;
  try {
    raw = await readLimited(request);
  } catch (error) {
    if (error instanceof BodyTooLarge) return respondJson(413, { ok: false });
    return respondJson(400, { ok: false, errors: {} });
  }

  const fields = fieldsFrom(contentType, raw);
  const html = wantsHtml(request);
  const returnTo = safeReturnTo(fields?.returnTo);
  const finish = (status: number, body: unknown, sent = status === 200) =>
    html
      ? new Response(null, {
          status: 303,
          headers: {
            Location: `${returnTo}?${sent ? 'sent' : 'error'}=1#questions`,
            ...JSON_HEADERS,
          },
        })
      : respondJson(status, body);

  if (!fields) return finish(400, { ok: false, errors: {} });

  const token = fields.turnstileToken ?? fields['cf-turnstile-response'];
  const parsed = validateContact({ ...fields, turnstileToken: token });

  if (typeof fields.company === 'string' && fields.company.trim() !== '') {
    return finish(200, { ok: true });
  }

  if (!parsed.ok) return finish(400, { ok: false, errors: parsed.errors });

  const { env } = deps;
  if (!present(env.RESEND_API_KEY) || !present(env.CONTACT_TO_EMAIL)) {
    console.error('contact: email delivery is not configured');
    return finish(503, { ok: false });
  }

  if (present(env.TURNSTILE_SECRET_KEY)) {
    const verified = await deps
      .verifyTurnstile(parsed.value.turnstileToken, clientIp)
      .catch(() => false);
    if (!verified) {
      console.error('contact: Turnstile verification failed');
      return finish(403, { ok: false });
    }
  } else if (env.VERCEL_ENV === 'production') {
    console.error('contact: Turnstile is not configured');
    return finish(503, { ok: false });
  }

  try {
    await deps.send(parsed.value);
  } catch {
    console.error('contact: sending failed');
    return finish(502, { ok: false });
  }
  return finish(200, { ok: true });
}
