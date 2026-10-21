export const SPEEDS = [1, 1.25, 1.5, 2] as const;

export function formatTime(seconds: number): string {
  const total =
    Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function nextSpeed(current: number): number {
  const index = SPEEDS.findIndex((speed) => speed === current);
  return index === -1 ? SPEEDS[0] : SPEEDS[(index + 1) % SPEEDS.length];
}

export function resumePosition(
  stored: string | null,
  duration: number,
): number {
  if (stored === null) return 0;
  const position = Number(stored);
  if (!Number.isFinite(position) || position <= 5) return 0;
  if (Number.isFinite(duration) && position >= duration - 10) return 0;
  return position;
}
