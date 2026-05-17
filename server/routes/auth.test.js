import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../app.js';

vi.mock('../services/oauth.js');
vi.mock('../services/githubApp.js', () => ({
  getInstallationToken: vi.fn(),
}));
vi.mock('../services/llm.js', () => ({
  LLM_ENABLED: false,
  customiseStreaming: vi.fn(),
  refineStreaming: vi.fn(),
}));

// Shared app for providers tests (env vars read at request time, no reset needed)
const _app = createApp();
const _request = supertest(_app);

describe('GET /api/auth/providers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns github: true when GITHUB_CLIENT_ID set', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'abc');
    vi.stubEnv('GITLAB_CLIENT_ID', '');
    const res = await _request.get('/api/auth/providers');
    expect(res.body.github).toBe(true);
    expect(res.body.gitlab).toBe(false);
  });

  it('returns all false when no providers configured', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', '');
    vi.stubEnv('GITLAB_CLIENT_ID', '');
    const res = await _request.get('/api/auth/providers');
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

  it('redirects to GitLab auth URL', async () => {
    vi.stubEnv('GITLAB_CLIENT_ID', 'gl-abc');
    const { buildGitLabAuthUrl } = await import('../services/oauth.js');
    buildGitLabAuthUrl.mockReturnValue('https://gitlab.com/oauth/authorize?state=y');
    const { createApp } = await import('../app.js');

    const res = await supertest(createApp()).get('/api/auth/gitlab/start').redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('gitlab.com');
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

  it('returns 400 when gitlab is not configured', async () => {
    vi.stubEnv('GITLAB_CLIENT_ID', '');
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/auth/gitlab/start');
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
    const { buildGitHubAuthUrl, exchangeCodeForToken } =
      await import('../services/oauth.js');
    buildGitHubAuthUrl.mockReturnValue('https://github.com/login/oauth/authorize?state=planted');
    exchangeCodeForToken.mockResolvedValue('gho_token');

    const { createApp } = await import('../app.js');
    const app = createApp();

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

describe('GET /api/auth/:provider/callback — error from provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('redirects to /export#error when OAuth provider returns error param', async () => {
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp())
      .get('/api/auth/github/callback?error=access_denied&error_description=User+denied+access')
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/export#error=');
    expect(res.headers.location).toContain('User');
  });

  it('redirects to /export#error when error param present without description', async () => {
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp())
      .get('/api/auth/github/callback?error=access_denied')
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('access_denied');
  });

  it('redirects to /export#error when token exchange throws', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'abc');
    const { exchangeCodeForToken } = await import('../services/oauth.js');
    exchangeCodeForToken.mockRejectedValue(new Error('exchange failed'));

    const { createApp } = await import('../app.js');
    const app = createApp();

    const authMod = await import('./auth.js');
    authMod._seedState('err-state', {
      provider: 'github',
      expiresAt: Date.now() + 60_000,
    });

    const res = await supertest(app)
      .get('/api/auth/github/callback?code=bad&state=err-state')
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/export#error=');
  });
});

describe('GET /api/auth/:provider/callback — expired state sweep', () => {
  it('sweeps expired entries from pendingStates on interval tick', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const authMod = await import('./auth.js');

    authMod._seedState('expired-key', {
      provider: 'github',
      expiresAt: Date.now() - 1, // already expired
    });

    // Advance past the 60s sweep interval
    await vi.advanceTimersByTimeAsync(61_000);

    // The expired state should have been cleaned up — callback returns 400
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp())
      .get('/api/auth/github/callback?code=x&state=expired-key');
    expect(res.status).toBe(400);

    vi.useRealTimers();
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

  it('returns 200 when revocation succeeds', async () => {
    const { revokeToken } = await import('../services/oauth.js');
    revokeToken.mockResolvedValue(undefined);
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp()).get('/api/auth/github/revoke?token=tok');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('_seedState — non-test environment guard', () => {
  it('does not seed state when NODE_ENV is not test', async () => {
    vi.resetModules();
    const authMod = await import('./auth.js');
    vi.stubEnv('NODE_ENV', 'production');
    authMod._seedState('guard-test-state', { provider: 'github', expiresAt: Date.now() + 60_000 });

    // State was not seeded; callback returns 400 (unknown state)
    const { createApp } = await import('../app.js');
    const res = await supertest(createApp())
      .get('/api/auth/github/callback?code=x&state=guard-test-state');
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });
});
