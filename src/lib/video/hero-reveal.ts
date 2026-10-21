export const SEEK_GRACE_MS = 1200;
const SEEK_TOLERANCE = 0.25;

export function readyToReveal(state: {
  start: number;
  currentTime: number;
  waitedMs: number;
  playing: boolean;
}): boolean {
  if (!state.playing) return false;
  if (state.start <= 0) return true;
  return (
    state.currentTime >= state.start - SEEK_TOLERANCE ||
    state.waitedMs >= SEEK_GRACE_MS
  );
}
