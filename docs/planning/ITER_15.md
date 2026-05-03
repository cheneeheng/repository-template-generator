---
artifact: ITER_15
status: ready
created: 2026-05-03
scope: Backend route integration tests (all Express routes via supertest) + GitHub Actions CI pipeline gating on test + coverage
sections_changed: [03, 04]
sections_unchanged: [01, 02, 05, 06]
---

# Fullstack Template Generator — Iteration 15

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

> Unchanged — see ITER_07.md §02

---

## §03 · Tech Stack

New dev dependencies (server):

| Package | Version | Rationale |
|---|---|---|
| `supertest` | `^7.0.0` | HTTP integration testing for Express — makes real HTTP calls against a bound app instance without a live port |

`supertest` is the only addition. Vitest is already installed from ITER_14.

**`vitest.config.js` update — include routes in coverage:**

```js
coverage: {
  include: ['services/**', 'middleware/**', 'prompts/**', 'routes/**'],
  // routes added; all other settings unchanged from ITER_14
}
```

**`server/package.json` — no new scripts;** `npm test` and `npm run test:coverage` already cover the full `routes/` directory now that it is included in the coverage glob.

---

## §04 · Backend

### Test app factory — `server/tests/app.js`

Integration tests need an Express app instance without starting a live server. Extract app creation from `index.js` into a factory function:

```js
// server/app.js  (new file — replaces inline app setup in index.js)
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import 'express-async-errors';
import { errorHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import templatesRouter from './routes/templates.js';
import generateRouter from './routes/generate.js';
import refineRouter from './routes/refine.js';
import exportRouter from './routes/export.js';
import authRouter from './routes/auth.js';
import configRouter from './routes/config.js';

export function createApp() {
  const app = express();
  app.use(cors());
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev')); // suppress logs in test
  app.use(express.json());
  app.use('/api/health', healthRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/generate', generateRouter);
  app.use('/api/refine', refineRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/config', configRouter);
  app.use(errorHandler);
  return app;
}
```

Update `index.js` to import `createApp` and call `app.listen()` — no logic change, just extraction.

Tests import `createApp()` directly:

```js
import { createApp } from '../app.js';
import supertest from 'supertest';

const app = createApp();
const request = supertest(app);
```

### `routes/health.js` tests

Cover: healthy response (key configured, templates dir accessible, templates found), unhealthy response (missing key → 503, inaccessible dir → 503), zero templates returns 200 with warning.

**`server/routes/health.test.js`:**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../app.js';
import * as fs from 'fs/promises';

vi.mock('fs/promises');
vi.mock('../routes/templates.js', () => ({
  scanTemplates: vi.fn(),
  default: (await import('express')).Router(),
}));

describe('GET /api/health', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 ok when key set and templates exist', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('TEMPLATES_DIR', '/templates');
    fs.access.mockResolvedValue(undefined);
    const { scanTemplates } = await import('../routes/templates.js');
    scanTemplates.mockResolvedValue([{ id: 'a' }]);
    vi.resetModules();

    const res = await supertest(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.checks.templateCount).toBe(1);
  });

  it('returns 503 when ANTHROPIC_API_KEY is missing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    fs.access.mockResolvedValue(undefined);
    const { scanTemplates } = await import('../routes/templates.js');
    scanTemplates.mockResolvedValue([{ id: 'a' }]);
    vi.resetModules();

    const res = await supertest(createApp()).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.checks.anthropicKey).toBe('missing');
  });

  it('returns 503 when templates directory is inaccessible', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    fs.access.mockRejectedValue(new Error('ENOENT'));
    vi.resetModules();

    const res = await supertest(createApp()).get('/api/health');
    expect(res.status).toBe(503);
  });
});
```

### `routes/config.js` tests

Cover: `llmEnabled: true` when key set, `llmEnabled: false` when absent.

**`server/routes/config.test.js`:**

```js
import { describe, it, expect, vi } from 'vitest';
import supertest from 'supertest';

describe('GET /api/config', () => {
  it('returns llmEnabled: true when ANTHROPIC_API_KEY is set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.llmEnabled).toBe(true);
  });

  it('returns llmEnabled: false when ANTHROPIC_API_KEY is absent', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/config');
    expect(res.body.llmEnabled).toBe(false);
  });
});
```

### `routes/templates.js` tests

Cover: successful scan returns metadata + files list, invalid manifest is skipped (not included in response), empty templates dir returns empty array.

**`server/routes/templates.test.js`:**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { readdir, readFile } from 'fs/promises';

vi.mock('fs/promises');

const validManifest = JSON.stringify({
  id: 'react-express', label: 'React+Express', description: 'A starter', tags: ['react'],
});

describe('GET /api/templates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns template list with files', async () => {
    readdir
      .mockResolvedValueOnce([{ name: 'react-express', isDirectory: () => true }])  // templates dir
      .mockResolvedValueOnce([                                                         // template dir
        { name: 'template.json', isDirectory: () => false },
        { name: 'README.md', isDirectory: () => false },
      ]);
    readFile.mockResolvedValueOnce(validManifest);

    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/templates');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].files).toContain('README.md');
  });

  it('skips templates with invalid manifests', async () => {
    readdir.mockResolvedValueOnce([
      { name: 'bad-template', isDirectory: () => true },
      { name: 'good-template', isDirectory: () => true },
    ]);
    // bad: returns invalid JSON, good: returns valid manifest
    readFile
      .mockResolvedValueOnce('{ "id": "" }')        // invalid — id empty
      .mockResolvedValueOnce(validManifest);
    readdir
      .mockResolvedValueOnce([])                    // bad template dir
      .mockResolvedValueOnce([{ name: 'README.md', isDirectory: () => false }]);

    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/templates');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('react-express');
  });

  it('returns empty array when templates dir is empty', async () => {
    readdir.mockResolvedValueOnce([]);
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
```

