import { validateContact, type ContactErrors } from '../lib/contact/validate';

const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SUCCESS = "Thank you! We'll get back to you soon.";
const SENDING = 'Sending…';
const TOKEN_WAIT_MS = 8000;
const REQUEST_TIMEOUT_MS = 20000;
const FIELDS = ['name', 'email', 'heardFrom', 'message'] as const;

type Turnstile = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      appearance: 'interaction-only';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

function init(section: HTMLElement) {
  const form = section.querySelector<HTMLFormElement>('[data-contact-form]');
  const status = section.querySelector<HTMLElement>('[data-status]');
  const button = form?.querySelector<HTMLButtonElement>('button[type=submit]');
  if (!form || !status || !button) return;

  const mount = section.querySelector<HTMLElement>('[data-turnstile-mount]');
  const siteKey = section.dataset.sitekey;
  const sendLabel = button.textContent ?? 'Send';

  let busy = false;
  let token = '';
  let widgetId: string | undefined;
  let loading: Promise<void> | null = null;
  let onToken: ((value: string) => void) | null = null;

  form.noValidate = true;
  document.documentElement.classList.add('form-ready');

  const control = (name: string) =>
    form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  const errorEl = (name: string) =>
    form.querySelector<HTMLElement>(`#questions-${name}-error`);

  function setStatus(text: string, state?: 'error' | 'success') {
    status!.textContent = text;
    if (state) status!.dataset.state = state;
    else delete status!.dataset.state;
  }

  function setFailure() {
    const copy = section.querySelector('[data-failure-copy]');
    const fallback = section.querySelector('[data-fallback]');
    status!.replaceChildren(
      ...[copy, fallback].flatMap((node) =>
        node ? [node.cloneNode(true)] : [],
      ),
    );
    status!.dataset.state = 'error';
  }

  function clearErrors() {
    for (const name of FIELDS) {
      const el = errorEl(name);
      if (el) {
        el.textContent = '';
        el.hidden = true;
      }
      control(name)?.removeAttribute('aria-invalid');
    }
  }

  function showErrors(errors: ContactErrors): boolean {
    let first: HTMLElement | null = null;
    for (const name of FIELDS) {
      const message = errors[name];
      if (!message) continue;
      const el = errorEl(name);
      if (el) {
        el.textContent = message;
        el.hidden = false;
      }
      const field = control(name);
      field.setAttribute('aria-invalid', 'true');
      first ??= field;
    }
    first?.focus();
    return first !== null;
  }

  function setBusy(value: boolean) {
    busy = value;
    button!.setAttribute('aria-disabled', String(value));
    form!.setAttribute('aria-busy', String(value));
    button!.textContent = value ? SENDING : sendLabel;
  }

  function renderWidget() {
    if (!siteKey || !mount || !window.turnstile || widgetId !== undefined) {
      return;
    }
    widgetId = window.turnstile.render(mount, {
      sitekey: siteKey,
      appearance: 'interaction-only',
      callback: (value) => {
        token = value;
        onToken?.(value);
      },
      'expired-callback': () => {
        token = '';
      },
      'error-callback': () => {
        token = '';
      },
    });
  }

  function ensureTurnstile(): Promise<void> {
    if (!siteKey || !mount) return Promise.resolve();
    loading ??= new Promise<void>((resolve) => {
      const script = document.createElement('script');
      script.src = TURNSTILE_SRC;
      script.async = true;
      script.onload = () => {
        renderWidget();
        resolve();
      };
      script.onerror = () => {
        script.remove();
        loading = null;
        resolve();
      };
      document.head.append(script);
    });
    return loading;
  }

  function waitForToken(): Promise<string> {
    if (!siteKey || token) return Promise.resolve(token);
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        onToken = null;
        resolve('');
      }, TOKEN_WAIT_MS);
      onToken = (value) => {
        window.clearTimeout(timer);
        onToken = null;
        resolve(value);
      };
    });
  }

  function resetTurnstile() {
    token = '';
    if (widgetId !== undefined) window.turnstile?.reset(widgetId);
  }

  const lazyLoad = () => void ensureTurnstile();
  form.addEventListener('focusin', lazyLoad, { once: true });
  form.addEventListener('pointerdown', lazyLoad, { once: true });

  form.addEventListener('input', (event) => {
    const target = event.target as HTMLElement;
    const name = (target as HTMLInputElement).name;
    if (!target.hasAttribute('aria-invalid')) return;
    target.removeAttribute('aria-invalid');
    const el = errorEl(name);
    if (el) {
      el.textContent = '';
      el.hidden = true;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    clearErrors();
    setStatus('');

    const fields = {
      name: control('name').value,
      email: control('email').value,
      heardFrom: control('heardFrom').value,
      message: control('message').value,
      contact_extra_note: control('contact_extra_note').value,
    };
    const checked = validateContact({ ...fields, turnstileToken: '' });
    if (!checked.ok) {
      showErrors(checked.errors);
      return;
    }

    setBusy(true);
    setStatus(SENDING);
    try {
      await ensureTurnstile();
      const turnstileToken = await waitForToken();
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ ...fields, turnstileToken }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        errors?: ContactErrors;
      } | null;
      if (response.ok && payload?.ok) {
        form.reset();
        setStatus(SUCCESS, 'success');
      } else if (response.status === 400 && payload?.errors) {
        setStatus('');
        showErrors(payload.errors);
      } else {
        setFailure();
      }
    } catch {
      setFailure();
    } finally {
      setBusy(false);
      resetTurnstile();
    }
  });

  const outcome = window.location.hash;
  if (outcome === '#questions-sent' || outcome === '#questions-error') {
    if (outcome === '#questions-sent') setStatus(SUCCESS, 'success');
    else setFailure();
    history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}#questions`,
    );
    status.scrollIntoView({ block: 'center' });
  }
}

const section = document.getElementById('questions');
if (section) init(section);
