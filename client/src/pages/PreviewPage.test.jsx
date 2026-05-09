import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import PreviewPage from './PreviewPage.jsx';
import useStore from '../store.js';
import { useAppConfig } from '../context/AppConfigContext.jsx';

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
});
