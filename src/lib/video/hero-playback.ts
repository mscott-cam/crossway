export const HERO_PAUSED_KEY = 'crossway-hero-video-paused';

export interface PlaybackInput {
  reduceMotion: boolean;
  saveData: boolean;
  visible: boolean;
  userPaused: boolean;
}

export function canPlay(input: PlaybackInput): boolean {
  return !input.reduceMotion && !input.saveData;
}

export function shouldPlay(input: PlaybackInput): boolean {
  return canPlay(input) && input.visible && !input.userPaused;
}

export function showsControl(input: PlaybackInput): boolean {
  return canPlay(input);
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
