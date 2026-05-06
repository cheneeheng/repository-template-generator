import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppConfigProvider } from '../context/AppConfigContext.jsx';
import ExportPage from './ExportPage.jsx';
import useStore from '../store.js';

const fileTree = [{ path: 'a.js', content: 'x' }];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/export']}>
      <AppConfigProvider>
        <Routes>
          <Route path="/export" element={<ExportPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </AppConfigProvider>
    </MemoryRouter>
  );
}

function renderPageWithProvider(provider = 'github') {
  useStore.setState({
    fileTree,
    projectConfig: { projectName: 'app', provider, description: 'desc' },
  });
  return render(
    <MemoryRouter initialEntries={['/export']}>
      <AppConfigProvider>
        <Routes>
          <Route path="/export" element={<ExportPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </AppConfigProvider>
    </MemoryRouter>
  );
}

describe('ExportPage', () => {
  beforeEach(() => {
    useStore.setState({
      fileTree,
      projectConfig: { projectName: 'app', provider: 'zip' },
    });
  });

  afterEach(() => {
    useStore.setState({ fileTree: null, projectConfig: null });
  });

  it('shows download ZIP button', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /download zip/i })).toBeInTheDocument()
    );
  });

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
        headers: { 'Content-Type': 'application/zip' },
      })
    ));
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /download zip/i }));
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());

    clickSpy.mockRestore();
  });

  it('shows spinner while ZIP download is in progress', async () => {
    let resolve;
    server.use(http.post('/api/export/zip', () =>
      new Promise((r) => { resolve = r; })
    ));
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    URL.revokeObjectURL = vi.fn();

    renderPage();
    const btn = await screen.findByRole('button', { name: /download zip/i });
    await userEvent.click(btn);

    expect(screen.getByRole('button').querySelector('[aria-label="Loading"]')).toBeTruthy();

    // Resolve to avoid dangling promise
    resolve(new HttpResponse(new Uint8Array([1]), { headers: { 'Content-Type': 'application/zip' } }));
  });

  it('redirects to / when no file tree in store', () => {
    useStore.setState({ fileTree: null });
    renderPage();
    expect(screen.getByText('home')).toBeInTheDocument();
  });
});

describe('ExportPage — OAuth provider flow', () => {
  afterEach(() => {
    useStore.setState({ fileTree: null, projectConfig: null });
    window.location.hash = '';
  });

  it('shows Connect GitHub link when github provider not yet authenticated', async () => {
    renderPageWithProvider('github');
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /connect github/i })).toBeInTheDocument()
    );
  });

  it('shows connected state when OAuth token is in URL fragment', async () => {
    window.location.hash = '#token=gho_test&provider=github';
    renderPageWithProvider('github');
    await waitFor(() =>
      expect(screen.getByText(/connected as github/i)).toBeInTheDocument()
    );
  });

  it('shows repo form toggle when connected', async () => {
    window.location.hash = '#token=gho_test&provider=github';
    renderPageWithProvider('github');
    await waitFor(() => screen.getByText(/connected as github/i));
    const toggle = screen.getByRole('button', { name: /create repository/i });
    await userEvent.click(toggle);
    expect(screen.getByRole('heading', { name: /create repository/i })).toBeInTheDocument();
  });

  it('submits repo creation form and shows repo URL', async () => {
    server.use(http.post('/api/export/repo', () =>
      HttpResponse.json({ repoUrl: 'https://github.com/user/repo' })
    ));
    window.location.hash = '#token=gho_test&provider=github';
    renderPageWithProvider('github');
    await waitFor(() => screen.getByText(/connected as github/i));
    // Open the repo form
    await userEvent.click(screen.getByRole('button', { name: /create repository/i }));
    // Now fill the form — labels need htmlFor/id to be accessible
    await userEvent.type(screen.getByRole('textbox', { name: /org \/ user/i }), 'myorg');
    await userEvent.type(screen.getByRole('textbox', { name: /repository name/i }), 'my-repo');
    // Submit via the form's submit button (not the toggle)
    const buttons = screen.getAllByRole('button', { name: /create repository/i });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'https://github.com/user/repo' })).toBeInTheDocument()
    );
  });

  it('shows re-auth error and clears token on 401 from repo API', async () => {
    server.use(http.post('/api/export/repo', () =>
      new HttpResponse(null, { status: 401 })
    ));
    window.location.hash = '#token=gho_test&provider=github';
    renderPageWithProvider('github');
    await waitFor(() => screen.getByText(/connected as github/i));
    await userEvent.click(screen.getByRole('button', { name: /create repository/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /org \/ user/i }), 'org');
    await userEvent.type(screen.getByRole('textbox', { name: /repository name/i }), 'repo');
    const buttons = screen.getAllByRole('button', { name: /create repository/i });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/session expired/i)
    );
  });

  it('shows error from hash fragment', async () => {
    window.location.hash = '#error=OAuth%20denied';
    renderPageWithProvider('github');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/OAuth denied/i)
    );
  });

  it('disconnect button clears token and hides connected state', async () => {
    window.location.hash = '#token=gho_test&provider=github';
    server.use(http.get('/api/auth/github/revoke', () => HttpResponse.json({ ok: true })));
    renderPageWithProvider('github');
    await waitFor(() => screen.getByText(/connected as github/i));
    await userEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    await waitFor(() =>
      expect(screen.queryByText(/connected as github/i)).not.toBeInTheDocument()
    );
  });
});
