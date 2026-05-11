import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import * as fsPromises from 'fs/promises';
import { createApp } from '../app.js';

vi.mock('fs/promises');
vi.mock('../services/llm.js', () => ({
  LLM_ENABLED: false,
  customiseStreaming: vi.fn(),
  refineStreaming: vi.fn(),
}));
vi.mock('../logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const app = createApp();
const request = supertest(app);

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 200 ok when key set and templates exist', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('TEMPLATES_DIR', '/tmp/templates');
    fsPromises.access.mockResolvedValue(undefined);
    fsPromises.readdir
      .mockResolvedValueOnce([{ name: 'react-express', isDirectory: () => true }])
      .mockResolvedValueOnce([{ name: 'README.md', isDirectory: () => false }]);
    fsPromises.readFile.mockResolvedValueOnce(
      JSON.stringify({ id: 'react-express', label: 'R', description: 'D', tags: ['react'] })
    );

    const res = await request.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.checks.anthropicKey).toBe('configured');
  });

  it('returns 503 when ANTHROPIC_API_KEY is missing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('TEMPLATES_DIR', '/tmp/templates');
    fsPromises.access.mockResolvedValue(undefined);
    fsPromises.readdir.mockResolvedValue([]);

    const res = await request.get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.checks.anthropicKey).toBe('missing');
  });

  it('returns 503 when templates directory is inaccessible', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('TEMPLATES_DIR', '/tmp/missing');
    fsPromises.access.mockRejectedValueOnce(new Error('ENOENT'));
    fsPromises.readdir.mockResolvedValue([]);

    const res = await request.get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
  });

  it('uses default templates path when TEMPLATES_DIR is not set', async () => {
    delete process.env.TEMPLATES_DIR;
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    fsPromises.access.mockResolvedValueOnce(undefined);
    fsPromises.readdir.mockResolvedValueOnce([]);

    const res = await request.get('/api/health');
    // Either 200 or 503 depending on API key; what matters is no crash
    expect([200, 503]).toContain(res.status);
  });
});

describe('GET /api/health — scanTemplates throws', () => {
  it('sets templateCount to 0 when scanTemplates throws unexpectedly', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('TEMPLATES_DIR', '/tmp/templates');

    // access passes, then readdir throws an unexpected (non-ENOENT) error inside
    // getFilePaths (no try/catch there), propagating through Promise.all
    fsPromises.access.mockResolvedValueOnce(undefined);
    // outer readdir (scanTemplates top-level) returns a dir entry
    fsPromises.readdir.mockResolvedValueOnce([{ name: 'tpl', isDirectory: () => true }]);
    // readFile succeeds with valid manifest
    const manifest = JSON.stringify({ id: 'tpl', label: 'T', description: 'D', tags: [] });
    fsPromises.readFile.mockResolvedValueOnce(manifest);
    // inner readdir (getFilePaths) returns a single non-dir file
    fsPromises.readdir.mockResolvedValueOnce([{ name: 'README.md', isDirectory: () => false }]);

    // The template scan succeeds normally; to hit the catch block we need scanTemplates to
    // throw. Mock the templates module for this test using vi.doMock.
    vi.resetModules();
    vi.doMock('./routes/templates.js', () => ({
      scanTemplates: vi.fn().mockRejectedValue(new Error('unexpected scan error')),
    }));
    const { createApp: createAppFresh } = await import('../app.js');
    const req = supertest(createAppFresh());

    const res = await req.get('/api/health');
    // Health check still responds (not 500); templateCount defaults to 0
    expect(res.body.checks.templateCount).toBe(0);

    vi.doUnmock('./routes/templates.js');
    vi.resetModules();
  });
});
