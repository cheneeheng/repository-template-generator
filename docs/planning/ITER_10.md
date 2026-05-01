---
artifact: ITER_10
status: ready
created: 2026-04-28
scope: Template browsability — users can preview a template's file structure before committing to generation; TemplateCard gains an expand/collapse file tree, no new route required
sections_changed: [04, 05]
sections_unchanged: [01, 02, 03, 06]
---

# Fullstack Template Generator — Iteration 10

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

### Updated: `GET /api/templates` response

The existing `/api/templates` route returns metadata only (`id`, `label`, `description`, `tags`). This iteration extends the response to include a flat list of file paths for each template, so the client can show the file structure without an additional request.

**Updated response shape:**

```json
[
  {
    "id": "react-express-postgres",
    "label": "React + Express + PostgreSQL",
    "description": "...",
    "tags": ["react", "express", "postgres"],
    "files": ["frontend/src/App.jsx", "backend/index.js", "deploy/Dockerfile", "README.md"]
  }
]
```

File *contents* are not included — only paths. This keeps the response lightweight (paths are short strings) while giving the user enough information to understand what a template contains.

No new route. The existing `GET /api/templates` is extended in place.

---

## §03 · Tech Stack

> Unchanged — see ITER_05.md §03

---

## §04 · Backend

### Updated: `routes/templates.js` — include file paths in response

When scanning the templates directory, after reading `template.json` for metadata, also enumerate the files within that template directory and include their relative paths in the response.

```js
import { readdir, stat } from 'fs/promises';
import path from 'path';

async function getFilePaths(templateDir) {
  const paths = [];

  async function walk(dir, base = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'template.json') continue; // exclude manifest
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), rel);
      } else {
        paths.push(rel);
      }
    }
  }

  await walk(templateDir);
  return paths.sort(); // alphabetical — consistent ordering
}
```

Integrate into the existing template scan loop:

```js
// In the loop that reads each template's template.json:
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const files = await getFilePaths(templateDir);
return { ...manifest, files };
```

**Performance:** File path enumeration is fast (directory reads, no file content reads). The templates directory is small by design. No caching needed at this stage — the route already runs on each request.

**`template.json` is excluded** from the `files` list — it is an internal manifest, not a project file the user would receive.

---

## §05 · Frontend

### Updated: `TemplateCard` — expandable file tree

Each `TemplateCard` gains a "Show files" toggle that reveals the template's file list inline. This answers the user's natural question before they commit: "what will I actually get?"

**Updated `TemplateCard` props:**

```jsx
// TemplateCard.jsx
export function TemplateCard({ template, onSelect }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="template-card">
      <div className="template-card__header">
        <h3>{template.label}</h3>
        <p>{template.description}</p>
        <div className="template-card__tags">
          {template.tags.map(t => <span key={t} className="tag">{t}</span>)}
        </div>
      </div>

      <div className="template-card__actions">
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          aria-controls={`files-${template.id}`}
        >
          {expanded ? 'Hide files' : `Show files (${template.files.length})`}
        </button>
        <button className="btn btn--primary btn--sm" onClick={() => onSelect(template)}>
          Use this template →
        </button>
      </div>

      {expanded && (
        <ul
          id={`files-${template.id}`}
          className="template-card__file-list"
          aria-label={`Files in ${template.label}`}
        >
          {template.files.map(f => (
            <li key={f} className="template-card__file-item">
              <FileIcon path={f} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**`FileIcon`** — a tiny component that returns a relevant emoji or SVG icon based on file extension. Keeps the file list visually scannable:

```jsx
function FileIcon({ path }) {
  const ext = path.split('.').pop();
  const icons = {
    js: '⬡', jsx: '⬡', ts: '⬡', tsx: '⬡',
    json: '{}',
    md: '📄',
    yml: '⚙', yaml: '⚙',
    dockerfile: '🐳', // matched by filename below
    css: '🎨',
    env: '🔑',
  };
  const name = path.split('/').pop().toLowerCase();
  if (name === 'dockerfile' || name.startsWith('dockerfile.')) return <span aria-hidden="true">🐳</span>;
  return <span aria-hidden="true">{icons[ext] ?? '📄'}</span>;
}
```

`aria-hidden="true"` on all icons — they are decorative; the file path text is the accessible content.

**CSS — file list inside card:**

```css
.template-card__file-list {
  list-style: none;
  padding: 0.5rem 0 0;
  margin: 0.5rem 0 0;
  border-top: 1px solid var(--color-border);
  max-height: 200px;
  overflow-y: auto;
}

.template-card__file-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0;
  font-size: 0.8rem;
  font-family: monospace;
  color: var(--color-text-muted);
}
```

`max-height: 200px` with `overflow-y: auto` prevents a template with many files from blowing out the card grid. The user can scroll within the list.

**Skeleton cards during loading** (from ITER_06) don't show a file list — the `files` field is absent until `GET /api/templates` resolves. No change needed to `SkeletonCard`.

**Only one card expanded at a time?** No — allow multiple. Forcing single-expansion adds complexity for no clear benefit; the user may want to compare two templates side by side.

### Updated: `TemplatePickerPage` — pass `files` through

`TemplatePickerPage` already stores the template list from the API in state and passes each template to `TemplateCard`. Since `files` is now part of the API response, it flows through automatically — no state changes needed.

The `selectedTemplate` stored in state (passed to `ConfigurePage`) should now include `files` so `PreviewPage` can display "N files" in the UI header. No structural change — the whole template object is already stored.

> **Deferred:** Full file content preview on hover/click within the card file list (would require a separate endpoint to fetch individual file content — the current approach intentionally omits content from the templates listing for payload size).