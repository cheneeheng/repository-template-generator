import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../app.js';

let _llmEnabled = false;
vi.mock('../services/llm.js', () => ({
  get LLM_ENABLED() { return _llmEnabled; },
  refineStreaming: vi.fn(),
  customiseStreaming: vi.fn(),
}));

const app = createApp();
const request = supertest(app);

const validBody = {
  fileTree: [{ path: 'a.js', content: 'x' }],
  history: [],
  instruction: 'make it TypeScript',
};

describe('POST /api/refine', () => {
  beforeEach(() => {
    _llmEnabled = false;
    vi.resetAllMocks();
  });

  it('returns 503 in bypass mode (LLM_ENABLED false)', async () => {
    const res = await request.post('/api/refine').send(validBody);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('llm_unavailable');
  });

  it('returns 400 when history exceeds 20 messages', async () => {
    _llmEnabled = true;
    const history = Array.from({ length: 21 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant', content: 'x',
    }));
    const res = await request.post('/api/refine').send({ ...validBody, history });
    expect(res.status).toBe(400);
  });

  it('returns 400 when instruction exceeds 1000 chars', async () => {
    _llmEnabled = true;
    const res = await request.post('/api/refine')
      .send({ ...validBody, instruction: 'x'.repeat(1001) });
    expect(res.status).toBe(400);
  });

  it('streams done event on success', async () => {
    _llmEnabled = true;
    const { refineStreaming } = await import('../services/llm.js');
    refineStreaming.mockResolvedValue([{ path: 'a.js', content: 'updated' }]);

    const res = await request.post('/api/refine').send(validBody).buffer(true);
    expect(res.text).toContain('"type":"done"');
  });

  it('writes context_overflow on 400 prompt-too-long error', async () => {
    _llmEnabled = true;
    const { refineStreaming } = await import('../services/llm.js');
    const err = Object.assign(new Error('prompt is too long'), { status: 400 });
    refineStreaming.mockRejectedValue(err);

    const res = await request.post('/api/refine').send(validBody).buffer(true);
    expect(res.text).toContain('"type":"error"');
    expect(res.text).toContain('context_overflow');
  });

  it('writes error message on generic refine error', async () => {
    _llmEnabled = true;
    const { refineStreaming } = await import('../services/llm.js');
    refineStreaming.mockRejectedValue(new Error('model overloaded'));

    const res = await request.post('/api/refine').send(validBody).buffer(true);
    expect(res.text).toContain('"type":"error"');
    expect(res.text).toContain('model overloaded');
  });

  it('falls back to "Refinement failed" when error has no message', async () => {
    _llmEnabled = true;
    const { refineStreaming } = await import('../services/llm.js');
    refineStreaming.mockRejectedValue({ status: 500 });

    const res = await request.post('/api/refine').send(validBody).buffer(true);
    expect(res.text).toContain('"type":"error"');
    expect(res.text).toContain('Refinement failed');
  });
});
