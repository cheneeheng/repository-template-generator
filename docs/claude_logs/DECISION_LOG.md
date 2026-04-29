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

### Entry 007

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

### Entry 008

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

### Entry 009

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
