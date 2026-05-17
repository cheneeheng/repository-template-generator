# Troubleshooting

---

## Server does not start

**Symptom:** `bun run dev` in `server/` exits immediately or prints an error.

**Check:**
1. `server/.env` exists. If not: `cp server/.env.example server/.env`.
2. `bun install` has been run in `server/`. Run it now if unsure.
3. Port `3000` is free. Check with `lsof -i :3000` and kill any process using it.

---

## `GET /api/health` returns `anthropicKey: "missing"` (503)

**Cause:** `ANTHROPIC_API_KEY` is not set in `server/.env`.

**Effect (bypass mode):** The health endpoint returns `503` with `ok: false`. Templates are still served but unmodified (no LLM customisation). `/api/refine` also returns `503`.

**Fix:** Set `ANTHROPIC_API_KEY=sk-ant-...` in `server/.env` and restart the server.

---

## `GET /api/health` returns `503` with `templatesDir: "error: directory not accessible"`

**Cause:** The templates directory is inaccessible.

**Fix:**
1. Confirm `TEMPLATES_DIR` in `server/.env` points to an existing directory.
2. If unset, the default is `../templates` relative to `server/`. Verify that `templates/` exists at the repo root.
3. In Docker: check that the volume mount for templates is correct and the container has read permission.

---

## Template generation returns `422`

**Cause:** The selected template exceeds `MAX_TEMPLATE_CHARS` (default 200 000 characters).

**Fix:** Increase `MAX_TEMPLATE_CHARS` in `server/.env`, or reduce the size of the template source files.

---

## Rate limit error (`429`)

**Cause:** You have exceeded the request quota for the current 15-minute window.

**Default limits:**
- `/api/generate`: 10 requests per IP per 15 minutes
- `/api/refine`: 30 requests per IP per 15 minutes

**Fix (development):** Increase `RATE_LIMIT_GENERATE_MAX` and/or `RATE_LIMIT_REFINE_MAX` in `server/.env`, or set `RATE_LIMIT_WINDOW_MS=60000` to shorten the window.

---

## OAuth provider does not appear in the UI

**Cause:** The provider's `CLIENT_ID` variable is not set (or empty) in `server/.env`.

**Verify:**

```bash
curl http://localhost:3000/api/auth/providers
# Expected: { "github": true, "gitlab": true }
```

**Fix:** Set the appropriate variables (see [OAuth Setup](./07-oauth-setup.md)) and restart the server.

---

## OAuth callback fails with "redirect_uri_mismatch"

**Cause:** The `GITHUB_REDIRECT_URI` or `GITLAB_REDIRECT_URI` in `server/.env` does not exactly match the callback URL registered in the provider's app settings.

**Fix:** Ensure both values are identical (scheme, host, port, path). In production, update both `server/.env` and the provider's app settings to use your production domain.

---

## GitHub repo creation fails

**Common causes:**

| Error | Fix |
|-------|-----|
| `401 Unauthorized` | Token expired. Log out and re-authorise in the UI. |
| `422 Unprocessable Entity` | Repository name already exists or contains invalid characters. |
| `403 Forbidden` | The OAuth scope does not include `repo`. Re-register the OAuth App with `repo` scope. |

---

## GitLab repo creation fails

**Common causes:**

| Error | Fix |
|-------|-----|
| `401 Unauthorized` | Token expired. Re-authorise. |
| `400 Bad Request` | Repository name contains spaces or special characters not allowed by GitLab. |
| Self-hosted instance | Ensure `GITLAB_BASE_URL` is set to your instance URL, not `https://gitlab.com`. |

---

## Docker Compose: containers restart in a loop

**Check server logs:**

```bash
docker compose -f deployment/docker-compose.yml logs server
```

Most loop restarts are caused by a missing or malformed `server/.env`. Verify `ANTHROPIC_API_KEY` is present.

---

## Client shows a blank page or network errors

**Check:**
1. The server is running and reachable at `http://localhost:3000`.
2. `curl http://localhost:3000/api/health` succeeds.
3. In Docker, the client nginx config proxies `/api` to `server:3000`. If you changed the server port, update `client/nginx.conf` accordingly.

---

## Refinement history is truncated

**Expected behaviour.** When the total conversation history exceeds `MAX_HISTORY_CHARS` (default 600 000 characters), the oldest turns are dropped automatically to stay within the budget. The most recent turns are always preserved.

To keep more history, increase `MAX_HISTORY_CHARS` in `server/.env`.

---

## Workspace sessions missing after browser update

Sessions are stored in the browser's IndexedDB under the origin `http://localhost:5173`. Clearing browser data, switching browsers, or accessing the app from a different origin removes them. Download a ZIP of important work before clearing browser storage.

---

## Getting help

- Open an issue at the repository: `https://github.com/cheneeheng/repository-template-generator/issues`
