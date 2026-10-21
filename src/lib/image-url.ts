export function sanityImageUrl(url: string, width: number): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'cdn.sanity.io') return url;
    parsed.searchParams.set('w', String(width));
    parsed.searchParams.set('auto', 'format');
    return parsed.href;
  } catch {
    return url;
  }
}
