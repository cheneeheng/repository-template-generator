---
artifact: ITER_01
status: ready
created: 2026-04-28
scope: Error handling, request validation, file-size guard, LLM streaming to client, loading/error UI, version pinning
sections_changed: [03, 04, 05, 06]
sections_unchanged: [01, 02]
---

# Fullstack Template Generator — Iteration 01

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

> Unchanged — see SKELETON.md §02

---

## §03 · Tech Stack

New dependencies introduced by this iteration:

| Package | Version | Rationale |
|---|---|---|
| `express` | `^4.19.2` | Pin — 4.x API is stable; avoids unexpected 5.x breaking changes |
| `@anthropic-ai/sdk` | `^0.24.0` | Pin — streaming API stabilised at this minor; patch updates safe |
| `archiver` | `^7.0.1` | Pin — streaming ZIP interface unchanged across ^7 |
| `@octokit/rest` | `^21.0.0` | Pin — REST bindings stable; avoids breaking rename in future majors |
| `zod` | `^3.23.0` | Pin — v3 API stable; ZodError shape relied on for error formatting |
| `morgan` | `^1.10.0` | Request logging middleware (new) |
| `http-errors` | `^2.0.0` | Creates typed HTTP errors for use in route handlers (new) |

**Streaming note:** The Anthropic SDK's `.stream()` method returns an `AsyncIterable`. No additional streaming library is needed — the SDK handles SSE framing internally. The Express response is written as `text/event-stream`.

> **Deferred from skeleton still deferred:** Docker/compose, auth/accounts, rate limiting, OAuth flow.

---

## §04 · Backend

### New file: `middleware/errorHandler.js`

Central error handler registered **last** in `index.js` (after all routes). Converts `ZodError`, `HttpError` (from `http-errors`), and unhandled `Error` into consistent JSON:

```js
// middleware/errorHandler.js
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation error', details: err.flatten() });
  }
  if (err.statusCode) {                   // http-errors instance
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
```

Registration order in `index.js` — **sequence matters**:

```js
app.use(cors())               // 1. CORS
app.use(morgan('dev'))        // 2. Request logging
app.use(express.json())       // 3. Body parsing
app.use('/api', routes)       // 4. Routes
app.use(errorHandler)         // 5. Error handler — must be last, 4 args
```

`errorHandler` must have exactly four parameters `(err, req, res, next)` — Express uses arity to detect error handlers. A three-parameter signature silently skips it.

### Updated: `services/assembler.js` — file-size guard

Before passing files to the LLM, check total character count against a configurable limit:

```js
const MAX_TEMPLATE_CHARS = parseInt(process.env.MAX_TEMPLATE_CHARS ?? '200000', 10);
// ~50k tokens at ~4 chars/token — comfortably under the 200k context window

export async function load(templateId) {
  const files = await readTemplateFiles(templateId);   // existing logic
  const totalChars = files.reduce((sum, f) => sum + f.content.length, 0);
  if (totalChars > MAX_TEMPLATE_CHARS) {
    throw createError(422, `Template "${templateId}" exceeds size limit (${totalChars} chars)`);
  }
  return files;
}
```

`createError` comes from `http-errors`. The error propagates to `errorHandler` automatically via `next(err)` in the route — no catch needed in the route if `assembler.load` is awaited inside an async route that uses `express-async-errors` or explicit `try/catch` with `next(err)`.

**Recommendation:** add `express-async-errors` (`^3.1.0`) to avoid wrapping every async route in try/catch:

```js
// index.js — import once, side-effect-only
import 'express-async-errors';
```

After this import, any thrown error or rejected promise inside an async route handler is forwarded to `errorHandler` automatically.

### Updated: `routes/generate.js` — streaming endpoint

Replace the JSON response with a streaming SSE response. The client receives customised file content incrementally as the LLM produces it.

**New endpoint behaviour:**

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/api/generate` |
| Request body | `{ templateId, projectName, description }` (Zod-validated, unchanged) |
| Response Content-Type | `text/event-stream` |
| SSE event shape | `data: <JSON chunk>\n\n` |
| Final event | `data: [DONE]\n\n` |

**Chunk shape:**

```json
{ "type": "delta", "path": "README.md", "chunk": "# my-todo-app\n" }
```

When a file is complete:
```json
{ "type": "file_done", "path": "README.md" }
```

When all files are done:
```json
{ "type": "done", "fileTree": [{ "path": "...", "content": "..." }] }
```

The `done` event carries the full assembled file tree so the client can store it in state without reassembling from deltas.

**Stub implementation:**

```js
router.post('/', async (req, res) => {
  const { templateId, projectName, description } = generateSchema.parse(req.body);
  const baseFiles = await assembler.load(templateId);   // throws 422 if over limit

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const fileTree = await llm.customiseStreaming(baseFiles, projectName, description, res);

  res.write('data: ' + JSON.stringify({ type: 'done', fileTree }) + '\n\n');
  res.end();
});
```

### Updated: `services/llm.js` — streaming pass

```js
export async function customiseStreaming(files, projectName, description, res) {
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: CUSTOMISE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(files, projectName, description) }],
  });

  let accumulated = '';
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      accumulated += chunk.delta.text;
      res.write('data: ' + JSON.stringify({ type: 'delta', chunk: chunk.delta.text }) + '\n\n');
    }
  }

  // Parse accumulated JSON — the model returns the full [{path, content}] array
  return JSON.parse(accumulated);
}
```

**Gotcha — SSE via fetch, not EventSource:** The frontend must use `fetch()` + `ReadableStream`, not the native `EventSource` API. `EventSource` only supports GET requests; this endpoint is POST. See §05 for the client-side implementation.

### Updated: `routes/generate.js` — Zod validation with error forwarding

```js
import { z } from 'zod';

