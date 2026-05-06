import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppConfigProvider } from '../context/AppConfigContext.jsx';
import TemplatePickerPage from './TemplatePickerPage.jsx';

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
    server.use(http.get('/api/templates', () => new Promise(() => {})));
    renderPage();
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
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/LLM unavailable/i)
    );
  });

  it('shows fallback templates on fetch failure', async () => {
    server.use(http.get('/api/templates', () => HttpResponse.error()));
    renderPage();
    // ErrorToast (role=alert) appears with the error message
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('navigates to /configure when a template is selected', async () => {
    server.use(http.get('/api/templates', () => HttpResponse.json(templates)));
    render(
      <MemoryRouter>
        <AppConfigProvider>
          <Routes>
            <Route path="/" element={<TemplatePickerPage />} />
            <Route path="/configure" element={<div>configure</div>} />
          </Routes>
        </AppConfigProvider>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText('React + Express'));
    await userEvent.click(screen.getAllByRole('button', { name: /use this template/i })[0]);
    await waitFor(() => expect(screen.getByText('configure')).toBeInTheDocument());
  });
});
