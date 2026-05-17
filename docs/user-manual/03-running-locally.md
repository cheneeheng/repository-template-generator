# Running Locally

## Option A — bare metal (recommended for development)

### 1. Install dependencies

```bash
# Root (provides concurrently for the bun run dev shortcut)
bun install

# Server
cd server && bun install && cd ..

# Client
cd client && bun install && cd ..
```

### 2. Configure the server

```bash
cp server/.env.example server/.env
```

Open `server/.env` and set at minimum:

```dotenv
ANTHROPIC_API_KEY=sk-ant-...
```

All other variables have sensible defaults. See [Environment Variables](./02-environment-variables.md) for the full reference.

### 3. Start both services

```bash
bun run dev
```

This runs `concurrently` to start the server and client in the same terminal:

- **Server** — `http://localhost:3000` (`node --watch`, restarts on file change)
- **Client** — `http://localhost:5173` (Vite dev server with HMR)

To start them separately:

```bash
# Terminal 1
cd server && bun run dev

# Terminal 2
cd client && bun run dev
```

### Available root scripts

| Script | What it does |
|--------|-------------|
| `bun run dev` | Start server (:3000) and client (:5173) with hot reload |
| `bun run test` | Run server and client test suites concurrently |
| `bun run docker:up` | Build and start the production Docker stack |
| `bun run docker:down` | Stop and remove the production Docker stack |
| `bun run docker:dev` | Build and start the Docker dev stack (live reload inside containers) |
| `bun run eval` | Run prompt regression eval (prompt v1) |
| `bun run eval:v2` | Run prompt regression eval (prompt v2) |

### Server-only scripts (run from `server/`)

| Script | What it does |
|--------|-------------|
| `bun run dev` | Start server with `node --watch` |
| `bun run start` | Start server without watch mode |
| `bun run test` | Run Vitest once |
| `bun run test:watch` | Run Vitest in watch mode |
| `bun run test:coverage` | Run Vitest with V8 coverage |

### Client-only scripts (run from `client/`)

| Script | What it does |
|--------|-------------|
| `bun run dev` | Start Vite dev server |
| `bun run build` | Production build to `client/dist/` |
| `bun run preview` | Serve the production build locally |
| `bun run test` | Run Vitest once |
| `bun run test:watch` | Run Vitest in watch mode |

---

## Option B — Docker Compose (dev stack)

The dev Docker stack mounts source directories as volumes and enables hot reload inside containers.

```bash
cp server/.env.example server/.env
# Set ANTHROPIC_API_KEY in server/.env

docker compose \
  -f deployment/docker-compose.yml \
  -f deployment/docker-compose.dev.yml \
  up --build
```

The `docker-compose.dev.yml` overlay:
- Sets `NODE_ENV=development`
- Runs the server with `node --watch` (dev target in `server/Dockerfile`)
- Runs the Vite dev server in the client container (dev target in `client/Dockerfile`)
- Mounts `./server` and `./client` as volumes so file changes are reflected immediately

---

## Devcontainer

The repo ships with a `.devcontainer/` configuration. Open the repo in VS Code and choose **Reopen in Container** (requires the Dev Containers extension). The container is Ubuntu 24.04 with Node 24 (nvm) and bun pre-installed.

Ports 3000, 5173, and 8000 are forwarded automatically.

---

## Verifying the setup

```bash
curl http://localhost:3000/api/health
```

Expected response when `ANTHROPIC_API_KEY` is set:

```json
{ "ok": true, "checks": { "templatesDir": "ok", "templateCount": 22, "anthropicKey": "configured" } }
```

Expected response in bypass mode (no API key) — returns `503`:

```json
{ "ok": false, "checks": { "templatesDir": "ok", "templateCount": 22, "anthropicKey": "missing" } }
```
