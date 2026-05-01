---
artifact: ITER_06
status: ready
created: 2026-04-28
scope: Shimmer skeleton animations for loading states + dark mode (CSS custom properties, system preference detection, manual toggle)
sections_changed: [03, 05]
sections_unchanged: [01, 02, 04, 06]
---

# Fullstack Template Generator — Iteration 06

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

> Unchanged — see SKELETON.md §02

---

## §03 · Tech Stack

No new runtime dependencies. Both features are implemented in plain CSS and React — no animation library, no theming library.

**CSS custom properties** are already the correct approach for this stack (established in ITER_02's responsive shell). Dark mode extends the same variable set. Shimmer animations use `@keyframes` and a CSS gradient — no JS required.

> **Deferred from previous iterations still deferred:** Multi-instance rate limiting (Redis), GitLab token refresh (automatic rotation), multi-turn LLM refinement, A/B testing between prompt versions, per-file content character deltas.

---

## §04 · Backend

> Unchanged — see ITER_04.md §04

---

## §05 · Frontend

### Dark mode — strategy

Dark mode is implemented with a CSS class on `<html>` (`class="dark"`) toggled by a button in the shell nav, with the initial value read from `window.matchMedia('(prefers-color-scheme: dark)')`. The preference is persisted to `localStorage` under the key `color-scheme` so it survives page reloads.

**Why a class on `<html>` rather than `data-theme` on `<body>` or a React context value:** The class approach lets every CSS rule use a single selector pattern (`.dark .component` or `:root.dark`) without needing to thread a theme prop through the component tree. It also means CSS loaded in `<head>` (if any) can respond to the theme without waiting for React to mount.

**No React context needed for the toggle.** The toggle button writes to `localStorage` and adds/removes the class directly — no re-render of the tree is triggered. Components read theme via CSS variables, not JS props.

### Dark mode — CSS variables

Extend the existing variable set in `client/src/index.css` (or wherever the shell variables currently live) with a dark variant:

```css
:root {
  --color-bg:          #ffffff;
  --color-bg-surface:  #f5f5f5;   /* cards, sidebars */
  --color-bg-input:    #ffffff;
  --color-border:      #e0e0e0;
  --color-text:        #111111;
  --color-text-muted:  #666666;
  --color-accent:      #2563eb;   /* primary buttons, active states */
  --color-accent-hover:#1d4ed8;
  --color-error:       #dc2626;
  --color-success:     #16a34a;

  /* Shimmer gradient colours — defined here so dark mode can override */
  --shimmer-base:      #e5e7eb;
  --shimmer-highlight: #f3f4f6;
}

:root.dark {
  --color-bg:          #0f172a;
  --color-bg-surface:  #1e293b;
  --color-bg-input:    #1e293b;
  --color-border:      #334155;
  --color-text:        #f1f5f9;
  --color-text-muted:  #94a3b8;
  --color-accent:      #3b82f6;
  --color-accent-hover:#60a5fa;
  --color-error:       #f87171;
  --color-success:     #4ade80;

  --shimmer-base:      #1e293b;
  --shimmer-highlight: #334155;
}
```

Every existing component that uses these variable names gets dark mode automatically — no per-component changes needed beyond ensuring components use variables rather than hardcoded hex values. Any component currently using hardcoded colours must be updated to use the corresponding variable.

**`react-syntax-highlighter` dark theme:** The `FileViewer` passes a theme prop to the highlighter. Read the active theme from `document.documentElement.classList.contains('dark')` at render time and switch between `github` (light) and `atomDark` (dark) — both ship with the library, no extra install.

```jsx
// FileViewer.jsx
const isDark = document.documentElement.classList.contains('dark');
const highlightTheme = isDark ? atomDark : github;
```

This is a synchronous DOM read — safe in render because the class is set before React mounts (see toggle implementation below). No flicker.

### Dark mode — toggle component

```jsx
// client/src/components/DarkModeToggle.jsx

const STORAGE_KEY = 'color-scheme';

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
}

export function DarkModeToggle() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  function toggle() {
    const next = !dark;
    setDark(next);
    applyTheme(next);
  }

  return (
    <button onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {dark ? '☀︎' : '☾'}
    </button>
  );
}
```

**Initial application before React mounts** — add an inline script to `client/index.html` immediately after `<html>` to apply the stored preference before the page paints, preventing a flash of the wrong theme:

```html
<!-- index.html — before <head> closes -->
<script>
  (function() {
    var stored = localStorage.getItem('color-scheme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  })();
</script>
```

This is the standard pattern for preventing theme flash (FOUC) with localStorage-persisted dark mode. The script is intentionally inline and synchronous — an external script file would require an extra network round-trip before paint.

**`DarkModeToggle` is placed in `Shell`'s nav bar**, alongside the step breadcrumb. No prop drilling — the toggle is self-contained.

### Shimmer animations — implementation

Shimmer (skeleton loading) replaces the blank space that currently shows while `GET /api/templates` is loading, and replaces the empty file list while the LLM stream is in progress.

**The shimmer keyframe** — defined once in `index.css`:

```css
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}

.shimmer {
  background: linear-gradient(
    90deg,
    var(--shimmer-base)      0%,
    var(--shimmer-highlight) 50%,
    var(--shimmer-base)      100%
  );
  background-size: 800px 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  border-radius: 4px;
}
```

The shimmer colours are CSS variables (defined in §05 above) — dark mode overrides them automatically.

**Reusable primitive — `SkeletonBlock`:**

```jsx
// client/src/components/SkeletonBlock.jsx
export function SkeletonBlock({ width = '100%', height = '1rem', style }) {
  return (
    <div
      className="shimmer"
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}
```

`aria-hidden="true"` — skeleton blocks are decorative; screen readers should skip them. The real content, when it loads, is announced normally.

### Shimmer — per-page usage

**`TemplatePickerPage` — skeleton cards while `GET /api/templates` loads:**

Render 6 `SkeletonCard` placeholders (matching the 3-column grid from ITER_02) while the fetch is in flight. Each `SkeletonCard` mirrors the dimensions of a real `TemplateCard`:

```jsx
function SkeletonCard() {
  return (
    <div className="template-card template-card--skeleton">
      <SkeletonBlock height="1.25rem" width="60%" />          {/* title */}
      <SkeletonBlock height="0.875rem" width="90%" style={{ marginTop: '0.5rem' }} />  {/* desc line 1 */}
      <SkeletonBlock height="0.875rem" width="75%" style={{ marginTop: '0.25rem' }} />  {/* desc line 2 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <SkeletonBlock height="1.25rem" width="3rem" />       {/* tag */}
        <SkeletonBlock height="1.25rem" width="3rem" />
        <SkeletonBlock height="1.25rem" width="3rem" />
      </div>
    </div>
  );
}
```

Show 6 of these in the `TemplateGrid` when `status === 'loading'`.

**`PreviewPage` — in-progress file slots during LLM stream:**

While streaming, `streamState.files` grows as `file_done` events arrive (ITER_05). Files not yet received are shown as skeleton rows in the `FileTree`. The total expected file count is not known until `done` — so during streaming, show the arrived files as real rows and append 3 skeleton rows as a "more coming" indicator:

```jsx
// FileTree.jsx (streaming mode)
{streamState.files.map(f => <FileRow key={f.path} file={f} />)}
{streamState.status === 'streaming' && (
  <>
    <SkeletonBlock height="1rem" width="70%" style={{ margin: '0.4rem 0' }} />
    <SkeletonBlock height="1rem" width="55%" style={{ margin: '0.4rem 0' }} />
    <SkeletonBlock height="1rem" width="80%" style={{ margin: '0.4rem 0' }} />
  </>
)}
```

3 skeleton rows is sufficient — it communicates "more is coming" without implying a specific count.

**`ExportPage` — spinner on ZIP download / repo creation** — already specified in ITER_01 as a deferred item. This iteration delivers it: the download button and repo creation submit button show a `<span className="spinner" aria-label="Loading" />` while their respective fetches are in flight. The spinner is a CSS-only rotating border ring, no library:

```css
.spinner {
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**`ConfigurePage`** — no shimmer needed. The form renders immediately; the only loading state is the disabled submit button during in-flight generate (already handled in ITER_01).

### Accessibility notes

- All shimmer/skeleton elements carry `aria-hidden="true"` — they are decorative.
- The dark mode toggle button has an `aria-label` that reflects the *current* state and what clicking will do ("Switch to light mode" when dark is active).
- The spinner on buttons carries `aria-label="Loading"`.
- Colour contrast for both light and dark palettes above meets WCAG AA (4.5:1 for body text, 3:1 for large text and UI components). The chosen values have been selected with this in mind — verify with a contrast checker during implementation.

> **Deferred:** Reduced-motion support (`@media (prefers-reduced-motion: reduce)` to disable shimmer/spin animations — add in a follow-up pass), system colour scheme change listener to update the toggle state if the OS preference changes while the app is open (`window.matchMedia(...).addEventListener('change', ...)`), container queries replacing the single breakpoint.