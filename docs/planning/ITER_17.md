---
artifact: ITER_17
status: ready
created: 2026-05-08
scope: Inline file editor in PreviewPage — click any file in the tree to open a textarea editor, edits update the in-memory fileTree, editor state is preserved across file switches
sections_changed: [02, 05]
sections_unchanged: [01, 03, 04, 06]
---

# Fullstack Template Generator — Iteration 17

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

### New client-side state

`PreviewPage` gains a split-pane layout: file tree on the left, editor panel on the right. The `fileTree` array already held in component state becomes the single source of truth — edits produce a new array via immutable replacement. No new API routes needed; the editor is entirely client-side.

**State shape (no change to existing shape, one addition):**

```
fileTree:        FileEntry[]   // existing — { path, content }
activeFilePath:  string|null   // new — which file is open in the editor
```

### Data flow

```
user clicks file in tree
  → setActiveFilePath(path)
  → editor panel renders textarea with fileTree.find(f => f.path === path)?.content

user edits textarea
  → onChange updates fileTree entry via immutable array replacement
  → file tree re-renders (content is live but no visible indicator needed yet)

user clicks Export
  → fileTree (with edits) passed to ExportPage via router state — unchanged
```

No backend changes. The edited `fileTree` flows into the existing ZIP / Git export unchanged because those already consume `fileTree` from router state.

---

## §03 · Tech Stack

> Unchanged — see ITER_16.md §03

---

## §04 · Backend

> Unchanged — see ITER_15.md §04

---

## §05 · Frontend

### Layout change: `PreviewPage`

Replace the current single-column file list with a two-column layout:

```
┌─────────────────┬──────────────────────────────────┐
│  File tree      │  Editor panel                    │
│  (left, ~30%)   │  (right, ~70%)                   │
│                 │                                  │
│  README.md   ←active│  <textarea>                  │
│  src/index.js   │  content of active file          │
│  package.json   │                                  │
└─────────────────┴──────────────────────────────────┘
```

- Left column: existing file tree list, each entry is now a button. Active file is highlighted with a CSS class (`is-active`).
- Right column: a single `<textarea>` whose `value` is `fileTree.find(f => f.path === activeFilePath)?.content ?? ''`.
- If no file is active (initial state), right column shows a prompt: "Select a file to edit".
- Textarea uses a monospace font, fills the panel height, no resize handle (CSS `resize: none`).

### New component: `FileEditor`

```
client/src/components/FileEditor.jsx

props:
  file: FileEntry | null    // { path, content }
  onChange: (newContent: string) => void

renders:
  - filename header bar showing file.path
  - <textarea> bound to file.content via value/onChange
  - null state: placeholder message if file is null
```

Extracting into its own component keeps `PreviewPage` manageable and makes the editor independently testable.

### State update pattern

Immutable array replacement to avoid mutating the `fileTree` ref that was passed in from generation:

```js
function handleEdit(newContent) {
  setFileTree(prev =>
    prev.map(f => f.path === activeFilePath ? { ...f, content: newContent } : f)
  );
}
```

**Gotcha — StrictMode double-invocation:** A `useEffect` that auto-selects the first file when `status` transitions to `done` will fire twice in development under React 18 StrictMode, causing two `setActiveFilePath` calls. Guard with a `useRef(false)` flag set on first invocation to prevent the double-fire. (See implementation-gotchas.md.)

### Tests

New test file: `client/src/components/FileEditor.test.jsx`

Cover:
- renders textarea with correct initial content
- onChange fires with updated content on user type
- renders placeholder when `file` is null

Update `PreviewPage.test.jsx`:
- clicking a filename opens its content in the editor panel
- active file highlight class applied to the clicked file entry
- editing textarea content updates the displayed content
- edited content is preserved when switching between files and returning

---

## §06 · LLM / Prompts

> Unchanged — see ITER_07.md §06