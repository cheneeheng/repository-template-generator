import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import createError from 'http-errors';
import { createApp } from '../app.js';

vi.mock('../services/assembler.js');
vi.mock('../services/llm.js', () => ({
  LLM_ENABLED: false,
  customiseStreaming: vi.fn(),
  refineStreaming: vi.fn(),
}));

const app = createApp();
const request = supertest(app);

describe('POST /api/generate', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 400 for missing templateId', async () => {
    const res = await request
      .post('/api/generate')
      .send({ projectName: 'my-app', description: 'desc' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for projectName with uppercase', async () => {
    const { load } = await import('../services/assembler.js');
    load.mockResolvedValue([]);
    const res = await request
      .post('/api/generate')
      .send({ templateId: 't1', projectName: 'MyApp', description: 'desc' });
    expect(res.status).toBe(400);
  });

  it('streams file_done and done events in bypass mode', async () => {
    const { load } = await import('../services/assembler.js');
    const { customiseStreaming } = await import('../services/llm.js');
    const file = { path: 'a.js', content: 'const a=1' };
    load.mockResolvedValue([file]);
    customiseStreaming.mockImplementation(async (files, _name, _desc, res) => {
      for (const f of files) {
        res.write('data: ' + JSON.stringify({ type: 'file_done', path: f.path, content: f.content }) + '\n\n');
      }
      return files;
    });

    const res = await request
      .post('/api/generate')
      .send({ templateId: 't1', projectName: 'my-app', description: 'desc' })
      .buffer(true);

    expect(res.headers['content-type']).toMatch('text/event-stream');
    expect(res.text).toContain('"type":"file_done"');
    expect(res.text).toContain('"type":"done"');
  });

  it('propagates 422 from assembler size guard', async () => {
    const { load } = await import('../services/assembler.js');
    load.mockRejectedValue(createError(422, 'Template exceeds size limit'));

    const res = await request
      .post('/api/generate')
      .send({ templateId: 'big', projectName: 'my-app', description: 'd' });
    expect(res.status).toBe(422);
  });

  it('writes error event with "Invalid or missing API key" on 401 from LLM', async () => {
    const { load } = await import('../services/assembler.js');
    const { customiseStreaming } = await import('../services/llm.js');
    load.mockResolvedValue([]);
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    customiseStreaming.mockRejectedValue(err);

    const res = await request
      .post('/api/generate')
      .send({ templateId: 't1', projectName: 'my-app', description: 'd' })
      .buffer(true);

    expect(res.text).toContain('"type":"error"');
    expect(res.text).toContain('Invalid or missing API key');
  });

  it('writes error event with message on generic LLM error', async () => {
    const { load } = await import('../services/assembler.js');
    const { customiseStreaming } = await import('../services/llm.js');
    load.mockResolvedValue([]);
    customiseStreaming.mockRejectedValue(new Error('LLM unavailable'));

    const res = await request
      .post('/api/generate')
      .send({ templateId: 't1', projectName: 'my-app', description: 'd' })
      .buffer(true);

    expect(res.text).toContain('"type":"error"');
    expect(res.text).toContain('LLM unavailable');
  });

  it('falls back to "LLM error" when error has no message', async () => {
    const { load } = await import('../services/assembler.js');
    const { customiseStreaming } = await import('../services/llm.js');
    load.mockResolvedValue([]);
    // plain object with no message property → err.message is undefined → ?? 'LLM error'
    customiseStreaming.mockRejectedValue({ status: 500 });

    const res = await request
      .post('/api/generate')
      .send({ templateId: 't1', projectName: 'my-app', description: 'd' })
      .buffer(true);

    expect(res.text).toContain('"type":"error"');
    expect(res.text).toContain('LLM error');
  });
});
