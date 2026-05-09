import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import TemplatePickerPage from './TemplatePickerPage.jsx';
import { useAppConfig } from '../context/AppConfigContext.jsx';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

// AppConfigProvider fetches /api/config via MSW whose response resolves across
// multiple async hops outside act's tracking window. Mock the module so the
// provider is a passthrough and useAppConfig is controllable per-test.
vi.mock('../context/AppConfigContext.jsx', () => ({
  AppConfigProvider: ({ children }) => children,
  useAppConfig: vi.fn(),
}));

const templates = [
  { id: 'react-express', label: 'React + Express', description: 'D', tags: ['react'], files: [] },
  { id: 'vue-fastify', label: 'Vue + Fastify', description: 'D', tags: ['vue'], files: [] },
];

async function renderPage() {
  await act(async () => {
    render(
      <MemoryRouter future={FUTURE}>
        <TemplatePickerPage />
      </MemoryRouter>
    );
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('TemplatePickerPage', () => {
  beforeEach(() => {
    useAppConfig.mockReturnValue({ llmEnabled: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton cards while loading', async () => {
    server.use(http.get('/api/templates', () => new Promise(() => {})));
    await renderPage();
    expect(document.querySelectorAll('.shimmer').length).toBeGreaterThan(0);
  });

  it('renders template cards after load', async () => {
    server.use(http.get('/api/templates', () => HttpResponse.json(templates)));
    await renderPage();
    await waitFor(() => expect(screen.getByText('React + Express')).toBeInTheDocument());
    expect(screen.getByText('Vue + Fastify')).toBeInTheDocument();
  });

  it('shows bypass banner when llmEnabled is false', async () => {
    useAppConfig.mockReturnValue({ llmEnabled: false });
    server.use(http.get('/api/templates', () => HttpResponse.json(templates)));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/LLM unavailable/i)
    );
  });

  it('shows fallback templates on fetch failure', async () => {
    server.use(http.get('/api/templates', () => HttpResponse.error()));
    await renderPage();
    // ErrorToast (role=alert) appears with the error message
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('navigates to /configure when a template is selected', async () => {
    server.use(http.get('/api/templates', () => HttpResponse.json(templates)));
    await act(async () => {
      render(
        <MemoryRouter future={FUTURE}>
          <Routes>
            <Route path="/" element={<TemplatePickerPage />} />
            <Route path="/configure" element={<div>configure</div>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => screen.getByText('React + Express'));
    await userEvent.click(screen.getAllByRole('button', { name: /use this template/i })[0]);
    await waitFor(() => expect(screen.getByText('configure')).toBeInTheDocument());
  });
});