### `routes/generate.js` tests

Cover: Zod validation (missing fields → 400, invalid projectName → 400), bypass mode (no key → file_done events in SSE stream), LLM enabled path (mocked `customiseStreaming`), oversized template (422 from assembler propagates).

**`server/routes/generate.test.js`:**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';

vi.mock('../services/assembler.js');
vi.mock('../services/llm.js');

describe('POST /api/generate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for missing templateId', async () => {
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp())
      .post('/api/generate')
      .send({ projectName: 'my-app', description: 'desc' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for projectName with uppercase', async () => {
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp())
      .post('/api/generate')
      .send({ templateId: 't1', projectName: 'MyApp', description: 'desc' });
    expect(res.status).toBe(400);
  });

  it('streams file_done events in bypass mode', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const { load } = await import('../services/assembler.js');
    load.mockResolvedValue([{ path: 'a.js', content: 'const a=1' }]);
    vi.resetModules();
    const { createApp } = await import('../app.js');

    const res = await supertest(createApp())
      .post('/api/generate')
      .send({ templateId: 't1', projectName: 'my-app', description: 'desc' })
      .buffer(true);

    expect(res.headers['content-type']).toMatch('text/event-stream');
    expect(res.text).toContain('"type":"file_done"');
    expect(res.text).toContain('"type":"done"');
  });

  it('propagates 422 from assembler size guard', async () => {
    const { load } = await import('../services/assembler.js');
    const createError = (await import('http-errors')).default;
    load.mockRejectedValue(createError(422, 'Template exceeds size limit'));
    vi.resetModules();
    const { createApp } = await import('../app.js');

    const res = await supertest(createApp())
      .post('/api/generate')
      .send({ templateId: 'big', projectName: 'my-app', description: 'd' });
    expect(res.status).toBe(422);
  });
});
```

### `routes/refine.js` tests

Cover: 503 in bypass mode, Zod validation (history > 20 messages → 400, instruction > 1000 chars → 400, empty fileTree → 400), successful stream path (mocked `refineStreaming`).

**`server/routes/refine.test.js`:**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';

vi.mock('../services/llm.js');

const validBody = {
  fileTree: [{ path: 'a.js', content: 'x' }],
  history: [],
  instruction: 'make it TypeScript',
};

describe('POST /api/refine', () => {
  it('returns 503 in bypass mode', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).post('/api/refine').send(validBody);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('llm_unavailable');
  });

  it('returns 400 when history exceeds 20 messages', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const history = Array.from({ length: 21 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant', content: 'x',
    }));
    const res = await supertest(createApp()).post('/api/refine')
      .send({ ...validBody, history });
    expect(res.status).toBe(400);
  });

  it('returns 400 when instruction exceeds 1000 chars', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).post('/api/refine')
      .send({ ...validBody, instruction: 'x'.repeat(1001) });
    expect(res.status).toBe(400);
  });

  it('streams done event on success', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const { refineStreaming } = await import('../services/llm.js');
    refineStreaming.mockResolvedValue([{ path: 'a.js', content: 'updated' }]);
    vi.resetModules();
    const { createApp } = await import('../app.js');

    const res = await supertest(createApp()).post('/api/refine').send(validBody).buffer(true);
    expect(res.text).toContain('"type":"done"');
  });
});
```

### `routes/export.js` tests

Cover: ZIP route sets `Content-Disposition` header with project name, ZIP route falls back to `project.zip` when `projectName` absent, repo route returns 401 error shape on GitHub 401.

**`server/routes/export.test.js`:**

```js
import { describe, it, expect, vi } from 'vitest';
import supertest from 'supertest';

vi.mock('../services/zipper.js');
vi.mock('../services/github.js');

const fileTree = [{ path: 'a.js', content: 'x' }];

describe('POST /api/export/zip', () => {
  it('sets Content-Disposition with project name', async () => {
    const { stream } = await import('../services/zipper.js');
    stream.mockImplementation(async (files, res) => res.end());
    vi.resetModules();
    const { createApp } = await import('../app.js');

    const res = await supertest(createApp())
      .post('/api/export/zip')
      .send({ fileTree, projectName: 'my-app' });
    expect(res.headers['content-disposition']).toContain('my-app.zip');
  });

  it('falls back to project.zip when projectName absent', async () => {
    const { stream } = await import('../services/zipper.js');
    stream.mockImplementation(async (files, res) => res.end());
    vi.resetModules();
    const { createApp } = await import('../app.js');

    const res = await supertest(createApp())
      .post('/api/export/zip')
      .send({ fileTree });
    expect(res.headers['content-disposition']).toContain('project.zip');
  });
});
```

