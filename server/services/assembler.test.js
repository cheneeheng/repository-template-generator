import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fsPromises from 'fs/promises';

vi.mock('fs/promises');

describe('assembler.load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns files for a valid template', async () => {
    fsPromises.readdir.mockResolvedValueOnce(['template.json', 'README.md']);
    fsPromises.stat
      .mockResolvedValueOnce({ isDirectory: () => false })  // README.md
    fsPromises.readFile.mockResolvedValueOnce('# Hello');

    const { load } = await import('./assembler.js');
    const files = await load('test');
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('README.md');
    expect(files[0].content).toBe('# Hello');
  });

  it('throws 422 when total chars exceed limit', async () => {
    const bigContent = 'x'.repeat(200001);
    fsPromises.readdir.mockResolvedValueOnce(['template.json', 'big.txt']);
    fsPromises.stat.mockResolvedValueOnce({ isDirectory: () => false });
    fsPromises.readFile.mockResolvedValueOnce(bigContent);

    const { load } = await import('./assembler.js');
    await expect(load('test')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('throws 404 when template directory does not exist', async () => {
    fsPromises.readdir.mockRejectedValueOnce(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    );
    const { load } = await import('./assembler.js');
    await expect(load('nonexistent')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rethrows non-ENOENT errors from readdir', async () => {
    const permErr = Object.assign(new Error('EPERM'), { code: 'EPERM' });
    fsPromises.readdir.mockRejectedValueOnce(permErr);

    const { load } = await import('./assembler.js');
    await expect(load('test')).rejects.toThrow('EPERM');
  });

  it('skips directories in the template folder', async () => {
    fsPromises.readdir.mockResolvedValueOnce(['template.json', 'subdir', 'main.js']);
    fsPromises.stat
      .mockResolvedValueOnce({ isDirectory: () => true })   // subdir
      .mockResolvedValueOnce({ isDirectory: () => false }); // main.js
    fsPromises.readFile.mockResolvedValueOnce('const x = 1;');

    const { load } = await import('./assembler.js');
    const files = await load('test');
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('main.js');
  });
});
