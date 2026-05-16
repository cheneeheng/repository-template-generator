# Templates

Each subdirectory is a self-contained template. The generator loads them automatically — no registration required.

## How templates work

- Every template directory must contain a `template.json` manifest (see schema below).
- All other files in the directory are template source files.
- The string `{{PROJECT_NAME}}` in any file is replaced with the project name supplied by the user at generation time.
- Files are assembled and sent to Claude, which rewrites them to match the user's description before the result is returned.

## Manifest schema (`template.json`)

```json
{
  "id": "my-template",
  "label": "Human-readable name",
  "description": "One sentence shown in the template picker UI.",
  "tags": ["tag1", "tag2"]
}
```

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | string | Lowercase alphanumeric + hyphens; 1–64 chars; must match the directory name |
| `label` | string | 1–100 chars |
| `description` | string | 1–500 chars |
| `tags` | string[] | 1–10 tags; each tag 1–32 chars |

## Adding a template

1. Create a directory under `templates/` whose name matches the `id` you intend to use.
2. Add a `template.json` with the fields above.
3. Add your source files. Use `{{PROJECT_NAME}}` as a placeholder wherever the project name should appear (package names, app titles, CI workflow names, etc.).
4. Restart the server — templates are scanned on every request to `GET /api/templates`, so no code changes are needed.

**Conventions used by existing templates**

- Place deployment artefacts (Dockerfile, docker-compose.yml, GitHub Actions workflow) under `deploy/` to keep them separate from application source.
- GitHub Actions workflows go in `deploy/.github/workflows/ci.yml`.
- Include a `.env.example` for any template that requires environment variables.
- Keep a `/health` (or equivalent) route in every server template.

## Available templates

### `fastapi-postgres`

**FastAPI + PostgreSQL**

Python async REST API with FastAPI, SQLAlchemy (async), and PostgreSQL. Includes Alembic migrations, Docker Compose for local dev, and a GitHub Actions CI workflow.

Tags: `python` `fastapi` `postgres` `docker` `gh-actions` `sqlalchemy`

---

### `flask-postgres`

**Flask + PostgreSQL**

Flask REST API with Flask-SQLAlchemy and PostgreSQL, managed by uv. Includes blueprint-based routing, pytest-flask for testing (SQLite in-memory for the test suite), Docker Compose for local dev, and a GitHub Actions CI workflow.

Tags: `python` `flask` `postgres` `docker` `gh-actions` `sqlalchemy`

---

### `django-postgres`

**Django + PostgreSQL**

Django REST Framework API with PostgreSQL, managed by uv. Includes model serializers, a ViewSet router, pytest-django for testing, Docker Compose for local dev, and a GitHub Actions CI workflow.

Tags: `python` `django` `postgres` `docker` `gh-actions` `drf`

---

### `python-cli`

**Python CLI Tool**

Python CLI application using Click, managed by uv. Includes pytest with coverage, a src-layout package structure, and a GitHub Actions CI workflow.

Tags: `python` `cli` `click` `pytest` `uv` `gh-actions`

---

### `ts-express-api`

**TypeScript Express API**

TypeScript REST API with Express, Zod for request validation, Jest for testing, and a GitHub Actions CI workflow. Zero-config tsconfig targeting Node 20.

Tags: `typescript` `express` `jest` `zod` `gh-actions`

---

### `nestjs-postgres`

**NestJS + PostgreSQL**

NestJS REST API with TypeORM and PostgreSQL. Includes decorator-based controllers, a service layer, entity definitions, Docker Compose for local dev, and a GitHub Actions CI workflow.

Tags: `typescript` `nestjs` `postgres` `typeorm` `docker` `gh-actions`

---

### `nextjs-app`

**Next.js App**

Full-stack Next.js 15 application using the App Router and TypeScript. Includes an API route for health checks, Vitest for unit tests, and a GitHub Actions CI workflow.

Tags: `typescript` `nextjs` `react` `tailwind` `vitest` `gh-actions`

---

### `sveltekit-app`

**SvelteKit App**

Full-stack SvelteKit application with TypeScript and the Node adapter. Includes a server-side API health route, Vitest for unit tests, and a GitHub Actions CI workflow.

Tags: `typescript` `svelte` `sveltekit` `vitest` `gh-actions`

---

### `react-express-postgres`

**React + Express + PostgreSQL**

Full-stack web app with a React frontend, Express REST API, and PostgreSQL database. Includes Docker Compose for local dev and a GitHub Actions CI workflow.

Tags: `react` `express` `postgres` `docker` `gh-actions`

---

### `go-http-api`

**Go HTTP API**

Lightweight Go HTTP API using the standard library `net/http` with structured JSON logging via `log/slog`. Includes a Dockerfile with multi-stage builds and a GitHub Actions CI workflow.

Tags: `go` `docker` `gh-actions`
