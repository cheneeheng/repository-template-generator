---
artifact: ITER_24
status: ready
created: 2026-05-17
scope: >
  Two auth improvements: (1) GitHub Apps credential type alongside existing OAuth app
  support — installation-based auth that grants repo access without a user token;
  (2) automatic GitLab token refresh using the OAuth refresh token, eliminating the
  2-hour re-auth prompt.
sections_changed: [02, 03, 04, 05]
sections_unchanged: [01, 06]
---

# Fullstack Template Generator — Iteration 24

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

### GitHub Apps

GitHub OAuth apps (ITER_03) authenticate as a *user* — the token represents the user's identity and has access to whatever the user can access. GitHub Apps authenticate as an *installation* — the app is installed on a GitHub account or org, and the token represents the app's granted permissions on that installation.

Key difference for this app: GitHub Apps tokens are short-lived (1 hour) and are generated server-side using a JWT signed with the app's private key, then exchanged for an installation access token. The user never sees the token. This is strictly additive — OAuth app auth remains unchanged.

**New flow:**

```
user clicks "Connect via GitHub App"
  → GET /api/auth/github-app/install
  → redirect to GitHub App installation URL
  → user installs (or selects existing installation)
  → GitHub redirects to /api/auth/github-app/callback?installation_id=...&setup_action=...
  → server generates installation access token via GitHub API
  → redirect to /export#token=<installation_token>&provider=github-app
```

The `provider=github-app` value distinguishes the token type on the client. The repo creation call (`POST /api/export/repo`) is unchanged — it sends `token` + `provider` and the server uses the appropriate API path. GitHub installation tokens use the same REST API endpoints as user tokens for repo creation, so no change is needed in `services/github.js`.

**Token refresh:** Installation tokens expire in 1 hour. Since generation + export is typically a short flow, expiry mid-session is unlikely. If `/api/export/repo` returns 401, the client re-triggers the install flow (same re-auth prompt as OAuth). Automatic refresh is deferred — the JWT signing infrastructure needed is the same, but the background refresh adds complexity not justified by the use case.

### GitLab token refresh

GitLab OAuth tokens expire after 2 hours (ITER_03 deferred this). The refresh token flow:

```
POST /api/auth/gitlab/refresh
  body:    { refreshToken: string }
  returns: { accessToken: string, refreshToken: string, expiresAt: number }
```

The client calls this endpoint when a 401 is received from `/api/export/repo`, before showing the re-auth prompt. If the refresh succeeds, the new tokens are stored in component state and the repo creation is retried transparently. If the refresh fails (refresh token also expired — GitLab refresh tokens expire after 30 days), fall through to the re-auth prompt.

**Refresh token storage:** The refresh token must survive the `/export` page session. It is passed alongside the access token in the callback fragment and stored in component state. Like the access token, it is never written to localStorage.

---

## §03 · Tech Stack

New server dependency:

| Package | Version | Rationale |
|---|---|---|
| `jsonwebtoken` | `^9.0.0` | Signs the GitHub App JWT using the app private key (RS256) |

New environment variables:

```
# GitHub App (optional — omit to disable GitHub App auth option)
GITHUB_APP_ID=                  # numeric App ID from the GitHub App settings page
GITHUB_APP_PRIVATE_KEY=         # PEM-encoded private key (newlines as \n in .env)
GITHUB_APP_INSTALLATION_URL=    # https://github.com/apps/<app-slug>/installations/new
```

`GITHUB_APP_PRIVATE_KEY` contains the full PEM string. In `.env` files, embed newlines as literal `\n` (i.e. the two characters backslash and n on a single line). `dotenv` does **not** unescape these automatically — the `generateAppJWT` function handles unescaping with `.replace(/\\n/g, '\n')` at read time.

> Otherwise unchanged — see ITER_16.md §03

---

## §04 · Backend

### New: `services/githubApp.js`

Houses JWT generation and installation token exchange. Kept separate from `services/oauth.js` — different auth model, different signing logic.

```js
import jwt from 'jsonwebtoken';

const GITHUB_API = 'https://api.github.com';

function generateAppJWT() {
  // dotenv does NOT unescape \n — the .replace() below handles the literal \\n
  // that dotenv loads when the PEM is stored as a single-line value in .env
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  // iat and exp set in payload directly; noTimestamp prevents jsonwebtoken
  // from overriding iat. iat is backdated 60s for GitHub's clock skew tolerance.
  return jwt.sign(
    { iat: now - 60, exp: now + 600, iss: String(process.env.GITHUB_APP_ID) },
    privateKey,
    { algorithm: 'RS256', noTimestamp: true }
  );
}

export async function getInstallationToken(installationId) {
  const appJWT = generateAppJWT();
  const r = await fetch(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJWT}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  if (!r.ok) throw new Error(`GitHub App token exchange failed: ${r.status}`);
  const data = await r.json();
  return data.token;   // installation access token, valid for 1 hour
}
```

