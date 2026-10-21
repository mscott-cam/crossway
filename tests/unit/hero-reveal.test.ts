import { describe, expect, it } from 'vitest';
import { SEEK_GRACE_MS, readyToReveal } from '../../src/lib/video/hero-reveal';

describe('readyToReveal', () => {
  it('never reveals while the video is not playing', () => {
    expect(
      readyToReveal({
        start: 3,
        currentTime: 3,
        waitedMs: 5000,
        playing: false,
      }),
    ).toBe(false);
  });

  it('reveals straight away when there is no start offset', () => {
    expect(
      readyToReveal({ start: 0, currentTime: 0, waitedMs: 0, playing: true }),
    ).toBe(true);
  });

  it('waits for the seek to reach the poster frame', () => {
    expect(
      readyToReveal({
        start: 3,
        currentTime: 0.1,
        waitedMs: 200,
        playing: true,
      }),
    ).toBe(false);
    expect(
      readyToReveal({
        start: 3,
        currentTime: 2.9,
        waitedMs: 200,
        playing: true,
      }),
    ).toBe(true);
  });

  it('gives up waiting after the grace period and reveals anyway', () => {
    expect(SEEK_GRACE_MS).toBeLessThanOrEqual(1200);
    expect(
      readyToReveal({
        start: 3,
        currentTime: 0.2,
        waitedMs: SEEK_GRACE_MS,
        playing: true,
      }),
    ).toBe(true);
  });
});
