---
artifact: ITER_13
status: ready
created: 2026-05-03
scope: LLM bypass mode — when ANTHROPIC_API_KEY is absent, skip the customisation pass and return the raw template files unchanged; surface the degraded mode clearly in the health check, startup log, and UI
sections_changed: [02, 04, 05]
sections_unchanged: [01, 03, 06]
---

# Fullstack Template Generator — Iteration 13

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

### LLM bypass behaviour

When `ANTHROPIC_API_KEY` is absent or empty, the `/api/generate` and `/api/refine` routes skip the LLM pass entirely:

- `POST /api/generate` — assembles the template files from disk and returns them as-is, emitting one `file_done` SSE event per file followed by `done`. The SSE contract is identical to the normal path; no client changes to the event-parsing logic are needed.
- `POST /api/refine` — returns 503 with `{ error: 'llm_unavailable', message: '...' }`. Refinement has no meaningful bypass — it is inherently LLM-driven. The UI disables the refinement panel in bypass mode.

`GET /api/health` already returns `anthropicKey: 'missing'` and `ok: false` when the key is absent (ITER_12). No change needed there.

A new field is added to `GET /api/health` and a new lightweight endpoint exposes mode to the frontend:

| Method | Path | Description |
|---|---|---|
| GET | /api/config | Returns `{ llmEnabled: bool }` — read by the frontend on mount |

---

## §03 · Tech Stack

> Unchanged — see ITER_05.md §03

---

## §04 · Backend

### New: `services/llm.js` — bypass guard

Add a module-level flag and export it so routes and the config endpoint can read it:

```js
// server/services/llm.js (addition at top of file)
export const LLM_ENABLED = !!process.env.ANTHROPIC_API_KEY;
```

### Updated: `services/llm.js` — `customiseStreaming` bypass path

```js
export async function customiseStreaming(files, projectName, description, res) {
  if (!LLM_ENABLED) {
    // Bypass: emit each file as-is, then done
    for (const file of files) {
      res.write('data: ' + JSON.stringify({
        type: 'file_done',
        path: file.path,
        content: file.content,
      }) + '\n\n');
    }
    return files;
  }

  // Normal path — unchanged from ITER_05/07
  // ...
}
```

The bypass emits the same SSE events as the normal path. The client receives `file_done` events and a final `done` event (written by the route handler) — indistinguishable in shape from a real LLM response. No changes to `streamGenerate.js` or `PreviewPage` SSE parsing.

`{{PROJECT_NAME}}` placeholders are **not** replaced in bypass mode — the files are raw template content. This is acceptable and documented; the point of bypass is to let the app function for development and demo purposes without a key.

### Updated: `routes/refine.js` — 503 in bypass mode

```js
import { LLM_ENABLED } from '../services/llm.js';

router.post('/', async (req, res) => {
  if (!LLM_ENABLED) {
    return res.status(503).json({
      error: 'llm_unavailable',
      message: 'Refinement requires an Anthropic API key. The server is running in bypass mode.',
    });
  }
  // Normal path — unchanged
  // ...
});
```

### New: `routes/config.js`

A lightweight, unauthenticated endpoint the frontend calls once on mount to learn the server's capability state. Intentionally minimal — only expose what the UI needs to render correctly.

```js
// server/routes/config.js
import { Router } from 'express';
import { LLM_ENABLED } from '../services/llm.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ llmEnabled: LLM_ENABLED });
});

export default router;
```

Register in `index.js`:

```js
import configRouter from './routes/config.js';
app.use('/api/config', configRouter);
```

### Updated: startup logging — `index.js`

The existing startup block (ITER_12) already prints `Claude key: configured / MISSING`. Add a prominent bypass-mode banner when the key is absent, so the operator sees it clearly in the terminal:

```js
if (!LLM_ENABLED) {
  console.warn(`
╔══════════════════════════════════════════╗
║  ⚠  BYPASS MODE — LLM DISABLED          ║
║  ANTHROPIC_API_KEY is not set.           ║
║  Templates will be returned unchanged.  ║
║  Refinement is disabled.                 ║
╚══════════════════════════════════════════╝
`);
}
```

### Updated: `server/.env.example`

No new variables — absence of `ANTHROPIC_API_KEY` is the signal. Add a comment clarifying the bypass behaviour:

```
# If ANTHROPIC_API_KEY is empty or absent, the server runs in bypass mode:
# templates are returned without LLM customisation, and /api/refine returns 503.
ANTHROPIC_API_KEY=
```

---

