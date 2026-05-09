---
artifact: ITER_18
status: ready
created: 2026-05-08
scope: Visual refinement history panel — snapshot fileTree at each done event (generation + each refinement), render a timeline UI, allow revert to any prior snapshot
sections_changed: [02, 05]
sections_unchanged: [01, 03, 04, 06]
---

# Fullstack Template Generator — Iteration 18

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

### Snapshot model

A snapshot is an immutable record captured every time a `done` SSE event resolves — once on initial generation, once per successful refinement turn.

```
Snapshot {
  id:        number          // monotonic index, 0 = initial generation
  label:     string          // 'Generated' | 'Refinement 1' | 'Refinement 2' ...
  fileTree:  FileEntry[]     // deep copy of fileTree at the moment of done
  timestamp: number          // Date.now()
}
```

Snapshots live in `PreviewPage` state as an array. The active `fileTree` is always derived from the active snapshot — reverting is just changing which snapshot is active.

### State shape additions

```
snapshots:       Snapshot[]   // append-only; index 0 = generation
activeSnapshot:  number       // index into snapshots; default = latest
```

`fileTree` is no longer independent state — it is computed:

```js
const fileTree = snapshots[activeSnapshot]?.fileTree ?? [];
```

**Interaction with ITER_17 file editor:** `handleEdit` in ITER_17 called `setFileTree(prev => prev.map(...))`. Since `fileTree` is now derived, there is no `setFileTree`. Instead, edits must update the snapshot in-place:

```js
function handleEdit(newContent) {
  setSnapshots(prev =>
    prev.map((snap, i) =>
      i === activeSnapshot
        ? { ...snap, fileTree: snap.fileTree.map(f => f.path === activeFilePath ? { ...f, content: newContent } : f) }
        : snap
    )
  );
}
```

This mutates only the active snapshot's fileTree copy. Reverting to a different snapshot discards any unsaved edits to the current snapshot — this is acceptable behaviour at this stage (no conflict resolution needed).

### Revert flow

```
user clicks snapshot N in history panel
  → setActiveSnapshot(N)
  → fileTree derived from snapshots[N].fileTree
  → editor panel (ITER_17) reflects reverted content
  → refinement panel remains active — user can refine from the reverted state

user submits refinement from reverted state
  → /api/refine called with snapshots[N].fileTree as context
  → on done: new snapshot appended at snapshots.length
  → activeSnapshot set to new snapshot
  → history forks — snapshots after N are NOT discarded (append-only)
```

Append-only history means no data loss — reverting and re-refining creates a branch, visible in the timeline. This avoids the complexity of tree-shaped history while still being honest about what happened.

---

## §03 · Tech Stack

> Unchanged — see ITER_16.md §03

---

## §04 · Backend

> Unchanged — see ITER_15.md §04

---

## §05 · Frontend

### New component: `RefinementHistory`

```
client/src/components/RefinementHistory.jsx

props:
  snapshots:       Snapshot[]
  activeSnapshot:  number
  onRevert:        (index: number) => void

renders:
  - vertical list of snapshot entries
  - each entry: label + relative timestamp ("just now", "2 min ago")
  - active snapshot highlighted
  - each entry is a button; clicking calls onRevert(index)
  - latest snapshot labelled "Current" if activeSnapshot === snapshots.length - 1
```

Placed in `PreviewPage` below the refinement panel input, visible once at least two snapshots exist (i.e. at least one refinement has been made). Hidden during initial generation.

### Snapshot capture points

Two places in `PreviewPage` where snapshots are appended:

1. **On generation `done`** — first snapshot, label `'Generated'`, `id: 0`
2. **On refinement `done`** — subsequent snapshots, label `'Refinement N'` where N is `snapshots.length`

Each capture must deep-copy the fileTree array:

```js
// Use functional updater to avoid stale closure on snapshots.length
setSnapshots(prev => {
  const newSnapshot = {
    id: prev.length,
    label: prev.length === 0 ? 'Generated' : `Refinement ${prev.length}`,
    fileTree: fileTree.map(f => ({ ...f })),   // shallow copy per entry is sufficient — content is a string
    timestamp: Date.now(),
  };
  return [...prev, newSnapshot];
});
// setActiveSnapshot must read the new length — derive from a local count or use a separate effect
setActiveSnapshot(prev => prev + 1);   // not applicable on first snapshot; see note below
```

**Note on first snapshot:** On generation `done`, `snapshots` is empty so `activeSnapshot` should be set to `0` directly. On all subsequent `done` events (refinements), use `setSnapshots` functional updater as above and set `activeSnapshot` to the new array length minus one. This avoids the stale-closure problem where `snapshots.length` captured in the render closure is one behind after `setSnapshots` has been called.

### Revert handler

```js
function handleRevert(index) {
  setActiveSnapshot(index);
  // fileTree is derived — no explicit set needed
}
```

### Relative timestamp helper

Small pure utility `client/src/lib/relativeTime.js`:

```js
export function relativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  return `${Math.floor(diff / 3_600_000)} hr ago`;
}
```

### Tests

New test file: `client/src/components/RefinementHistory.test.jsx`

Cover:
- hidden when fewer than 2 snapshots
- renders one entry per snapshot
- active snapshot is highlighted
- clicking a snapshot entry calls onRevert with correct index
- relative timestamp renders correctly for recent vs older entries

New test file: `client/src/lib/relativeTime.test.js`

Cover:
- sub-minute → 'just now'
- 5 minutes → '5 min ago'
- 2 hours → '2 hr ago'

Update `PreviewPage.test.jsx`:
- snapshot appended after generation done
- snapshot appended after refinement done
- reverting to snapshot 0 restores original fileTree
- reverting then refining appends a new snapshot (does not truncate history)

---

## §06 · LLM / Prompts

> Unchanged — see ITER_07.md §06