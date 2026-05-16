---
artifact: ITER_21
status: ready
created: 2026-05-08
scope: CLI eval harness — run a fixed set of generation inputs against the real LLM, evaluate output structurally against golden files, report pass/fail per prompt version; supports prompt regression detection
sections_changed: [02, 03, 04, 06]
sections_unchanged: [01, 05]
---

# Fullstack Template Generator — Iteration 21

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

### Eval model

The harness is a standalone Node script (`scripts/eval.js`) — not integrated into the Vitest test suite. It hits the real Anthropic API and is a deliberate manual step, not CI-blocking.

```
eval input (fixture)
  → build prompt via prompts/registry.js (same path as production)
  → call Anthropic API directly (not via the Express server)
  → receive fileTree output
  → run structural assertions against golden file
  → report PASS / FAIL / WARN per fixture
```

**Structural assertions** — not string diffing. A fixture's golden file defines what must be present:

```json
{
  "requiredFiles": ["README.md", "package.json", "src/index.js"],
  "requiredContent": {
    "package.json": ["\"name\"", "\"scripts\""],
    "README.md": ["## Getting Started"]
  }
}
```

`requiredFiles` — every listed path must appear in the output `fileTree`.
`requiredContent` — each listed string must appear somewhere in the named file's content (substring match).

This is intentionally tolerant of LLM non-determinism. Exact content is not asserted.

### Fixture structure

```
scripts/
  eval.js                        // entry point
  evals/
    fixtures/
      react-starter-basic/
        input.json               // { templateId, projectName, description }
        golden.json              // { requiredFiles, requiredContent }
      express-api-basic/
        input.json
        golden.json
```

Two fixtures shipped initially — one per template type. More can be added without changing the harness.

### Output format

```
Running evals against prompt version: v1

  ✓  react-starter-basic        (2134ms)
  ✗  express-api-basic          (1876ms)
       FAIL: missing file src/app.js
       FAIL: package.json missing "\"scripts\""

2 fixtures, 1 passed, 1 failed
Exit code: 1 if any failures, 0 if all pass
```

Exit code convention means the script can be wired into a manual CI step or pre-release checklist without further tooling.

---

## §03 · Tech Stack

No new npm dependencies. The harness uses:
- `@anthropic-ai/sdk` — already a server dependency, imported directly
- `fs/promises` — built-in, reads fixtures
- `path` — built-in

> Otherwise unchanged — see ITER_16.md §03

---

## §04 · Backend

### New file: `scripts/eval.js`

```js
#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

// Import the prompt registry — adjust relative path from scripts/ to server/
// Assumes scripts/ is at repo root alongside server/
import { VERSIONS } from '../server/prompts/registry.js';

const PROMPT_VERSION = process.env.PROMPT_VERSION ?? 'v1';
const promptConfig = VERSIONS[`customise-${PROMPT_VERSION}`];
if (!promptConfig) {
  console.error(`Unknown prompt version: customise-${PROMPT_VERSION}`);
  process.exit(1);
}

const FIXTURES_DIR = new URL('./evals/fixtures', import.meta.url).pathname;
const client = new Anthropic();   // reads ANTHROPIC_API_KEY from env

async function runFixture(fixtureName) {
  const dir = path.join(FIXTURES_DIR, fixtureName);
  const input = JSON.parse(await fs.readFile(path.join(dir, 'input.json'), 'utf8'));
  const golden = JSON.parse(await fs.readFile(path.join(dir, 'golden.json'), 'utf8'));

  const start = Date.now();

  // Build user message using the same system prompt as production
  const userContent = `Project name: ${input.projectName}\nDescription: ${input.description}\nFiles: ${JSON.stringify(
    await loadTemplateFiles(input.templateId)
  )}`;

  const response = await client.messages.create({
    model: promptConfig.model,
    max_tokens: 8192,
    system: promptConfig.system,
    messages: [{ role: 'user', content: userContent }],
  });

  const raw = response.content.find(b => b.type === 'text')?.text ?? '';

  // The eval calls the API non-streaming, so the full JSON array is in `raw`.
  // JSON.parse is sufficient here — no clarinet needed.
  let fileTree;
  try {
    fileTree = JSON.parse(raw);
    if (!Array.isArray(fileTree)) throw new Error('not an array');
  } catch {
    return { fixtureName, elapsed: Date.now() - start, failures: ['LLM output was not a valid JSON array'] };
  }

  const elapsed = Date.now() - start;
  const failures = assertGolden(fileTree, golden);
  return { fixtureName, elapsed, failures };
}

function assertGolden(fileTree, golden) {
  const failures = [];
  const byPath = Object.fromEntries(fileTree.map(f => [f.path, f.content]));

  for (const required of golden.requiredFiles ?? []) {
    if (!byPath[required]) failures.push(`missing file ${required}`);
  }

  for (const [filePath, substrings] of Object.entries(golden.requiredContent ?? {})) {
    const content = byPath[filePath] ?? '';
    for (const s of substrings) {
      if (!content.includes(s)) failures.push(`${filePath} missing "${s}"`);
    }
  }

  return failures;
}

async function main() {
  const entries = await fs.readdir(FIXTURES_DIR, { withFileTypes: true });
  const fixtures = entries.filter(e => e.isDirectory()).map(e => e.name);

  console.log(`\nRunning evals against prompt version: ${PROMPT_VERSION}\n`);

  let passed = 0;
  let failed = 0;

  for (const name of fixtures) {
    const result = await runFixture(name);
    if (result.failures.length === 0) {
      console.log(`  ✓  ${name.padEnd(30)} (${result.elapsed}ms)`);
      passed++;
    } else {
      console.log(`  ✗  ${name.padEnd(30)} (${result.elapsed}ms)`);
      result.failures.forEach(f => console.log(`       FAIL: ${f}`));
      failed++;
    }
  }

  console.log(`\n${fixtures.length} fixtures, ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
