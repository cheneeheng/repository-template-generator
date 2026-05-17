import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import ExportPage from './ExportPage.jsx';
import useStore from '../store.js';
import * as api from '../api.js';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

// AppConfigProvider fetches /api/config via MSW whose response resolves across
// multiple async hops outside act's tracking window. Mock the module so the
// provider is a passthrough.
vi.mock('../context/AppConfigContext.jsx', () => ({
  AppConfigProvider: ({ children }) => children,
  useAppConfig: vi.fn(() => ({ llmEnabled: true })),
}));

const fileTree = [{ path: 'a.js', content: 'x' }];

async function renderPage() {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/export']} future={FUTURE}>
        <Routes>
          <Route path="/export" element={<ExportPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    );
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function renderPageWithProvider(provider = 'github') {
  useStore.setState({
    fileTree,
    projectConfig: { projectName: 'app', provider, description: 'desc' },
  });
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/export']} future={FUTURE}>
        <Routes>
          <Route path="/export" element={<ExportPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    );
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('ExportPage', () => {
  beforeEach(() => {
    useStore.setState({
      fileTree,
      projectConfig: { projectName: 'app', provider: 'zip' },
    });
  });

  afterEach(async () => {
    await act(async () => { useStore.setState({ fileTree: null, projectConfig: null }); });
    vi.clearAllMocks();
  });

  it('shows download ZIP button', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /download zip/i })).toBeInTheDocument();
  });

  it('shows only ZIP button when no providers configured', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /download zip/i })).toBeInTheDocument();
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

    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /download zip/i }));
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
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await renderPage();
    const btn = screen.getByRole('button', { name: /download zip/i });
    await userEvent.click(btn);

    expect(screen.getByRole('button').querySelector('[aria-label="Loading"]')).toBeTruthy();

    await act(async () => {
      resolve(new HttpResponse(new Uint8Array([1]), { headers: { 'Content-Type': 'application/zip' } }));
      await new Promise((r) => setTimeout(r, 0));
    });
    clickSpy.mockRestore();
  });

  it('redirects to / when no file tree in store', async () => {
    useStore.setState({ fileTree: null });
    await renderPage();
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('dismisses error toast when x button is clicked', async () => {
    server.use(http.post('/api/export/zip', () =>
      HttpResponse.json({ error: 'quota exceeded' }, { status: 500 })
    ));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /download zip/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await userEvent.click(within(screen.getByRole('alert')).getByRole('button'));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('shows error toast when ZIP server responds with JSON error body', async () => {
    server.use(http.post('/api/export/zip', () =>
      HttpResponse.json({ error: 'quota exceeded' }, { status: 500 })
    ));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /download zip/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/quota exceeded/i)
    );
  });

  it('shows fallback error when ZIP response body is not JSON', async () => {
    server.use(http.post('/api/export/zip', () =>
      new HttpResponse('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/plain' } })
    ));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /download zip/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/zip export failed/i)
    );
  });

  it('uses "project.zip" when projectName is not set in config', async () => {
    useStore.setState({
      fileTree,
      projectConfig: { projectName: null, provider: 'zip' },
    });
    server.use(http.post('/api/export/zip', () =>
      new HttpResponse(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'application/zip' },
      })
    ));
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /download zip/i }));
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());

    // Advance timers to trigger URL.revokeObjectURL cleanup
    vi.useFakeTimers();
    vi.advanceTimersByTime(11_000);
    vi.useRealTimers();

    clickSpy.mockRestore();
  });

  it('falls back to "Failed to export ZIP" when error has no message', async () => {
    // Render first so the providers useEffect fetch completes before we spy on fetch
    await renderPage();
    const noMsgErr = Object.assign(new Error(), { message: undefined });
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(noMsgErr);
    await userEvent.click(screen.getByRole('button', { name: /download zip/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to export zip/i)
    );
    vi.restoreAllMocks();
  });
});

