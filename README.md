# repository-template-generator

Generate repository templates to bootstrap app development. Pick a template, describe your project, and either download a ready-to-use ZIP or push directly to a new GitHub or GitLab repository — with project name, description, and structure customised by Claude. After the initial generation, use the refinement panel to iteratively adjust the output through multi-turn conversation. Supports dark mode.

## Architecture

```
client/      React 18 + Vite + Zustand   — UI on :5173
server/      Express + Anthropic SDK     — API on :3000
templates/                               — template definitions (template.json per template)
deployment/                              — Docker Compose files and deployment docs
```

**API routes**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness and dependency check (returns version, uptime, Claude reachability) |
| GET | `/api/templates` | List available templates |
| POST | `/api/generate` | Stream a customised template via Claude (SSE / `text/event-stream`) |
| POST | `/api/refine` | Stream incremental refinements to a previously generated template (SSE); accepts conversation history and a follow-up instruction |
| POST | `/api/export/zip` | Download generated (or refined) template as a ZIP |
| POST | `/api/export/repo` | Create a GitHub or GitLab repository and push the generated files |
| GET | `/api/auth/providers` | Return which OAuth providers are configured |
| GET | `/api/auth/:provider/start` | Redirect browser to provider OAuth consent screen |
| GET | `/api/auth/:provider/callback` | Handle OAuth callback; redirects client with token in URL fragment |
| GET | `/api/auth/:provider/revoke` | Revoke provider token (best-effort) |

`:provider` is `github` or `gitlab`.

## Getting started

### Prerequisites

- Node.js 20+ / `bun`
- An [Anthropic API key](https://console.anthropic.com/)

Recommended: open the repo in the provided devcontainer (Ubuntu 24.04, Python 3.12, Node 24 via nvm, bun).

### 1. Server

```bash
cd server
bun install
cp .env.example .env          # then set ANTHROPIC_API_KEY
bun run dev                   # starts on :3000 with --watch
```

### 2. Client

```bash
cd client
bun install
bun run dev                   # starts on :5173
```

Open `http://localhost:5173`.

### Alternative: Docker Compose

```bash
cp server/.env.example server/.env   # then set ANTHROPIC_API_KEY
docker compose -f deployment/docker-compose.yml up --build
```

The server is available on `:3000` and the client on `:5173` (served via nginx inside the client container on port 80, mapped to host 5173).

## Configuration

`server/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Required. Anthropic API key. |
| `PORT` | `3000` | Server port. |
| `TEMPLATES_DIR` | `../templates` | Path to template definitions. |
| `MAX_TEMPLATE_CHARS` | `200000` | Max total chars of template files sent to the LLM (~50k tokens). Templates over this limit return 422. |
| `MAX_HISTORY_CHARS` | `600000` | Max total chars of conversation history kept for multi-turn refinement before the oldest turns are truncated. |
| `PROMPT_VERSION` | `customise-v2` | LLM prompt variant. Set to `customise-v1` to roll back to the previous prompt. |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate-limit window in milliseconds (default 15 minutes). |
| `RATE_LIMIT_GENERATE_MAX` | `10` | Max `/api/generate` requests per IP per window. |
| `RATE_LIMIT_REFINE_MAX` | `30` | Max `/api/refine` requests per IP per window. |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth App client ID. Omit to disable GitHub repo creation. |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth App client secret. |
| `GITHUB_REDIRECT_URI` | `http://localhost:3000/api/auth/github/callback` | Must match the callback URL registered in your GitHub OAuth App. |
| `GITLAB_CLIENT_ID` | — | GitLab OAuth application ID. Omit to disable GitLab repo creation. |
| `GITLAB_CLIENT_SECRET` | — | GitLab OAuth application secret. |
| `GITLAB_REDIRECT_URI` | `http://localhost:3000/api/auth/gitlab/callback` | Must match the callback URL registered in your GitLab application. |
| `GITLAB_BASE_URL` | `https://gitlab.com` | Override for self-hosted GitLab instances. |

### Setting up GitHub OAuth

1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
2. Set **Authorization callback URL** to `http://localhost:3000/api/auth/github/callback` (or your production URL).
3. Copy the client ID and secret into `server/.env`.
4. The app requests the `repo` scope — this allows creating both public and private repositories.

### Setting up GitLab OAuth

1. Go to GitLab → User Settings → Applications → Add new application.
2. Set the **Redirect URI** to `http://localhost:3000/api/auth/gitlab/callback`.
3. Select the `api` scope.
4. Copy the application ID and secret into `server/.env`.

## Testing

Both server and client use [Vitest](https://vitest.dev/) and are run with `bun`.

### Server

```bash
cd server
bun run test              # run once
bun run test:watch        # watch mode
bun run test:coverage     # with coverage report
```

### Client

```bash
cd client
bun run test              # run once
bun run test:watch        # watch mode
```

## Eval harness

`scripts/eval.js` runs prompt regression checks against the real Anthropic API. It loads fixtures from `scripts/evals/fixtures/` (`react-starter-basic`, `express-api-basic`), sends each through the LLM, and asserts the output against a golden file. Exit code is 0 if all fixtures pass, 1 if any fail.

> **Note:** The eval CLI has not been properly tested — no real Anthropic API key was available during development. Treat results as unverified until a full end-to-end run has been confirmed.

### Required environment variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Required. Hits the live Anthropic API — no mock mode. |
| `TEMPLATES_DIR` | Path to template definitions. Pass as an absolute path (e.g. `$(pwd)/templates`). |

### Running

```bash
# Prompt version v1 (default)
ANTHROPIC_API_KEY=<key> TEMPLATES_DIR=$(pwd)/templates npm run eval

# Prompt version v2
ANTHROPIC_API_KEY=<key> TEMPLATES_DIR=$(pwd)/templates npm run eval:v2
```

`npm run eval:v2` sets `EVAL_PROMPT_VERSION=v2` internally via `cross-env`. Do not set `PROMPT_VERSION` directly — it conflicts with server-side registry initialisation.

## Templates

See [`templates/README.md`](templates/README.md) for the full list of available templates, the manifest schema, conventions, and instructions for adding a new template.

## Model

Uses `claude-sonnet-4-6` via the Anthropic SDK. Swap the model string in `server/services/llm.js` to change it.
