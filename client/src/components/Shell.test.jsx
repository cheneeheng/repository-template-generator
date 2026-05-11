import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Shell } from './Shell.jsx';
import { vi, beforeEach } from 'vitest';

vi.mock('../lib/workspace.js', () => ({ loadWorkspace: () => [] }));

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

function LocationDisplay() {
  const { pathname } = useLocation();
  return <span data-testid="pathname">{pathname}</span>;
}

function renderShell(initialPath = '/configure') {
  return render(
    <MemoryRouter initialEntries={[initialPath]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<LocationDisplay />} />
        <Route path="/configure" element={<Shell step={2}><div>page</div></Shell>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Shell', () => {
  it('renders the home button', () => {
    renderShell();
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
  });

  it('navigates to / when home button is clicked', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: /home/i }));
    expect(screen.getByTestId('pathname').textContent).toBe('/');
  });

  it('renders children', () => {
    renderShell();
    expect(screen.getByText('page')).toBeInTheDocument();
  });
});
