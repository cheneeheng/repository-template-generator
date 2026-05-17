import { Router } from 'express';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  buildGitHubAuthUrl,
  buildGitLabAuthUrl,
  exchangeCodeForToken,
  revokeToken,
} from '../services/oauth.js';
import { getInstallationToken } from '../services/githubApp.js';
import { authStartLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const pendingStates = new Map(); // state → { provider, expiresAt }

// Sweep expired states every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (val.expiresAt < now) pendingStates.delete(key);
  }
}, 60_000);

router.get('/providers', (req, res) => {
  res.json({
    github: !!process.env.GITHUB_CLIENT_ID,
    githubApp: !!process.env.GITHUB_APP_ID,
    gitlab: !!process.env.GITLAB_CLIENT_ID,
  });
});

router.get('/github-app/install', (req, res) => {
  if (!process.env.GITHUB_APP_INSTALLATION_URL) {
    return res.status(404).json({ error: 'GitHub App not configured' });
  }
  res.redirect(process.env.GITHUB_APP_INSTALLATION_URL);
});

router.get('/github-app/callback', async (req, res) => {
  if (!process.env.GITHUB_APP_ID) {
    return res.status(404).json({ error: 'GitHub App not configured' });
  }

  const { installation_id, setup_action } = req.query;

  if (setup_action === 'delete') {
    return res.redirect('/');
  }

  if (!installation_id) {
    return res.redirect(`/export#error=${encodeURIComponent('Missing installation_id')}`);
  }

  try {
    const token = await getInstallationToken(installation_id);
    res.redirect(`/export#token=${token}&provider=github-app`);
  } catch (err) {
    res.redirect(`/export#error=${encodeURIComponent(err.message)}`);
  }
});

router.post('/gitlab/refresh', async (req, res) => {
  const { refreshToken } = z.object({
    refreshToken: z.string().min(1),
  }).parse(req.body);

  const r = await fetch(`${process.env.GITLAB_BASE_URL ?? 'https://gitlab.com'}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GITLAB_CLIENT_ID,
      client_secret: process.env.GITLAB_CLIENT_SECRET,
      redirect_uri: process.env.GITLAB_REDIRECT_URI,
    }),
  });

  if (!r.ok) {
    return res.status(401).json({ error: 'refresh_failed' });
  }

  const data = await r.json();
  res.json({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
});

router.get('/:provider/start', authStartLimiter, (req, res) => {
  const { provider } = req.params;
  if (!['github', 'gitlab'].includes(provider)) {
    return res.status(400).json({ error: 'Unknown provider' });
  }

  const configured =
    provider === 'github'
      ? !!process.env.GITHUB_CLIENT_ID
      : !!process.env.GITLAB_CLIENT_ID;
  if (!configured) {
    return res.status(400).json({ error: `${provider} OAuth is not configured` });
  }

  const state = nanoid();
  pendingStates.set(state, { provider, expiresAt: Date.now() + 10 * 60 * 1000 });

  const url =
    provider === 'github'
      ? buildGitHubAuthUrl(state)
      : buildGitLabAuthUrl(state);

  res.redirect(url);
});

router.get('/:provider/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.redirect(
      `/export#error=${encodeURIComponent(error_description ?? error)}`
    );
  }

  const entry = pendingStates.get(state);
  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired state' });
  }
  pendingStates.delete(state);

  try {
    const tokens = await exchangeCodeForToken(entry.provider, code);
    if (entry.provider === 'gitlab') {
      res.redirect(
        `/export#token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&expiresAt=${tokens.expiresAt}&provider=gitlab`
      );
    } else {
      res.redirect(`/export#token=${tokens}&provider=${entry.provider}`);
    }
  } catch (err) {
    res.redirect(`/export#error=${encodeURIComponent(err.message)}`);
  }
});

router.get('/:provider/revoke', async (req, res) => {
  try {
    await revokeToken(req.params.provider, req.query.token);
  } catch {}
  res.json({ ok: true });
});

// Test-only helper to seed the pending state map deterministically
export function _seedState(state, entry) {
  if (process.env.NODE_ENV !== 'test') return;
  pendingStates.set(state, entry);
}

export default router;
