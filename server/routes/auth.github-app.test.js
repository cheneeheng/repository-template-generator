import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../app.js';

vi.mock('../services/llm.js', () => ({
  LLM_ENABLED: false,
  customiseStreaming: vi.fn(),
  refineStreaming: vi.fn(),
}));

vi.mock('../services/githubApp.js', () => ({
  getInstallationToken: vi.fn(),
}));

const app = createApp();
const request = supertest(app);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/auth/github-app/install', () => {
  it('redirects to GITHUB_APP_INSTALLATION_URL when configured', async () => {
    vi.stubEnv('GITHUB_APP_INSTALLATION_URL', 'https://github.com/apps/myapp/installations/new');
    const res = await request.get('/api/auth/github-app/install').redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://github.com/apps/myapp/installations/new');
  });

  it('returns 404 when GITHUB_APP_INSTALLATION_URL not set', async () => {
    vi.stubEnv('GITHUB_APP_INSTALLATION_URL', '');
    const res = await request.get('/api/auth/github-app/install');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('GitHub App not configured');
  });
});

describe('GET /api/auth/github-app/callback', () => {
  it('exchanges installation_id for token and redirects with fragment', async () => {
    vi.stubEnv('GITHUB_APP_ID', '12345');
    const { getInstallationToken } = await import('../services/githubApp.js');
    getInstallationToken.mockResolvedValueOnce('ghs_installation_token');

    const res = await request
      .get('/api/auth/github-app/callback?installation_id=99&setup_action=install')
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('token=ghs_installation_token');
    expect(res.headers.location).toContain('provider=github-app');
  });

  it('redirects to / when setup_action=delete', async () => {
    vi.stubEnv('GITHUB_APP_ID', '12345');
    const res = await request
      .get('/api/auth/github-app/callback?setup_action=delete')
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  it('redirects with error fragment when installation_id is missing', async () => {
    vi.stubEnv('GITHUB_APP_ID', '12345');
    const res = await request
      .get('/api/auth/github-app/callback?setup_action=install')
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=');
    expect(decodeURIComponent(res.headers.location)).toContain('Missing installation_id');
  });

  it('redirects with error fragment when token exchange fails', async () => {
    vi.stubEnv('GITHUB_APP_ID', '12345');
    const { getInstallationToken } = await import('../services/githubApp.js');
    getInstallationToken.mockRejectedValueOnce(new Error('GitHub App token exchange failed: 401'));

    const res = await request
      .get('/api/auth/github-app/callback?installation_id=99&setup_action=install')
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=');
    expect(decodeURIComponent(res.headers.location)).toContain('token exchange failed');
  });

  it('returns 404 when GITHUB_APP_ID not set', async () => {
    vi.stubEnv('GITHUB_APP_ID', '');
    const res = await request
      .get('/api/auth/github-app/callback?installation_id=99&setup_action=install');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('GitHub App not configured');
  });
});
