import { describe, expect, it } from 'vitest';
import {
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
  hasPlayed: false,
  interacted: false,
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

describe('showsControl', () => {
  it('is absent until playback has actually started', () => {
    expect(showsControl(base)).toBe(false);
  });

  it('appears once the video has played', () => {
    expect(showsControl({ ...base, hasPlayed: true })).toBe(true);
  });

  it('stays while the tab is hidden or the visitor has paused after playing', () => {
    expect(showsControl({ ...base, hasPlayed: true, visible: false })).toBe(
      true,
    );
    expect(showsControl({ ...base, hasPlayed: true, userPaused: true })).toBe(
      true,
    );
  });

  it('is offered when the visitor paused earlier this session, so they can resume', () => {
    expect(showsControl({ ...base, userPaused: true })).toBe(true);
  });

  it('stays once the visitor has used it, even if nothing has played yet', () => {
    expect(showsControl({ ...base, interacted: true })).toBe(true);
    expect(showsControl({ ...base, interacted: true, userPaused: false })).toBe(
      true,
    );
  });

  it('is never offered under reduced motion or save-data', () => {
    expect(showsControl({ ...base, hasPlayed: true, reduceMotion: true })).toBe(
      false,
    );
    expect(showsControl({ ...base, userPaused: true, saveData: true })).toBe(
      false,
    );
    expect(
      showsControl({ ...base, interacted: true, reduceMotion: true }),
    ).toBe(false);
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
