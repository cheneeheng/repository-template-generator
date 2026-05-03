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

  it('redirects to / when no file tree in store', () => {
    useStore.setState({ fileTree: null });
    renderPage();
    expect(screen.getByText('home')).toBeInTheDocument();
  });
});
