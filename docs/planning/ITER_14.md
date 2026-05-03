---
artifact: ITER_14
status: ready
created: 2026-05-03
scope: Backend unit tests — Vitest for all server services (llm, assembler, zipper, historyTruncator, templateValidator, oauth) with full branch coverage; no route-level tests (those are ITER_15)
sections_changed: [03, 04]
sections_unchanged: [01, 02, 05, 06]
---

# Fullstack Template Generator — Iteration 14

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
| `vitest` | `^1.6.0` | Test runner — ESM-native, no transform config needed for Node ESM projects |
| `@vitest/coverage-v8` | `^1.6.0` | V8-based coverage — zero extra config, works without Babel |

No new runtime dependencies. No frontend packages in this iteration.

**Why Vitest over Jest:** The server uses ESM (`"type": "module"` in `package.json`). Jest requires `--experimental-vm-modules` or a Babel transform to handle ESM. Vitest is ESM-native and requires zero transform config — it runs the source directly. Both iterations (backend and frontend) use Vitest, giving a unified `vitest` command and shared config patterns.

**`server/vitest.config.js`:**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['services/**', 'middleware/**', 'prompts/**'],
      exclude: ['**/*.test.js'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
```

Coverage thresholds are enforced — `vitest run --coverage` exits non-zero if they are not met. This is what the CI pipeline (ITER_15) will gate on.

**`server/package.json` — new scripts:**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Test file location:** Co-located with source — `server/services/llm.test.js` lives next to `server/services/llm.js`. This is the Vitest convention and avoids a separate `__tests__` directory that drifts out of sync with the source tree.

---

## §04 · Backend

### Mocking strategy

All external I/O is mocked at the module boundary:

| External | Mock approach |
|---|---|
| Anthropic SDK (`@anthropic-ai/sdk`) | `vi.mock('@anthropic-ai/sdk')` — replace `messages.stream` with a controllable async generator |
| `fs/promises` (`readFile`, `readdir`, `stat`, `access`) | `vi.mock('fs/promises')` — return controlled fixture data |
| `archiver` | `vi.mock('archiver')` — spy on `append` / `finalize` calls |
| `node-fetch` (GitLab) | `vi.mock('node-fetch')` — return controlled `Response` objects |
| `@octokit/rest` | `vi.mock('@octokit/rest')` — stub `repos.createForAuthenticatedUser`, `repos.createOrUpdateFileContents` |

`vi.mock` is hoisted by Vitest before imports — the same hoisting behaviour as Jest. No `jest.mock` → `vi.mock` rename needed.

**Shared fixture factory — `server/tests/fixtures.js`:**

```js
export const makeFile = (path, content = `content of ${path}`) => ({ path, content });

export const makeFileTree = (count = 3) =>
  Array.from({ length: count }, (_, i) => makeFile(`file${i}.js`));

export const makeHistory = (turns = 2) =>
  Array.from({ length: turns * 2 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `turn ${Math.floor(i / 2)} ${ i % 2 === 0 ? 'instruction' : JSON.stringify(makeFileTree(2)) }`,
  }));
```

### `services/templateValidator.js` tests

Full branch coverage: valid manifest, each invalid field variant, edge values.

**`server/services/templateValidator.test.js`:**

```js
import { describe, it, expect } from 'vitest';
import { validateManifest } from './templateValidator.js';

