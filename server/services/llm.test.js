import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { makeFile } from '../tests/fixtures.js';

// vi.mock is hoisted — mock @anthropic-ai/sdk before any import
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { stream: vi.fn() },
  })),
}));

function makeStream(chunks) {
  const emitter = new EventEmitter();
  setImmediate(() => {
    for (const chunk of chunks) emitter.emit('text', chunk);
    emitter.emit('finalMessage');
  });
  return emitter;
}

function makeRes() {
  const writes = [];
  return {
    write: (data) => writes.push(data),
    _writes: writes,
  };
}

describe('customiseStreaming — bypass mode', () => {
  it('emits file_done for each file without calling Anthropic', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.resetModules();
    const { customiseStreaming } = await import('./llm.js');

    const files = [makeFile('a.js'), makeFile('b.js')];
    const res = makeRes();
    const result = await customiseStreaming(files, 'my-app', 'desc', res);

    expect(result).toEqual(files);
    const events = res._writes.map(w => JSON.parse(w.replace(/^data: /, '').trim()));
    expect(events.filter(e => e.type === 'file_done')).toHaveLength(2);
    expect(events.find(e => e.type === 'file_done' && e.path === 'a.js')).toBeDefined();
  });
});

describe('customiseStreaming — normal path', () => {
  it('parses clarinet output and emits file_done per file', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.resetModules();

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const mockStream = vi.fn().mockReturnValue(
      makeStream([
        '[{"path":"README.md","conte',
        'nt":"# hello"},{"path":"index.js","content":"const x=1"}]',
      ])
    );
    Anthropic.mockImplementation(() => ({ messages: { stream: mockStream } }));

    const { customiseStreaming } = await import('./llm.js');
    const res = makeRes();
    const result = await customiseStreaming([], 'app', 'desc', res);

    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('README.md');

    const events = res._writes.map(w => JSON.parse(w.replace(/^data: /, '').trim()));
    expect(events.filter(e => e.type === 'file_done')).toHaveLength(2);
  });

  it('throws 500 on malformed JSON from model', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.resetModules();

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    Anthropic.mockImplementation(() => ({
      messages: { stream: vi.fn().mockReturnValue(makeStream(['not json at all'])) },
    }));

    const { customiseStreaming } = await import('./llm.js');
    const res = makeRes();
    await expect(customiseStreaming([], 'app', 'desc', res))
      .rejects.toMatchObject({ statusCode: 500 });
  });
});
