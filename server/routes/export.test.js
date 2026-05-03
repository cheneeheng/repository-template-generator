import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';

vi.mock('../services/zipper.js');
vi.mock('../services/github.js');
vi.mock('../services/gitlab.js');

const fileTree = [{ path: 'a.js', content: 'x' }];

describe('POST /api/export/zip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('sets Content-Disposition with project name', async () => {
    const { createZip } = await import('../services/zipper.js');
    createZip.mockResolvedValue(Buffer.from('zip-data'));
    const { createApp } = await import('../app.js');

    const res = await supertest(createApp())
      .post('/api/export/zip')
      .send({ fileTree, projectName: 'my-app' });
    expect(res.headers['content-disposition']).toContain('my-app.zip');
  });

  it('falls back to project.zip when projectName absent', async () => {
    const { createZip } = await import('../services/zipper.js');
    createZip.mockResolvedValue(Buffer.from('zip-data'));
    const { createApp } = await import('../app.js');

    const res = await supertest(createApp())
      .post('/api/export/zip')
      .send({ fileTree });
    expect(res.headers['content-disposition']).toContain('project.zip');
  });
});
