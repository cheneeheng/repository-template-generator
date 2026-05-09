import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { relativeTime } from './relativeTime.js';

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for sub-minute timestamps', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:30Z'));
    const ts = new Date('2026-01-01T00:00:00Z').getTime();
    expect(relativeTime(ts)).toBe('just now');
  });

  it('returns "just now" for 0ms ago', () => {
    const ts = Date.now();
    expect(relativeTime(ts)).toBe('just now');
  });

  it('returns "5 min ago" for 5 minutes', () => {
    vi.setSystemTime(new Date('2026-01-01T00:05:00Z'));
    const ts = new Date('2026-01-01T00:00:00Z').getTime();
    expect(relativeTime(ts)).toBe('5 min ago');
  });

  it('returns "2 hr ago" for 2 hours', () => {
    vi.setSystemTime(new Date('2026-01-01T02:00:00Z'));
    const ts = new Date('2026-01-01T00:00:00Z').getTime();
    expect(relativeTime(ts)).toBe('2 hr ago');
  });
});
