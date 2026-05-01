---
artifact: ITER_05
status: ready
created: 2026-04-28
scope: Per-file streaming deltas (LLM output parsed incrementally, files appear in preview as they complete) + prompt versioning groundwork
sections_changed: [03, 04, 05, 06]
sections_unchanged: [01, 02]
---

# Fullstack Template Generator — Iteration 05

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
| `clarinet` | `^0.9.1` | Streaming SAX-style JSON parser — emits events as tokens arrive rather than requiring the full string (new) |

No new frontend dependencies.

**Why a streaming JSON parser instead of accumulate-then-parse:**

The current `llm.js` accumulates the entire model response into a string and calls `JSON.parse` at the end. This means no file appears in the UI until the last byte of the last file arrives. `clarinet` (or equivalent) fires events as each object in the top-level array closes, letting the server forward a `file_done` event per file as the model completes it — files appear in the preview incrementally.

**Alternative considered — change the prompt to emit one JSON object per line (NDJSON):** This avoids a streaming parser entirely and is simpler to implement. However it requires a prompt change that trades structural guarantees for simplicity, and the model is less reliable at NDJSON than at a single JSON array. Streaming parser is preferred; see §06 for the NDJSON option as a fallback.

> **Deferred from previous iterations still deferred:** Multi-instance rate limiting (Redis), GitLab token refresh (automatic rotation), shimmer animations, dark mode, multi-turn LLM refinement.

---

## §04 · Backend

### Updated: `services/llm.js` — incremental JSON parsing

Replace the accumulate-then-parse approach with a `clarinet`-based streaming parse. As each file object in the `[{path, content}]` array closes, emit a `file_done` SSE event carrying the complete file. Send the final `done` event with the assembled file tree once the stream ends.

**New `customiseStreaming` signature** (unchanged externally — same params, same SSE contract):

```js
import clarinet from 'clarinet';

export async function customiseStreaming(files, projectName, description, res) {
  const stream = await anthropic.messages.stream({
    model: CURRENT_PROMPT_VERSION.model,       // prompt registry — see §06
    max_tokens: 8192,
    system: CURRENT_PROMPT_VERSION.system,
    messages: [{ role: 'user', content: buildPrompt(files, projectName, description) }],
  });

  const assembled = [];
  let parseError = null;

  await new Promise((resolve, reject) => {
    const parser = clarinet.createStream();
    let depth = 0;
    let inObject = false;
    let currentKey = null;
    let currentFile = {};

    // Track position within each file object
    parser.onvalue = (v) => {
      if (depth === 2 && currentKey) {
        currentFile[currentKey] = v;
      }
    };
    parser.onkey = (k) => { currentKey = k; };
    parser.onopenobject = (firstKey) => {
      depth++;
      if (depth === 2) {
        currentFile = {};
        inObject = true;
        currentKey = firstKey ?? null;
      }
    };
    parser.oncloseobject = () => {
      if (depth === 2 && inObject) {
        // File object is complete
        assembled.push(currentFile);
        res.write('data: ' + JSON.stringify({
          type: 'file_done',
          path: currentFile.path,
          content: currentFile.content,
        }) + '\n\n');
        currentFile = {};
        inObject = false;
      }
      depth--;
    };
    parser.onopenarray = () => { depth++; };
    parser.onclosearray = () => { depth--; };
    parser.onerror = (e) => { parseError = e; reject(e); };
    parser.onend = () => resolve();

    // Pipe SDK text deltas into the clarinet parser
    stream.on('text', (text) => {
      // Also forward raw delta to client for token counter in UI
      res.write('data: ' + JSON.stringify({ type: 'delta', chunk: text }) + '\n\n');
      parser.write(text);
    });

    stream.on('finalMessage', () => { parser.close(); });
    stream.on('error', reject);
  });

  if (parseError) {
    throw createError(500, 'LLM response was truncated or malformed');
  }
  return assembled;
}
```

**Depth tracking explanation:**

The model returns `[{path, content}, ...]`. The clarinet parser tracks nesting depth:

- `depth 1` = inside the top-level array
- `depth 2` = inside a file object
- `oncloseobject` at `depth 2` = one complete file ready to emit

This is robust to the model emitting arbitrary whitespace or key ordering variation.

**`stream.on('text', ...)` vs the `for await` loop:**

