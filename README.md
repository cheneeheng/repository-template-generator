# repository-template-generator

Generate repository templates to bootstrap app development. Pick a template, describe your project, and either download a ready-to-use ZIP or push directly to a new GitHub or GitLab repository — with project name, description, and structure customised by Claude.

## Architecture

```
client/   React 18 + Vite + Zustand   — UI on :5173
server/   Express + Anthropic SDK     — API on :3000
templates/                            — template definitions (template.json per template)
```

**API routes**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness check |
| GET | `/api/templates` | List available templates |
| POST | `/api/generate` | Stream a customised template via Claude (SSE / `text/event-stream`) |
| POST | `/api/export/zip` | Download generated template as a ZIP |
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

## Configuration

`server/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Required. Anthropic API key. |
| `PORT` | `3000` | Server port. |
| `TEMPLATES_DIR` | `../templates` | Path to template definitions. |
| `MAX_TEMPLATE_CHARS` | `200000` | Max total chars of template files sent to the LLM (~50k tokens). Templates over this limit return 422. |
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

## Adding a template

1. Create `templates/<your-template>/template.json`:

```json
{
  "id": "your-template",
  "label": "Human-readable name",
  "description": "One sentence shown in the UI.",
  "tags": ["tag1", "tag2"]
}
```

2. Add the template files alongside `template.json`. Use `{{PROJECT_NAME}}` as a placeholder — the generator replaces it throughout.

## Model

Uses `claude-sonnet-4-6` via the Anthropic SDK. Swap the model string in `server/services/llm.js` to change it.

## Available templates

| ID | Stack |
|----|-------|
| `react-express-postgres` | React + Express + PostgreSQL + Docker Compose + GitHub Actions CI |
| `fastapi-postgres` | FastAPI + PostgreSQL |
| `python-cli` | Python CLI (Click / Typer) |
| `ts-express-api` | TypeScript + Express REST API |
