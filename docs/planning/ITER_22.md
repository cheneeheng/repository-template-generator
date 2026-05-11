---
artifact: ITER_22
status: ready
created: 2026-05-11
scope: Home button — persistent nav element that returns the user to the landing/template-selection screen from any page in the app
sections_changed: [05]
sections_unchanged: [01, 02, 03, 04, 06]
---

# Fullstack Template Generator — Iteration 22

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

> Unchanged — see ITER_21.md §02

---

## §03 · Tech Stack

> Unchanged — see ITER_16.md §03

---

## §04 · Backend

> Unchanged — see ITER_21.md §04

---

## §05 · Frontend

### Problem

No persistent navigation exists. Once a user moves past the template-selection screen (e.g. into GeneratePage or PreviewPage), there is no affordance to return to the start without using the browser's back button.

### Solution

Add a home button rendered in a persistent top-level layout shell that wraps all pages. Clicking it navigates to `/` (the template-selection screen) and resets any in-progress generation state.

### Layout shell

Introduce a thin `<AppShell>` component that wraps the router outlet. It renders:

- A minimal top bar containing the home button (left-aligned)
- `{children}` / `<Outlet />` below

`AppShell` is mounted once at the router root — it does not re-mount on navigation.

```jsx
// src/components/AppShell.jsx
export function AppShell({ children }) {
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <header className="app-shell__bar">
        <button
          className="app-shell__home"
          onClick={() => navigate('/')}
          aria-label="Home"
        >
          ⌂ Home
        </button>
      </header>
      <main className="app-shell__content">{children}</main>
    </div>
  );
}
```

### State reset on home navigation

Navigating home should not leave stale generation state in child components. The cleanest approach at this stage: each page that holds local state (GeneratePage, PreviewPage) already unmounts when the route changes — React's normal unmount cycle clears their state. No global state reset is required.

**Deferred:** If a global state store (e.g. Zustand, Context) is introduced in a later iteration, an explicit reset action will be needed. Not relevant now.

### Routing integration

Wrap the existing route tree with `AppShell` in the router definition:

```jsx
// src/main.jsx (or wherever routes are defined)
<BrowserRouter>
  <AppShell>
    <Routes>
      <Route path="/" element={<TemplatePage />} />
      <Route path="/generate" element={<GeneratePage />} />
      <Route path="/preview" element={<PreviewPage />} />
    </Routes>
  </AppShell>
</BrowserRouter>
```

### Styling

The top bar should be visually minimal — it must not compete with page content. Suggested constraints:

- Fixed height: `2.5rem`
- Background: `var(--color-surface)` with a bottom border at `var(--color-border)`
- Home button: text + icon, no heavy styling
- `app-shell__content` fills remaining viewport height (`height: calc(100vh - 2.5rem)`)

No new CSS custom properties needed — use existing tokens.

### Visibility

The home button renders on all routes including `/`. On the landing page it is effectively a no-op (navigates to current route), which is acceptable — hiding it conditionally adds complexity for no real benefit.

**Deferred:** Active route highlighting, breadcrumb trail, full nav bar with additional links — out of scope at this stage.

---

## §06 · LLM / Prompts

> Unchanged — see ITER_21.md §06

---

## Backlog update

Adds persistent navigation. Remaining deferred items carry forward unchanged from ITER_21.