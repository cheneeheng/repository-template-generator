---
artifact: SKELETON
status: ready
created: 2026-04-27
app: Fullstack Template Generator
stack: Node.js, Express, React, Claude API
sections: [01, 02, 03, 04, 05, 06]
---

# Fullstack Template Generator — Skeleton

---

## §01 · Concept

A web app that produces production-ready fullstack project scaffolds. The user selects from a library of curated templates (frontend + backend + deployment combinations), provides a project name and short description, and the app assembles the template files then passes them through an LLM to apply light customisation (rename placeholders, generate a project-specific README, wire project name into configs). Output is delivered as a downloadable ZIP and/or pushed to a new GitHub or GitLab repository. The app is fully stateless — no database. Templates are loaded at runtime from a folder on disk, either the default `templates/` folder in the repo or a custom path configured via environment variable. The primary flow: pick template → describe project → preview customised files → download ZIP or create repo.

---

## §02 · Architecture

```
Browser (React)
    │
    ▼
Express API (Node.js)
    │
    ├── GET  /api/templates          ← scan templates dir, return metadata
    ├── POST /api/generate           ← assemble + LLM-customise → return file tree
    ├── POST /api/export/zip         ← stream ZIP from file tree
    └── POST /api/export/repo        ← push file tree to GitHub/GitLab
    │
    ├── Claude API                   ← LLM customisation pass
    └── GitHub REST API / GitLab API ← repo creation & file push

templates/                           ← default template library (top-level in repo)
    react-express-postgres/
    ├── frontend/
    ├── backend/
    └── deploy/
    ... (more templates)
```

**No database.** All state lives in the browser between steps. The server is stateless — every request is self-contained.

**Template discovery:** On startup (and on each `GET /api/templates` call), the server scans the configured templates directory and reads each template's `template.json` manifest for metadata. No hardcoded list.

**API surface:**

| Method | Path                  | Description                                               |
|--------|-----------------------|-----------------------------------------------------------|
| GET    | /api/health           | Health check                                              |
| GET    | /api/templates        | Scan templates dir, return metadata list                 |
| POST   | /api/generate         | Assemble template + run LLM pass → return file tree JSON |
| POST   | /api/export/zip       | Accept file tree, return ZIP stream                      |
| POST   | /api/export/repo      | Accept file tree + Git provider token, create repo       |

> **Deferred:** Auth/accounts, rate limiting, template contribution workflow.

---

## §03 · Tech Stack

- **Runtime:** Node.js 20
- **Backend framework:** Express 4
- **Frontend framework:** React 18 + Vite
- **LLM provider:** Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Key libraries:**
  - `@anthropic-ai/sdk` — Claude API client
  - `archiver` — ZIP generation
  - `@octokit/rest` — GitHub API client
  - `node-fetch` — GitLab API calls
  - `zod` — request validation
  - `react-syntax-highlighter` — file preview in UI

> **Deferred:** Version pinning, Docker/compose.

---

## §04 · Backend

**Directory structure:**

```
server/
├── index.js                    -- Express entry, middleware registration
├── routes/
│   ├── health.js
│   ├── templates.js            -- scans TEMPLATES_DIR, returns metadata
│   ├── generate.js
│   └── export.js               -- /zip and /repo sub-routes
├── services/
│   ├── llm.js                  -- Claude customisation pass
│   ├── assembler.js            -- reads template files from disk, preps for LLM
│   ├── zipper.js               -- wraps archiver
│   ├── github.js               -- octokit repo creation + file push
│   └── gitlab.js               -- GitLab REST repo creation + file push
├── prompts/
│   └── customise.js            -- system prompt for LLM customisation pass
└── .env.example

templates/                      -- top-level in repo (NOT inside server/)
├── react-express-postgres/
│   ├── template.json           -- manifest: id, label, tags, description
│   ├── frontend/
│   ├── backend/
│   └── deploy/                 -- Dockerfile, docker-compose, GH Actions workflow
└── ... (more templates)
```

**Template manifest (`template.json`):**

```json
{
  "id": "react-express-postgres",
  "label": "React + Express + PostgreSQL",
  "description": "...",
  "tags": ["react", "express", "postgres", "docker", "gh-actions"]
}
```

