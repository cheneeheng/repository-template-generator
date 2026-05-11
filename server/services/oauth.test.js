import { describe, it, expect, vi, beforeEach } from 'vitest';

global.fetch = vi.fn();

describe('buildGitHubAuthUrl', () => {
  it('includes client_id, scope, state, and redirect_uri', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'client123');
    vi.stubEnv('GITHUB_REDIRECT_URI', 'http://localhost:3000/api/auth/github/callback');
    vi.resetModules();
    const { buildGitHubAuthUrl } = await import('./oauth.js');

    const url = new URL(buildGitHubAuthUrl('state-xyz'));
    expect(url.searchParams.get('client_id')).toBe('client123');
    expect(url.searchParams.get('scope')).toBe('repo');
    expect(url.searchParams.get('state')).toBe('state-xyz');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/auth/github/callback'
    );
  });
});

describe('buildGitLabAuthUrl', () => {
  it('uses GITLAB_BASE_URL when set', async () => {
    vi.stubEnv('GITLAB_BASE_URL', 'https://gitlab.example.com');
    vi.stubEnv('GITLAB_CLIENT_ID', 'glclient');
    vi.stubEnv('GITLAB_REDIRECT_URI', 'http://localhost/cb');
    vi.resetModules();
    const { buildGitLabAuthUrl } = await import('./oauth.js');

    const url = buildGitLabAuthUrl('state-abc');
    expect(url).toContain('gitlab.example.com');
  });

  it('defaults to gitlab.com when GITLAB_BASE_URL not set', async () => {
    delete process.env.GITLAB_BASE_URL;
    vi.stubEnv('GITLAB_CLIENT_ID', 'glclient');
    vi.stubEnv('GITLAB_REDIRECT_URI', 'http://localhost/cb');
    vi.resetModules();
    const { buildGitLabAuthUrl } = await import('./oauth.js');

    const url = buildGitLabAuthUrl('state-def');
    expect(url).toContain('gitlab.com');
  });
});

describe('exchangeCodeForToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns access_token on success (GitHub)', async () => {
    fetch.mockResolvedValueOnce({ json: async () => ({ access_token: 'gho_test' }) });
    vi.stubEnv('GITHUB_CLIENT_ID', 'c');
    vi.stubEnv('GITHUB_CLIENT_SECRET', 's');
    vi.stubEnv('GITHUB_REDIRECT_URI', 'http://localhost/cb');
    vi.resetModules();
    const { exchangeCodeForToken } = await import('./oauth.js');

    const token = await exchangeCodeForToken('github', 'code123');
    expect(token).toBe('gho_test');
  });

  it('throws 502 when GitHub returns an error', async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({ error: 'bad_verification_code', error_description: 'Code expired' }),
    });
    vi.stubEnv('GITHUB_CLIENT_ID', 'c');
    vi.stubEnv('GITHUB_CLIENT_SECRET', 's');
    vi.stubEnv('GITHUB_REDIRECT_URI', 'http://localhost/cb');
    vi.resetModules();
    const { exchangeCodeForToken } = await import('./oauth.js');
    await expect(exchangeCodeForToken('github', 'bad')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('throws 400 for unknown provider', async () => {
    vi.resetModules();
    const { exchangeCodeForToken } = await import('./oauth.js');
    await expect(exchangeCodeForToken('bitbucket', 'code')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns access_token on success (GitLab)', async () => {
    fetch.mockResolvedValueOnce({ json: async () => ({ access_token: 'glpat_test' }) });
    vi.stubEnv('GITLAB_CLIENT_ID', 'gl_client');
    vi.stubEnv('GITLAB_CLIENT_SECRET', 'gl_secret');
    vi.stubEnv('GITLAB_REDIRECT_URI', 'http://localhost/gl-cb');
    vi.resetModules();
    const { exchangeCodeForToken } = await import('./oauth.js');
    const token = await exchangeCodeForToken('gitlab', 'gl_code');
    expect(token).toBe('glpat_test');
  });

  it('uses gitlab.com default when GITLAB_BASE_URL not set', async () => {
    fetch.mockResolvedValueOnce({ json: async () => ({ access_token: 'glpat_default' }) });
    delete process.env.GITLAB_BASE_URL;
    vi.stubEnv('GITLAB_CLIENT_ID', 'gl_client');
    vi.stubEnv('GITLAB_CLIENT_SECRET', 'gl_secret');
    vi.stubEnv('GITLAB_REDIRECT_URI', 'http://localhost/gl-cb');
    vi.resetModules();
    const { exchangeCodeForToken } = await import('./oauth.js');
    const token = await exchangeCodeForToken('gitlab', 'gl_code');
    expect(token).toBe('glpat_default');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('gitlab.com'),
      expect.any(Object)
    );
  });

  it('throws 502 when GitLab returns an error', async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({ error: 'invalid_grant', error_description: 'Code expired' }),
    });
    vi.stubEnv('GITLAB_CLIENT_ID', 'gl_client');
    vi.stubEnv('GITLAB_CLIENT_SECRET', 'gl_secret');
    vi.stubEnv('GITLAB_REDIRECT_URI', 'http://localhost/gl-cb');
    vi.resetModules();
    const { exchangeCodeForToken } = await import('./oauth.js');
    await expect(exchangeCodeForToken('gitlab', 'bad')).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe('revokeToken', () => {
  it('does not throw on fetch failure', async () => {
    fetch.mockRejectedValueOnce(new Error('network error'));
    vi.resetModules();
    const { revokeToken } = await import('./oauth.js');
    await expect(revokeToken('github', 'tok')).resolves.not.toThrow();
  });

  it('resolves without error on GitHub revoke success', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    vi.stubEnv('GITHUB_CLIENT_ID', 'c');
    vi.stubEnv('GITHUB_CLIENT_SECRET', 's');
    vi.resetModules();
    const { revokeToken } = await import('./oauth.js');
    await expect(revokeToken('github', 'tok')).resolves.toBeUndefined();
  });

  it('resolves without error on GitLab revoke', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    vi.stubEnv('GITLAB_BASE_URL', 'https://gitlab.com');
    vi.stubEnv('GITLAB_CLIENT_ID', 'c');
    vi.stubEnv('GITLAB_CLIENT_SECRET', 's');
    vi.resetModules();
    const { revokeToken } = await import('./oauth.js');
    await expect(revokeToken('gitlab', 'tok')).resolves.toBeUndefined();
  });

  it('uses gitlab.com default for revoke when GITLAB_BASE_URL not set', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    delete process.env.GITLAB_BASE_URL;
    vi.stubEnv('GITLAB_CLIENT_ID', 'c');
    vi.stubEnv('GITLAB_CLIENT_SECRET', 's');
    vi.resetModules();
    const { revokeToken } = await import('./oauth.js');
    await expect(revokeToken('gitlab', 'tok')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('gitlab.com'),
      expect.any(Object)
    );
  });
});
