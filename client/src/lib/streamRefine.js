export async function streamRefine({ fileTree, history, instruction }, callbacks) {
  let response;
  try {
    response = await fetch('/api/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileTree, history, instruction }),
    });
  } catch (err) {
    callbacks.onError?.(err.message ?? 'Network error');
    return;
  }

  if (response.status === 429) {
    const reset = response.headers.get('RateLimit-Reset');
    callbacks.onRateLimit?.(reset);
    return;
  }

  if (response.status === 503) {
    const { error } = await response.json();
    if (error === 'llm_unavailable') {
      callbacks.onError?.('Refinement is not available in bypass mode.');
      return;
    }
  }

  if (!response.ok) {
    try {
      const err = await response.json();
      callbacks.onError?.(err.error ?? 'Refinement failed');
    } catch {
      callbacks.onError?.(`Request failed (${response.status})`);
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') return;
        const msg = JSON.parse(raw);
        if (msg.type === 'delta')     callbacks.onDelta?.(msg.chunk);
        if (msg.type === 'file_done') callbacks.onFileDone?.(msg.path, msg.content);
        if (msg.type === 'done')      callbacks.onDone?.(msg.fileTree);
        if (msg.type === 'error')     { callbacks.onError?.(msg.message); return; }
      }
    }
  } catch (err) {
    callbacks.onError?.(err.message ?? 'Stream read error');
  }
}
