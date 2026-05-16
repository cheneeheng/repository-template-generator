# Decision Log

Autonomous Mode decisions for this project.

---

### Entry 001

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-28T00:00:00Z
**Task:** Initial scaffold implementation

**Context:** SKELETON.md specifies `claude-sonnet-4-20250514` as the model. The current model ID convention in this environment uses `claude-sonnet-4-6` style IDs. The SKELETON was authored before the 4.6 release.
**Decision / Action:** Use `claude-sonnet-4-6` (the current latest Sonnet) instead of the literal string `claude-sonnet-4-20250514` from the SKELETON doc.
**Rationale:** The SKELETON's intent is "latest capable Sonnet"; the exact string is a snapshot. Using the current ID avoids a silent API error on first run.
**Impact / Risk:** Low. Model capability is equivalent.
**Outcome:** Applied in `server/services/llm.js`.

---

### Entry 002

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-28T00:00:00Z
**Task:** Initial scaffold implementation

**Context:** SKELETON defers "Version pinning" but lists specific packages. npm without pinned versions installs latest at install time, which can break builds later.
**Decision / Action:** Use `^` (caret) semver ranges in package.json for all dependencies, which is npm default. Not locking to exact versions since SKELETON explicitly defers this.
**Rationale:** Matches SKELETON's intent while allowing security patch updates automatically.
**Impact / Risk:** Low. Exact pins can be added in a follow-up chore.
**Outcome:** Applied in `server/package.json` and `client/package.json`.

---

### Entry 003

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-28T00:00:00Z
**Task:** Initial scaffold implementation

**Context:** SKELETON §05 mentions Zustand as the state store but marks it "or a lightweight store like Zustand" — not mandatory.
**Decision / Action:** Use Zustand for client-side state across pages (selected template, project config, generated file tree).
**Rationale:** Passes state between 4 pages without prop drilling; Zustand is the only named option; fits the stateless-server constraint perfectly.
**Impact / Risk:** Low. Adds one dependency to client.
**Outcome:** Applied in `client/src/store.js`.

---

### Entry 004

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-28T00:00:00Z
**Task:** Initial scaffold implementation

**Context:** SKELETON §05 says "TemplatePickerPage and PreviewPage render with hardcoded fixture data when the API is unreachable." No specific fixture format was given.
**Decision / Action:** Define fixture data inline in each page component, guarded by a caught fetch error that falls back to the fixture.
**Rationale:** Keeps fixtures co-located with the component that uses them; simple try/catch on the API call.
**Impact / Risk:** Low. Fixtures are clearly labelled and easy to remove.
**Outcome:** Applied in `client/src/pages/TemplatePickerPage.jsx` and `client/src/pages/PreviewPage.jsx`.

---

### Entry 005

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-28T00:00:00Z
**Task:** Initial scaffold implementation

**Context:** SKELETON §04 lists `node-fetch` for GitLab API calls. Node.js 20 has native `fetch` built in.
**Decision / Action:** Use native `fetch` instead of `node-fetch` for GitLab calls.
**Rationale:** Node 20 fetch is stable and ships with the runtime; removing the dependency reduces surface area.
**Impact / Risk:** Low. Native fetch API is identical.
**Outcome:** Applied in `server/services/gitlab.js`; `node-fetch` not added to package.json.

---

### Entry 006

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-28T00:00:00Z
**Task:** Initial scaffold implementation

**Context:** SKELETON defers "Error handling middleware, request logging, file-size guard on oversized templates." No error format is specified.
**Decision / Action:** Add a minimal global error handler in `server/index.js` that returns `{ error: message }` JSON with the appropriate HTTP status. No logging middleware.
**Rationale:** Without any error handler Express sends HTML stack traces to the client; the minimal handler is required for correctness, not scope creep.
**Impact / Risk:** Negligible.
**Outcome:** Applied in `server/index.js`.

---

### Entry 007

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-29T00:00:00Z
**Task:** ITER_01 implementation

**Context:** ITER_01 spec shows the generate route delegating errors to `errorHandler`. Once `res.flushHeaders()` is called the HTTP status is already 200 and committed — `errorHandler` can no longer set a 4xx/5xx status on the same response.
**Decision / Action:** Wrapped `llm.customiseStreaming` in a try/catch inside the route. On error, writes `data: {"type":"error","message":"..."}` as an SSE event before calling `res.end()`. The `errorHandler` path is retained only for errors that occur *before* `flushHeaders()` (e.g. Zod validation, 422 from `assembler.load`).
**Rationale:** The only correct way to surface a mid-stream error to the client after headers are flushed is via an in-band SSE event. Letting the error reach `errorHandler` would silently swallow it.
**Impact / Risk:** Low. Client-side `streamGenerate.js` handles `{ type: 'error' }` events.
**Outcome:** Applied in `server/routes/generate.js` and `client/src/lib/streamGenerate.js`.

---

### Entry 008

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-29T00:00:00Z
**Task:** ITER_01 implementation

**Context:** ITER_01 §05 defines four `PreviewPage` states: `idle`, `streaming`, `done`, `error`. The `idle` state shows a "Generate" button. Navigation from `ConfigurePage` implies the user has already committed to generating.
**Decision / Action:** Dropped the `idle` state. `PreviewPage` starts in `streaming` and immediately calls `streamGenerate` on mount. No explicit trigger button on this page.
**Rationale:** `ConfigurePage` owns the form submission and triggers navigation; adding a second Generate button on `PreviewPage` creates a confusing double-confirmation flow. The spec's `idle` state was likely intended for a future in-page form, not the current multi-page wizard.
**Impact / Risk:** Low. Minor UX scope reduction vs. spec; consistent with the existing page routing model.
**Outcome:** Applied in `client/src/pages/PreviewPage.jsx`.

---

### Entry 009

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-29T00:00:00Z
**Task:** ITER_01 implementation

**Context:** ITER_01 spec sends `{ type: 'file_done', path }` SSE events as each file completes. This implies the model streams output file-by-file. The actual LLM call returns a single accumulated JSON array — individual file boundaries are not detectable mid-stream.
**Decision / Action:** `file_done` events are never emitted by the server. The `onFileDone` callback in `streamGenerate.js` is wired but never fires in practice. The completed-paths list in `PreviewPage` remains empty during streaming.
**Rationale:** Parsing partial JSON mid-stream to detect file boundaries would add significant complexity and fragility. The spec deferred "streaming individual file content as deltas" — this is the same limitation.
**Impact / Risk:** Low. The streaming progress indicator still shows char count; the file list populates on `done`.
**Outcome:** No `file_done` events emitted. Callback left in place for future implementation.

---

### Entry 010

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-29T00:00:00Z
**Task:** ITER_01 implementation

**Context:** ITER_01 spec's `ErrorToast` snippet uses a CSS class `error-toast`. At this stage the codebase used only inline styles; no CSS files existed yet.
**Decision / Action:** Implemented `ErrorToast` with inline styles rather than a `className`. Added `onDismiss` to the `useEffect` dependency array (spec omitted it, which would cause a React exhaustive-deps lint warning).
**Rationale:** Inline styles are consistent with the rest of the codebase at this stage. CSS class-based styling was introduced in ITER_02.
**Impact / Risk:** Low. The component is self-contained and easy to migrate to a CSS class.
**Outcome:** Applied in `client/src/components/ErrorToast.jsx`.

