# Getting Started

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| [Bun](https://bun.sh) | 1.x | Primary runtime and package manager |
| Node.js | 20+ | Required by some tooling; already bundled in devcontainer |
| [Anthropic API key](https://console.anthropic.com/) | — | Required for LLM customisation; see [bypass mode](#bypass-mode) if you do not have one |
| Docker + Docker Compose | 24+ | Required only for Docker-based setup |

**Recommended:** open the repo in the provided devcontainer (Ubuntu 24.04, Node 24 via nvm, bun pre-installed). See `.devcontainer/devcontainer.json`.

---

## Quick start (bare metal)

```bash
# 1. Clone
git clone <repo-url>
cd repository-template-generator

# 2. Configure the server
cp server/.env.example server/.env
# Open server/.env and set ANTHROPIC_API_KEY

# 3. Install dependencies for both packages
bun install           # installs root devDependencies (concurrently)
cd server && bun install && cd ..
cd client && bun install && cd ..

# 4. Start both services with hot reload
bun run dev
```

The client opens at **http://localhost:5173** and the API is at **http://localhost:3000**.

---

## Quick start (Docker Compose)

```bash
# 1. Clone
git clone <repo-url>
cd repository-template-generator

# 2. Configure
cp server/.env.example server/.env
# Open server/.env and set ANTHROPIC_API_KEY

# 3. Start the full stack (server + client + Redis)
docker compose -f deployment/docker-compose.yml up --build
```

Same URLs: **http://localhost:5173** (UI), **http://localhost:3000** (API).

For the development variant with live reload inside Docker, use the dev overlay:

```bash
docker compose -f deployment/docker-compose.yml \
               -f deployment/docker-compose.dev.yml \
               up --build
```

---

## Bypass mode

If `ANTHROPIC_API_KEY` is empty or absent, the server runs in **bypass mode**: templates are returned to the client without any LLM modification, `/api/refine` returns `503`, and `GET /api/health` returns `503` with `ok: false`. This is useful for local development of the UI or template structure when you do not have an API key.

---

## Next steps

- Customise server behaviour → [Environment Variables](./02-environment-variables.md)
- Connect GitHub or GitLab → [OAuth Setup](./07-oauth-setup.md)
- Understand the full UI workflow → [Using the App](./05-using-the-app.md)
- Deploy to production → [Deployment](./04-deployment.md)
