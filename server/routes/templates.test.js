import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import * as fsPromises from 'fs/promises';

vi.mock('fs/promises');

const validManifest = JSON.stringify({
  id: 'react-express', label: 'React+Express', description: 'A starter', tags: ['react'],
});

describe('GET /api/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns template list with files', async () => {
    // Top-level templates dir scan (withFileTypes: true)
    fsPromises.readdir
      .mockResolvedValueOnce([{ name: 'react-express', isDirectory: () => true }])
      // getFilePaths walk
      .mockResolvedValueOnce([{ name: 'README.md', isDirectory: () => false }]);
    fsPromises.readFile.mockResolvedValueOnce(validManifest);

    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/templates');

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
      .mockResolvedValueOnce([]) // bad template dir — no files
      .mockResolvedValueOnce([{ name: 'README.md', isDirectory: () => false }]); // good template dir
    fsPromises.readFile
      .mockResolvedValueOnce('{ "id": "" }')  // invalid — empty id
      .mockResolvedValueOnce(validManifest);   // valid

    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/templates');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('react-express');
  });

  it('returns empty array when templates dir is empty', async () => {
    fsPromises.readdir.mockResolvedValueOnce([]);

    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
