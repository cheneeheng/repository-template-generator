import { render, screen, waitFor, act } from '@testing-library/react';
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
});
