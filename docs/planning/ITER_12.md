---
artifact: ITER_12
status: ready
created: 2026-04-28
scope: Operational hardening — meaningful /api/health check, empty templates directory warning, structured startup logging, deployment guide (DEPLOYING.md), prefers-reduced-motion support, OS colour scheme change listener
sections_changed: [04, 05]
sections_unchanged: [01, 02, 03, 06]
---

# Fullstack Template Generator — Iteration 12

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

### Updated: `GET /api/health`

Previously a ping returning `{ ok: true }`. Now returns a structured readiness object:

```json
{
  "ok": true,
  "checks": {
    "templatesDir": "ok",
    "templateCount": 4,
    "anthropicKey": "configured"
  }
}
```

If any check fails, `ok` is `false` and the HTTP status is 503. This allows load balancers and container orchestrators to detect a misconfigured instance before it serves user traffic.

---

## §03 · Tech Stack

> Unchanged — see ITER_05.md §03

---

## §04 · Backend

### Updated: `routes/health.js` — meaningful readiness check

```js
import { scanTemplates } from './templates.js';
import { access } from 'fs/promises';

router.get('/', async (req, res) => {
  const checks = {};
  let healthy = true;

  // Check 1: templates directory is accessible
  const templatesDir = process.env.TEMPLATES_DIR
    ?? path.resolve(__dirname, '../../templates');
  try {
    await access(templatesDir);
    checks.templatesDir = 'ok';
  } catch {
    checks.templatesDir = 'error: directory not accessible';
    healthy = false;
  }

  // Check 2: at least one valid template loaded
  try {
    const templates = await scanTemplates();
    checks.templateCount = templates.length;
    if (templates.length === 0) {
      checks.templatesDir = 'warning: no valid templates found';
      // Not fatal — healthy stays true; operator is warned via log at startup
    }
  } catch {
    checks.templateCount = 0;
  }

  // Check 3: Anthropic API key is present (not validated — just configured)
  checks.anthropicKey = process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing';
  if (!process.env.ANTHROPIC_API_KEY) healthy = false;

  res.status(healthy ? 200 : 503).json({ ok: healthy, checks });
});
```

**Why not call the Anthropic API in the health check:** A live API call on every health probe is expensive, adds latency to the check, and would count against rate limits. Presence of the key is a sufficient proxy — if the key is wrong, the first generation will fail and that error is surfaced to the user with a proper message.

**503 on unhealthy:** Returning 503 when `ANTHROPIC_API_KEY` is missing means the instance is correctly reported as not ready. Useful in Docker healthcheck and Kubernetes liveness probes.

### Docker healthcheck directive — `docker-compose.yml`

Add to the `server` service in `docker-compose.yml`:

```yaml
services:
  server:
    # ... existing config ...
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

`wget` is available in the `node:20-alpine` base image without extra installation. `start_period: 10s` gives the server time to complete startup before the first check counts against `retries`.

The `client` service does not need a healthcheck — nginx either serves or doesn't; no application-level state to check.

### Structured startup logging

Replace ad-hoc `console.log` calls in `index.js` with a consistent startup summary block:

```js
// index.js — after listen() resolves
const templates = await scanTemplates();

console.log(`
┌─────────────────────────────────────────┐
│  Fullstack Template Generator — Server  │
├─────────────────────────────────────────┤
│  Port:        ${String(PORT).padEnd(26)}│
│  Templates:   ${String(templates.length + ' loaded').padEnd(26)}│
│  Templates dir: ${String(TEMPLATES_DIR).slice(0, 24).padEnd(24)}│
│  Claude key:  ${(process.env.ANTHROPIC_API_KEY ? 'configured' : 'MISSING ⚠').padEnd(26)}│
│  GitHub auth: ${(process.env.GITHUB_CLIENT_ID ? 'enabled' : 'disabled').padEnd(26)}│
│  GitLab auth: ${(process.env.GITLAB_CLIENT_ID ? 'enabled' : 'disabled').padEnd(26)}│
└─────────────────────────────────────────┘
`);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[startup] ERROR: ANTHROPIC_API_KEY is not set. Generation will fail.');
}
if (templates.length === 0) {
  console.warn('[startup] WARNING: No valid templates found. Check TEMPLATES_DIR.');
}
```

This surfaces misconfiguration immediately in the terminal on `npm run dev` — the operator sees the problem without making a request.

### New: `DEPLOYING.md` at repo root

A concise deployment guide covering the two primary scenarios — Docker Compose and manual Node. This is the last missing piece of documentation for a complete project.

```markdown
# Deploying

