import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockStore = vi.hoisted(() => new Map());

vi.mock('../lib/redis.js', () => ({
  default: {
    set: vi.fn(async (key, value) => { mockStore.set(key, value); }),
    get: vi.fn(async (key) => mockStore.get(key) ?? null),
  },
}));

import { saveShare, getShare } from '../store/shareStore.js';

beforeEach(() => {
  mockStore.clear();
  vi.clearAllMocks();
});

describe('shareStore', () => {
  it('saves and retrieves a share entry', async () => {
    const payload = { fileTree: [], projectName: 'app', templateId: 't' };
    await saveShare('abc123', payload);
    const result = await getShare('abc123');
    expect(result.status).toBe('ok');
    expect(result.data).toEqual(payload);
  });

  it('returns not_found for unknown id', async () => {
    const result = await getShare('unknown');
    expect(result.status).toBe('not_found');
  });

  it('stores value as JSON string with TTL args', async () => {
    const redis = (await import('../lib/redis.js')).default;
    const payload = { fileTree: [{ path: 'a.js', content: 'x' }], projectName: 'p', templateId: 't' };
    await saveShare('xyz', payload);
    expect(redis.set).toHaveBeenCalledWith(
      'share:xyz',
      JSON.stringify(payload),
      'EX',
      86400
    );
  });
});