const generateSchema = z.object({
  templateId: z.string().min(1),
  projectName: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500),
});

// In the route: schema.parse() throws ZodError → caught by errorHandler
```

### New environment variables

```
MAX_TEMPLATE_CHARS   # optional — defaults to 200000
```

> **Deferred:** Request logging to a file/service, structured log format, per-IP rate limiting, auth.

---

## §05 · Frontend

### New: loading state during LLM pass

`PreviewPage` initiates the `POST /api/generate` call. While streaming is in progress, show a progress indicator. The page has three internal states:

| State | Render |
|---|---|
| `idle` | "Generate" button visible |
| `streaming` | Progress bar + live token counter + partial file list as files complete |
| `done` | Full file tree rendered with syntax highlighting |
| `error` | Error toast + retry button |

### New: SSE fetch utility — `client/src/lib/streamGenerate.js`

```js
export async function streamGenerate({ templateId, projectName, description }, callbacks) {
  // callbacks: { onDelta, onFileDone, onDone, onError }
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, projectName, description }),
  });

  if (!response.ok) {
    const err = await response.json();
    callbacks.onError(err.error ?? 'Request failed');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop();                        // keep incomplete chunk
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') break;
      const msg = JSON.parse(raw);
      if (msg.type === 'delta') callbacks.onDelta?.(msg.chunk);
      if (msg.type === 'file_done') callbacks.onFileDone?.(msg.path);
      if (msg.type === 'done') callbacks.onDone?.(msg.fileTree);
    }
  }
}
```

**React StrictMode double-invocation gotcha:** The `useEffect` that calls `streamGenerate` will fire twice in development. Guard with a `useRef(false)` flag set on first invocation, or cancel the in-flight stream on the cleanup function. The cleanup can call `reader.cancel()`.

### New: error toast — `client/src/components/ErrorToast.jsx`

Lightweight toast — no toast library required at this stage. A fixed-position `<div>` that renders when an `error` string is non-null, auto-dismisses after 5 seconds:

```jsx
export function ErrorToast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [message]);
  if (!message) return null;
  return (
    <div className="error-toast" role="alert">
      {message}
      <button onClick={onDismiss}>✕</button>
    </div>
  );
}
```

### Updated: `ConfigurePage` — error state on form submit

If `POST /api/generate` returns a non-2xx before the stream starts (e.g. 422 oversized template, 400 validation error), display the error message in `ErrorToast`. The error shape from `errorHandler` is `{ error: string, details?: object }`.

### Loading and error states — summary per page

| Page | Loading state | Error state |
|---|---|---|
| `TemplatePickerPage` | Skeleton cards while `GET /api/templates` loads | Toast + retry if fetch fails |
| `ConfigurePage` | Disabled submit button during in-flight check | Toast on 4xx/5xx |
| `PreviewPage` | Streaming progress bar + partial file list | Toast + back button |
| `ExportPage` | Spinner on ZIP download / repo creation | Toast on failure |

> **Deferred:** Responsive layout, OAuth flow for repo creation (token entry remains manual), loading skeleton shimmer animations.

---

## §06 · LLM / Prompts

> Prompt content unchanged — see SKELETON.md §06.

### Streaming behaviour (new)

The `customiseStreaming` function in `llm.js` replaces the non-streaming `customise` function. The model still receives the same system prompt and input shape. The only change is that the SDK `.stream()` API is used instead of `.messages.create()`, and deltas are forwarded to the Express response as they arrive.

**Context window strategy:** The file-size guard in `assembler.js` (200 000 chars ≈ 50k tokens) ensures the assembled template fits within the model's 200k context window. The LLM call is still single-turn (no history). The model returns a complete JSON array in one completion.

**Parsing risk:** Because the model streams a JSON array and we parse only after the full accumulation, a truncated response (e.g. network drop mid-stream) will produce a `JSON.parse` error. This is caught by `errorHandler` and surfaced as a 500 with the message `"LLM response was truncated or malformed"`. Wrap the `JSON.parse` call:

```js
let parsed;
try {
  parsed = JSON.parse(accumulated);
} catch {
  throw createError(500, 'LLM response was truncated or malformed');
}
return parsed;
```

> **Deferred:** Streaming individual file content as deltas (current approach accumulates full JSON before parsing — fine for now), multi-turn refinement, prompt versioning.