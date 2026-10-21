import type { APIRoute } from 'astro';
import { handleContact } from '../../lib/contact/handle';
import { sendContactEmail } from '../../lib/contact/email';
import { verifyTurnstile } from '../../lib/contact/turnstile';

export const prerender = false;

export const POST: APIRoute = ({ request, clientAddress }) => {
  const env = process.env;
  let ip: string | undefined;
  try {
    ip = clientAddress;
  } catch {
    ip = undefined;
  }
  return handleContact(
    request,
    {
      env,
      send: (value) => sendContactEmail(value, { env }),
      verifyTurnstile: (token, remoteip) =>
        verifyTurnstile(token, {
          secret: env.TURNSTILE_SECRET_KEY ?? '',
          remoteip,
        }),
    },
    ip,
  );
};

export const ALL: APIRoute = ({ request }) =>
  handleContact(request, {
    env: {},
    send: async () => {},
    verifyTurnstile: async () => false,
  });