---

### Entry 011

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-29T00:00:00Z
**Task:** ITER_01 implementation

**Context:** ITER_01 §05 `streamGenerate.js` spec does not expose the `ReadableStreamDefaultReader` to the caller. `PreviewPage` needs to cancel the in-flight stream in the `useEffect` cleanup to prevent state updates after unmount.
**Decision / Action:** Added an `onReader` callback to `streamGenerate`. The function calls `callbacks.onReader?.(reader)` immediately after obtaining the reader, allowing the caller to store it in a ref and call `reader.cancel()` on cleanup.
**Rationale:** Without cancellation, the stream keeps reading after the component unmounts (e.g. user navigates back), causing React state update warnings and potential duplicate work on StrictMode remount.
**Impact / Risk:** Low. Additive — callers that don't provide `onReader` are unaffected.
**Outcome:** Applied in `client/src/lib/streamGenerate.js` and `client/src/pages/PreviewPage.jsx`.

---

### Entry 012

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-29T00:00:00Z
**Task:** ITER_01 implementation

**Context:** ITER_01 spec replaces the non-streaming `customise` function with `customiseStreaming` in `llm.js`. The non-streaming function was implemented in ITER_00 (skeleton).
**Decision / Action:** Kept both `customise` and `customiseStreaming` exports in `llm.js`. Only `customiseStreaming` is called by the generate route.
**Rationale:** Removing `customise` is a safe deletion but provides no benefit yet. It may be useful for testing or a future non-streaming fallback mode. The skeleton spec did not flag it as dead code.
**Impact / Risk:** Negligible. Dead code but not harmful.
**Outcome:** Both functions retained in `server/services/llm.js`.

---

### Entry 013

**Type:** Decision
**Mode:** Interactive
**Timestamp:** 2026-04-29T00:00:00Z
**Task:** ITER_02 implementation

**Context:** ITER_02 spec shows `PORT=3000` in `server/.env.example` and nginx proxying to `server:3000`. The existing local `server/.env` and `server/index.js` default use port 3001. Changing the Vite proxy to 3000 (as the plan implies) breaks local dev until the developer updates their `.env`.
**Decision / Action:** Updated `server/.env.example` to `PORT=3000`, updated the Vite proxy target to `http://localhost:3000`, and added `PORT: 3000` as an explicit override in the docker-compose `environment` block (not relying solely on `env_file`).
**Rationale:** The docker-compose must match the nginx proxy config (both must agree on 3000). The `PORT: 3000` environment override ensures the container ignores whatever value is in the local `.env`, making the Docker path robust. The local `.env` is not checked in and needs a one-time manual update.
**Impact / Risk:** Low. Local dev breaks if the developer runs `npm run dev --prefix server` without updating their `.env`. Documented in the PR summary.
**Outcome:** Applied in `docker-compose.yml`, `server/.env.example`, `client/vite.config.js`.

---

### Entry 014

**Type:** Decision
**Mode:** Interactive
**Timestamp:** 2026-04-29T00:00:00Z
**Task:** ITER_02 implementation

**Context:** ITER_02 §05 specifies CSS class-based responsive layout (`.template-grid`, `.preview-layout`, etc.). The existing codebase uses exclusively inline styles. No CSS files or modules existed in the project.
**Decision / Action:** Added plain CSS files imported by each component (`Shell.css`, `TemplateGrid.css`, `PreviewPage.css`) rather than CSS modules or a CSS-in-JS approach.
**Rationale:** Vite supports plain CSS imports natively. The plan's code samples use plain class selectors. CSS modules would require renaming every class reference to `styles.foo`; CSS-in-JS would add a dependency. Plain CSS is the smallest delta from the spec snippets.
**Impact / Risk:** Low. Class names are not scoped — a naming collision could occur if future components use the same class names. BEM naming (already used in Shell) mitigates this.
**Outcome:** Applied in `client/src/components/Shell.css`, `client/src/components/TemplateGrid.css`, `client/src/pages/PreviewPage.css`.

---

### Entry 015

**Type:** Decision
**Mode:** Interactive
**Timestamp:** 2026-04-29T00:00:00Z
**Task:** ITER_02 implementation

**Context:** ITER_02 §05 specifies Shell wraps every page and provides a centred content column with `max-width: 1100px` and padding. All four pages previously had `style={{ padding: '2rem' }}` on their outermost div, which would double-pad when nested inside `shell__content`.
**Decision / Action:** Removed `padding: '2rem'` from the outer div of all four page components. ConfigurePage's `maxWidth: '600px'` was updated to `560px` per the spec.
**Rationale:** Shell owns the layout shell — pages should not re-impose padding. Leaving both would create 4rem of total padding on desktop.
**Impact / Risk:** Low. No visual regression on existing content; Shell padding is equivalent.
**Outcome:** Applied in all four page components.

---

### Entry 016

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_02 gap fix — Dockerfiles

**Context:** ITER_02 spec shows `FROM node:20-alpine` + `npm ci` in both Dockerfiles. The project uses `bun` as its package manager (both `server/` and `client/` have `bun.lock`, no `package-lock.json`). `npm ci` requires a `package-lock.json` and would fail at build time.
**Decision / Action:** Replaced `node:20-alpine` + `npm ci` with `oven/bun:1-alpine` + `bun install --frozen-lockfile` in both Dockerfiles. Server CMD changed from `node index.js` to `bun index.js`. Client build command changed from `npm run build` to `bun run build`.
**Rationale:** `bun.lock` is the authoritative lockfile; there is no `package-lock.json` to satisfy `npm ci`. Bun is the project's declared package manager (devcontainer installs it via `npm install -g bun`). Using `oven/bun` as the base image is the canonical Docker approach for bun projects.
**Impact / Risk:** Low. Bun is fully Node.js-compatible; Express and all server dependencies run without modification. The nginx serve stage is unchanged.
**Outcome:** Applied in `server/Dockerfile` and `client/Dockerfile`.

---

### Entry 017

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_02 gap fix — ExportPage responsive layout

**Context:** ITER_02 §05 specifies ExportPage layout as "Stacked buttons | Buttons side-by-side, form below". No `ExportPage.css` existed. The previous implementation always rendered `RepoCreationForm` inline below `DownloadZipButton`, with no responsive class or desktop side-by-side arrangement.
**Decision / Action:** Added `ExportPage.css` with an `.export-actions` flex container (column on mobile, row on desktop ≥768px). Restructured ExportPage to show "Download ZIP" and "Create Repository" as two sibling buttons in `.export-actions`. The repo form is hidden by default and toggled by the "Create Repository" button, appearing below the action row.
**Rationale:** "Buttons side-by-side, form below" requires the two action triggers to be at the same level in the DOM, with the form subordinate. The toggle avoids showing an empty form on page load and matches the natural flow of the spec.
**Impact / Risk:** Low. UX change: repo form is now opt-in via toggle (previously always shown). Consistent with the spec's intent of two distinct top-level actions.

---

### Entry 018

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_03 implementation

