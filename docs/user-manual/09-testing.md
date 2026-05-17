# Testing

Both `server/` and `client/` use [Vitest](https://vitest.dev/) and run with `bun`.

---

## Server tests

```bash
cd server

bun run test              # run once
bun run test:watch        # watch mode (re-runs on file change)
bun run test:coverage     # with V8 coverage report
```

Coverage output is written to `server/coverage/`. CI uploads the report as an artifact.

Test files are co-located with source or in `server/tests/`. The test runner is configured in `server/vitest.config.js`.

Libraries used:
- `supertest` — HTTP assertion against the Express app
- `@vitest/coverage-v8` — V8 native coverage

---

## Client tests

```bash
cd client

bun run test              # run once
bun run test:watch        # watch mode
```

Test files live in `client/src/**/*.test.{js,jsx}`. The runner is configured in `client/vitest.config.js`.

Libraries used:
- `@testing-library/react` — component rendering and interaction
- `jsdom` — DOM emulation
- `msw` (Mock Service Worker) — API mocking without modifying source code

---

## Running both suites at once

From the repository root:

```bash
bun run test
```

This uses `concurrently` to run both suites in parallel.

---

## CI

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push to `main` and on pull requests to `main`.

Jobs:

| Job | Steps |
|-----|-------|
| `server-test` | Checkout → setup Node 20 + Bun → `bun install --frozen-lockfile` → `bun run test:coverage` |
| `client-test` | Checkout → setup Node 20 + Bun → `bun install --frozen-lockfile` → `bun run test:coverage` |

Both jobs upload their coverage reports as workflow artifacts.

---

## Eval harness

`scripts/eval.js` runs prompt regression tests against the live Anthropic API. It is separate from the unit test suites and requires a real API key.

### What it does

1. Loads fixtures from `scripts/evals/fixtures/` (e.g. `react-starter-basic`, `express-api-basic`).
2. Sends each fixture through the LLM using the configured prompt version.
3. Compares the output against a golden file.
4. Exits `0` if all fixtures pass, `1` if any fail.

### Running

```bash
# Prompt version v1 (default)
ANTHROPIC_API_KEY=<key> TEMPLATES_DIR=$(pwd)/templates bun run eval

# Prompt version v2
ANTHROPIC_API_KEY=<key> TEMPLATES_DIR=$(pwd)/templates bun run eval:v2
```

`bun run eval:v2` sets `EVAL_PROMPT_VERSION=v2` internally. Do **not** set `PROMPT_VERSION` directly when running the eval — it conflicts with server-side registry initialisation.

> **Note:** The eval harness has not been fully end-to-end verified (no real API key was available during development). Treat results as provisional until a confirmed run is completed.
