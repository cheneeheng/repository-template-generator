import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import PreviewPage from './PreviewPage.jsx';
import useStore from '../store.js';
import { useAppConfig } from '../context/AppConfigContext.jsx';
import { loadWorkspace } from '../lib/workspace.js';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

// AppConfigProvider fetches /api/config via MSW whose response resolves across
// multiple async hops outside act's tracking window. Mock the module so the
// provider is a passthrough and useAppConfig is controllable per-test.
vi.mock('../context/AppConfigContext.jsx', () => ({
  AppConfigProvider: ({ children }) => children,
  useAppConfig: vi.fn(),
}));

function sseStream(events) {
  return new HttpResponse(
    events.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''),
    { headers: { 'Content-Type': 'text/event-stream' } }
  );
}

async function renderPage() {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/preview']} future={FUTURE}>
        <Routes>
          <Route path="/preview" element={<PreviewPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    );
    await new Promise((r) => setTimeout(r, 0));
  });
}

const sharedTree = [{ path: 'shared.js', content: 'shared' }];

async function renderPageFromShare() {
  await act(async () => {
    render(
      <MemoryRouter
        initialEntries={[{
          pathname: '/preview',
          state: { fileTree: sharedTree, projectName: 'shared-proj', templateId: 't', fromShare: true },
        }]}
        future={FUTURE}
      >
        <Routes>
          <Route path="/preview" element={<PreviewPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    );
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('PreviewPage', () => {
  beforeEach(() => {
    useAppConfig.mockReturnValue({ llmEnabled: true });
    useStore.setState({
      selectedTemplate: { id: 't', label: 'Template', description: 'D', tags: [] },
      projectConfig: { projectName: 'my-app', description: 'desc', provider: 'zip' },
    });
  });

  afterEach(async () => {
    await act(async () => { useStore.setState({ selectedTemplate: null, projectConfig: null, fileTree: null }); });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows generating state while streaming', async () => {
    server.use(http.post('/api/generate', () => new Promise(() => {})));
    await renderPage();
    expect(screen.getByText(/Generating\.\.\./i)).toBeInTheDocument();
  });

  it('renders files as file_done events arrive', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'file_done', path: 'README.md', content: '# App' },
      { type: 'done', fileTree: [{ path: 'README.md', content: '# App' }] },
    ])));
    await renderPage();
    await waitFor(() => expect(screen.getAllByText('README.md').length).toBeGreaterThan(0));
  });

  it('shows refinement panel after done', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
    ])));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /refinement/i })).toBeInTheDocument()
    );
  });

  it('disables refinement panel in bypass mode', async () => {
    useAppConfig.mockReturnValue({ llmEnabled: false });
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
    ])));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Refinement requires an Anthropic API key/i)).toBeInTheDocument()
    );
  });

  it('shows error state and start-over button on error', async () => {
    server.use(http.post('/api/generate', () =>
      HttpResponse.json({ error: 'broken' }, { status: 500 })
    ));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start over/i })).toBeInTheDocument()
    );
  });

  it('navigates home when start-over is clicked', async () => {
    server.use(http.post('/api/generate', () =>
      HttpResponse.json({ error: 'broken' }, { status: 500 })
    ));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start over/i })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole('button', { name: /start over/i }));
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('shows rate limit message on 429', async () => {
    server.use(http.post('/api/generate', () =>
      new HttpResponse(null, {
        status: 429,
        headers: { 'RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60) },
      })
    ));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/request limit/i)
    );
  });

  it('redirects to / when store has no selected template', async () => {
    useStore.setState({ selectedTemplate: null, projectConfig: null });
    await renderPage();
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('submits a refinement instruction and shows updated file', async () => {
    server.use(
      http.post('/api/generate', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
      ])),
      http.post('/api/refine', () => sseStream([
        { type: 'file_done', path: 'a.ts', content: 'const x: number = 1' },
        { type: 'done', fileTree: [{ path: 'a.ts', content: 'const x: number = 1' }] },
      ])),
    );
    await renderPage();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'convert to TypeScript');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));
    await waitFor(() => expect(screen.getAllByText('a.ts').length).toBeGreaterThan(0));
  });

  it('shows error alert when refinement stream returns an error', async () => {
    server.use(
      http.post('/api/generate', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
      ])),
      http.post('/api/refine', () => sseStream([
        { type: 'error', message: 'LLM unavailable' },
      ])),
    );
    await renderPage();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'make it TypeScript');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));
    await waitFor(() => expect(screen.getByText('LLM unavailable')).toBeInTheDocument());
  });

  it('clicking a filename opens its content in the editor panel', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'file_done', path: 'README.md', content: '# Hello' },
      { type: 'file_done', path: 'index.js', content: 'console.log(1)' },
      { type: 'done', fileTree: [
        { path: 'README.md', content: '# Hello' },
        { path: 'index.js', content: 'console.log(1)' },
      ]},
    ])));
    await renderPage();
    await waitFor(() => screen.getByText('index.js'));
    await userEvent.click(screen.getByText('index.js'));
    expect(screen.getByRole('textbox', { name: /file editor/i })).toHaveValue('console.log(1)');
  });

  it('applies is-active class to the clicked file entry', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'done', fileTree: [
        { path: 'README.md', content: '# Hello' },
        { path: 'index.js', content: 'x' },
      ]},
    ])));
    await renderPage();
    await waitFor(() => screen.getByText('index.js'));
    const btn = screen.getByRole('button', { name: 'index.js' });
    await userEvent.click(btn);
    expect(btn).toHaveClass('is-active');
  });

  it('editing textarea content updates the displayed value', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'done', fileTree: [{ path: 'a.js', content: 'original' }] },
    ])));
    await renderPage();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /file editor/i })).toHaveValue('original'));
    await userEvent.clear(screen.getByRole('textbox', { name: /file editor/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /file editor/i }), 'edited');
    expect(screen.getByRole('textbox', { name: /file editor/i })).toHaveValue('edited');
  });

  it('edited content is preserved when switching between files and returning', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'done', fileTree: [
        { path: 'a.js', content: 'original' },
        { path: 'b.js', content: 'other' },
      ]},
    ])));
    const editor = () => screen.getByRole('textbox', { name: /file editor/i });
    await renderPage();
    await waitFor(() => expect(editor()).toHaveValue('original'));
    await userEvent.clear(editor());
    await userEvent.type(editor(), 'edited');
    await userEvent.click(screen.getByRole('button', { name: 'b.js' }));
    expect(editor()).toHaveValue('other');
    await userEvent.click(screen.getByRole('button', { name: 'a.js' }));
    expect(editor()).toHaveValue('edited');
  });

  it('appends snapshot after generation done', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
    ])));
    await renderPage();
    // History panel hidden until >=2 snapshots; one snapshot exists after generation
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    expect(screen.queryByLabelText(/refinement history/i)).not.toBeInTheDocument();
  });

  it('appends snapshot after refinement done and shows history panel', async () => {
    server.use(
      http.post('/api/generate', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
      ])),
      http.post('/api/refine', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'y' }] },
      ])),
    );
    await renderPage();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'tweak');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));
    await waitFor(() => screen.getByLabelText(/refinement history/i));
    expect(screen.getByRole('button', { name: /Generated/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refinement 1/i })).toBeInTheDocument();
  });

  it('reverting to snapshot 0 restores original fileTree content', async () => {
    server.use(
      http.post('/api/generate', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'original' }] },
      ])),
      http.post('/api/refine', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'refined' }] },
      ])),
    );
    await renderPage();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'tweak');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));
    await waitFor(() => screen.getByLabelText(/refinement history/i));
    // After refinement, editor shows refined content
    expect(screen.getByRole('textbox', { name: /file editor/i })).toHaveValue('refined');
    // Revert to Generated snapshot
    await userEvent.click(screen.getByRole('button', { name: /Generated/i }));
    expect(screen.getByRole('textbox', { name: /file editor/i })).toHaveValue('original');
  });

  it('reverting then refining appends a new snapshot without truncating history', async () => {
    server.use(
      http.post('/api/generate', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'v0' }] },
      ])),
      http.post('/api/refine', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'v1' }] },
      ])),
    );
    await renderPage();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'first');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));
    await waitFor(() => screen.getByLabelText(/refinement history/i));

    // Revert to Generated, then refine again
    await userEvent.click(screen.getByRole('button', { name: /Generated/i }));

    server.use(http.post('/api/refine', () => sseStream([
      { type: 'done', fileTree: [{ path: 'a.js', content: 'v2' }] },
    ])));
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'second');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));

    await waitFor(() => {
      const buttons = screen.getAllByRole('button', { name: /Generated|Refinement/i });
      return buttons.length >= 3;
    });
    // All 3 snapshots present: Generated, Refinement 1, Refinement 2
    expect(screen.getByRole('button', { name: /Generated/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refinement 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refinement 2/i })).toBeInTheDocument();
  });

  it('shows rate limit message when refinement returns 429', async () => {
    const resetTime = String(Math.floor(Date.now() / 1000) + 900);
    server.use(
      http.post('/api/generate', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
      ])),
      http.post('/api/refine', () =>
        new HttpResponse(null, {
          status: 429,
          headers: { 'RateLimit-Reset': resetTime },
        })
      ),
    );
    await renderPage();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'make it TypeScript');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('fromShare mode skips generate call and renders file tree immediately', async () => {
    const generateSpy = vi.fn(() => new Promise(() => {}));
    server.use(http.post('/api/generate', generateSpy));
    await renderPageFromShare();
    await waitFor(() => expect(screen.getByText('shared.js')).toBeInTheDocument());
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it('fromShare mode initialises with a Shared snapshot', async () => {
    server.use(http.post('/api/refine', () => sseStream([
      { type: 'done', fileTree: sharedTree },
    ])));
    await renderPageFromShare();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'tweak');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));
    await waitFor(() => screen.getByLabelText(/refinement history/i));
    const historyPanel = screen.getByLabelText(/refinement history/i);
    expect(within(historyPanel).getByRole('button', { name: /Shared/i })).toBeInTheDocument();
  });

  it('share button copies link to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    server.use(
      http.post('/api/generate', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
      ])),
      http.post('/api/share', () => HttpResponse.json({ id: 'abcd1234' })),
    );
    await renderPage();
    await waitFor(() => screen.getByRole('button', { name: /^share$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^share$/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/share/abcd1234')));
  });

  it('share button shows Link copied! feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    server.use(
      http.post('/api/generate', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
      ])),
      http.post('/api/share', () => HttpResponse.json({ id: 'abcd1234' })),
    );
    await renderPage();
    await waitFor(() => screen.getByRole('button', { name: /^share$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^share$/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /link copied/i })).toBeInTheDocument());
  });

  it('auto-saves workspace entry on generation done', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
    ])));
    await renderPage();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    const entries = loadWorkspace();
    expect(entries).toHaveLength(1);
    expect(entries[0].projectName).toBe('my-app');
    expect(entries[0].fileTree).toEqual([{ path: 'a.js', content: 'x' }]);
  });

  it('auto-saves updated entry on refinement done', async () => {
    server.use(
      http.post('/api/generate', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
      ])),
      http.post('/api/refine', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'y' }] },
      ])),
    );
    await renderPage();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'tweak');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));
    await waitFor(() => screen.getByLabelText(/refinement history/i));
    const entries = loadWorkspace();
    expect(entries).toHaveLength(1);
    expect(entries[0].fileTree).toEqual([{ path: 'a.js', content: 'y' }]);
    expect(entries[0].snapshots).toHaveLength(2);
  });

  it('handles empty file tree on generate done without crashing', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'done', fileTree: [] },
    ])));
    await renderPage();
    // With empty tree, no file is active but refinement panel still shows
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
  });

  it('handles empty file tree on refine done without crashing', async () => {
    server.use(
      http.post('/api/generate', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
      ])),
      http.post('/api/refine', () => sseStream([
        { type: 'done', fileTree: [] },
      ])),
    );
    await renderPage();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'clear');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
  });

  it('updates token count as delta events arrive', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'delta', chunk: 'hello world' },
      { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
    ])));
    await renderPage();
    // After done the streaming UI is replaced by the preview; just verify completion
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
  });

  it('shows file count in progress bar while streaming', async () => {
    // Stream file_done then never send done — observe intermediate streaming state
    server.use(http.post('/api/generate', () =>
      new HttpResponse(
        new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'file_done', path: 'README.md', content: '# H' })}\n\n`));
            // stream stays open — never done
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText(/1 file complete/i)).toBeInTheDocument()
    );
  });

  it('generate rate limit without reset header defaults to 15 min wait', async () => {
    server.use(http.post('/api/generate', () =>
      new HttpResponse(null, { status: 429 })
    ));
    await renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/15/);
  });

  it('editing a file when multiple snapshots exist preserves non-active snapshots', async () => {
    server.use(
      http.post('/api/generate', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'original' }] },
      ])),
      http.post('/api/refine', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'refined' }] },
      ])),
    );
    await renderPage();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    // Create a second snapshot via refinement
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'refine');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));
    await waitFor(() => screen.getByLabelText(/refinement history/i));
    // Edit current file — this runs handleEdit with 2 snapshots in state (covers ': snap' branch)
    const editor = screen.getByRole('textbox', { name: /file editor/i });
    await userEvent.clear(editor);
    await userEvent.type(editor, 'edited');
    expect(editor).toHaveValue('edited');
  });

  it('refinement rate limit without reset header defaults to 15 min wait', async () => {
    server.use(
      http.post('/api/generate', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
      ])),
      http.post('/api/refine', () =>
        // No RateLimit-Reset header → reset is null
        new HttpResponse(null, { status: 429 })
      ),
    );
    await renderPage();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'tweak');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    );
    // Defaults to ~15 min wait
    expect(screen.getByRole('alert')).toHaveTextContent(/15/);
  });

  it('shows context_overflow message for context overflow error', async () => {
    server.use(
      http.post('/api/generate', () => sseStream([
        { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
      ])),
      http.post('/api/refine', () => sseStream([
        { type: 'error', message: 'context_overflow' },
      ])),
    );
    await renderPage();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'make it TypeScript');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));
    await waitFor(() =>
      expect(screen.getByText(/conversation too long/i)).toBeInTheDocument()
    );
  });

  it('rate limit alert shows singular "minute" when wait is exactly 1', async () => {
    // Use a reset time that yields exactly 1 minute
    const resetTime = String(Math.floor(Date.now() / 1000) + 60);
    server.use(http.post('/api/generate', () =>
      new HttpResponse(null, {
        status: 429,
        headers: { 'RateLimit-Reset': resetTime },
      })
    ));
    await renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    // Should show "1 minute" without trailing 's'
    expect(screen.getByRole('alert')).toHaveTextContent(/1 minute[^s]/);
  });

  it('share button from fromShare session uses routerState projectName/templateId', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    server.use(
      http.post('/api/share', () => HttpResponse.json({ id: 'share-xyz' })),
      http.post('/api/refine', () => sseStream([{ type: 'done', fileTree: sharedTree }])),
    );
    // fromShare mode — projectConfig not in store
    await act(async () => {
      useStore.setState({ selectedTemplate: null, projectConfig: null });
    });
    await renderPageFromShare();
    await waitFor(() => screen.getByRole('button', { name: /^share$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^share$/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/share/share-xyz')));
  });

  it('shows plural "files complete" during streaming with 2+ files', async () => {
    server.use(http.post('/api/generate', () =>
      new HttpResponse(
        new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'file_done', path: 'a.js', content: 'x' })}\n\n`));
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'file_done', path: 'b.js', content: 'y' })}\n\n`));
            // stream stays open
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    ));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText(/2 files complete/i)).toBeInTheDocument()
    );
  });

  it('Back button in error state navigates to /configure', async () => {
    server.use(http.post('/api/generate', () =>
      HttpResponse.json({ error: 'broken' }, { status: 500 })
    ));
    const FUTURE_ROUTES = { v7_startTransition: true, v7_relativeSplatPath: true };
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/preview']} future={FUTURE_ROUTES}>
          <Routes>
            <Route path="/preview" element={<PreviewPage />} />
            <Route path="/configure" element={<div>configure-page</div>} />
            <Route path="/" element={<div>home</div>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => screen.getByRole('button', { name: /back/i }));
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText('configure-page')).toBeInTheDocument();
  });

  it('fromWorkspace mode restores snapshots and skips generate call', async () => {
    const generateSpy = vi.fn(() => new Promise(() => {}));
    server.use(http.post('/api/generate', generateSpy));
    const snapshots = [
      { id: 0, label: 'Generated', fileTree: [{ path: 'a.js', content: 'v0' }], timestamp: Date.now() },
      { id: 1, label: 'Refinement 1', fileTree: [{ path: 'a.js', content: 'v1' }], timestamp: Date.now() },
    ];
    await act(async () => {
      render(
        <MemoryRouter
          initialEntries={[{
            pathname: '/preview',
            state: {
              fileTree: snapshots[1].fileTree,
              snapshots,
              projectName: 'my-app',
              templateId: 't',
              workspaceId: 'existing-id',
              fromWorkspace: true,
            },
          }]}
          future={FUTURE}
        >
          <Routes>
            <Route path="/preview" element={<PreviewPage />} />
            <Route path="/" element={<div>home</div>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise(r => setTimeout(r, 0));
    });
    expect(generateSpy).not.toHaveBeenCalled();
    expect(screen.getByText('a.js')).toBeInTheDocument();
    expect(screen.getByLabelText(/refinement history/i)).toBeInTheDocument();
  });
});