```

### New npm script in root `package.json`:

```json
{
  "scripts": {
    "eval": "node scripts/eval.js",
    "eval:v2": "cross-env PROMPT_VERSION=v2 node scripts/eval.js"
  }
}
```

**Note:** `PROMPT_VERSION=v2 node ...` is a POSIX-only syntax and does not work on Windows. Use `cross-env` (already a dev dependency from ITER_09 rate limit config work, or add it now as a dev dependency) for cross-platform compatibility.

### `loadTemplateFiles` helper

The eval script needs to load the template files for a given `templateId` to pass to the LLM — the same thing `assembler.js` does in production. Rather than reimplementing this, import `assembler.load` directly:

```js
import { load as loadTemplateFiles } from '../server/services/assembler.js';
```

This ensures the eval uses the same file-loading logic as production, including `TEMPLATES_DIR` resolution. The `TEMPLATES_DIR` env var must be set (or defaulted) when running evals.

### Fixture files

**`scripts/evals/fixtures/react-starter-basic/input.json`:**
```json
{
  "templateId": "react-starter",
  "projectName": "my-app",
  "description": "A basic React app with a counter component"
}
```

**`scripts/evals/fixtures/react-starter-basic/golden.json`:**
```json
{
  "requiredFiles": ["README.md", "package.json", "src/App.jsx", "src/main.jsx"],
  "requiredContent": {
    "package.json": ["\"react\"", "\"scripts\""],
    "README.md": ["my-app"]
  }
}
```

**`scripts/evals/fixtures/express-api-basic/input.json`:**
```json
{
  "templateId": "express-starter",
  "projectName": "my-api",
  "description": "A basic Express REST API with a health check endpoint"
}
```

**`scripts/evals/fixtures/express-api-basic/golden.json`:**
```json
{
  "requiredFiles": ["README.md", "package.json", "src/app.js", "src/index.js"],
  "requiredContent": {
    "src/app.js": ["/health"],
    "package.json": ["\"express\""]
  }
}
```

### Registry export addition

The eval script imports `VERSIONS` from `server/prompts/registry.js`. The registry currently exports `CURRENT_PROMPT_VERSION` and `CURRENT_REFINE_VERSION` (ITER_07). Add a named `VERSIONS` export so the eval can access any version by key:

```js
// server/prompts/registry.js — add this export
export { VERSIONS };
```

This is the only production code change in this iteration — one additional export, no logic change.

---

## §05 · Frontend

> Unchanged — see ITER_16.md §05

---

## §06 · LLM / Prompts

### Eval as prompt regression gate

The eval harness is the mechanism for validating prompt version changes. Workflow for introducing a new prompt version:

1. Add `generate.v2` to `server/prompts/registry.js`
2. Run `npm run eval` (v1 baseline — must pass)
3. Run `npm run eval:v2` (new version — must also pass)
4. If v2 passes all fixtures, switch `PROMPT_VERSION=v2` in `.env`

Golden files are the stable contract. When a new template is added (ITER_N), a corresponding fixture pair is also added.

**Deferred:** LLM-as-judge semantic evaluation (second model call to assess output quality). Structural assertion is sufficient for regression detection at this stage.

---

## Backlog update

After ITER_21, the eval harness provides prompt regression detection across all template types. Remaining deferred items:

- Multi-instance Redis backing (rate limiting, OAuth state map, share store)
- GitHub Apps credential type alongside OAuth
- Automatic GitLab token refresh
- BuildKit cache mounts and container resource limits
- Container queries replacing media query breakpoints
- Turns-remaining indicator in refinement panel
- Rate limit countdown timer from `RateLimit-Reset` header
- Workspace portability across devices (requires auth + server-side storage)
- LLM-as-judge semantic eval (deferred from this iteration)
- Template library expansion (additional template types with fixture coverage)