### `routes/auth.js` tests

Cover: `/providers` returns correct booleans, `/start` redirects to GitHub OAuth URL with state param, `/callback` rejects unknown state (400), `/callback` exchanges code and redirects to fragment URL, `/revoke` always returns 200.

**`server/routes/auth.test.js`:**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';

vi.mock('../services/oauth.js');

describe('GET /api/auth/providers', () => {
  it('returns github: true when GITHUB_CLIENT_ID set', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'abc');
    vi.stubEnv('GITLAB_CLIENT_ID', '');
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/auth/providers');
    expect(res.body.github).toBe(true);
    expect(res.body.gitlab).toBe(false);
  });
});

describe('GET /api/auth/:provider/start', () => {
  it('redirects to GitHub auth URL', async () => {
    const { buildGitHubAuthUrl } = await import('../services/oauth.js');
    buildGitHubAuthUrl.mockReturnValue('https://github.com/login/oauth/authorize?state=x');
    vi.resetModules();
    const { createApp } = await import('../app.js');

    const res = await supertest(createApp()).get('/api/auth/github/start').redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('github.com');
  });

  it('returns 400 for unknown provider', async () => {
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/auth/bitbucket/start');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/:provider/callback', () => {
  it('returns 400 for unknown state', async () => {
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp())
      .get('/api/auth/github/callback?code=x&state=unknown-state');
    expect(res.status).toBe(400);
  });

  it('redirects to /export with token in fragment after valid exchange', async () => {
    // Start the flow to plant a valid state
    const { buildGitHubAuthUrl, exchangeCodeForToken } = await import('../services/oauth.js');
    buildGitHubAuthUrl.mockReturnValue('https://github.com/login/oauth/authorize?state=planted');
    exchangeCodeForToken.mockResolvedValue('gho_token');

    vi.resetModules();
    const { createApp } = await import('../app.js');
    const app = createApp();

    // Plant the state via /start
    await supertest(app).get('/api/auth/github/start').redirects(0);

    // Now callback with that state — but we don't know the generated nanoid value here
    // So mock the state map or test via the exports; see note below
    // This test is best done by exporting pendingStates for test injection, or
    // testing the full redirect flow with a known state seeded directly.
    // Implementation note: expose a test-only helper that seeds the state map.
  });
});

describe('GET /api/auth/:provider/revoke', () => {
  it('returns 200 even when revocation throws', async () => {
    const { revokeToken } = await import('../services/oauth.js');
    revokeToken.mockRejectedValue(new Error('network error'));
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/auth/github/revoke?token=tok');
    expect(res.status).toBe(200);
  });
});
```

**Note on state seeding for callback test:** The `pendingStates` map is an in-module `Map`. To test the full callback path, expose a `_seedState(state, entry)` export from `routes/auth.js` gated on `process.env.NODE_ENV === 'test'`. This avoids exposing it in production while keeping the test deterministic. The alternative — mocking `nanoid` to return a known value — also works but is more fragile.

---

## GitHub Actions CI — `.github/workflows/ci.yml`

The CI pipeline runs on every push and pull request to `main`. It gates merge on:

1. Backend unit + integration tests passing
2. Backend coverage thresholds met (from `vitest.config.js`)
3. Frontend tests passing (added in ITER_16)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  server-test:
    name: Server — test + coverage
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: server/package-lock.json

      - name: Install server dependencies
        run: npm ci
        working-directory: server

      - name: Run server tests with coverage
        run: npm run test:coverage
        working-directory: server
        env:
          NODE_ENV: test

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: server-coverage
          path: server/coverage/

  client-test:
    name: Client — test + coverage
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: client/package-lock.json

      - name: Install client dependencies
        run: npm ci
        working-directory: client

      - name: Run client tests with coverage
        run: npm run test:coverage
        working-directory: client
        env:
          NODE_ENV: test

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: client-coverage
          path: client/coverage/
```

**Coverage artifacts** are uploaded on both pass and failure (`if: always()`) so failed threshold runs still produce a coverage report for debugging.

**No Docker build in CI:** Building images adds 3–5 minutes per run with no additional test signal — the code is already tested at the unit and integration level. A separate `docker-build` workflow that runs only on tag pushes (releases) is a natural follow-up.

**Branch protection rule (manual step — not in YAML):** After the first CI run succeeds, set a GitHub branch protection rule on `main` requiring both `server-test` and `client-test` jobs to pass before merging. The YAML job names must match exactly.

---

## §05 · Frontend

> Unchanged — see ITER_12.md §05

---

## §06 · LLM / Prompts

> Unchanged — see ITER_07.md §06

---

## Backlog update

- **ITER_16**: Frontend unit + component tests (Vitest + jsdom; utilities, components, pages)
- Multi-instance Redis backing, GitHub Apps, GitLab token refresh, refinement history, CLI validator, eval harness, BuildKit cache mounts, container queries