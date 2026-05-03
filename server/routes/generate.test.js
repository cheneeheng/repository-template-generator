import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import createError from 'http-errors';

vi.mock('../services/assembler.js');

describe('POST /api/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 400 for missing templateId', async () => {
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp())
      .post('/api/generate')
      .send({ projectName: 'my-app', description: 'desc' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for projectName with uppercase', async () => {
    const { load } = await import('../services/assembler.js');
    load.mockResolvedValue([]);
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp())
      .post('/api/generate')
      .send({ templateId: 't1', projectName: 'MyApp', description: 'desc' });
    expect(res.status).toBe(400);
  });

  it('streams file_done and done events in bypass mode', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const { load } = await import('../services/assembler.js');
    load.mockResolvedValue([{ path: 'a.js', content: 'const a=1' }]);
    const { createApp } = await import('../app.js');

    const res = await supertest(createApp())
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
    const { createApp } = await import('../app.js');

    const res = await supertest(createApp())
      .post('/api/generate')
      .send({ templateId: 'big', projectName: 'my-app', description: 'd' });
    expect(res.status).toBe(422);
  });
});
