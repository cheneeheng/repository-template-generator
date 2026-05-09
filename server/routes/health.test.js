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
});
