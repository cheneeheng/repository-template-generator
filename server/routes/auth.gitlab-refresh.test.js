import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../app.js';

global.fetch = vi.fn();

vi.mock('../services/llm.js', () => ({
  LLM_ENABLED: false,
  customiseStreaming: vi.fn(),
  refineStreaming: vi.fn(),
}));

const app = createApp();
const request = supertest(app);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GITLAB_CLIENT_ID', 'gl_client');
  vi.stubEnv('GITLAB_CLIENT_SECRET', 'gl_secret');
  vi.stubEnv('GITLAB_REDIRECT_URI', 'http://localhost:3000/api/auth/gitlab/callback');
  vi.stubEnv('GITLAB_BASE_URL', 'https://gitlab.com');
});

describe('POST /api/auth/gitlab/refresh', () => {
  it('returns new accessToken, refreshToken, expiresAt on success', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new_access',
        refresh_token: 'new_refresh',
        expires_in: 7200,
      }),
    });

    const res = await request
      .post('/api/auth/gitlab/refresh')
      .send({ refreshToken: 'old_refresh_token' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('new_access');
    expect(res.body.refreshToken).toBe('new_refresh');
    expect(typeof res.body.expiresAt).toBe('number');
  });

  it('returns 401 refresh_failed when GitLab returns non-ok', async () => {
    fetch.mockResolvedValueOnce({ ok: false });

    const res = await request
      .post('/api/auth/gitlab/refresh')
      .send({ refreshToken: 'expired_token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('refresh_failed');
  });

  it('returns 400 when refreshToken body field is missing', async () => {
    const res = await request
      .post('/api/auth/gitlab/refresh')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when refreshToken is empty string', async () => {
    const res = await request
      .post('/api/auth/gitlab/refresh')
      .send({ refreshToken: '' });

    expect(res.status).toBe(400);
  });
});
