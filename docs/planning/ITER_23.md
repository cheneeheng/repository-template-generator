---
artifact: ITER_23
status: ready
created: 2026-05-17
scope: >
  Three changes: (1) turn counter in refinement panel — display current turn number,
  no cap; (2) migrate share store from in-memory Map to Redis with RDB persistence
  and a named Docker volume; (3) introduce docker-compose.yml wiring the app and
  Redis together for local development and single-instance deployment.
sections_changed: [02, 03, 04, 05]
sections_unchanged: [01, 06]
---

# Fullstack Template Generator — Iteration 23

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

### Turn counter

`PreviewPage` tracks how many refinement turns have completed. The count starts at 0 and increments by 1 each time a refinement `done` event fires. It is displayed in the refinement panel as a passive label — no cap is enforced (see DECISIONS.md D-01).

```
refinementTurnCount: number   // new state field, initialised to 0
```

No backend change needed — the server already processes each refinement independently.

### Share store — Redis

The in-memory `Map` in `server/store/shareStore.js` (ITER-19) is replaced with Redis. The share store is the only application data in Redis — rate limiting remains in-memory (DECISIONS.md D-02), and all other server-side state is already stateless.

Redis key schema:

```
share:<id>   →  JSON string   TTL: 24h (set via EXPIRE at write time)
```

Redis handles TTL expiry natively — no manual expiry check on `GET` is needed (unlike the current `expiresAt` field comparison). The `expiresAt` field is dropped from the stored payload.

### Docker Compose

The existing `docker-compose.yml` (ITER_02, updated in ITER_04) defines `server` and `client` services. This iteration adds a `redis` service and injects `REDIS_URL` into the `server` service.

```
docker-compose up
  → redis starts, RDB data persisted to named volume redis-data
  → server starts with REDIS_URL injected, connects to Redis
  → client starts as before
```

---

## §03 · Tech Stack

New server dependency:

| Package | Version | Rationale |
|---|---|---|
| `ioredis` | `^5.3.0` | Redis client — Promise-native, no callback wrappers needed, TTL support built in |

New service: Redis (via Docker). No new npm dependency for Docker — it is an infrastructure concern.

> Otherwise unchanged — see ITER_16.md §03

---

## §04 · Backend

### Redis client — `server/lib/redis.js`

```js
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

redis.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});

export default redis;
```

A single shared client instance. `ioredis` reconnects automatically on disconnect — no manual retry logic needed.

`REDIS_URL` is read from the environment. Defaults to `redis://localhost:6379` so the app starts without Docker if Redis is running locally.

### Updated: `server/store/shareStore.js`

Replace the in-memory `Map` with Redis calls. The `expiresAt` field is dropped — TTL is delegated to Redis `EXPIRE`.

```js
import redis from '../lib/redis.js';

const TTL_SECONDS = 24 * 60 * 60;   // 24 hours
const KEY = (id) => `share:${id}`;

export async function saveShare(id, payload) {
  await redis.set(KEY(id), JSON.stringify(payload), 'EX', TTL_SECONDS);
}

export async function getShare(id) {
  const raw = await redis.get(KEY(id));
  if (!raw) return { status: 'not_found' };
  return { status: 'ok', data: JSON.parse(raw) };
}
```

**Note:** The `expired` status (HTTP 410) is dropped. Redis returns `null` for both missing and expired keys — there is no way to distinguish them. The route handler returns 404 in both cases. This is a minor UX change: recipients of expired links now see "not found" rather than "expired". Acceptable given the 24h window; the frontend error message can be updated to cover both cases.

### Updated: `server/routes/share.js`

The route handlers become `async` to await the store calls. The 410 branch is removed.

```js
router.post('/', async (req, res) => {
  const { fileTree, projectName, templateId } = shareSchema.parse(req.body);
  const id = randomBytes(4).toString('hex');
  await saveShare(id, { fileTree, projectName, templateId });
  res.json({ id });
});

router.get('/:id', async (req, res) => {
  const result = await getShare(req.params.id);
  if (result.status === 'not_found') return res.status(404).json({ error: 'not_found' });
  res.json(result.data);
});
```

`express-async-errors` (already installed from ITER-08) handles any thrown Redis errors — they propagate to the existing error handler.

### Updated: `docker-compose.yml`

