---
artifact: ITER_11
status: ready
created: 2026-04-28
scope: Template manifest validation on startup (reject malformed templates with clear errors) + ZIP export polish (meaningful filename, Content-Disposition header) + CONTRIBUTING.md for template authors
sections_changed: [04, 05]
sections_unchanged: [01, 02, 03, 06]
---

# Fullstack Template Generator — Iteration 11

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

### Template manifest validation on startup

Currently, if a `template.json` is malformed (missing `id`, wrong field types, unknown keys), the server loads it silently and either serves broken data or crashes at generation time with a confusing error. Validation should fail loudly at startup so operators catch the problem before any user hits it.

**New: `services/templateValidator.js`**

Uses the already-present `zod` dependency — no new packages needed.

```js
import { z } from 'zod';
import createError from 'http-errors';

const templateManifestSchema = z.object({
  id: z.string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'id must be lowercase alphanumeric with hyphens only'),
  label: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(32)).min(1).max(10),
});

/**
 * Validates a parsed template.json object.
 * Returns { valid: true } or { valid: false, errors: string[] }
 */
export function validateManifest(raw, sourcePath) {
  const result = templateManifestSchema.safeParse(raw);
  if (result.success) return { valid: true };
  const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
  return { valid: false, errors };
}
```

**Apply in `routes/templates.js` — validate at scan time:**

```js
import { validateManifest } from '../services/templateValidator.js';

// In the scan loop:
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const validation = validateManifest(manifest, manifestPath);

if (!validation.valid) {
  // Log and skip — don't crash the server, don't serve the invalid template
  console.error(
    `[templates] Skipping invalid template at ${templateDir}:\n` +
    validation.errors.map(e => `  • ${e}`).join('\n')
  );
  continue;
}
```

**Skip rather than crash:** Crashing on one bad template would take down all templates. Skipping with a logged error lets the operator fix it without downtime, and valid templates remain available.

**Startup validation run:** Call the template scan once during `index.js` startup (not just on `GET /api/templates`) so the errors appear in the log immediately:

```js
// index.js — after middleware registration, before listen()
import { scanTemplates } from './routes/templates.js';  // extract scan logic into a shared fn

const templates = await scanTemplates();
console.log(`[templates] Loaded ${templates.length} valid template(s)`);
if (templates.length === 0) {
  console.warn('[templates] WARNING: No valid templates found. Check TEMPLATES_DIR and template.json manifests.');
}
```

`scanTemplates` becomes a named export from `routes/templates.js` — the route handler calls it on each `GET /api/templates` request, and `index.js` also calls it once at startup. No duplication — same function.

### Updated: `routes/export.js` — ZIP filename and Content-Disposition

Currently the ZIP stream has no `Content-Disposition` header. The browser assigns a generated filename (e.g. `download.zip` or the pathname). Fix this so the downloaded file is named after the project.

**The `POST /api/export/zip` body already contains the file tree**, but not the project name. Add `projectName` to the request body:

```js
// Updated Zod schema for /api/export/zip
const zipSchema = z.object({
  fileTree: z.array(fileSchema).min(1).max(100),
  projectName: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/).optional(),
});
```

`projectName` is optional — if absent, fall back to `project`.

**Set the header before streaming:**

```js
router.post('/zip', async (req, res) => {
  const { fileTree, projectName } = zipSchema.parse(req.body);
  const filename = `${projectName ?? 'project'}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await zipper.stream(fileTree, res);
});
```

**No other changes to `zipper.js`** — it already streams the archive to `res`. The headers must be set before `zipper.stream` is called (before any bytes are written).

### New: `CONTRIBUTING.md` at repo root

Documents exactly what a valid template must contain. Written for external contributors but also useful as operator reference.

```markdown
# Contributing a Template

A template is a directory inside `templates/` containing:

## Required: `template.json`

A manifest file with these fields:

| Field         | Type             | Rules                                             |
|---------------|------------------|---------------------------------------------------|
| `id`          | string           | Lowercase, alphanumeric, hyphens only. Max 64 chars. Must be unique across all templates. |
| `label`       | string           | Human-readable name shown in the UI. Max 100 chars. |
| `description` | string           | One or two sentences. Max 500 chars.              |
| `tags`        | array of strings | 1–10 tags. Each tag max 32 chars.                 |

Example:
```json
{
  "id": "react-express-postgres",
  "label": "React + Express + PostgreSQL",
  "description": "A full-stack starter with a React frontend, Express API, and PostgreSQL database. Includes Docker Compose for local development.",
  "tags": ["react", "express", "postgres", "docker"]
}
```

## Required: at least one file alongside `template.json`

Template files can be in any subdirectory structure. Common layout:

```
my-template/
├── template.json
├── README.md          ← should contain {{PROJECT_NAME}} placeholder
├── frontend/
├── backend/
└── deploy/
```

## Placeholder

Use `{{PROJECT_NAME}}` anywhere in file content where the project name should appear. The LLM customisation pass will replace all occurrences.

## Validation

Run the server locally — invalid `template.json` files are logged at startup and skipped. Fix any reported errors before submitting.
```

> **Deferred:** A CLI validation script (`scripts/validate-templates.js`) that operators can run without starting the server — useful in CI pipelines. This is the natural follow-up once the validator logic is stable.

---

## §05 · Frontend

### Updated: `ExportPage` — pass `projectName` to ZIP request

The `fileTree` passed to `POST /api/export/zip` currently comes from `streamState.fileTree`. The project name is already available in state (set during `ConfigurePage`). Pass it in the request body:

```js
async function handleDownloadZip() {
  setZipLoading(true);
  const res = await fetch('/api/export/zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileTree: streamState.fileTree,
      projectName,               // from ConfigurePage state, passed as prop or from store
    }),
  });

  if (!res.ok) {
    setError('ZIP export failed');
    setZipLoading(false);
    return;
  }

  // Trigger browser download from the blob
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}.zip`;   // redundant with Content-Disposition but belt-and-suspenders
  a.click();
  URL.revokeObjectURL(url);
  setZipLoading(false);
}
```

**`URL.revokeObjectURL` after click** — releases the blob from memory. Without this, the blob URL persists in memory for the tab's lifetime. Call it after a brief timeout if the download doesn't trigger immediately:

```js
setTimeout(() => URL.revokeObjectURL(url), 10_000);
```

The `a.download` attribute on a programmatically created anchor sets the filename client-side. Combined with the server's `Content-Disposition` header, the filename is correctly set in all browsers.

> **No other frontend changes.** Template validation is entirely server-side. CONTRIBUTING.md is a repo document, not a UI feature.