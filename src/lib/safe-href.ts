const ALLOWED_SCHEME = /^(?:https?|mailto):/i;

export function safeHref(value: string | undefined | null): string | undefined {
  const href = (value ?? '').trim();
  if (!href) return undefined;
  if (/[\u0000-\u001f]/.test(href)) return undefined;
  if (href.startsWith('/')) {
    return href.startsWith('//') || href.startsWith('/\\') ? undefined : href;
  }
  return ALLOWED_SCHEME.test(href) ? href : undefined;
}
