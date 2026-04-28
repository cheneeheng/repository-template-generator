# repository-template-generator

Generate repository templates to bootstrap app development. Pick a template, describe your project, and download a ready-to-use zip — with project name, description, and structure customised by Claude.

## Architecture

```
client/   React 18 + Vite + Zustand   — UI on :5173
server/   Express + Anthropic SDK     — API on :3001
templates/                            — template definitions (template.json per template)
```

**API routes**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness check |
| GET | `/api/templates` | List available templates |
| POST | `/api/generate` | Generate a customised template via Claude |
| GET | `/api/export/:id` | Download generated template as a zip |

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
bun run dev                   # starts on :3001 with --watch
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
| `PORT` | `3001` | Server port. |
| `TEMPLATES_DIR` | `../templates` | Path to template definitions. |

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
