import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../app.js';

let _llmEnabled = false;
vi.mock('../services/llm.js', () => ({
  get LLM_ENABLED() { return _llmEnabled; },
  customiseStreaming: vi.fn(),
  refineStreaming: vi.fn(),
}));

const app = createApp();
const request = supertest(app);

describe('GET /api/config', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns llmEnabled: true when LLM is enabled', async () => {
    _llmEnabled = true;
    const res = await request.get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.llmEnabled).toBe(true);
  });

  it('returns llmEnabled: false when LLM is disabled', async () => {
    _llmEnabled = false;
    const res = await request.get('/api/config');
    expect(res.body.llmEnabled).toBe(false);
  });
});
