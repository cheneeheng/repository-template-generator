import { describe, it, expect, vi } from 'vitest';
import supertest from 'supertest';

describe('GET /api/config', () => {
  it('returns llmEnabled: true when ANTHROPIC_API_KEY is set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.llmEnabled).toBe(true);
  });

  it('returns llmEnabled: false when ANTHROPIC_API_KEY is absent', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/config');
    expect(res.body.llmEnabled).toBe(false);
  });
});
