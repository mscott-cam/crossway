import { describe, expect, it } from 'vitest';
import {
  formatTime,
  nextSpeed,
  resumePosition,
} from '../../src/lib/audio/player-utils';

describe('formatTime', () => {
  it('formats m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5.9)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3599)).toBe('59:59');
  });

  it('formats h:mm:ss from one hour', () => {
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3725)).toBe('1:02:05');
  });

  it('handles non-finite and negative values', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatTime(-4)).toBe('0:00');
  });
});

describe('nextSpeed', () => {
  it('cycles 1, 1.25, 1.5, 2 and back to 1', () => {
    expect(nextSpeed(1)).toBe(1.25);
    expect(nextSpeed(1.25)).toBe(1.5);
    expect(nextSpeed(1.5)).toBe(2);
    expect(nextSpeed(2)).toBe(1);
  });

  it('falls back to 1 for unknown values', () => {
    expect(nextSpeed(0.75)).toBe(1);
  });
});

describe('resumePosition', () => {
  it('returns the saved position when it is within bounds', () => {
    expect(resumePosition('120', 600)).toBe(120);
  });

  it('ignores positions of 5 seconds or less', () => {
    expect(resumePosition('5', 600)).toBe(0);
    expect(resumePosition('2', 600)).toBe(0);
  });

  it('ignores positions within 10 seconds of the end', () => {
    expect(resumePosition('590', 600)).toBe(0);
    expect(resumePosition('595', 600)).toBe(0);
    expect(resumePosition('589', 600)).toBe(589);
  });

  it('ignores missing and junk values', () => {
    expect(resumePosition(null, 600)).toBe(0);
    expect(resumePosition('abc', 600)).toBe(0);
    expect(resumePosition('-30', 600)).toBe(0);
  });

  it('applies only the lower bound while duration is unknown', () => {
    expect(resumePosition('120', NaN)).toBe(120);
    expect(resumePosition('3', NaN)).toBe(0);
  });
});
