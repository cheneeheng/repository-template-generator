# Templates

## Available templates

### Python

| Template ID | Label | Description |
|-------------|-------|-------------|
| `fastapi-postgres` | FastAPI + PostgreSQL | Async REST API with FastAPI, SQLAlchemy (async), Alembic, Docker Compose, GitHub Actions CI |
| `flask-postgres` | Flask + PostgreSQL | Flask REST API with Flask-SQLAlchemy, uv, blueprint routing, pytest-flask, Docker Compose |
| `django-postgres` | Django + PostgreSQL | Django REST Framework with uv, model serializers, ViewSet router, pytest-django, Docker Compose |
| `python-cli` | Python CLI Tool | Click-based CLI, uv, pytest with coverage, src-layout |
| `python-worker` | Python Async Worker | ARQ + Redis background worker, health endpoint, Docker Compose |

### TypeScript / JavaScript

| Template ID | Label | Description |
|-------------|-------|-------------|
| `ts-express-api` | TypeScript Express API | Express, Zod validation, Jest, GitHub Actions CI |
| `nestjs-postgres` | NestJS + PostgreSQL | NestJS, TypeORM, PostgreSQL, decorator controllers, Docker Compose |
| `nextjs-app` | Next.js App | Next.js 15 App Router, TypeScript, Vitest, GitHub Actions CI |
| `sveltekit-app` | SvelteKit App | SvelteKit + Node adapter, TypeScript, Vitest |
| `react-express-postgres` | React + Express + PostgreSQL | Full-stack: React frontend, Express API, PostgreSQL, Docker Compose |
| `hono-bun-api` | Hono + Bun API | Hono on Bun, Zod validation, built-in test runner, Dockerfile |
| `trpc-nextjs` | tRPC + Next.js | End-to-end type-safe, tRPC, Next.js 15 App Router, React Query, Zod |
| `remix-postgres` | Remix + PostgreSQL | Remix, Drizzle ORM, PostgreSQL, Vitest, Docker Compose |
| `vue-express-postgres` | Vue 3 + Express + PostgreSQL | Vue 3 Composition API, TypeScript Express, PostgreSQL, Docker Compose |
| `astro-blog` | Astro Blog | Astro, Content Collections, MDX, RSS, sitemap, GitHub Actions CI |

### Go

| Template ID | Label | Description |
|-------------|-------|-------------|
| `go-http-api` | Go HTTP API | Standard `net/http`, `log/slog`, multi-stage Dockerfile, GitHub Actions CI |
| `grpc-go` | gRPC Go Service | protobuf, server reflection, health checking, multi-stage Dockerfile |

### Rust

| Template ID | Label | Description |
|-------------|-------|-------------|
| `rust-axum-api` | Rust Axum API | Axum, Tower middleware, Serde, health endpoint, multi-stage Dockerfile |

### Elixir

| Template ID | Label | Description |
|-------------|-------|-------------|
| `elixir-phoenix` | Elixir Phoenix API | Phoenix, Ecto, PostgreSQL, ExUnit, Docker Compose |

### Ruby

| Template ID | Label | Description |
|-------------|-------|-------------|
| `ruby-rails-postgres` | Ruby on Rails + PostgreSQL | Rails 7 API-mode, ActiveRecord, RSpec, Docker Compose |

---

## Template structure

Each template lives in its own directory under `templates/`. The generator loads all directories automatically — no registration step.

```
templates/
└── my-template/
    ├── template.json        # required manifest
    ├── src/
    │   └── ...              # source files
    └── deploy/
        ├── Dockerfile
        ├── docker-compose.yml
        └── .github/
            └── workflows/
                └── ci.yml
```

### Manifest schema (`template.json`)

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
| `id` | string | Lowercase alphanumeric + hyphens; 1–64 chars; **must match the directory name** |
| `label` | string | 1–100 chars |
| `description` | string | 1–500 chars |
| `tags` | string[] | 1–10 tags; each tag 1–32 chars |

### `{{PROJECT_NAME}}` placeholder

Use `{{PROJECT_NAME}}` anywhere in your template files (file contents, filenames, paths). The generator replaces every occurrence with the project name the user enters in the Configure step.

---

## Adding a template

1. Create a directory under `templates/` whose name is the template `id`.
2. Add `template.json` with the fields above.
3. Add your source files. Use `{{PROJECT_NAME}}` wherever the project name should appear.
4. Restart the server (or not — `GET /api/templates` re-scans the directory on every request).

### Conventions

- Put deployment artefacts (Dockerfile, docker-compose.yml, CI workflows) under `deploy/` to separate them from application source.
- GitHub Actions workflows belong at `deploy/.github/workflows/ci.yml`.
- Include a `.env.example` if the template requires environment variables.
- Every server template should expose a `/health` (or equivalent) endpoint.

### Size limit

The total size of all files in a template must not exceed `MAX_TEMPLATE_CHARS` (default 200 000 characters, ~50 k tokens). Requests for templates over this limit return `422`.

---

## Contributing a template

See [CONTRIBUTING.md](../../CONTRIBUTING.md) at the repository root for the contribution guide.
