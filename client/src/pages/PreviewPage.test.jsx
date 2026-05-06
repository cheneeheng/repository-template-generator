import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppConfigProvider } from '../context/AppConfigContext.jsx';
import PreviewPage from './PreviewPage.jsx';
import useStore from '../store.js';

function sseStream(events) {
  return new HttpResponse(
    events.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''),
    { headers: { 'Content-Type': 'text/event-stream' } }
  );
}

function renderPage(configOverride = {}) {
  server.use(http.get('/api/config', () =>
    HttpResponse.json({ llmEnabled: true, ...configOverride })
  ));
  return render(
    <MemoryRouter initialEntries={['/preview']}>
      <AppConfigProvider>
        <Routes>
          <Route path="/preview" element={<PreviewPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </AppConfigProvider>
    </MemoryRouter>
  );
}

describe('PreviewPage', () => {
  beforeEach(() => {
    // Seed required store state so the page doesn't redirect
    useStore.setState({
      selectedTemplate: { id: 't', label: 'Template', description: 'D', tags: [] },
      projectConfig: { projectName: 'my-app', description: 'desc', provider: 'zip' },
    });
  });

  afterEach(() => {
    useStore.setState({ selectedTemplate: null, projectConfig: null, fileTree: null });
  });

  it('shows generating state while streaming', async () => {
    server.use(http.post('/api/generate', () => new Promise(() => {})));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Generating\.\.\./i)).toBeInTheDocument());
  });

  it('renders files as file_done events arrive', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'file_done', path: 'README.md', content: '# App' },
      { type: 'done', fileTree: [{ path: 'README.md', content: '# App' }] },
    ])));
    renderPage();
    await waitFor(() => expect(screen.getAllByText('README.md').length).toBeGreaterThan(0));
  });

  it('shows refinement panel after done', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
    ])));
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /refinement/i })).toBeInTheDocument()
    );
  });

  it('disables refinement panel in bypass mode', async () => {
    server.use(http.post('/api/generate', () => sseStream([
      { type: 'done', fileTree: [{ path: 'a.js', content: 'x' }] },
    ])));
    renderPage({ llmEnabled: false });
    await waitFor(() =>
      expect(screen.getByText(/Refinement requires an Anthropic API key/i)).toBeInTheDocument()
    );
  });

  it('shows error state and start-over button on error', async () => {
    server.use(http.post('/api/generate', () =>
      HttpResponse.json({ error: 'broken' }, { status: 500 })
    ));
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start over/i })).toBeInTheDocument()
    );
  });

  it('navigates home when start-over is clicked', async () => {
    server.use(http.post('/api/generate', () =>
      HttpResponse.json({ error: 'broken' }, { status: 500 })
    ));
    renderPage();
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
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/request limit/i)
    );
  });

  it('redirects to / when store has no selected template', () => {
    useStore.setState({ selectedTemplate: null, projectConfig: null });
    renderPage();
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
    renderPage();
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
    renderPage();
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
    renderPage();
    await waitFor(() => screen.getByRole('textbox', { name: /refinement/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /refinement/i }), 'make it TypeScript');
    await userEvent.click(screen.getByRole('button', { name: /^refine$/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
