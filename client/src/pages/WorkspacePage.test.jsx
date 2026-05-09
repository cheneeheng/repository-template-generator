import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, it, expect } from 'vitest';
import WorkspacePage from './WorkspacePage.jsx';
import { saveEntry } from '../lib/workspace.js';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function makeEntry(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    projectName: 'my-app',
    templateId: 'react-starter',
    fileTree: [{ path: 'a.js', content: '' }, { path: 'b.js', content: '' }, { path: 'c.js', content: '' }],
    snapshots: [{ id: 0, label: 'Generated', fileTree: [], timestamp: Date.now() }],
    savedAt: Date.now() - 7200_000, // 2 hr ago
    ...overrides,
  }
}

async function renderPage(initialPath = '/workspace') {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[initialPath]} future={FUTURE}>
        <Routes>
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/preview" element={<div data-testid="preview-page">preview</div>} />
        </Routes>
      </MemoryRouter>
    );
    await new Promise(r => setTimeout(r, 0));
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe('WorkspacePage', () => {
  it('shows empty state when no entries', async () => {
    await renderPage();
    expect(screen.getByText(/no saved projects yet/i)).toBeInTheDocument();
  });

  it('renders entry list with project name, template, file count, relative time', async () => {
    saveEntry(makeEntry());
    await renderPage();
    expect(screen.getByText('my-app')).toBeInTheDocument();
    expect(screen.getByText(/react-starter/i)).toBeInTheDocument();
    expect(screen.getByText(/3 files/i)).toBeInTheDocument();
    expect(screen.getByText(/2 hr ago/i)).toBeInTheDocument();
  });

  it('Open button navigates to /preview with correct router state', async () => {
    const entry = makeEntry({ id: 'entry-1', projectName: 'proj', templateId: 'tmpl' });
    saveEntry(entry);
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(screen.getByTestId('preview-page')).toBeInTheDocument();
  });

  it('Delete button removes entry from the list', async () => {
    saveEntry(makeEntry({ id: 'del-1' }));
    await renderPage();
    expect(screen.getByText('my-app')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(screen.queryByText('my-app')).not.toBeInTheDocument();
    expect(screen.getByText(/no saved projects yet/i)).toBeInTheDocument();
  });
});
