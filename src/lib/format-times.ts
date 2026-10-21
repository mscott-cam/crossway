export type TimePart = {
  kind: 'time' | 'separator' | 'meridiem';
  text: string;
};

const HAS_MERIDIEM = /\d\s*[ap]\.?m?\.?$/i;

export function serviceTimeParts(times: string[]): TimePart[] {
  const cleaned = times.map((time) => time.trim()).filter(Boolean);
  const parts: TimePart[] = [];
  cleaned.forEach((time, index) => {
    if (index > 0) {
      const last = index === cleaned.length - 1;
      parts.push({ kind: 'separator', text: last ? ' & ' : ', ' });
    }
    parts.push({ kind: 'time', text: time });
  });
  if (cleaned.length > 0 && !cleaned.some((time) => HAS_MERIDIEM.test(time))) {
    parts.push({ kind: 'meridiem', text: ' AM' });
  }
  return parts;
}

export function formatServiceTimes(times: string[]): string {
  return serviceTimeParts(times)
    .map((part) => part.text)
    .join('');
}

export function formatFooterTimes(times: string[]): string {
  return serviceTimeParts(times)
    .map((part) => (part.kind === 'meridiem' ? 'a' : part.text))
    .join('');
}
