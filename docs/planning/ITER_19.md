---
artifact: ITER_19
status: ready
created: 2026-05-08
scope: Shareable links — snapshot the active fileTree under a short random ID, recipient visits the link and gets a full working copy loaded as a new session they can refine and export
sections_changed: [02, 03, 04, 05]
sections_unchanged: [01, 06]
---

# Fullstack Template Generator — Iteration 19

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

### New API routes

```
POST /api/share
  body:    { fileTree: FileEntry[], projectName: string, templateId: string }
  returns: { id: string }              // short random ID, e.g. "a3f9bc"
  effect:  stores snapshot in server-side Map with TTL

GET  /api/share/:id
  returns: { fileTree: FileEntry[], projectName: string, templateId: string }
           | 404 { error: 'not_found' }
           | 410 { error: 'expired' }
```

### Server-side store

In-memory `Map` with TTL — no new dependencies. Each entry stores:

```
{
  fileTree:    FileEntry[]
  projectName: string
  templateId:  string
  expiresAt:   number      // Date.now() + TTL_MS
}
```

TTL: **24 hours** (`TTL_MS = 24 * 60 * 60 * 1000`). Expiry is checked on `GET` — no background sweep needed at this scale.

ID generation: `crypto.randomBytes(4).toString('hex')` — 8 hex chars, unguessable, not sequential.

**Deferred:** Redis-backed persistence (survives restarts, multi-instance). Noted explicitly for when Redis backing is added.

### Client flow

**Sharing side (PreviewPage / ExportPage):**
```
user clicks "Share"
  → POST /api/share with active fileTree + projectName + templateId
  → receives { id }
  → constructs URL: window.location.origin + '/share/' + id
  → copies URL to clipboard (navigator.clipboard.writeText)
  → shows inline confirmation: "Link copied!"
```

**Receiving side (new SharePage at `/share/:id`):**
```
SharePage mounts
  → GET /api/share/:id
  → on success: loads fileTree into session state, navigates to PreviewPage
    passing { fileTree, projectName, templateId, fromShare: true } via router state
  → on 404/410: shows "Link not found or expired" message with link back to home
```

`fromShare: true` flag tells `PreviewPage` to skip the generate call and go straight to the done state — rendering the file tree immediately. The refinement panel is active from the start.

### Route addition

```
GET /share/:id   → SharePage (React route, client-side)
```

Server must also serve the SPA for this path (already handled by the catch-all static handler).

---

## §03 · Tech Stack

No new dependencies. `crypto` is a Node built-in.

> Otherwise unchanged — see ITER_16.md §03

---

## §04 · Backend

### New module: `server/store/shareStore.js`

```js
const store = new Map();
const TTL_MS = 24 * 60 * 60 * 1000;

export function saveShare(id, payload) {
  store.set(id, { ...payload, expiresAt: Date.now() + TTL_MS });
}

export function getShare(id) {
  const entry = store.get(id);
  if (!entry) return { status: 'not_found' };
  if (Date.now() > entry.expiresAt) {
    store.delete(id);
    return { status: 'expired' };
  }
  const { expiresAt, ...data } = entry;
  return { status: 'ok', data };
}
```

### New route file: `server/routes/share.js`

```js
import { Router } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { saveShare, getShare } from '../store/shareStore.js';

const shareSchema = z.object({
  fileTree:    z.array(z.object({ path: z.string().min(1), content: z.string() })).min(1).max(100),
  projectName: z.string().min(1).max(100),
  templateId:  z.string().min(1),
});

const router = Router();

router.post('/', (req, res) => {
  const { fileTree, projectName, templateId } = shareSchema.parse(req.body);
  const id = randomBytes(4).toString('hex');
  saveShare(id, { fileTree, projectName, templateId });
  res.json({ id });
});

router.get('/:id', (req, res) => {
  const result = getShare(req.params.id);
  if (result.status === 'not_found') return res.status(404).json({ error: 'not_found' });
  if (result.status === 'expired') return res.status(410).json({ error: 'expired' });
  res.json(result.data);
});

export default router;
```

Mounted in `server/app.js` (alongside existing routes from ITER_15):

```js
import shareRouter from './routes/share.js';
// ...
app.use('/api/share', shareRouter);
```

Register before `errorHandler` — Zod validation errors from `shareSchema.parse` are caught by the existing `errorHandler` middleware which already handles `ZodError` (ITER_08).

**Gotcha — implicit resource creation race:** two concurrent POSTs with the same payload will generate two separate IDs — this is correct behaviour. No deduplication needed.

### Tests

New test file: `server/routes/share.test.js`

Cover:
- POST returns an 8-char hex id
- GET retrieves the stored payload
- GET returns 404 for unknown id
- GET returns 410 for expired entry (mock `Date.now` to advance past TTL)
- POST returns 400 for missing fields

---

## §05 · Frontend

### New page: `SharePage`

```
client/src/pages/SharePage.jsx
route: /share/:id
```

Behaviour:
- On mount: `GET /api/share/:id`
- Loading state: spinner with "Loading shared project…"
- On success: navigate to `/preview` with `{ fileTree, projectName, templateId, fromShare: true }`
- On 404: "This link was not found." + "Start a new project" button → `/`
- On 410: "This link has expired (links last 24 hours)." + "Start a new project" button → `/`

### `PreviewPage` — `fromShare` mode

When `routerState.fromShare === true`:
- Skip the `POST /api/generate` call entirely
- Initialise `fileTree` — in ITER_18 this means initialising `snapshots` with a single snapshot labelled `'Shared'` from `routerState.fileTree`; `activeSnapshot` set to `0`
- Set `activeFilePath` to `null` (no file pre-selected — consistent with fresh generation done state)
- Set generation status to `done` immediately — refinement panel active from render

**Note on snapshots:** The share payload intentionally contains only the current `fileTree`, not the sharer's full refinement history. The recipient starts with a clean single-snapshot session. This is the correct behaviour — sharing history would expose all intermediate states and is not what the feature is for.

**Gotcha — StrictMode double-invocation:** the `fromShare` init path is a `useEffect`. Guard with `useRef(false)` to prevent double snapshot insertion in development (same pattern as generation `done` handler in ITER_18).

### Share button

Placed in `PreviewPage` (and `ExportPage`) after the done state is reached:

```jsx
<button onClick={handleShare} disabled={sharing}>
  {sharing ? 'Sharing…' : copied ? 'Link copied!' : 'Share'}
</button>
```

`handleShare`:
1. POST `/api/share`
2. Receive `{ id }`
3. `navigator.clipboard.writeText(origin + '/share/' + id)`
4. Set `copied = true`, reset after 3 seconds

### Tests

New test file: `client/src/pages/SharePage.test.jsx`

Cover:
- shows loading spinner on mount
- navigates to /preview with correct state on success
- shows not-found message on 404
- shows expired message on 410

Update `PreviewPage.test.jsx`:
- fromShare mode skips generate call and renders file tree immediately
- fromShare mode initialises with a 'Shared' snapshot
- share button copies link to clipboard
- share button shows "Link copied!" feedback

---

## §06 · LLM / Prompts

> Unchanged — see ITER_07.md §06