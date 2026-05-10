import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../app.js';

vi.mock('../services/zipper.js');
vi.mock('../services/github.js');
vi.mock('../services/gitlab.js');
vi.mock('../services/llm.js', () => ({
  LLM_ENABLED: false,
  customiseStreaming: vi.fn(),
  refineStreaming: vi.fn(),
}));

const fileTree = [{ path: 'a.js', content: 'x' }];

const app = createApp();
const request = supertest(app);

describe('POST /api/export/zip', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sets Content-Disposition with project name', async () => {
    const { createZip } = await import('../services/zipper.js');
    createZip.mockResolvedValue(Buffer.from('zip-data'));

    const res = await request
      .post('/api/export/zip')
      .send({ fileTree, projectName: 'my-app' });
    expect(res.headers['content-disposition']).toContain('my-app.zip');
  });

  it('falls back to project.zip when projectName absent', async () => {
    const { createZip } = await import('../services/zipper.js');
    createZip.mockResolvedValue(Buffer.from('zip-data'));

    const res = await request
      .post('/api/export/zip')
      .send({ fileTree });
    expect(res.headers['content-disposition']).toContain('project.zip');
  });

  it('normalizes projectName with uppercase and spaces', async () => {
    const { createZip } = await import('../services/zipper.js');
    createZip.mockResolvedValue(Buffer.from('zip-data'));

    const res = await request
      .post('/api/export/zip')
      .send({ fileTree, projectName: 'My App Project' });
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('my-app-project.zip');
  });
});

describe('POST /api/export/repo', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns repoUrl on success (github)', async () => {
    const { createRepo } = await import('../services/github.js');
    createRepo.mockResolvedValue({ repoUrl: 'https://github.com/user/repo' });

    const res = await request
      .post('/api/export/repo')
      .send({
        fileTree,
        provider: 'github',
        token: 'gho_test',
        owner: 'user',
        repoName: 'my-repo',
        description: 'test',
        isPrivate: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.repoUrl).toBe('https://github.com/user/repo');
  });

  it('returns repoUrl on success (gitlab)', async () => {
    const { createRepo } = await import('../services/gitlab.js');
    createRepo.mockResolvedValue({ repoUrl: 'https://gitlab.com/user/repo' });

    const res = await request
      .post('/api/export/repo')
      .send({
        fileTree,
        provider: 'gitlab',
        token: 'glpat_test',
        owner: 'user',
        repoName: 'my-repo',
        description: 'test',
        isPrivate: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.repoUrl).toBe('https://gitlab.com/user/repo');
  });

  it('returns 400 for invalid provider', async () => {
    const res = await request
      .post('/api/export/repo')
      .send({ fileTree, provider: 'bitbucket', token: 'tok', owner: 'u', repoName: 'r' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/export/zip — error path', () => {
  beforeEach(() => vi.resetAllMocks());

  it('passes error to next when createZip throws', async () => {
    const { createZip } = await import('../services/zipper.js');
    createZip.mockRejectedValue(new Error('disk full'));

    const res = await request
      .post('/api/export/zip')
      .send({ fileTree });
    expect(res.status).toBe(500);
  });
});
