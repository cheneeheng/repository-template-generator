---
artifact: ITER_20
status: ready
created: 2026-05-08
scope: Workspace page — localStorage-backed list of past generations, each entry re-openable as a full working session; auto-save on generation done and refinement done
sections_changed: [02, 03, 05]
sections_unchanged: [01, 04, 06]
---

# Fullstack Template Generator — Iteration 20

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

### Workspace model

Workspace is a list of `WorkspaceEntry` records persisted in `localStorage`. Each entry is a snapshot of a completed generation session.

```
WorkspaceEntry {
  id:           string        // crypto.randomUUID() — client-side
  projectName:  string
  templateId:   string
  fileTree:     FileEntry[]   // latest fileTree at time of save
  snapshots:    Snapshot[]    // full refinement history (from ITER_18)
  savedAt:      number        // Date.now()
}
```

**Storage key:** `ftg:workspace` — a JSON-serialised `WorkspaceEntry[]`.

**Size constraint:** localStorage is capped at ~5MB per origin. A typical generated project is a few KB of text. Conservative limit: 20 entries max. On save, if the list exceeds 20, the oldest entry is dropped.

**No TTL** — workspace entries persist until the user explicitly deletes them or clears browser storage. This is intentional — unlike share links, the workspace is the user's own history.

### Auto-save points

Workspace saves happen automatically — no explicit "Save" button needed:

1. **On generation `done`** — creates a new `WorkspaceEntry` and upserts it into the list
2. **On refinement `done`** — updates the existing entry for the current session (matched by `id` stored in session state)

The `id` is generated once when the generation starts and kept in `PreviewPage` state for the session lifetime.

### New route

```
/workspace   → WorkspacePage
```

Accessible from a nav link added to the app header.

---

## §03 · Tech Stack

New client utility: `client/src/lib/workspace.js` — thin wrapper around `localStorage` with JSON parse/serialise and the 20-entry cap. No new npm dependencies.

> Otherwise unchanged — see ITER_16.md §03

---

## §04 · Backend

> Unchanged — see ITER_15.md §04

---

## §05 · Frontend

### New utility: `client/src/lib/workspace.js`

```js
const KEY = 'ftg:workspace';
const MAX_ENTRIES = 20;

export function loadWorkspace() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveEntry(entry) {
  const list = loadWorkspace().filter(e => e.id !== entry.id); // remove existing if update
  const updated = [entry, ...list].slice(0, MAX_ENTRIES);      // prepend, cap at 20
  localStorage.setItem(KEY, JSON.stringify(updated));
}

export function deleteEntry(id) {
  const list = loadWorkspace().filter(e => e.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
}
```

### New page: `WorkspacePage`

```
client/src/pages/WorkspacePage.jsx
route: /workspace
```

Layout:
```
┌─────────────────────────────────────┐
│  Your projects                      │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ my-app                        │  │
│  │ react-starter · 3 files       │  │
│  │ Saved 2 hr ago        [Open] [Delete] │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ api-service                   │  │
│  │ express-starter · 5 files     │  │
│  │ Saved yesterday    [Open] [Delete] │
│  └───────────────────────────────┘  │
│                                     │
│  (empty state: "No saved projects   │
│   yet. Generate one to get started")│
└─────────────────────────────────────┘
```

**Open** — navigates to `/preview` with the entry's `{ fileTree, snapshots, projectName, templateId, workspaceId: entry.id, fromWorkspace: true }` via router state.

**Delete** — removes the entry from localStorage and re-renders the list.

`WorkspacePage` imports `relativeTime` from `client/src/lib/relativeTime.js` (introduced in ITER_18) for the "Saved N min ago" display.

### `PreviewPage` — `fromWorkspace` mode

When `routerState.fromWorkspace === true`:
- Same as `fromShare` (ITER_19): skip generate call, initialise from router state
- Restore full `snapshots` array from `routerState.snapshots` (history intact)
- Set `workspaceId` in state to `routerState.workspaceId` — so subsequent refinements continue updating the same workspace entry rather than creating a new one
- Active snapshot: `snapshots.length - 1` (most recent)

### Auto-save integration in `PreviewPage`

```js
// On generation done:
const entryId = crypto.randomUUID();
setWorkspaceId(entryId);
saveEntry({
  id: entryId,
  projectName,
  templateId,
  fileTree: doneFileTree,
  snapshots: [initialSnapshot],
  savedAt: Date.now(),
});

// On refinement done:
saveEntry({
  id: workspaceId,        // existing id
  projectName,
  templateId,
  fileTree: latestFileTree,
  snapshots,              // full updated history
  savedAt: Date.now(),
});
```

### Nav link

Add "Workspace" link to the app header/nav bar alongside any existing nav items. Shows the count of saved entries as a badge if > 0: `Workspace (3)`.

The badge count is read from `loadWorkspace().length` on each render of the nav component. Since `loadWorkspace` reads `localStorage` synchronously, this is fast enough — no subscription needed. The count updates naturally whenever the nav re-renders (e.g. after navigation).

### `fromShare` sessions and workspace

When a user opens a shared link (`fromShare: true`) and then refines the result, those refinements should auto-save to workspace — the session is real work regardless of origin. The auto-save logic in `PreviewPage` already handles this: `workspaceId` is generated fresh for every session, including `fromShare` sessions. No special case needed.

### Tests

New test file: `client/src/lib/workspace.test.js`

Cover:
- `loadWorkspace` returns empty array when localStorage is empty
- `loadWorkspace` returns empty array on corrupt JSON (no throw)
- `saveEntry` persists entry and loads it back
- `saveEntry` updates existing entry by id (no duplicate)
- `saveEntry` drops oldest entry when list exceeds 20
- `deleteEntry` removes entry by id

New test file: `client/src/pages/WorkspacePage.test.jsx`

Cover:
- shows empty state when no entries
- renders entry list with project name, template, file count, relative time
- Open button navigates to /preview with correct router state
- Delete button removes entry from the list

Update `PreviewPage.test.jsx`:
- auto-saves workspace entry on generation done
- auto-saves updated entry on refinement done
- fromWorkspace mode restores snapshots and skips generate call

---

## §06 · LLM / Prompts

> Unchanged — see ITER_07.md §06