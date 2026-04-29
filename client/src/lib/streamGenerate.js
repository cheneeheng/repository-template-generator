export async function streamGenerate({ templateId, projectName, description }, callbacks) {
  // callbacks: { onDelta, onFileDone, onDone, onError }
  let response;
  try {
    response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, projectName, description }),
    });
  } catch (err) {
    callbacks.onError?.(err.message ?? 'Network error');
    return;
  }

  if (!response.ok) {
    try {
      const err = await response.json();
      callbacks.onError?.(err.error ?? 'Request failed');
    } catch {
      callbacks.onError?.(`Request failed (${response.status})`);
    }
    return;
  }

  const reader = response.body.getReader();
  callbacks.onReader?.(reader);
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop(); // keep incomplete chunk
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') return;
        const msg = JSON.parse(raw);
        if (msg.type === 'delta') callbacks.onDelta?.(msg.chunk);
        if (msg.type === 'file_done') callbacks.onFileDone?.(msg.path);
        if (msg.type === 'done') callbacks.onDone?.(msg.fileTree);
        if (msg.type === 'error') { callbacks.onError?.(msg.message); return; }
      }
    }
  } catch (err) {
    callbacks.onError?.(err.message ?? 'Stream read error');
  }
}