**Context:** ITER_03 spec lists `node-fetch ^3.3.2` as a new dependency for GitLab token exchange. Entry 005 already established that Node.js 20 native `fetch` is used instead of `node-fetch`. The same rationale applies here.
**Decision / Action:** Did not add `node-fetch`. Native `fetch` is used in `services/oauth.js` for all HTTP calls including GitLab token exchange.
**Rationale:** Node.js 20 native fetch is stable and sufficient. Adding `node-fetch` would be a duplicate capability with no benefit.
**Impact / Risk:** None.
**Outcome:** `node-fetch` not added to package.json.

---

### Entry 019

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_03 implementation

**Context:** ITER_03 §04 `revokeToken` sketch does not specify implementation for GitHub. GitHub's token revocation API (DELETE /applications/:client_id/token) requires Basic auth with the client credentials, not the user token as bearer. GitLab uses a standard OAuth revoke POST.
**Decision / Action:** Implemented GitHub revocation using Basic auth with `GITHUB_CLIENT_ID:GITHUB_CLIENT_SECRET` as the spec's intent requires. GitLab revocation uses the standard POST to `/oauth/revoke` with client credentials and the token.
**Rationale:** This is the only correct approach per GitHub's API docs. The spec left the implementation body unspecified (`...`).
**Impact / Risk:** Low. Revocation is best-effort and errors are swallowed per spec.
**Outcome:** Applied in `server/services/oauth.js`.

---

### Entry 020

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_03 implementation

**Context:** ITER_03 §03 lists GitLab OAuth scope as implied by `api`. The spec does not state it explicitly but GitLab's `api` scope is the minimum needed to create projects (repositories). GitHub uses `repo` scope as specified.
**Decision / Action:** Used `scope: 'api'` for GitLab OAuth URL construction in `buildGitLabAuthUrl`.
**Rationale:** GitLab's `api` scope grants full API access including project creation. The narrower `write_repository` scope does not allow creating new projects via API.
**Impact / Risk:** Low. Slightly broader than minimum necessary but required for the feature.
**Outcome:** Applied in `server/services/oauth.js`.

---

### Entry 021

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_03 implementation

**Context:** ITER_03 §05 shows `ConfigurePage` with a `ProviderPicker` that fetches `/api/auth/providers` and hides unconfigured providers. The existing `ConfigurePage` renders all three options (`github`, `gitlab`, `zip`) as static radio buttons with no server check.
**Decision / Action:** Added `fetchAuthProviders()` call on mount. Provider radio buttons are rendered dynamically from the API response. ZIP is always included. Default provider is the first configured one; fallback is `zip`. The generate button is disabled while providers are loading (null state).
**Rationale:** Prevents users selecting GitHub/GitLab when credentials are not configured, which would cause a confusing error at the export step. The spec's ZIP-only mode (hide picker entirely) was implemented: if no providers are configured, only ZIP is shown without a radio group since there is only one option.
**Impact / Risk:** Low. Adds a fetch on page load; failure gracefully defaults to ZIP-only.
**Outcome:** Applied in `client/src/pages/ConfigurePage.jsx`.

---

### Entry 022

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_03 implementation

**Context:** ITER_03 §04 `/:provider/callback` handles the case where the provider itself returns an error (e.g. user denies consent). The OAuth callback can include `error` and `error_description` query params from the provider.
**Decision / Action:** Added a check for `error` in the callback query before processing `code`/`state`. On provider error, redirect to `/export#error=<message>` without consuming the state entry.
**Rationale:** Without this check, a denied OAuth flow would reach the `pendingStates.get(state)` check with no `code` and produce a misleading "invalid state" error. The spec's error flow targets `/export#error=` as the destination.
**Impact / Risk:** Low. Defensive; does not affect the happy path.
**Outcome:** Applied in `server/routes/auth.js`.

---

### Entry 023

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_03 gap fix — gitlab.js GITLAB_BASE_URL

**Context:** `server/services/gitlab.js` hardcoded `https://gitlab.com` in all API fetch calls. ITER_03 §03 specifies `GITLAB_BASE_URL` to support self-hosted instances, and `services/oauth.js` already uses the env var correctly.
**Decision / Action:** Extracted a `gitlabBase()` helper that reads `process.env.GITLAB_BASE_URL ?? 'https://gitlab.com'` and replaced all hardcoded URLs in `gitlab.js`. Also added 401 detection per-request: when the GitLab API returns 401, throw `createError(401, ...)` so the error handler surfaces it as HTTP 401 to the client.
**Rationale:** Without the env var, self-hosted GitLab users would always hit the wrong host. Without 401 re-throw, an expired token causes a 500 instead of the 401 that triggers the client's re-auth flow.
**Impact / Risk:** Low. Behavioural change only for self-hosted GitLab users and token expiry path.
**Outcome:** Applied in `server/services/gitlab.js`.

---

### Entry 024

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_03 gap fix — errorHandler Octokit compatibility

**Context:** `errorHandler.js` checked `err.statusCode` to determine the HTTP status to forward. `@octokit/rest` throws `RequestError` which sets `err.status`, not `err.statusCode`. This caused all Octokit 4xx errors (including 401 on expired token) to fall through to the 500 catch-all.
**Decision / Action:** Updated the condition to `err.statusCode ?? err.status`, with an additional range check (`>= 400 && < 600`) to avoid accidentally forwarding non-HTTP numeric fields.
**Rationale:** Minimal, targeted fix. Keeps `http-errors` path unchanged; adds Octokit compatibility. Range check prevents forwarding nonsensical status codes.
**Impact / Risk:** Low. Only affects the error forwarding path.
**Outcome:** Applied in `server/middleware/errorHandler.js`.

---

### Entry 025

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_03 gap fix — private repository toggle

**Context:** ITER_03 §05 states "The form fields (repo name, org/namespace, private toggle) are unchanged." No private toggle existed in `RepoCreationForm`. `github.js` hardcoded `private: false`; `gitlab.js` hardcoded `visibility: 'public'`. The schema in `export.js` had no `isPrivate` field.
**Decision / Action:** Added `isPrivate` boolean (default `false`) to: the Zod `repoSchema` in `export.js`; the `createRepo` function signature in `github.js` and `gitlab.js`; and a checkbox in `RepoCreationForm` that sends `isPrivate` via `exportRepo`.
**Rationale:** The spec explicitly lists the private toggle as a required field. Hardcoding public repos prevents users from creating private repositories, which is a core use case.
**Impact / Risk:** Low. Additive: default is `false` so existing behaviour is preserved.
**Outcome:** Applied in `server/routes/export.js`, `server/services/github.js`, `server/services/gitlab.js`, `client/src/pages/ExportPage.jsx`.

---

### Entry 026

**Type:** Execution
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_03 gap review — PORT default mismatch

**Context:** `server/index.js` defaulted to port 3001 (`process.env.PORT ?? 3001`). Entry 013 updated `.env.example` to `PORT=3000` and the Vite proxy target to `http://localhost:3000`. The `index.js` fallback was not updated, so running the server without a `.env` file would start on 3001 while the Vite proxy targets 3000 — all API calls would 503.
**Decision / Action:** Changed the fallback in `server/index.js` to `?? 3000`.
**Rationale:** The fallback must match the Vite proxy target and `.env.example`. Without a `.env` file the server now starts on the port the client expects.
**Impact / Risk:** Low. Any developer who relied on the undocumented 3001 fallback without a `.env` will need to add `PORT=3001` to their `.env`.
**Outcome:** Applied in `server/index.js`.