## Option A — Docker Compose (recommended)

1. Clone the repo.
2. Copy `server/.env.example` to `server/.env` and fill in your values.
3. Register OAuth apps on GitHub and/or GitLab (optional — see below).
4. Run:

   ```bash
   docker compose up --build -d
   ```

5. The app is available at `http://localhost:5173` (client) and `http://localhost:3000` (API).

**Adding your own templates:** Mount a directory containing your template folders:

```yaml
# docker-compose.yml override
services:
  server:
    environment:
      TEMPLATES_DIR: /my-templates
    volumes:
      - /path/to/your/templates:/my-templates:ro
```

## Option B — Manual (local dev)

Requirements: Node.js 20+

```bash
# Install root dev tools
npm install

# Start both services
npm run dev
```

Client runs on http://localhost:5173, server on http://localhost:3000.

## Required environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Your Anthropic API key |
| `PORT` | No (default: 3000) | Server port |
| `TEMPLATES_DIR` | No | Path to templates directory. Defaults to `templates/` in the repo root. |

## OAuth setup (optional)

Without OAuth, repo creation is unavailable. ZIP download still works.

**GitHub:**
1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
2. Set Authorization callback URL to `https://yourdomain.com/api/auth/github/callback`.
3. Copy Client ID and Client Secret into `server/.env`.

**GitLab:**
1. Go to GitLab → User Settings → Applications → Add new application.
2. Set Redirect URI to `https://yourdomain.com/api/auth/gitlab/callback`.
3. Select scope: `api`.
4. Copy Application ID (as `GITLAB_CLIENT_ID`) and Secret.

## Health check

`GET /api/health` returns `{ ok: true, checks: {...} }` when the server is ready.
Returns 503 if the Anthropic key is missing or the templates directory is inaccessible.
```

> **No further backend changes in this iteration.**

---

## §05 · Frontend

### `prefers-reduced-motion` support

Add to `client/src/index.css` immediately after the shimmer and spin keyframe definitions (ITER_06):

```css
@media (prefers-reduced-motion: reduce) {
  .shimmer,
  .spinner {
    animation: none;
  }
  .shimmer {
    background: var(--shimmer-base);
  }
}
```

Users who opt out of motion see a static grey placeholder instead of the animated sweep, and a static border ring instead of the spinning indicator. No JS changes.

### OS colour scheme change listener

Add inside `DarkModeToggle.jsx`, alongside the existing toggle logic (ITER_06):

```js
useEffect(() => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return; // user has an explicit preference — don't override it

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => {
    setDark(e.matches);
    applyTheme(e.matches);
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}, []);
```

The listener only fires when `localStorage` has no explicit preference. If the user toggled the theme manually, their choice is preserved. If they haven't, the app tracks the OS setting in real time.

---

## Completion note

After ITER_12, the application is complete within its stated scope:

**What is delivered:**
- Full scaffold generation flow: pick template → configure → stream generate → refine iteratively → export ZIP or push to GitHub/GitLab
- OAuth for GitHub and GitLab with CSRF protection
- Per-route rate limiting, error handling, and request validation throughout
- Template browsability (file structure preview before generating)
- Template manifest validation on startup with operator-friendly logging
- Multi-turn refinement with context overflow handling
- LLM streaming with per-file progress, prompt versioning, shimmer loading states
- Docker Compose for production and dev-mode hot-reload
- Responsive layout, dark mode, reduced-motion support
- Meaningful health check, structured startup output, deployment documentation

**Intentionally out of scope (documented as deferred across iterations):**
- Multi-instance Redis backing (relevant only at scale)
- GitHub Apps credential type (OAuth app covers most use cases)
- Automatic GitLab token refresh (re-auth prompt is sufficient)
- Visual refinement history / undo stack
- Eval harness for LLM prompt testing
- BuildKit cache mounts and container resource limits
- Container queries replacing media query breakpoints