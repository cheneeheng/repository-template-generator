import { render, screen, waitFor, act } from '@testing-library/react';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppConfigProvider } from '../context/AppConfigContext.jsx';
import ConfigurePage from './ConfigurePage.jsx';
import useStore from '../store.js';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/configure']}>
      <AppConfigProvider>
        <Routes>
          <Route path="/configure" element={<ConfigurePage />} />
          <Route path="/preview" element={<div>preview</div>} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </AppConfigProvider>
    </MemoryRouter>
  );
}

describe('ConfigurePage', () => {
  beforeEach(() => {
    useStore.setState({
      selectedTemplate: { id: 't', label: 'Test Template', description: 'D', tags: [] },
      projectConfig: null,
    });
  });

  afterEach(() => {
    useStore.setState({ selectedTemplate: null, projectConfig: null });
  });

  it('renders form fields', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/project name/i)).toBeInTheDocument());
    expect(screen.getByText(/description/i)).toBeInTheDocument();
  });

  it('submit button is disabled while providers are loading', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
  });

  it('navigates to /preview on submit', async () => {
    renderPage();
    // Wait for providers to load (button becomes enabled)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /generate/i })).not.toBeDisabled()
    );
    await userEvent.type(screen.getByRole('textbox', { name: /project name/i }), 'my-app');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    expect(screen.getByText('preview')).toBeInTheDocument();
  });

  it('redirects to / when no template is selected', () => {
    useStore.setState({ selectedTemplate: null });
    renderPage();
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('shows and allows changing provider when github is configured', async () => {
    server.use(http.get('/api/auth/providers', () =>
      HttpResponse.json({ github: true, gitlab: false })
    ));
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/github/i)).toBeInTheDocument());
    const githubRadio = screen.getByLabelText(/github/i);
    expect(githubRadio).toBeInTheDocument();
    await userEvent.click(githubRadio);
    expect(githubRadio).toBeChecked();
  });

  it('falls back to ZIP-only when providers fetch fails', async () => {
    server.use(http.get('/api/auth/providers', () => HttpResponse.error()));
    renderPage();
    // Button becomes enabled once the error fallback sets availableProviders
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /generate/i })).not.toBeDisabled()
    );
    expect(screen.queryByLabelText(/github/i)).not.toBeInTheDocument();
  });
});