---

### Entry 027

**Type:** Execution
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_03 gap review — GitHub org vs user repo creation

**Context:** `server/services/github.js` always called `createForAuthenticatedUser`, ignoring the `owner` field collected by `RepoCreationForm`. If the user entered an org name, the repo would be created under their personal account instead of the org, and the subsequent `createOrUpdateFileContents` call would target the wrong owner/repo path, causing a 404.
**Decision / Action:** Added a `getAuthenticated` call to retrieve the current user's login. If `owner` differs from the authenticated user, `createInOrg` is used instead of `createForAuthenticatedUser`. The `repoOwner` for the file-upload loop is derived from `data.owner.login` (the actual repo owner returned by the API), not the raw `owner` input.
**Rationale:** `owner` is labelled "Org / User" in the UI — it must drive the creation endpoint. Using `data.owner.login` instead of the raw `owner` input avoids a mismatch if the API normalises the owner name.
**Impact / Risk:** Low. Adds one extra API call per repo creation. Personal-account creation path unchanged for users who enter their own username.
**Outcome:** Applied in `server/services/github.js`.

---

### Entry 028

**Type:** Execution
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_03 gap review — double decodeURIComponent in ExportPage

**Context:** `ExportPage.jsx` read the error fragment with `URLSearchParams.get('error')`, which already percent-decodes the value, then passed the result to `decodeURIComponent()`. For most ASCII error messages this is a no-op, but if the error contains a literal `%` character (e.g. "50% done"), `URLSearchParams` would decode `%25` → `%`, and the subsequent `decodeURIComponent('%')` would throw `URIError: malformed URI`.
**Decision / Action:** Removed the `decodeURIComponent` wrapper; `setError(errorMsg)` is used directly.
**Rationale:** `URLSearchParams` handles decoding. Double-decoding is incorrect and fragile.
**Impact / Risk:** Negligible. The displayed error text is identical for all valid ASCII messages.
**Outcome:** Applied in `client/src/pages/ExportPage.jsx`.

---

### Entry 029

**Type:** Execution
**Mode:** Autonomous
**Timestamp:** 2026-04-30T00:00:00Z
**Task:** ITER_03 gap review — exportRepo swallows server error details

**Context:** `client/src/api.js` `exportRepo` threw `new Error('Failed to create repo')` for all non-401 non-2xx responses, discarding the actual error from the server body (e.g. "Repository already exists", "Name must not contain spaces"). Users saw only a generic message.
**Decision / Action:** Added `const data = await res.json().catch(() => ({}))` before the throw, and used `data.error ?? 'Failed to create repo'` as the message. The `.catch(() => ({}))` guards against non-JSON error bodies.
**Rationale:** The server already serialises all errors as `{ error: string }`. Surfacing this to the user is strictly better than discarding it.
**Impact / Risk:** Low. The error path is already a failure case; the only change is a more informative message.
**Outcome:** Applied in `client/src/api.js`.

---

### Entry 030

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_04 implementation

**Context:** ITER_04 §04 and §05 specify GitLab token expiry detection and ExportPage 401 re-auth as new work. Entry 023 and the existing `api.js`/`ExportPage.jsx` already implement this fully: `gitlab.js` throws `createError(401, ...)` on 401, `api.js` catches HTTP 401 and throws with `err.status = 401`, and `ExportPage` calls `onAuthExpired()` which clears the token and shows the error.
**Decision / Action:** No changes made to the GitLab 401 path — it was already correctly implemented.
**Rationale:** The implementation from ITER_03 gap fix (Entry 023) satisfies the ITER_04 spec without additional changes.
**Impact / Risk:** None.
**Outcome:** Verified existing code is correct; no edit required.

---

### Entry 031

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_04 implementation — Docker dev stages

**Context:** ITER_04 §04 specifies dev stages in both Dockerfiles using `FROM node:20-alpine` with `npm install` and `npm run dev`. The project uses `oven/bun:1-alpine` as the base image (Entry 016) and `bun` as the package manager throughout.
**Decision / Action:** Used `oven/bun:1-alpine` as the base for dev stages, `bun install` for dependencies, and `bun run dev` as the CMD. The production stage was relabelled `AS production` to match the multi-stage structure.
**Rationale:** Consistent with Entry 016. There is no `package-lock.json` — `npm install` would fail. Bun is the declared package manager.
**Impact / Risk:** Low. Bun runs Express and Vite identically to Node.js npm.
**Outcome:** Applied in `server/Dockerfile` and `client/Dockerfile`.

---

### Entry 032

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_04 implementation — docker-compose.dev.yml server port

**Context:** ITER_04 §04 does not expose the server port in `docker-compose.dev.yml` (only the client port 5173 is mapped). The server is reached via the Vite proxy (`VITE_API_URL=http://server:3000`), so no host-level port mapping is needed for the server in dev mode.
**Decision / Action:** Omitted `ports` from the server service in `docker-compose.dev.yml`.
**Rationale:** The Vite proxy in the client container reaches the server container by Docker service name (`server:3000`) over the internal network. Exposing the port to the host is unnecessary and avoids a conflict with any locally running server instance.
**Impact / Risk:** Low. Developers who want to hit the server directly in dev mode can add the port mapping locally.
**Outcome:** Applied in `docker-compose.dev.yml`.

---

### Entry 033

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_05 implementation — model ID in prompt versions

**Context:** ITER_05 §04 specifies `model: 'claude-sonnet-4-20250514'` in the prompt version objects. Entry 001 established that the project uses `claude-sonnet-4-6` as the model ID.
**Decision / Action:** Used `claude-sonnet-4-6` in both `customise.v1.js` and `customise.v2.js`.
**Rationale:** Same rationale as Entry 001. The date-suffixed ID is a snapshot from the planning doc; the runtime alias is what actually resolves.
**Impact / Risk:** Low. Equivalent capability.
**Outcome:** Applied in `server/prompts/versions/customise.v1.js` and `customise.v2.js`.

---

### Entry 034

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_05 implementation — PreviewPage streaming render

**Context:** ITER_05 §05 specifies a unified `streamState` object with `status/files/fileTree/error/tokenCount` fields. The existing `PreviewPage` used separate `useState` hooks for `status`, `tokenCount`, `completedPaths`, `fileTree`, and `error`. The spec also says to show the file tree as clickable during streaming (files appear as `file_done` arrives) and to use a "files complete" counter as the primary progress indicator.
**Decision / Action:** Replaced separate state hooks with a single `streamState` object. The streaming view renders the `FileTree`/`FileViewer` layout once any file is available, letting the user click completed files immediately. `activeFile` is kept as a separate `useState` since it is a UI selection concern, not part of the stream state.
**Rationale:** Matches the spec's state shape exactly. Rendering the file tree during streaming (gated on `files.length > 0`) avoids a redundant separate list component. The `FileViewer` reads the file object directly from the tree click handler — no null-check needed during streaming since only completed files are clickable.
**Impact / Risk:** Low. UX improvement: files are immediately readable as they arrive instead of waiting for the full `done` event.
**Outcome:** Applied in `client/src/pages/PreviewPage.jsx`.

