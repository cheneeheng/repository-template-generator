---
artifact: ITER_07
status: ready
created: 2026-04-28
scope: Multi-turn LLM refinement (follow-up messages to iteratively adjust the generated file tree) + prefers-reduced-motion support + OS colour scheme change listener
sections_changed: [02, 04, 05, 06]
sections_unchanged: [01, 03]
---

# Fullstack Template Generator — Iteration 07

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

### New route

| Method | Path | Description |
|---|---|---|
| POST | /api/refine | Accept a file tree + conversation history + user instruction → run another LLM pass → stream updated file tree |

`/api/refine` is structurally identical to `/api/generate` — same SSE contract, same `file_done`/`done` event shapes — but it receives the already-generated file tree as input rather than loading a template from disk. It also accepts the prior conversation history so the model has context for incremental changes.

The `assembler` service is not involved in refinement — there is no template to load. The file tree the client holds in state is passed directly to the LLM.

**Updated data flow after first generation:**

```
PreviewPage (holds fileTree in state)
    │
    ├── user types refinement instruction ("make it TypeScript", "add a .prettierrc")
    │
    ▼
POST /api/refine
    body: { fileTree, history, instruction }
    │
    ├── services/llm.refineStreaming()   ← new function, same SSE write pattern
    │
    └── SSE stream → PreviewPage updates fileTree in state
```

No new server-side state — the file tree round-trips through the client between generation and refinement. The server remains stateless.

---

## §03 · Tech Stack

> Unchanged — see ITER_05.md §03 (no new dependencies this iteration)

---

## §04 · Backend

### New: `routes/refine.js`

```js
import { z } from 'zod';
import * as llm from '../services/llm.js';

const fileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

const historyMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const refineSchema = z.object({
  fileTree:    z.array(fileSchema).min(1).max(100),
  history:     z.array(historyMessageSchema).max(20),
  instruction: z.string().min(1).max(1000),
});

router.post('/', async (req, res) => {
  const { fileTree, history, instruction } = refineSchema.parse(req.body);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const updatedTree = await llm.refineStreaming(fileTree, history, instruction, res);

  res.write('data: ' + JSON.stringify({ type: 'done', fileTree: updatedTree }) + '\n\n');
  res.end();
});
```

**Validation bounds:**

- `fileTree` capped at 100 files — prevents absurdly large templates from being passed. Complements the char-count guard in `assembler.js` (ITER_01); here the guard is a file-count ceiling since the tree is already in memory.
- `history` capped at 20 messages — prevents unbounded conversation growth from exhausting the context window. See §06 for the context strategy.
- `instruction` capped at 1000 chars — refinement instructions are short directives, not essays.

Register in `index.js`:

```js
import refineRouter from './routes/refine.js';
app.use('/api/refine', refineRouter);
```

### Updated: `services/llm.js` — `refineStreaming`

```js
export async function refineStreaming(fileTree, history, instruction, res) {
  // Build the messages array: prior history + new user turn
  const messages = [
    ...history,
    {
      role: 'user',
      content: buildRefinePrompt(fileTree, instruction),
    },
  ];

  const stream = await anthropic.messages.stream({
    model: CURRENT_PROMPT_VERSION.model,
    max_tokens: 8192,
    system: CURRENT_PROMPT_VERSION.refineSystem,   // new system prompt — see §06
    messages,
  });

  // Streaming parse identical to customiseStreaming — reuse clarinet logic
  return streamParseFileTree(stream, res);
}
```

**`streamParseFileTree` — extracted shared helper:**

Both `customiseStreaming` and `refineStreaming` stream a `[{path, content}]` JSON array from the model and parse it with `clarinet`. Extract the clarinet logic from `customiseStreaming` into a private `streamParseFileTree(stream, res)` function in `llm.js`. Both public functions call it. This avoids duplicating the depth-tracking parser across two functions.

```js
// private — not exported
async function streamParseFileTree(stream, res) {
  const assembled = [];
  let parseError = null;

  await new Promise((resolve, reject) => {
    const parser = clarinet.createStream();
    // ... identical depth-tracking logic from ITER_05 ...
    stream.on('text', (text) => {
      res.write('data: ' + JSON.stringify({ type: 'delta', chunk: text }) + '\n\n');
      parser.write(text);
    });
    stream.on('finalMessage', () => { parser.close(); });
    stream.on('error', reject);
  });

  if (parseError) throw createError(500, 'LLM response was truncated or malformed');
  return assembled;
}
```

### Updated: API surface summary

| Method | Path | Description |
|---|---|---|
| GET | /api/health | Health check |
| GET | /api/templates | Scan templates dir, return metadata list |
| POST | /api/generate | Assemble template + LLM pass → stream file tree |
| POST | /api/refine | Accept file tree + history + instruction → stream updated file tree |
| POST | /api/export/zip | Accept file tree, return ZIP stream |
| POST | /api/export/repo | Accept file tree + Git provider token, create repo |
| GET | /api/auth/:provider/start | Initiate OAuth flow |
| GET | /api/auth/:provider/callback | Handle OAuth callback |
| GET | /api/auth/:provider/revoke | Revoke token (best-effort) |
| GET | /api/auth/providers | Return which providers are configured |

