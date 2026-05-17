import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SharePage from './SharePage.jsx';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

const sharedPayload = {
  fileTree: [{ path: 'README.md', content: '# Hello' }],
  projectName: 'my-app',
  templateId: 'node-express',
};

async function renderShare(id = 'abcd1234') {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[`/share/${id}`]} future={FUTURE}>
        <Routes>
          <Route path="/share/:id" element={<SharePage />} />
          <Route path="/" element={<div>home</div>} />
          <Route path="/preview" element={<div data-testid="preview-page">preview</div>} />
        </Routes>
      </MemoryRouter>
    );
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('SharePage', () => {
  it('shows loading spinner on mount', async () => {
    server.use(http.get('/api/share/:id', () => new Promise(() => {})));
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/share/abcd1234']} future={FUTURE}>
          <Routes>
            <Route path="/share/:id" element={<SharePage />} />
          </Routes>
        </MemoryRouter>
      );
    });
    expect(screen.getByText(/Loading shared project/i)).toBeInTheDocument();
  });

  it('navigates to /preview with correct state on success', async () => {
    server.use(http.get('/api/share/:id', () => HttpResponse.json(sharedPayload)));
    await renderShare();
    await waitFor(() => expect(screen.getByTestId('preview-page')).toBeInTheDocument());
  });

  it('shows not-found/expired message on 404', async () => {
    server.use(http.get('/api/share/:id', () => HttpResponse.json({ error: 'not_found' }, { status: 404 })));
    await renderShare();
    await waitFor(() => expect(screen.getByText(/not found or has expired/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /start a new project/i })).toBeInTheDocument();
  });

  it('shows generic error on non-404 server error', async () => {
    server.use(http.get('/api/share/:id', () => HttpResponse.json({ error: 'server error' }, { status: 500 })));
    await renderShare();
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /start a new project/i })).toBeInTheDocument();
  });

  it('shows generic error on network failure', async () => {
    server.use(http.get('/api/share/:id', () => HttpResponse.error()));
    await renderShare();
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
  });

  it('generic error start-over button navigates home', async () => {
    server.use(http.get('/api/share/:id', () => HttpResponse.json({ error: 'server error' }, { status: 500 })));
    await renderShare();
    await waitFor(() => screen.getByRole('button', { name: /start a new project/i }));
    await userEvent.click(screen.getByRole('button', { name: /start a new project/i }));
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('not-found start-over button navigates home', async () => {
    server.use(http.get('/api/share/:id', () => HttpResponse.json({ error: 'not_found' }, { status: 404 })));
    await renderShare();
    await waitFor(() => screen.getByRole('button', { name: /start a new project/i }));
    await userEvent.click(screen.getByRole('button', { name: /start a new project/i }));
    expect(screen.getByText('home')).toBeInTheDocument();
  });
});