**`noTimestamp: true`** — prevents `jsonwebtoken` from injecting its own `iat`, which would conflict with the manually backdated value already in the payload.

**`GITHUB_APP_ID` as string** — `jwt.sign` requires the `iss` claim to be a string; `process.env` values are always strings but making this explicit prevents surprises if the value is ever coerced.

### New route: `GET /api/auth/github-app/install`

```js
router.get('/github-app/install', (req, res) => {
  if (!process.env.GITHUB_APP_INSTALLATION_URL) {
    return res.status(404).json({ error: 'GitHub App not configured' });
  }
  res.redirect(process.env.GITHUB_APP_INSTALLATION_URL);
});
```

### New route: `GET /api/auth/github-app/callback`

```js
router.get('/github-app/callback', async (req, res) => {
  if (!process.env.GITHUB_APP_ID) {
    return res.status(404).json({ error: 'GitHub App not configured' });
  }

  const { installation_id, setup_action } = req.query;

  if (setup_action === 'delete') {
    // User uninstalled the app — redirect home with no token
    return res.redirect('/');
  }

  // setup_action may be 'install' or 'update' — both result in a valid installation
  if (!installation_id) {
    return res.redirect(`/export#error=${encodeURIComponent('Missing installation_id')}`);
  }

  try {
    const token = await getInstallationToken(installation_id);
    res.redirect(`/export#token=${token}&provider=github-app`);
  } catch (err) {
    res.redirect(`/export#error=${encodeURIComponent(err.message)}`);
  }
});
```

No CSRF `state` parameter is needed for the GitHub App flow — GitHub App callbacks do not use the OAuth `state` convention. The `installation_id` is not secret; the security is the signed JWT used to exchange it for a token.

### Updated: `GET /api/auth/providers`

```js
router.get('/providers', (req, res) => {
  res.json({
    github: !!process.env.GITHUB_CLIENT_ID,
    githubApp: !!process.env.GITHUB_APP_ID,
    gitlab: !!process.env.GITLAB_CLIENT_ID,
  });
});
```

### New route: `POST /api/auth/gitlab/refresh`

```js
router.post('/gitlab/refresh', async (req, res) => {
  const { refreshToken } = z.object({
    refreshToken: z.string().min(1),
  }).parse(req.body);

  const r = await fetch(`${process.env.GITLAB_BASE_URL ?? 'https://gitlab.com'}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GITLAB_CLIENT_ID,
      client_secret: process.env.GITLAB_CLIENT_SECRET,
      redirect_uri: process.env.GITLAB_REDIRECT_URI,
    }),
  });

  if (!r.ok) {
    // Refresh token expired or invalid — client must re-auth
    return res.status(401).json({ error: 'refresh_failed' });
  }

  const data = await r.json();
  res.json({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
});
```

### Updated: `services/oauth.js` — GitLab callback returns refresh token

The existing `exchangeCodeForToken` for GitLab returns only `access_token`. Update it to also return `refresh_token` and `expires_in`:

```js
// gitlab branch of exchangeCodeForToken
const data = await r.json();
if (data.error) throw createError(502, `GitLab token exchange failed: ${data.error_description}`);
return {
  accessToken: data.access_token,
  refreshToken: data.refresh_token,
  expiresAt: Date.now() + data.expires_in * 1000,
};
```

### Updated: `/api/auth/gitlab/callback` — pass refresh token to client

The callback redirect must carry both tokens. Extend the fragment:

```js
res.redirect(
  `/export#token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&expiresAt=${tokens.expiresAt}&provider=gitlab`
);
```

### Updated: `server/.env.example`

```
# GitHub App (optional — alternative to OAuth app for GitHub repo creation)
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=        # PEM key, newlines as \n
GITHUB_APP_INSTALLATION_URL=   # https://github.com/apps/<slug>/installations/new
```

### Tests

New test file: `server/routes/auth.github-app.test.js`

Cover:
- `/install` redirects to `GITHUB_APP_INSTALLATION_URL`
- `/install` returns 404 when `GITHUB_APP_ID` not set
- `/callback` exchanges `installation_id` for token and redirects with fragment
- `/callback` with `setup_action=delete` redirects to `/`
- `/callback` redirects with `#error=...` when token exchange fails

New test file: `server/routes/auth.gitlab-refresh.test.js`

Cover:
- successful refresh returns new `accessToken`, `refreshToken`, `expiresAt`
- GitLab returning non-ok → 401 `refresh_failed`
- missing `refreshToken` body field → 400 validation error

---

## §05 · Frontend

### Updated: `ExportPage` — GitHub App connect option

When `providers.githubApp` is true, show a second GitHub connect option alongside the existing OAuth button:

```jsx
{providers.githubApp && !authState['github-app'] && (
  <button onClick={() => window.location.href = '/api/auth/github-app/install'}>
    Connect via GitHub App
  </button>
)}
{authState['github-app'] && (
  <span>GitHub App connected ✓</span>
)}
```

The two GitHub options (OAuth user token vs App installation token) are shown independently. A user may have both — whichever was connected most recently is used for export. The `RepoCreationForm` uses whichever `authState` key is populated, preferring `github-app` over `github` if both are set.

### Updated: `ExportPage` — fragment parsing and `authState` shape

`authState` values are unified to objects `{ token, refreshToken?, expiresAt? }` across all providers. This is a breaking change from ITER_03's plain string values — all consumers of `authState[provider]` that previously read the string directly now read `.token`.

```js
useEffect(() => {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get('token');
  const provider = hash.get('provider');

  if (token && provider) {
    const entry = { token };
    if (provider === 'gitlab') {
      entry.refreshToken = hash.get('refreshToken');
      entry.expiresAt = Number(hash.get('expiresAt'));
    }
    setAuthState(prev => ({ ...prev, [provider]: entry }));
    window.history.replaceState(null, '', window.location.pathname);
  }
}, []);
```

All existing uses of `authState['github']` as a string (ITER_03: passed directly as `Authorization: Bearer ${token}`) must be updated to `authState['github']?.token`. The same applies to `authState['github-app']`. Update all call sites in `RepoCreationForm` and `handleCreateRepo`.

### Updated: `ExportPage` — auto-refresh on GitLab 401

When `POST /api/export/repo` returns 401 and the active provider is `gitlab` with a stored refresh token:

```js
async function handleRepoCreate(formData) {
  const { provider } = formData;
  const auth = authState[provider];
  const res = await createRepo({ ...formData, token: auth.token });

  if (res.status === 401 && provider === 'gitlab' && auth?.refreshToken) {
    // Attempt silent refresh before showing re-auth prompt
    const refreshRes = await fetch('/api/auth/gitlab/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    });

    if (refreshRes.ok) {
      const newTokens = await refreshRes.json();
      const newAuth = {
        token: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newTokens.expiresAt,
      };
      setAuthState(prev => ({ ...prev, gitlab: newAuth }));
      // Retry once with the refreshed token
      const retryRes = await createRepo({ ...formData, token: newAuth.token });
      if (!retryRes.ok) setError('Repo creation failed after token refresh');
      return;
    }
    // Refresh failed — fall through to re-auth prompt
  }

  if (res.status === 401) {
    setAuthState(prev => ({ ...prev, [provider]: null }));
    setError(`Session expired — reconnect ${providerLabel(provider)} to continue`);
    return;
  }

  if (!res.ok) setError('Repo creation failed');
}
```

One retry only. The `providerLabel` helper maps `'gitlab'` → `'GitLab'`, `'github'` → `'GitHub'`, etc.

### Tests

Update `ExportPage.test.jsx`:
- shows GitHub App connect button when `providers.githubApp` is true
- GitHub App connect button navigates to `/api/auth/github-app/install`
- fragment with `provider=github-app` sets `authState['github-app']` as an object with `.token`
- fragment with `provider=github` sets `authState['github']` as an object with `.token` (not a plain string)
- fragment with `provider=gitlab` reads `refreshToken` and `expiresAt` alongside token
- 401 on repo creation with gitlab provider triggers refresh call, retries with new token
- 401 on repo creation with github provider (no refreshToken) goes straight to re-auth prompt
- refresh failure clears gitlab auth state and shows re-auth message

---

## §06 · LLM / Prompts

> Unchanged — see ITER_21.md §06

---

## Backlog update

After ITER_24, all planned features are implemented. No remaining deferred items from the active backlog.

Items permanently dropped (see DECISIONS.md for rationale):
- Active route highlighting (D-03)
- Breadcrumbs (D-04)
- Container queries (D-05)
- BuildKit optimisation (D-08)
- Multi-instance Redis coordination (D-09)
- Template library expansion (D-10)
- LLM-as-judge eval (D-14)