const valid = {
  id: 'react-express-postgres',
  label: 'React + Express + PostgreSQL',
  description: 'A fullstack starter.',
  tags: ['react', 'express'],
};

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    expect(validateManifest(valid)).toEqual({ valid: true });
  });

  it('rejects missing id', () => {
    const { id: _, ...rest } = valid;
    const result = validateManifest(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.startsWith('id:'))).toBe(true);
  });

  it('rejects id with uppercase', () => {
    const result = validateManifest({ ...valid, id: 'React-Express' });
    expect(result.valid).toBe(false);
  });

  it('rejects id longer than 64 chars', () => {
    const result = validateManifest({ ...valid, id: 'a'.repeat(65) });
    expect(result.valid).toBe(false);
  });

  it('rejects empty tags array', () => {
    const result = validateManifest({ ...valid, tags: [] });
    expect(result.valid).toBe(false);
  });

  it('rejects more than 10 tags', () => {
    const result = validateManifest({ ...valid, tags: Array(11).fill('tag') });
    expect(result.valid).toBe(false);
  });

  it('rejects a tag longer than 32 chars', () => {
    const result = validateManifest({ ...valid, tags: ['a'.repeat(33)] });
    expect(result.valid).toBe(false);
  });

  it('rejects description longer than 500 chars', () => {
    const result = validateManifest({ ...valid, description: 'x'.repeat(501) });
    expect(result.valid).toBe(false);
  });

  it('rejects label longer than 100 chars', () => {
    const result = validateManifest({ ...valid, label: 'x'.repeat(101) });
    expect(result.valid).toBe(false);
  });

  it('returns all failing field paths in errors array', () => {
    const result = validateManifest({ id: '', label: '', description: '', tags: [] });
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
```

### `services/historyTruncator.js` tests

Cover: under budget (no-op), assistant-first truncation, user-turn fallback, empty array, exactly at budget.

**`server/services/historyTruncator.test.js`:**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { truncateHistory } from './historyTruncator.js';

// Override the budget for predictable test values
const BUDGET = 100;
vi.stubEnv('MAX_HISTORY_CHARS', String(BUDGET));

// Re-import after env stub so the module reads the stubbed value
// Note: because the budget is parsed at module load time, use vi.resetModules + dynamic import
// OR parameterise the function. For testability, export truncateHistory(history, budget = DEFAULT).
// This iteration assumes the function signature is updated to accept an optional budget param:
// export function truncateHistory(history, budget = parseInt(process.env.MAX_HISTORY_CHARS ?? '600000', 10))

import { truncateHistory } from './historyTruncator.js';

const u = (content) => ({ role: 'user', content });
const a = (content) => ({ role: 'assistant', content });

describe('truncateHistory', () => {
  it('returns history unchanged when under budget', () => {
    const h = [u('hi'), a('ok')]; // well under 100 chars
    expect(truncateHistory(h, 1000)).toEqual(h);
  });

  it('drops oldest assistant turns first', () => {
    const longAssistant = a('x'.repeat(60));
    const h = [u('q1'), longAssistant, u('q2'), a('short')];
    // total = 2 + 60 + 2 + 5 = 69 — fits in 100
    // make it exceed: use 80-char assistant turn
    const bigA = a('x'.repeat(80));
    const h2 = [u('q1'), bigA, u('q2'), a('y'.repeat(10))];
    // total = 2 + 80 + 2 + 10 = 94 — fits in 100, no truncation
    expect(truncateHistory(h2, 100)).toEqual(h2);

    // Now make it exceed
    const h3 = [u('q1'), a('x'.repeat(80)), u('q2'), a('y'.repeat(30))];
    // total = 2 + 80 + 2 + 30 = 114 > 100
    const result = truncateHistory(h3, 100);
    // Oldest assistant turn (80 chars) should be dropped first
    expect(result.find(m => m.content === 'x'.repeat(80))).toBeUndefined();
    expect(result.find(m => m.role === 'user' && m.content === 'q1')).toBeDefined();
  });

  it('drops user turns if still over budget after assistant drops', () => {
    const h = [u('q'.repeat(60)), u('p'.repeat(60))];
    // No assistant turns — must drop user turns
    const result = truncateHistory(h, 80);
    expect(result.length).toBeLessThan(h.length);
  });

  it('returns empty array if entire history exceeds budget', () => {
    const h = [u('x'.repeat(200))];
    const result = truncateHistory(h, 50);
    expect(result).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const h = [u('q1'), a('x'.repeat(80)), u('q2')];
    const copy = JSON.stringify(h);
    truncateHistory(h, 50);
    expect(JSON.stringify(h)).toBe(copy);
  });
});
```

**Required source change:** `truncateHistory` must accept an optional second parameter `budget` defaulting to the env-parsed value. This makes the function unit-testable without env stub gymnastics:

```js
export function truncateHistory(
  history,
  budget = parseInt(process.env.MAX_HISTORY_CHARS ?? '600000', 10)
) { ... }
```

### `services/llm.js` tests

Cover: `LLM_ENABLED` flag, bypass path (no API call, correct SSE events emitted), normal streaming path (clarinet parsing), parse error handling, refine streaming.

**`server/services/llm.test.js`:**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Anthropic SDK before importing llm.js
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        stream: vi.fn(),
      };
    },
  };
});

