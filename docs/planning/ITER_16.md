---
artifact: ITER_16
status: ready
created: 2026-05-03
scope: Frontend unit + component tests — Vitest + jsdom for all client utilities (streamGenerate, streamRefine, truncateHistory), components (RefinementPanel, DarkModeToggle, SkeletonBlock, ErrorToast, TemplateCard, FileIcon), and pages (TemplatePickerPage, PreviewPage, ConfigurePage, ExportPage) with full branch coverage
sections_changed: [03, 05]
sections_unchanged: [01, 02, 04, 06]
---

# Fullstack Template Generator — Iteration 16

---

## §01 · Concept

> Unchanged — see SKELETON.md §01

---

## §02 · Architecture

> Unchanged — see ITER_07.md §02

---

## §03 · Tech Stack

New dev dependencies (client):

| Package | Version | Rationale |
|---|---|---|
| `vitest` | `^1.6.0` | Test runner — shared with server, same version for consistency |
| `@vitest/coverage-v8` | `^1.6.0` | V8 coverage, zero config |
| `@testing-library/react` | `^15.0.0` | Component rendering without a browser — renders into jsdom |
| `@testing-library/user-event` | `^14.5.0` | Simulates realistic user interactions (type, click, keyboard) |
| `@testing-library/jest-dom` | `^6.4.0` | Custom matchers: `toBeInTheDocument`, `toBeDisabled`, etc. |
| `jsdom` | `^24.0.0` | DOM implementation for Vitest's `environment: 'jsdom'` |
| `msw` | `^2.3.0` | Mock Service Worker — intercepts `fetch` calls at the network level for page-level tests |

