---
artifact: ITER_03
status: ready
created: 2026-04-28
scope: OAuth flow for GitHub and GitLab repo creation — replace manual token entry with browser-based auth
sections_changed: [02, 03, 04, 05]
sections_unchanged: [01, 06]
---

# Fullstack Template Generator — Iteration 03

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

### New routes

| Method | Path | Description |
|---|---|---|
| GET | /api/auth/:provider/start | Redirect browser to provider OAuth consent screen |
| GET | /api/auth/:provider/callback | Handle OAuth callback, exchange code for token, redirect to client with token in fragment |
| GET | /api/auth/:provider/revoke | Revoke token with provider (best-effort, no error if it fails) |

`:provider` is `github` or `gitlab`. No new entities — the token is not stored server-side. It is handed to the client in the redirect fragment and held in React state for the session only.

**Token lifetime:** GitHub tokens issued via OAuth apps do not expire unless the user revokes them or the app rotates secrets. GitLab tokens expire after 2 hours by default. Both cases are handled identically: if `/api/export/repo` returns 401, the client clears the token from state and prompts the user to re-authenticate.

**CSRF protection:** The `/start` route generates a random `state` parameter, stores it in a short-lived server-side map (in-memory, keyed by `state` value, TTL 10 minutes), and checks it on `/callback`. Requests arriving at `/callback` with an unknown or expired `state` are rejected with 400. No session cookie is needed — the `state` value is the only server-side state.

**Updated architecture diagram addition:**

```
Browser (React)
    │
    ├── GET /api/auth/:provider/start     ← initiates OAuth dance
    │       │
    │       └── redirect → GitHub / GitLab consent screen
    │                           │
    │       ┌───────────────────┘
    │       ▼
    ├── GET /api/auth/:provider/callback  ← provider redirects here
    │       │
    │       └── redirect → /export#token=<access_token>&provider=<github|gitlab>
    │
    └── POST /api/export/repo             ← unchanged; token now comes from URL fragment state
```

> No other architecture changes — all other routes and services unchanged.

---

## §03 · Tech Stack

New dependencies introduced by this iteration:

| Package | Version | Rationale |
|---|---|---|
| `node-fetch` | `^3.3.2` | GitLab token exchange requires a direct POST — already listed in skeleton for GitLab service; pin here |
| `nanoid` | `^5.0.7` | Generates the CSRF `state` parameter — cryptographically random, URL-safe |

No new frontend dependencies. The OAuth dance is standard browser redirects; no OAuth client library is needed on either side.

**New environment variables:**

```
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_REDIRECT_URI      # e.g. http://localhost:3000/api/auth/github/callback

GITLAB_CLIENT_ID
GITLAB_CLIENT_SECRET
GITLAB_REDIRECT_URI      # e.g. http://localhost:3000/api/auth/gitlab/callback
GITLAB_BASE_URL          # defaults to https://gitlab.com — supports self-hosted instances
```

Both providers are optional. If `GITHUB_CLIENT_ID` is absent, GitHub auth is disabled and the provider option is hidden in the UI. Same for GitLab.

> **Deferred:** Per-IP rate limiting on `/start` to prevent state table exhaustion, token refresh for GitLab (2h expiry — treat as re-auth for now), support for GitHub Apps (separate credential type).

---

## §04 · Backend

### New: `routes/auth.js`

```js
// In-memory state map — fine for single-instance; see deferred note
const pendingStates = new Map(); // state → { provider, expiresAt }

router.get('/:provider/start', (req, res) => {
  const { provider } = req.params;
  if (!['github', 'gitlab'].includes(provider)) return res.status(400).json({ error: 'Unknown provider' });

  const state = nanoid();
  pendingStates.set(state, { provider, expiresAt: Date.now() + 10 * 60 * 1000 });

  const url = provider === 'github'
    ? buildGitHubAuthUrl(state)
    : buildGitLabAuthUrl(state);

  res.redirect(url);
});

router.get('/:provider/callback', async (req, res) => {
  const { code, state } = req.query;
  const entry = pendingStates.get(state);

  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired state' });
  }
  pendingStates.delete(state);

  const token = await exchangeCodeForToken(entry.provider, code);

  // Pass token to client via fragment — never via query string (avoids server logs + referrer headers)
  const clientUrl = `/export#token=${token}&provider=${entry.provider}`;
  res.redirect(clientUrl);
});

router.get('/:provider/revoke', async (req, res) => {
  // Best-effort — swallow errors, always return 200
  try { await revokeToken(req.query.provider, req.query.token); } catch {}
  res.json({ ok: true });
});
```

**Why fragment not query string:** A token in the query string appears in server access logs, browser history, and `Referer` headers sent to third-party scripts. The fragment (`#`) is never sent to the server and is not logged.

### New: `services/oauth.js`

Houses `buildGitHubAuthUrl`, `buildGitLabAuthUrl`, `exchangeCodeForToken`, and `revokeToken`. Keeps auth logic out of the route file.