// Helper: create a fake SDK stream that emits text chunks then finalises
function makeStream(chunks) {
  const emitter = new EventEmitter();
  // Emit chunks async after listeners attach
  setImmediate(() => {
    for (const chunk of chunks) emitter.emit('text', chunk);
    emitter.emit('finalMessage');
  });
  emitter.on = emitter.on.bind(emitter); // already there; just for clarity
  return emitter;
}

// The SSE response mock
function makeRes() {
  const writes = [];
  return {
    write: (data) => writes.push(data),
    _writes: writes,
  };
}
```

**Bypass path test:**

```js
describe('customiseStreaming — bypass mode', () => {
  it('emits file_done for each file without calling Anthropic', async () => {
    // Set LLM_ENABLED = false by clearing the env var before module load
    // Because LLM_ENABLED is set at module load, use vi.resetModules + dynamic import
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.resetModules();
    const { customiseStreaming } = await import('./llm.js');

    const files = [makeFile('a.js'), makeFile('b.js')];
    const res = makeRes();
    const result = await customiseStreaming(files, 'my-app', 'desc', res);

    expect(result).toEqual(files);
    const events = res._writes.map(w => JSON.parse(w.replace(/^data: /, '').trim()));
    expect(events.filter(e => e.type === 'file_done')).toHaveLength(2);
    expect(events.find(e => e.type === 'file_done' && e.path === 'a.js')).toBeDefined();
  });
});
```

**Normal streaming path test:**

```js
describe('customiseStreaming — normal path', () => {
  it('parses clarinet output and emits file_done per file', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.resetModules();

    const { customiseStreaming } = await import('./llm.js');
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const instance = new Anthropic();

    const jsonChunks = [
      '[{"path":"README.md","conte',
      'nt":"# hello"},{"path":"index.js","content":"const x=1"}]',
    ];
    instance.messages.stream.mockResolvedValue(makeStream(jsonChunks));

    const res = makeRes();
    const result = await customiseStreaming([], 'app', 'desc', res);

    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('README.md');

    const events = res._writes.map(w => JSON.parse(w.replace(/^data: /, '').trim()));
    expect(events.filter(e => e.type === 'file_done')).toHaveLength(2);
  });

  it('throws 500 on malformed JSON from model', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.resetModules();
    const { customiseStreaming } = await import('./llm.js');
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const instance = new Anthropic();

    instance.messages.stream.mockResolvedValue(makeStream(['not json at all']));

    const res = makeRes();
    await expect(customiseStreaming([], 'app', 'desc', res))
      .rejects.toMatchObject({ statusCode: 500 });
  });
});
```

### `services/assembler.js` tests

Cover: successful file load, over-size guard (422), missing template directory (404-ish error), `TEMPLATES_DIR` resolution.

**`server/services/assembler.test.js`:**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile, readdir, stat } from 'fs/promises';

vi.mock('fs/promises');

describe('assembler.load', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns files for a valid template', async () => {
    readdir.mockResolvedValueOnce([
      { name: 'template.json', isDirectory: () => false },
      { name: 'README.md', isDirectory: () => false },
    ]);
    readFile
      .mockResolvedValueOnce(JSON.stringify({ id: 'test', label: 'T', description: 'D', tags: ['t'] }))
      .mockResolvedValueOnce('# Hello');

    const { load } = await import('./assembler.js');
    const files = await load('test');
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('README.md');
  });

  it('throws 422 when total chars exceed limit', async () => {
    const bigContent = 'x'.repeat(200001);
    readdir.mockResolvedValueOnce([
      { name: 'template.json', isDirectory: () => false },
      { name: 'big.txt', isDirectory: () => false },
    ]);
    readFile
      .mockResolvedValueOnce(JSON.stringify({ id: 'test', label: 'T', description: 'D', tags: ['t'] }))
      .mockResolvedValueOnce(bigContent);

    const { load } = await import('./assembler.js');
    await expect(load('test')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('throws when template directory does not exist', async () => {
    readdir.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const { load } = await import('./assembler.js');
    await expect(load('nonexistent')).rejects.toThrow();
  });
});
```