## §05 · Frontend

### New: app-level config fetch

On mount, `App.jsx` fetches `GET /api/config` and stores the result in a top-level state or context. All pages that need to adapt their UI read from this context rather than checking the key themselves.

**New context — `client/src/context/AppConfigContext.jsx`:**

```jsx
import { createContext, useContext, useEffect, useState } from 'react';

const AppConfigContext = createContext({ llmEnabled: true });

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState({ llmEnabled: true }); // optimistic default

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(setConfig)
      .catch(() => {}); // silent — default (llmEnabled: true) is safe on fetch failure
  }, []);

  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  );
}

export const useAppConfig = () => useContext(AppConfigContext);
```

Wrap `<App>` in `<AppConfigProvider>` in `main.jsx`. The config is fetched once; no polling.

**Optimistic default of `llmEnabled: true`:** If the fetch fails (network error, cold start), the UI assumes LLM is available. The user will hit a real error only if they actually try to generate — which produces a clear error toast. Falsely disabling the UI on a transient fetch failure is worse UX than a delayed error.

### Updated: `TemplatePickerPage` — bypass mode banner

When `!llmEnabled`, show an informational banner above the template grid. It is not an error — bypass mode is intentional — so it uses a neutral/warning visual treatment, not the error red.

```jsx
// TemplatePickerPage.jsx
import { useAppConfig } from '../context/AppConfigContext';

export function TemplatePickerPage() {
  const { llmEnabled } = useAppConfig();

  return (
    <Shell step={1}>
      {!llmEnabled && (
        <div className="banner banner--warning" role="status">
          <strong>LLM unavailable</strong> — templates will be returned without customisation.
          Placeholder values like <code>{'{{PROJECT_NAME}}'}</code> will not be replaced.
          To enable full customisation, set <code>ANTHROPIC_API_KEY</code> on the server.
        </div>
      )}
      {/* rest of the page */}
    </Shell>
  );
}
```

The banner appears only on the first page — it is the earliest point in the flow where the user should know what to expect. Repeating it on every page would be noisy.

### Updated: `PreviewPage` — bypass mode label on file viewer

When `!llmEnabled`, add a small pill/badge next to the page title: "Bypass mode — raw template". This reminds the user viewing the file tree that `{{PROJECT_NAME}}` is unsubstituted.

```jsx
{!llmEnabled && (
  <span className="badge badge--neutral" aria-label="LLM bypass mode active">
    Raw template
  </span>
)}
```

### Updated: `PreviewPage` — disable refinement panel in bypass mode

`RefinementPanel` receives a `disabled` prop already (used while streaming). Add a second reason to disable it: bypass mode.

```jsx
<RefinementPanel
  onSubmit={handleRefine}
  disabled={streamState.status === 'streaming' || !llmEnabled}
  disabledReason={!llmEnabled ? 'Refinement requires an Anthropic API key.' : undefined}
/>
```

Update `RefinementPanel` to render the reason when `disabledReason` is set:

```jsx
// RefinementPanel.jsx
export function RefinementPanel({ onSubmit, disabled, disabledReason }) {
  // ...
  return (
    <div className="refinement-panel">
      <p className="refinement-panel__label">Refine your project</p>
      {disabledReason
        ? <p className="refinement-panel__disabled-reason">{disabledReason}</p>
        : (
          <div className="refinement-panel__row">
            {/* input + button — unchanged */}
          </div>
        )
      }
    </div>
  );
}
```

When `disabledReason` is set, the input row is replaced by the reason text entirely — not a greyed-out input with a tooltip. This is clearer: the user understands immediately why the feature is absent, rather than wondering why the input is disabled.

### Updated: `streamRefine.js` — handle 503 `llm_unavailable`

```js
if (response.status === 503) {
  const { error, message } = await response.json();
  if (error === 'llm_unavailable') {
    callbacks.onError?.('Refinement is not available in bypass mode.');
    return;
  }
}
```

This is a defensive guard — the refinement panel is hidden in bypass mode so this path should not be reachable in normal use.

### CSS additions

```css
/* Bypass mode banner */
.banner {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
  line-height: 1.5;
}

.banner--warning {
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-bg-surface));
  border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
  color: var(--color-text);
}

/* Raw template badge */
.badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  vertical-align: middle;
}

.badge--neutral {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

/* Refinement panel disabled reason */
.refinement-panel__disabled-reason {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
  padding: 0.5rem 0;
}
```

---

## §06 · LLM / Prompts

> Unchanged — see ITER_07.md §06