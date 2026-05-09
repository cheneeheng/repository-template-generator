import { describe, it, expect } from 'vitest';
import { truncateHistory } from './truncateHistory.js';

const u = (content) => ({ role: 'user', content });
const a = (content) => ({ role: 'assistant', content });

describe('truncateHistory', () => {
  it('returns history unchanged when under budget', () => {
    const h = [u('hello'), a('world')];
    expect(truncateHistory(h, 1000)).toEqual(h);
  });

  it('drops oldest assistant turn first', () => {
    const h = [u('q1'), a('x'.repeat(60)), u('q2'), a('y'.repeat(50))];
    // total = 2 + 60 + 2 + 50 = 114; budget = 80
    const result = truncateHistory(h, 80);
    expect(result.find(m => m.content === 'x'.repeat(60))).toBeUndefined();
    expect(result.find(m => m.content === 'q1')).toBeDefined();
  });

  it('does not mutate input', () => {
    const h = [u('q'), a('x'.repeat(200))];
    const original = JSON.stringify(h);
    truncateHistory(h, 50);
    expect(JSON.stringify(h)).toBe(original);
  });

  it('returns empty array when all history exceeds budget', () => {
    const h = [u('x'.repeat(200))];
    expect(truncateHistory(h, 50)).toEqual([]);
  });

  it('drops user turns if still over budget after assistant removal', () => {
    const h = [u('q'.repeat(60)), u('p'.repeat(60))];
    const result = truncateHistory(h, 80);
    expect(result.length).toBeLessThan(h.length);
  });
});
