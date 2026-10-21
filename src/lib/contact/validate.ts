export type ContactInput = {
  name: string;
  email: string;
  heardFrom?: string;
  message: string;
  // Honeypot: named to dodge browser autofill heuristics, which a name like "company" invites.
  contact_extra_note?: string;
  turnstileToken: string;
};

export type ContactErrors = Partial<Record<keyof ContactInput, string>>;

export type ContactResult =
  { ok: true; value: ContactInput } | { ok: false; errors: ContactErrors };

export const LIMITS = {
  name: 100,
  email: 254,
  heardFrom: 200,
  message: 5000,
  token: 2048,
} as const;

const EMAIL =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function isValidEmail(value: string): boolean {
  return value.length <= LIMITS.email && EMAIL.test(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateContact(input: unknown): ContactResult {
  const raw =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>)
      : {};
  const name = text(raw.name);
  const email = text(raw.email);
  const heardFrom = text(raw.heardFrom);
  const message = text(raw.message);
  const contactExtraNote =
    typeof raw.contact_extra_note === 'string'
      ? raw.contact_extra_note.trim()
      : '';
  const token =
    typeof raw.turnstileToken === 'string' ? raw.turnstileToken : '';
  const errors: ContactErrors = {};

  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > LIMITS.name)
    errors.name = 'Please keep your name under 100 characters.';

  if (!isValidEmail(email))
    errors.email = 'Please enter a valid email address.';

  if (heardFrom.length > LIMITS.heardFrom)
    errors.heardFrom = 'Please keep this under 200 characters.';

  if (!message) errors.message = 'Please write a message.';
  else if (message.length > LIMITS.message)
    errors.message = 'Please keep your message under 5,000 characters.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      email,
      ...(heardFrom ? { heardFrom } : {}),
      message,
      ...(contactExtraNote ? { contact_extra_note: contactExtraNote } : {}),
      turnstileToken: token.slice(0, LIMITS.token),
    },
  };
}