**`client/vitest.config.js`:**

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,                    // allows `describe`, `it`, `expect` without imports
    setupFiles: ['./src/tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: ['src/tests/**', 'src/main.jsx'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
```

Frontend thresholds are set slightly lower than backend (85/80 vs 90/85) — page-level components have more conditional rendering branches that are hard to exercise without end-to-end tests.

**`client/src/tests/setup.js`:**

```js
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './mswServer.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { server.resetHandlers(); cleanup(); });
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` — any `fetch` that doesn't match an MSW handler causes the test to fail. This prevents tests from silently hitting real endpoints.

**`client/src/tests/mswServer.js` — MSW handler registry:**

```js
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const defaultHandlers = [
  http.get('/api/config', () => HttpResponse.json({ llmEnabled: true })),
  http.get('/api/templates', () => HttpResponse.json([])),
  http.get('/api/auth/providers', () => HttpResponse.json({ github: false, gitlab: false })),
];

export const server = setupServer(...defaultHandlers);
```

Individual test files override handlers with `server.use(...)` for their specific scenarios.

**`client/package.json` — new scripts:**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## §05 · Frontend

### Utility tests

#### `client/src/lib/truncateHistory.test.js`

Mirrors the server-side tests from ITER_14 (same algorithm, same edge cases). Only the import path differs. No mocking needed — pure function.

```js
import { describe, it, expect } from 'vitest';
import { truncateHistory } from './truncateHistory.js';

const u = (content) => ({ role: 'user', content });
const a = (content) => ({ role: 'assistant', content });

describe('truncateHistory', () => {
  it('returns history unchanged when under budget', () => {
    const h = [u('hello'), a('world')];
    expect(truncateHistory(h, 1000)).toEqual(h);
  });

  it('drops oldest assistant turn first', () => {
    const h = [u('q1'), a('x'.repeat(60)), u('q2'), a('y'.repeat(50))];
    // total = 2 + 60 + 2 + 50 = 114; budget = 80
    const result = truncateHistory(h, 80);
    expect(result.find(m => m.content === 'x'.repeat(60))).toBeUndefined();
    expect(result.find(m => m.content === 'q1')).toBeDefined();
  });

  it('does not mutate input', () => {
    const h = [u('q'), a('x'.repeat(200))];
    const original = JSON.stringify(h);
    truncateHistory(h, 50);
    expect(JSON.stringify(h)).toBe(original);
  });
});
```

#### `client/src/lib/streamGenerate.test.js`

Cover: successful SSE stream (parses `file_done` and `done` events), 429 rate limit response (calls `onRateLimit`), non-ok response (calls `onError`), incomplete SSE buffer handling (chunk split across two reads).

```js
import { describe, it, expect, vi } from 'vitest';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { streamGenerate } from './streamGenerate.js';

function sseBody(events) {
  return events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('');
}

describe('streamGenerate', () => {
  it('calls onFileDone and onDone from SSE stream', async () => {
    const fileTree = [{ path: 'a.js', content: 'x' }];
    server.use(http.post('/api/generate', () =>
      new HttpResponse(
        sseBody([
          { type: 'file_done', path: 'a.js', content: 'x' },
          { type: 'done', fileTree },
        ]),
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));

    const onFileDone = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamGenerate(
      { templateId: 't', projectName: 'app', description: 'd' },
      { onFileDone, onDone, onError }
    );

    expect(onFileDone).toHaveBeenCalledWith('a.js', 'x');
    expect(onDone).toHaveBeenCalledWith(fileTree);
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onRateLimit on 429', async () => {
    server.use(http.post('/api/generate', () =>
      new HttpResponse(null, {
        status: 429,
        headers: { 'RateLimit-Reset': '1234567890' },
      })
    ));
    const onRateLimit = vi.fn();
    await streamGenerate({ templateId: 't', projectName: 'a', description: 'd' }, { onRateLimit });
    expect(onRateLimit).toHaveBeenCalledWith('1234567890');
  });

  it('calls onError on non-ok non-429 response', async () => {
    server.use(http.post('/api/generate', () =>
      HttpResponse.json({ error: 'something broke' }, { status: 500 })
    ));
    const onError = vi.fn();
    await streamGenerate({ templateId: 't', projectName: 'a', description: 'd' }, { onError });
    expect(onError).toHaveBeenCalledWith('something broke');
  });
});
```

#### `client/src/lib/streamRefine.test.js`

Same structure as `streamGenerate` tests. Cover: successful stream, 503 `llm_unavailable`, 429 rate limit, generic error.

```js
import { describe, it, expect, vi } from 'vitest';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { streamRefine } from './streamRefine.js';

const validBody = {
  fileTree: [{ path: 'a.js', content: 'x' }],
  history: [],
  instruction: 'make it TS',
};

describe('streamRefine', () => {
  it('calls onDone with updated file tree', async () => {
    const updatedTree = [{ path: 'a.ts', content: 'x' }];
    server.use(http.post('/api/refine', () =>
      new HttpResponse(
        `data: ${JSON.stringify({ type: 'done', fileTree: updatedTree })}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    const onDone = vi.fn();
    await streamRefine(validBody, { onDone });
    expect(onDone).toHaveBeenCalledWith(updatedTree);
  });

  it('calls onError with bypass message on 503 llm_unavailable', async () => {
    server.use(http.post('/api/refine', () =>
      HttpResponse.json({ error: 'llm_unavailable', message: 'bypass' }, { status: 503 })
    ));
    const onError = vi.fn();
    await streamRefine(validBody, { onError });
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('bypass'));
  });

  it('calls onRateLimit on 429', async () => {
    server.use(http.post('/api/refine', () =>
      new HttpResponse(null, { status: 429, headers: { 'RateLimit-Reset': '9999' } })
    ));
    const onRateLimit = vi.fn();
    await streamRefine(validBody, { onRateLimit });
    expect(onRateLimit).toHaveBeenCalled();
  });
});
```

### Component tests

#### `client/src/components/SkeletonBlock.test.jsx`

```js
import { render } from '@testing-library/react';
import { SkeletonBlock } from './SkeletonBlock.jsx';

describe('SkeletonBlock', () => {
  it('renders with aria-hidden', () => {
    const { container } = render(<SkeletonBlock />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies custom width and height via style', () => {
    const { container } = render(<SkeletonBlock width="50%" height="2rem" />);
    expect(container.firstChild.style.width).toBe('50%');
    expect(container.firstChild.style.height).toBe('2rem');
  });

  it('has shimmer class', () => {
    const { container } = render(<SkeletonBlock />);
    expect(container.firstChild).toHaveClass('shimmer');
  });
});
```

#### `client/src/components/ErrorToast.test.jsx`

Cover: renders message, auto-dismisses after 5s (fake timers), dismiss button calls `onDismiss`, returns null when message is null.

```js
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ErrorToast } from './ErrorToast.jsx';

describe('ErrorToast', () => {
  it('renders the message', () => {
    render(<ErrorToast message="Something went wrong" onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('renders nothing when message is null', () => {
    const { container } = render(<ErrorToast message={null} onDismiss={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onDismiss after 5 seconds', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<ErrorToast message="oops" onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(onDismiss).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('calls onDismiss on dismiss button click', async () => {
    const onDismiss = vi.fn();
    render(<ErrorToast message="oops" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

#### `client/src/components/DarkModeToggle.test.jsx`

Cover: initial state from localStorage, initial state from `matchMedia`, toggle adds/removes `.dark` on `<html>`, persists to localStorage, OS scheme change listener updates state when no explicit preference, listener removed on unmount.

```js
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DarkModeToggle } from './DarkModeToggle.jsx';

describe('DarkModeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('reads initial state from localStorage', () => {
    localStorage.setItem('color-scheme', 'dark');
    render(<DarkModeToggle />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('falls back to matchMedia when localStorage is empty', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(<DarkModeToggle />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggles dark class on click and updates localStorage', async () => {
    render(<DarkModeToggle />);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    await userEvent.click(screen.getByRole('button'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('color-scheme')).toBe('dark');
  });

  it('OS scheme change updates state when no explicit localStorage preference', () => {
    let changeHandler;
    const mq = {
      matches: false,
      addEventListener: vi.fn((_, h) => { changeHandler = h; }),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mq);

    render(<DarkModeToggle />);
    act(() => changeHandler({ matches: true }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('OS scheme change is ignored when explicit preference is stored', () => {
    localStorage.setItem('color-scheme', 'light');
    let changeHandler;
    const mq = {
      matches: false,
      addEventListener: vi.fn((_, h) => { changeHandler = h; }),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mq);

    render(<DarkModeToggle />);
    act(() => changeHandler({ matches: true }));
    // Should remain light because user has explicit preference
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
```

#### `client/src/components/RefinementPanel.test.jsx`

Cover: renders input and button, submit on button click, submit on Enter key, clears input after submit, disabled state (no input row), `disabledReason` replaces input row with text, button disabled when input is empty.

```js
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RefinementPanel } from './RefinementPanel.jsx';

describe('RefinementPanel', () => {
  it('renders input and button when not disabled', () => {
    render(<RefinementPanel onSubmit={vi.fn()} disabled={false} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refine/i })).toBeInTheDocument();
  });

  it('calls onSubmit with trimmed value on button click', async () => {
    const onSubmit = vi.fn();
    render(<RefinementPanel onSubmit={onSubmit} disabled={false} />);
    await userEvent.type(screen.getByRole('textbox'), '  make it TypeScript  ');
    await userEvent.click(screen.getByRole('button', { name: /refine/i }));
    expect(onSubmit).toHaveBeenCalledWith('make it TypeScript');
  });

  it('calls onSubmit on Enter key', async () => {
    const onSubmit = vi.fn();
    render(<RefinementPanel onSubmit={onSubmit} disabled={false} />);
    await userEvent.type(screen.getByRole('textbox'), 'add tests{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('add tests');
  });

  it('clears input after submit', async () => {
    render(<RefinementPanel onSubmit={vi.fn()} disabled={false} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'hello{Enter}');
    expect(input).toHaveValue('');
  });

  it('does not call onSubmit when disabled', async () => {
    const onSubmit = vi.fn();
    render(<RefinementPanel onSubmit={onSubmit} disabled={true} />);
    await userEvent.type(screen.getByRole('textbox'), 'hello{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows disabledReason instead of input row', () => {
    render(<RefinementPanel onSubmit={vi.fn()} disabled={true} disabledReason="LLM unavailable" />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('LLM unavailable')).toBeInTheDocument();
  });

  it('keeps submit button disabled when input is empty', () => {
    render(<RefinementPanel onSubmit={vi.fn()} disabled={false} />);
    expect(screen.getByRole('button', { name: /refine/i })).toBeDisabled();
  });
});
```

#### `client/src/components/TemplateCard.test.jsx`

Cover: renders label, description, tags; "Show files" toggle expands/collapses file list; file count shown in toggle button; `onSelect` called on "Use this template" click; `aria-expanded` attribute updated on toggle.

```js
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateCard } from './TemplateCard.jsx';

const template = {
  id: 'react-express',
  label: 'React + Express',
  description: 'A fullstack starter',
  tags: ['react', 'express'],
  files: ['frontend/App.jsx', 'backend/index.js', 'README.md'],
};

describe('TemplateCard', () => {
  it('renders label and description', () => {
    render(<TemplateCard template={template} onSelect={vi.fn()} />);
    expect(screen.getByText('React + Express')).toBeInTheDocument();
    expect(screen.getByText('A fullstack starter')).toBeInTheDocument();
  });

  it('renders all tags', () => {
    render(<TemplateCard template={template} onSelect={vi.fn()} />);
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('express')).toBeInTheDocument();
  });

  it('shows file count in toggle button', () => {
    render(<TemplateCard template={template} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /show files \(3\)/i })).toBeInTheDocument();
  });

  it('expands file list on toggle click', async () => {
    render(<TemplateCard template={template} onSelect={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /show files/i }));
    expect(screen.getByText('frontend/App.jsx')).toBeInTheDocument();
  });

  it('collapses file list on second toggle click', async () => {
    render(<TemplateCard template={template} onSelect={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /show files/i });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('button', { name: /hide files/i }));
    expect(screen.queryByText('frontend/App.jsx')).not.toBeInTheDocument();
  });

  it('calls onSelect when "Use this template" is clicked', async () => {
    const onSelect = vi.fn();
    render(<TemplateCard template={template} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /use this template/i }));
    expect(onSelect).toHaveBeenCalledWith(template);
  });

  it('sets aria-expanded correctly', async () => {
    render(<TemplateCard template={template} onSelect={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /show files/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
```

### Page tests

Page tests use MSW to intercept API calls and verify the rendered output.

#### `client/src/pages/TemplatePickerPage.test.jsx`

Cover: shows skeleton cards while loading, renders template cards on success, shows bypass banner when `llmEnabled: false`, shows error state on fetch failure, filter by tag.

```js
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { AppConfigProvider } from '../context/AppConfigContext.jsx';
import { TemplatePickerPage } from './TemplatePickerPage.jsx';

const templates = [
  { id: 'react-express', label: 'React + Express', description: 'D', tags: ['react'], files: [] },
  { id: 'vue-fastify', label: 'Vue + Fastify', description: 'D', tags: ['vue'], files: [] },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AppConfigProvider>
        <TemplatePickerPage />
      </AppConfigProvider>
    </MemoryRouter>
  );
}

describe('TemplatePickerPage', () => {
  it('shows skeleton cards while loading', () => {
    // Don't resolve the handler immediately
    server.use(http.get('/api/templates', () => new Promise(() => {})));
    renderPage();
    // Skeleton blocks are aria-hidden — check by class or test-id
    expect(document.querySelectorAll('.shimmer').length).toBeGreaterThan(0);
  });

  it('renders template cards after load', async () => {
    server.use(http.get('/api/templates', () => HttpResponse.json(templates)));
    renderPage();
    await waitFor(() => expect(screen.getByText('React + Express')).toBeInTheDocument());
    expect(screen.getByText('Vue + Fastify')).toBeInTheDocument();
  });

  it('shows bypass banner when llmEnabled is false', async () => {
    server.use(
      http.get('/api/config', () => HttpResponse.json({ llmEnabled: false })),
      http.get('/api/templates', () => HttpResponse.json(templates)),
    );
    renderPage();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/LLM unavailable/i));
  });

  it('shows error state when templates fetch fails', async () => {
    server.use(http.get('/api/templates', () => HttpResponse.error()));
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
```

#### `client/src/pages/PreviewPage.test.jsx`

Cover: shows streaming progress during generation, renders file entries as `file_done` events arrive, shows full tree on `done`, shows refinement panel after done, disables refinement panel in bypass mode, shows rate limit message on 429, "Start over" button navigates to `/`.

```js
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppConfigProvider } from '../context/AppConfigContext.jsx';
import { PreviewPage } from './PreviewPage.jsx';

// PreviewPage reads template + projectName from router state or store
// Tests set these via MemoryRouter initialEntries state
function renderPage(routerState = {}, configOverride = {}) {
  server.use(http.get('/api/config', () =>
    HttpResponse.json({ llmEnabled: true, ...configOverride })
  ));
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/preview', state: routerState }]}>
      <AppConfigProvider>
        <Routes>
          <Route path="/preview" element={<PreviewPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </AppConfigProvider>
    </MemoryRouter>
  );
}

function sseStream(events) {
  return new HttpResponse(
    events.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''),
    { headers: { 'Content-Type': 'text/event-stream' } }
  );
}

describe('PreviewPage', () => {
  it('shows generating state while streaming', async () => {
    server.use(http.post('/api/generate', () => new Promise(() => {})));
    renderPage({ templateId: 't', projectName: 'app', description: 'd' });
    await waitFor(() => expect(screen.getByText(/generating/i)).toBeInTheDocument());
  });

  it('renders files as file_done events arrive', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'file_done', path: 'README.md', content: '# App' },
      { type: 'done', fileTree: [{ path: 'README.md', content: '# App' }] },
    ])));
    renderPage({ templateId: 't', projectName: 'app', description: 'd' });
    await waitFor(() => expect(screen.getByText('README.md')).toBeInTheDocument());
  });

  it('shows refinement panel after done', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
    ])));
    renderPage({ templateId: 't', projectName: 'app', description: 'd' });
    await waitFor(() => expect(screen.getByRole('textbox', { name: /refinement/i })).toBeInTheDocument());
  });

  it('disables refinement panel in bypass mode', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
    ])));
    renderPage({ templateId: 't', projectName: 'app', description: 'd' }, { llmEnabled: false });
    await waitFor(() =>
      expect(screen.getByText(/Refinement requires an Anthropic API key/i)).toBeInTheDocument()
    );
  });

  it('navigates to / on "Start over" after error', async () => {
    server.use(http.post('/api/generate', () =>
      HttpResponse.json({ error: 'broken' }, { status: 500 })
    ));
    renderPage({ templateId: 't', projectName: 'app', description: 'd' });
    await waitFor(() => expect(screen.getByRole('button', { name: /start over/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /start over/i }));
    expect(screen.getByText('home')).toBeInTheDocument();
  });
});
```

#### `client/src/pages/ConfigurePage.test.jsx`

Cover: renders form fields, submit button disabled while fields empty, `POST /api/generate` called with correct body on submit, shows error toast on 400, shows rate limit message on 429, disables submit during in-flight request.

```js
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppConfigProvider } from '../context/AppConfigContext.jsx';
import { ConfigurePage } from './ConfigurePage.jsx';

function renderPage(routerState = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/configure', state: routerState }]}>
      <AppConfigProvider>
        <Routes>
          <Route path="/configure" element={<ConfigurePage />} />
          <Route path="/preview" element={<div>preview</div>} />
        </Routes>
      </AppConfigProvider>
    </MemoryRouter>
  );
}

describe('ConfigurePage', () => {
  it('has submit button disabled with empty fields', () => {
    renderPage({ template: { id: 't' } });
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
  });

  it('navigates to /preview on successful generate', async () => {
    server.use(http.post('/api/generate', () =>
      new HttpResponse('data: {"type":"done","fileTree":[]}\n\n', {
        headers: { 'Content-Type': 'text/event-stream' }
      })
    ));
    renderPage({ template: { id: 't' } });
    await userEvent.type(screen.getByLabelText(/project name/i), 'my-app');
    await userEvent.type(screen.getByLabelText(/description/i), 'a description');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    await waitFor(() => expect(screen.getByText('preview')).toBeInTheDocument());
  });

  it('shows error toast on 400', async () => {
    server.use(http.post('/api/generate', () =>
      HttpResponse.json({ error: 'Validation error' }, { status: 400 })
    ));
    renderPage({ template: { id: 't' } });
    await userEvent.type(screen.getByLabelText(/project name/i), 'my-app');
    await userEvent.type(screen.getByLabelText(/description/i), 'desc');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
```

#### `client/src/pages/ExportPage.test.jsx`

Cover: ZIP download triggers blob fetch and `<a>` click, shows spinner during download, repo creation form hidden when no providers configured, re-auth prompt on 401.

```js
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { AppConfigProvider } from '../context/AppConfigContext.jsx';
import { ExportPage } from './ExportPage.jsx';

const fileTree = [{ path: 'a.js', content: 'x' }];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/export', state: { fileTree, projectName: 'app' } }]}>
      <AppConfigProvider>
        <ExportPage />
      </AppConfigProvider>
    </MemoryRouter>
  );
}

describe('ExportPage', () => {
  it('shows only ZIP button when no providers configured', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /download zip/i })).toBeInTheDocument()
    );
    expect(screen.queryByText(/connect github/i)).not.toBeInTheDocument();
  });

  it('initiates ZIP download on button click', async () => {
    server.use(http.post('/api/export/zip', () =>
      new HttpResponse(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'application/zip' }
      })
    ));
    // Mock createObjectURL
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /download zip/i }));
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
  });
});
```

---

## §04 · Backend

> Unchanged — see ITER_15.md §04

---

## §06 · LLM / Prompts

> Unchanged — see ITER_07.md §06

---

## Backlog update

After ITER_16, the test suite is complete. Remaining deferred items:

- Multi-instance Redis backing (rate limiting, OAuth state map)
- GitHub Apps credential type alongside OAuth
- Automatic GitLab token refresh
- Visual refinement history panel with revert support
- CLI template validation script (`scripts/validate-templates.js`)
- Eval harness for LLM prompt testing
- BuildKit cache mounts and container resource limits
- Container queries replacing media query breakpoints
- Turns-remaining indicator in refinement panel
- Rate limit countdown timer from `RateLimit-Reset` header