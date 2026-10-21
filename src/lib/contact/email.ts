import { Resend } from 'resend';
import type { ContactInput } from './validate';

declare const __E2E__: boolean | undefined;

export const e2eBuild = typeof __E2E__ !== 'undefined' && __E2E__ === true;

type Env = Record<string, string | undefined>;

type EmailPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo: string;
};

export type EmailClient = {
  emails: {
    send: (payload: EmailPayload) => Promise<{ error?: unknown } | undefined>;
  };
};

type SendDeps = { client?: EmailClient; env?: Env };

export class ContactSendError extends Error {
  constructor(
    readonly code: string,
    readonly status?: number,
  ) {
    super('Resend rejected the message');
  }
}

const TEST_SENDER = 'Crossway Website <onboarding@resend.dev>';
const SUBJECT_NAME_MAX = 60;

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ESCAPES[char]!);

function subjectName(name: string): string {
  const clean = name
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > SUBJECT_NAME_MAX
    ? `${clean.slice(0, SUBJECT_NAME_MAX - 1).trimEnd()}…`
    : clean;
}

export function renderContactEmail(v: ContactInput): {
  subject: string;
  html: string;
  text: string;
} {
  const rows: [string, string][] = [
    ['Name', v.name],
    ['Email', v.email],
  ];
  if (v.heardFrom) rows.push(['How they heard about us', v.heardFrom]);
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#333333">',
    '<p style="margin:0 0 16px"><strong>New question or prayer request from the website</strong></p>',
    ...rows.map(
      ([label, value]) =>
        `<p style="margin:0 0 4px"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
    ),
    '<p style="margin:16px 0 4px"><strong>Message:</strong></p>',
    `<div style="white-space:pre-wrap">${escapeHtml(v.message)}</div>`,
    '</div>',
  ].join('\n');
  const text = [
    'New question or prayer request from the website',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Message:',
    v.message,
  ].join('\n');
  return {
    subject: `Website question/prayer from ${subjectName(v.name)}`,
    html,
    text,
  };
}

export function useTestTransport(env: Env, e2e: boolean): boolean {
  return (
    e2e && env.VERCEL_ENV !== 'production' && env.RESEND_API_KEY === 'e2e-fake'
  );
}

function defaultClient(env: Env): EmailClient {
  if (useTestTransport(env, e2eBuild)) {
    return { emails: { send: async () => ({}) } };
  }
  return new Resend(env.RESEND_API_KEY) as unknown as EmailClient;
}

export async function sendContactEmail(
  v: ContactInput,
  { env = process.env, client }: SendDeps = {},
): Promise<void> {
  const production = env.VERCEL_ENV === 'production';
  const from =
    env.CONTACT_FROM_EMAIL?.trim() || (production ? '' : TEST_SENDER);
  const to = (env.CONTACT_TO_EMAIL ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
  if (!from || to.length === 0) {
    throw new Error('Contact email is not configured');
  }
  const { subject, html, text } = renderContactEmail(v);
  const result = await (client ?? defaultClient(env)).emails.send({
    from,
    to,
    subject,
    html,
    text,
    replyTo: v.email,
  });
  if (result?.error) {
    const { name, statusCode } = result.error as {
      name?: unknown;
      statusCode?: unknown;
    };
    throw new ContactSendError(
      typeof name === 'string' ? name : 'unknown',
      typeof statusCode === 'number' ? statusCode : undefined,
    );
  }
}
