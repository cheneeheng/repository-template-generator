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
});
