# Deploying

## Option A — Docker Compose (recommended)

1. Clone the repo.
2. Copy `server/.env.example` to `server/.env` and fill in your values.
3. Register OAuth apps on GitHub and/or GitLab (optional — see below).
4. Run:

   ```bash
   docker compose -f deployment/docker-compose.yml up --build -d
   ```

5. The app is available at `http://localhost:5173` (client) and `http://localhost:3000` (API).

**Adding your own templates:** Mount a directory containing your template folders:

```yaml
# deployment/docker-compose.yml override
services:
  server:
    environment:
      TEMPLATES_DIR: /my-templates
    volumes:
      - /path/to/your/templates:/my-templates:ro
```

## Option B — Manual (local dev)

Requirements: Node.js 20+ and [bun](https://bun.sh)

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
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `PORT` | No (default: 3000) | Server port |
| `TEMPLATES_DIR` | No | Path to templates directory. Defaults to `templates/` in the repo root. |
| `MAX_TEMPLATE_CHARS` | No (default: 200000) | Character limit for loaded templates |
| `MAX_HISTORY_CHARS` | No (default: 600000) | Character budget for refinement history |
| `RATE_LIMIT_GENERATE_MAX` | No (default: 10) | Max generation requests per IP per 15 min |
| `RATE_LIMIT_REFINE_MAX` | No (default: 30) | Max refinement requests per IP per 15 min |

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