> **Deferred:** Per-user rate limiting on `/api/refine` (same in-memory approach as auth would work; deferred until abuse is observed), streaming refinement progress to a separate indicator distinct from the initial generation spinner.

---

## §05 · Frontend

### Updated: `PreviewPage` — refinement panel

After the initial `done` event, `PreviewPage` gains a refinement input below the file tree. The user types an instruction and submits; the page re-enters `streaming` status, the file tree updates in place as `file_done` events arrive, and the conversation history grows.

**Updated state shape:**

```js
const [streamState, setStreamState] = useState({
  status: 'idle',       // 'idle' | 'streaming' | 'done' | 'error'
  files: [],
  fileTree: null,
  error: null,
  tokenCount: 0,
});

const [history, setHistory] = useState([]);         // [{role, content}]
const [instruction, setInstruction] = useState('');
```

**`history` structure** mirrors the API schema: `role` is `'user'` or `'assistant'`. After each round-trip:

- Append `{ role: 'user', content: instruction }` to history before the request.
- Append `{ role: 'assistant', content: '<serialised file tree>' }` after `done` — the assistant turn is the JSON array the model produced, so subsequent turns have context for what changed.

**Serialising the assistant turn:** Pass `JSON.stringify(fileTree)` as the assistant content. This is large but necessary — the model needs to see the current state of the files to apply incremental changes correctly. The history cap (20 messages = 10 turns) bounds the total size. See §06 for context window implications.

**Refinement submit handler:**

```js
async function handleRefine() {
  if (!instruction.trim()) return;

  const userTurn = { role: 'user', content: instruction };
  const nextHistory = [...history, userTurn];

  setHistory(nextHistory);
  setInstruction('');
  setStreamState(prev => ({ ...prev, status: 'streaming', files: [], tokenCount: 0 }));

  streamRefine(
    { fileTree: streamState.fileTree, history: nextHistory, instruction },
    {
      onFileDone: (path, content) => {
        setStreamState(prev => ({
          ...prev,
          files: [...prev.files, { path, content }],
        }));
      },
      onDone: (updatedTree) => {
        setHistory(prev => [
          ...prev,
          { role: 'assistant', content: JSON.stringify(updatedTree) },
        ]);
        setStreamState(prev => ({ ...prev, status: 'done', fileTree: updatedTree }));
      },
      onError: (msg) => {
        setStreamState(prev => ({ ...prev, status: 'error', error: msg }));
      },
    }
  );
}
```

**`files` is reset to `[]` on each refinement** — the file list rebuilds from `file_done` events for the new pass, same as initial generation. This gives the user clear visual feedback that a new pass is running.

### New: `client/src/lib/streamRefine.js`

Identical structure to `streamGenerate.js` — `fetch` POST, `ReadableStream` parsing, same SSE event handling. Extracted as a separate module to keep the call sites readable.

```js
export async function streamRefine({ fileTree, history, instruction }, callbacks) {
  const response = await fetch('/api/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileTree, history, instruction }),
  });

  if (!response.ok) {
    const err = await response.json();
    callbacks.onError?.(err.error ?? 'Refinement failed');
    return;
  }

  // SSE parsing — identical to streamGenerate
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') break;
      const msg = JSON.parse(raw);
      if (msg.type === 'delta')     callbacks.onDelta?.(msg.chunk);
      if (msg.type === 'file_done') callbacks.onFileDone?.(msg.path, msg.content);
      if (msg.type === 'done')      callbacks.onDone?.(msg.fileTree);
    }
  }
}
```

**React StrictMode double-invocation:** The same `useRef(false)` guard from `streamGenerate` applies to `streamRefine`. The refinement submit handler is triggered by a button click (not `useEffect`), so double-invocation is not a risk here — no guard needed.

### New: `RefinementPanel` component

```jsx
// client/src/components/RefinementPanel.jsx
export function RefinementPanel({ onSubmit, disabled }) {
  const [value, setValue] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit(value.trim());
    setValue('');
  }

  return (
    <div className="refinement-panel">
      <p className="refinement-panel__label">Refine your project</p>
      <div className="refinement-panel__row">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(e); }}
          placeholder="e.g. make it TypeScript, add a .prettierrc"
          disabled={disabled}
          aria-label="Refinement instruction"
          maxLength={1000}
        />
        <button onClick={handleSubmit} disabled={disabled || !value.trim()}>
          {disabled ? <span className="spinner" aria-label="Loading" /> : 'Refine'}
        </button>
      </div>
    </div>
  );
}
```

`disabled` is `true` while `streamState.status === 'streaming'` — prevents concurrent refinement requests.

