import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';

vi.mock('../services/llm.js', () => ({
  LLM_ENABLED: false,
  refineStreaming: vi.fn(),
  customiseStreaming: vi.fn(),
}));

const validBody = {
  fileTree: [{ path: 'a.js', content: 'x' }],
  history: [],
  instruction: 'make it TypeScript',
};

describe('POST /api/refine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 503 in bypass mode (LLM_ENABLED false)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).post('/api/refine').send(validBody);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('llm_unavailable');
  });

  it('returns 400 when history exceeds 20 messages', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { createApp } = await import('../app.js');
    const history = Array.from({ length: 21 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant', content: 'x',
    }));
    const res = await supertest(createApp()).post('/api/refine')
      .send({ ...validBody, history });
    expect(res.status).toBe(400);
  });

  it('returns 400 when instruction exceeds 1000 chars', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).post('/api/refine')
      .send({ ...validBody, instruction: 'x'.repeat(1001) });
    expect(res.status).toBe(400);
  });

  it('streams done event on success', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const llmMod = await import('../services/llm.js');
    llmMod.LLM_ENABLED = true;
    llmMod.refineStreaming.mockResolvedValue([{ path: 'a.js', content: 'updated' }]);
    const { createApp } = await import('../app.js');

    const res = await supertest(createApp()).post('/api/refine').send(validBody).buffer(true);
    expect(res.text).toContain('"type":"done"');
  });
});
