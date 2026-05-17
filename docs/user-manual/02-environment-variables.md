# Environment Variables

All variables are read from `server/.env`. Copy `server/.env.example` as a starting point.

---

## LLM

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | No* | — | Anthropic API key. If absent, server runs in [bypass mode](./01-getting-started.md#bypass-mode) — templates are returned unmodified. |
| `PROMPT_VERSION` | No | `customise-v2` | LLM prompt variant. Set to `customise-v1` to roll back to the previous prompt. |

\* Omitting the key is valid for local development of the UI. LLM customisation and refinement will be unavailable.

---

## Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | TCP port the Express server listens on. |
| `TEMPLATES_DIR` | No | `../templates` (relative to `server/`) | Filesystem path to the template definitions directory. Useful when mounting a custom template set in Docker. |
| `MAX_TEMPLATE_CHARS` | No | `200000` | Maximum total characters of template source files sent to the LLM (~50 k tokens). Requests that exceed this limit return `422`. |
| `MAX_HISTORY_CHARS` | No | `600000` | Maximum total characters of conversation history kept for multi-turn refinement before the oldest turns are truncated. |

---

## Rate limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rolling window size in milliseconds (default: 15 minutes). |
| `RATE_LIMIT_GENERATE_MAX` | No | `10` | Max `/api/generate` requests per IP per window. |
| `RATE_LIMIT_REFINE_MAX` | No | `30` | Max `/api/refine` requests per IP per window. |

---

## Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `redis://localhost:6379` | Connection URL for the Redis instance. Used for share-link persistence and rate-limit state. If Redis is unavailable the server falls back to in-memory state. The Docker Compose stack sets this automatically (`redis://redis:6379`). |

---

## GitHub OAuth

Required only if you want users to push generated templates directly to GitHub. Omit all three variables to disable GitHub repo creation.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_CLIENT_ID` | No | — | GitHub OAuth App client ID. |
| `GITHUB_CLIENT_SECRET` | No | — | GitHub OAuth App client secret. |
| `GITHUB_REDIRECT_URI` | No | `http://localhost:3000/api/auth/github/callback` | Must exactly match the callback URL registered in your GitHub OAuth App. Change this to your production URL in production. |

Scope requested: `repo` (allows creating public and private repositories).

---

## GitHub App (alternative to GitHub OAuth)

A GitHub App can be used instead of an OAuth App for GitHub integration. Configure one or the other, not both.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_APP_ID` | No | — | Numeric App ID shown in the GitHub App settings page. |
| `GITHUB_APP_PRIVATE_KEY` | No | — | PEM-encoded private key. Newlines must be encoded as `\n` (single-line value in `.env`). |
| `GITHUB_APP_INSTALLATION_URL` | No | — | URL users visit to install your GitHub App, e.g. `https://github.com/apps/<slug>/installations/new`. |

---

## GitLab OAuth

Required only if you want users to push to GitLab. Omit all variables to disable GitLab repo creation.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITLAB_CLIENT_ID` | No | — | GitLab OAuth application ID. |
| `GITLAB_CLIENT_SECRET` | No | — | GitLab OAuth application secret. |
| `GITLAB_REDIRECT_URI` | No | `http://localhost:3000/api/auth/gitlab/callback` | Must exactly match the redirect URI registered in your GitLab application. |
| `GITLAB_BASE_URL` | No | `https://gitlab.com` | Override for self-hosted GitLab instances, e.g. `https://gitlab.mycompany.com`. |

Scope requested: `api` (allows creating repositories and pushing code).

---

## Example `.env` (minimal)

```dotenv
ANTHROPIC_API_KEY=sk-ant-...
```

## Example `.env` (full production)

```dotenv
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
TEMPLATES_DIR=../templates
MAX_TEMPLATE_CHARS=200000
MAX_HISTORY_CHARS=600000
PROMPT_VERSION=customise-v2

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_GENERATE_MAX=10
RATE_LIMIT_REFINE_MAX=30

GITHUB_CLIENT_ID=Ov23...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=https://yourdomain.com/api/auth/github/callback

GITLAB_CLIENT_ID=...
GITLAB_CLIENT_SECRET=...
GITLAB_REDIRECT_URI=https://yourdomain.com/api/auth/gitlab/callback
GITLAB_BASE_URL=https://gitlab.com
```