Add a `redis` service and extend `server` with `REDIS_URL` and `depends_on`. The `client` service is unchanged.

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - redis-data:/data

  server:
    # ... existing build, ports, volumes, env_file unchanged from ITER_02/04 ...
    environment:
      TEMPLATES_DIR: /templates
      REDIS_URL: redis://redis:6379
    depends_on:
      - redis

  client:
    # ... unchanged from ITER_02/04 ...

volumes:
  redis-data:
```

The `version` field is omitted — Docker Compose V2 ignores it and emits a deprecation warning if present.

**Redis persistence config (`--save 60 1`):** write an RDB snapshot if at least 1 key has changed in the last 60 seconds. AOF is not enabled — share link durability does not warrant it. The snapshot is written inside the named volume `redis-data`, which Docker persists across container restarts.

**`redis-data` volume:** named volume managed by Docker. Data survives `docker-compose restart` and `docker-compose down` (but not `docker-compose down -v`).

**`REDIS_URL` in environment block:** added alongside the existing `TEMPLATES_DIR`. The `env_file: ./server/.env` directive (ITER_02) already loads all other secrets — `REDIS_URL` is injected directly since it is not secret and its value is known at compose time.

### Updated: `server/tests/share.test.js`

The store is now async. Mock `ioredis` using `ioredis-mock` (dev dependency) or override the redis module in tests with a simple in-memory shim via Vitest's `vi.mock`.

```js
// server/tests/share.test.js
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Hoist the store so beforeEach can clear it
const store = new Map();

vi.mock('../lib/redis.js', () => ({
  default: {
    set: vi.fn(async (key, value) => store.set(key, value)),
    get: vi.fn(async (key) => store.get(key) ?? null),
  },
}));

import { saveShare, getShare } from '../store/shareStore.js';

beforeEach(() => {
  store.clear();       // reset data between tests
  vi.clearAllMocks();  // reset call counts
});

describe('shareStore', () => {
  it('saves and retrieves a share entry', async () => {
    const payload = { fileTree: [], projectName: 'app', templateId: 't' };
    await saveShare('abc123', payload);
    const result = await getShare('abc123');
    expect(result.status).toBe('ok');
    expect(result.data).toEqual(payload);
  });

  it('returns not_found for unknown id', async () => {
    const result = await getShare('unknown');
    expect(result.status).toBe('not_found');
  });
});
```

New dev dependency: none — the `vi.mock` shim avoids needing `ioredis-mock`.

---

## §05 · Frontend

### Turn counter — `PreviewPage`

New state field:

```js
const [refinementTurnCount, setRefinementTurnCount] = useState(0);
```

Increment on each refinement `done` event, alongside the existing snapshot append:

```js
// inside the refinement done handler
setRefinementTurnCount(prev => prev + 1);
```

Display in the refinement panel, below the textarea and above the submit button:

```jsx
{refinementTurnCount > 0 && (
  <p className="refine__turn-count">Turn {refinementTurnCount}</p>
)}
```

Hidden until the first refinement completes — showing "Turn 0" before any refinement would be confusing.

**`fromShare` and `fromWorkspace` modes:** `refinementTurnCount` always initialises to 0 regardless of session origin. The count reflects turns in the current session, not historical turns from the sharer or the saved workspace.

### Frontend error message — expired share links

Update the 404 error message in `SharePage` to cover both missing and expired cases:

```jsx
// Previously two separate messages for 404 and 410; now unified:
<p>This link was not found or has expired (links last 24 hours).</p>
```

Remove the 410 handling branch — the server no longer returns 410.

### Tests

Update `PreviewPage.test.jsx`:
- turn counter hidden before first refinement
- turn counter shows "Turn 1" after first refinement done
- turn counter shows "Turn 2" after second refinement done
- `fromShare` session starts turn counter at 0

Update `SharePage.test.jsx`:
- 404 response shows the unified not-found/expired message (remove 410 test case)

---

## §06 · LLM / Prompts

> Unchanged — see ITER_21.md §06

---

## Backlog update

After ITER-23, share links survive server restarts (Redis with RDB), the turn counter gives users session context, and Docker Compose provides a coherent local dev and single-instance deployment setup.

Remaining deferred items (see DECISIONS.md for rationale on each):
- GitHub Apps credential type (D-12)
- Automatic GitLab token refresh (D-13)