```js
export function buildGitHubAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_REDIRECT_URI,
    scope: 'repo',          // minimum scope needed to create and push to repos
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(provider, code) {
  if (provider === 'github') {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      }),
    });
    const data = await r.json();
    if (data.error) throw createError(502, `GitHub token exchange failed: ${data.error_description}`);
    return data.access_token;
  }
  // GitLab — same shape, different endpoint
  // ...
}
```

**Scope selection — GitHub:** `repo` grants full repository access including creation. A read-only `public_repo` scope is insufficient for creating private repos. Document this in `.env.example` so operators know what they're granting.

### Updated: `server/.env.example`

```
ANTHROPIC_API_KEY=
PORT=3000
TEMPLATES_DIR=
MAX_TEMPLATE_CHARS=

# GitHub OAuth (optional — omit to disable GitHub repo creation)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
# Note: GITHUB scope requested is "repo" — allows creating public and private repositories

# GitLab OAuth (optional — omit to disable GitLab repo creation)
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
GITLAB_REDIRECT_URI=http://localhost:3000/api/auth/gitlab/callback
GITLAB_BASE_URL=https://gitlab.com
```

### Updated: `docker-compose.yml` additions

The new env vars feed through `env_file` — no compose file changes needed. Operators add the vars to `server/.env`.

### State map TTL cleanup

The `pendingStates` map is in-memory and grows unboundedly if `/start` is called repeatedly without completing the flow. Add a periodic sweep:

```js
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (val.expiresAt < now) pendingStates.delete(key);
  }
}, 60_000); // sweep every minute
```

This runs at module load time. It is sufficient for a single-instance deployment.

> **Deferred:** Multi-instance deployments would need a shared TTL store (Redis, etc.) for the state map — not needed while the app is stateless/single-instance. GitLab token refresh on 2h expiry. Rate limiting on `/start`.

---

## §05 · Frontend

### Updated: `ExportPage` — OAuth connect buttons replace token input

The manual token `<input>` is replaced with per-provider connect buttons. The token is read from the URL fragment on page load (placed there by the server callback redirect) and stored in component state. It is never written to `localStorage` or any persistent store.

**New `ExportPage` state shape:**

```js
const [authState, setAuthState] = useState({
  github: null,   // null | string (access token)
  gitlab: null,
});
```

**Reading the token from the fragment on mount:**

```js
useEffect(() => {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get('token');
  const provider = hash.get('provider');
  if (token && provider) {
    setAuthState(prev => ({ ...prev, [provider]: token }));
    // Clean the fragment from the URL — token must not sit in the address bar
    window.history.replaceState(null, '', window.location.pathname);
  }
}, []);
```

**Cleaning the fragment** after reading it prevents the token from being visible in the address bar, copied in shared URLs, or read by any script that inspects `window.location`.

**Connect button behaviour:**

- If `authState[provider]` is `null`: show "Connect GitHub" button → clicking navigates to `/api/auth/github/start` (full page navigation, not fetch — the server redirects to the provider).
- If `authState[provider]` is set: show "Connected as GitHub ✓" + "Disconnect" link → disconnect calls `GET /api/auth/github/revoke?token=...` then clears state.

**Updated `RepoCreationForm`:** receives `token` and `provider` as props instead of rendering a token input. The form fields (repo name, org/namespace, private toggle) are unchanged.

### Updated: `ProviderPicker` on `ConfigurePage`

Providers with missing server-side credentials (no `GITHUB_CLIENT_ID` env var) should not appear as options. Add a `GET /api/auth/providers` endpoint that returns which providers are configured:

```js
// routes/auth.js addition
router.get('/providers', (req, res) => {
  res.json({
    github: !!process.env.GITHUB_CLIENT_ID,
    gitlab: !!process.env.GITLAB_CLIENT_ID,
  });
});
```

`ProviderPicker` fetches this on mount and hides unconfigured providers. This prevents a user selecting GitHub only to hit an error at the export step.

**ZIP-only mode:** If neither provider is configured, `ProviderPicker` is hidden entirely and the export step shows only the ZIP download button.

### Loading and error additions

| Scenario | Behaviour |
|---|---|
| OAuth callback returns with `#token=...` | Fragment is consumed silently; `ExportPage` shows provider as connected |
| Token exchange fails (server returns 502) | Server redirects to `/export#error=<message>`; `ExportPage` reads it and shows `ErrorToast` |
| `/api/export/repo` returns 401 | Clear token from state, show toast: "Session expired — reconnect GitHub to continue" |
| `/api/auth/providers` fetch fails | Assume no providers configured; show ZIP-only UI |

The error fragment shape from the server on failed token exchange:

```js
res.redirect(`/export#error=${encodeURIComponent(err.message)}`);
```

`ExportPage` checks for `hash.get('error')` before `hash.get('token')` and routes accordingly.

> **Deferred:** GitLab token refresh on 2h expiry (re-auth prompt is sufficient for now), shimmer animations, dark mode.

---

## §06 · LLM / Prompts

> Unchanged — see ITER_01.md §06