import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import ConfigurePage from './ConfigurePage.jsx';
import * as api from '../api.js';
import useStore from '../store.js';

// v7_relativeSplatPath silences the splat-route resolution warning.
// v7_startTransition is intentionally omitted: it wraps Router state in
// React.startTransition, which defers updates outside RTL's act boundary and
// produces spurious "not wrapped in act" warnings in tests.
const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

// fetchAuthProviders is mocked so its Promise resolves as a deterministic
// microtask. MSW 2.x in Node.js resolves responses across multiple async hops
// (interceptor → body streaming) that land outside act's tracking window.
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAuthProviders: vi.fn(),
}));

// Render and drain all async effects within a single act boundary.
// await new Promise(setTimeout) ensures microtasks (including the mocked
// fetchAuthProviders resolution) complete before act exits.
async function renderPage() {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/configure']} future={FUTURE}>
        <Routes>
          <Route path="/configure" element={<ConfigurePage />} />
          <Route path="/preview" element={<div>preview</div>} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    );
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('ConfigurePage', () => {
  beforeEach(() => {
    useStore.setState({
      selectedTemplate: { id: 't', label: 'Test Template', description: 'D', tags: [] },
      projectConfig: null,
    });
    api.fetchAuthProviders.mockResolvedValue({ github: false, gitlab: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders form fields', async () => {
    await renderPage();
    expect(screen.getByText(/project name/i)).toBeInTheDocument();
    expect(screen.getByText(/description/i)).toBeInTheDocument();
  });

  it('submit button is disabled while providers are loading', async () => {
    // Check disabled state synchronously before the mocked fetch resolves.
    // RTL's render() wraps in act and flushes synchronous effects, but the
    // fetchAuthProviders Promise resolves on the next microtask — after this
    // synchronous assertion but before any await gives the event loop control.
    api.fetchAuthProviders.mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <MemoryRouter initialEntries={['/configure']} future={FUTURE}>
        <Routes>
          <Route path="/configure" element={<ConfigurePage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
  });

  it('navigates to /preview on submit', async () => {
    await renderPage();
    await userEvent.type(screen.getByRole('textbox', { name: /project name/i }), 'my-app');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    expect(screen.getByText('preview')).toBeInTheDocument();
  });

  it('redirects to / when no template is selected', async () => {
    useStore.setState({ selectedTemplate: null });
    await renderPage();
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('shows and allows changing provider when github is configured', async () => {
    api.fetchAuthProviders.mockResolvedValue({ github: true, gitlab: false });
    await renderPage();
    const githubRadio = screen.getByLabelText(/github/i);
    await userEvent.click(githubRadio);
    expect(githubRadio).toBeChecked();
  });

  it('falls back to ZIP-only when providers fetch fails', async () => {
    api.fetchAuthProviders.mockRejectedValue(new Error('network error'));
    await renderPage();
    expect(screen.getByRole('button', { name: /generate/i })).not.toBeDisabled();
    expect(screen.queryByLabelText(/github/i)).not.toBeInTheDocument();
  });
});
