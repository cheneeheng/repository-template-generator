import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import * as fsPromises from 'fs/promises';

vi.mock('fs/promises');

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 200 ok when key set and templates exist', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('TEMPLATES_DIR', '/tmp/templates');
    fsPromises.access.mockResolvedValue(undefined);
    // scanTemplates calls readdir with withFileTypes: true → returns Dirent-like objects
    fsPromises.readdir.mockResolvedValue([
      { name: 'react-express', isDirectory: () => true },
    ]);
    // readFile for template.json
    fsPromises.readFile.mockResolvedValueOnce(
      JSON.stringify({ id: 'react-express', label: 'R', description: 'D', tags: ['react'] })
    );
    // getFilePaths walk readdir
    fsPromises.readdir.mockResolvedValueOnce([
      { name: 'README.md', isDirectory: () => false },
    ]);

    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.checks.anthropicKey).toBe('configured');
  });

  it('returns 503 when ANTHROPIC_API_KEY is missing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('TEMPLATES_DIR', '/tmp/templates');
    fsPromises.access.mockResolvedValue(undefined);
    fsPromises.readdir.mockResolvedValue([]);

    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.checks.anthropicKey).toBe('missing');
  });

  it('returns 503 when templates directory is inaccessible', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('TEMPLATES_DIR', '/tmp/missing');
    fsPromises.access.mockRejectedValueOnce(new Error('ENOENT'));
    fsPromises.readdir.mockResolvedValue([]);

    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
  });
});
