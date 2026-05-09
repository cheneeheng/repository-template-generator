import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { server } from '../tests/mswServer.js';
import { http, HttpResponse } from 'msw';
import { AppConfigProvider, useAppConfig } from './AppConfigContext.jsx';

function ConfigConsumer() {
  const { llmEnabled } = useAppConfig();
  return <div data-testid="llm">{String(llmEnabled)}</div>;
}

describe('AppConfigContext', () => {
  it('provides llmEnabled=true by default before fetch resolves', async () => {
    server.use(http.get('/api/config', () => new Promise(() => {})));
    await act(async () => {
      render(
        <AppConfigProvider>
          <ConfigConsumer />
        </AppConfigProvider>
      );
    });
    expect(screen.getByTestId('llm').textContent).toBe('true');
  });

  it('updates llmEnabled from /api/config response', async () => {
    server.use(http.get('/api/config', () => HttpResponse.json({ llmEnabled: false })));
    await act(async () => {
      render(
        <AppConfigProvider>
          <ConfigConsumer />
        </AppConfigProvider>
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(screen.getByTestId('llm').textContent).toBe('false'));
  });

  it('keeps default config when fetch fails', async () => {
    server.use(http.get('/api/config', () => HttpResponse.error()));
    await act(async () => {
      render(
        <AppConfigProvider>
          <ConfigConsumer />
        </AppConfigProvider>
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    // Error is swallowed; default llmEnabled=true remains
    expect(screen.getByTestId('llm').textContent).toBe('true');
  });
});