`RefinementPanel` is rendered below the `FileTree`/`FileViewer` split on `PreviewPage`, visible only when `streamState.status === 'done'` or `'streaming'` (not during initial idle state or error state).

### Small finish items — `prefers-reduced-motion` and OS scheme listener

**`prefers-reduced-motion`** — add to `index.css` immediately after the shimmer/spin keyframe definitions from ITER_06:

```css
@media (prefers-reduced-motion: reduce) {
  .shimmer,
  .spinner {
    animation: none;
  }
  /* Static fallback for shimmer — show base colour only */
  .shimmer {
    background: var(--shimmer-base);
  }
}
```

One block, two rules. Users who opt out of motion see a static grey placeholder instead of the animated sweep, and a static border ring instead of the spinner. No JS changes needed.

**OS colour scheme change listener** — add inside `DarkModeToggle.jsx`, alongside the existing toggle logic:

```js
useEffect(() => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return;   // user has an explicit preference — don't override it

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => {
    setDark(e.matches);
    applyTheme(e.matches);
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}, []);
```

The listener only fires when `localStorage` has no explicit preference. If the user has toggled the theme manually, their choice is preserved. If they haven't, the app tracks the OS setting in real time.

> **Deferred:** Per-user rate limiting on `/api/refine`, a visual conversation history panel showing past instructions and their outcomes, undo/redo across refinement turns (would require keeping a stack of past `fileTree` snapshots in state).

---

## §06 · LLM / Prompts

### New system prompt for refinement — `prompts/versions/refine.v1.js`

The refinement pass uses a different system prompt from the initial customisation pass. The model's job changes: instead of applying mechanical substitutions to a template, it must apply a user's natural-language instruction to an existing file tree while leaving everything else untouched.

```js
// server/prompts/versions/refine.v1.js
export const REFINE_V1 = {
  key: 'refine-v1',
  model: 'claude-sonnet-4-20250514',
  system: `You are a project scaffold editor. You will receive:
1. A JSON array of project files in the format [{path, content}].
2. A conversation history of prior edits.
3. A new instruction describing a change to make.

Your job:
- Apply the instruction to the relevant files.
- Return ALL files — both changed and unchanged — as a single JSON array [{path, content}].
- Do not add or remove files unless the instruction explicitly asks for it.
- Do not alter files that are not relevant to the instruction.
- Make no other changes.

Respond ONLY with the updated JSON array. No prose, no markdown fences.
Output each file object as soon as it is complete before moving to the next.`,
};
```

**Key differences from `customise-v2`:**

- Instructs the model to return *all* files, not just changed ones — the client replaces its entire `fileTree` state with the response, so a partial return would silently drop files.
- "Do not alter files not relevant to the instruction" — guards against the model making unsolicited improvements.
- The instruction to output objects one at a time is carried forward from v2 for the same streaming responsiveness reason.

**Register in `prompts/registry.js`:**

```js
import { REFINE_V1 } from './versions/refine.v1.js';

const VERSIONS = {
  'customise-v1': CUSTOMISE_V1,
  'customise-v2': CUSTOMISE_V2,
  'refine-v1':    REFINE_V1,
};
```

Expose on `CURRENT_PROMPT_VERSION` as a separate key:

```js
export const CURRENT_PROMPT_VERSION = VERSIONS[ACTIVE_KEY];        // customise prompt
export const CURRENT_REFINE_VERSION = VERSIONS['refine-v1'];        // refinement prompt — not env-switchable yet
```

`CURRENT_REFINE_VERSION` is not env-switchable in this iteration — there is only one version. The export name follows the same pattern so it can be made switchable in a future iteration without changing call sites.

### Context window strategy for multi-turn refinement

Each `/api/refine` call sends the full conversation history plus the current file tree. The growth is bounded by two caps set in ITER_07:

- **History cap:** 20 messages (10 turns). At each turn the assistant message is `JSON.stringify(fileTree)`. A typical generated project is 10–30 files averaging ~2 KB each = ~20–60 KB per assistant turn. At 10 turns, worst case ≈ 600 KB of history. At ~4 chars/token this is ~150k tokens — within the 200k context window but close to the limit at maximum history.
- **Practical guidance:** For most projects (5–15 files, typical refinement instructions), 10 turns is more than sufficient and context usage stays well under 100k tokens. If a future iteration needs to support larger templates, the history cap should be reduced or old turns summarised before the limit is reached.

**No truncation logic is implemented in this iteration.** If the history + file tree exceeds `max_tokens`, the Anthropic API returns a `400` with an `invalid_request_error`. This propagates to `errorHandler` as a 500 (the error is not an `http-errors` instance). A follow-up iteration should catch this specific error and surface a user-friendly message ("conversation too long — start a new refinement session").

> **Deferred:** Automatic history truncation or summarisation when approaching the context limit, env-switchable refine prompt version (`REFINE_PROMPT_VERSION`), evaluation harness to test refinement correctness across a set of fixture instructions.