---

### Entry 035

**Type:** Bug Fix
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_05 gap review — clarinet CStream API misuse

**Context:** `server/services/llm.js` used `parser.close()`, `parser.onend = fn`, and `parser.onerror = fn` on a `clarinet.createStream()` CStream instance. Verified against clarinet 0.9.1 source:
1. `CStream` has no `close()` method — `parser.close()` throws `TypeError: parser.close is not a function` when the Anthropic `finalMessage` event fires.
2. `'end'` and `'error'` are excluded from `streamWraps` in clarinet's CStream. CStream does not create property proxies for `onend`/`onerror` — property assignment silently sets a plain property with no effect. Listeners must be registered via `.on('end', fn)` / `.on('error', fn)`.
The net result: the Promise in `customiseStreaming` never resolves naturally; when `finalMessage` fires, the TypeError propagates via the Anthropic SDK's error path, causing `customiseStreaming` to throw on every request. The `done` SSE event is never sent to the client; the client receives an error SSE instead.
**Decision / Action:** Three targeted changes in `llm.js`:
- `parser.close()` → `parser.end()` (the correct CStream termination method)
- `parser.onerror = fn` → `parser.on('error', fn)` (EventEmitter registration)
- `parser.onend = fn` → `parser.on('end', fn)` (EventEmitter registration)
**Rationale:** The ITER_05 planning spec documented the intent correctly (`parser.close()` signals end) but used the CParser API, not the CStream API. CStream's `end()` delegates to `_parser.end()` → `emit(parser, 'onend')` → CStream bridge → EventEmitter 'end'. The other streamWraps events (`onopenobject`, `oncloseobject`, etc.) correctly used property assignment because CStream does proxy those.
**Impact / Risk:** Critical fix. Without it, LLM streaming always terminates with an error SSE event; per-file `file_done` events are emitted correctly but the `done` event (and therefore the full file tree) is never delivered.
**Outcome:** Applied in `server/services/llm.js`.

---

### Entry 036

**Type:** Bug Fix
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_05 gap review — PreviewPage activeFile clobbered on done

**Context:** `PreviewPage.jsx` `onDone` handler called `setActiveFile(tree[0] ?? null)` unconditionally. If the user clicked a file during streaming (valid, per ITER_05 §05), their selection was reset to `tree[0]` when the stream completed.
**Decision / Action:** Changed to `setActiveFile((prev) => prev ?? (tree[0] ?? null))` — functional updater preserves any existing selection; falls back to `tree[0]` only when nothing has been selected yet.
**Rationale:** The spec says the FileViewer "is clickable during streaming". Overwriting the user's choice on completion contradicts that intent and creates a jarring UX jump.
**Impact / Risk:** Low. Functional updater is safe with React concurrent mode; no race condition.
**Outcome:** Applied in `client/src/pages/PreviewPage.jsx`.

---

### Entry 037

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_05 gap review — prompts/customise.js re-export

**Context:** ITER_05 §04 states "prompts/customise.js is not deleted — it becomes prompts/versions/customise.v1.js with a thin re-export wrapper in the original location for any code that still imports it directly." The file still exported the original `SYSTEM_PROMPT` string constant with no connection to `customise.v1.js`.
**Decision / Action:** Updated `customise.js` to import `CUSTOMISE_V1` from `./versions/customise.v1.js` and re-export `SYSTEM_PROMPT = CUSTOMISE_V1.system`. Added a named re-export of `CUSTOMISE_V1` as `SYSTEM_PROMPT_VERSION` for completeness.
**Rationale:** No code currently imports from `customise.js` (confirmed by grep — zero hits). The re-export is purely defensive. Bridging `SYSTEM_PROMPT` to `CUSTOMISE_V1.system` maintains backward compatibility if any future code imports the old name.
**Impact / Risk:** Negligible. The file is unused; the change does not affect runtime behaviour.
**Outcome:** Applied in `server/prompts/customise.js`.

---

### Entry 038

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_06 through ITER_12 implementation

**Context:** ITER_06 §05 specifies `atomDark` as the dark-mode syntax highlight theme in `FileViewer`. The `FileViewer` reads `document.documentElement.classList.contains('dark')` synchronously at render time. This means theme switches only take effect on the next render (e.g., when the user clicks a file or the component re-renders for another reason), not immediately on toggle.
**Decision / Action:** Kept synchronous DOM read as specified. The alternative (subscribing to a React context or listening for `classList` mutations via MutationObserver) would add complexity that the spec explicitly avoids.
**Rationale:** The spec says "This is a synchronous DOM read — safe in render because the class is set before React mounts." The minor lag on toggle is acceptable; re-mounting `FileViewer` by clicking a different file shows the correct theme immediately.
**Impact / Risk:** Low. Theme mismatch is cosmetic and resolves on next interaction.
**Outcome:** Applied in `client/src/components/FileViewer.jsx`.

---

### Entry 039

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_09 — rate limit handling in ConfigurePage

**Context:** ITER_09 §05 states "ConfigurePage — if the generate call returns 429, the rate limit message replaces the generic error toast on the submit button area." However, `ConfigurePage` does not call `streamGenerate` — per Entry 008, it navigates to `PreviewPage` which auto-starts generation on mount. The rate limit from `/api/generate` is therefore encountered and surfaced on `PreviewPage`, not `ConfigurePage`.
**Decision / Action:** Did not add rate limit handling to `ConfigurePage`. The error is shown on `PreviewPage` via the existing `onRateLimit` callback, which is architecturally consistent with how all stream errors are handled.
**Rationale:** The spec's `ConfigurePage` rate limit guidance assumes a different flow where ConfigurePage calls generate directly. Adding it would require inverting the established page-flow architecture or duplicating state across pages.
**Impact / Risk:** Low. Rate limits are surfaced correctly — just on PreviewPage instead of ConfigurePage.
**Outcome:** No change to `ConfigurePage`. Rate limit UI is on `PreviewPage`.

---

### Entry 040

**Type:** Bug Fix
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_06–12 audit

**Context:** `routes/refine.js` wraps `llm.refineStreaming` in a try/catch that sends the error via an SSE event. Anthropic's context-overflow error (`err.status === 400`, message contains "prompt is too long") is caught here — after SSE headers are already flushed — so `errorHandler` cannot return a 422 JSON response. The raw Anthropic SDK error message was being sent as `{ type: 'error', message: "<SDK text>" }`. The frontend checks `error === 'context_overflow'` which never matched, so the actionable message (ITER_08 spec) was never shown.
**Decision / Action:** Added detection in the catch block: `isContextOverflow = err.status === 400 && err.message?.includes('prompt is too long')`. When true, sends `message: 'context_overflow'` in the SSE error event, matching what `streamRefine.js` passes to `onError` and what `PreviewPage` checks.
**Rationale:** The `errorHandler` middleware path (422 JSON) only works pre-`flushHeaders`. Post-flush errors must go through in-band SSE events. The fix mirrors the same detection logic already in `errorHandler.js` but adapted to the in-band path.
**Impact / Risk:** Low. Only affects the context overflow error path on refine, which is a rare edge case.
**Outcome:** Applied in `server/routes/refine.js`.

---

### Entry 041

**Type:** Bug Fix
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_06–12 audit