The Anthropic SDK's stream object supports both event-listener style (`stream.on('text', cb)`) and async iteration. Event-listener style fits better here because the clarinet parser is callback-driven — we need to write to it synchronously as each chunk arrives. Mixing `for await` with a callback parser is possible but requires manually resolving a promise on stream end; the event approach is cleaner.

**`parser.close()` vs `parser.end()`:** `clarinet`'s `.close()` signals that no more input is coming and fires `onend`. Call it in the `finalMessage` handler (after the SDK confirms the stream finished), not inside the `text` handler.

### Updated: `routes/generate.js` — forward `file_done` with content

The `file_done` event shape changes in this iteration:

**Before (ITER_01):**
```json
{ "type": "file_done", "path": "README.md" }
```

**After:**
```json
{ "type": "file_done", "path": "README.md", "content": "# my-todo-app\n..." }
```

The `done` event is unchanged — it still carries the full `fileTree` array. The `file_done` content field means the client can render each file as it arrives without waiting for `done`. The `done` event remains the canonical source of truth and the trigger for enabling the export buttons.

No change to the route handler itself — the `file_done` events are emitted inside `llm.customiseStreaming`, which already has access to `res`.

### New: `prompts/registry.js` — prompt versioning

A minimal registry that makes the active prompt version explicit and queryable. This does not introduce a database or complex version management — it is a plain JS module.

```js
// server/prompts/registry.js

import { CUSTOMISE_V1 } from './versions/customise.v1.js';
import { CUSTOMISE_V2 } from './versions/customise.v2.js';

const VERSIONS = {
  'customise-v1': CUSTOMISE_V1,
  'customise-v2': CUSTOMISE_V2,
};

// The active version is configured via env var — defaults to the latest stable
const ACTIVE_KEY = process.env.PROMPT_VERSION ?? 'customise-v2';

export const CURRENT_PROMPT_VERSION = VERSIONS[ACTIVE_KEY];

if (!CURRENT_PROMPT_VERSION) {
  throw new Error(`Unknown PROMPT_VERSION: "${ACTIVE_KEY}". Available: ${Object.keys(VERSIONS).join(', ')}`);
}
```

**Each version module exports a plain object:**

```js
// server/prompts/versions/customise.v1.js
export const CUSTOMISE_V1 = {
  key: 'customise-v1',
  model: 'claude-sonnet-4-20250514',
  system: `You are a project scaffold customiser. You will receive a JSON array...`,
  // The v1 prompt — preserved exactly as specified in SKELETON.md §06
};
```

```js
// server/prompts/versions/customise.v2.js
export const CUSTOMISE_V2 = {
  key: 'customise-v2',
  model: 'claude-sonnet-4-20250514',
  system: `You are a project scaffold customiser. You will receive a JSON array of template files
in the format [{path, content}] along with a project name and description.

Your job:
1. Replace all occurrences of the placeholder "{{PROJECT_NAME}}" with the actual project name.
2. Rewrite README.md to describe the actual project using the provided description.
3. Insert the project name and description into package.json, pyproject.toml, or equivalent where present.
4. Make no other changes.

Respond ONLY with the updated JSON array. No prose, no markdown fences.
Output each file object as soon as it is complete before moving to the next.`,
  // v2 adds the final instruction nudging the model to complete one object at a time.
  // This increases the chance that clarinet receives cleanly-closed objects early in the stream
  // rather than the model batching output.
};
```

**The v2 prompt addition** ("Output each file object as soon as it is complete before moving to the next") is a hint to the model to flush one file at a time. Models do not strictly honour this, but it empirically shifts output toward earlier per-file completion. The streaming parser works regardless — this just improves the latency of the first `file_done` event.

**New environment variable:**

```
PROMPT_VERSION    # optional — defaults to customise-v2
```

**Updated `server/.env.example`:**

```
ANTHROPIC_API_KEY=
PORT=3000
TEMPLATES_DIR=
MAX_TEMPLATE_CHARS=
PROMPT_VERSION=         # optional — defaults to customise-v2; set to customise-v1 to roll back

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback

# GitLab OAuth (optional)
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
GITLAB_REDIRECT_URI=http://localhost:3000/api/auth/gitlab/callback
GITLAB_BASE_URL=https://gitlab.com
```

**`llm.js` import change:** Replace the direct import of `customise.js` with the registry:

```js
// Before
import { CUSTOMISE_SYSTEM_PROMPT } from '../prompts/customise.js';

// After
import { CURRENT_PROMPT_VERSION } from '../prompts/registry.js';
// Use CURRENT_PROMPT_VERSION.system and CURRENT_PROMPT_VERSION.model throughout
```

