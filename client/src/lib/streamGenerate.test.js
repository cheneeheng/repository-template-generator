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
});
