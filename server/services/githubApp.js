import jwt from 'jsonwebtoken';

const GITHUB_API = 'https://api.github.com';

function generateAppJWT() {
  // dotenv does NOT unescape \n — the .replace() below handles the literal \\n
  // that dotenv loads when the PEM is stored as a single-line value in .env
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  // iat backdated 60s for GitHub's clock skew tolerance; noTimestamp prevents
  // jsonwebtoken from overriding the manually set iat
  return jwt.sign(
    { iat: now - 60, exp: now + 600, iss: String(process.env.GITHUB_APP_ID) },
    privateKey,
    { algorithm: 'RS256', noTimestamp: true }
  );
}

export async function getInstallationToken(installationId) {
  const appJWT = generateAppJWT();
  const r = await fetch(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJWT}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  if (!r.ok) throw new Error(`GitHub App token exchange failed: ${r.status}`);
  const data = await r.json();
  return data.token;
}