**`prompts/customise.js` is not deleted** — it becomes `prompts/versions/customise.v1.js` with a thin re-export wrapper in the original location for any code that still imports it directly (there should be none after this iteration, but defensive).

> **Deferred:** A/B testing between prompt versions, prompt version recorded in the `done` SSE event for client-side logging, per-request prompt version override (query param).

---

## §05 · Frontend

### Updated: `PreviewPage` — render files as they arrive

Currently `PreviewPage` waits for the `done` event before rendering anything. With per-file `file_done` events now carrying `content`, each file can be added to the preview list as it arrives.

**Updated `streaming` state shape in `PreviewPage`:**

```js
const [streamState, setStreamState] = useState({
  status: 'idle',      // 'idle' | 'streaming' | 'done' | 'error'
  files: [],           // grows as file_done events arrive
  fileTree: null,      // set on done event — full canonical tree
  error: null,
  tokenCount: 0,       // incremented on each delta event
});
```

**Updated `streamGenerate` callbacks wiring:**

```js
streamGenerate(
  { templateId, projectName, description },
  {
    onDelta: (chunk) => {
      setStreamState(prev => ({ ...prev, tokenCount: prev.tokenCount + chunk.length }));
    },
    onFileDone: (path, content) => {
      setStreamState(prev => ({
        ...prev,
        files: [...prev.files, { path, content }],
      }));
    },
    onDone: (fileTree) => {
      setStreamState(prev => ({ ...prev, status: 'done', fileTree }));
    },
    onError: (msg) => {
      setStreamState(prev => ({ ...prev, status: 'error', error: msg }));
    },
  }
);
```

**`FileTree` renders `streamState.files` during streaming** — shows a completion checkmark per file as each arrives. Previously the file list was empty until `done`.

**`FileViewer` is clickable during streaming** — a user can click a completed file in the tree to read it before the stream finishes. Files still in progress are shown as greyed-out entries with a spinner.

**"Files completed" counter** replaces the raw token counter in the streaming progress bar — more meaningful to users:

```
Generating... 3 / 8 files complete
```

Token count can remain in a secondary small-text span for developer interest but should not be the primary progress indicator.

### Updated: `client/src/lib/streamGenerate.js` — pass content in `onFileDone`

The `onFileDone` callback gains a second argument:

```js
// Before
if (msg.type === 'file_done') callbacks.onFileDone?.(msg.path);

// After
if (msg.type === 'file_done') callbacks.onFileDone?.(msg.path, msg.content);
```

Backward-compatible — callers that only use the first argument are unaffected.

### Streaming edge case — partial render race

When the user clicks a file in the `FileTree` that just received its `file_done` event, `FileViewer` must read from `streamState.files`, not from `streamState.fileTree` (which is only set on `done`). During streaming, `fileTree` is `null`. The `FileViewer` receives the file object directly as a prop from `FileTree`'s click handler — no lookup needed. This avoids the null-check entirely.

> **Deferred:** Shimmer animations for in-progress file slots, dark mode, multi-turn LLM refinement.

---

## §06 · LLM / Prompts

### Prompt versioning structure

The prompt registry (`prompts/registry.js`) introduced in §04 governs which prompt version is active. The two versions:

| Key | Change from previous |
|---|---|
| `customise-v1` | Original prompt from SKELETON.md §06 — baseline |
| `customise-v2` | Adds one trailing instruction: "Output each file object as soon as it is complete before moving to the next" |

**v2 is the new default.** The added instruction nudges the model toward earlier per-file output completion, improving perceived streaming responsiveness. It does not change correctness — the system prompt's four numbered rules are identical. The output schema (`[{path, content}]`) is unchanged.

**Rollback:** Set `PROMPT_VERSION=customise-v1` in the server environment to revert to v1 without a code deploy.

### NDJSON fallback option (deferred)

An alternative to the streaming JSON parser: instruct the model to emit one JSON object per line (NDJSON), parse each line with `JSON.parse` as it completes. Simpler server code; no `clarinet` dependency. Tradeoff: less structural reliability — the model occasionally emits wrapped or indented output even when explicitly told not to. The streaming parser approach handles any valid JSON structure. NDJSON remains an option if `clarinet` proves problematic.

> **Deferred:** Streaming individual file *content* as character deltas within a file (current approach emits the whole file at once on `file_done`), multi-turn refinement, A/B testing between prompt versions.