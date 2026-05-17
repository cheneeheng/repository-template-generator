import createError from 'http-errors';

export function buildGitHubAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_REDIRECT_URI,
    scope: 'repo',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export function buildGitLabAuthUrl(state) {
  const base = process.env.GITLAB_BASE_URL ?? 'https://gitlab.com';
  const params = new URLSearchParams({
    client_id: process.env.GITLAB_CLIENT_ID,
    redirect_uri: process.env.GITLAB_REDIRECT_URI,
    response_type: 'code',
    scope: 'api',
    state,
  });
  return `${base}/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(provider, code) {
  if (provider === 'github') {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      }),
    });
    const data = await r.json();
    if (data.error) throw createError(502, `GitHub token exchange failed: ${data.error_description}`);
    return data.access_token;
  }

  if (provider === 'gitlab') {
    const base = process.env.GITLAB_BASE_URL ?? 'https://gitlab.com';
    const r = await fetch(`${base}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITLAB_CLIENT_ID,
        client_secret: process.env.GITLAB_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GITLAB_REDIRECT_URI,
      }),
    });
    const data = await r.json();
    if (data.error) throw createError(502, `GitLab token exchange failed: ${data.error_description}`);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }

  throw createError(400, `Unknown provider: ${provider}`);
}

// Best-effort — never throws; callers should not depend on success
export async function revokeToken(provider, token) {
  try {
    if (provider === 'github') {
      const credentials = Buffer.from(
        `${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`
      ).toString('base64');
      await fetch(
        `https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/token`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github+json',
          },
          body: JSON.stringify({ access_token: token }),
        }
      );
      return;
    }

    if (provider === 'gitlab') {
      const base = process.env.GITLAB_BASE_URL ?? 'https://gitlab.com';
      await fetch(`${base}/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.GITLAB_CLIENT_ID,
          client_secret: process.env.GITLAB_CLIENT_SECRET,
          token,
        }),
      });
    }
  } catch {
    // best-effort — swallow errors
  }
}