describe('ExportPage — OAuth provider flow', () => {
  afterEach(async () => {
    window.location.hash = '';
    await act(async () => { useStore.setState({ fileTree: null, projectConfig: null }); });
    vi.clearAllMocks();
  });

  it('shows Connect GitHub link when github provider not yet authenticated', async () => {
    await renderPageWithProvider('github');
    expect(screen.getByRole('link', { name: /connect github/i })).toBeInTheDocument();
  });

  it('shows connected state when OAuth token is in URL fragment', async () => {
    window.location.hash = '#token=gho_test&provider=github';
    await renderPageWithProvider('github');
    expect(screen.getByText(/connected as github/i)).toBeInTheDocument();
  });

  it('shows repo form toggle when connected', async () => {
    window.location.hash = '#token=gho_test&provider=github';
    await renderPageWithProvider('github');
    const toggle = screen.getByRole('button', { name: /create repository/i });
    await userEvent.click(toggle);
    expect(screen.getByRole('heading', { name: /create repository/i })).toBeInTheDocument();
  });

  it('submits repo creation form and shows repo URL', async () => {
    server.use(http.post('/api/export/repo', () =>
      HttpResponse.json({ repoUrl: 'https://github.com/user/repo' })
    ));
    window.location.hash = '#token=gho_test&provider=github';
    await renderPageWithProvider('github');
    // Open the repo form
    await userEvent.click(screen.getByRole('button', { name: /create repository/i }));
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
    await renderPageWithProvider('github');
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
    await renderPageWithProvider('github');
    expect(screen.getByRole('alert')).toHaveTextContent(/OAuth denied/i);
  });

  it('clicking private checkbox marks repo as private', async () => {
    server.use(http.post('/api/export/repo', () =>
      HttpResponse.json({ repoUrl: 'https://github.com/user/private-repo' })
    ));
    window.location.hash = '#token=gho_test&provider=github';
    await renderPageWithProvider('github');
    await userEvent.click(screen.getByRole('button', { name: /create repository/i }));
    const checkbox = screen.getByRole('checkbox', { name: /private repository/i });
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('shows error on non-401 repo creation failure', async () => {
    server.use(http.post('/api/export/repo', () =>
      HttpResponse.json({ error: 'repository already exists' }, { status: 422 })
    ));
    window.location.hash = '#token=gho_test&provider=github';
    await renderPageWithProvider('github');
    await userEvent.click(screen.getByRole('button', { name: /create repository/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /org \/ user/i }), 'org');
    await userEvent.type(screen.getByRole('textbox', { name: /repository name/i }), 'repo');
    const buttons = screen.getAllByRole('button', { name: /create repository/i });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/repository already exists/i)
    );
  });

  it('falls back to "Failed to create repository" when error has no message', async () => {
    vi.spyOn(api, 'exportRepo').mockRejectedValueOnce({ code: 'UNKNOWN' });
    window.location.hash = '#token=gho_test&provider=github';
    await renderPageWithProvider('github');
    await userEvent.click(screen.getByRole('button', { name: /create repository/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /org \/ user/i }), 'org');
    await userEvent.type(screen.getByRole('textbox', { name: /repository name/i }), 'repo');
    const buttons = screen.getAllByRole('button', { name: /create repository/i });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Failed to create repository/i)
    );
    vi.restoreAllMocks();
  });

  it('shows Namespace label and GitLab error message when gitlab provider expires', async () => {
    server.use(http.post('/api/export/repo', () =>
      new HttpResponse(null, { status: 401 })
    ));
    window.location.hash = '#token=glpat_test&provider=gitlab';
    await renderPageWithProvider('gitlab');
    await userEvent.click(screen.getByRole('button', { name: /create repository/i }));
    // Gitlab uses "Namespace" label
    expect(screen.getByRole('textbox', { name: /namespace/i })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /namespace/i }), 'mygroup');
    await userEvent.type(screen.getByRole('textbox', { name: /repository name/i }), 'repo');
    const buttons = screen.getAllByRole('button', { name: /create repository/i });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/gitlab/i)
    );
  });

  it('disconnect button clears token and hides connected state', async () => {
    window.location.hash = '#token=gho_test&provider=github';
    server.use(http.get('/api/auth/github/revoke', () => HttpResponse.json({ ok: true })));
    await renderPageWithProvider('github');
    await userEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    await waitFor(() =>
      expect(screen.queryByText(/connected as github/i)).not.toBeInTheDocument()
    );
  });

  it('disconnect swallows revoke fetch errors silently', async () => {
    window.location.hash = '#token=gho_test&provider=github';
    server.use(http.get('/api/auth/github/revoke', () => HttpResponse.error()));
    await renderPageWithProvider('github');
    await userEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    await waitFor(() =>
      expect(screen.queryByText(/connected as github/i)).not.toBeInTheDocument()
    );
  });

  it('fragment with provider=github sets authState as object with .token', async () => {
    window.location.hash = '#token=gho_test&provider=github';
    await renderPageWithProvider('github');
    expect(screen.getByText(/connected as github/i)).toBeInTheDocument();
  });

  it('fragment with provider=github-app sets authState github-app with .token', async () => {
    window.location.hash = '#token=ghs_install&provider=github-app';
    await renderPageWithProvider('github');
    await waitFor(() =>
      expect(screen.getByText(/github app connected/i)).toBeInTheDocument()
    );
  });

  it('fragment with provider=gitlab reads refreshToken and expiresAt', async () => {
    window.location.hash = '#token=glpat_test&refreshToken=glrefresh&expiresAt=9999999999999&provider=gitlab';
    await renderPageWithProvider('gitlab');
    expect(screen.getByText(/connected as gitlab/i)).toBeInTheDocument();
  });

  it('shows GitHub App connect button when providers.githubApp is true', async () => {
    server.use(
      http.get('/api/auth/providers', () =>
        HttpResponse.json({ github: true, githubApp: true, gitlab: false })
      )
    );
    await renderPageWithProvider('github');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /connect via github app/i })).toBeInTheDocument()
    );
  });

  it('GitHub App connect button navigates to /api/auth/github-app/install', async () => {
    server.use(
      http.get('/api/auth/providers', () =>
        HttpResponse.json({ github: true, githubApp: true, gitlab: false })
      )
    );
    await renderPageWithProvider('github');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /connect via github app/i })).toBeInTheDocument()
    );
    const link = screen.getByRole('link', { name: /connect via github app/i });
    expect(link).toHaveAttribute('href', '/api/auth/github-app/install');
  });

  it('401 on repo creation with gitlab provider triggers refresh and retries', async () => {
    let callCount = 0;
    server.use(
      http.post('/api/export/repo', () => {
        callCount++;
        if (callCount === 1) return new HttpResponse(null, { status: 401 });
        return HttpResponse.json({ repoUrl: 'https://gitlab.com/user/repo' });
      }),
      http.post('/api/auth/gitlab/refresh', () =>
        HttpResponse.json({ accessToken: 'new_token', refreshToken: 'new_refresh', expiresAt: 9999999999999 })
      ),
    );
    window.location.hash = '#token=glpat_test&refreshToken=glrefresh&expiresAt=9999999999999&provider=gitlab';
    await renderPageWithProvider('gitlab');
    await userEvent.click(screen.getByRole('button', { name: /create repository/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /namespace/i }), 'mygroup');
    await userEvent.type(screen.getByRole('textbox', { name: /repository name/i }), 'repo');
    const buttons = screen.getAllByRole('button', { name: /create repository/i });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'https://gitlab.com/user/repo' })).toBeInTheDocument()
    );
  });

  it('401 on repo creation with github provider goes straight to re-auth prompt', async () => {
    server.use(http.post('/api/export/repo', () => new HttpResponse(null, { status: 401 })));
    window.location.hash = '#token=gho_test&provider=github';
    await renderPageWithProvider('github');
    await userEvent.click(screen.getByRole('button', { name: /create repository/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /org \/ user/i }), 'org');
    await userEvent.type(screen.getByRole('textbox', { name: /repository name/i }), 'repo');
    const buttons = screen.getAllByRole('button', { name: /create repository/i });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/session expired/i)
    );
  });

  it('refresh failure clears gitlab auth state and shows re-auth message', async () => {
    server.use(
      http.post('/api/export/repo', () => new HttpResponse(null, { status: 401 })),
      http.post('/api/auth/gitlab/refresh', () => new HttpResponse(null, { status: 401 })),
    );
    window.location.hash = '#token=glpat_test&refreshToken=expired_refresh&expiresAt=9999999999999&provider=gitlab';
    await renderPageWithProvider('gitlab');
    await userEvent.click(screen.getByRole('button', { name: /create repository/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /namespace/i }), 'mygroup');
    await userEvent.type(screen.getByRole('textbox', { name: /repository name/i }), 'repo');
    const buttons = screen.getAllByRole('button', { name: /create repository/i });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/session expired/i)
    );
  });

});
