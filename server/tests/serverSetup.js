import { vi } from 'vitest';

// Mock ioredis globally so no test ever opens a real Redis connection.
// Uses a class-based mock so methods survive vi.resetAllMocks() calls in test files.
// Individual tests that need specific Redis behavior mock '../store/shareStore.js' directly.
vi.mock('ioredis', () => {
  class MockRedis {
    set = vi.fn(async () => 'OK');
    get = vi.fn(async () => null);
    on = vi.fn();
    disconnect = vi.fn();
    quit = vi.fn();
  }
  return { default: MockRedis };
});
