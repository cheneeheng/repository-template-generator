import { Router } from 'express';
import { nanoid } from 'nanoid';
import {
  buildGitHubAuthUrl,
  buildGitLabAuthUrl,
  exchangeCodeForToken,
  revokeToken,
} from '../services/oauth.js';
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
    gitlab: !!process.env.GITLAB_CLIENT_ID,
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
    const token = await exchangeCodeForToken(entry.provider, code);
    res.redirect(`/export#token=${token}&provider=${entry.provider}`);
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

export default router;
