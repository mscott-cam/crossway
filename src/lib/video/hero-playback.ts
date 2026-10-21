export const HERO_PAUSED_KEY = 'crossway-hero-video-paused';

export interface PlaybackInput {
  reduceMotion: boolean;
  saveData: boolean;
  visible: boolean;
  userPaused: boolean;
  hasPlayed: boolean;
  interacted: boolean;
}

export function shouldPlay(input: PlaybackInput): boolean {
  return (
    !input.reduceMotion && !input.saveData && input.visible && !input.userPaused
  );
}

export function showsControl(input: PlaybackInput): boolean {
  if (input.reduceMotion || input.saveData) return false;
  return input.hasPlayed || input.userPaused || input.interacted;
}

export function controlLabel(userPaused: boolean): string {
  return userPaused ? 'Play background video' : 'Pause background video';
}

export function readStoredPause(raw: string | null): boolean {
  return raw === '1';
}

export function serializePause(userPaused: boolean): string | null {
  return userPaused ? '1' : null;
}