### `services/zipper.js` tests

Cover: `stream` function calls `archiver` with correct entries, pipe to res, finalise called.

**`server/services/zipper.test.js`:**

```js
import { describe, it, expect, vi } from 'vitest';

const mockArchiver = {
  append: vi.fn(),
  finalize: vi.fn().mockResolvedValue(undefined),
  pipe: vi.fn(),
  on: vi.fn(),
};
vi.mock('archiver', () => ({ default: () => mockArchiver }));

describe('zipper.stream', () => {
  it('appends each file and finalises', async () => {
    const { stream } = await import('./zipper.js');
    const res = { on: vi.fn() };
    const files = [makeFile('a.js', 'const a=1'), makeFile('b.js', 'const b=2')];

    await stream(files, res);

    expect(mockArchiver.append).toHaveBeenCalledTimes(2);
    expect(mockArchiver.append).toHaveBeenCalledWith('const a=1', { name: 'a.js' });
    expect(mockArchiver.finalize).toHaveBeenCalled();
  });

  it('pipes archive to response', async () => {
    const { stream } = await import('./zipper.js');
    const res = { on: vi.fn() };
    await stream([makeFile('x.js')], res);
    expect(mockArchiver.pipe).toHaveBeenCalledWith(res);
  });
});
```

### `services/oauth.js` tests

Cover: `buildGitHubAuthUrl` contains correct params, `buildGitLabAuthUrl` uses `GITLAB_BASE_URL`, `exchangeCodeForToken` GitHub success path, GitHub error path (API returns `{ error }`), GitLab path, `revokeToken` is best-effort (no throw on failure).

**`server/services/oauth.test.js`:**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

global.fetch = vi.fn();

describe('buildGitHubAuthUrl', () => {
  it('includes client_id, scope, state, and redirect_uri', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'client123');
    vi.stubEnv('GITHUB_REDIRECT_URI', 'http://localhost:3000/api/auth/github/callback');
    vi.resetModules();
    const { buildGitHubAuthUrl } = await import('./oauth.js');

    const url = new URL(buildGitHubAuthUrl('state-xyz'));
    expect(url.searchParams.get('client_id')).toBe('client123');
    expect(url.searchParams.get('scope')).toBe('repo');
    expect(url.searchParams.get('state')).toBe('state-xyz');
  });
});

