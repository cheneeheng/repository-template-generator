---
artifact: ITER_08
status: ready
created: 2026-04-28
scope: Context window overflow handling on /api/refine — catch Anthropic 400, surface user-friendly message, implement history truncation (drop oldest assistant turns first)
sections_changed: [04, 05]
sections_unchanged: [01, 02, 03, 06]
---

# Fullstack Template Generator — Iteration 08

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

> Unchanged — see ITER_07.md §02

---

## §03 · Tech Stack

> Unchanged — see ITER_05.md §03

---

## §04 · Backend

### The problem

Each `/api/refine` request sends the full conversation history plus the current file tree. ITER_07 §06 documented this as deferred: if history + file tree exceeds the context window, the Anthropic API returns a `400` with `error.type === 'invalid_request_error'` and a message containing `"prompt is too long"`. The current `errorHandler` does not recognise this shape — it falls through to the generic 500 branch and the client sees "Internal server error" with no actionable guidance.

### Updated: `middleware/errorHandler.js` — detect Anthropic 400

The Anthropic SDK throws an `APIError` (from `@anthropic-ai/sdk`) when the API returns a non-2xx. Detect the context-overflow case specifically:

```js
import Anthropic from '@anthropic-ai/sdk';

export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation error', details: err.flatten() });
  }

  // Anthropic SDK error — check for context overflow
  if (err instanceof Anthropic.APIError) {
    if (err.status === 400 && err.message?.includes('prompt is too long')) {
      return res.status(422).json({
        error: 'context_overflow',
        message: 'The conversation history is too long. Start a new refinement session or reduce the number of turns.',
      });
    }
    // Other Anthropic API errors (auth, overload, etc.)
    return res.status(502).json({ error: `LLM error: ${err.message}` });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
```

**Why 422 not 400:** The request body itself is valid (passes Zod). The failure is a semantic constraint — the assembled content is too large for the model. 422 Unprocessable Entity is the correct fit and keeps it distinct from Zod validation errors (400).

**Why not auto-truncate on the server:** The server doesn't own the history — the client does. Auto-truncating server-side without telling the client would silently desync the client's history state from what the model actually saw, producing confusing future turns. The right place to truncate is on the client, before sending.

### New: history truncation utility — `server/services/historyTruncator.js`

Even though the primary truncation happens client-side, the server needs a utility for the case where the client sends a history that is too large despite truncation (e.g. an individual assistant turn with a very large file tree that alone exceeds the window). Expose it as a shared utility that `routes/refine.js` can call before the LLM pass as a safety net.

```js
// server/services/historyTruncator.js

const CHAR_BUDGET = parseInt(process.env.MAX_HISTORY_CHARS ?? '600000', 10);
// ~150k tokens — leaves headroom for the system prompt and new user turn

/**
 * Truncates history to fit within the char budget.
 * Strategy: drop oldest assistant turns first (they contain full file trees).
 * User turns are preserved — losing them would break conversational coherence.
 * If even user turns alone exceed the budget, drop oldest user turns last.
 */
export function truncateHistory(history) {
  let chars = history.reduce((sum, m) => sum + m.content.length, 0);
  if (chars <= CHAR_BUDGET) return history;

  // Work on a copy — don't mutate the input
  const result = [...history];

  // Pass 1: drop assistant turns from the front (oldest first)
  for (let i = 0; i < result.length && chars > CHAR_BUDGET; ) {
    if (result[i].role === 'assistant') {
      chars -= result[i].content.length;
      result.splice(i, 1);
    } else {
      i++;
    }
  }

  // Pass 2: if still over budget, drop oldest user turns
  while (result.length > 0 && chars > CHAR_BUDGET) {
    chars -= result[0].content.length;
    result.shift();
  }

  return result;
}
```

**Apply in `routes/refine.js`:**

```js
import { truncateHistory } from '../services/historyTruncator.js';

router.post('/', async (req, res) => {
  const { fileTree, history, instruction } = refineSchema.parse(req.body);
  const safeHistory = truncateHistory(history);   // server-side safety net

  // ... SSE headers ...
  const updatedTree = await llm.refineStreaming(fileTree, safeHistory, instruction, res);
  // ...
});
```

**New environment variable:**

```
MAX_HISTORY_CHARS    # optional — defaults to 600000
```

Add to `server/.env.example`.

> **Deferred:** Summarisation of old turns instead of dropping them (would require a second LLM call — expensive; dropping is sufficient for the stated use case).

---

## §05 · Frontend

### Updated: `PreviewPage` — proactive truncation before sending

Before calling `streamRefine`, the client estimates whether the history is approaching the limit and truncates preemptively, mirroring the server's strategy. This avoids the round-trip failure in most cases.

**New utility — `client/src/lib/truncateHistory.js`:**

```js
const CHAR_BUDGET = 600_000; // match server default

export function truncateHistory(history) {
  let chars = history.reduce((sum, m) => sum + m.content.length, 0);
  if (chars <= CHAR_BUDGET) return history;

  const result = [...history];

  // Drop oldest assistant turns first
  for (let i = 0; i < result.length && chars > CHAR_BUDGET; ) {
    if (result[i].role === 'assistant') {
      chars -= result[i].content.length;
      result.splice(i, 1);
    } else {
      i++;
    }
  }

  // Drop oldest user turns if still over
  while (result.length > 0 && chars > CHAR_BUDGET) {
    chars -= result[0].content.length;
    result.shift();
  }

  return result;
}
```

Apply in `handleRefine` before calling `streamRefine`:

```js
import { truncateHistory } from '../lib/truncateHistory.js';

async function handleRefine() {
  const userTurn = { role: 'user', content: instruction };
  const nextHistory = truncateHistory([...history, userTurn]);
  // ...
}
```

### Updated: `ExportPage` — `context_overflow` error state

When `streamRefine`'s `onError` callback receives a message from a 422 `context_overflow` response, show a distinct, actionable message rather than the generic error toast:

```jsx
if (error === 'context_overflow' /* or check the error string */) {
  setError('Conversation too long — further refinement isn\'t possible. Export what you have, or start over with a new generation.');
}
```

The message should not say "start a new session" — there is no session. "Start over with a new generation" is accurate: the user goes back to the template picker.

**Add a "Start over" button** in the `PreviewPage` error state that navigates to `/` and clears all state. This is the natural recovery path and should be one click, not a manual browser navigation.

```jsx
{streamState.status === 'error' && (
  <div className="error-state">
    <ErrorToast message={streamState.error} onDismiss={...} />
    <button onClick={() => { clearAllState(); navigate('/'); }}>
      ← Start over
    </button>
  </div>
)}
```

> **Deferred:** Visual indicator in the refinement panel showing approximate "turns remaining" before the context limit, computed from history size client-side.