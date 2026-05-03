import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';

vi.mock('../services/oauth.js');

describe('GET /api/auth/providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns github: true when GITHUB_CLIENT_ID set', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'abc');
    vi.stubEnv('GITLAB_CLIENT_ID', '');
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/auth/providers');
    expect(res.body.github).toBe(true);
    expect(res.body.gitlab).toBe(false);
  });

  it('returns all false when no providers configured', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', '');
    vi.stubEnv('GITLAB_CLIENT_ID', '');
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/auth/providers');
    expect(res.body.github).toBe(false);
    expect(res.body.gitlab).toBe(false);
  });
});

describe('GET /api/auth/:provider/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('redirects to GitHub auth URL', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'abc');
    const { buildGitHubAuthUrl } = await import('../services/oauth.js');
    buildGitHubAuthUrl.mockReturnValue('https://github.com/login/oauth/authorize?state=x');
    const { createApp } = await import('../app.js');

    const res = await supertest(createApp()).get('/api/auth/github/start').redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('github.com');
  });

  it('returns 400 for unknown provider', async () => {
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/auth/bitbucket/start');
    expect(res.status).toBe(400);
  });

  it('returns 400 when provider is not configured', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', '');
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/auth/github/start');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/:provider/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 400 for unknown state', async () => {
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp())
      .get('/api/auth/github/callback?code=x&state=unknown-state');
    expect(res.status).toBe(400);
  });

  it('redirects to /export with token in fragment after valid exchange', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'abc');
    const { buildGitHubAuthUrl, exchangeCodeForToken, _seedState } =
      await import('../services/oauth.js');
    buildGitHubAuthUrl.mockReturnValue('https://github.com/login/oauth/authorize?state=planted');
    exchangeCodeForToken.mockResolvedValue('gho_token');

    const { createApp, _seedStateForTest } = await import('../app.js');
    const app = createApp();

    // Use the auth router's _seedState to inject a known state
    const authMod = await import('./auth.js');
    authMod._seedState('known-state', {
      provider: 'github',
      expiresAt: Date.now() + 60_000,
    });

    const res = await supertest(app)
      .get('/api/auth/github/callback?code=abc123&state=known-state')
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('gho_token');
  });
});

describe('GET /api/auth/:provider/revoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 200 even when revocation throws', async () => {
    const { revokeToken } = await import('../services/oauth.js');
    revokeToken.mockRejectedValue(new Error('network error'));
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/auth/github/revoke?token=tok');
    expect(res.status).toBe(200);
  });
});