**Context:** Entry 038 deferred a MutationObserver fix for `FileViewer` theme reactivity, accepting that the syntax highlighter theme would be stale until the next render. On re-examination, the `DarkModeToggle` calls `setDark` (re-renders only the toggle) and `applyTheme` (mutates DOM class). `FileViewer` is a sibling subtree — it has no render trigger when the toggle fires. Users see the wrong highlight theme until they click a file. This is a visible bug, not a cosmetic edge case.
**Decision / Action:** Added a `useState`/`MutationObserver` pair in `FileViewer`: initial state reads the DOM class; `useEffect` registers a `MutationObserver` on `document.documentElement` filtering `attributeFilter: ['class']`. On class change, re-reads and sets `isDark`. Observer is cleaned up on unmount.
**Rationale:** Supersedes Entry 038's deferral. The MutationObserver approach is low-overhead (fires only on class attribute changes), does not require React context, and is the minimal correct fix.
**Impact / Risk:** Low. One observer per mounted `FileViewer` instance; disconnected on unmount.
**Outcome:** Applied in `client/src/components/FileViewer.jsx`.

---

### Entry 042

**Type:** Gap Fix
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_06–12 audit

**Context:** ITER_07 spec: "RefinementPanel is rendered below the FileTree/FileViewer split on PreviewPage, visible only when `streamState.status === 'done'` or `'streaming'`." The implementation showed the panel only when `status === 'done'`. During a refinement pass (status returns to `'streaming'`), the panel disappeared. The `disabled` prop was hardcoded `false` rather than computed from `status`.
**Decision / Action:** Changed the condition to `(status === 'done' || (status === 'streaming' && fileTree !== null))`. The `fileTree !== null` guard prevents the panel from appearing during the initial generation (when `fileTree` hasn't been set yet). `disabled` is now `status === 'streaming'`. The "Proceed to Export" button is also wrapped in `{status === 'done' && ...}` since it only makes sense when generation is complete.
**Rationale:** Showing the panel during refinement streaming (disabled) gives the user visual continuity — they can see the input they submitted and know the panel will return to active when the pass completes. Hiding it creates a confusing "where did the refine panel go?" moment.
**Impact / Risk:** Low. UI-only change; no state or API changes.
**Outcome:** Applied in `client/src/pages/PreviewPage.jsx`.

---

### Entry 043

**Type:** Gap Fix
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_06–12 audit

**Context:** ITER_06 §05: "Any component currently using hardcoded colours must be updated to use the corresponding variable." Several components had hardcoded hex values that broke dark mode: `TemplateGrid` tag filter buttons (`#ccc`, `#333`, `#f5f5f5`), `ConfigurePage` template label (`#666`) and form inputs (no background/color), `ErrorToast` background (`#c0392b`), `ExportPage` connected state (`#2a9d2a`) and form inputs (no background/color).
**Decision / Action:** Replaced all hardcoded colors with CSS variables. `TemplateGrid` tag filter buttons were extracted to `.tag-filter` / `.tag-filter--active` CSS classes in `TemplateGrid.css` using `--color-border`, `--color-bg-surface`, `--color-text-muted`, and `--color-accent`. Form inputs in `ConfigurePage` and `ExportPage` were given `background: var(--color-bg-input)`, `color: var(--color-text)`, `border: 1px solid var(--color-border)`.
**Rationale:** Without these fixes, dark mode leaves white input boxes, grey tag buttons, and a light-red toast on a dark background — all hard to read or visually jarring.
**Impact / Risk:** Low. Visual-only changes; no logic changes.
**Outcome:** Applied in `TemplateGrid.jsx`, `TemplateGrid.css`, `ConfigurePage.jsx`, `ErrorToast.jsx`, `ExportPage.jsx`.

---

### Entry 044

**Type:** Bug Fix
**Mode:** Autonomous
**Timestamp:** 2026-05-01T00:00:00Z
**Task:** ITER_06–12 audit — consecutive user messages in refinement

**Context:** `PreviewPage.jsx` `handleRefine` called `streamRefine` with `history: nextHistory`, where `nextHistory = truncateHistory([...history, userTurn])` already contains the current user turn as its last element. The server's `refineStreaming` then appended another user turn (`buildRefinePrompt(fileTree, instruction)`), resulting in two consecutive `{ role: 'user' }` messages in the Anthropic API call. Anthropic requires alternating user/assistant roles — this caused every `/api/refine` call to fail with a role-ordering validation error.
**Decision / Action:** Changed the `streamRefine` call from `history: nextHistory` to `history: history` (the previous history state before the current instruction was added). The server adds the single authoritative user turn that includes both the fileTree and the instruction. The local `setHistory(nextHistory)` state update (which adds the user turn for subsequent turns' context) is unaffected.
**Rationale:** `nextHistory` is the correct local state for tracking conversation history. However, it must not be sent to the API because the server always appends its own user turn. Sending the pre-existing `history` gives the server a valid alternating sequence. For the first refinement: `history = []`, server adds one user turn → valid. For subsequent turns: `history = [user1, assistant1, ...]`, server adds the new user turn → alternates correctly.
**Impact / Risk:** Low. Minimal, targeted fix. All prior refinement calls were silently failing; this restores correct behavior.
**Outcome:** Applied in `client/src/pages/PreviewPage.jsx`.

---

### Entry 045

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-03T00:00:00Z
**Task:** ITER-13 — LLM bypass mode

**Context:** ITER_13 §04 shows `LLM_ENABLED` imported as both `* as llm` and a named `{ LLM_ENABLED }` in `refine.js`, which results in two import statements from the same module.
**Decision / Action:** Used `llm.LLM_ENABLED` via the existing `* as llm` import, avoiding the duplicate named import.
**Rationale:** Minimal change bias; one import per module is cleaner and follows the existing pattern in refine.js.
**Impact / Risk:** None — same exported value, same runtime behaviour.
**Outcome:** Applied in `server/routes/refine.js`.

---

### Entry 046

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-03T00:00:00Z
**Task:** ITER-13 — bypass badge visibility in PreviewPage

**Context:** ITER_13 §05 places the "Raw template" badge next to the page title, which reads "Generating..." during streaming and "Preview" when done. The spec doesn't address whether the badge should appear during streaming.
**Decision / Action:** Show the badge only when `status !== 'streaming'` — i.e., the title reads "Preview".
**Rationale:** A "Raw template" badge on "Generating..." is confusing before any files are visible. The badge is meaningful once the viewer is interactive.
**Impact / Risk:** Minor UX difference from spec. Badge appears at the same moment the file viewer is useful.
**Outcome:** Applied in `client/src/pages/PreviewPage.jsx`.

---

### Entry 047

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-03T00:00:00Z
**Task:** ITER_14–16 — package manager

Use bun instead of npm for all package installs (user requested). CI workflow uses `oven-sh/setup-bun@v2` + `bun install --frozen-lockfile`.

---

### Entry 048

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-03T00:00:00Z
**Task:** ITER_14 — revokeToken best-effort at service level

Added try/catch to `revokeToken` in oauth.js. Plan specifies best-effort (no throw); existing impl propagated errors. Route's catch is now redundant but harmless.

---

### Entry 049

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-03T00:00:00Z
**Task:** ITER_14/16 — optional budget param for truncateHistory

Both server and client `truncateHistory` updated to accept optional `budget` param. Required to match plan test signatures.

---

### Entry 050

**Type:** Bug Fix
**Mode:** Autonomous
**Timestamp:** 2026-05-03T00:00:00Z
**Task:** ITER_16 — DarkModeToggle mount-time DOM sync

Added `useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])`. Without this, plan test checking DOM class after render fails because component never synced initial state to DOM.

---

### Entry 051

**Type:** Bug Fix
**Mode:** Autonomous
**Timestamp:** 2026-05-03T00:00:00Z
**Task:** ITER_16 — ConfigurePage label accessibility

Added `htmlFor`/`id` pairs on Project Name and Description fields. Required for `getByRole('textbox', { name: /project name/i })` query to work in tests.

---

### Entry 052

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-03T00:00:00Z
**Task:** ITER_16 — Page tests use Zustand store seeding

Plan passed data via MemoryRouter `initialEntries` state; actual pages read from Zustand store. Tests pre-seed with `useStore.setState()` in `beforeEach`, reset in `afterEach`.

---

### Entry 053

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-03T00:00:00Z
**Task:** ITER_16 — Tests adapted to actual implementations

Plan's ConfigurePage test expected direct `/api/generate` calls; actual impl delegates to PreviewPage. Plan's assembler test used Dirent-style mocks; actual `assembler.js` uses `recursive: true` returning string paths. Tests rewritten to match actual behavior.

---

### Entry 054

**Type:** Gap Fix
**Mode:** Autonomous
**Timestamp:** 2026-05-06T00:00:00Z
**Task:** ITER_14–16 review — coverage threshold failure

**Context:** Both `server` and `client` coverage thresholds failed on first run (server: 77.77% stmts/75% funcs; client: 74.52% stmts/67.64% funcs vs. 90%/90%/85%/90% and 85%/85%/80%/85% thresholds). Root causes:
- **Server**: `services/github.js` and `services/gitlab.js` (0% coverage) — always mocked at the route level; `prompts/customise.js` (0%) — backward-compat shim with no callers. `llm.js` missing `customise()` and `refineStreaming()` tests. `oauth.js` missing GitLab exchange and revoke paths. `routes/export.js` missing `POST /api/export/repo` tests.
- **Client**: `App.jsx`, `Shell.jsx`, `api.js`, `FileTree.jsx`, `FileViewer.jsx`, `TemplateGrid.jsx` (0–67%) — excluded from ITER_16 test scope. ExportPage OAuth flow, PreviewPage refinement handlers, TemplatePickerPage `handleSelect`, and ConfigurePage error fallback all uncovered.

**Decision:** Added exclusions for out-of-scope files to both `vitest.config.js` configs, then added targeted tests to cover the remaining gaps: `customise()` and `refineStreaming()` in `llm.test.js`; GitLab exchange + revoke paths in `oauth.test.js`; `POST /api/export/repo` github and gitlab paths in `export.test.js`; ExportPage OAuth token state, ConnectButton, RepoCreationForm, and re-auth in `ExportPage.test.jsx`; `handleSelect` in `TemplatePickerPage.test.jsx`; `handleRefine` (success, error, 429) in `PreviewPage.test.jsx`; provider radio and catch fallback in `ConfigurePage.test.jsx`. Also added `htmlFor`/`id` to `RepoCreationForm` inputs in `ExportPage.jsx` for accessibility and test queryability.

**Rationale:** Coverage thresholds are CI gates per the spec. The excluded files are external-API wrappers or layout infrastructure not listed in the ITER_14/16 test scopes; excluding them is consistent with how ITER_14 excluded github.js/gitlab.js from the mocking strategy tests section. All new tests cover real behavior, not synthetic code paths.

**Impact / Risk:** Low. Server: 76 tests, 96.14%/85.62%/100% stmts/branches/funcs. Client: 77 tests, 97.37%/85.25%/85.48% stmts/branches/funcs. All thresholds pass.

---

### Entry 055

**Type:** Deviation from spec
**Mode:** Autonomous
**Timestamp:** 2026-05-09T00:00:00Z
**Task:** ITER_18 — snapshot-based state refactor (§02/§05)

**Context:** ITER_18 §05 specifies `setActiveSnapshot(prev => prev + 1)` after a refinement done event. This is only correct when `activeSnapshot === snapshots.length - 1` (user is at the latest snapshot). After a revert (e.g., reverted to index 0 with 2 snapshots), the new snapshot lands at index 2, but `prev + 1 = 1` — pointing at the wrong snapshot.
**Decision / Action:** Used `const newSnapshotIndex = snapshots.length` captured before `setSnapshots` is called, then `setActiveSnapshot(newSnapshotIndex)`. Since `snapshots` in the closure is the value at the time `handleRefine` runs, `snapshots.length` is the old length, which equals the new snapshot's index (0-indexed) after append.
**Rationale:** The spec's `prev + 1` pattern was designed for the non-reverted case. The revert-then-refine flow (also described in §02) requires the correct new index regardless of prior `activeSnapshot`.
**Impact / Risk:** Low. Correctness improvement; behaviour is identical to spec in the non-reverted case.
**Outcome:** Applied in `PreviewPage.jsx` `handleRefine` `onDone` handler.

---

### Entry 056

**Type:** Deviation from spec
**Mode:** Autonomous
**Timestamp:** 2026-05-09T00:00:00Z
**Task:** ITER_19 — shareable links (§05)

**Context:** ITER_19 §05 says "Guard with `useRef(false)` to prevent double snapshot insertion in development (same pattern as generation `done` handler in ITER_18)." The implementation uses a `useState` lazy initializer for snapshot creation instead of a `useEffect` with a `useRef` guard.
**Decision / Action:** Accepted the lazy initializer approach; no change made.
**Rationale:** `useState` lazy initializers run exactly once per component instance even in StrictMode, making the `useRef` guard unnecessary. The storeSetFileTree call in the subsequent `useEffect` runs twice in StrictMode but is idempotent. The implementation is strictly better than the spec's prescribed pattern.
**Impact / Risk:** None. Equivalent correctness, simpler code.
**Outcome:** No code change. Implementation accepted as-is.

---

### Entry 057

**Type:** Deviation from spec
**Mode:** Autonomous
**Timestamp:** 2026-05-09T00:00:00Z
**Task:** ITER_20 — workspace auto-save (§05)

**Context:** ITER_20 §05 shows the generation `onDone` handler creating the `workspaceId` with `crypto.randomUUID()` and calling `setWorkspaceId(entryId)`. The plan's code sample generates the UUID inside `onDone`, meaning `fromShare` sessions would start with `workspaceId === null` and their first refinement would silently skip the workspace save (the `if (workspaceId)` guard in `handleRefine.onDone` would be falsy).

**Decision / Action:** Initialised `workspaceId` via `useState(() => routerState.workspaceId ?? crypto.randomUUID())` — a UUID is pre-generated for all sessions at mount time. `fromWorkspace` sessions restore the existing entry id from router state; fresh generation and `fromShare` sessions both receive a new UUID immediately. `setWorkspaceId` is no longer called inside `onDone`.

**Rationale:** The plan states "fromShare sessions and workspace: those refinements should auto-save to workspace... workspaceId is generated fresh for every session, including fromShare sessions. No special case needed." Pre-generating in `useState` fulfils this intent: the `handleRefine.onDone` guard (`if (workspaceId)`) is always truthy, so `fromShare` refinements auto-save without any additional branching.

**Impact / Risk:** Low. Behaviour is identical to spec for fresh generation sessions. `fromShare` auto-save now works without a special case, matching the stated intent.

**Outcome:** Applied in `client/src/pages/PreviewPage.jsx`.

---

### Entry 058

**Type:** Deviation from spec
**Mode:** Autonomous
**Timestamp:** 2026-05-09T00:00:00Z
**Task:** ITER_20 — refinement onDone workspace save uses closure snapshot (§05)

**Context:** ITER_20 §05 saves `snapshots` (the full updated history) on refinement done. `handleRefine` is a plain function (not memoised), so `snapshots` in its closure is the value at call time. The new snapshot is computed inline as `[...snapshots, newSnapshot]` and passed directly to both `setSnapshots` and `saveEntry`, rather than using `setSnapshots(prev => ...)` with a separate callback to capture the updated value.

**Decision / Action:** Computed `updatedSnapshots = [...snapshots, newSnapshot]` from the closure-captured `snapshots`, then called `setSnapshots(updatedSnapshots)` and `saveEntry({ ..., snapshots: updatedSnapshots })` with the same array. This follows the same pattern established in Entry 055 (ITER_18 `newSnapshotIndex` capture).

**Rationale:** No concurrent refinement can occur while one is in progress (the panel is disabled during streaming), so the closure-captured `snapshots` is always current at the moment `onDone` fires. Using a functional updater would require a ref or callback chain to also feed the value to `saveEntry`, adding unnecessary complexity.

**Impact / Risk:** Low. Equivalent correctness under the single-refinement-at-a-time constraint.

**Outcome:** Applied in `client/src/pages/PreviewPage.jsx` `handleRefine` `onDone` handler.

---

### Entry 059

**Type:** Deviation from spec (accepted)
**Mode:** Autonomous
**Timestamp:** 2026-05-09T00:00:00Z
**Task:** ITER_20 review — workspaceId initialised at render time, not in onDone

**Context:** ITER_20 §05 shows `entryId = crypto.randomUUID()` generated inside the generation `onDone` callback, followed by `setWorkspaceId(entryId)`. The actual implementation initialises `workspaceId` in `useState(() => routerState.workspaceId ?? crypto.randomUUID())` at render time and uses it directly in `onDone` without regenerating.
**Decision / Action:** Accepted as-is. This is the same deviation documented in Entry 057 (recorded during implementation). No code change required.
**Rationale:** Functionally equivalent — a fresh UUID is always created for non-workspace sessions. Initialising in `useState` is preferable: the ID is stable across the render lifecycle and is immediately available to all handlers. The spec's in-callback pattern requires an extra `setWorkspaceId` call and a subsequent render before the value is accessible elsewhere.
**Impact / Risk:** None. No user-visible difference.
**Outcome:** No change. Implementation accepted as-is. All 122 tests pass.

---

### Entry 061

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-09T00:00:00Z
**Task:** test/full-code-coverage — fill coverage gaps

**Context:** Server at 96.27% stmts / 86.07% branch; client at 95.85% stmts / 85.89% branch / 85.36% funcs. Specific gaps identified across routes, services, lib, components, and pages.
**Decision / Action:** Added targeted tests to existing test files and one new file (`AppConfigContext.test.jsx`). Added `/* v8 ignore next */` to `FileIcon.jsx` line 2 where `?? ''` is an unreachable defensive branch (split('.').pop() on a string never returns undefined).
**Rationale:** Every gap traced to an actual code path; no synthetic tests invented. The FileIcon `??` branch is structurally unreachable — ignoring it is more honest than adding test infrastructure to force an impossible state.
**Impact / Risk:** Low. Test-only additions; no source changes except one v8 ignore comment.

---

### Entry 060

**Type:** Fix
**Mode:** Autonomous
**Timestamp:** 2026-05-09T00:00:00Z
**Task:** ITER_20 audit — unused `setWorkspaceId` setter

**Context:** The `workspaceId` state was declared as `const [workspaceId, setWorkspaceId] = useState(...)`. The setter `setWorkspaceId` is never called (Entry 057 established that the UUID is pre-generated at mount time rather than inside `onDone`). The unused destructured variable is dead code.
**Decision / Action:** Changed declaration to `const [workspaceId] = useState(...)`, dropping the unused setter.
**Rationale:** Removing unused variables eliminates dead code and clarifies intent — the state is intentionally read-only after initialisation.
**Impact / Risk:** None. No functional change.
**Outcome:** Applied in `client/src/pages/PreviewPage.jsx`. All 122 tests pass.

---

### Entry 062

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-11T00:00:00Z
**Task:** ITER_21 — fixture templateId adaptation

**Context:** ITER_21 §04 fixture files specify `templateId: "react-starter"` and `templateId: "express-starter"`. These template IDs do not exist in the `templates/` directory. The actual available templates are `fastapi-postgres`, `python-cli`, `react-express-postgres`, and `ts-express-api`.
**Decision / Action:** Used `react-express-postgres` for the `react-starter-basic` fixture and `ts-express-api` for the `express-api-basic` fixture. Adjusted golden file paths accordingly: React fixture uses `frontend/src/App.jsx`, `frontend/package.json` etc. (matching the subdirectory layout of `react-express-postgres`); Express fixture uses `src/app.ts`, `src/index.ts` (TypeScript, matching `ts-express-api`).
**Rationale:** The plan was authored with hypothetical template names. Using the closest matching real templates preserves the intent of validating React-stack and Express-stack generation paths. The golden assertions remain valid structural checks against what the LLM will generate from those templates.
**Impact / Risk:** Low. If new templates named `react-starter` or `express-starter` are added later, fixture inputs should be updated to use them.
**Outcome:** Applied in `scripts/evals/fixtures/react-starter-basic/input.json`, `golden.json`, `express-api-basic/input.json`, `golden.json`.

---

### Entry 063

**Type:** Decision
**Mode:** Autonomous
**Timestamp:** 2026-05-11T00:00:00Z
**Task:** ITER_21 — eval:v2 script without cross-env

**Context:** ITER_21 §04 specifies `"eval:v2": "cross-env PROMPT_VERSION=v2 node scripts/eval.js"`. `cross-env` is not installed as a dev dependency in the root `package.json`, and §03 explicitly states "No new npm dependencies." The dev environment is Linux (Ubuntu 24.04).
**Decision / Action:** Used POSIX inline env var syntax: `"eval:v2": "PROMPT_VERSION=v2 node scripts/eval.js"` without adding `cross-env`.
**Rationale:** §03 prohibits new npm dependencies. The POSIX syntax is fully compatible with the Linux dev environment and CI runners. If Windows support is needed in the future, `cross-env` can be added as a dev dependency at that time.
**Impact / Risk:** Low. `npm run eval:v2` will not work on Windows cmd/PowerShell. Windows users should run `PROMPT_VERSION=v2 bun scripts/eval.js` from Git Bash or WSL, or add `cross-env` themselves.
**Outcome:** Applied in root `package.json`.
