import { describe, expect, it } from 'vitest';
import {
  canPlay,
  controlLabel,
  readStoredPause,
  serializePause,
  shouldPlay,
  showsControl,
  type PlaybackInput,
} from '../../src/lib/video/hero-playback';

const base: PlaybackInput = {
  reduceMotion: false,
  saveData: false,
  visible: true,
  userPaused: false,
};

describe('shouldPlay', () => {
  it('plays when nothing prevents it', () => {
    expect(shouldPlay(base)).toBe(true);
  });

  it('never plays under reduced motion or save-data', () => {
    expect(shouldPlay({ ...base, reduceMotion: true })).toBe(false);
    expect(shouldPlay({ ...base, saveData: true })).toBe(false);
  });

  it('does not play while the tab is hidden', () => {
    expect(shouldPlay({ ...base, visible: false })).toBe(false);
  });

  it('stays paused after the visitor pauses, even when the tab becomes visible again', () => {
    expect(shouldPlay({ ...base, userPaused: true, visible: true })).toBe(
      false,
    );
    expect(shouldPlay({ ...base, userPaused: true, visible: false })).toBe(
      false,
    );
  });

  it('resumes when the visitor un-pauses a visible tab', () => {
    expect(shouldPlay({ ...base, userPaused: false })).toBe(true);
  });
});

describe('control visibility', () => {
  it('is offered whenever the video could play, including while paused or hidden', () => {
    expect(canPlay(base)).toBe(true);
    expect(showsControl({ ...base, userPaused: true })).toBe(true);
    expect(showsControl({ ...base, visible: false })).toBe(true);
  });

  it('is absent when the poster is all that is ever shown', () => {
    expect(showsControl({ ...base, reduceMotion: true })).toBe(false);
    expect(showsControl({ ...base, saveData: true })).toBe(false);
  });
});

describe('controlLabel', () => {
  it('names the action the button will take', () => {
    expect(controlLabel(false)).toBe('Pause background video');
    expect(controlLabel(true)).toBe('Play background video');
  });
});

describe('stored pause', () => {
  it('round-trips and treats anything else as not paused', () => {
    expect(readStoredPause(serializePause(true))).toBe(true);
    expect(readStoredPause(serializePause(false))).toBe(false);
    expect(readStoredPause(null)).toBe(false);
    expect(readStoredPause('true')).toBe(false);
  });
});
