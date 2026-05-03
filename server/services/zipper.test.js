import { describe, it, expect, vi } from 'vitest';
import { makeFile } from '../tests/fixtures.js';

const mockArchive = {
  append: vi.fn(),
  finalize: vi.fn(),
  on: vi.fn((event, cb) => {
    if (event === 'end') setImmediate(() => cb());
    if (event === 'data') setImmediate(() => cb(Buffer.from('zip-data')));
  }),
};
vi.mock('archiver', () => ({ default: vi.fn(() => mockArchive) }));

describe('zipper.createZip', () => {
  it('appends each file and finalises', async () => {
    vi.clearAllMocks();
    mockArchive.on.mockImplementation((event, cb) => {
      if (event === 'end') setImmediate(() => cb());
      if (event === 'data') setImmediate(() => cb(Buffer.from('zip-data')));
    });
    mockArchive.finalize.mockImplementation(() => {});

    const { createZip } = await import('./zipper.js');
    const files = [makeFile('a.js', 'const a=1'), makeFile('b.js', 'const b=2')];
    await createZip(files);

    expect(mockArchive.append).toHaveBeenCalledTimes(2);
    expect(mockArchive.append).toHaveBeenCalledWith('const a=1', { name: 'a.js' });
    expect(mockArchive.append).toHaveBeenCalledWith('const b=2', { name: 'b.js' });
    expect(mockArchive.finalize).toHaveBeenCalled();
  });

  it('returns a Buffer', async () => {
    vi.clearAllMocks();
    mockArchive.on.mockImplementation((event, cb) => {
      if (event === 'data') setImmediate(() => cb(Buffer.from([1, 2, 3])));
      if (event === 'end') setImmediate(() => cb());
    });
    mockArchive.finalize.mockImplementation(() => {});

    const { createZip } = await import('./zipper.js');
    const result = await createZip([makeFile('x.js', 'x')]);
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});
