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
