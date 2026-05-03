import { describe, it, expect } from 'vitest';
import { truncateHistory } from './historyTruncator.js';

const u = (content) => ({ role: 'user', content });
const a = (content) => ({ role: 'assistant', content });

describe('truncateHistory', () => {
  it('returns history unchanged when under budget', () => {
    const h = [u('hi'), a('ok')];
    expect(truncateHistory(h, 1000)).toEqual(h);
  });

  it('drops oldest assistant turns first', () => {
    const h3 = [u('q1'), a('x'.repeat(80)), u('q2'), a('y'.repeat(30))];
    // total = 2 + 80 + 2 + 30 = 114 > 100
    const result = truncateHistory(h3, 100);
    expect(result.find(m => m.content === 'x'.repeat(80))).toBeUndefined();
    expect(result.find(m => m.role === 'user' && m.content === 'q1')).toBeDefined();
  });

  it('drops user turns if still over budget after assistant drops', () => {
    const h = [u('q'.repeat(60)), u('p'.repeat(60))];
    const result = truncateHistory(h, 80);
    expect(result.length).toBeLessThan(h.length);
  });

  it('returns empty array if entire history exceeds budget', () => {
    const h = [u('x'.repeat(200))];
    const result = truncateHistory(h, 50);
    expect(result).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const h = [u('q1'), a('x'.repeat(80)), u('q2')];
    const copy = JSON.stringify(h);
    truncateHistory(h, 50);
    expect(JSON.stringify(h)).toBe(copy);
  });

  it('returns history unchanged when exactly at budget', () => {
    const h = [u('abc')]; // 3 chars
    expect(truncateHistory(h, 3)).toEqual(h);
  });
});
