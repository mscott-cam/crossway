export const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type Options = {
  secret: string;
  remoteip?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export async function verifyTurnstile(
  token: string,
  { secret, remoteip, fetch: fetchFn = fetch, timeoutMs = 10_000 }: Options,
): Promise<boolean> {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set('remoteip', remoteip);
  try {
    const response = await fetchFn(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: unknown };
    return result.success === true;
  } catch {
    return false;
  }
}
