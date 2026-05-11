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

  it('calls onError when fetch() itself throws (network failure)', async () => {
    server.use(http.post('/api/refine', () => HttpResponse.error()));
    const onError = vi.fn();
    await streamRefine(validBody, { onError });
    expect(onError).toHaveBeenCalled();
  });

  it('calls onError with status code when non-ok response body is not JSON', async () => {
    server.use(http.post('/api/refine', () =>
      new HttpResponse('bad gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } })
    ));
    const onError = vi.fn();
    await streamRefine(validBody, { onError });
    expect(onError).toHaveBeenCalledWith('Request failed (502)');
  });

  it('calls onFileDone and onDelta from SSE stream', async () => {
    const updatedTree = [{ path: 'a.ts', content: 'x' }];
    server.use(http.post('/api/refine', () =>
      new HttpResponse(
        [
          `data: ${JSON.stringify({ type: 'delta', chunk: 'ts' })}\n\n`,
          `data: ${JSON.stringify({ type: 'file_done', path: 'a.ts', content: 'x' })}\n\n`,
          `data: ${JSON.stringify({ type: 'done', fileTree: updatedTree })}\n\n`,
        ].join(''),
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    const onDelta = vi.fn();
    const onFileDone = vi.fn();
    const onDone = vi.fn();
    await streamRefine(validBody, { onDelta, onFileDone, onDone });
    expect(onDelta).toHaveBeenCalledWith('ts');
    expect(onFileDone).toHaveBeenCalledWith('a.ts', 'x');
    expect(onDone).toHaveBeenCalledWith(updatedTree);
  });

  it('calls onError from SSE error event', async () => {
    server.use(http.post('/api/refine', () =>
      new HttpResponse(
        `data: ${JSON.stringify({ type: 'error', message: 'overflow' })}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    const onError = vi.fn();
    await streamRefine(validBody, { onError });
    expect(onError).toHaveBeenCalledWith('overflow');
  });

  it('calls onError when stream body errors mid-read', async () => {
    server.use(http.post('/api/refine', () =>
      new HttpResponse(
        new ReadableStream({
          start(controller) {
            controller.error(new Error('stream errored'));
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    const onError = vi.fn();
    await streamRefine(validBody, { onError });
    expect(onError).toHaveBeenCalled();
  });

  it('falls back to "Stream read error" when stream error has no message', async () => {
    server.use(http.post('/api/refine', () =>
      new HttpResponse(
        new ReadableStream({
          start(controller) {
            controller.error({ code: 'STREAM_ERR' });
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    const onError = vi.fn();
    await streamRefine(validBody, { onError });
    expect(onError).toHaveBeenCalledWith('Stream read error');
  });

  it('falls back to "Network error" when fetch throws error with no message', async () => {
    const errNoMsg = Object.assign(new Error(), { message: undefined });
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(errNoMsg);
    const onError = vi.fn();
    await streamRefine(validBody, { onError });
    expect(onError).toHaveBeenCalledWith('Network error');
    vi.restoreAllMocks();
  });

  it('falls back to "Refinement failed" when non-ok JSON has no error field', async () => {
    server.use(http.post('/api/refine', () =>
      HttpResponse.json({ detail: 'broken' }, { status: 500 })
    ));
    const onError = vi.fn();
    await streamRefine(validBody, { onError });
    expect(onError).toHaveBeenCalledWith('Refinement failed');
  });

  it('skips non-data SSE lines without error', async () => {
    const updatedTree = [{ path: 'a.ts', content: 'x' }];
    server.use(http.post('/api/refine', () =>
      new HttpResponse(
        `: heartbeat\n\ndata: ${JSON.stringify({ type: 'done', fileTree: updatedTree })}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    const onDone = vi.fn();
    await streamRefine(validBody, { onDone });
    expect(onDone).toHaveBeenCalledWith(updatedTree);
  });

  it('stops streaming when [DONE] sentinel is received', async () => {
    const onDone = vi.fn();
    server.use(http.post('/api/refine', () =>
      new HttpResponse(
        `data: [DONE]\n\ndata: ${JSON.stringify({ type: 'done', fileTree: [] })}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    await streamRefine(validBody, { onDone });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('handles 503 with non-llm_unavailable error gracefully', async () => {
    server.use(http.post('/api/refine', () =>
      HttpResponse.json({ error: 'service_down' }, { status: 503 })
    ));
    const onError = vi.fn();
    await streamRefine(validBody, { onError });
    expect(onError).toHaveBeenCalled();
  });
});
