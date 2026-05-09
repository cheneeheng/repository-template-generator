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

const validManifest = JSON.stringify({
  id: 'react-express', label: 'React+Express', description: 'A starter', tags: ['react'],
});

const app = createApp();
const request = supertest(app);

describe('GET /api/templates', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns template list with files', async () => {
    fsPromises.readdir
      .mockResolvedValueOnce([{ name: 'react-express', isDirectory: () => true }])
      .mockResolvedValueOnce([{ name: 'README.md', isDirectory: () => false }]);
    fsPromises.readFile.mockResolvedValueOnce(validManifest);

    const res = await request.get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].files).toContain('README.md');
  });

  it('skips templates with invalid manifests', async () => {
    fsPromises.readdir
      .mockResolvedValueOnce([
        { name: 'bad-template', isDirectory: () => true },
        { name: 'good-template', isDirectory: () => true },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ name: 'README.md', isDirectory: () => false }]);
    fsPromises.readFile
      .mockResolvedValueOnce('{ "id": "" }')
      .mockResolvedValueOnce(validManifest);

    const res = await request.get('/api/templates');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('react-express');
  });

  it('returns empty array when templates dir is empty', async () => {
    fsPromises.readdir.mockResolvedValueOnce([]);

    const res = await request.get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns empty array when TEMPLATES_DIR readdir throws', async () => {
    fsPromises.readdir.mockRejectedValueOnce(new Error('EPERM: permission denied'));

    const res = await request.get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('skips templates where readFile throws', async () => {
    fsPromises.readdir
      .mockResolvedValueOnce([{ name: 'broken', isDirectory: () => true }]);
    fsPromises.readFile.mockRejectedValueOnce(new Error('disk error'));

    const res = await request.get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('skips template.json when encountered in directory walk', async () => {
    fsPromises.readdir
      .mockResolvedValueOnce([{ name: 'react-express', isDirectory: () => true }])
      .mockResolvedValueOnce([
        { name: 'template.json', isDirectory: () => false },
        { name: 'README.md', isDirectory: () => false },
      ]);
    fsPromises.readFile.mockResolvedValueOnce(validManifest);

    const res = await request.get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body[0].files).toContain('README.md');
    expect(res.body[0].files).not.toContain('template.json');
  });

  it('includes nested files from subdirectories', async () => {
    fsPromises.readdir
      .mockResolvedValueOnce([{ name: 'react-express', isDirectory: () => true }])
      .mockResolvedValueOnce([
        { name: 'src', isDirectory: () => true },
        { name: 'README.md', isDirectory: () => false },
      ])
      .mockResolvedValueOnce([
        { name: 'App.jsx', isDirectory: () => false },
      ]);
    fsPromises.readFile.mockResolvedValueOnce(validManifest);

    const res = await request.get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body[0].files).toContain('src/App.jsx');
    expect(res.body[0].files).toContain('README.md');
  });
});
