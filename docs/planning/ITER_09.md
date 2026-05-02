---
artifact: ITER_09
status: ready
created: 2026-04-28
scope: Per-route rate limiting on /api/generate and /api/refine with env-configurable ceilings and a distinct client-side rate-limit error state
sections_changed: [03, 04, 05]
sections_unchanged: [01, 02, 06]
---

# Fullstack Template Generator — Iteration 09

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

> Unchanged — see ITER_07.md §02

---

## §03 · Tech Stack

No new dependencies. `express-rate-limit` was added in ITER_04 for the auth routes — the same package is reused here.

**New environment variables:**

```
RATE_LIMIT_GENERATE_MAX    # optional — defaults to 10 (requests per window per IP)
RATE_LIMIT_REFINE_MAX      # optional — defaults to 30
RATE_LIMIT_WINDOW_MS       # optional — defaults to 900000 (15 minutes), shared across all limiters
```

`/api/refine` gets a higher ceiling than `/api/generate` because refinement requests are the normal interactive loop — users may make many small adjustments in a session. Generation is the heavier LLM call (assembles from template) and is less frequent by design.

---

## §04 · Backend

### Updated: `middleware/rateLimiter.js`

Add two new limiters alongside the existing `authStartLimiter`:

```js
import rateLimit from 'express-rate-limit';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10); // 15 min

export const authStartLimiter = rateLimit({
  windowMs,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts — try again in 15 minutes' },
});

export const generateLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_GENERATE_MAX ?? '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limit_exceeded', message: 'Too many generation requests — try again shortly' },
});

export const refineLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_REFINE_MAX ?? '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limit_exceeded', message: 'Too many refinement requests — try again shortly' },
});
```

**Consistent `error` field:** All limiter messages use `error: 'rate_limit_exceeded'` as the machine-readable key so the client can detect them without parsing human-readable text.

### Apply limiters to routes

```js
// routes/generate.js
import { generateLimiter } from '../middleware/rateLimiter.js';
router.post('/', generateLimiter, async (req, res) => { ... });
```

```js
// routes/refine.js
import { refineLimiter } from '../middleware/rateLimiter.js';
router.post('/', refineLimiter, async (req, res) => { ... });
```

**Why apply at the route, not globally:** A global limiter would throttle health checks, template listing, and ZIP downloads — none of which hit the LLM. Only the LLM-calling routes need protection. Auth already has its own limiter from ITER_04.

**Rate limit response shape:** `express-rate-limit` sends the `message` object as the response body with a 429 status. The `error: 'rate_limit_exceeded'` key is the same field the client already checks for `context_overflow` — consistent error key pattern.

**`RateLimit-*` headers:** `standardHeaders: true` sends `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` per the IETF draft standard. The client can use `RateLimit-Reset` to show a countdown, but this is not required.

### Updated: `server/.env.example`

```
ANTHROPIC_API_KEY=
PORT=3000
TEMPLATES_DIR=
MAX_TEMPLATE_CHARS=
MAX_HISTORY_CHARS=
PROMPT_VERSION=

# Rate limiting (optional — defaults shown)
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_GENERATE_MAX=10       # generation requests per IP per window
RATE_LIMIT_REFINE_MAX=30         # refinement requests per IP per window

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback

# GitLab OAuth (optional)
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
GITLAB_REDIRECT_URI=http://localhost:3000/api/auth/gitlab/callback
GITLAB_BASE_URL=https://gitlab.com
```

> **Deferred:** Redis-backed store for multi-instance deployments (ITER_17). Per-user limits (requires auth). Burst allowance (token-bucket algorithm — not supported by `express-rate-limit` without a custom store).

---

## §05 · Frontend

### Rate limit error — distinct UI state

A 429 response from `/api/generate` or `/api/refine` should not show the same generic error toast as a 500. The user needs to know to wait, not to retry immediately.

**In `streamGenerate.js` and `streamRefine.js`**, check for 429 before the generic error path:

```js
if (response.status === 429) {
  const reset = response.headers.get('RateLimit-Reset'); // Unix timestamp or seconds
  callbacks.onRateLimit?.(reset);
  return;
}
if (!response.ok) {
  const err = await response.json();
  callbacks.onError?.(err.error ?? 'Request failed');
  return;
}
```

**New callback: `onRateLimit(resetTimestamp)`** — callers that don't pass it are unaffected (optional chaining).

**In `PreviewPage` and `ConfigurePage`**, handle `onRateLimit`:

```js
onRateLimit: (reset) => {
  const waitMin = reset
    ? Math.ceil((reset * 1000 - Date.now()) / 60000)
    : 15;
  setStreamState(prev => ({
    ...prev,
    status: 'error',
    error: `rate_limited`,
    rateLimitWait: waitMin,
  }));
},
```

**Rate limit error render** in `PreviewPage`:

```jsx
{streamState.error === 'rate_limited' && (
  <div className="error-state error-state--rate-limit" role="alert">
    <p>You've reached the request limit.</p>
    <p>Try again in ~{streamState.rateLimitWait} minute{streamState.rateLimitWait !== 1 ? 's' : ''}.</p>
  </div>
)}
```

No dismiss button — the state clears when the user submits again (and succeeds). No auto-retry — that would just hit the limit again.

**`ConfigurePage`** — if the generate call returns 429, the rate limit message replaces the generic error toast on the submit button area. Same `onRateLimit` callback pattern, same render logic.

> **Deferred:** Countdown timer updating in real time from `RateLimit-Reset`. Persisting the rate limit state across page navigations (currently clears on route change).