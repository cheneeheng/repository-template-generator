---
artifact: ITER_04
status: ready
created: 2026-04-28
scope: Rate limiting on auth routes, GitLab re-auth on token expiry, dev-mode Docker compose with hot-reload
sections_changed: [03, 04, 05]
sections_unchanged: [01, 02, 06]
---

# Fullstack Template Generator — Iteration 04

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

> Unchanged — see SKELETON.md §02

---

## §03 · Tech Stack

New dependencies introduced by this iteration:

| Package | Version | Rationale |
|---|---|---|
| `express-rate-limit` | `^7.3.1` | Per-IP rate limiting middleware — no Redis required for single-instance (new) |

No new frontend dependencies. Dev-mode compose is infrastructure only.

> **Deferred from previous iterations still deferred:** Multi-instance state map (Redis), multi-turn LLM refinement, prompt versioning, shimmer animations, dark mode, per-file streaming deltas, BuildKit cache mounts, healthcheck directives, container resource limits.

---

## §04 · Backend

### New: rate limiting on `/api/auth/:provider/start`

The `/start` route is the only publicly reachable endpoint that writes to server-side state (the `pendingStates` map). Without a limit, an attacker can fill the map by calling `/start` in a tight loop, wasting memory. A per-IP limit is sufficient for a single-instance deployment.

```js
// middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';

export const authStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15-minute window
  max: 20,                     // 20 attempts per IP per window
  standardHeaders: true,       // return RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'Too many auth attempts — try again in 15 minutes' },
});
```

Apply it only to the `/start` sub-route, not to `/callback` or `/revoke`:

```js
// routes/auth.js
router.get('/:provider/start', authStartLimiter, (req, res) => { ... });
```

Keeping the limiter off `/callback` matters: if the user's browser retries the callback redirect (e.g. back-button behaviour), a rate limit there would break a legitimate flow.

**`express-rate-limit` stores hit counts in memory by default** — correct for single-instance. If a multi-instance deployment is added later, swap the store for a Redis-backed one (`rate-limit-redis`). The limiter API is the same; only the `store` option changes.

### New: dev-mode `docker-compose.dev.yml`

The production compose file (ITER_02) builds images from source. For development, a separate override file mounts source directories and enables hot-reload without rebuilding the image on each change.

```yaml
# docker-compose.dev.yml
services:
  server:
    build:
      context: ./server
      target: dev             # new dev stage in server/Dockerfile — see below
    volumes:
      - ./server:/app
      - /app/node_modules     # anonymous volume shields installed packages from host mount
      - ./templates:/templates:ro
    environment:
      NODE_ENV: development
      TEMPLATES_DIR: /templates
    command: npm run dev      # nodemon or node --watch

  client:
    build:
      context: ./client
      target: dev             # new dev stage in client/Dockerfile — see below
    volumes:
      - ./client:/app
      - /app/node_modules     # same anonymous volume pattern
    ports:
      - "5173:5173"           # Vite dev server port; nginx not used in dev mode
    environment:
      NODE_ENV: development
```

**Usage:** `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`

Add a root convenience script:

```json
{
  "scripts": {
    "docker:dev": "docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build"
  }
}
```

### Updated: `server/Dockerfile` — add dev stage

```dockerfile
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install              # full install including devDependencies
EXPOSE 3000
CMD ["npm", "run", "dev"]    # expects nodemon or node --watch in package.json scripts

FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

The production `Dockerfile` used by the base compose file is unchanged in behaviour — it just needs a `AS production` label added so the dev stage can precede it in the same file.

**`server/package.json` — add dev script:**

```json
{
  "scripts": {
    "dev": "node --watch index.js"
  }
}
```

`node --watch` is built into Node 20 — no `nodemon` dependency needed.

### Updated: `client/Dockerfile` — add dev stage

```dockerfile
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
# --host 0.0.0.0 required — Vite defaults to localhost, which is unreachable from outside the container

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**`--host 0.0.0.0` is required.** Vite binds to `127.0.0.1` by default. Inside a container, Docker's port mapping connects to the container's network interface, not loopback — so the port is published but unreachable from the host unless Vite listens on `0.0.0.0`.

### GitLab token expiry — server-side detection

GitLab tokens expire after 2 hours. When the `/api/export/repo` route calls `gitlab.js` and receives a 401 from the GitLab API, it must surface this distinctly from other errors so the client can prompt re-auth rather than show a generic failure.

Update `services/gitlab.js` to throw a typed error on 401:

```js
if (response.status === 401) {
  throw createError(401, 'GitLab token expired or revoked');
}
```

The `errorHandler` already serialises `http-errors` instances to JSON with their status code, so the client receives:

```json
{ "error": "GitLab token expired or revoked" }
```

with HTTP status 401. No changes needed to `errorHandler`.

> **Deferred:** Multi-instance rate limiting (Redis store), GitLab token refresh (rotating tokens automatically — re-auth prompt is sufficient for now).

---

## §05 · Frontend

### Updated: `ExportPage` — GitLab re-auth on 401

ITER_03 specified that a 401 from `/api/export/repo` should clear the token and show a toast. This iteration wires it up explicitly, since GitLab's 2h expiry makes it a realistic path rather than an edge case.

The existing `onError` handler in the repo creation submit function:

```js
async function handleCreateRepo() {
  const res = await fetch('/api/export/repo', { ... });
  if (!res.ok) {
    const { error } = await res.json();
    if (res.status === 401) {
      setAuthState(prev => ({ ...prev, [provider]: null }));   // clear expired token
      setError('Session expired — reconnect ' + providerLabel + ' to continue');
    } else {
      setError(error ?? 'Repo creation failed');
    }
  }
}
```

When the token is cleared, the connect button for that provider reappears automatically (it renders based on `authState[provider] === null`), so the user can re-authenticate without a page reload.

**No new component needed** — this is a state transition already supported by the `ExportPage` structure from ITER_03. The only addition is the `res.status === 401` branch.

### Vite dev server — API proxy in Docker dev mode

In dev-mode compose, the client Vite server runs in a container and needs to proxy `/api` to the server container. The existing `vite.config.js` proxy (`target: 'http://localhost:3000'`) targets `localhost`, which resolves to the client container's own loopback — not the server container.

Update `vite.config.js` to read the target from an env var:

```js
// client/vite.config.js
export default {
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
};
```

Set `VITE_API_URL=http://server:3000` in `docker-compose.dev.yml` under the client service's `environment` block:

```yaml
  client:
    environment:
      VITE_API_URL: http://server:3000
```

When running locally without Docker, `VITE_API_URL` is unset and the proxy falls back to `localhost:3000` — existing behaviour preserved.

> **Deferred:** Shimmer animations, dark mode, multi-turn LLM refinement, prompt versioning, per-file streaming deltas.

---

## §06 · LLM / Prompts

> Unchanged — see ITER_01.md §06