import { describe, it, expect, vi } from 'vitest';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { streamGenerate } from './streamGenerate.js';

function sseBody(events) {
  return events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('');
}

describe('streamGenerate', () => {
  it('calls onFileDone and onDone from SSE stream', async () => {
    const fileTree = [{ path: 'a.js', content: 'x' }];
    server.use(http.post('/api/generate', () =>
      new HttpResponse(
        sseBody([
          { type: 'file_done', path: 'a.js', content: 'x' },
          { type: 'done', fileTree },
        ]),
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));

    const onFileDone = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamGenerate(
      { templateId: 't', projectName: 'app', description: 'd' },
      { onFileDone, onDone, onError }
    );

    expect(onFileDone).toHaveBeenCalledWith('a.js', 'x');
    expect(onDone).toHaveBeenCalledWith(fileTree);
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onRateLimit on 429', async () => {
    server.use(http.post('/api/generate', () =>
      new HttpResponse(null, {
        status: 429,
        headers: { 'RateLimit-Reset': '1234567890' },
      })
    ));
    const onRateLimit = vi.fn();
    await streamGenerate(
      { templateId: 't', projectName: 'a', description: 'd' },
      { onRateLimit }
    );
    expect(onRateLimit).toHaveBeenCalledWith('1234567890');
  });

  it('calls onError on non-ok non-429 response', async () => {
    server.use(http.post('/api/generate', () =>
      HttpResponse.json({ error: 'something broke' }, { status: 500 })
    ));
    const onError = vi.fn();
    await streamGenerate(
      { templateId: 't', projectName: 'a', description: 'd' },
      { onError }
    );
    expect(onError).toHaveBeenCalledWith('something broke');
  });

  it('calls onError when fetch() itself throws (network failure)', async () => {
    server.use(http.post('/api/generate', () => HttpResponse.error()));
    const onError = vi.fn();
    await streamGenerate(
      { templateId: 't', projectName: 'a', description: 'd' },
      { onError }
    );
    expect(onError).toHaveBeenCalled();
  });

  it('calls onError with status code when non-ok response body is not JSON', async () => {
    server.use(http.post('/api/generate', () =>
      new HttpResponse('bad gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } })
    ));
    const onError = vi.fn();
    await streamGenerate(
      { templateId: 't', projectName: 'a', description: 'd' },
      { onError }
    );
    expect(onError).toHaveBeenCalledWith('Request failed (502)');
  });

  it('calls onDelta for delta events in SSE stream', async () => {
    const fileTree = [{ path: 'a.js', content: 'x' }];
    server.use(http.post('/api/generate', () =>
      new HttpResponse(
        sseBody([
          { type: 'delta', chunk: 'hello' },
          { type: 'done', fileTree },
        ]),
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    const onDelta = vi.fn();
    const onDone = vi.fn();
    await streamGenerate(
      { templateId: 't', projectName: 'app', description: 'd' },
      { onDelta, onDone }
    );
    expect(onDelta).toHaveBeenCalledWith('hello');
    expect(onDone).toHaveBeenCalled();
  });

  it('calls onError from SSE error event', async () => {
    server.use(http.post('/api/generate', () =>
      new HttpResponse(
        sseBody([{ type: 'error', message: 'oops' }]),
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    const onError = vi.fn();
    await streamGenerate(
      { templateId: 't', projectName: 'a', description: 'd' },
      { onError }
    );
    expect(onError).toHaveBeenCalledWith('oops');
  });

  it('calls onError when stream body errors mid-read', async () => {
    server.use(http.post('/api/generate', () =>
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
    await streamGenerate(
      { templateId: 't', projectName: 'a', description: 'd' },
      { onError }
    );
    expect(onError).toHaveBeenCalled();
  });

  it('falls back to "Stream read error" when stream error has no message', async () => {
    server.use(http.post('/api/generate', () =>
      new HttpResponse(
        new ReadableStream({
          start(controller) {
            // plain object with no .message → err.message ?? 'Stream read error'
            controller.error({ code: 'STREAM_ERR' });
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    const onError = vi.fn();
    await streamGenerate(
      { templateId: 't', projectName: 'a', description: 'd' },
      { onError }
    );
    expect(onError).toHaveBeenCalledWith('Stream read error');
  });

  it('falls back to "Network error" when fetch throws error with no message', async () => {
    const errNoMsg = Object.assign(new Error(), { message: undefined });
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(errNoMsg);
    const onError = vi.fn();
    await streamGenerate(
      { templateId: 't', projectName: 'a', description: 'd' },
      { onError }
    );
    expect(onError).toHaveBeenCalledWith('Network error');
    vi.restoreAllMocks();
  });

  it('falls back to "Request failed" when non-ok JSON has no error field', async () => {
    server.use(http.post('/api/generate', () =>
      HttpResponse.json({ detail: 'broken' }, { status: 500 })
    ));
    const onError = vi.fn();
    await streamGenerate(
      { templateId: 't', projectName: 'a', description: 'd' },
      { onError }
    );
    expect(onError).toHaveBeenCalledWith('Request failed');
  });

  it('skips non-data SSE lines (e.g. comments) without error', async () => {
    const fileTree = [{ path: 'a.js', content: 'x' }];
    server.use(http.post('/api/generate', () =>
      new HttpResponse(
        // SSE comment line followed by actual data
        `: heartbeat\n\ndata: ${JSON.stringify({ type: 'done', fileTree })}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    const onDone = vi.fn();
    await streamGenerate(
      { templateId: 't', projectName: 'app', description: 'd' },
      { onDone }
    );
    expect(onDone).toHaveBeenCalledWith(fileTree);
  });

  it('stops streaming when [DONE] sentinel is received', async () => {
    const onDone = vi.fn();
    server.use(http.post('/api/generate', () =>
      new HttpResponse(
        `data: [DONE]\n\ndata: ${JSON.stringify({ type: 'done', fileTree: [] })}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    await streamGenerate(
      { templateId: 't', projectName: 'app', description: 'd' },
      { onDone }
    );
    // [DONE] triggers early return; the done event after it is never processed
    expect(onDone).not.toHaveBeenCalled();
  });
});
