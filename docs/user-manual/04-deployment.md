# Deployment

## Recommended: Docker Compose

The production stack is defined in `deployment/docker-compose.yml` and runs three services:

| Service | Image | Port |
|---------|-------|------|
| `redis` | `redis:7-alpine` | Internal only |
| `server` | Built from `server/Dockerfile` (production target) | `3000` |
| `client` | Built from `client/Dockerfile` (nginx) | `5173` (mapped from container port `80`) |

The client nginx configuration reverse-proxies `/api` requests to `server:3000`, so the browser only needs to reach port `5173`.

### Steps

```bash
# 1. Clone the repo on your server
git clone <repo-url>
cd repository-template-generator

# 2. Configure
cp server/.env.example server/.env
# Edit server/.env — set ANTHROPIC_API_KEY and any OAuth variables

# 3. Start
docker compose -f deployment/docker-compose.yml up --build -d

# 4. Verify
curl http://localhost:3000/api/health
```

To stop:

```bash
docker compose -f deployment/docker-compose.yml down
```

---

## Health check

The server exposes `GET /api/health`. Docker Compose polls this endpoint every 30 seconds using `wget`. The endpoint returns:

```json
{ "ok": true, "checks": { "templatesDir": "ok", "templateCount": 22, "anthropicKey": "configured" } }
```

Returns `503` if the templates directory is inaccessible or `ANTHROPIC_API_KEY` is not set.

---

## Using a custom template directory

Mount your own template directory and point the server at it:

```yaml
# In deployment/docker-compose.yml (or a local override file)
services:
  server:
    environment:
      TEMPLATES_DIR: /my-templates
    volumes:
      - /path/to/your/templates:/my-templates:ro
```

Templates are re-scanned on every `GET /api/templates` request — no container restart needed after adding or removing templates.

---

## Redis

Redis is used for optional rate-limit state persistence and the share-link store. The `redis` service in the compose file uses an `alpine` image with a 60-second RDB save rule and persists data to a named Docker volume (`redis-data`).

If Redis is unavailable, the server falls back to in-memory state. No configuration change is needed.

---

## Reverse proxy / TLS

The compose file does not include a TLS terminator. For production, place a reverse proxy (nginx, Caddy, Traefik) in front of the `client` container on port `5173`.

Minimal nginx snippet (TLS assumed to be handled upstream):

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Update `GITHUB_REDIRECT_URI` and `GITLAB_REDIRECT_URI` in `server/.env` to use your production domain before redeploying.

---

## Updating

```bash
git pull origin main
docker compose -f deployment/docker-compose.yml up --build -d
```

Docker Compose rebuilds only the images that changed. Existing data in the `redis-data` volume is preserved.

---

## Environment variables in production

Never commit `server/.env`. In CI/CD pipelines, inject secrets as environment variables directly into the container rather than mounting a `.env` file:

```yaml
# Example for a compose-compatible deployment
services:
  server:
    environment:
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
      GITHUB_CLIENT_ID: "${GITHUB_CLIENT_ID}"
      GITHUB_CLIENT_SECRET: "${GITHUB_CLIENT_SECRET}"
```

See [Environment Variables](./02-environment-variables.md) for the full variable reference.
