import { describe, it, expect, vi } from 'vitest';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { streamRefine } from './streamRefine.js';

const validBody = {
  fileTree: [{ path: 'a.js', content: 'x' }],
  history: [],
  instruction: 'make it TS',
};

describe('streamRefine', () => {
  it('calls onDone with updated file tree', async () => {
    const updatedTree = [{ path: 'a.ts', content: 'x' }];
    server.use(http.post('/api/refine', () =>
      new HttpResponse(
        `data: ${JSON.stringify({ type: 'done', fileTree: updatedTree })}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    const onDone = vi.fn();
    await streamRefine(validBody, { onDone });
    expect(onDone).toHaveBeenCalledWith(updatedTree);
  });

  it('calls onError with bypass message on 503 llm_unavailable', async () => {
    server.use(http.post('/api/refine', () =>
      HttpResponse.json({ error: 'llm_unavailable', message: 'bypass' }, { status: 503 })
    ));
    const onError = vi.fn();
    await streamRefine(validBody, { onError });
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('bypass'));
  });

  it('calls onRateLimit on 429', async () => {
    server.use(http.post('/api/refine', () =>
      new HttpResponse(null, { status: 429, headers: { 'RateLimit-Reset': '9999' } })
    ));
    const onRateLimit = vi.fn();
    await streamRefine(validBody, { onRateLimit });
    expect(onRateLimit).toHaveBeenCalled();
  });

  it('calls onError on generic server error', async () => {
    server.use(http.post('/api/refine', () =>
      HttpResponse.json({ error: 'internal error' }, { status: 500 })
    ));
    const onError = vi.fn();
    await streamRefine(validBody, { onError });
    expect(onError).toHaveBeenCalled();
  });
});