**Templates directory resolution (in `assembler.js`):**

```js
const TEMPLATES_DIR = process.env.TEMPLATES_DIR
  ?? path.resolve(__dirname, '../../templates');
```

This means the app works out of the box with the repo's own `templates/` folder, but any operator can point `TEMPLATES_DIR` at an external path — a separate cloned repo, a mounted volume, or a local folder of custom templates.

**Middleware order (register in this sequence):**

```js
app.use(cors())           // 1. CORS — must be first
app.use(express.json())   // 2. Body parsing
// routes follow
```

**Representative stub — `routes/generate.js`:**

```js
router.post('/', async (req, res) => {
  const { templateId, projectName, description } = req.body; // zod-validated
  const baseFiles = await assembler.load(templateId);        // reads from TEMPLATES_DIR
  const customised = await llm.customise(baseFiles, projectName, description);
  res.json({ fileTree: customised });                        // stateless — no DB save
});
```

**Local run:**

```bash
cd server && npm install && npm run dev
```

**Environment variables:**

```
ANTHROPIC_API_KEY
PORT
TEMPLATES_DIR        # optional — defaults to ../../templates relative to server/
```

> **Deferred:** Error handling middleware, request logging, file-size guard on oversized templates.

---

## §05 · Frontend

**Pages / routes:**

| Route        | Screen                                                       |
|--------------|--------------------------------------------------------------|
| `/`          | Template picker — browse/filter curated templates            |
| `/configure` | Project config — name, description, Git provider choice      |
| `/preview`   | File tree preview with per-file syntax-highlighted content   |
| `/export`    | Export panel — ZIP download button + repo creation form      |

**State strategy:** Since the server is stateless, the generated file tree is held in React state (or a lightweight store like Zustand) and passed between pages client-side. No session IDs, no polling.

**Component tree (top-level):**

```
App
├── TemplatePickerPage
│   ├── TemplateGrid          -- cards per template, filterable by tag
│   └── TemplateCard
├── ConfigurePage
│   ├── ProjectNameInput
│   ├── DescriptionInput
│   └── ProviderPicker        -- GitHub / GitLab / ZIP only
├── PreviewPage
│   ├── FileTree              -- collapsible file list
│   └── FileViewer            -- syntax-highlighted content
└── ExportPage
    ├── DownloadZipButton
    └── RepoCreationForm      -- token input + org/namespace + submit
```

**Local run:**

```bash
cd client && npm install && npm run dev
```

**Placeholder data strategy:** `TemplatePickerPage` and `PreviewPage` render with hardcoded fixture data when the API is unreachable, so the UI is fully reviewable without a live backend.

> **Deferred:** Loading/streaming state during LLM pass, error toasts, responsive layout, OAuth flow (repo creation uses a manually entered token in skeleton).

---

## §06 · LLM / Prompts

**Purpose:** Apply light customisation to a curated template's files — replace placeholder project names, generate a project-specific README, and insert the description into relevant config fields. The LLM does *not* generate the file structure; it only edits content within the existing files.

**Model:** `claude-sonnet-4-20250514` via Anthropic SDK.

**System prompt (`prompts/customise.js`):**

```
You are a project scaffold customiser. You will receive a JSON array of template files
in the format [{path, content}] along with a project name and description.

Your job:
1. Replace all occurrences of the placeholder "{{PROJECT_NAME}}" with the actual project name.
2. Rewrite README.md to describe the actual project using the provided description.
3. Insert the project name and description into package.json, pyproject.toml, or equivalent where present.
4. Make no other changes.

Respond ONLY with the updated JSON array. No prose, no markdown fences.
```

**Input shape:**

```json
{
  "projectName": "my-todo-app",
  "description": "A todo app with auth and real-time updates",
  "files": [{ "path": "README.md", "content": "# {{PROJECT_NAME}}\n..." }]
}
```

**Output shape:** Same `[{path, content}]` array with customisations applied.

> **Token budget:** Pass `max_tokens: 8192`. Add a file-size guard in `assembler.js` (deferred) to reject templates that would exceed the context window before calling the API.
>
> **Deferred:** Streaming the LLM pass to the frontend, multi-turn refinement, prompt versioning.