describe('exchangeCodeForToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns access_token on success (GitHub)', async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({ access_token: 'gho_test' }),
    });
    vi.stubEnv('GITHUB_CLIENT_ID', 'c');
    vi.stubEnv('GITHUB_CLIENT_SECRET', 's');
    vi.stubEnv('GITHUB_REDIRECT_URI', 'http://localhost/cb');
    vi.resetModules();
    const { exchangeCodeForToken } = await import('./oauth.js');

    const token = await exchangeCodeForToken('github', 'code123');
    expect(token).toBe('gho_test');
  });

  it('throws 502 when GitHub returns an error', async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({ error: 'bad_verification_code', error_description: 'Code expired' }),
    });
    vi.resetModules();
    const { exchangeCodeForToken } = await import('./oauth.js');
    await expect(exchangeCodeForToken('github', 'bad')).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe('revokeToken', () => {
  it('does not throw on fetch failure', async () => {
    fetch.mockRejectedValueOnce(new Error('network error'));
    const { revokeToken } = await import('./oauth.js');
    await expect(revokeToken('github', 'tok')).resolves.not.toThrow();
  });
});
```

### `middleware/errorHandler.js` tests

Cover: `ZodError` → 400, `Anthropic.APIError` context overflow → 422, other `Anthropic.APIError` → 502, `http-errors` instance → status passthrough, generic `Error` → 500.

**`server/middleware/errorHandler.test.js`:**

```js
import { describe, it, expect, vi } from 'vitest';
import { ZodError } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import createError from 'http-errors';
import { errorHandler } from './errorHandler.js';

function makeRes() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  return res;
}

describe('errorHandler', () => {
  const next = vi.fn();
  const req = {};

  it('returns 400 for ZodError', () => {
    const err = new ZodError([{ path: ['x'], message: 'required', code: 'invalid_type', expected: 'string', received: 'undefined' }]);
    const res = makeRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 422 for Anthropic context overflow', () => {
    const err = new Anthropic.APIError(400, { message: 'prompt is too long' }, 'prompt is too long', {});
    const res = makeRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'context_overflow' }));
  });

  it('returns 502 for other Anthropic APIError', () => {
    const err = new Anthropic.APIError(529, { message: 'overloaded' }, 'overloaded', {});
    const res = makeRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('passes through http-errors status code', () => {
    const err = createError(422, 'Template too large');
    const res = makeRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('returns 500 for unknown error', () => {
    const err = new Error('something unexpected');
    const res = makeRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
```

### `prompts/registry.js` tests

Cover: valid `PROMPT_VERSION` resolves, unknown version throws at module load, `CURRENT_REFINE_VERSION` is always `refine-v1`.

**`server/prompts/registry.test.js`:**

```js
import { describe, it, expect, vi } from 'vitest';

describe('prompts/registry', () => {
  it('loads customise-v2 by default', async () => {
    vi.stubEnv('PROMPT_VERSION', '');
    vi.resetModules();
    const { CURRENT_PROMPT_VERSION } = await import('./registry.js');
    expect(CURRENT_PROMPT_VERSION.key).toBe('customise-v2');
  });

  it('loads customise-v1 when PROMPT_VERSION=customise-v1', async () => {
    vi.stubEnv('PROMPT_VERSION', 'customise-v1');
    vi.resetModules();
    const { CURRENT_PROMPT_VERSION } = await import('./registry.js');
    expect(CURRENT_PROMPT_VERSION.key).toBe('customise-v1');
  });

  it('throws on unknown PROMPT_VERSION', async () => {
    vi.stubEnv('PROMPT_VERSION', 'customise-v99');
    vi.resetModules();
    await expect(import('./registry.js')).rejects.toThrow('Unknown PROMPT_VERSION');
  });

  it('always exports refine-v1 as CURRENT_REFINE_VERSION', async () => {
    vi.stubEnv('PROMPT_VERSION', '');
    vi.resetModules();
    const { CURRENT_REFINE_VERSION } = await import('./registry.js');
    expect(CURRENT_REFINE_VERSION.key).toBe('refine-v1');
  });
});
```

---

## §05 · Frontend

> Unchanged — see ITER_12.md §05

---

## §06 · LLM / Prompts

> Unchanged — see ITER_07.md §06

---

## Backlog update

- **ITER_15**: Backend route integration tests (all Express routes via `supertest`) + GitHub Actions CI pipeline
- **ITER_16**: Frontend unit tests (utilities, components, pages)
- Multi-instance Redis backing, GitHub Apps, GitLab token refresh, refinement history panel, CLI validator, eval harness, BuildKit cache mounts, container queries