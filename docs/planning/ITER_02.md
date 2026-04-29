---
artifact: ITER_02
status: ready
created: 2026-04-28
scope: Docker/compose setup, responsive layout
sections_changed: [03, 04, 05]
sections_unchanged: [01, 02, 06]
---

# Fullstack Template Generator — Iteration 02

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
| `concurrently` | `^8.2.0` | Dev-only — runs client + server from a single `npm run dev` at repo root (new) |

No new runtime dependencies. Docker and Compose are infrastructure, not npm packages.

**Runtime versions pinned in `Dockerfile`s:**

| Service | Base image |
|---|---|
| `server` | `node:20-alpine` |
| `client` (build stage) | `node:20-alpine` |
| `client` (serve stage) | `nginx:1.27-alpine` |

> **Deferred from ITER_01 still deferred:** Rate limiting, auth/accounts, OAuth flow, per-file streaming deltas, multi-turn refinement, prompt versioning.

---

## §04 · Backend

### New: `Dockerfile` for the server

```dockerfile
# server/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "index.js"]
```

`npm ci --omit=dev` installs only production dependencies — `morgan` stays (runtime), `concurrently` and dev tooling are excluded.

### New: `docker-compose.yml` (repo root)

```yaml
services:
  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    env_file: ./server/.env
    ports:
      - "3000:3000"
    volumes:
      - ./templates:/templates:ro   # mount template library read-only
    environment:
      TEMPLATES_DIR: /templates     # override default path for container context

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    ports:
      - "5173:80"                   # nginx serves on 80; host maps to 5173 for familiarity
    depends_on:
      - server
```

**Why `TEMPLATES_DIR` is overridden:** Inside the container, `../../templates` relative to `server/` resolves to a path outside the image. The volume is mounted at `/templates` and the env var points there explicitly. The default resolution in `assembler.js` (`../../templates` relative to `__dirname`) is preserved for local-without-Docker runs — no code change needed.

**`templates/` is mounted read-only** — the server never writes to it, and `:ro` prevents accidental mutation.

### New: `client/Dockerfile` (multi-stage)

```dockerfile
# client/Dockerfile
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build          # vite build → dist/

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### New: `client/nginx.conf`

The React app uses client-side routing. Without this config, a hard refresh on `/preview` returns nginx's default 404.

```nginx
server {
    listen 80;

    root /usr/share/nginx/html;
    index index.html;

    # Proxy API calls to the server service
    location /api/ {
        proxy_pass http://server:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';      # required for SSE — disables chunked keep-alive timeout
        proxy_buffering off;                 # required for SSE — nginx buffers by default
        proxy_cache off;
        proxy_read_timeout 120s;             # LLM pass can take up to ~60s; give headroom
    }

    # SPA fallback — all non-asset routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**SSE through nginx:** `proxy_buffering off` is critical — without it, nginx buffers the entire response and the client receives nothing until the stream ends, breaking the streaming UX entirely. `Connection: ''` prevents nginx from forwarding a `keep-alive` header that can cause SSE connections to stall under HTTP/1.1.

### New: root `package.json` (monorepo convenience scripts)

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\"",
    "docker:up": "docker compose up --build",
    "docker:down": "docker compose down"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```

Developers can run `npm run dev` from the repo root to start both services, or `npm run docker:up` to start the containerised stack.

### Updated: `server/.env.example`

Add the Docker-relevant variable:

```
ANTHROPIC_API_KEY=
PORT=3000
TEMPLATES_DIR=          # optional — leave blank for default (../../templates relative to server/)
MAX_TEMPLATE_CHARS=     # optional — defaults to 200000
```

> **Gotcha — volume mounts shadow `node_modules`:** If a developer mounts `./server` into the container for hot-reload (not done here — this is a production-style image), the host's `node_modules` (or absence of one) overwrites the container's. The current Dockerfiles do not mount source — they `COPY` it — so this is not an issue. If a dev-mode compose override is added later, an anonymous volume for `node_modules` must be added:
> ```yaml
> volumes:
>   - ./server:/app
>   - /app/node_modules    # anonymous volume shields installed packages
> ```

> **Deferred:** Dev-mode compose override with hot-reload, multi-stage caching optimisation (e.g. BuildKit cache mounts for `npm ci`), healthcheck directives, container resource limits.

---

## §05 · Frontend

### Responsive layout

The four pages gain a responsive shell. No new libraries — CSS custom properties and a single breakpoint via media queries are sufficient at this stage.

**Breakpoints:**

| Name | Min-width | Target |
|---|---|---|
| `mobile` | — (default) | single column, stacked nav |
| `desktop` | `768px` | two-column where applicable |

**Shell component — `client/src/components/Shell.jsx`:**

Wraps every page. Provides a top nav bar (app name + current step indicator) and a centred content column with max-width capped at `1100px`.

```jsx
export function Shell({ children, step }) {
  // step: 1 | 2 | 3 | 4  — highlights the active breadcrumb
  return (
    <div className="shell">
      <header className="shell__nav">
        <span className="shell__logo">Scaffold</span>
        <StepBreadcrumb current={step} />
      </header>
      <main className="shell__content">{children}</main>
    </div>
  );
}
```

**`StepBreadcrumb`** renders four labelled steps (Pick → Configure → Preview → Export) with the active one highlighted. On mobile, collapses to "Step N of 4".

**Per-page layout changes:**

| Page | Mobile | Desktop |
|---|---|---|
| `TemplatePickerPage` | Single-column card list | 3-column `TemplateGrid` |
| `ConfigurePage` | Full-width form | Form capped at `560px`, centred |
| `PreviewPage` | File tree above file viewer (stacked) | File tree sidebar (260px) + viewer panel |
| `ExportPage` | Stacked buttons | Buttons side-by-side, form below |

**`TemplateGrid` — existing component, CSS change only:**

```css
.template-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .template-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

**`PreviewPage` — sidebar layout on desktop:**

```css
.preview-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 768px) {
  .preview-layout {
    flex-direction: row;
  }
  .preview-layout__tree {
    width: 260px;
    flex-shrink: 0;
  }
  .preview-layout__viewer {
    flex: 1;
    min-width: 0;   /* prevents flex child overflow on long file content lines */
  }
}
```

**`min-width: 0` on the viewer panel:** Without this, a flex child with long unbreakable content (code lines) overflows its container rather than scrolling. This is a common flex gotcha — the fix is one line.

### Vite proxy — local dev without Docker

In the Docker setup, nginx proxies `/api/` to the server container. Locally, Vite's dev server handles this:

```js
// client/vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
};
```

This is likely already present from the skeleton; confirm it is. Without it, `fetch('/api/generate')` from the Vite dev server hits the wrong origin.

> **Deferred:** Shimmer skeleton animations for loading states, dark mode, container queries (replace media queries if layout becomes more complex), OAuth flow.

---

## §06 · LLM / Prompts

> Unchanged — see ITER_01.md §06