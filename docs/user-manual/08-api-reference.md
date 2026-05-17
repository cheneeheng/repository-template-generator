# API Reference

Base URL: `http://localhost:3000` (development) or `https://yourdomain.com` (production).

All request and response bodies are JSON unless noted.

---

## Health

### `GET /api/health`

Liveness and dependency check. Used by Docker Compose health checks.

**Response `200`**

```json
{
  "ok": true,
  "checks": {
    "templatesDir": "ok",
    "templateCount": 22,
    "anthropicKey": "configured"
  }
}
```

`anthropicKey` is `"missing"` when `ANTHROPIC_API_KEY` is absent (bypass mode). `templatesDir` is `"error: directory not accessible"` when the templates directory cannot be read. The status code is `503` when either the templates directory is inaccessible or `ANTHROPIC_API_KEY` is not set.

---

## Templates

### `GET /api/templates`

List all available templates. Templates are re-scanned from disk on every call.

**Response `200`**

```json
[
  {
    "id": "fastapi-postgres",
    "label": "FastAPI + PostgreSQL",
    "description": "Python async REST API with FastAPI ...",
    "tags": ["python", "fastapi", "postgres", "docker"]
  }
]
```

---

## Generation

### `POST /api/generate`

Stream a customised template via Claude. Response is Server-Sent Events (`text/event-stream`).

**Request body**

```json
{
  "templateId": "fastapi-postgres",
  "projectName": "my-api",
  "description": "A REST API for managing book inventory with JWT auth"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `templateId` | string | Yes | ID of the template to use (see `GET /api/templates`). |
| `projectName` | string | Yes | Replaces `{{PROJECT_NAME}}` placeholders. |
| `description` | string | Yes | Plain-language description of the project. |

**SSE event types**

| Event | Data | Description |
|-------|------|-------------|
| `delta` | `{ "file": "path/to/file.py", "chunk": "..." }` | Incremental text chunk for a file. |
| `file_done` | `{ "file": "path/to/file.py", "content": "..." }` | Complete content of a file. |
| `done` | `{}` | All files have been sent. |
| `error` | `{ "message": "..." }` | An error occurred; stream ends. |

**Rate limit**: 10 requests per IP per 15-minute window (configurable via `RATE_LIMIT_GENERATE_MAX`).

---

## Refinement

### `POST /api/refine`

Stream incremental refinements to a previously generated template. Uses conversation history for multi-turn context. Response is Server-Sent Events (`text/event-stream`).

**Request body**

```json
{
  "templateId": "fastapi-postgres",
  "projectName": "my-api",
  "files": {
    "src/main.py": "...",
    "src/models.py": "..."
  },
  "history": [
    { "role": "user", "content": "Add JWT authentication" },
    { "role": "assistant", "content": "..." }
  ],
  "instruction": "Also add a refresh token endpoint"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `templateId` | string | Yes | ID of the original template. |
| `projectName` | string | Yes | Project name (for context). |
| `files` | object | Yes | Map of `filePath → content` for the current state of all files. |
| `history` | array | Yes | Previous turns as `{ role, content }` pairs. |
| `instruction` | string | Yes | The follow-up instruction for this refinement turn. |

SSE event types are identical to `/api/generate`. Only files that changed are returned; unchanged files are omitted.

**Returns `503`** when the server is in bypass mode (no `ANTHROPIC_API_KEY`).

**Rate limit**: 30 requests per IP per 15-minute window (configurable via `RATE_LIMIT_REFINE_MAX`).

---

## Export

### `POST /api/export/zip`

Download all generated files as a ZIP archive.

**Request body**

```json
{
  "projectName": "my-api",
  "files": {
    "src/main.py": "...",
    "README.md": "..."
  }
}
```

**Response `200`**

`Content-Type: application/zip`

Binary ZIP file. The archive root matches the `projectName`.

---

### `POST /api/export/repo`

Create a GitHub or GitLab repository and push the generated files.

**Request body**

```json
{
  "provider": "github",
  "token": "<oauth-token>",
  "repoName": "my-api",
  "private": false,
  "projectName": "my-api",
  "files": {
    "src/main.py": "...",
    "README.md": "..."
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | `"github"` \| `"gitlab"` | Yes | Target provider. |
| `token` | string | Yes | OAuth access token from the auth flow. |
| `repoName` | string | Yes | Name for the new repository. |
| `private` | boolean | No | `true` for a private repo. Defaults to `false`. |
| `projectName` | string | Yes | Used as the commit message prefix. |
| `files` | object | Yes | Map of `filePath → content`. |

**Response `200`**

```json
{
  "url": "https://github.com/username/my-api"
}
```

---

## Auth

### `GET /api/auth/providers`

Returns which OAuth providers are configured on this server.

**Response `200`**

```json
{ "github": true, "gitlab": false }
```

---

### `GET /api/auth/:provider/start`

Redirect the browser to the provider's OAuth consent screen. `:provider` is `github` or `gitlab`.

**Query parameters**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `redirect` | No | URL to return to after OAuth completes. |

This endpoint returns a `302` redirect — open it in the browser, not via `fetch`.

---

### `GET /api/auth/:provider/callback`

Handle the OAuth callback from the provider. After exchanging the code for a token, redirects the browser back to the client with the token in the URL fragment.

This endpoint is called automatically by the provider — do not call it manually.

---

### `GET /api/auth/:provider/revoke`

Revoke the user's OAuth token. Best-effort: the server removes its copy of the token regardless of the provider's response.

**Query parameters**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `token` | Yes | The OAuth access token to revoke. |

**Response `200`**

```json
{ "ok": true }
```

---

## Error responses

All error responses follow this shape:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

| HTTP status | Meaning |
|-------------|---------|
| `400` | Invalid request (Zod validation failure) |
| `422` | Template too large (`MAX_TEMPLATE_CHARS` exceeded) |
| `429` | Rate limit exceeded |
| `503` | Server in bypass mode (no API key) or upstream unavailable |
| `500` | Unexpected server error |
